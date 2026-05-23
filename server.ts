import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";
import { Pool } from "pg";

dotenv.config();

// Initialize PostgreSQL Pool
const dbConfig = {
  connectionString: process.env.DATABASE_URL?.trim() || undefined,
  host: process.env.PGHOST || process.env.PG_HOST,
  port: Number(process.env.PGPORT || process.env.PG_PORT || 5432),
  user: process.env.PGUSER || process.env.PG_USER,
  password: process.env.PGPASSWORD || process.env.PG_PASSWORD,
  database: process.env.PGDATABASE || process.env.PG_DATABASE,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  max: Number(process.env.DB_POOL_MAX || 5),
};

const hasDbConfig = Boolean(dbConfig.connectionString || dbConfig.host);
const pool = hasDbConfig ? new Pool(dbConfig) : null;

pool?.on('error', (err) => {
  console.error('Unexpected database error on idle client', err);
});

const initDb = async () => {
  if (!pool) {
    console.warn("Database is not configured. Progress APIs will use no-op fallbacks.");
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_user_progress (
        user_id VARCHAR(255) PRIMARY KEY,
        progress_data JSONB NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_content (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        content_type VARCHAR(50),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database tables initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
};
initDb();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Database API Routes ---

// Get user progress
app.get("/api/progress/:userId", async (req, res) => {
  try {
    if (!pool) {
      res.json({});
      return;
    }

    const { userId } = req.params;
    const result = await pool.query(
      "SELECT progress_data FROM app_user_progress WHERE user_id = $1",
      [userId]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0].progress_data);
    } else {
      res.json({}); // Default empty progress
    }
  } catch (err: any) {
    console.error("Error fetching progress:", err);
    res.json({});
  }
});

// Update user progress
app.post("/api/progress/:userId", async (req, res) => {
  try {
    if (!pool) {
      res.json({ success: true, skipped: "database_not_configured" });
      return;
    }

    const { userId } = req.params;
    const progressData = req.body;
    
    await pool.query(
      `INSERT INTO app_user_progress (user_id, progress_data, last_updated)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE 
       SET progress_data = $2, last_updated = CURRENT_TIMESTAMP`,
      [userId, progressData]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error saving progress:", err);
    res.json({ success: false, error: "Failed to save progress" });
  }
});

// Save custom content (e.g. AI generated customized lesson)
app.post("/api/custom_content/:userId", async (req, res) => {
  try {
    if (!pool) {
      res.json({ success: true, skipped: "database_not_configured" });
      return;
    }

    const { userId } = req.params;
    const { contentType, data } = req.body;
    
    const result = await pool.query(
      "INSERT INTO custom_content (user_id, content_type, data) VALUES ($1, $2, $3) RETURNING id",
      [userId, contentType || "lesson", data]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    console.error("Error saving custom content:", err);
    res.status(500).json({ error: "Failed to save custom content" });
  }
});

// Get custom content for user
app.get("/api/custom_content/:userId", async (req, res) => {
  try {
    if (!pool) {
      res.json([]);
      return;
    }

    const { userId } = req.params;
    const result = await pool.query(
      "SELECT id, content_type, data, created_at FROM custom_content WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Error fetching custom content:", err);
    res.status(500).json({ error: "Failed to fetch custom content" });
  }
});


let geminiClient: GoogleGenAI | null = null;
let openaiClient: OpenAI | null = null;

function getGemini() {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
  }
  return geminiClient;
}

function getOpenAI() {
  if (!openaiClient) {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const explicitBaseUrl = process.env.OPENAI_BASE_URL?.trim();
    const useGroqDefaults = Boolean(groqKey && !openaiKey && !explicitBaseUrl);

    openaiClient = new OpenAI({
      apiKey: openaiKey || groqKey || "not-needed",
      baseURL: explicitBaseUrl || (useGroqDefaults ? "https://api.groq.com/openai/v1" : undefined),
    });
  }
  return openaiClient;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

// Supports OpenAI-compatible servers first, then Gemini. Falls back immediately
// when no provider is configured so the app never appears "stuck".
async function generateAIContentWithFallback(prompt: string, fallbackMockData: any) {
  const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim();
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || groqApiKey;
  const useGroqDefaults = Boolean(groqApiKey && !process.env.OPENAI_API_KEY?.trim() && !openaiBaseUrl);
  const defaultOpenAIModel = useGroqDefaults
    ? process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant"
    : process.env.OPENAI_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || "gpt-4o-mini";
  const openaiModelsToTry = (process.env.OPENAI_MODELS || defaultOpenAIModel)
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  if (openaiBaseUrl || openaiApiKey) {
    for (const model of openaiModelsToTry) {
      try {
        console.log(`Attempting generation with OpenAI-compatible model: ${model}`);
        const completionParams: any = {
          model,
          messages: [
            {
              role: "system",
              content: "You are a professional English teacher assistant. Always output valid JSON only, with no markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: Number(process.env.AI_MAX_TOKENS || 1200),
          response_format: { type: "json_object" },
        };
        const shouldDisableThinking =
          process.env.AI_THINKING?.trim() === "disabled" ||
          Boolean(openaiBaseUrl?.includes("bigmodel.cn"));
        if (shouldDisableThinking) {
          completionParams.thinking = { type: "disabled" };
        }

        const completion = await withTimeout(
          getOpenAI().chat.completions.create(completionParams),
          Number(process.env.AI_TIMEOUT_MS || 20000),
          `OpenAI-compatible generation ${model}`,
        );
        const text = completion.choices[0]?.message?.content;
        if (text) return text;
      } catch (err: any) {
        console.warn(`OpenAI-compatible model ${model} failed:`, err.message);
      }
    }
  }

  if (process.env.GEMINI_API_KEY?.trim()) {
    const ai = getGemini();
    const config = {
      systemInstruction: "You are a professional English teacher assistant. You always output valid, parseable JSON arrays of objects.",
    };
    const modelsToTry = (process.env.GEMINI_MODELS || "gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-2.5-flash,gemini-2.0-flash-001")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

    for (const model of modelsToTry) {
      try {
        console.log(`Attempting generation with Gemini model: ${model}`);
        const response = await withTimeout(
          ai.models.generateContent({ model, contents: prompt, config }),
          Number(process.env.AI_TIMEOUT_MS || 20000),
          `Gemini ${model}`,
        );
        if (response.text) {
          console.log(`Success with Gemini model: ${model}`);
          return response.text;
        }
      } catch (err: any) {
        console.warn(`Gemini model ${model} failed:`, err.message);
      }
    }
  }

  console.warn("No available AI provider succeeded. Using predefined fallback mock data.");
  return JSON.stringify(fallbackMockData);
}

const TEACHER_AVATAR = "https://api.dicebear.com/7.x/notionists/svg?seed=Teacher";
const STUDENT_AVATAR = "https://api.dicebear.com/7.x/notionists/svg?seed=Student";

function buildQuestion(question: string, questionCn: string, correct: string, correctCn: string, wrong1: string, wrong1Cn: string, wrong2: string, wrong2Cn: string) {
  return {
    type: "question",
    format: "multiple_choice",
    question,
    question_cn: questionCn,
    options: [
      { text: correct, text_cn: correctCn, is_correct: true },
      { text: wrong1, text_cn: wrong1Cn, is_correct: false },
      { text: wrong2, text_cn: wrong2Cn, is_correct: false },
    ],
  };
}

function inferLessonKind(userPrompt: string) {
  const text = userPrompt.toLowerCase();
  if (/机场|登机|航班|咖啡|cafe|coffee|latte|拿铁/.test(text)) return "airport_cafe";
  if (/商务|商业|会议|客户|汇报|office|business|meeting|client/.test(text)) return "business_meeting";
  if (/办公室|同事|茶|tea|休息/.test(text)) return "office_tea";
  if (/餐厅|点餐|饭店|restaurant|food|order/.test(text)) return "restaurant";
  if (/酒店|入住|前台|hotel|check in/.test(text)) return "hotel";
  return "daily_conversation";
}

function buildLocalCustomLesson(userPrompt: string) {
  const kind = inferLessonKind(userPrompt);

  if (kind === "airport_cafe") {
    return [
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Welcome to the airport cafe.", text_cn: "欢迎来到机场咖啡厅。" },
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "I'd like a latte, please.", text_cn: "请给我一杯拿铁。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "What size would you like?", text_cn: "您想要什么杯型？" },
      buildQuestion("How do you order politely?", "怎样礼貌点单？", "I'd like a latte, please.", "请给我一杯拿铁。", "Give me latte.", "给我拿铁。", "Latte is me.", "拿铁是我。"),
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "A small one, please.", text_cn: "请给我小杯。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "For here or to go?", text_cn: "堂食还是带走？" },
      buildQuestion("What does 'to go' mean?", "to go 是什么意思？", "Take away.", "带走。", "Drink here.", "在这喝。", "Pay later.", "稍后付款。"),
      buildQuestion("Which reply means take away?", "哪句表示带走？", "To go, please.", "请打包带走。", "For here, please.", "请在这里。", "No coffee today.", "今天不要咖啡。"),
    ];
  }

  if (kind === "business_meeting") {
    return [
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Let's start the meeting.", text_cn: "我们开始会议吧。" },
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "I have one update.", text_cn: "我有一个更新。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Please share the sales numbers.", text_cn: "请分享销售数据。" },
      buildQuestion("Which sentence starts a meeting?", "哪句能开始会议？", "Let's start the meeting.", "我们开始会议吧。", "Give me meeting.", "给我会议。", "Meeting is eat.", "会议是吃。"),
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "Sales are up this week.", text_cn: "本周销售上涨。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Great. Any risks?", text_cn: "很好。有风险吗？" },
      buildQuestion("How do you report good news?", "怎样汇报好消息？", "Sales are up.", "销售上涨了。", "Sales are sleep.", "销售睡觉。", "Sales is me.", "销售是我。"),
      buildQuestion("What means 'risks'?", "risks 是什么意思？", "Possible problems.", "可能的问题。", "Free gifts.", "免费礼物。", "Meeting snacks.", "会议零食。"),
    ];
  }

  if (kind === "office_tea") {
    return [
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Would you like some tea?", text_cn: "你想喝点茶吗？" },
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "Yes, that sounds nice.", text_cn: "好呀，听起来不错。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Green tea or black tea?", text_cn: "绿茶还是红茶？" },
      buildQuestion("How do you accept tea politely?", "怎样礼貌接受茶？", "Yes, that sounds nice.", "好呀，听起来不错。", "Tea give me.", "茶给我。", "I am tea.", "我是茶。"),
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "Green tea, please.", text_cn: "请给我绿茶。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Let's take a short break.", text_cn: "我们短暂休息吧。" },
      buildQuestion("What is a short break?", "short break 是什么？", "A quick rest.", "短暂休息。", "A long trip.", "长途旅行。", "A big dinner.", "大餐。"),
      buildQuestion("Which reply orders green tea?", "哪句点绿茶？", "Green tea, please.", "请给我绿茶。", "Green table, please.", "请给我绿桌。", "Tea is green me.", "茶绿我。"),
    ];
  }

  if (kind === "restaurant") {
    return [
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Welcome. Are you ready?", text_cn: "欢迎。准备点餐了吗？" },
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "Yes. I'd like noodles.", text_cn: "是的。我想要面条。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Anything to drink?", text_cn: "需要喝点什么？" },
      buildQuestion("How do you order food?", "怎样点餐？", "I'd like noodles.", "我想要面条。", "Noodles me now.", "面条我现在。", "I am noodles.", "我是面条。"),
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "Water, please.", text_cn: "请给我水。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Sure. One moment.", text_cn: "好的。请稍等。" },
      buildQuestion("What means 'one moment'?", "one moment 是什么？", "Please wait.", "请稍等。", "Go away.", "走开。", "Eat fast.", "快吃。"),
      buildQuestion("Which drink does Student want?", "学生想喝什么？", "Water.", "水。", "Coffee.", "咖啡。", "Juice.", "果汁。"),
    ];
  }

  if (kind === "hotel") {
    return [
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Welcome to our hotel.", text_cn: "欢迎来到酒店。" },
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "I'd like to check in.", text_cn: "我想办理入住。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "May I see your passport?", text_cn: "可以看护照吗？" },
      buildQuestion("How do you check in?", "怎样说办理入住？", "I'd like to check in.", "我想办理入住。", "I live passport.", "我住护照。", "Room me yes.", "房间我好。"),
      { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "Here you are.", text_cn: "给您。" },
      { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Your room is ready.", text_cn: "您的房间好了。" },
      buildQuestion("What means 'Here you are'?", "Here you are 是什么？", "Here it is.", "给您。", "I am here.", "我在这里。", "You are hotel.", "你是酒店。"),
      buildQuestion("What is ready?", "什么准备好了？", "The room.", "房间。", "The taxi.", "出租车。", "The coffee.", "咖啡。"),
    ];
  }

  return [
    { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "What do you need help with?", text_cn: "你需要什么帮助？" },
    { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "I want to practice English.", text_cn: "我想练习英语。" },
    { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Let's use simple sentences.", text_cn: "我们用简单句。" },
    buildQuestion("How do you ask for help?", "怎样请求帮助？", "Can you help me?", "你能帮我吗？", "Help is me.", "帮助是我。", "I help you me.", "我帮你我。"),
    { type: "dialogue", speaker: "Student", avatar: STUDENT_AVATAR, text: "Can you say that again?", text_cn: "你能再说一遍吗？" },
    { type: "dialogue", speaker: "Teacher", avatar: TEACHER_AVATAR, text: "Of course. Listen again.", text_cn: "当然。再听一次。" },
    buildQuestion("What means 'say that again'?", "say that again 是什么？", "Repeat it.", "重复一遍。", "Stop talking.", "别说话。", "Speak faster.", "说快点。"),
    buildQuestion("Which sentence is polite?", "哪句更礼貌？", "Can you help me?", "你能帮我吗？", "Help me now!", "现在帮我！", "You must help.", "你必须帮。"),
  ];
}

function englishFieldsContainChinese(items: any[]) {
  const hasChinese = (value: any) => typeof value === "string" && /[\u3400-\u9fff]/.test(value);
  return items.some((item) => {
    if (hasChinese(item.text) || hasChinese(item.question)) return true;
    if (Array.isArray(item.options)) {
      return item.options.some((option: any) => hasChinese(option.text));
    }
    return false;
  });
}

function getEnglishLessonText(items: any[]) {
  return items
    .flatMap((item) => [
      item.text,
      item.question,
      ...(Array.isArray(item.options) ? item.options.map((option: any) => option.text) : []),
    ])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function lessonMatchesKind(items: any[], kind: string) {
  if (kind === "daily_conversation") return true;
  const text = getEnglishLessonText(items);
  const keywordsByKind: Record<string, string[]> = {
    airport_cafe: ["airport", "coffee", "cafe", "café", "latte", "drink"],
    business_meeting: ["meeting", "business", "sales", "client", "update", "risk"],
    office_tea: ["tea", "office", "break", "green tea", "black tea"],
    restaurant: ["restaurant", "order", "food", "noodles", "water", "drink"],
    hotel: ["hotel", "check in", "passport", "room"],
  };
  return (keywordsByKind[kind] || []).some((keyword) => text.includes(keyword));
}

function normalizeCustomLessonItems(data: any, fallbackItems: any[], kind: string) {
  let items = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items)) return fallbackItems;

  items = items
    .filter((item: any) => item && (item.type === "dialogue" || item.type === "question"))
    .map((item: any) => {
      if (item.type === "dialogue") {
        return {
          type: "dialogue",
          speaker: item.speaker === "Student" ? "Student" : "Teacher",
          avatar: item.avatar || (item.speaker === "Student" ? STUDENT_AVATAR : TEACHER_AVATAR),
          text: item.text || item.dialogue || item.sentence || "",
          text_cn: item.text_cn || item.dialogue_cn || item.translation || "",
        };
      }

      return {
        type: "question",
        format: "multiple_choice",
        question: item.question || "",
        question_cn: item.question_cn || "",
        options: Array.isArray(item.options) ? item.options.slice(0, 3) : [],
      };
    })
    .filter((item: any) => {
      if (item.type === "dialogue") return item.text && item.text_cn;
      return item.question && item.options.length >= 2;
    });

  const questionCount = items.filter((item: any) => item.type === "question").length;
  if (items.length < 4 || questionCount < 1 || englishFieldsContainChinese(items) || !lessonMatchesKind(items, kind)) {
    return fallbackItems;
  }

  return items.slice(0, 10);
}

// API Routes
app.post("/api/review/generate", async (req, res) => {
  try {
    const { mistakes } = req.body;
    console.log("Generating AI questions for mistakes:", mistakes?.length);

    const aiMistakes = (!mistakes || !Array.isArray(mistakes) || mistakes.length === 0) 
      ? [{ instruction: "I want to learn about ordering coffee or food at a cafe.", options: ["coffee", "scone", "tea"] }] 
      : mistakes;

    const prompt = `You are an expert language teacher. Based on the following mistakes made by a student during their lessons, generate 1-3 review study items (Reading items) to help them strengthen their weak areas.

Context of mistakes (or current topics):
${aiMistakes.map((m: any, i: number) => `${i + 1}. Instruction/Question: ${m.instruction}\n   Details: ${JSON.stringify(m.options || m.pairs)}`).join("\n\n")}

Requirements:
1. Generate items in JSON format.
2. Each item must include:
   - type: "reading"
   - sentence_en: A natural English sentence that uses the key vocabulary from the mistake.
   - sentence_cn: The Chinese translation of that sentence.
   - key_vocabulary: { 
       word: The specific word they got wrong,
       phonetic: IPA phonetic,
       translation: Chinese meaning of the word,
       example_en: Another short example sentence,
       example_cn: Translation of the second example
     }

Strictly return ONLY a JSON array. Do not include markdown formatting.`;

    const fallbackItems = aiMistakes.slice(0, 3).map((m: any, idx: number) => {
      const topicSource = m.instruction || m.question || "this topic";
      return {
        "type": "reading",
        "sentence_en": `Let's practice the concept from: ${topicSource.slice(0, 30)}.`,
        "sentence_cn": `让我们练习刚才做错的知识点：'${topicSource.slice(0, 30)}'。`,
        "key_vocabulary": {
          "word": "Practice",
          "phonetic": "/ˈpræktɪs/",
          "translation": "练习",
          "example_en": "Practice makes perfect.",
          "example_cn": "熟能生巧。"
        }
      };
    });
    if (fallbackItems.length === 0) {
      fallbackItems.push({
        "type": "reading",
        "sentence_en": "You don't have many mistakes, keep up the good work!",
        "sentence_cn": "你没有太多错误，保持良好的学习状态！",
        "key_vocabulary": {
          "word": "excellent",
          "phonetic": "/ˈeksələnt/",
          "translation": "优秀的",
          "example_en": "You are doing an excellent job.",
          "example_cn": "你做得非常棒。"
        }
      });
    }

    const content = await generateAIContentWithFallback(prompt, fallbackItems);
    console.log("AI Response received:", content);
    
    let text = content || "[]";
    // Remove potential markdown code blocks
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let data = JSON.parse(text);
    
    if (!Array.isArray(data) && data.items) {
      data = data.items;
    } else if (!Array.isArray(data) && Object.keys(data).length === 1) {
      const firstKey = Object.keys(data)[0];
      if (Array.isArray(data[firstKey])) {
        data = data[firstKey];
      }
    }

    if (!Array.isArray(data)) {
        data = [data];
    }

    res.json(data);
  } catch (error: any) {
    console.error("AI Generation Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate review questions" });
  }
});

app.post("/api/review/generate/custom", async (req, res) => {
  try {
    const { prompt: userPrompt } = req.body;
    console.log("Generating custom AI questions for prompt:", userPrompt);

    if (!userPrompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const lessonKind = inferLessonKind(userPrompt);
    const fallbackStoryItems = buildLocalCustomLesson(userPrompt);

    const prompt = `The user wrote this learning request in Chinese or English: "${userPrompt}".
First infer the real learning scenario. Do not quote or copy the user's raw request in any English field.
Create a short beginner English mobile quiz for that scenario.
Return JSON only: {"items":[...]}.
Generate exactly 8 items: 5 dialogue items and 3 multiple_choice question items.
Each English text must be under 12 words.
Each Chinese text must be under 18 Chinese characters.
English fields must contain English only. Chinese fields contain Chinese only.
Use only these speakers: "Teacher" and "Student".

Dialogue schema:
{"type":"dialogue","speaker":"Teacher","avatar":"https://api.dicebear.com/7.x/notionists/svg?seed=Teacher","text":"English","text_cn":"中文"}

Question schema:
{"type":"question","format":"multiple_choice","question":"English","question_cn":"中文","options":[{"text":"correct","text_cn":"中文","is_correct":true},{"text":"wrong","text_cn":"中文","is_correct":false},{"text":"wrong","text_cn":"中文","is_correct":false}]}`;

    const content = await generateAIContentWithFallback(prompt, fallbackStoryItems);
    console.log("AI Custom Response received");
    
    let text = content || "[]";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (parseError: any) {
      console.warn("AI custom lesson JSON parse failed. Using local lesson:", parseError.message);
      data = fallbackStoryItems;
    }

    res.json(normalizeCustomLessonItems(data, fallbackStoryItems, lessonKind));
  } catch (error: any) {
    console.error("AI Custom Gen Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate custom lesson" });
  }
});

// Vite middleware for development
async function setupVite() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

setupVite();
