const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourcePath =
  process.argv[2] || "/Users/guzeping/Downloads/新家题目_精简.json";
const sceneDirs = [
  "/Users/guzeping/Downloads/前四节",
  "/Users/guzeping/Downloads/后四节",
];

const outputConfigDir = path.join(rootDir, "src/data/config");
const sceneOutputDir = path.join(rootDir, "public/assets/lesson-scenes");

const lessonMeta = {
  1: {
    title_cn: "硬着陆",
    description:
      "搬进4B的第一天，Mrs. Henderson和Jake帮你处理摔落的箱子和坏掉的暖气。",
    scene: "Apartment 4B",
    speaker_name: "Mrs. Henderson & Jake",
    speaker_avatar: "/assets/MrsHendersonhappy.png",
    reward: ["welcome_scones", "/assets/shafa1.png"],
  },
  2: {
    title_cn: "第一周",
    description:
      "Jake几乎每天来敲门，你认识Kevin，也第一次感受到这栋楼的邻里节奏。",
    scene: "Apartment Hallway",
    speaker_name: "Jake & Kevin",
    speaker_avatar: "/assets/jackhappy.png",
    reward: ["neighbor_toolbox", "/assets/drawer.png"],
  },
  3: {
    title_cn: "那场争吵",
    description:
      "你听见Mrs. Henderson和Ryan通电话争吵，带着蛋糕去陪她坐一会儿。",
    scene: "Apartment 4A",
    speaker_name: "Mrs. Henderson",
    speaker_avatar: "/assets/MrsHendersonhappy.png",
    reward: ["comfort_cake", "/assets/box.png"],
  },
  4: {
    title_cn: "早午餐",
    description:
      "Mrs. Henderson邀请大家吃早午餐，你终于见到Lisa，也看见Kevin的小心思。",
    scene: "Dining Room",
    speaker_name: "Kevin & Lisa",
    speaker_avatar: "/assets/Kevinhappy.png",
    reward: ["brunch_table", "/assets/basket.png"],
  },
  5: {
    title_cn: "和Lisa喝咖啡",
    description:
      "Lisa邀请你去家里喝咖啡，聊起重新开始，也撞见Jake遇到麻烦。",
    scene: "Lisa's Living Room",
    speaker_name: "Lisa",
    speaker_avatar: "/assets/lisahappy.png",
    reward: ["window_coffee", "/assets/cafeizhuo.png"],
  },
  6: {
    title_cn: "Jake的坏消息",
    description:
      "Jake收到涨租通知，Kevin和Lisa开始帮忙，你也加入一起听他说清楚发生了什么。",
    scene: "Hallway",
    speaker_name: "Jake & Dan",
    speaker_avatar: "/assets/jacksorrow.png",
    reward: ["rent_letter", "/assets/xiexin.png"],
  },
  7: {
    title_cn: "那通电话",
    description:
      "你陪Mrs. Henderson给Ryan打电话，终于把多年没说出口的话重新接上。",
    scene: "Apartment 4A",
    speaker_name: "Mrs. Henderson & Ryan",
    speaker_avatar: "/assets/MrsHendersonsorrow.png",
    reward: ["family_call", "/assets/liangsheng2.png"],
  },
  8: {
    title_cn: "百家饭聚会",
    description:
      "邻居们在院子里办potluck，Ryan也要来，4B终于像一个真正的新家。",
    scene: "Courtyard",
    speaker_name: "Neighbors",
    speaker_avatar: "/assets/lisahappiness..png",
    reward: ["garden_lights", "/assets/bbq.png"],
  },
};

const avatarBySpeaker = {
  "旁白": "/assets/npc.png",
  "Mrs. Henderson": "/assets/MrsHendersonhappy.png",
  Jake: "/assets/jackhappy.png",
  You: "/assets/youhappy.png",
  Kevin: "/assets/Kevinhappy.png",
  Lisa: "/assets/lisahappy.png",
  Dan: "/assets/npc1.png",
  Ryan: "/assets/npc1.png",
};

const translationByText = {
  "You are new in America. You are moving into apartment 4B. Oh no! Your big boxes just fell on the floor.":
    "你刚来到美国，正在搬进4B公寓。糟了！你的大箱子全摔在地上了。",
  "Oh dear! Are you okay? I live right next door in 4A. Let me help you.":
    "哎呀！你还好吗？我就住隔壁4A。我来帮你。",
  "Hi! Are you the new neighbor? I'm Jake in 5B, right above you. I can take the heavy boxes.":
    "嗨！你是新邻居吗？我是楼上5B的Jake，就在你正上方。重箱子我来搬。",
  "Thank you... both of you. Sorry, my English is not great.":
    "谢谢你们两位。不好意思，我英语不太好。",
  "Oh honey, don't worry about that. Now — I baked scones this morning. You're taking some.":
    "亲爱的，别担心这个。对了，我早上烤了司康，你一定要拿一些。",
  "Also — your heater's off.":
    "还有，你的暖气没开。",
  "Let me check... Ah, it is closed.  The guy before you must've closed it when he left.":
    "我看看……啊，是关着的。你之前住这里的人离开时肯定把它关了。",
  "Who lived here before?": "之前谁住在这里？",
  "Uh...": "呃……",
  "My son used to live with me. — right here in 4A. Then he wanted his own home. He moved into 4B to be near me.":
    "我儿子以前跟我一起住，就在4A。后来他想有自己的家，就搬进4B，好离我近一点。",
  "Yeah. That was two years ago. One day he just left. We don't know where he went.":
    "是啊。那是两年前的事了。有一天他突然走了。我们不知道他去了哪里。",
  "That's a story for another day, dear. Do you have enough blankets?":
    "亲爱的，那是以后再说的故事。你的毯子够吗？",
  "I think so... Mrs. Henderson, thank you. Really.":
    "我想够了……Henderson太太，谢谢你。真的谢谢。",
  "Call me Ruth, honey. You can knock on my door anytime. Good night.":
    "叫我Ruth就好，亲爱的。你随时都可以来敲我的门。晚安。",
  "That night, after Jake and Mrs. Henderson leave, you open your boxes. The apartment is clean, but you see things from the last person. A hook on the wall where a picture used to hang. A coffee ring on the kitchen counter. You open a drawer in the kitchen and see a small yellow paper:":
    "那天晚上，Jake和Henderson太太离开后，你打开箱子。公寓很干净，但你看见了上一个住户留下的痕迹：墙上曾挂画的钩子，厨房台面上的咖啡杯印。你打开厨房抽屉，看见一张黄色小纸条：",
  "You look at the paper for a long time. Then, you close the drawer.":
    "你盯着那张纸看了很久。然后，你关上了抽屉。",

  "Jake knocks on your door almost every day now. He's loud, funny, and treats you like you've known each other for years.":
    "现在Jake几乎每天都会来敲你的门。他很吵、很有趣，而且对你就像认识很多年的朋友一样。",
  "Hey, you have to try the taco truck outside. Two blocks away. The food is so good! Come on.":
    "嘿，你一定要试试外面的塔可餐车。就两个街区远。特别好吃！走吧。",
  "Now? I was going to study English...": "现在吗？我本来打算学英语……",
  "This IS English class. Lesson one: how to order tacos. Let's go.":
    "这就是英语课。第一课：怎么点塔可。走吧。",
  "That's Kevin in 3B. He fixes everything for free. Kevin — meet our new neighbor in 4B!":
    "那是3B的Kevin。他什么都会免费修。Kevin，来认识一下我们4B的新邻居！",
  "Hi. Welcome! If you need help, let me know.":
    "嗨，欢迎！如果你需要帮忙，就告诉我。",
  "Thanks! I'm your new neighbor.": "谢谢！我是你的新邻居。",
  "Nice to meet you.": "很高兴认识你。",
  "That evening, you see a message in the building's phone group: \"Sunday walk, who's in?? 🥾☀️\" Jake says: \"That's Lisa in 2B. She lives downstairs with her kid. She plans fun things for us. You will like her.\"":
    "那天晚上，你在公寓楼群聊里看到一条消息：\"周日散步，有人来吗？🥾☀️\" Jake说：\"那是2B的Lisa。她和孩子住在楼下。她总给大家安排有趣的活动。你会喜欢她的。\"",
  "You put down your phone and look around apartment 4B. You look at your sofa, your lamp, and the window. It feels like home now. You hear Jake in the hall: \"Tomorrow, we eat tacos!\" You smile.":
    "你放下手机，环顾4B公寓。你看着沙发、台灯和窗户。这里现在有点像家了。你听见Jake在走廊里喊：\"明天，我们吃塔可！\" 你笑了。",

  "You're picking up a package downstairs when you hear Mrs. Henderson's voice through her door. It is very loud. She's on the phone with her son, Ryan. He used to live in your apartment — 4B. But the rent went up, so he had to move out.":
    "你在楼下取包裹时，听见Henderson太太的声音从门里传出来，很大声。她正在和儿子Ryan通电话。Ryan以前住在你的公寓4B，但房租涨了，所以他不得不搬走。",
  "I don't care about the money, Ryan. I just want to SEE you...":
    "Ryan，我不在乎钱。我只是想见见你……",
  "That evening. Jake messages you privately.":
    "那天晚上，Jake私下给你发消息。",
  "Is Mrs. H okay? She didn't answer my message today. That never happens.":
    "H太太还好吗？她今天没回我消息。这从来没发生过。",
  "I heard something. Not sure if I should say.":
    "我听到了一些事。不确定该不该说。",
  "Don't push. Just show up.": "别追问。去陪陪她就好。",
  "You knock on her door with a cake from the supermarket.":
    "你带着超市买来的蛋糕去敲她的门。",
  "I brought you something. It's not homemade — sorry.":
    "我给你带了点东西。不是自己做的，不好意思。",
  "Oh — come in, dear. Sit with me.":
    "哦，亲爱的，进来吧。陪我坐一会儿。",
  "Thank you for coming. You make me think of Ryan sometimes.":
    "谢谢你来看我。有时候你会让我想起Ryan。",
  "Next day, Jake texts: \"Thank you. What you did worked. 🙏\" Then adds: \"She's making brunch this weekend... Do you want to come?\"":
    "第二天，Jake发来消息：\"谢谢你。你做的事有用。🙏\" 然后又补了一句：\"她这周末要做早午餐……你想来吗？\"",

  "Mrs. Henderson's brunch. You finally meet Lisa — warm, loud, full of energy. She takes pictures of everything. You also notice something: Kevin can't stop looking at her.":
    "Henderson太太的早午餐。你终于见到了Lisa，她热情、爽朗、充满活力，什么都要拍照。你还注意到一件事：Kevin一直忍不住看她。",
  "Lisa, you and Kevin should go to that food festival! You both love Thai food!":
    "Lisa，你和Kevin应该一起去那个美食节！你们都喜欢泰国菜！",
  "Maybe! We'll see.": "也许吧！到时候再看。",
  "Kevin likes Lisa. Everyone knows. This is going to be interesting.":
    "Kevin喜欢Lisa。大家都知道。这下有意思了。",
  "After brunch. Kevin pulls you aside in the hall.":
    "早午餐结束后，Kevin把你拉到走廊一边私下说话。",
  "Was that weird? Am I being weird?": "刚才很奇怪吗？我是不是很奇怪？",
  "I don't know the rules here. But she seems like she needs time.":
    "我不太懂这里的规则。但她看起来需要一点时间。",
  "Yeah. You're probably right.": "嗯，你可能是对的。",
  "That night, Lisa messages you: \"Maybe coffee sometime? Just us.\"":
    "那天晚上，Lisa给你发消息：\"改天喝杯咖啡？就我们俩。\"",

  "Lisa invites you to her home. You sit in chairs by the window in the living room. There are two cups of coffee on the table. Lisa looks sad.":
    "Lisa邀请你去她家。你们坐在客厅窗边的椅子上，桌上有两杯咖啡。Lisa看起来有些难过。",
  "I moved here after my divorce.": "我离婚后搬到了这里。",
  "I want to learn to live alone. Kevin is a great guy, but I am not ready for a new boyfriend.":
    "我想学着一个人生活。Kevin是个很好的人，但我还没准备好开始新的恋爱。",
  "You don't owe anyone a relationship. But maybe tell him — so he stops guessing.":
    "你不欠任何人一段关系。但也许可以告诉他，这样他就不用一直猜了。",
  "You are very smart. How do you know this?":
    "你很聪明。你怎么会懂这些？",
  "I'm not wise. I started over too. I get it.":
    "我不是聪明。我也重新开始过，所以我懂。",
  "You walk back to the building together. In the hall, Jake is angry. He is shouting at a man — Dan, the building manager. Jake is very upset.":
    "你们一起走回公寓楼。在走廊里，Jake很生气，正在冲一个男人喊话。那个男人是楼管Dan。Jake非常激动。",
  "Dan sees you. He walks out the door. Jake watches him go. He is quiet for a long time. Then he says:":
    "Dan看见你们后走出了门。Jake看着他离开，沉默了很久。然后他说：",
  "Don't worry. I can fix this.": "别担心。我能解决这件事。",

  "Jake lost his job two weeks ago. He told you over coffee — no big deal, he said, he'd figure it out. But today, he gets a bad letter from the building manager. The company is raising his rent.":
    "Jake两周前失业了。他喝咖啡时告诉过你，说没什么大不了，他会想办法。但今天，他收到楼管寄来的坏消息：公司要给他涨房租。",
  "You can't ask for more money now!": "你们不能现在要更多钱！",
  "Yes, I can. You signed the paper. Look at the contract. Section 4.2.":
    "可以。你签了文件。看合同，第4.2条。",
  "Let me see the letter.": "让我看看那封信。",
  "You post the photo in the group chat: \"Has anyone seen this before?\" Kevin answers fast: \"Yeah. That's how they got Ryan out.\"":
    "你把照片发到群聊里：\"有人以前见过这个吗？\" Kevin很快回复：\"见过。他们当年就是这样把Ryan赶走的。\"",
  "Not this time. Not again.": "这次不行。不能再这样了。",
  "I know a good lawyer. He can help.": "我认识一个好律师。他能帮忙。",
  "I will write a letter to the company.": "我会给公司写一封信。",
  "Jake — tell me what happened, slowly. I'll explain it to the lawyer.":
    "Jake，慢慢告诉我发生了什么。我来解释给律师听。",
  "Thank you. You're the only person I can hear right now.":
    "谢谢你。现在我唯一听得进去的人就是你。",
  "The lawyer helps Jake. Three days later, the company says: \"Okay, no more rent increase.\" Jake is happy. He sends a message to the group: \"4B just saved my apartment! 🎉\"":
    "律师帮助了Jake。三天后，公司说：\"好，不涨租了。\" Jake很开心，在群里发消息：\"4B刚刚救了我的公寓！🎉\"",
  "Why didn't people help Ryan before?": "以前为什么没有人帮Ryan？",
  "Because back then, we didn't have you.": "因为那时候，我们还没有你。",

  "You tell Mrs. Henderson the truth. The landlord played a trick on Jake. They did the same thing to Ryan. They pushed him out.":
    "你把真相告诉Henderson太太。房东对Jake耍了手段，他们当年也对Ryan做过同样的事，把他逼走了。",
  "No one helped Ryan back then...": "那时候没人帮Ryan……",
  "Maybe you should tell him. Things are different now.":
    "也许你应该告诉他。现在不一样了。",
  "He won't answer my calls. We argued when he left.":
    "他不会接我的电话。他离开的时候我们吵了一架。",
  "I can call with you. Do you want to try?":
    "我可以陪你一起打。你想试试吗？",
  "...Mom?": "……妈妈？",
  "He's coming to visit. Next month.": "他要来看我了。下个月。",
  "Jake hears the news. \"Wow. You are only here for one month. But you fixed a big problem. We couldn't do that for two years.\" You say: \"I just dialed the phone.\" Jake: \"Yeah. But it worked.\"":
    "Jake听到这个消息后说：\"哇。你才来一个月，却解决了一个大问题。我们两年都没做到。\" 你说：\"我只是拨了个电话。\" Jake说：\"是啊，但它有用。\"",

  "Lisa suggests a potluck to celebrate. The courtyard fills up — eighteen people. Two months ago, it was five.":
    "Lisa提议办一场百家饭来庆祝。院子里热闹起来，有十八个人。两个月前，只有五个人。",
  "Everyone — try 4B's dish. NOW.": "大家都来尝尝4B做的菜。现在就尝。",
  "Unreal.": "太厉害了。",
  "Different food. Same warmth. Ryan will be here next month. I want him to meet all of you — especially you.":
    "不同的食物，一样的温暖。Ryan下个月会来。我想让他见见你们所有人，尤其是你。",
  "At the interview they asked how I overcame a challenge. I told them my neighbor who barely spoke English saved my apartment and made me coffee on my worst day.":
    "面试时他们问我怎么克服困难。我告诉他们，我那个英语还不太流利的邻居，在我最糟糕的一天救了我的公寓，还给我煮了咖啡。",
  "Everyone is quiet for a moment. The lights sway in the wind. Lisa looks at you.":
    "大家安静了一会儿。灯在风里轻轻摇晃。Lisa看向你。",
  "This place feels like home now. Because of you.":
    "这里现在像家了。因为你。",
  "She's right. You made this building a home.":
    "她说得对。是你让这栋楼变成了家。",
  "One by one, people stand up. Jake carries the chairs inside. Kevin washes the table. Lisa covers the leftover food.":
    "大家一个接一个站起来。Jake把椅子搬进屋，Kevin擦桌子，Lisa把剩下的食物盖好。",
  "Goodnight, dear. This is your home now. You know that, right?":
    "晚安，亲爱的。这里现在就是你的家了。你知道的，对吧？",
  "I know.": "我知道。",
};

const translateLine = (text) => {
  const normalized = String(text || "").trim();
  if (!normalized) return "……";
  return translationByText[normalized] || "";
};

const socialTermsByLesson = {
  1: [
    ["next door", "就在隔壁", "phrase"],
    ["right above you", "你正楼上", "phrase"],
    ["Your heater is off.", "你的暖气关着。", "sentence"],
    ["Who lived here before?", "之前谁住这里？", "sentence"],
  ],
  2: [
    ["knocks on your door", "敲你的门", "phrase"],
    ["comes round", "来访", "phrase"],
    ["downstairs", "楼下", "word"],
    ["Let's go downstairs.", "我们下楼吧。", "sentence"],
  ],
  3: [
    ["show up", "出现/去陪陪", "phrase"],
    ["don't push", "别追问", "phrase"],
    ["I brought you something.", "我给你带了点东西。", "sentence"],
    ["Come in and sit with me.", "进来陪我坐坐。", "sentence"],
  ],
  4: [
    ["dining room", "餐厅", "word"],
    ["everyone knows", "大家都知道", "phrase"],
    ["pull aside", "拉到一边私下说", "phrase"],
    ["She needs time.", "她需要时间。", "sentence"],
  ],
  5: [
    ["living room", "客厅", "word"],
    ["divorce", "离婚", "word"],
    ["started over", "重新开始", "phrase"],
    ["Maybe tell him how you feel.", "也许告诉他你的感受。", "sentence"],
  ],
  6: [
    ["raising his rent", "给他涨房租", "phrase"],
    ["contract", "合同", "word"],
    ["neighbor", "邻居", "word"],
    ["Tell me what happened.", "告诉我发生了什么。", "sentence"],
  ],
  7: [
    ["pushed him out", "逼他离开", "phrase"],
    ["come round", "来访", "phrase"],
    ["He's coming to visit next month.", "他下个月要来看望。", "sentence"],
    ["I can call with you.", "我可以陪你一起打电话。", "sentence"],
  ],
  8: [
    ["potluck", "百家饭/自带菜聚餐", "word"],
    ["garden gate", "花园大门", "phrase"],
    ["under the lights", "在灯光下", "phrase"],
    ["We're neighbors. That's what we do.", "我们是邻居，这就是我们会做的。", "sentence"],
  ],
};

const normalize = (value) =>
  String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\.png$/i, "")
    .replace(/^(\d+)/, "")
    .replace(/png$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value) =>
  normalize(value).replace(/\s+/g, "_").replace(/^_+|_+$/g, "") || "scene";

const cleanChineseOption = (value) =>
  String(value || "").replace(/^[A-Z]\s*[.、]\s*/, "").trim();

const cleanPrompt = (value) =>
  String(value || "")
    .replace(/^音频\s*[:：]\s*/, "")
    .trim();

const extractReadAloudTarget = (prompt, answer) => {
  const promptMatch = String(prompt || "").match(/请跟读[:：]\s*([^（]+)/);
  if (promptMatch) return promptMatch[1].trim();
  return String(answer || "")
    .replace(/（.*$/, "")
    .trim();
};

const normalizeAnswer = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[“”"'’‘.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getCoreWord = (question) => {
  const answer = String(question.correct_answer || "").replace(/（.*$/, "").trim();
  if (Array.isArray(question.options)) {
    const correct = question.options.find((option) => option.key === question.correct_answer);
    if (correct?.label) return correct.label;
  }

  if (answer && !/^\d+-[A-Z]/.test(answer)) return answer;

  if (question.options?.english?.[0]) return question.options.english[0];
  return question.prompt || "review";
};

const buildSceneManifest = () => {
  fs.rmSync(sceneOutputDir, { recursive: true, force: true });
  fs.mkdirSync(sceneOutputDir, { recursive: true });

  const manifest = new Map();

  for (const dir of sceneDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fileName of fs.readdirSync(dir)) {
      if (!/\.png$/i.test(fileName)) continue;
      const lessonMatch = fileName.match(/^(\d+)/);
      if (!lessonMatch) continue;

      const lessonId = Number(lessonMatch[1]);
      const fileKey = normalize(fileName);
      const safeName =
        fileKey === "start"
          ? `lesson_${lessonId}_start.png`
          : `lesson_${lessonId}_${slugify(fileName)}.png`;
      const src = path.join(dir, fileName);
      const dest = path.join(sceneOutputDir, safeName);
      fs.copyFileSync(src, dest);

      const entry = {
        key: fileKey,
        src: `/assets/lesson-scenes/${safeName}`,
      };
      if (!manifest.has(lessonId)) manifest.set(lessonId, []);
      manifest.get(lessonId).push(entry);
    }
  }

  for (const entries of manifest.values()) {
    entries.sort((a, b) => (a.key === "start" ? -1 : b.key === "start" ? 1 : b.key.length - a.key.length));
  }

  return manifest;
};

const findSceneForItem = (lessonId, item, sceneManifest) => {
  const entries = sceneManifest.get(lessonId) || [];
  const text = normalize(`${item.text || ""} ${item.prompt || ""}`);

  if (text.length === 0) {
    return entries.find((entry) => entry.key === "start")?.src;
  }

  for (const entry of entries) {
    if (entry.key === "start") continue;
    if (entry.key && text.includes(entry.key)) return entry.src;

    const words = entry.key.split(/\s+/).filter(Boolean);
    const anchor = words.slice(0, Math.min(4, words.length)).join(" ");
    if (anchor && anchor.split(" ").length >= 2 && text.includes(anchor)) {
      return entry.src;
    }
  }

  return undefined;
};

const toMatchingQuestion = (lessonId, question) => {
  const answerMap = new Map();
  String(question.correct_answer || "")
    .split(",")
    .forEach((part) => {
      const match = part.trim().match(/^(\d+)\s*-\s*([A-Z])/i);
      if (match) answerMap.set(Number(match[1]) - 1, match[2].toUpperCase());
    });

  const chineseByKey = new Map();
  for (const option of question.options.chinese || []) {
    const match = String(option).match(/^([A-Z])\s*[.、]\s*(.+)$/i);
    if (match) chineseByKey.set(match[1].toUpperCase(), match[2].trim());
  }

  return {
    type: "question",
    format: "matching",
    question_id: `L${String(lessonId).padStart(2, "0")}_Q${String(question.question_number).padStart(2, "0")}`,
    source_type: question.question_type,
    instruction: cleanPrompt(question.prompt),
    speech_text: `Match these words: ${question.options.english.join(", ")}.`,
    feedback: question.feedback_correct,
    feedback_wrong: question.feedback_wrong,
    review_word: getCoreWord(question),
    pairs: question.options.english.map((english, index) => ({
      id: index + 1,
      image: english,
      word: cleanChineseOption(chineseByKey.get(answerMap.get(index))),
    })),
  };
};

const toMultipleChoiceQuestion = (lessonId, question) => ({
  type: "question",
  format: "multiple_choice",
  question_id: `L${String(lessonId).padStart(2, "0")}_Q${String(question.question_number).padStart(2, "0")}`,
  source_type: question.question_type,
  instruction: cleanPrompt(question.prompt),
  feedback: question.feedback_correct,
  feedback_wrong: question.feedback_wrong,
  review_word: getCoreWord(question),
  options: (question.options || []).map((option) => ({
    label: option.key,
    text: option.label,
    is_correct: option.key === question.correct_answer,
  })),
});

const toSentenceBuildQuestion = (lessonId, question) => ({
  type: "question",
  format: "sentence_build",
  question_id: `L${String(lessonId).padStart(2, "0")}_Q${String(question.question_number).padStart(2, "0")}`,
  source_type: question.question_type,
  instruction: cleanPrompt(question.prompt),
  chunks: question.options || [],
  answer: question.correct_answer,
  normalized_answer: normalizeAnswer(question.correct_answer),
  feedback: question.feedback_correct,
  feedback_wrong: question.feedback_wrong,
  review_word: getCoreWord(question),
});

const toSpeakingPracticeQuestion = (lessonId, question) => ({
  type: "question",
  format: "speaking_practice",
  question_id: `L${String(lessonId).padStart(2, "0")}_Q${String(question.question_number).padStart(2, "0")}`,
  source_type: question.question_type,
  instruction: cleanPrompt(question.prompt),
  target_sentence: extractReadAloudTarget(cleanPrompt(question.prompt), question.correct_answer),
  answer: extractReadAloudTarget(cleanPrompt(question.prompt), question.correct_answer),
  feedback: question.feedback_correct,
  feedback_wrong: question.feedback_wrong,
  review_word: getCoreWord(question),
});

const toQuestionStep = (lessonId, question) => {
  if (/T8/.test(question.question_type)) return toMatchingQuestion(lessonId, question);
  if (/T3/.test(question.question_type)) return toSentenceBuildQuestion(lessonId, question);
  if (/T6/.test(question.question_type)) return toSpeakingPracticeQuestion(lessonId, question);
  return toMultipleChoiceQuestion(lessonId, question);
};

const toEpisodeStep = (unit, item, sceneManifest) => {
  const lessonId = unit.unit_number;
  const sceneImage = findSceneForItem(lessonId, item, sceneManifest);

  if (item.type === "narration") {
    return {
      type: "narrator",
      speaker: "旁白",
      avatar: avatarBySpeaker["旁白"],
      text: item.text,
      text_cn: translateLine(item.text),
      ...(sceneImage ? { scene_image: sceneImage } : {}),
    };
  }

  if (item.type === "dialogue") {
    const dialogueText = item.text || "...";
    return {
      type: "dialogue",
      speaker: item.speaker,
      avatar: avatarBySpeaker[item.speaker] || "/assets/npc1.png",
      text: dialogueText,
      text_cn: translateLine(item.text),
      ...(sceneImage ? { scene_image: sceneImage } : {}),
    };
  }

  if (item.type === "question") {
    return {
      ...toQuestionStep(lessonId, item),
      ...(sceneImage ? { scene_image: sceneImage } : {}),
    };
  }

  throw new Error(`Unsupported item type: ${item.type}`);
};

const writeJson = (relativePath, data) => {
  const fullPath = path.join(rootDir, relativePath);
  fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`);
};

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (!Array.isArray(source.units) || source.units.length === 0) {
  throw new Error(`No units found in ${sourcePath}`);
}

const sceneManifest = buildSceneManifest();

for (const unit of source.units) {
  const startScene = sceneManifest.get(unit.unit_number)?.find((entry) => entry.key === "start")?.src;
  const episode = {
    title: `Episode ${unit.unit_number}: ${unit.unit_title_en}`,
    unit_title_en: unit.unit_title_en,
    scene_image: startScene,
    steps: unit.items.map((item) => toEpisodeStep(unit, item, sceneManifest)),
  };
  writeJson(`src/data/config/episode_${unit.unit_number}.json`, episode);
}

const lessons = {
  _description: "课程模块 - 8节新家主线课程",
  outline_title: "New Home Main Story",
  lessons: source.units.map((unit) => {
    const meta = lessonMeta[unit.unit_number];
    return {
      lesson_id: unit.unit_number,
      title: unit.unit_title_en,
      title_cn: meta.title_cn,
      description: meta.description,
      speaker_name: meta.speaker_name,
      speaker_avatar: meta.speaker_avatar,
      scene: meta.scene,
      unit_id: `Unit ${unit.unit_number}`,
      total_questions: unit.items.filter((item) => item.type === "question").length,
      stars_available: 3,
      unlock_building: unit.unit_number === 3 ? "community_hall" : null,
      reward_once: {
        type: "decoration",
        item_id: meta.reward[0],
        image: meta.reward[1],
      },
    };
  }),
};
writeJson("src/data/config/lessons.json", lessons);

const tasks = {
  _description: "任务模块配置 - 8节新家主线任务",
  tasks: source.units.map((unit) => {
    const meta = lessonMeta[unit.unit_number];
    return {
      task_id: unit.unit_number,
      title: unit.unit_title_en,
      subtitle: `+${unit.items.filter((item) => item.type === "question").length} questions, +4 phrases`,
      reward_image: meta.reward[1],
      reward_type: "decoration",
      reward_item_id: meta.reward[0],
      linked_lesson_id: unit.unit_number,
      sort_order: unit.unit_number,
      cost_diamonds: 0,
      is_tutorial: unit.unit_number === 1,
    };
  }),
};
writeJson("src/data/config/tasks.json", tasks);

const preLessonStories = {
  _description: "课前引导剧情流配置 - 8节新家主线课程",
  lessons: source.units.map((unit) => {
    const meta = lessonMeta[unit.unit_number];
    const startScene = sceneManifest.get(unit.unit_number)?.find((entry) => entry.key === "start")?.src;
    return {
      lesson_id: unit.unit_number,
      unit_id: `Unit ${unit.unit_number}`,
      bg_image: startScene || "/assets/BG.png",
      dialogues: [
        {
          speaker: "Bun",
          avatar: "/assets/buntouxiang.png",
          text_en: `Today's story is "${unit.unit_title_en}". Listen for the useful neighbor English in each scene.`,
          text_cn: `今天的故事是《${meta.title_cn}》。注意每个场景里的邻里生活英语。`,
          position: "left",
          audio: null,
        },
        {
          speaker: "Amili",
          avatar: "/assets/Amilitouxiang.png",
          text_en: meta.description,
          text_cn: "这节课会把剧情和表达放在一起练。",
          position: "right",
          audio: null,
        },
        {
          speaker: "Bun",
          avatar: "/assets/buntouxiang.png",
          text_en: "Tap through the story when you understand it, then answer the questions in the chat.",
          text_cn: "听懂后可以点屏幕推进剧情，然后在聊天里答题。",
          position: "left",
          audio: null,
        },
      ],
    };
  }),
};
writeJson("src/data/config/pre_lesson_stories.json", preLessonStories);

const questions = {
  _description: "课程题目配置 - 从8节新家主线课程生成",
  questions: source.units.flatMap((unit) =>
    unit.items
      .filter((item) => item.type === "question")
      .map((question) => {
        const step = toQuestionStep(unit.unit_number, question);
        return {
          lesson_id: unit.unit_number,
          question_id: step.question_id,
          sort_order: question.question_number,
          type: step.source_type,
          instruction: step.instruction,
          correct_answer: question.correct_answer,
          correct_feedback: question.feedback_correct,
          incorrect_feedback: question.feedback_wrong,
          options: question.options,
        };
      }),
  ),
};
writeJson("src/data/config/questions.json", questions);

const buildings = {
  _description: "建筑表 - 8节新家主线课程关联",
  buildings: [
    {
      building_id: "apartment_complex",
      name: "Apartment 4B",
      name_cn: "我的公寓",
      initial_level: 1,
      position: { x: 35, y: 50 },
      levels: [
        {
          level: 1,
          stars_to_next: 3,
          exterior_image: "/assets/fangzi2.png",
          interior_image: "/assets/jianzhunei2.png",
          linked_lessons: [1, 2],
        },
        {
          level: 2,
          stars_to_next: 6,
          exterior_image: "/assets/fangzi2.png",
          interior_image: "/assets/jianzhunei2.png",
          linked_lessons: [3, 4],
        },
        {
          level: 3,
          stars_to_next: 9,
          exterior_image: "/assets/lv2house.png",
          interior_image: "/assets/jianzhunei.png",
          linked_lessons: [5, 6],
        },
        {
          level: 4,
          stars_to_next: 12,
          exterior_image: "/assets/lv2house-1.png",
          interior_image: "/assets/jianzhunei.png",
          linked_lessons: [7, 8],
        },
      ],
    },
  ],
};
writeJson("src/data/config/buildings.json", buildings);

const socialTerms = source.units.flatMap((unit) =>
  (socialTermsByLesson[unit.unit_number] || []).map(([text, translation, tag], index) => ({
    id: `l${unit.unit_number}-${slugify(text)}-${index + 1}`,
    text,
    translation,
    lessonId: unit.unit_number,
    tag,
  })),
);
writeJson("src/data/config/social_terms.json", {
  _description: "朋友圈可选表达 - 从8节新家主线课程整理",
  terms: socialTerms,
});

console.log(`Imported ${source.units.length} lessons from ${sourcePath}`);
console.log(`Copied scene images to ${path.relative(rootDir, sceneOutputDir)}`);
