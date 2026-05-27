import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Mic,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  playDialogueAppearSound,
  playQuestionAppearSound,
  playSceneSwipeSound,
  playSoftErrorSound,
  triggerHaptic,
} from "./utils/feedback";
import {
  getSavedSpeechEnabled,
  getStepSpeech,
  saveSpeechEnabled,
  speakText,
  stopSpeech,
} from "./utils/speech";
import {
  evaluateSpeakingPractice,
  normalizeSpeakingText,
} from "./utils/speakingPractice";
import type { SpeakingPracticeEvaluation } from "./utils/speakingPractice";
import { SpeechProgressText } from "./components/SpeechProgressText";
import {
  getMicrophonePermissionMessage,
  isMicrophonePermissionFailure,
  requestMicrophoneAccess,
} from "./utils/microphone";

const playTone = (
  frequency: number,
  type: OscillatorType,
  duration: number,
  vol = 0.1,
) => {
  if (typeof window === "undefined") return;
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, Math.ceil((duration + 0.12) * 1000));
  } catch (e) {}
};

const playDuolingoSuccess = () => {
  playTone(523.25, "sine", 0.15, 0.13); // C5
  setTimeout(() => playTone(659.25, "sine", 0.25, 0.13), 100); // E5
};

const playDuolingoReward = () => {
  playTone(440, "sine", 0.1);
  setTimeout(() => playTone(554.37, "sine", 0.1), 100);
  setTimeout(() => playTone(659.25, "sine", 0.1), 200);
  setTimeout(() => playTone(880, "sine", 0.3), 300);
};

const hapticFeedback = {
  light: () => {
    triggerHaptic("light", 10);
    playTone(800, "sine", 0.05, 0.02);
  },
  success: () => {
    triggerHaptic("success", 50);
    playDuolingoSuccess();
  },
	  error: () => {
	    triggerHaptic("error", [10, 50, 10]);
	    playSoftErrorSound();
	  },
  reward: () => {
    triggerHaptic("reward", [50, 30, 50]);
    playDuolingoReward();
  },
};

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const createEnglishSpeechRecognition = (): WebSpeechRecognition | null => {
  if (typeof window === "undefined") return null;
  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;

  try {
    const recognition = new SpeechRecognitionCtor() as WebSpeechRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    return recognition;
  } catch {
    return null;
  }
};

export const TypewriterText = ({
  text,
  isLatest,
  delay = 30,
  revealNow = false,
  underlineWords = false,
  underlineClassName = "border-stone-400/45",
}: {
  text?: string | null;
  isLatest: boolean;
  delay?: number;
  revealNow?: boolean;
  underlineWords?: boolean;
  underlineClassName?: string;
}) => {
  const safeText = typeof text === "string" ? text : "";
  const [displayedText, setDisplayedText] = useState(
    isLatest && !revealNow ? "" : safeText,
  );

  useEffect(() => {
    if (!isLatest || revealNow) {
      setDisplayedText(safeText);
      return;
    }
    setDisplayedText("");
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(safeText.slice(0, i + 1));
      i++;
      if (i >= safeText.length) clearInterval(timer);
    }, delay);
    return () => clearInterval(timer);
  }, [safeText, isLatest, delay, revealNow]);

  if (underlineWords) {
    return (
      <SpeechProgressText
        text={displayedText}
        speechMatchText={safeText}
        underlineWords
        underlineClassName={underlineClassName}
      />
    );
  }

  return <SpeechProgressText text={displayedText} speechMatchText={safeText} />;
};

const slugifySpeakerForAudio = (speaker?: string | null) => {
  const value = (speaker || "narration")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return value || "speaker";
};

const getStepAudioSrc = (
  lessonId: number | undefined,
  step: any,
  stepIndex: number,
) => {
  if (step?.audio_src || step?.audioSrc) {
    return step.audio_src || step.audioSrc;
  }

  if (!lessonId) return undefined;

  const episodeNum = Math.min(8, Math.max(1, lessonId));
  const stepNum = String(stepIndex + 1).padStart(3, "0");
  const stepType = step?.type;
  const speakerSlug =
    stepType === "narrator"
      ? "narration"
      : stepType === "question" || stepType === "interactive"
        ? "question"
        : slugifySpeakerForAudio(step?.speaker);

  return `/audio/episodes/episode_${episodeNum}/step_${stepNum}_${speakerSlug}.mp3`;
};

const isInteractiveStep = (step: any) =>
  step?.type === "question" || step?.type === "interactive";

export interface UnifiedQuizRef {
  skipToLast: () => void;
}

export const UnifiedQuiz = forwardRef<
  UnifiedQuizRef,
  {
    lessonId?: number;
    stamina: number;
    items?: any[];
    background?: "none" | string;
    onComplete: (xp?: number, gold?: number, gems?: number) => void;
    onFail: () => void;
    setGlobalStamina: React.Dispatch<React.SetStateAction<number>>;
    onQuestionChange?: (question: any) => void;
    onAudioPlay?: () => void;
    onMistake?: (step: any) => void;
    onAnswerResult?: (isCorrect: boolean) => void;
  }
>((props, ref) => {
  const {
    lessonId,
    items,
    background,
    stamina,
    onComplete,
    onFail,
    setGlobalStamina,
    onMistake,
    onAnswerResult,
    onQuestionChange,
    onAudioPlay,
  } = props;

  const [script, setScript] = useState<any[]>(items || []);
  const [visibleSteps, setVisibleSteps] = useState<number[]>([0]);
  const [revealedStepIndexes, setRevealedStepIndexes] = useState<Set<number>>(
    () => new Set(),
  );
  const [revealedTranslationIndexes, setRevealedTranslationIndexes] = useState<
    Set<number>
  >(() => new Set());
  const [translationTapCount, setTranslationTapCount] = useState(0);
  const [speechEnabled, setSpeechEnabled] = useState(getSavedSpeechEnabled);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autoAdvanceRunIdRef = useRef(0);
  const completionQueuedRef = useRef(false);
  const lastQuestionSignalRef = useRef<string | null>(null);
  const lastStoryAppearanceSoundRef = useRef<string | null>(null);
  const lastActiveBackgroundRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [visibleSteps]);

  const clearAutoAdvanceTimer = useCallback(() => {
    autoAdvanceRunIdRef.current += 1;
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
      void stopSpeech();
    };
  }, [clearAutoAdvanceTimer]);

  useEffect(() => {
    if (items && items.length > 0) {
      setScript(items);
    } else if (lessonId) {
      const episodeNum = Math.min(8, Math.max(1, lessonId));

      import(`./data/config/episode_${episodeNum}.json`)
        .then((module) => {
          setScript(module.steps || module.default.steps);
        })
        .catch((err) => {
          console.error(`Failed to load episode ${episodeNum}:`, err);
      });
    }
  }, [lessonId, items]);

  useEffect(() => {
    lastQuestionSignalRef.current = null;
    lastStoryAppearanceSoundRef.current = null;
  }, [lessonId, items]);

  const currentStepIndex = visibleSteps[visibleSteps.length - 1];

  useEffect(() => {
    const latest = script[currentStepIndex];
    const signalKey =
      latest?.question_id || latest?.id || `${currentStepIndex}`;

    if (isInteractiveStep(latest)) {
      if (lastQuestionSignalRef.current === signalKey) return;
      lastQuestionSignalRef.current = signalKey;

      onQuestionChange?.(latest);
      hapticFeedback.light();
      playQuestionAppearSound();
      return;
    }

    if (latest?.type !== "dialogue" && latest?.type !== "narrator") return;

    const storySoundKey = `${latest.type}:${signalKey}`;
    if (lastStoryAppearanceSoundRef.current === storySoundKey) return;
    lastStoryAppearanceSoundRef.current = storySoundKey;
    playDialogueAppearSound();
  }, [currentStepIndex, onQuestionChange, script]);

  const revealStep = useCallback((stepIndex: number) => {
    setRevealedStepIndexes((prev) => {
      if (prev.has(stepIndex)) return prev;
      const next = new Set(prev);
      next.add(stepIndex);
      return next;
    });
  }, []);

  const revealTranslation = useCallback((stepIndex: number) => {
    setRevealedTranslationIndexes((prev) => {
      if (prev.has(stepIndex)) return prev;
      const next = new Set(prev);
      next.add(stepIndex);
      return next;
    });
    setTranslationTapCount((prev) => Math.min(3, prev + 1));
  }, []);

  const handleNext = useCallback(() => {
    clearAutoAdvanceTimer();
    setVisibleSteps((prev) => {
      const lastIndex = prev[prev.length - 1] ?? 0;

      if (lastIndex < script.length - 1) {
        return [...prev, lastIndex + 1];
      }

      if (!completionQueuedRef.current) {
        completionQueuedRef.current = true;
        setTimeout(() => onComplete(50, 10, 0), 0);
      }

      return prev;
    });
  }, [clearAutoAdvanceTimer, onComplete, script.length]);

  const handleStoryAdvance = useCallback(() => {
    clearAutoAdvanceTimer();
    setVisibleSteps((prev) => {
      const lastIndex = prev[prev.length - 1] ?? 0;
      const latest = script[lastIndex];

      if (isInteractiveStep(latest)) return prev;

      if (lastIndex < script.length - 1) {
        return [...prev, lastIndex + 1];
      }

      if (!completionQueuedRef.current) {
        completionQueuedRef.current = true;
        setTimeout(() => onComplete(50, 10, 0), 0);
      }

      return prev;
    });
  }, [clearAutoAdvanceTimer, onComplete, script]);

  useImperativeHandle(
    ref,
    () => ({
      skipToLast: () => {
        void stopSpeech();
        clearAutoAdvanceTimer();

        const targetIndex = script.reduce((target, step, index) => {
          if (index > currentStepIndex && isInteractiveStep(step)) {
            return index;
          }
          return target;
        }, currentStepIndex);

        setRevealedStepIndexes((prev) => {
          const next = new Set(prev);
          for (let i = currentStepIndex; i <= targetIndex; i += 1) {
            next.add(i);
          }
          return next;
        });

        setVisibleSteps((prev) => {
          const lastIndex = prev[prev.length - 1] ?? 0;
          const safeTarget = Math.max(lastIndex, targetIndex);
          if (safeTarget === lastIndex) return prev;

          const additions = Array.from(
            { length: safeTarget - lastIndex },
            (_, index) => lastIndex + index + 1,
          );
          return [...prev, ...additions];
        });
      },
    }),
    [clearAutoAdvanceTimer, currentStepIndex, script],
  );

  useEffect(() => {
    if (script.length === 0) return;
    completionQueuedRef.current = false;
    const latest = script[currentStepIndex];
    const speech = getStepSpeech(latest);
    const audioSrc = getStepAudioSrc(lessonId, latest, currentStepIndex);
    clearAutoAdvanceTimer();
    const runId = autoAdvanceRunIdRef.current;

    const text = latest?.text || latest?.text_en || "";
    const textCn = latest?.text_cn || "";
    const maxLen = Math.max(text.length, textCn.length);
    const animationTime = maxLen * 40;
    const scheduleStoryAdvance = (delayMs: number) => {
      autoAdvanceTimerRef.current = setTimeout(() => {
        if (autoAdvanceRunIdRef.current === runId) {
          handleStoryAdvance();
        }
      }, delayMs);
    };

    const speechStartedAt = Date.now();
    const speechPromise =
      speechEnabled && speech.text
        ? speakText(speech.text, { role: speech.role, audioSrc }).catch(
            (err) => {
              console.warn("Failed to play speech:", err);
            },
          )
        : null;

    if (speechPromise) {
      onAudioPlay?.();
    }

    if (latest && !isInteractiveStep(latest)) {
      if (speechPromise) {
        void speechPromise.then(() => {
          if (autoAdvanceRunIdRef.current !== runId) return;
          const elapsed = Date.now() - speechStartedAt;
          scheduleStoryAdvance(Math.max(0, animationTime - elapsed) + 250);
        });
      } else {
        scheduleStoryAdvance(animationTime + 500);
      }
    }

    return clearAutoAdvanceTimer;
  }, [
    clearAutoAdvanceTimer,
    currentStepIndex,
    handleStoryAdvance,
    lessonId,
    onAudioPlay,
    script,
    speechEnabled,
  ]);

  const handleStoryTap = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as Element | null;
      if (
        target?.closest(
          "button,a,input,textarea,select,label,[role='button'],[data-no-story-skip='true']",
        )
      ) {
        return;
      }

      const latest = script[currentStepIndex];
      if (!latest) return;

      const speech = getStepSpeech(latest);
      const hasVisibleText = Boolean(
        speech.text ||
          latest.text ||
          latest.text_en ||
          latest.text_cn ||
          latest.instruction ||
          latest.question,
      );

      if (!hasVisibleText) return;

      clearAutoAdvanceTimer();
      void stopSpeech();
      revealStep(currentStepIndex);

      if (!isInteractiveStep(latest)) {
        handleStoryAdvance();
      }
    },
    [
      clearAutoAdvanceTimer,
      currentStepIndex,
      handleStoryAdvance,
      revealStep,
      script,
    ],
  );

  const toggleSpeech = () => {
    setSpeechEnabled((prev) => {
      const next = !prev;
      saveSpeechEnabled(next);
      if (!next) {
        void stopSpeech();
      } else {
        const speech = getStepSpeech(script[currentStepIndex]);
        const audioSrc = getStepAudioSrc(
          lessonId,
          script[currentStepIndex],
          currentStepIndex,
        );
        onAudioPlay?.();
        void speakText(speech.text, { role: speech.role, audioSrc });
      }
      return next;
    });
  };

  const activeBackground = useMemo(() => {
    for (let index = currentStepIndex; index >= 0; index -= 1) {
      const step = script[index];
      const sceneImage = step?.scene_image || step?.sceneImage;
      if (sceneImage) return sceneImage;
    }

    return background || "/assets/cafeishineibeijing.png";
  }, [background, currentStepIndex, script]);

  useEffect(() => {
    if (background === "none") {
      lastActiveBackgroundRef.current = null;
      return;
    }

    const previousBackground = lastActiveBackgroundRef.current;
    if (previousBackground && previousBackground !== activeBackground) {
      playSceneSwipeSound();
    }
    lastActiveBackgroundRef.current = activeBackground;
  }, [activeBackground, background]);

  useEffect(() => {
    if (typeof window === "undefined" || background === "none") return;

    const imageSources = new Set<string>();
    if (background) imageSources.add(background);
    script.forEach((step) => {
      const sceneImage = step?.scene_image || step?.sceneImage;
      if (sceneImage) imageSources.add(sceneImage);
    });

    imageSources.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, [background, script]);

  if (script.length === 0)
    return (
      <div className="flex-1 flex items-center justify-center font-bold text-stone-500">
        Loading story...
      </div>
    );

  const renderChatMessage = (step: any, index: number) => {
    const isLatest = index === currentStepIndex;
    const revealNow = revealedStepIndexes.has(index);
    const isYou = step.speaker === "You" || step.avatar === "you";
    const hasTranslation = Boolean(step.text_cn);
    const showTranslation =
      hasTranslation &&
      (translationTapCount >= 3 || revealedTranslationIndexes.has(index));
    const requestTranslation = (event: React.MouseEvent) => {
      if (!hasTranslation || showTranslation) return;
      event.stopPropagation();
      clearAutoAdvanceTimer();
      revealTranslation(index);
    };

    if (step.type === "narrator") {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center my-6 w-full px-4"
        >
          <div className="bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-[16px] text-center max-w-[90%]">
            <p
              onClick={requestTranslation}
              className={`text-white font-bold text-[14px] leading-snug ${hasTranslation && !showTranslation ? "cursor-pointer" : ""}`}
            >
              <TypewriterText
                text={step.text || step.text_en}
                isLatest={isLatest}
                delay={40}
                revealNow={revealNow}
                underlineWords={hasTranslation}
                underlineClassName="border-white/45"
              />
            </p>
            {showTranslation && (
              <p className="mt-1.5 text-white/75 text-[12px] leading-snug font-medium">
                <TypewriterText
                  text={step.text_cn}
                  isLatest={isLatest}
                  delay={20}
                  revealNow={revealNow}
                />
              </p>
            )}
          </div>
        </motion.div>
      );
    }

    if (step.type === "dialogue") {
      return (
        <motion.div
          initial={isLatest ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex flex-col my-3"
        >
          <div
            className={`flex w-full ${isYou ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex max-w-[90%] ${isYou ? "flex-row-reverse" : "flex-row"} items-end gap-2.5`}
            >
              {isYou ? (
                <div className="shrink-0 w-11 h-11 rounded-full border border-[#1899D6] overflow-hidden bg-white shadow-sm ring-2 ring-white">
                  <img
                    src={step.avatar || "/assets/youhappy.png"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="shrink-0 w-11 h-11 rounded-full border border-stone-200 overflow-hidden bg-white shadow-sm ring-2 ring-white">
                  {step.avatar && step.avatar !== "/assets/NPC.png" ? (
                    <img
                      src={step.avatar}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
              )}

              <div
                className={`flex flex-col ${isYou ? "items-end" : "items-start"}`}
              >
                {!isYou && (
                  <span className="text-amber-400 text-[13px] font-black mb-1 ml-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    {step.speaker}
                  </span>
                )}
                <div
                  className={`px-4 py-3 rounded-[20px] relative shadow-[0_2px_10px_rgba(0,0,0,0.04)] min-h-[46px] ${
                    isYou
                      ? "bg-[#1CB0F6] text-white rounded-br-sm border border-[#1899D6]"
                      : "bg-white/95 backdrop-blur-sm text-stone-800 rounded-bl-sm border border-stone-200"
                  }`}
                >
                  <p
                    onClick={requestTranslation}
                    className={`font-bold text-[16px] whitespace-pre-wrap leading-snug ${hasTranslation && !showTranslation ? "cursor-pointer" : ""}`}
                  >
                    <TypewriterText
                      text={step.text || step.text_en}
                      isLatest={isLatest}
                      delay={40}
                      revealNow={revealNow}
                      underlineWords={hasTranslation}
                      underlineClassName={
                        isYou ? "border-white/55" : "border-stone-400/45"
                      }
                    />
                  </p>
                  {showTranslation && (
                    <p
                      className={`mt-1.5 text-[12px] leading-snug font-semibold opacity-90 ${isYou ? "text-blue-100" : "text-stone-500"}`}
                    >
                      <TypewriterText
                        text={step.text_cn}
                        isLatest={isLatest}
                        delay={20}
                        revealNow={revealNow}
                      />
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    if (step.type === "question") {
      return (
        <motion.div
          initial={
            isLatest
              ? { opacity: 0, scale: 0.95, y: 30 }
              : { opacity: 1, scale: 1, y: 0 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full flex flex-col my-4"
        >
          <div className="flex w-full justify-center mb-4 px-4">
            <div className="flex w-full flex-col items-center">
              <div className="px-5 py-3.5 rounded-[22px] bg-amber-400 text-amber-950 shadow-md border border-amber-300 min-h-[48px] w-full max-w-[95%]">
                <p className="font-bold text-[16px] leading-relaxed whitespace-pre-wrap">
                  <TypewriterText
                    text={step.instruction || step.question || ""}
                    isLatest={isLatest}
                    delay={30}
                    revealNow={revealNow}
                  />
                </p>
              </div>
            </div>
          </div>

          <motion.div
            initial={isLatest ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full px-4 flex flex-col items-center"
          >
            {isLatest ? (
              <div className="w-full max-w-[95%] bg-white/95 backdrop-blur-xl rounded-[24px] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-white">
                {step.format === "multiple_choice" ||
                step.format === "translation" ||
                (!step.format && step.options) ? (
		                  <ChatQuestionMultipleChoice
		                    step={step}
		                    onCorrect={handleNext}
		                    onMistake={(s: any) => props.onMistake?.(s)}
		                    onAnswerResult={onAnswerResult}
		                    isLatest={isLatest}
		                    onLayoutChange={scrollToBottom}
                        speechEnabled={speechEnabled}
                        onAudioPlay={onAudioPlay}
		                  />
	                ) : step.format === "matching" ? (
	                  <ChatQuestionMatching
	                    step={step}
	                    onCorrect={handleNext}
	                    onMistake={(s: any) => props.onMistake?.(s)}
	                    onAnswerResult={onAnswerResult}
	                    isLatest={isLatest}
	                    onLayoutChange={scrollToBottom}
	                  />
	                ) : step.format === "sentence_build" ? (
		                  <ChatQuestionSentenceBuild
		                    step={step}
		                    onCorrect={handleNext}
		                    onMistake={(s: any) => props.onMistake?.(s)}
		                    onAnswerResult={onAnswerResult}
		                    isLatest={isLatest}
		                    onLayoutChange={scrollToBottom}
                        speechEnabled={speechEnabled}
                        onAudioPlay={onAudioPlay}
		                  />
	                ) : step.format === "speaking_practice" ? (
	                  <ChatQuestionSpeakingPractice
	                    step={step}
	                    onCorrect={handleNext}
	                    onMistake={(s: any) => props.onMistake?.(s)}
	                    onAnswerResult={onAnswerResult}
	                    isLatest={isLatest}
	                    onLayoutChange={scrollToBottom}
                        speechEnabled={speechEnabled}
                        onAudioPlay={onAudioPlay}
	                  />
                ) : null}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div
      className="flex flex-col h-full bg-slate-950 relative w-full font-sans overflow-hidden"
      onClick={handleStoryTap}
    >
      {/* Background Image filling the entire area */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none w-full h-full">
        {background === "none" ? null : (
          <AnimatePresence initial={false}>
            <motion.img
              key={activeBackground}
              src={activeBackground}
              className="absolute inset-0 h-full w-full object-cover opacity-100 will-change-transform"
              initial={{ x: "100%" }}
              animate={{ x: "0%" }}
              exit={{ x: "-100%" }}
              transition={{
                duration: 0.62,
                ease: [0.32, 0.72, 0, 1],
              }}
              draggable={false}
            />
          </AnimatePresence>
        )}
      </div>

      {/* Top Header info */}
      <div className="relative z-30 w-full pt-4 pb-2 px-6 shrink-0 flex items-center gap-4 pointer-events-auto">
        <div className="flex-1 bg-black/20 rounded-full h-3.5 border-[2px] border-white/20 overflow-hidden relative shadow-inner">
          <motion.div
            className="absolute left-0 top-0 bottom-0 bg-[#58CC02] rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `${Math.max(5, ((currentStepIndex + 1) / script.length) * 100)}%`,
            }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
          >
            <div className="absolute top-[3px] h-[3px] left-2 right-2 bg-white/30 rounded-full"></div>
          </motion.div>
        </div>
        <button
          type="button"
          aria-label={speechEnabled ? "关闭语音朗读" : "开启语音朗读"}
          onClick={toggleSpeech}
          className={`w-9 h-9 rounded-full border border-white shadow-sm flex items-center justify-center shrink-0 active:scale-95 transition-transform ${
            speechEnabled
              ? "bg-emerald-50 text-emerald-600"
              : "bg-white/75 text-stone-400"
          }`}
        >
          {speechEnabled ? (
            <Volume2 className="w-[18px] h-[18px]" strokeWidth={2.8} />
          ) : (
            <VolumeX className="w-[18px] h-[18px]" strokeWidth={2.8} />
          )}
        </button>
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white shadow-sm shrink-0">
          <Zap className="w-4 h-4 text-sky-500 fill-sky-400" />
          <span className="font-black text-[14px] text-sky-700">{stamina}</span>
        </div>
      </div>

      {/* Main Flowing WeChat-style Chat */}
      <div className="relative z-30 flex-1 w-full bg-transparent overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-[calc(5.25rem+env(safe-area-inset-bottom))] scroll-smooth">
          <div className="max-w-2xl mx-auto flex flex-col w-full min-h-full justify-start">
            {visibleSteps.map((stepIndex) => (
              <React.Fragment key={stepIndex}>
                {renderChatMessage(script[stepIndex], stepIndex)}
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
});

export const ChatQuestionMultipleChoice = ({
  step,
  onCorrect,
	  onMistake,
	  onAnswerResult,
	  isLatest,
	  onLayoutChange,
  speechEnabled,
  onAudioPlay,
	}: any) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [wrongIndexes, setWrongIndexes] = useState<number[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hasChargedAnswer, setHasChargedAnswer] = useState(false);

  const handleSelect = (idx: number, correct: boolean) => {
    if (isCorrect || wrongIndexes.includes(idx)) return; // Prevent clicking after correct or repeated wrong taps
    setSelectedIdx(idx);
    if (!hasChargedAnswer) {
      onAnswerResult?.(Boolean(correct));
      setHasChargedAnswer(true);
    }

    if (correct) {
      setIsCorrect(true);
      hapticFeedback.success();
      const selectedOption = step.options?.[idx];
      playCorrectResponseSpeech({
        answerText: isDialogueCompletionQuestion(step)
          ? cleanAnswerSpeechText(selectedOption?.text) || getCorrectOptionText(step)
          : undefined,
        feedbackText: step.feedback,
        speechEnabled,
        onAudioPlay,
      });
    } else {
      setIsCorrect(false);
      setWrongIndexes((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
      hapticFeedback.error();
      onMistake(step);
    }
    window.setTimeout(() => onLayoutChange?.(), 90);
  };

  return (
    <div className="flex flex-col gap-2">
      {step.options.map((opt: any, idx: number) => {
        const isSelected = selectedIdx === idx;
        const isWrongMarked = wrongIndexes.includes(idx);
        let btnCls =
          "bg-white border-2 border-stone-200 text-stone-700 hover:border-[#1CB0F6] shadow-sm";

        if (isSelected) {
          if (isCorrect === true) {
            btnCls =
              "bg-emerald-100 border-2 border-emerald-500 text-emerald-800";
          } else if (isCorrect === false || isWrongMarked) {
            btnCls = "bg-red-100 border-2 border-red-500 text-red-800";
          }
        } else if (isWrongMarked) {
          btnCls = "bg-red-50 border-2 border-red-400 text-red-800 shadow-sm";
        } else if (isCorrect === true && opt.is_correct) {
          btnCls = "bg-emerald-50 border-2 border-emerald-300 text-emerald-600";
        }

        return (
          <motion.button
            key={idx}
            disabled={isCorrect === true || isWrongMarked || !isLatest}
            onClick={() => handleSelect(idx, opt.is_correct)}
            className={`w-full text-left p-3.5 rounded-[16px] flex items-center transition-all active:scale-[0.98] ${
              isWrongMarked ? "animate-shake cursor-default" : ""
            } ${btnCls}`}
          >
            {opt.label && (
              <span
                className={`w-8 h-8 rounded-[10px] ${isSelected && isCorrect === true ? "bg-emerald-500/20 text-emerald-700" : isWrongMarked ? "bg-red-500/20 text-red-700" : "bg-black/5"} flex items-center justify-center font-black text-[14px] mr-3.5 shrink-0 transition-colors`}
              >
                {opt.label}
              </span>
            )}
            <span className="font-bold text-[15px] leading-snug">
              <SpeechProgressText
                text={opt.text}
                speechMatchText={cleanAnswerSpeechText(opt.text)}
              />
            </span>
          </motion.button>
        );
      })}

      {isCorrect && step.feedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 bg-emerald-50 text-emerald-700 p-3.5 rounded-[16px] text-[14px] font-bold border border-emerald-200 shadow-sm"
        >
          <SpeechProgressText text={step.feedback} />
        </motion.div>
      )}

      {isCorrect && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <button
            onClick={onCorrect}
            className="w-full bg-[#58CC02] text-white py-3.5 rounded-[16px] font-black text-[16px] shadow-[0_4px_0_#58a700] active:translate-y-[4px] active:shadow-none transition-all"
          >
            继续
          </button>
        </motion.div>
      )}
    </div>
  );
};

const normalizeBuiltSentence = (value: string) =>
  value
    .toLowerCase()
    .replace(/[“”"'’‘.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const cleanAnswerSpeechText = (value?: string | null) =>
  (value || "")
    .replace(/[（(][^（）()]*AI[^（）()]*[）)]/gi, "")
    .replace(/^[A-D][.、:：]\s*/i, "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isDialogueCompletionQuestion = (step: any) => {
  const sourceType = `${step?.source_type || ""} ${step?.question_type_code || ""} ${
    step?.question_type_label || ""
  }`.toLowerCase();
  return sourceType.includes("t2") || sourceType.includes("对话补全");
};

const getCorrectOptionText = (step: any) =>
  cleanAnswerSpeechText(
    step?.options?.find((option: any) => option?.is_correct)?.text ||
      step?.review_word ||
      step?.target_sentence,
  );

const playCorrectResponseSpeech = ({
  answerText,
  feedbackText,
  speechEnabled,
  onAudioPlay,
}: {
  answerText?: string | null;
  feedbackText?: string | null;
  speechEnabled: boolean;
  onAudioPlay?: () => void;
}) => {
  if (!speechEnabled) return;

  const cleanAnswer = cleanAnswerSpeechText(answerText);
  const cleanFeedback = cleanAnswerSpeechText(feedbackText);
  if (!cleanAnswer && !cleanFeedback) return;

  void (async () => {
    try {
      if (cleanAnswer) {
        onAudioPlay?.();
        await speakText(cleanAnswer, { role: "you", lang: "en-US" });
      }
      if (cleanFeedback) {
        onAudioPlay?.();
        await speakText(cleanFeedback, { role: "narrator" });
      }
    } catch (err) {
      console.warn("Failed to play correct response speech:", err);
    }
  })();
};

export const ChatQuestionSentenceBuild = ({
  step,
  onCorrect,
  onMistake,
  onAnswerResult,
  isLatest,
  onLayoutChange,
  speechEnabled,
  onAudioPlay,
}: any) => {
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hasChargedAnswer, setHasChargedAnswer] = useState(false);
  const [hasRecordedMistake, setHasRecordedMistake] = useState(false);

  const builtText = selectedIndexes
    .map((index) => step.chunks[index])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const targetAnswer = step.normalized_answer || normalizeBuiltSentence(step.answer);

  const handlePick = (index: number) => {
    if (!isLatest || isCorrect === true || selectedIndexes.includes(index)) {
      return;
    }
    setIsCorrect(null);
    setSelectedIndexes((prev) => [...prev, index]);
  };

  const handleUndo = () => {
    if (isCorrect === true) return;
    setIsCorrect(null);
    setSelectedIndexes((prev) => prev.slice(0, -1));
  };

  const handleCheck = () => {
    const correct = normalizeBuiltSentence(builtText) === targetAnswer;
    if (!hasChargedAnswer) {
      onAnswerResult?.(correct);
      setHasChargedAnswer(true);
    }

    setIsCorrect(correct);
    window.setTimeout(() => onLayoutChange?.(), 90);
    if (correct) {
      hapticFeedback.success();
      playCorrectResponseSpeech({
        answerText: step.answer,
        feedbackText: step.feedback,
        speechEnabled,
        onAudioPlay,
      });
      return;
    }

    hapticFeedback.error();
    if (!hasRecordedMistake) {
      onMistake(step);
      setHasRecordedMistake(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`min-h-[64px] rounded-[18px] border-2 p-3 flex flex-wrap gap-2 items-center ${
          isCorrect === false ? "animate-shake" : ""
        } ${
          isCorrect === true
            ? "bg-emerald-50 border-emerald-300"
            : isCorrect === false
              ? "bg-red-50 border-red-300"
              : "bg-sky-50 border-sky-200"
        }`}
      >
        {selectedIndexes.length === 0 ? (
          <span className="text-sky-700/55 font-bold text-[14px]">
            点击下方词块组成句子
          </span>
        ) : (
          selectedIndexes.map((index) => (
            <span
              key={`${index}-${step.chunks[index]}`}
              className="px-3 py-2 rounded-[12px] bg-white text-stone-800 border border-sky-100 shadow-sm font-black text-[15px]"
            >
              {step.chunks[index]}
            </span>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {step.chunks.map((chunk: string, index: number) => {
          const selected = selectedIndexes.includes(index);
          return (
            <button
              key={`${chunk}-${index}`}
              disabled={selected || isCorrect === true || !isLatest}
              onClick={() => handlePick(index)}
              className={`px-3.5 py-2.5 rounded-[14px] border-2 font-black text-[15px] transition-all active:scale-95 ${
                selected
                  ? "bg-stone-100 border-stone-100 text-stone-300"
                  : "bg-white border-stone-200 text-stone-700 hover:border-[#1CB0F6] shadow-sm"
              }`}
            >
              {chunk}
            </button>
          );
        })}
      </div>

      {isCorrect === false && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 text-red-700 p-3.5 rounded-[16px] text-[14px] font-bold border border-red-200"
        >
          <SpeechProgressText
            text={step.feedback_wrong || `正确句子是：${step.answer}`}
          />
        </motion.div>
      )}

      {isCorrect === true && step.feedback && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 text-emerald-700 p-3.5 rounded-[16px] text-[14px] font-bold border border-emerald-200"
        >
          <SpeechProgressText text={step.feedback} />
        </motion.div>
      )}

      {isCorrect === true ? (
        <button
          onClick={onCorrect}
          className="w-full bg-[#58CC02] text-white py-3.5 rounded-[16px] font-black text-[16px] shadow-[0_4px_0_#58a700] active:translate-y-[4px] active:shadow-none transition-all"
        >
          继续
        </button>
      ) : (
        <div className="grid grid-cols-[0.85fr_1.15fr] gap-2.5">
          <button
            onClick={handleUndo}
            disabled={selectedIndexes.length === 0 || !isLatest}
            className="bg-white text-stone-500 border-2 border-stone-200 py-3 rounded-[16px] font-black disabled:opacity-45"
          >
            撤回
          </button>
          <button
            onClick={handleCheck}
            disabled={selectedIndexes.length === 0 || !isLatest}
            className="bg-[#1CB0F6] text-white py-3 rounded-[16px] font-black shadow-[0_4px_0_#1899D6] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-45"
          >
            检查句子
          </button>
        </div>
      )}
    </div>
  );
};

export const ChatQuestionSpeakingPractice = ({
  step,
  onCorrect,
  onMistake,
  onAnswerResult,
  isLatest,
  onLayoutChange,
  speechEnabled = true,
  onAudioPlay,
}: any) => {
  const targetSentence = step.target_sentence || step.answer || "";
  const configuredMaxSeconds = Number(step.maxSeconds ?? step.max_seconds);
  const configuredPassScore = Number(step.passScore ?? step.pass_score);
  const maxSeconds = Number.isFinite(configuredMaxSeconds)
    ? Math.max(3, Math.min(10, configuredMaxSeconds))
    : 10;
  const passScore = Number.isFinite(configuredPassScore)
    ? Math.max(
        0.1,
        Math.min(1, configuredPassScore > 1 ? configuredPassScore / 100 : configuredPassScore),
      )
    : 0.75;
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(maxSeconds);
  const [spokenText, setSpokenText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [evaluation, setEvaluation] =
    useState<SpeakingPracticeEvaluation | null>(null);
  const [statusText, setStatusText] = useState("Tap the mic and read aloud.");
  const [completed, setCompleted] = useState(false);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const transcriptRef = useRef("");
  const recordingRef = useRef(false);
  const finalizedRef = useRef(false);
  const timeoutHitRef = useRef(false);
  const recognitionErrorRef = useRef<string | null>(null);
  const permissionPendingRef = useRef(false);
  const hasChargedAttemptRef = useRef(false);
  const hasRecordedMistakeRef = useRef(false);

  const clearRecordingTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const chargeAttempt = useCallback(
    (passed: boolean) => {
      if (!hasChargedAttemptRef.current) {
        onAnswerResult?.(passed);
        hasChargedAttemptRef.current = true;
      }

      if (!passed && !hasRecordedMistakeRef.current) {
        onMistake?.(step);
        hasRecordedMistakeRef.current = true;
      }
    },
    [onAnswerResult, onMistake, step],
  );

  const finishRecording = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    recordingRef.current = false;
    setIsRecording(false);
    clearRecordingTimers();

    const elapsedMs = Date.now() - recordingStartedAtRef.current;
    const transcript = transcriptRef.current.trim();
    const recognizedEnglish = normalizeSpeakingText(transcript);
    let nextEvaluation: SpeakingPracticeEvaluation;

    if (recognitionErrorRef.current && !recognizedEnglish) {
      setEvaluation(null);
      setSpokenText("");
      setInterimText("");
      setRemainingSeconds(maxSeconds);
      setStatusText(recognitionErrorRef.current);
      hapticFeedback.error();
      window.setTimeout(() => onLayoutChange?.(), 90);
      return;
    }

    if (elapsedMs < 800) {
      nextEvaluation = {
        passed: false,
        score: 0,
        targetWords: [],
        spokenWords: [],
        missingKeywords: [],
        message: "I didn't hear enough. Hold a little longer and try again.",
      };
    } else if (!recognizedEnglish) {
      nextEvaluation = {
        passed: false,
        score: 0,
        targetWords: [],
        spokenWords: [],
        missingKeywords: [],
        message: timeoutHitRef.current
          ? "Time is up. I didn't catch enough English."
          : "I didn't catch enough English. Try again.",
      };
    } else {
      nextEvaluation = evaluateSpeakingPractice({
        target: targetSentence,
        transcript,
        passScore,
        keywords: Array.isArray(step.keywords) ? step.keywords : undefined,
      });
    }

    setEvaluation(nextEvaluation);
    setSpokenText(transcript);
    setInterimText("");
    setRemainingSeconds(maxSeconds);
    chargeAttempt(nextEvaluation.passed);

    if (nextEvaluation.passed) {
      setCompleted(true);
      setStatusText("Passed!");
      hapticFeedback.success();
      playCorrectResponseSpeech({
        feedbackText: step.feedback || nextEvaluation.message,
        speechEnabled,
        onAudioPlay,
      });
    } else {
      setStatusText(nextEvaluation.message);
      hapticFeedback.error();
    }

    window.setTimeout(() => onLayoutChange?.(), 90);
  }, [
    chargeAttempt,
    clearRecordingTimers,
    maxSeconds,
    onLayoutChange,
    onAudioPlay,
    passScore,
    speechEnabled,
    step.feedback,
    step.keywords,
    targetSentence,
  ]);

  useEffect(() => {
    setIsSupported(Boolean(createEnglishSpeechRecognition()));
    return () => {
      clearRecordingTimers();
      recordingRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {}
    };
  }, [clearRecordingTimers]);

  const startRecording = useCallback(async () => {
    if (
      !isLatest ||
      completed ||
      isRecording ||
      permissionPendingRef.current
    ) {
      return;
    }

    const recognition = createEnglishSpeechRecognition();
    if (!recognition) {
      setStatusText(
        "This device does not support speech recognition yet. Try it on iOS/Safari or Chrome.",
      );
      setEvaluation(null);
      hapticFeedback.error();
      return;
    }

    permissionPendingRef.current = true;
    const microphonePermission = await requestMicrophoneAccess();
    permissionPendingRef.current = false;
    if (
      isMicrophonePermissionFailure(microphonePermission) &&
      microphonePermission.reason !== "unsupported"
    ) {
      setStatusText(getMicrophonePermissionMessage(microphonePermission, "en"));
      setEvaluation(null);
      hapticFeedback.error();
      return;
    }

    void stopSpeech();
    clearRecordingTimers();
    try {
      recognitionRef.current?.abort();
    } catch {}

    transcriptRef.current = "";
    timeoutHitRef.current = false;
    finalizedRef.current = false;
    recordingRef.current = true;
    recognitionErrorRef.current = null;
    recognitionRef.current = recognition;
    recordingStartedAtRef.current = Date.now();
    setSpokenText("");
    setInterimText("");
    setEvaluation(null);
    setStatusText("Listening...");
    setRemainingSeconds(maxSeconds);
    setIsRecording(true);
    hapticFeedback.light();

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript || "";
        if (result?.isFinal) {
          finalText += `${text} `;
        } else {
          interim += `${text} `;
        }
      }
      const combined = `${finalText}${interim}`.trim();
      transcriptRef.current = combined;
      setSpokenText(finalText.trim());
      setInterimText(interim.trim());
    };

    recognition.onerror = (event: any) => {
      if (event?.error === "aborted") return;
      const message =
        event?.error === "not-allowed" ||
        event?.error === "service-not-allowed"
          ? "Microphone permission is blocked."
          : event?.error === "network"
            ? "Speech recognition needs network access right now."
            : event?.error === "audio-capture"
              ? "I can't access the microphone."
              : "I couldn't hear clearly. Try again.";
      recognitionErrorRef.current = message;
      setStatusText(message);
    };

    recognition.onend = () => {
      if (recordingRef.current) {
        finishRecording();
      }
    };

    try {
      recognition.start();
    } catch {
      recordingRef.current = false;
      setIsRecording(false);
      setStatusText("Speech recognition did not start. Try again.");
      hapticFeedback.error();
      return;
    }

    timeoutRef.current = setTimeout(() => {
      timeoutHitRef.current = true;
      try {
        recognition.stop();
      } catch {
        finishRecording();
      }
    }, maxSeconds * 1000);

    countdownRef.current = setInterval(() => {
      const elapsedSeconds = Math.floor(
        (Date.now() - recordingStartedAtRef.current) / 1000,
      );
      setRemainingSeconds(Math.max(0, maxSeconds - elapsedSeconds));
    }, 200);
  }, [
    clearRecordingTimers,
    completed,
    finishRecording,
    isLatest,
    isRecording,
    maxSeconds,
  ]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !recognitionRef.current) return;
    setStatusText("Checking...");
    try {
      recognitionRef.current.stop();
    } catch {
      finishRecording();
    }
  }, [finishRecording, isRecording]);

  const skipSpeakingPractice = useCallback(() => {
    if (!isLatest || completed) return;

    clearRecordingTimers();
    recordingRef.current = false;
    finalizedRef.current = true;
    setIsRecording(false);
    setInterimText("");
    setStatusText("Skipped.");
    try {
      recognitionRef.current?.abort();
    } catch {}
    hapticFeedback.light();
    onCorrect?.();
  }, [clearRecordingTimers, completed, isLatest, onCorrect]);

  const replayTarget = useCallback(() => {
    if (isRecording) return;
    onAudioPlay?.();
    void speakText(targetSentence, { role: "question", lang: "en-US" });
  }, [isRecording, onAudioPlay, targetSentence]);

  const liveText = [spokenText, interimText].filter(Boolean).join(" ").trim();
  const scorePercent = evaluation ? Math.round(evaluation.score * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[22px] bg-gradient-to-br from-indigo-50 to-sky-50 border-2 border-sky-100 p-5 text-center">
        <button
          type="button"
          onClick={replayTarget}
          disabled={isRecording}
          className="mx-auto mb-3 w-12 h-12 rounded-full bg-white text-sky-500 flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50"
        >
          <Volume2 className="w-6 h-6" strokeWidth={2.7} />
        </button>
        <p className="text-stone-500 text-[13px] font-black mb-2">
          大声跟读这句话
        </p>
        <p className="text-stone-900 text-[21px] leading-snug font-black">
          <SpeechProgressText text={targetSentence} />
        </p>
        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-sky-500">
          {Math.round(passScore * 100)}% pass · max {maxSeconds}s
        </p>
      </div>

      <div className="rounded-[20px] border-2 border-stone-100 bg-white p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-black uppercase tracking-[0.12em] text-stone-400">
            Heard
          </span>
          <span
            className={`text-[12px] font-black ${
              isRecording ? "text-rose-500" : "text-stone-400"
            }`}
          >
            {isRecording ? `${remainingSeconds}s` : `${scorePercent}%`}
          </span>
        </div>
        <div className="min-h-[48px] rounded-[16px] bg-stone-50 px-3 py-2.5 text-[14px] font-bold leading-relaxed text-stone-700">
          {liveText || spokenText || (
            <span className="text-stone-400">
              Your English will appear here...
            </span>
          )}
        </div>
        {isRecording && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100">
            <motion.div
              className="h-full rounded-full bg-rose-500"
              initial={{ width: "100%" }}
              animate={{
                width: `${Math.max(0, (remainingSeconds / maxSeconds) * 100)}%`,
              }}
              transition={{ duration: 0.18 }}
            />
          </div>
        )}
      </div>

      {evaluation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 rounded-[16px] text-[14px] font-bold border ${
            evaluation.passed
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {evaluation.passed ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={3} />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={3} />
            )}
            <div>
              <p>
                {evaluation.passed
                  ? (
                    <SpeechProgressText text={step.feedback || evaluation.message} />
                  ) : (
                    <SpeechProgressText
                      text={step.feedback_wrong || evaluation.message}
                    />
                  )}
              </p>
              {!evaluation.passed && (
                <p className="mt-1 text-[12px] opacity-80">
                  Similarity: {scorePercent}%
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {completed ? (
        <button
          onClick={onCorrect}
          className="w-full bg-[#58CC02] text-white py-3.5 rounded-[16px] font-black text-[16px] shadow-[0_4px_0_#58a700] active:translate-y-[4px] active:shadow-none transition-all"
        >
          继续
        </button>
      ) : isRecording ? (
        <>
          <button
            type="button"
            onClick={skipSpeakingPractice}
            disabled={!isLatest}
            className="mx-auto -mb-1 text-[12px] font-bold text-stone-400 underline decoration-dotted underline-offset-4 active:text-stone-600 disabled:opacity-45"
          >
            现在不做口语题
          </button>
          <button
            onClick={stopRecording}
            disabled={!isLatest}
            className="w-full bg-rose-500 text-white py-3.5 rounded-[16px] font-black text-[16px] shadow-[0_4px_0_#be123c] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
          >
            <Square className="h-5 w-5 fill-white" strokeWidth={2.7} />
            结束录音
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={skipSpeakingPractice}
            disabled={!isLatest}
            className="mx-auto -mb-1 text-[12px] font-bold text-stone-400 underline decoration-dotted underline-offset-4 active:text-stone-600 disabled:opacity-45"
          >
            现在不做口语题
          </button>
          <button
            onClick={startRecording}
            disabled={!isLatest || !isSupported}
            className="w-full bg-[#1CB0F6] text-white py-3.5 rounded-[16px] font-black text-[16px] shadow-[0_4px_0_#1899D6] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-45 flex items-center justify-center gap-2"
          >
            {evaluation ? (
              <RotateCcw className="h-5 w-5" strokeWidth={2.7} />
            ) : (
              <Mic className="h-5 w-5" strokeWidth={2.7} />
            )}
            {evaluation ? "再试一次" : "开始跟读"}
          </button>
          <p className="text-center text-[12px] font-bold text-stone-400">
            {isSupported ? statusText : "当前浏览器不支持语音识别"}
          </p>
        </div>
      )}
    </div>
  );
};

export const ChatQuestionMatching = ({
  step,
  onCorrect,
  onMistake,
  onAnswerResult,
  isLatest,
  onLayoutChange,
}: any) => {
  const [leftSelection, setLeftSelection] = useState<number | null>(null);
  const [rightSelection, setRightSelection] = useState<number | null>(null);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [wrongEffect, setWrongEffect] = useState(false);
  const [wrongLeftIds, setWrongLeftIds] = useState<number[]>([]);
  const [wrongRightIds, setWrongRightIds] = useState<number[]>([]);

  const { leftItems, rightItems } = useMemo(() => {
    const left = step.pairs
      .map((p: any) => ({ id: p.id, content: p.image }))
      .sort(() => Math.random() - 0.5);
    const right = step.pairs
      .map((p: any) => ({ id: p.id, content: p.word }))
      .sort(() => Math.random() - 0.5);
    return { leftItems: left, rightItems: right };
  }, [step]);

  useEffect(() => {
    if (leftSelection !== null && rightSelection !== null) {
      if (leftSelection === rightSelection) {
        setMatchedIds((prev) => [...prev, leftSelection]);
        hapticFeedback.light();
        setLeftSelection(null);
        setRightSelection(null);
        if (matchedIds.length + 1 === step.pairs.length) {
          hapticFeedback.success();
          onAnswerResult?.(true);
          window.setTimeout(() => onLayoutChange?.(), 90);
        }
      } else {
        setWrongEffect(true);
        setWrongLeftIds((prev) =>
          prev.includes(leftSelection) ? prev : [...prev, leftSelection],
        );
        setWrongRightIds((prev) =>
          prev.includes(rightSelection) ? prev : [...prev, rightSelection],
        );
        hapticFeedback.error();
        onAnswerResult?.(false);
        onMistake(step);
        window.setTimeout(() => onLayoutChange?.(), 90);
        setTimeout(() => {
          setWrongEffect(false);
          setWrongLeftIds([]);
          setWrongRightIds([]);
          setLeftSelection(null);
          setRightSelection(null);
        }, 800);
      }
    }
  }, [
    leftSelection,
    matchedIds.length,
    onAnswerResult,
    onLayoutChange,
    onMistake,
    rightSelection,
    step,
    step.pairs.length,
  ]);

  const isAllMatched = matchedIds.length === step.pairs.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-2">
          {leftItems.map((item: any) => {
            const isMatched = matchedIds.includes(item.id);
            const isSelected = leftSelection === item.id;
            const isWrongMarked = wrongLeftIds.includes(item.id);
            return (
              <motion.button
                key={`l-${item.id}`}
                disabled={isMatched || wrongEffect || !isLatest}
                onClick={() => !isMatched && setLeftSelection(item.id)}
                className={`h-[56px] rounded-[16px] border-2 font-bold text-[15px] flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                  isMatched
                    ? "bg-emerald-50 border-emerald-200 text-emerald-400 opacity-50 shadow-none"
                    : isSelected
                      ? wrongEffect && rightSelection !== null
                        ? "bg-red-100 border-red-500 text-red-900 animate-shake"
                        : "bg-amber-100 border-amber-500 text-amber-900 shadow-md"
                      : isWrongMarked
                        ? "bg-red-50 border-red-400 text-red-800"
                      : "bg-white border-stone-200 text-stone-700 hover:border-[#1CB0F6]"
                }`}
              >
                {item.content}
              </motion.button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {rightItems.map((item: any) => {
            const isMatched = matchedIds.includes(item.id);
            const isSelected = rightSelection === item.id;
            const isWrongMarked = wrongRightIds.includes(item.id);
            return (
              <motion.button
                key={`r-${item.id}`}
                disabled={isMatched || wrongEffect || !isLatest}
                onClick={() => !isMatched && setRightSelection(item.id)}
                className={`h-[56px] rounded-[16px] border-2 font-black italic text-[15px] flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                  isMatched
                    ? "bg-emerald-50 border-emerald-200 text-emerald-400 opacity-50 shadow-none"
                    : isSelected
                      ? wrongEffect
                        ? "bg-red-100 border-red-500 text-red-900 animate-shake"
                        : "bg-amber-100 border-amber-500 text-amber-900 shadow-md"
                      : isWrongMarked
                        ? "bg-red-50 border-red-400 text-red-800"
                      : "bg-white border-stone-200 text-stone-600 hover:border-[#1CB0F6]"
                }`}
              >
                {item.content}
              </motion.button>
            );
          })}
        </div>
      </div>

      {isAllMatched && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          <button
            onClick={onCorrect}
            className="w-full bg-[#58CC02] text-white py-3.5 rounded-[16px] font-black text-[16px] shadow-[0_4px_0_#58a700] active:translate-y-[4px] active:shadow-none transition-all"
          >
            继续
          </button>
        </motion.div>
      )}
    </div>
  );
};
