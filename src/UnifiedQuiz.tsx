import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, CheckCircle2 } from "lucide-react";

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
  } catch (e) {}
};

const playDuolingoSuccess = () => {
  playTone(523.25, "sine", 0.15); // C5
  setTimeout(() => playTone(659.25, "sine", 0.25), 100); // E5
};

const playDuolingoReward = () => {
  playTone(440, "sine", 0.1);
  setTimeout(() => playTone(554.37, "sine", 0.1), 100);
  setTimeout(() => playTone(659.25, "sine", 0.1), 200);
  setTimeout(() => playTone(880, "sine", 0.3), 300);
};

const hapticFeedback = {
  light: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    playTone(800, "sine", 0.05, 0.02);
  },
  success: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
    playDuolingoSuccess();
  },
  error: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }
    playTone(150, "sawtooth", 0.2, 0.15);
  },
  reward: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
    playDuolingoReward();
  },
};

export const TypewriterText = ({
  text,
  isLatest,
  delay = 30,
}: {
  text?: string | null;
  isLatest: boolean;
  delay?: number;
}) => {
  const safeText = typeof text === "string" ? text : "";
  const [displayedText, setDisplayedText] = useState(isLatest ? "" : safeText);

  useEffect(() => {
    if (!isLatest) {
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
  }, [safeText, isLatest, delay]);

  return <>{displayedText}</>;
};

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
  } = props;

  const [script, setScript] = useState<any[]>(items || []);
  const [visibleSteps, setVisibleSteps] = useState<number[]>([0]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [visibleSteps]);

  useEffect(() => {
    if (items && items.length > 0) {
      setScript(items);
    } else if (lessonId) {
      // Map lessonId directly to episode if possible, otherwise clamp to 1-4
      let episodeNum = lessonId;
      if (episodeNum > 4) episodeNum = 4; // Since we only generated 1-4
      
      import(`./data/config/episode_${episodeNum}.json`)
        .then((module) => {
          setScript(module.steps || module.default.steps);
        })
        .catch((err) => {
          console.error(`Failed to load episode ${episodeNum}:`, err);
        });
    }
  }, [lessonId, items]);

  useImperativeHandle(ref, () => ({
    skipToLast: () => {},
  }));

  const currentStepIndex = visibleSteps[visibleSteps.length - 1];

  useEffect(() => {
    if (script.length === 0) return;
    const latest = script[currentStepIndex];
    const isInteractive = (step: any) =>
      step.type === "question" || step.type === "interactive";
    if (latest && !isInteractive(latest)) {
      const text = latest.text || latest.text_en || "";
      const textCn = latest.text_cn || "";
      const maxLen = Math.max(text.length, textCn.length);
      const animationTime = maxLen * 40;

      const timer = setTimeout(() => {
        handleNext();
      }, animationTime + 500);

      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, script]);

  if (script.length === 0)
    return (
      <div className="flex-1 flex items-center justify-center font-bold text-stone-500">
        Loading story...
      </div>
    );

  const handleNext = () => {
    if (currentStepIndex < script.length - 1) {
      setVisibleSteps((prev) => [...prev, currentStepIndex + 1]);
    } else {
      onComplete(50, 10, 0);
    }
  };

  const isInteractive = (step: any) =>
    step.type === "question" || step.type === "interactive";
  const latestStep = script[currentStepIndex];

  const renderChatMessage = (step: any, index: number) => {
    const isLatest = index === currentStepIndex;
    const isYou = step.speaker === "You" || step.avatar === "you";

    if (step.type === "narrator") {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center my-6 w-full px-4"
        >
          <div className="bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-[16px] text-center max-w-[90%]">
            <span className="text-white font-bold text-[14px] leading-snug">
              <TypewriterText
                text={step.text || step.text_en || step.text_cn}
                isLatest={isLatest}
                delay={40}
              />
            </span>
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
                  <p className="font-bold text-[16px] whitespace-pre-wrap leading-snug">
                    <TypewriterText
                      text={step.text || step.text_en}
                      isLatest={isLatest}
                      delay={40}
                    />
                  </p>
                  {step.text_cn && (
                    <p
                      className={`mt-1.5 text-[14px] font-medium opacity-90 ${isYou ? "text-blue-100" : "text-stone-500"}`}
                    >
                      <TypewriterText
                        text={step.text_cn}
                        isLatest={isLatest}
                        delay={40}
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
              <div className="w-full max-w-[95%] bg-white/95 backdrop-blur-xl rounded-[24px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-white">
                {step.format === "multiple_choice" ||
                step.format === "translation" ||
                (!step.format && step.options) ? (
                  <ChatQuestionMultipleChoice
                    step={step}
                    onCorrect={handleNext}
                    onMistake={(s: any) => props.onMistake?.(s)}
                    isLatest={isLatest}
                  />
                ) : step.format === "matching" ? (
                  <ChatQuestionMatching
                    step={step}
                    onCorrect={handleNext}
                    onMistake={(s: any) => props.onMistake?.(s)}
                    isLatest={isLatest}
                  />
                ) : null}
              </div>
            ) : (
              <div className="bg-emerald-50 text-emerald-700 border-2 border-emerald-200 px-5 py-3.5 rounded-[20px] text-[15px] font-black flex items-center gap-2.5 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                已回答完毕
              </div>
            )}
          </motion.div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative w-full font-sans overflow-hidden">
      {/* Background Image filling the entire area */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none w-full h-full">
        {background === "none" ? null : (
          <img
            src={background || "/assets/cafeishineibeijing.png"}
            className="w-full h-full object-cover opacity-90"
          />
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
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white shadow-sm shrink-0">
          <Zap className="w-4 h-4 text-sky-500 fill-sky-400" />
          <span className="font-black text-[14px] text-sky-700">{stamina}</span>
        </div>
      </div>

      {/* Main Flowing WeChat-style Chat */}
      <div className="relative z-30 flex-1 w-full bg-transparent overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-20 scroll-smooth">
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
  isLatest,
}: any) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleSelect = (idx: number, correct: boolean) => {
    if (isCorrect) return; // Prevent clicking after correct
    setSelectedIdx(idx);

    if (correct) {
      setIsCorrect(true);
      hapticFeedback.success();
    } else {
      setIsCorrect(false);
      hapticFeedback.error();
      onMistake(step);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {step.options.map((opt: any, idx: number) => {
        const isSelected = selectedIdx === idx;
        let btnCls =
          "bg-white border-2 border-stone-200 text-stone-700 hover:border-[#1CB0F6] shadow-sm";

        if (isSelected) {
          if (isCorrect === true) {
            btnCls =
              "bg-emerald-100 border-2 border-emerald-500 text-emerald-800";
          } else if (isCorrect === false) {
            btnCls = "bg-red-100 border-2 border-red-500 text-red-800";
          }
        } else if (isCorrect === true && opt.is_correct) {
          btnCls = "bg-emerald-50 border-2 border-emerald-300 text-emerald-600";
        }

        return (
          <button
            key={idx}
            disabled={isCorrect === true || !isLatest}
            onClick={() => handleSelect(idx, opt.is_correct)}
            className={`w-full text-left p-3.5 rounded-[16px] flex items-center transition-all active:scale-[0.98] ${btnCls}`}
          >
            {opt.label && (
              <span
                className={`w-8 h-8 rounded-[10px] ${isSelected && isCorrect === true ? "bg-emerald-500/20 text-emerald-700" : isSelected && isCorrect === false ? "bg-red-500/20 text-red-700" : "bg-black/5"} flex items-center justify-center font-black text-[14px] mr-3.5 shrink-0 transition-colors`}
              >
                {opt.label}
              </span>
            )}
            <span className="font-bold text-[15px] leading-snug">
              {opt.text}
            </span>
          </button>
        );
      })}

      {isCorrect && step.feedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 bg-emerald-50 text-emerald-700 p-3.5 rounded-[16px] text-[14px] font-bold border border-emerald-200 shadow-sm"
        >
          {step.feedback}
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

export const ChatQuestionMatching = ({
  step,
  onCorrect,
  onMistake,
  isLatest,
}: any) => {
  const [leftSelection, setLeftSelection] = useState<number | null>(null);
  const [rightSelection, setRightSelection] = useState<number | null>(null);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [wrongEffect, setWrongEffect] = useState(false);

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
        }
      } else {
        setWrongEffect(true);
        hapticFeedback.error();
        onMistake(step);
        setTimeout(() => {
          setWrongEffect(false);
          setLeftSelection(null);
          setRightSelection(null);
        }, 800);
      }
    }
  }, [leftSelection, rightSelection, matchedIds.length, step.pairs.length]);

  const isAllMatched = matchedIds.length === step.pairs.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-2">
          {leftItems.map((item: any) => {
            const isMatched = matchedIds.includes(item.id);
            const isSelected = leftSelection === item.id;
            return (
              <button
                key={`l-${item.id}`}
                disabled={isMatched || wrongEffect || !isLatest}
                onClick={() => !isMatched && setLeftSelection(item.id)}
                className={`h-[56px] rounded-[16px] border-2 font-bold text-[15px] flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                  isMatched
                    ? "bg-emerald-50 border-emerald-200 text-emerald-400 opacity-50 shadow-none"
                    : isSelected
                      ? wrongEffect && rightSelection !== null
                        ? "bg-red-100 border-red-500 text-red-900"
                        : "bg-amber-100 border-amber-500 text-amber-900 shadow-md"
                      : "bg-white border-stone-200 text-stone-700 hover:border-[#1CB0F6]"
                }`}
              >
                {item.content}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {rightItems.map((item: any) => {
            const isMatched = matchedIds.includes(item.id);
            const isSelected = rightSelection === item.id;
            return (
              <button
                key={`r-${item.id}`}
                disabled={isMatched || wrongEffect || !isLatest}
                onClick={() => !isMatched && setRightSelection(item.id)}
                className={`h-[56px] rounded-[16px] border-2 font-black italic text-[15px] flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                  isMatched
                    ? "bg-emerald-50 border-emerald-200 text-emerald-400 opacity-50 shadow-none"
                    : isSelected
                      ? wrongEffect
                        ? "bg-red-100 border-red-500 text-red-900"
                        : "bg-amber-100 border-amber-500 text-amber-900 shadow-md"
                      : "bg-white border-stone-200 text-stone-600 hover:border-[#1CB0F6]"
                }`}
              >
                {item.content}
              </button>
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
