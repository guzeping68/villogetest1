import { Capacitor } from "@capacitor/core";
import {
  QueueStrategy,
  TextToSpeech,
} from "@capacitor-community/text-to-speech";

export type SpeechRole = "narrator" | "male" | "female" | "you" | "question";

const SPEECH_ENABLED_STORAGE_KEY = "lingoville_speech_enabled";

const roleProfiles: Record<
  SpeechRole,
  { rate: number; pitch: number; volume: number }
> = {
  narrator: { rate: 0.84, pitch: 0.92, volume: 0.95 },
  male: { rate: 0.82, pitch: 0.86, volume: 0.95 },
  female: { rate: 0.88, pitch: 1.0, volume: 0.96 },
  you: { rate: 0.9, pitch: 1.02, volume: 0.96 },
  question: { rate: 0.84, pitch: 0.94, volume: 0.95 },
};

const maleSpeakerHints = ["jake", "jack", "kevin", "old chen", "bun"];
const femaleSpeakerHints = [
  "mrs",
  "henderson",
  "lisa",
  "karen",
  "amili",
  "you",
];

let nativeVoicesPromise: ReturnType<typeof TextToSpeech.getSupportedVoices> | null =
  null;
let currentAudio: HTMLAudioElement | null = null;
let currentAudioStop: (() => void) | null = null;
let speechRunId = 0;
let speechProgressTimer: ReturnType<typeof setInterval> | null = null;
let currentSpeechProgressText = "";

export const SPEECH_PROGRESS_EVENT = "lingoville:speech-progress";

export type SpeechProgressEventDetail = {
  runId: number;
  text: string;
  activeWordCount: number;
  totalWords: number;
  status: "start" | "progress" | "complete" | "cancel";
};

export const getSavedSpeechEnabled = () => {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
};

export const saveSpeechEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPEECH_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage failures; speech can still work for this session.
  }
};

export const normalizeSpeechText = (text?: string | null) => {
  if (!text) return "";

  return text
    .replace(/📍/g, "")
    .replace(/题目\s*\d+/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[：:.\s-]+/, "")
    .trim();
};

const getSpeechProgressWordCount = (text: string) =>
  Math.max(1, normalizeSpeechText(text).split(/\s+/).filter(Boolean).length);

const dispatchSpeechProgress = (detail: SpeechProgressEventDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPEECH_PROGRESS_EVENT, { detail }));
};

const clearSpeechProgressTimer = () => {
  if (speechProgressTimer) {
    clearInterval(speechProgressTimer);
    speechProgressTimer = null;
  }
};

const cancelSpeechProgress = () => {
  clearSpeechProgressTimer();
  if (!currentSpeechProgressText) return;
  dispatchSpeechProgress({
    runId: speechRunId,
    text: currentSpeechProgressText,
    activeWordCount: 0,
    totalWords: getSpeechProgressWordCount(currentSpeechProgressText),
    status: "cancel",
  });
  currentSpeechProgressText = "";
};

const startSpeechProgress = (text: string, runId: number) => {
  const cleanText = normalizeSpeechText(text);
  if (!cleanText) return;

  clearSpeechProgressTimer();
  currentSpeechProgressText = cleanText;
  const totalWords = getSpeechProgressWordCount(cleanText);
  let activeWordCount = 0;
  dispatchSpeechProgress({
    runId,
    text: cleanText,
    activeWordCount,
    totalWords,
    status: "start",
  });

  const estimatedDuration = estimateSpeechDurationMs(cleanText);
  const intervalMs = Math.max(
    160,
    Math.min(520, Math.floor(estimatedDuration / totalWords)),
  );

  speechProgressTimer = setInterval(() => {
    if (runId !== speechRunId) {
      clearSpeechProgressTimer();
      return;
    }
    activeWordCount = Math.min(totalWords, activeWordCount + 1);
    dispatchSpeechProgress({
      runId,
      text: cleanText,
      activeWordCount,
      totalWords,
      status: "progress",
    });
    if (activeWordCount >= totalWords) {
      clearSpeechProgressTimer();
    }
  }, intervalMs);
};

const finishSpeechProgress = (text: string, runId: number) => {
  if (runId !== speechRunId) return;
  const cleanText = normalizeSpeechText(text);
  if (!cleanText) return;
  clearSpeechProgressTimer();
  const totalWords = getSpeechProgressWordCount(cleanText);
  dispatchSpeechProgress({
    runId,
    text: cleanText,
    activeWordCount: totalWords,
    totalWords,
    status: "complete",
  });
  if (currentSpeechProgressText === cleanText) {
    currentSpeechProgressText = "";
  }
};

export const detectSpeechLang = (text: string) => {
  const chineseCount = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const latinCount = text.match(/[A-Za-z]/g)?.length || 0;

  return chineseCount > latinCount ? "zh-CN" : "en-US";
};

const getSpeakerRole = (speaker?: string | null): SpeechRole => {
  const normalizedSpeaker = (speaker || "").toLowerCase();
  if (!normalizedSpeaker) return "female";

  if (femaleSpeakerHints.some((hint) => normalizedSpeaker.includes(hint))) {
    return normalizedSpeaker.includes("you") ? "you" : "female";
  }

  if (maleSpeakerHints.some((hint) => normalizedSpeaker.includes(hint))) {
    return "male";
  }

  return "female";
};

const scoreVoiceName = (name: string, role: SpeechRole) => {
  const normalizedName = name.toLowerCase();
  let score = 0;

  const calmMaleVoices = ["alex", "daniel", "reed", "aaron", "tom", "fred"];
  const naturalFemaleVoices = [
    "samantha",
    "ava",
    "allison",
    "susan",
    "zoe",
    "nicky",
    "victoria",
  ];
  const calmNarratorVoices = [
    "alex",
    "samantha",
    "daniel",
    "ava",
    "reed",
  ];
  const noveltyVoicePenalties = [
    "bad news",
    "bells",
    "boing",
    "bubbles",
    "cellos",
    "good news",
    "hysterical",
    "organ",
    "rocko",
    "shelley",
    "whisper",
    "zarvox",
  ];

  const preferredNames =
    role === "male"
      ? calmMaleVoices
      : role === "female" || role === "you"
        ? naturalFemaleVoices
        : calmNarratorVoices;

  preferredNames.forEach((voiceName, index) => {
    if (normalizedName.includes(voiceName)) {
      score += 50 - index * 4;
    }
  });

  noveltyVoicePenalties.forEach((voiceName) => {
    if (normalizedName.includes(voiceName)) {
      score -= 60;
    }
  });

  if (normalizedName.includes("premium")) score += 12;
  if (normalizedName.includes("enhanced")) score += 12;
  if (normalizedName.includes("compact")) score -= 8;

  return score;
};

const chooseBestVoiceIndex = async (lang: string, role: SpeechRole) => {
  if (!Capacitor.isNativePlatform()) return undefined;

  try {
    nativeVoicesPromise ||= TextToSpeech.getSupportedVoices();
    const { voices } = await nativeVoicesPromise;
    let bestIndex: number | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;

    voices.forEach((voice, index) => {
      const voiceLang = voice.lang.toLowerCase();
      const targetLang = lang.toLowerCase();
      let score = 0;

      if (voiceLang === targetLang) score += 100;
      else if (voiceLang.split("-")[0] === targetLang.split("-")[0]) score += 60;

      score += scoreVoiceName(voice.name, role);
      if (voice.default) score += 6;
      if (voice.localService) score += 4;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestScore > 0 ? bestIndex : undefined;
  } catch {
    return undefined;
  }
};

const getWebSpeechVoices = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve<SpeechSynthesisVoice[]>([]);
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const finish = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", finish, {
      once: true,
    });
    window.setTimeout(finish, 250);
  });
};

const chooseBestWebVoice = async (lang: string, role: SpeechRole) => {
  const voices = await getWebSpeechVoices();
  let bestVoice: SpeechSynthesisVoice | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  voices.forEach((voice) => {
    const voiceLang = voice.lang.toLowerCase();
    const targetLang = lang.toLowerCase();
    let score = 0;

    if (voiceLang === targetLang) score += 100;
    else if (voiceLang.split("-")[0] === targetLang.split("-")[0]) score += 60;

    score += scoreVoiceName(voice.name, role);
    if (voice.default) score += 6;
    if (voice.localService) score += 4;

    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  });

  return bestScore > 0 ? bestVoice : undefined;
};

export const estimateSpeechDurationMs = (text?: string | null) => {
  const cleanText = normalizeSpeechText(text);
  if (!cleanText) return 0;

  const chineseCount = cleanText.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const words = cleanText.match(/[A-Za-z][A-Za-z'-]*/g)?.length || 0;
  const estimatedSeconds = Math.max(1.4, words / 2.25, chineseCount / 4.2);

  return Math.ceil(estimatedSeconds * 1000);
};

export const stopSpeech = async () => {
  speechRunId += 1;
  cancelSpeechProgress();
  currentAudioStop?.();
  currentAudioStop = null;
  currentAudio = null;

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await TextToSpeech.stop();
    } catch {
      // Native TTS may not be initialized yet.
    }
  }
};

const playAudioFile = (audioSrc: string) => {
  if (typeof window === "undefined") return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const audio = new Audio(audioSrc);
    let settled = false;
    currentAudio = audio;

    const cleanup = (success: boolean) => {
      if (settled) return;
      settled = true;
      audio.onended = null;
      audio.onerror = null;
      if (currentAudio === audio) currentAudio = null;
      if (currentAudioStop === stopCurrent) currentAudioStop = null;
      resolve(success);
    };

    const stopCurrent = () => {
      audio.pause();
      audio.currentTime = 0;
      cleanup(true);
    };

    currentAudioStop = stopCurrent;
    audio.onended = () => cleanup(true);
    audio.onerror = () => cleanup(false);
    audio.play().catch(() => cleanup(false));
  });
};

const speakWithWebSpeech = async (
  text: string,
  lang: string,
  role: SpeechRole,
  runId?: number,
) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const profile = roleProfiles[role];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    void chooseBestWebVoice(lang, role).then((voice) => {
      if (runId !== undefined && runId !== speechRunId) {
        resolve();
        return;
      }
      if (voice) utterance.voice = voice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  });
};

export const speakText = async (
  rawText: string | null | undefined,
  options: { role?: SpeechRole; lang?: string; audioSrc?: string } = {},
) => {
  const text = normalizeSpeechText(rawText);
  if (!text) return;

  const role = options.role || "female";
  const lang = options.lang || detectSpeechLang(text);
  const profile = roleProfiles[role];

  await stopSpeech();
  const runId = speechRunId;
  startSpeechProgress(text, runId);

  try {
    if (options.audioSrc) {
      const playedAudio = await playAudioFile(options.audioSrc);
      if (playedAudio) {
        finishSpeechProgress(text, runId);
        return;
      }
      if (runId !== speechRunId) return;
    }

    if (Capacitor.isNativePlatform()) {
      if (runId !== speechRunId) return;
      const voice = await chooseBestVoiceIndex(lang, role);
      if (runId !== speechRunId) return;
      await TextToSpeech.speak({
        text,
        lang,
        rate: profile.rate,
        pitch: profile.pitch,
        volume: profile.volume,
        voice,
        category: "ambient",
        queueStrategy: QueueStrategy.Flush,
      });
      finishSpeechProgress(text, runId);
      return;
    }

    if (runId !== speechRunId) return;
    await speakWithWebSpeech(text, lang, role, runId);
    finishSpeechProgress(text, runId);
  } catch (error) {
    finishSpeechProgress(text, runId);
    throw error;
  }
};

export const getStepSpeech = (step: any): { text: string; role: SpeechRole } => {
  if (!step) return { text: "", role: "female" };

  if (step.type === "narrator") {
    return {
      text: step.speech_text || step.text_en || step.text || step.text_cn || "",
      role: "narrator",
    };
  }

  if (step.type === "dialogue") {
    const isYou = step.speaker === "You" || step.avatar === "you";
    return {
      text: step.speech_text || step.text_en || step.text || "",
      role: isYou ? "you" : getSpeakerRole(step.speaker),
    };
  }

  if (step.type === "question" || step.type === "interactive") {
    return {
      text:
        step.speech_text ||
        step.target_sentence ||
        step.instruction ||
        step.question ||
        "",
      role: "question",
    };
  }

  return { text: "", role: "female" };
};
