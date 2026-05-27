const SPEAKING_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "and",
  "or",
]);

export type SpeakingPracticeEvaluation = {
  passed: boolean;
  score: number;
  targetWords: string[];
  spokenWords: string[];
  missingKeywords: string[];
  message: string;
};

export const normalizeSpeakingText = (value?: string | null) =>
  String(value || "")
    .replace(/（[^）]*）/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/\bi[’']m\b/g, "i am")
    .replace(/\byou[’']re\b/g, "you are")
    .replace(/\bwe[’']re\b/g, "we are")
    .replace(/\bthey[’']re\b/g, "they are")
    .replace(/\bthat[’']s\b/g, "that is")
    .replace(/\blet[’']s\b/g, "lets")
    .replace(/\bwon[’']t\b/g, "will not")
    .replace(/\bcan[’']t\b/g, "can not")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const getSpeakingWords = (value?: string | null) => {
  const normalized = normalizeSpeakingText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
};

const getAutoKeywords = (targetWords: string[]) => {
  const contentWords = targetWords.filter(
    (word) => word.length >= 3 && !SPEAKING_STOP_WORDS.has(word),
  );
  if (targetWords.length <= 4) return contentWords.slice(0, 4);
  return contentWords.slice(0, 5);
};

const levenshteinDistance = (left: string[], right: string[]) => {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + substitutionCost,
      );
    }
  }

  return dp[left.length][right.length];
};

export const evaluateSpeakingPractice = ({
  target,
  transcript,
  passScore = 0.75,
  keywords,
}: {
  target: string;
  transcript: string;
  passScore?: number;
  keywords?: string[];
}): SpeakingPracticeEvaluation => {
  const targetWords = getSpeakingWords(target);
  const spokenWords = getSpeakingWords(transcript);

  if (targetWords.length === 0) {
    return {
      passed: false,
      score: 0,
      targetWords,
      spokenWords,
      missingKeywords: [],
      message: "No target sentence was configured.",
    };
  }

  if (spokenWords.length === 0) {
    return {
      passed: false,
      score: 0,
      targetWords,
      spokenWords,
      missingKeywords: getAutoKeywords(targetWords),
      message: "I didn't hear enough English. Try again.",
    };
  }

  const distance = levenshteinDistance(targetWords, spokenWords);
  const score = Math.max(
    0,
    1 - distance / Math.max(targetWords.length, spokenWords.length, 1),
  );
  const keywordList =
    keywords && keywords.length > 0
      ? keywords.map(normalizeSpeakingText).filter(Boolean)
      : getAutoKeywords(targetWords);
  const spokenSet = new Set(spokenWords);
  const missingKeywords = keywordList.filter((word) => !spokenSet.has(word));
  const passed = score >= passScore && missingKeywords.length === 0;

  let message = passed
    ? "Clear enough. Nice speaking!"
    : `Try again. Similarity ${Math.round(score * 100)}%.`;

  if (!passed && missingKeywords.length > 0) {
    message = `Try again. I missed: ${missingKeywords.join(", ")}.`;
  }

  return {
    passed,
    score,
    targetWords,
    spokenWords,
    missingKeywords,
    message,
  };
};
