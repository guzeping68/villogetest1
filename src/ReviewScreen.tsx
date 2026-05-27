import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { getApiUrl } from "./utils/api";
import {
  playCorrectAnswerSound,
  playDialogueAppearSound,
  playQuestionAppearSound,
  playSoftErrorSound,
  playVictoryCelebrationFeedback,
  triggerHaptic,
} from "./utils/feedback";

type ReviewVocabulary = {
  word: string;
  phonetic: string;
  translation: string;
  example_en: string;
  example_cn: string;
};

type ReviewItem = {
  type: "reading";
  sourceKey: string;
  sourceLessonTitle: string;
  image: string;
  sentence_en: string;
  sentence_cn: string;
  key_vocabulary: ReviewVocabulary;
};

type ReviewWordRecord = {
  key: string;
  word: string;
  lessonTitle: string;
  sourceSentence: string;
  sourceInstruction: string;
  image: string;
  latestIndex: number;
  count: number;
  source: any;
};

type WordReviewMeta = {
  reviewedAt?: string;
  reviewCount?: number;
  lastResult?: "mastered" | "needs_review";
  dueAt?: string;
  lastSentence?: string;
};

type ReviewRound = {
  id: string;
  date: string;
  words: string[];
  mastered: string[];
  needsReview: string[];
};

type ReviewListTab = "pending" | "reviewed" | "due";

type TestQuestion = {
  item: ReviewItem;
  prompt: string;
  options: { text: string; isCorrect: boolean }[];
};

const MAX_REVIEW_SELECTION = 5;
const DEFAULT_SCENE_IMAGE = "/assets/chatu4.png";

const DEFAULT_READING_ITEMS: ReviewItem[] = [
  {
    type: "reading",
    sourceKey: "default-above",
    sourceLessonTitle: "示例复习",
    image: "/assets/chatu1.png",
    sentence_en: "The neighbors live right above us in this apartment.",
    sentence_cn: "邻居就住在这套公寓的正上方。",
    key_vocabulary: {
      word: "Above",
      phonetic: "/əˈbʌv/",
      translation: "在...之上",
      example_en: "The bird is flying above the trees.",
      example_cn: "鸟儿在树林上方飞翔。",
    },
  },
  {
    type: "reading",
    sourceKey: "default-baked",
    sourceLessonTitle: "示例复习",
    image: "/assets/chatu2.png",
    sentence_en: "I baked some fresh scones for our new neighbors.",
    sentence_cn: "我为我们的新邻居烤了一些新鲜的司康饼。",
    key_vocabulary: {
      word: "Baked",
      phonetic: "/beɪkt/",
      translation: "烤",
      example_en: "The bread is freshly baked.",
      example_cn: "这面包是刚烤好的。",
    },
  },
];

const TRANSLATION_HINTS: Record<string, string> = {
  americano: "美式咖啡",
  medium: "中杯",
  croissant: "可颂",
  card: "银行卡",
  name: "名字",
  latte: "拿铁",
  oat: "燕麦",
  sugar: "糖",
  large: "大杯",
  iced: "加冰的",
  tea: "茶",
  scone: "司康饼",
  neighbor: "邻居",
  above: "在上方",
  baked: "烤过的",
  cash: "现金",
  membership: "会员",
  order: "点单",
  complaint: "投诉",
  review: "评价",
  receipt: "小票",
  table: "桌子",
  reservation: "预约",
  discount: "折扣",
};

const PHONETIC_HINTS: Record<string, string> = {
  americano: "/əˌmerɪˈkɑːnoʊ/",
  medium: "/ˈmiːdiəm/",
  croissant: "/krəˈsɑːnt/",
  card: "/kɑːrd/",
  name: "/neɪm/",
  latte: "/ˈlɑːteɪ/",
  sugar: "/ˈʃʊɡər/",
  large: "/lɑːrdʒ/",
  tea: "/tiː/",
  above: "/əˈbʌv/",
  baked: "/beɪkt/",
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "without",
  "by",
  "is",
  "are",
  "am",
  "be",
  "can",
  "could",
  "would",
  "should",
  "get",
  "want",
  "wants",
  "need",
  "needs",
  "please",
  "thanks",
  "thank",
  "you",
  "me",
  "my",
  "your",
  "our",
  "this",
  "that",
  "it",
  "its",
  "one",
  "what",
  "why",
  "how",
  "where",
  "when",
  "does",
  "do",
  "did",
  "he",
  "she",
  "they",
  "we",
  "i",
  "there",
  "here",
  "all",
  "now",
  "just",
]);

function titleCaseWord(word: string) {
  if (!word) return "Practice";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

function getWordsFromText(text = "") {
  return (text.match(/[A-Za-z][A-Za-z'-]*/g) || [])
    .map((word) => normalizeWord(word))
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function pickCoreWord(mistake: any) {
  const directWord =
    mistake?.review_word ||
    mistake?.key_vocabulary?.word ||
    mistake?.word ||
    mistake?.pairs?.[0]?.word;
  if (directWord) return titleCaseWord(String(directWord));

  const correctOption = Array.isArray(mistake?.options)
    ? mistake.options.find((opt: any) => opt?.is_correct)
    : null;
  const preferredSources = [
    correctOption?.text,
    mistake?.listening_transcript,
    mistake?.sentence_en,
    mistake?.text,
    mistake?.instruction,
  ].filter(Boolean);

  for (const source of preferredSources) {
    const words = getWordsFromText(String(source));
    const meaningful =
      words.find((word) => TRANSLATION_HINTS[word]) ||
      [...words].reverse().find((word) => word.length >= 4) ||
      words[0];
    if (meaningful) return titleCaseWord(meaningful);
  }

  return "Practice";
}

function getSourceSentence(mistake: any) {
  const correctOption = Array.isArray(mistake?.options)
    ? mistake.options.find((opt: any) => opt?.is_correct)
    : null;
  return (
    correctOption?.text ||
    mistake?.listening_transcript ||
    mistake?.sentence_en ||
    mistake?.text ||
    mistake?.instruction ||
    "Let's practice this again."
  );
}

function getLessonTitle(mistake: any) {
  const lessonInfo = mistake?._lessonInfo;
  if (!lessonInfo) return "错题练习";
  const unit = String(lessonInfo.unit_id || "").replace("-", " ");
  const lesson = lessonInfo.lesson_id ? `第${lessonInfo.lesson_id}课` : "课程";
  const title = lessonInfo.title_cn || lessonInfo.title || "复习";
  return `${unit} ${lesson}：${title}`;
}

function getMistakeImage(mistake: any) {
  if (mistake?.scene_image || mistake?.sceneImage) {
    return mistake.scene_image || mistake.sceneImage;
  }
  if (mistake?.scene_media) return `/media/${mistake.scene_media}`;
  const lessonMatch = String(mistake?.question_id || "").match(/^L0?(\d+)_/);
  if (lessonMatch) {
    return `/assets/lesson-scenes/lesson_${Math.min(8, Number(lessonMatch[1]))}_start.png`;
  }
  return DEFAULT_SCENE_IMAGE;
}

function getRecordKey(mistake: any, word: string, index: number) {
  const base =
    mistake?.question_id ||
    mistake?.id ||
    mistake?.instruction ||
    mistake?.text ||
    mistake?.sentence_en ||
    `${word}-${index}`;
  return `${normalizeWord(word)}:${String(base).slice(0, 80)}`;
}

function shuffle<T>(list: T[]) {
  return [...list].sort(() => Math.random() - 0.5);
}

function buildFallbackItem(record: ReviewWordRecord, index: number): ReviewItem {
  const word = titleCaseWord(record.word);
  const lower = normalizeWord(word);
  const translation = TRANSLATION_HINTS[lower] || "重点词";
  return {
    type: "reading",
    sourceKey: record.key,
    sourceLessonTitle: record.lessonTitle,
    image: record.image || DEFAULT_SCENE_IMAGE,
    sentence_en: `${word} appears again in a new scene today.`,
    sentence_cn: `今天 ${word} 会在一个新的场景里再次出现。`,
    key_vocabulary: {
      word,
      phonetic: PHONETIC_HINTS[lower] || "/ˈpræktɪs/",
      translation,
      example_en: record.sourceSentence || `Let's practice ${word} one more time.`,
      example_cn: `再练一次 ${word}。`,
    },
  };
}

function ensureReviewItem(item: any, record: ReviewWordRecord, index: number): ReviewItem {
  const fallback = buildFallbackItem(record, index);
  const keyVocabulary = item?.key_vocabulary || {};
  return {
    ...fallback,
    sentence_en: item?.sentence_en || fallback.sentence_en,
    sentence_cn: item?.sentence_cn || fallback.sentence_cn,
    key_vocabulary: {
      ...fallback.key_vocabulary,
      ...keyVocabulary,
      word: titleCaseWord(keyVocabulary.word || record.word || fallback.key_vocabulary.word),
    },
  };
}

function getStorageKeys(playerId?: string) {
  const suffix = playerId || "LOCAL";
  return {
    meta: `lingoville_review_word_meta_${suffix}`,
    rounds: `lingoville_review_rounds_${suffix}`,
  };
}

function formatShortDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export const ReviewScreen = ({
  onClose,
  stamina,
  setGlobalStamina,
  mistakes = [],
  playerId,
  reviewWordMeta,
  setReviewWordMeta,
  reviewRounds,
  setReviewRounds,
  hasClaimedDailyStaminaReward = false,
  onClaimDailyStaminaReward,
}: {
  onClose: () => void;
  stamina: number;
  setGlobalStamina: React.Dispatch<React.SetStateAction<number>>;
  mistakes?: any[];
  playerId?: string | null;
  reviewWordMeta?: Record<string, WordReviewMeta>;
  setReviewWordMeta?: React.Dispatch<React.SetStateAction<Record<string, WordReviewMeta>>>;
  reviewRounds?: ReviewRound[];
  setReviewRounds?: React.Dispatch<React.SetStateAction<ReviewRound[]>>;
  hasClaimedDailyStaminaReward?: boolean;
  onClaimDailyStaminaReward?: () => boolean;
}) => {
  const [view, setView] = useState<
    "home" | "history" | "loading" | "comic" | "intermission" | "test" | "result"
  >("home");
  const [reviewListTab, setReviewListTab] = useState<ReviewListTab>("pending");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectionTip, setSelectionTip] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>(DEFAULT_READING_ITEMS);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [localWordMeta, setLocalWordMeta] = useState<Record<string, WordReviewMeta>>({});
  const [localRounds, setLocalRounds] = useState<ReviewRound[]>([]);
  const [testIndex, setTestIndex] = useState(0);
  const [testSelected, setTestSelected] = useState<{
    text: string;
    isCorrect: boolean;
  } | null>(null);
  const [testRewardClaimed, setTestRewardClaimed] = useState(false);
  const [testAnswers, setTestAnswers] = useState<Record<string, boolean>>({});
  const [resultRound, setResultRound] = useState<ReviewRound | null>(null);

  const storageKeys = useMemo(() => getStorageKeys(playerId || undefined), [playerId]);
  const usesExternalReviewState =
    Boolean(reviewWordMeta && reviewRounds && setReviewWordMeta && setReviewRounds);
  const wordMeta = reviewWordMeta || localWordMeta;
  const rounds = reviewRounds || localRounds;

  useEffect(() => {
    if (usesExternalReviewState) return;
    try {
      setLocalWordMeta(JSON.parse(localStorage.getItem(storageKeys.meta) || "{}"));
      setLocalRounds(JSON.parse(localStorage.getItem(storageKeys.rounds) || "[]"));
    } catch {
      setLocalWordMeta({});
      setLocalRounds([]);
    }
  }, [storageKeys.meta, storageKeys.rounds, usesExternalReviewState]);

  useEffect(() => {
    if (!usesExternalReviewState || !setReviewWordMeta || !setReviewRounds) return;

    const externalHasData =
      Object.keys(reviewWordMeta || {}).length > 0 || (reviewRounds || []).length > 0;
    if (externalHasData) {
      localStorage.setItem(storageKeys.meta, JSON.stringify(reviewWordMeta || {}));
      localStorage.setItem(storageKeys.rounds, JSON.stringify(reviewRounds || []));
      return;
    }

    try {
      const cachedMeta = JSON.parse(localStorage.getItem(storageKeys.meta) || "{}");
      const cachedRounds = JSON.parse(localStorage.getItem(storageKeys.rounds) || "[]");
      if (Object.keys(cachedMeta).length > 0) setReviewWordMeta(cachedMeta);
      if (Array.isArray(cachedRounds) && cachedRounds.length > 0) setReviewRounds(cachedRounds);
    } catch {
      // Ignore malformed local backup and keep the server state.
    }
  }, [
    reviewRounds,
    reviewWordMeta,
    setReviewRounds,
    setReviewWordMeta,
    storageKeys.meta,
    storageKeys.rounds,
    usesExternalReviewState,
  ]);

  const records = useMemo<ReviewWordRecord[]>(() => {
    const grouped = new Map<string, ReviewWordRecord>();
    mistakes.forEach((mistake, index) => {
      const word = pickCoreWord(mistake);
      const key = getRecordKey(mistake, word, index);
      const existing = grouped.get(key);
      if (existing) {
        grouped.set(key, {
          ...existing,
          latestIndex: Math.max(existing.latestIndex, index),
          count: existing.count + 1,
        });
        return;
      }
      grouped.set(key, {
        key,
        word,
        lessonTitle: getLessonTitle(mistake),
        sourceSentence: getSourceSentence(mistake),
        sourceInstruction: mistake?.instruction || mistake?.text || "错题练习",
        image: getMistakeImage(mistake),
        latestIndex: index,
        count: 1,
        source: mistake,
      });
    });
    return Array.from(grouped.values()).sort((a, b) => b.latestIndex - a.latestIndex);
  }, [mistakes]);

  const pendingRecords = useMemo(
    () => records.filter((record) => !wordMeta[record.key]?.reviewedAt),
    [records, wordMeta],
  );

  const dueRecords = useMemo(() => {
    return records.filter((record) => {
      const meta = wordMeta[record.key];
      return Boolean(
        meta?.reviewedAt &&
          meta.lastResult === "needs_review" &&
          meta.dueAt,
      );
    });
  }, [records, wordMeta]);

  const reviewedRecords = useMemo(
    () =>
      records.filter((record) => {
        const meta = wordMeta[record.key];
        return Boolean(
          meta?.reviewedAt &&
            !(meta.lastResult === "needs_review" && meta.dueAt),
        );
      }),
    [records, wordMeta],
  );

  const displayedRecords = useMemo(() => {
    if (reviewListTab === "reviewed") return reviewedRecords;
    if (reviewListTab === "due") return dueRecords;
    return pendingRecords;
  }, [dueRecords, pendingRecords, reviewedRecords, reviewListTab]);

  const displayedRecordSignature = useMemo(
    () => displayedRecords.map((record) => record.key).join("|"),
    [displayedRecords],
  );

  useEffect(() => {
    if (displayedRecords.length === 0) {
      if (selectedKeys.length > 0) setSelectedKeys([]);
      return;
    }

    const visibleKeys = new Set(displayedRecords.map((record) => record.key));
    const validSelectedKeys = selectedKeys
      .filter((key) => visibleKeys.has(key))
      .slice(0, MAX_REVIEW_SELECTION);
    if (validSelectedKeys.length > 0) {
      if (validSelectedKeys.length !== selectedKeys.length) {
        setSelectedKeys(validSelectedKeys);
      }
      return;
    }

    setSelectedKeys(displayedRecords.slice(0, 3).map((record) => record.key));
  }, [displayedRecordSignature, displayedRecords, selectedKeys]);

  const selectedRecords = useMemo(
    () =>
      selectedKeys
        .map((key) => displayedRecords.find((record) => record.key === key))
        .filter(Boolean) as ReviewWordRecord[],
    [displayedRecords, selectedKeys],
  );

  const testQuestions = useMemo<TestQuestion[]>(() => {
    const fallbackTranslations = ["重点词", "点单表达", "位置表达", "礼貌表达", "数量表达"];
    return items.map((item) => {
      const correct = item.key_vocabulary.translation || "重点词";
      const translations = items
        .filter((other) => other.sourceKey !== item.sourceKey)
        .map((other) => other.key_vocabulary.translation)
        .filter((translation) => translation && translation !== correct);
      const distractors = [...translations, ...fallbackTranslations]
        .filter((translation, index, arr) => translation !== correct && arr.indexOf(translation) === index)
        .slice(0, 2);
      return {
        item,
        prompt: `这幕里 “${item.key_vocabulary.word}” 的意思是？`,
        options: shuffle([
          { text: correct, isCorrect: true },
          ...distractors.map((text) => ({ text, isCorrect: false })),
        ]).slice(0, 3),
      };
    });
  }, [items]);

  useEffect(() => {
    if (view === "comic") {
      playDialogueAppearSound();
      return;
    }

    if (view === "test") {
      playQuestionAppearSound();
      return;
    }

    if (view === "intermission" || view === "result") {
      playVictoryCelebrationFeedback();
    }
  }, [view, currentIdx, testIndex]);

  useEffect(() => {
    if (!selectionTip) return;
    const timer = window.setTimeout(() => setSelectionTip(null), 1700);
    return () => window.clearTimeout(timer);
  }, [selectionTip]);

  const saveReviewState = useCallback(
    (nextMeta: Record<string, WordReviewMeta>, nextRounds: ReviewRound[]) => {
      if (usesExternalReviewState && setReviewWordMeta && setReviewRounds) {
        setReviewWordMeta(nextMeta);
        setReviewRounds(nextRounds);
      } else {
        setLocalWordMeta(nextMeta);
        setLocalRounds(nextRounds);
      }
      localStorage.setItem(storageKeys.meta, JSON.stringify(nextMeta));
      localStorage.setItem(storageKeys.rounds, JSON.stringify(nextRounds));
    },
    [
      setReviewRounds,
      setReviewWordMeta,
      storageKeys.meta,
      storageKeys.rounds,
      usesExternalReviewState,
    ],
  );

  const handleBack = () => {
    if (view === "home") {
      onClose();
      return;
    }
    if (view === "comic" || view === "intermission" || view === "test" || view === "result") {
      setView("home");
      return;
    }
    if (view !== "loading") setView("home");
  };

  const speak = (text: string) => {
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  };

  const toggleWord = (key: string) => {
    const isSelected = selectedKeys.includes(key);
    if (!isSelected && selectedKeys.length >= MAX_REVIEW_SELECTION) {
      setSelectionTip(`最多选择 ${MAX_REVIEW_SELECTION} 个错词`);
      triggerHaptic("warning");
      return;
    }

    setSelectedKeys((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      return [...prev, key];
    });
  };

  const startGeneration = async () => {
    if (selectedRecords.length === 0) return;
    setView("loading");
    setGenerationProgress(8);

    let progressTimer: number | undefined;
    progressTimer = window.setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + 7, 88));
    }, 260);

    try {
      const enrichedMistakes = selectedRecords.map((record) => ({
        ...record.source,
        review_word: record.word,
        source_sentence: record.sourceSentence,
      }));
      const resp = await fetch(getApiUrl("/api/review/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mistakes: enrichedMistakes }),
      });

      let nextItems = selectedRecords.map((record, index) => buildFallbackItem(record, index));
      if (resp.ok) {
        const data = await resp.json();
        const rawItems = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        nextItems = selectedRecords.map((record, index) =>
          ensureReviewItem(rawItems[index], record, index),
        );
      }

      setItems(nextItems);
      setCurrentIdx(0);
      setGenerationProgress(100);
      window.setTimeout(() => setView("comic"), 450);
    } catch (err) {
      console.error("Failed to generate review story", err);
      setItems(selectedRecords.map((record, index) => buildFallbackItem(record, index)));
      setCurrentIdx(0);
      setGenerationProgress(100);
      window.setTimeout(() => setView("comic"), 450);
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
    }
  };

  const handleComicNext = () => {
    if (currentIdx < items.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      return;
    }
    setView("intermission");
  };

  const startTest = () => {
    setTestIndex(0);
    setTestSelected(null);
    setTestRewardClaimed(false);
    setTestAnswers({});
    setView("test");
  };

  const finishRound = (answers: Record<string, boolean>) => {
    const now = new Date();
    const dueTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const mastered = items
      .filter((item) => answers[item.sourceKey])
      .map((item) => item.key_vocabulary.word);
    const needsReview = items
      .filter((item) => !answers[item.sourceKey])
      .map((item) => item.key_vocabulary.word);

    const round: ReviewRound = {
      id: `${now.getTime()}`,
      date: now.toISOString(),
      words: items.map((item) => item.key_vocabulary.word),
      mastered,
      needsReview,
    };

    const nextMeta = { ...wordMeta };
    items.forEach((item) => {
      const correct = Boolean(answers[item.sourceKey]);
      nextMeta[item.sourceKey] = {
        reviewedAt: now.toISOString(),
        reviewCount: (nextMeta[item.sourceKey]?.reviewCount || 0) + 1,
        lastResult: correct ? "mastered" : "needs_review",
        dueAt: correct ? undefined : dueTomorrow.toISOString(),
        lastSentence: item.sentence_en,
      };
    });

    const nextRounds = [round, ...rounds].slice(0, 30);
    saveReviewState(nextMeta, nextRounds);
    setResultRound(round);
    setView("result");
  };

  const handleTestSelect = (option: { text: string; isCorrect: boolean }) => {
    if (testSelected) return;
    const question = testQuestions[testIndex];
    setTestSelected(option);
    if (option.isCorrect) {
      playCorrectAnswerSound();
      triggerHaptic("success");
    } else {
      playSoftErrorSound();
      triggerHaptic("error");
    }
    const rewardClaimed = option.isCorrect
      ? onClaimDailyStaminaReward
        ? onClaimDailyStaminaReward()
        : (() => {
            setGlobalStamina((prev) => prev + 1);
            return true;
          })()
      : false;
    setTestRewardClaimed(rewardClaimed);
    setTestAnswers((prev) => ({
      ...prev,
      [question.item.sourceKey]: option.isCorrect,
    }));
  };

  const handleTestNext = () => {
    const question = testQuestions[testIndex];
    const finalAnswers = {
      ...testAnswers,
      [question.item.sourceKey]: Boolean(testSelected?.isCorrect),
    };

    if (testIndex < testQuestions.length - 1) {
      setTestAnswers(finalAnswers);
      setTestIndex((prev) => prev + 1);
      setTestSelected(null);
      setTestRewardClaimed(false);
      return;
    }
    finishRound(finalAnswers);
  };

  const pickNextGroup = () => {
    const nextPending = records
      .filter((record) => !wordMeta[record.key]?.reviewedAt)
      .slice(0, 3);
    const fallback = records
      .filter((record) => !selectedKeys.includes(record.key))
      .slice(0, 3);
    const next = nextPending.length > 0 ? nextPending : fallback.length > 0 ? fallback : records.slice(0, 3);
    setSelectedKeys(next.map((record) => record.key));
    setCurrentIdx(0);
    setView("home");
  };

  const stats = {
    pending: pendingRecords.length,
    reviewed: reviewedRecords.length,
    due: dueRecords.length,
  };
  const reviewStaminaRewardHint = hasClaimedDailyStaminaReward
    ? "今日体力奖励已领取，继续复习仍会记录掌握情况。"
    : "今日第一次小测试答对任意一题，即可 +1 体力，每日最多 1 次。";
  const reviewStaminaRewardShortHint = hasClaimedDailyStaminaReward
    ? "今日错题体力已领取"
    : "今日首次答对可得 1 体力（每日一次）";
  const reviewTabs: Array<{
    id: ReviewListTab;
    label: string;
    value: number;
    icon: typeof Brain;
    tone: string;
  }> = [
    { id: "pending", label: "待复习", value: stats.pending, icon: Brain, tone: "bg-sky-500" },
    {
      id: "reviewed",
      label: "已复习",
      value: stats.reviewed,
      icon: CheckCircle2,
      tone: "bg-emerald-500",
    },
    { id: "due", label: "明日巩固中", value: stats.due, icon: Clock3, tone: "bg-rose-500" },
  ];
  const activeTabCopy =
    reviewListTab === "reviewed"
      ? {
          title: "已复习的错词",
          subtitle: "这些词已经完成过一轮复习，点击可再练一遍",
          emptyTitle: "还没有已复习错词",
          emptyText: "完成一次错题复习后，掌握的词会出现在这里。",
        }
      : reviewListTab === "due"
        ? {
            title: "明日巩固中的错词",
            subtitle: "这些词还需要再见一次，点击可提前复习",
            emptyTitle: "暂无明日巩固",
            emptyText: "小测试没掌握的词，会被安排到这里。",
          }
        : {
            title: "还没有复习过的错词",
            subtitle: "默认选中最近错过的词，可手动调整，最多选择 5 个",
            emptyTitle: "暂无待复习错词",
            emptyText: "主线答题做错后，新的错词会出现在这里。",
          };

  return (
    <div className="absolute inset-0 z-[300] bg-[#102033] flex flex-col items-center justify-center font-sans overflow-hidden">
      <img
        src="/assets/fuxibg.png"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#102033]/35 via-[#183b55]/30 to-[#071826]/90" />

      <div className="absolute top-0 left-0 w-full z-50 p-6 pt-12 flex justify-between items-center bg-gradient-to-b from-black/55 to-transparent">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/50 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          {view === "home" && (
            <button
              onClick={() => setView("history")}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/40 active:scale-95 transition-transform"
              aria-label="错题历史记录"
            >
              <History className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span className="text-white font-black">{stamina}</span>
          </div>
        </div>
      </div>

      {view === "home" && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full h-full pt-28 px-5 pb-5 flex flex-col"
        >
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sky-100 font-black text-[13px] mb-1">
              <BookOpen className="w-4 h-4" />
              专属复习站
            </div>
            <h2 className="text-white text-[30px] font-black drop-shadow-[0_2px_5px_rgba(0,0,0,0.75)]">
              我的错题本
            </h2>
          </div>

	          <div className="grid grid-cols-3 gap-2 mb-4">
	            {reviewTabs.map((item) => {
                const Icon = item.icon;
                const isActive = reviewListTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setReviewListTab(item.id);
                      triggerHaptic("light");
                    }}
                    className={`rounded-[18px] backdrop-blur-md border px-3 py-3 text-white text-left active:scale-[0.97] transition-all ${
                      isActive
                        ? "bg-white/28 border-white/70 shadow-[0_10px_24px_rgba(255,255,255,0.14)]"
                        : "bg-white/14 border-white/20"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 ${item.tone} rounded-[12px] flex items-center justify-center mb-2 shadow-lg`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-[22px] font-black leading-none">
                      {item.value}
                    </div>
                    <div className="text-[12px] font-bold text-white/75 mt-1">
                      {item.label}
                    </div>
	              </button>
                );
              })}
	          </div>

            <div className="mb-4 rounded-[22px] border border-amber-200/45 bg-amber-300/18 px-4 py-3 text-white shadow-[0_12px_26px_rgba(15,23,42,0.22)] backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-amber-400 text-white shadow-[0_5px_0_#c27a00]">
                  <Zap className="h-6 w-6 fill-white" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-black leading-tight">
                    每天第一次错题复习可恢复体力
                  </p>
                  <p className="mt-1 text-[12px] font-bold leading-snug text-white/75">
                    {reviewStaminaRewardHint}
                  </p>
                </div>
              </div>
            </div>

	          <div className="flex items-center justify-between mb-3">
	            <div>
              <p className="text-white font-black text-[18px]">
                {activeTabCopy.title}
              </p>
              <p className="text-white/65 text-[12px] font-bold">
                {activeTabCopy.subtitle}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {selectionTip && (
              <motion.div
                key="review-selection-tip"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                className="mb-3 rounded-[16px] bg-amber-300 px-4 py-2 text-center text-[13px] font-black text-amber-950 shadow-[0_8px_20px_rgba(15,23,42,0.24)]"
              >
                {selectionTip}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto pr-1 pb-28 space-y-3 custom-scrollbar">
            {displayedRecords.length === 0 ? (
              <div className="rounded-[24px] bg-white/18 backdrop-blur-md border border-white/25 p-7 text-center text-white mt-8">
                <Layers className="w-12 h-12 text-white/55 mx-auto mb-3" />
                <p className="text-[18px] font-black">{activeTabCopy.emptyTitle}</p>
                <p className="text-white/70 text-sm mt-2">{activeTabCopy.emptyText}</p>
              </div>
            ) : (
              displayedRecords.map((record) => {
                const selected = selectedKeys.includes(record.key);
                const meta = wordMeta[record.key];
                return (
                  <button
                    key={record.key}
                    onClick={() => toggleWord(record.key)}
                    className={`w-full text-left rounded-[22px] p-4 border-2 shadow-xl transition-all ${
                      selected
                        ? "bg-white border-sky-300 translate-y-[-1px]"
                        : "bg-white/88 border-white/20"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-[18px] overflow-hidden bg-sky-50 shrink-0 border border-stone-100">
                        <img src={record.image} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[21px] font-black text-stone-900 truncate">
                            {record.word}
                          </span>
                          {selected && (
                            <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                              <Check className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] font-black text-sky-600 truncate">
                          {record.lessonTitle}
                        </p>
                        <p className="text-[13px] font-bold text-stone-500 line-clamp-2 mt-1">
                          {record.sourceSentence}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                              meta?.reviewedAt
                                ? meta.lastResult === "mastered"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {meta?.reviewedAt
                              ? meta.lastResult === "mastered"
                                ? "已掌握"
                                : "待巩固"
                              : "未复习"}
                          </span>
                          {record.count > 1 && (
                            <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-500 text-[11px] font-black">
                              出现 {record.count} 次
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

	          <div className="absolute left-0 right-0 bottom-0 z-20 px-5 pb-6 pt-5 bg-gradient-to-t from-[#071826] via-[#071826]/95 to-transparent">
              <div className="mb-2 flex items-center justify-center gap-1.5 text-[12px] font-black text-amber-200 drop-shadow">
                <Zap className="h-4 w-4 fill-amber-300" strokeWidth={3} />
                <span>{reviewStaminaRewardShortHint}</span>
              </div>
	            <button
	              disabled={selectedRecords.length === 0}
              onClick={startGeneration}
              className="w-full h-16 bg-[#1CB0F6] disabled:bg-stone-400 disabled:shadow-[0_5px_0_#78716c] text-white rounded-[20px] flex items-center justify-center gap-3 shadow-[0_5px_0_#1688C8] active:translate-y-[5px] active:shadow-none transition-all"
            >
              <Sparkles className="w-6 h-6" />
              <span className="text-[18px] font-black">生成专属漫剧</span>
            </button>
          </div>
        </motion.div>
      )}

      {view === "history" && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 w-full h-full pt-28 px-5 pb-6 flex flex-col"
        >
          <h2 className="text-white text-[28px] font-black drop-shadow-[0_2px_5px_rgba(0,0,0,0.75)] mb-4">
            错题历史记录
          </h2>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {rounds.length === 0 ? (
              <div className="rounded-[24px] bg-white/18 backdrop-blur-md border border-white/25 p-7 text-center text-white mt-8">
                <History className="w-12 h-12 text-white/55 mx-auto mb-3" />
                <p className="text-[18px] font-black">还没有复习历史</p>
                <p className="text-white/70 text-sm mt-2">完成一轮漫剧复习后，这里会保存结果。</p>
              </div>
            ) : (
              rounds.map((round) => (
                <div key={round.id} className="rounded-[24px] bg-white p-5 shadow-xl border border-white/20">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-stone-900 font-black text-[17px]">漫剧复习</p>
                      <p className="text-stone-400 font-bold text-[12px]">{formatShortDate(round.date)}</p>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-600 text-[12px] font-black">
                      {round.words.length} 词
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {round.words.map((word) => {
                      const mastered = round.mastered.includes(word);
                      return (
                        <span
                          key={`${round.id}-${word}`}
                          className={`px-3 py-2 rounded-[14px] text-[13px] font-black ${
                            mastered ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {view === "loading" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full h-full px-6 flex flex-col items-center justify-center text-center"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="w-24 h-24 rounded-[30px] bg-white shadow-2xl flex items-center justify-center mb-6"
          >
            <Wand2 className="w-12 h-12 text-sky-500" />
          </motion.div>
          <h2 className="text-white text-[29px] font-black leading-tight drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">
            正在为你编排
            <br />
            专属小漫剧
          </h2>
          <p className="text-white/75 text-[14px] font-bold mt-3 mb-7">
            角色入场、台词重写、复习题生成中
          </p>
          <div className="w-full max-w-[330px] h-4 rounded-full bg-black/30 border border-white/20 overflow-hidden mb-4">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300"
              animate={{ width: `${generationProgress}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
          <p className="text-white font-black text-[16px] mb-5">{generationProgress}%</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-[340px]">
            {selectedRecords.map((record) => (
              <span
                key={record.key}
                className="px-3 py-2 rounded-full bg-white/20 border border-white/25 text-white text-[13px] font-black backdrop-blur-md"
              >
                {record.word}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {view === "comic" && (
        <div className="absolute inset-0 z-10 flex flex-col pt-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={items[currentIdx]?.sourceKey || currentIdx}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -80 }}
              transition={{ type: "spring", damping: 25, stiffness: 210 }}
              className="flex-1 flex flex-col"
            >
              <div className="px-5 pt-2">
                <div className="h-[31vh] rounded-[28px] overflow-hidden border-2 border-white/35 shadow-2xl relative bg-sky-100">
                  <img
                    src={items[currentIdx]?.image || DEFAULT_SCENE_IMAGE}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <div className="absolute left-4 top-4 px-3 py-1.5 rounded-full bg-black/45 text-white text-[12px] font-black backdrop-blur-md">
                    第 {currentIdx + 1} 幕 / {items.length}
                  </div>
                  <div className="absolute right-5 top-8 px-4 py-2 rounded-[18px] bg-white text-stone-700 text-[18px] font-black shadow-xl">
                    ...
                  </div>
                  <img
                    src="/assets/youhappy.png"
                    className="absolute left-5 bottom-0 h-[58%] object-contain drop-shadow-xl"
                  />
                </div>
              </div>

              <div className="mt-auto bg-white rounded-t-[34px] shadow-[0_-12px_50px_rgba(0,0,0,0.28)] px-6 pt-5 pb-7">
                <div className="flex justify-between items-center mb-4">
                  <span className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-600 text-[12px] font-black border border-sky-100">
                    错词漫剧卡
                  </span>
                  <button
                    onClick={() => speak(items[currentIdx].sentence_en)}
                    className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-500"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-5">
                  <div className="flex flex-wrap items-end gap-2 mb-2">
                    <h3 className="text-[34px] font-black text-stone-900 leading-none">
                      {items[currentIdx].key_vocabulary.word}
                    </h3>
                    <span className="text-stone-400 font-mono text-[13px] font-bold mb-1">
                      {items[currentIdx].key_vocabulary.phonetic}
                    </span>
                  </div>
                  <span className="inline-flex px-3 py-1 rounded-[12px] bg-stone-100 text-stone-600 font-black text-[13px]">
                    {items[currentIdx].key_vocabulary.translation}
                  </span>
                </div>

                <div className="rounded-[24px] bg-stone-50 border-2 border-stone-100 p-5 mb-5">
                  <p className="text-[21px] font-black text-stone-800 leading-snug mb-3">
                    {items[currentIdx].sentence_en}
                  </p>
                  <p className="text-[15px] font-bold text-stone-400 leading-relaxed">
                    {items[currentIdx].sentence_cn}
                  </p>
                  <div className="mt-4 pt-4 border-t border-stone-200">
                    <p className="text-[14px] font-black text-stone-600">
                      {items[currentIdx].key_vocabulary.example_en}
                    </p>
                    <p className="text-[13px] font-bold text-stone-400 mt-1">
                      {items[currentIdx].key_vocabulary.example_cn}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleComicNext}
                  className="w-full h-15 bg-[#1CB0F6] text-white rounded-[20px] flex items-center justify-center gap-3 shadow-[0_5px_0_#1688C8] active:translate-y-[5px] active:shadow-none transition-all"
                >
                  <span className="text-[17px] font-black">
                    {currentIdx < items.length - 1 ? "看下一幕" : "完成漫剧复习"}
                  </span>
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {view === "intermission" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full px-6 flex flex-col items-center text-center"
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 border-4 border-white flex items-center justify-center shadow-[0_0_55px_rgba(251,191,36,0.55)] mb-6"
          >
            <Sparkles className="w-14 h-14 text-white" />
          </motion.div>
          <p className="text-amber-200 font-black text-[14px] mb-1">中场结算</p>
          <h2 className="text-white text-[32px] font-black leading-tight drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">
            你复习了 {items.length} 个单词
          </h2>
          <div className="w-full rounded-[26px] bg-white/18 backdrop-blur-md border border-white/25 p-5 my-6">
            <div className="flex flex-wrap gap-2 justify-center">
              {items.map((item) => (
                <span
                  key={item.sourceKey}
                  className="px-4 py-2 rounded-full bg-white text-stone-800 text-[15px] font-black shadow-md"
                >
                  {item.key_vocabulary.word}
                </span>
              ))}
            </div>
          </div>
          <p className="text-white/82 text-[15px] font-bold leading-relaxed max-w-[320px] mb-7">
            小漫剧已经演完，现在来一个短测试，看看这些错词有没有真正进脑子。
          </p>
          <button
            onClick={startTest}
            className="w-full max-w-[340px] h-16 bg-[#58CC02] text-white rounded-[20px] flex items-center justify-center gap-3 shadow-[0_5px_0_#3f9300] active:translate-y-[5px] active:shadow-none transition-all"
          >
            <Brain className="w-6 h-6" />
            <span className="text-[18px] font-black">开始小测试，看看记住了没</span>
          </button>
        </motion.div>
      )}

      {view === "test" && testQuestions[testIndex] && (
        <motion.div
          key={testQuestions[testIndex].item.sourceKey}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full h-full pt-28 px-5 pb-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/70 font-black text-[12px]">小测试</p>
              <h2 className="text-white text-[25px] font-black">
                {testIndex + 1} / {testQuestions.length}
              </h2>
            </div>
            <div className="w-36 h-3 rounded-full bg-black/30 overflow-hidden border border-white/20">
              <div
                className="h-full bg-[#58CC02]"
                style={{ width: `${((testIndex + 1) / testQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-4 shadow-2xl flex-1 flex flex-col min-h-0">
            <div className="h-[30vh] rounded-[22px] overflow-hidden bg-stone-100 mb-4 relative shrink-0">
              <img
                src={testQuestions[testIndex].item.image || DEFAULT_SCENE_IMAGE}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 right-3 rounded-[18px] bg-black/55 backdrop-blur-md text-white p-3">
                <p className="text-[14px] font-black leading-snug">
                  {testQuestions[testIndex].item.sentence_en}
                </p>
              </div>
            </div>

            <h3 className="text-[22px] font-black text-stone-900 leading-tight mb-4">
              {testQuestions[testIndex].prompt}
            </h3>

            <div className="space-y-3">
              {testQuestions[testIndex].options.map((option) => {
                const selected = testSelected?.text === option.text;
                const showCorrect = testSelected && option.isCorrect;
                const showWrong = selected && testSelected && !option.isCorrect;
                return (
                  <button
                    key={option.text}
                    disabled={Boolean(testSelected)}
                    onClick={() => handleTestSelect(option)}
                    className={`w-full min-h-[56px] rounded-[18px] border-2 px-4 py-3 flex items-center justify-between text-left transition-all ${
                      showCorrect
                        ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                        : showWrong
                          ? "bg-rose-100 border-rose-500 text-rose-800"
                          : selected
                            ? "bg-sky-50 border-sky-400 text-sky-800"
                            : "bg-white border-stone-200 text-stone-700"
                    }`}
                  >
                    <span className="font-black text-[16px] leading-snug">{option.text}</span>
                    {showCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />}
                    {showWrong && <X className="w-6 h-6 text-rose-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-5">
              {testSelected && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-[18px] p-4 mb-4 text-left ${
                    testSelected.isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  <p className="font-black text-[15px]">
                    {testSelected.isCorrect
                      ? testRewardClaimed
                        ? "答对了，今日首次错题复习体力 +1"
                        : "答对了，已经掌握。今日体力奖励已领取。"
                      : "还差一点，明天会安排再巩固。"}
                  </p>
                </motion.div>
              )}
              <button
                disabled={!testSelected}
                onClick={handleTestNext}
                className="w-full h-15 bg-[#1CB0F6] disabled:bg-stone-300 disabled:shadow-[0_5px_0_#a8a29e] text-white rounded-[20px] flex items-center justify-center gap-3 shadow-[0_5px_0_#1688C8] active:translate-y-[5px] active:shadow-none transition-all"
              >
                <span className="text-[17px] font-black">
                  {testIndex < testQuestions.length - 1 ? "下一题" : "查看结果"}
                </span>
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {view === "result" && resultRound && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full h-full pt-28 px-5 pb-6 flex flex-col"
        >
          <div className="text-center mb-5">
            <motion.div
              initial={{ y: -10 }}
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-300 to-sky-500 border-4 border-white flex items-center justify-center mx-auto mb-4 shadow-[0_0_55px_rgba(56,189,248,0.45)]"
            >
              <Trophy className="w-12 h-12 text-white" />
            </motion.div>
            <p className="text-emerald-200 font-black text-[14px]">本轮复习完成</p>
            <h2 className="text-white text-[31px] font-black drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]">
              错词已重新整理
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pb-4">
            <div className="rounded-[24px] bg-white p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-stone-900 font-black text-[18px]">已掌握</h3>
              </div>
              {resultRound.mastered.length === 0 ? (
                <p className="text-stone-400 font-bold text-[14px]">这组还需要再练一遍。</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {resultRound.mastered.map((word) => (
                    <span key={word} className="px-3 py-2 rounded-full bg-emerald-100 text-emerald-700 font-black text-[14px]">
                      {word}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-5 h-5 text-rose-500" />
                <h3 className="text-stone-900 font-black text-[18px]">还需要巩固</h3>
              </div>
              {resultRound.needsReview.length === 0 ? (
                <p className="text-emerald-600 font-black text-[14px]">全部掌握，状态很好。</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {resultRound.needsReview.map((word) => (
                      <span key={word} className="px-3 py-2 rounded-full bg-rose-100 text-rose-700 font-black text-[14px]">
                        {word}
                      </span>
                    ))}
                  </div>
                  <p className="text-rose-500 text-[14px] font-bold leading-relaxed">
                    这些词还需要巩固，已为你安排明天再次复习。
                  </p>
                </>
              )}
            </div>
          </div>

          <button
            onClick={pickNextGroup}
            className="w-full h-16 bg-[#1CB0F6] text-white rounded-[20px] flex items-center justify-center gap-3 shadow-[0_5px_0_#1688C8] active:translate-y-[5px] active:shadow-none transition-all"
          >
            <RotateCcw className="w-6 h-6" />
            <span className="text-[18px] font-black">再来一组漫剧复习</span>
          </button>
        </motion.div>
      )}
    </div>
  );
};
