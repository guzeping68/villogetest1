/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence, useMotionValue } from "motion/react";
import { UnifiedQuiz, UnifiedQuizRef } from "./UnifiedQuiz";
import { getApiUrl } from "./utils/api";
import { ReviewScreen } from "./ReviewScreen";
import { ConfigBubble } from "./components/ConfigBubble";
import tasksConfig from "./data/config/tasks.json";
import lessonsConfig from "./data/config/lessons.json";
import preLessonStoriesConfig from "./data/config/pre_lesson_stories.json";
import buildingsConfig from "./data/config/buildings.json";
import decorationsConfig from "./data/config/decorations.json";
import guideDialoguesConfig from "./data/config/guide_dialogues.json";
import onboardingConfig from "./data/config/onboarding.json";
import resourcesConfig from "./data/config/resources.json";
import { AiSpeakingPractice } from "./AiSpeakingPractice";
import {
  ArrowBigDown,
  ArrowDown,
  ShoppingBag,
  Lamp,
  Sofa,
  Table,
  Apple,
  Banana,
  Tv,
  Coffee,
  Gamepad,
  Book,
  Smartphone,
  Sun,
  Cake,
  Car,
  Plus,
  Image as ImageIcon,
  Map as MapIcon,
  User,
  Users,
  ChevronDown,
  ChevronsDown,
  ChevronRight,
  Plane,
  Home,
  GraduationCap,
  Briefcase,
  Smile,
  MoreHorizontal,
  ArrowRight,
  Circle,
  CheckCircle2,
  ArrowRightLeft,
  Mic,
  Volume2,
  RotateCcw,
  Box,
  Layers,
  Palette,
  Clock,
  Wrench,
  Heart,
  MessageCircle,
  Aperture,
  Camera,
  Sparkles,
} from "lucide-react";

import { AiCustomQuizScreen } from "./AiCustomQuizScreen";

const isDraggingSceneGlobalRef = { current: false };

const EXTERIOR_TASKS = tasksConfig.tasks
  .sort((a, b) => a.sort_order - b.sort_order)
  .map((t) => ({
    title: t.title,
    rewardImage: t.reward_image,
    taskId: t.task_id,
    linkedLessonId: t.linked_lesson_id,
    ...t,
  }));

const PLAYER_ID_PATTERN = /^[A-Z]{4}$/;

const normalizePlayerId = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

const LoadingDots = () => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      setDots((p) => (p.length >= 3 ? "" : p + "."));
    }, 400);
    return () => clearInterval(t);
  }, []);
  return <span className="inline-block w-5 text-left">{dots}</span>;
};

const SignalBars = ({ level }: { level: 1 | 2 | 3 }) => {
  return (
    <div className="flex items-end gap-[3px] h-5">
      <div
        className={`w-[5px] h-[40%] rounded-sm ${level >= 1 ? "bg-[#1CB0F6]" : "bg-stone-200"}`}
      />
      <div
        className={`w-[5px] h-[70%] rounded-sm ${level >= 2 ? "bg-[#1CB0F6]" : "bg-stone-200"}`}
      />
      <div
        className={`w-[5px] h-[100%] rounded-sm ${level >= 3 ? "bg-[#1CB0F6]" : "bg-stone-200"}`}
      />
    </div>
  );
};

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

// Vibration utility for mobile feedback
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
  reward: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
    playDuolingoReward();
  },
};

const StarIcon = ({
  fillRatio,
  pureGold,
}: {
  fillRatio: number;
  pureGold?: boolean;
}) => (
  <svg
    width={pureGold ? "24" : "14"}
    height={pureGold ? "24" : "14"}
    viewBox="0 0 24 24"
    fill="none"
    stroke={pureGold ? "#B8860B" : "none"}
    strokeWidth={pureGold ? "0.5" : "0"}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id={`star-fill-${fillRatio}-${pureGold}`}
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop
          offset={`${fillRatio * 100}%`}
          stopColor={pureGold ? "#FFE600" : "#eab308"}
        />
        <stop offset={`${fillRatio * 100}%`} stopColor="#e7e5e4" />
      </linearGradient>
    </defs>
    <path
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
      fill={`url(#star-fill-${fillRatio}-${pureGold})`}
    />
  </svg>
);

const ALL_QUIZ_ITEMS = [
  { id: 1, name: "Banana", Icon: Banana },
  { id: 2, name: "Apple", Icon: Apple },
  { id: 3, name: "Sofa", Icon: Sofa },
  { id: 4, name: "Lamp", Icon: Lamp },
  { id: 5, name: "Window", image: "/assets/window.png" },
  { id: 6, name: "Box", image: "/assets/box.png" },
  { id: 7, name: "Basket", image: "/assets/basket.png" },
  { id: 8, name: "Drawer", image: "/assets/drawer.png" },
  { id: 9, name: "Dusty", image: "/assets/dusty.png" },
  { id: 10, name: "Coffee", Icon: Coffee },
  { id: 11, name: "Table", image: "/assets/jianglichaji.png" },
  { id: 12, name: "Rug", image: "/assets/renwujinagliditan.png" },
  { id: 13, name: "Photo_Wall", Icon: ImageIcon },
  { id: 14, name: "Plant", Icon: ShoppingBag },
  { id: 15, name: "Roof", Icon: Wrench },
  { id: 16, name: "Paint", Icon: Palette },
  { id: 17, name: "Clock", Icon: Clock },
];

const DecorationMarker = ({
  label,
  top,
  left,
  isPlaced,
  onClick,
  active = true,
}: {
  label: string;
  top: string;
  left: string;
  isPlaced: boolean;
  onClick?: () => void;
  active?: boolean;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: isPlaced ? 0 : 0.01, scale: isPlaced ? 0 : 1 }}
      className={`absolute z-30 flex flex-col items-center gap-1 cursor-pointer group ${active ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{ top, left }}
      onPointerUp={(e) => {
        if (!isDraggingSceneGlobalRef.current) {
          onClick?.();
        }
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center border-4 border-white shadow-lg"
      >
        <Plus className="w-6 h-6 text-amber-900" />
      </motion.div>
      <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-white text-[10px] font-bold">{label}</span>
      </div>
    </motion.div>
  );
};

const CoordinateGridOverlay = () => {
  return (
    <div className="absolute inset-0 z-[99] pointer-events-none select-none overflow-hidden">
      {/* Horizontal guide lines at 5% steps */}
      {Array.from({ length: 19 }).map((_, i) => {
        const percent = (i + 1) * 5;
        const isMajor = percent % 10 === 0;
        return (
          <div
            key={`h-line-${percent}`}
            className={`absolute left-0 right-0 border-t ${
              isMajor ? "border-dashed border-sky-400/25" : "border-dotted border-sky-300/15"
            } flex justify-between items-start`}
            style={{ top: `${percent}%` }}
          >
            <span className={`font-mono text-[7px] select-none rounded-br px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              Y: {percent}%
            </span>
            <span className={`font-mono text-[7px] select-none rounded-bl px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              Y: {percent}%
            </span>
          </div>
        );
      })}

      {/* Vertical guide lines at 5% steps */}
      {Array.from({ length: 19 }).map((_, i) => {
        const percent = (i + 1) * 5;
        const isMajor = percent % 10 === 0;
        const px = Math.round(900 * (percent / 100));
        return (
          <div
            key={`v-line-${percent}`}
            className={`absolute top-0 bottom-0 border-l ${
              isMajor ? "border-dashed border-sky-400/25" : "border-dotted border-sky-300/15"
            } flex flex-col justify-between items-center`}
            style={{ left: `${percent}%` }}
          >
            <span className={`font-mono text-[7px] select-none rounded-b text-center leading-tight px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              X: {percent}%{isMajor && <span className="text-[5.5px] block">({px}px)</span>}
            </span>
            <span className={`font-mono text-[7px] select-none rounded-t text-center leading-tight px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              X: {percent}%{isMajor && <span className="text-[5.5px] block">({px}px)</span>}
            </span>
          </div>
        );
      })}

      {/* Grid intersection coordinate cards for high fidelity measurement */}
      {Array.from({ length: 19 }).map((_, r) => {
        const rowPercent = (r + 1) * 5;
        const rMajor = rowPercent % 10 === 0;
        return Array.from({ length: 19 }).map((_, c) => {
          const colPercent = (c + 1) * 5;
          const cMajor = colPercent % 10 === 0;
          const isBothMajor = rMajor && cMajor;
          return (
            <div
              key={`dot-${rowPercent}-${colPercent}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-0.5"
              style={{ top: `${rowPercent}%`, left: `${colPercent}%` }}
            >
              <div className={`rounded-full relative ${
                isBothMajor ? "w-1.5 h-1.5 bg-sky-500/50" : "w-1 h-1 bg-sky-300/30"
              }`}>
                <div className={`absolute w-3 h-[1px] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isBothMajor ? "bg-sky-500/30" : "bg-sky-300/10"
                }`} />
                <div className={`absolute h-3 w-[1px] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isBothMajor ? "bg-sky-500/30" : "bg-sky-300/10"
                }`} />
              </div>
              <span className={`font-mono text-[5.5px] select-none absolute top-1.5 scale-[0.85] whitespace-nowrap px-0.5 rounded ${
                isBothMajor 
                  ? "text-sky-600 font-bold bg-white/80 border border-sky-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" 
                  : "text-sky-400 bg-white/50 scale-[0.75]"
              }`}>
                {colPercent},{rowPercent}
              </span>
            </div>
          );
        });
      })}
    </div>
  );
};

const GUESS_LEVELS = [
  { word: "SUNNY", hint: "It describes the weather~" },
  { word: "TODAY", hint: "It represents a date~" },
  { word: "NURSE", hint: "A profession that cares for people in a hospital~" },
  { word: "TIGER", hint: "A large fierce feline animal~" },
];

const WordGuessGame = ({
  onComplete,
  onFail,
}: {
  onComplete: () => void;
  onFail: () => void;
}) => {
  const { word: targetWord, hint: initialHint } = useMemo(() => {
    return GUESS_LEVELS[Math.floor(Math.random() * GUESS_LEVELS.length)];
  }, []);

  const WORD_LENGTH = targetWord.length;
  const MAX_ATTEMPTS = 4;

  const [attempts, setAttempts] = useState<string[][]>(
    Array(MAX_ATTEMPTS).fill(Array(WORD_LENGTH).fill("")),
  );
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [grandmaSay, setGrandmaSay] = useState<string | null>(initialHint);
  const [successRow, setSuccessRow] = useState<number | null>(null);

  // Keyboard letters (10 letters)
  const letters = useMemo(() => {
    const chars = new Set(targetWord.split(""));
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const alphabetArray = alphabet.split("").sort(() => Math.random() - 0.5);
    for (const char of alphabetArray) {
      if (chars.size >= 10) break;
      chars.add(char);
    }
    return Array.from(chars).sort(() => Math.random() - 0.5);
  }, [targetWord]);

  const handleKeyPress = (letter: string) => {
    if (currentAttempt >= MAX_ATTEMPTS || successRow !== null) return;

    const newAttempts = [...attempts.map((row) => [...row])];
    const currentRow = newAttempts[currentAttempt];

    // Find first empty cell
    const emptyIndex = currentRow.findIndex((char) => char === "");
    if (emptyIndex !== -1) {
      currentRow[emptyIndex] = letter;
      setAttempts(newAttempts);

      // Auto check if row is full
      if (emptyIndex === WORD_LENGTH - 1) {
        checkRow(currentRow, currentAttempt);
      }
    }
  };

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    if (rowIndex !== currentAttempt || successRow !== null) return;
    const newAttempts = [...attempts.map((row) => [...row])];
    newAttempts[rowIndex][colIndex] = "";
    setAttempts(newAttempts);
  };

  const checkRow = (row: string[], rowIndex: number) => {
    const word = row.join("");
    if (word === targetWord) {
      setGrandmaSay("Too smart, couldn't stump you!");
      setSuccessRow(rowIndex);
      setTimeout(onComplete, 2000);
    } else {
      if (currentAttempt + 1 >= MAX_ATTEMPTS) {
        setGrandmaSay("Sigh, you ran out of chances...");
        setTimeout(onFail, 1500);
      } else {
        setGrandmaSay("Not quite, try again!");
        setCurrentAttempt((prev) => prev + 1);
      }
    }
  };

  const getCellStatus = (
    rowIndex: number,
    colIndex: number,
    char: string,
  ): "correct" | "present" | "absent" | "empty" | "current" => {
    if (!char) return "empty";
    if (rowIndex > currentAttempt && successRow === null) return "empty";
    if (rowIndex === currentAttempt && successRow === null) return "current";

    if (char === targetWord[colIndex]) {
      return "correct";
    } else if (targetWord.includes(char)) {
      return "present";
    } else {
      return "absent";
    }
  };

  return (
    <div className="flex-1 flex flex-col pointer-events-none relative w-full h-full">
      {/* 老奶奶小气泡 */}
      <div className="absolute top-[-100px] left-8 flex items-end gap-3 z-50 pointer-events-none">
        <div className="relative">
          <AnimatePresence>
            {grandmaSay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                className="absolute bottom-full left-4 mb-2 whitespace-nowrap"
              >
                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-lg border-2 border-amber-100 flex items-center justify-center">
                  <span className="text-amber-900 font-black text-sm italic">
                    {grandmaSay}
                  </span>
                </div>
                {/* 小尾巴 */}
                <div className="absolute left-0 bottom-[-6px] w-4 h-4 bg-white border-b-2 border-l-2 border-amber-100 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl bg-amber-50 overflow-hidden">
            <img
              src="/assets/buntouxiang.png"
              alt="Grandmother"
              className="w-full h-full object-cover -scale-x-100"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 flex flex-col items-center justify-start gap-8 pointer-events-auto">
        <div className="flex flex-col gap-4">
          {attempts.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex gap-3">
              {row.map((char, colIndex) => {
                const status = getCellStatus(rowIndex, colIndex, char);

                let bgClass = "bg-white";
                let textClass = "text-stone-700";
                let borderClass = "border-stone-200";

                if (status === "correct") {
                  bgClass = "bg-emerald-500";
                  borderClass = "border-emerald-600";
                  textClass = "text-white";
                } else if (status === "present") {
                  bgClass = "bg-amber-400";
                  borderClass = "border-amber-500";
                  textClass = "text-white";
                } else if (status === "absent") {
                  bgClass = "bg-stone-300";
                  borderClass = "border-stone-400";
                  textClass = "text-white";
                } else if (status === "current") {
                  borderClass = "border-amber-500";
                  textClass = "text-amber-700";
                }

                // Give it a shadow if it's the current target cell
                const isTargetCell =
                  rowIndex === currentAttempt && !char && successRow === null;
                const shadowClass = isTargetCell
                  ? "shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  : "";

                // Animate completion bounce
                const isSuccessAnim = successRow === rowIndex;

                return (
                  <motion.div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`w-14 h-14 rounded-xl border-4 text-2xl font-black flex items-center justify-center cursor-pointer transition-colors duration-300
                      ${bgClass} ${textClass} ${borderClass} ${shadowClass}
                    `}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    animate={
                      isSuccessAnim
                        ? { y: [0, -15, 0] }
                        : char && status === "current"
                          ? { scale: [1.2, 1] }
                          : { scale: 1 }
                    }
                    transition={
                      isSuccessAnim
                        ? {
                            duration: 0.5,
                            delay: colIndex * 0.1,
                            ease: "easeOut",
                          }
                        : { duration: 0.2 }
                    }
                  >
                    {char}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm mt-8">
          <div className="grid grid-cols-5 gap-2">
            {letters.map((letter) => {
              // Determine keyboard letter status (most exact match across submitted rows)
              let keyStatus = "empty";
              if (successRow !== null || currentAttempt > 0) {
                const subAttempts = attempts.slice(
                  0,
                  successRow !== null ? successRow + 1 : currentAttempt,
                );
                const allUsedChars = subAttempts.flat();
                if (allUsedChars.includes(letter)) {
                  // check if any of the used are 'correct'
                  let isCorrect = false;
                  subAttempts.forEach((row) => {
                    row.forEach((c, idx) => {
                      if (c === letter && targetWord[idx] === letter) {
                        isCorrect = true;
                      }
                    });
                  });

                  if (isCorrect) {
                    keyStatus = "correct";
                  } else if (targetWord.includes(letter)) {
                    keyStatus = "present";
                  } else {
                    keyStatus = "absent";
                  }
                }
              }

              let keyBgClass =
                "bg-white border-stone-200 text-stone-600 active:bg-stone-100";
              if (keyStatus === "correct") {
                keyBgClass = "bg-emerald-500 border-emerald-600 text-white";
              } else if (keyStatus === "present") {
                keyBgClass = "bg-amber-400 border-amber-500 text-white";
              } else if (keyStatus === "absent") {
                keyBgClass = "bg-stone-300 border-stone-400 text-stone-100";
              }

              return (
                <motion.button
                  key={letter}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`h-12 border-2 rounded-xl font-black text-xl shadow-sm disabled:opacity-50 transition-colors ${keyBgClass}`}
                  onClick={() => handleKeyPress(letter)}
                  disabled={
                    currentAttempt >= MAX_ATTEMPTS || successRow !== null
                  }
                >
                  {letter}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuizGame = ({
  level,
  onComplete,
  onFail,
}: {
  level: number;
  onComplete: () => void;
  onFail: () => void;
}) => {
  const [leftSelection, setLeftSelection] = useState<number | null>(null);
  const [rightSelection, setRightSelection] = useState<number | null>(null);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [wrongEffect, setWrongEffect] = useState<boolean>(false);
  const [lines, setLines] = useState<
    { id: number; x1: number; y1: number; x2: number; y2: number }[]
  >([]);
  const [mistakes, setMistakes] = useState(0);
  const [grandmaSay, setGrandmaSay] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const rightRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const compliments = [
    "Awesome!",
    "So smart!",
    "Good job!",
    "Great memory!",
    "Very quick!",
    "Keep it up!",
  ];

  // 为每个关卡选择 5 个随机项目
  const currentItems = useMemo(() => {
    // 使用 level 作为种子来保证关卡内的项目一致，或者完全随机
    const shuffled = [...ALL_QUIZ_ITEMS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }, [level]);

  const leftItems = useMemo(
    () => [...currentItems].sort(() => Math.random() - 0.5),
    [currentItems],
  );
  const rightItems = useMemo(
    () => [...currentItems].sort(() => Math.random() - 0.5),
    [currentItems],
  );

  const calculateLinePositions = (id: number) => {
    if (!containerRef.current) return null;
    const lEl = leftRefs.current.get(id);
    const rEl = rightRefs.current.get(id);
    if (!lEl || !rEl) return null;

    const cRect = containerRef.current.getBoundingClientRect();
    const lRect = lEl.getBoundingClientRect();
    const rRect = rEl.getBoundingClientRect();

    return {
      id,
      x1: lRect.right - cRect.left,
      y1: lRect.top + lRect.height / 2 - cRect.top,
      x2: rRect.left - cRect.left,
      y2: rRect.top + rRect.height / 2 - cRect.top,
    };
  };

  useEffect(() => {
    if (leftSelection !== null && rightSelection !== null) {
      if (leftSelection === rightSelection) {
        const newLine = calculateLinePositions(leftSelection);
        if (newLine) {
          setLines((prev) => [...prev, newLine]);
        }
        setMatchedIds((prev) => [...prev, leftSelection]);

        // 老奶奶夸奖
        const randomMsg =
          compliments[Math.floor(Math.random() * compliments.length)];
        setGrandmaSay(randomMsg);
        setTimeout(() => setGrandmaSay(null), 1500);

        setLeftSelection(null);
        setRightSelection(null);
      } else {
        setWrongEffect(true);
        setMistakes((prev) => prev + 1);
        const timer = setTimeout(() => {
          setWrongEffect(false);
          setLeftSelection(null);
          setRightSelection(null);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [leftSelection, rightSelection]);

  useEffect(() => {
    if (mistakes >= 3) {
      onFail();
    }
  }, [mistakes, onFail]);

  useEffect(() => {
    if (matchedIds.length === 5) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [matchedIds, onComplete]);

  return (
    <div className="flex-1 flex flex-col pointer-events-none relative">
      {/* 老奶奶小气泡提示区 */}
      <div className="absolute top-[-100px] left-8 flex items-end gap-3 z-50 pointer-events-none">
        <div className="relative">
          <AnimatePresence>
            {grandmaSay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                className="absolute bottom-full left-4 mb-2 whitespace-nowrap"
              >
                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-lg border-2 border-amber-100 flex items-center justify-center">
                  <span className="text-amber-900 font-black text-sm italic">
                    {grandmaSay}
                  </span>
                </div>
                {/* 小尾巴 */}
                <div className="absolute left-0 bottom-[-6px] w-4 h-4 bg-white border-b-2 border-l-2 border-amber-100 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl bg-amber-50 overflow-hidden">
            <img
              src="/assets/buntouxiang.png"
              alt="Grandmother"
              className="w-full h-full object-cover -scale-x-100"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* 游戏主体 */}
      <div className="flex-1 px-8 py-4 flex flex-col justify-center gap-4 pointer-events-auto">
        <div
          ref={containerRef}
          className="grid grid-cols-2 gap-x-12 relative h-[450px]"
        >
          {/* SVG 连接线图层 */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <svg className="w-full h-full overflow-visible">
              <AnimatePresence>
                {lines.map((line) => (
                  <motion.line
                    key={`line-${line.id}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                ))}
              </AnimatePresence>
            </svg>
          </div>

          {/* 左侧图标列 */}
          <div className="flex flex-col justify-around">
            {leftItems.map((item) => {
              const isMatched = matchedIds.includes(item.id);
              const isSelected = leftSelection === item.id;
              return (
                <motion.button
                  key={`left-${item.id}`}
                  ref={(el) => {
                    if (el) leftRefs.current.set(item.id, el);
                  }}
                  disabled={isMatched || (wrongEffect && isSelected)}
                  onClick={() => !isMatched && setLeftSelection(item.id)}
                  className={`relative group w-20 h-20 rounded-3xl flex items-center justify-center border-2 transition-all duration-300 z-10 
                    ${
                      isMatched
                        ? "bg-emerald-50 border-emerald-500"
                        : isSelected
                          ? wrongEffect
                            ? "bg-red-100 border-red-500 animate-shake"
                            : "bg-amber-100 border-amber-500 scale-105"
                          : "bg-white border-amber-900/10 hover:border-amber-500/50"
                    }`}
                >
                  {item.Icon ? (
                    <item.Icon
                      className={`w-10 h-10 ${isMatched ? "text-stone-300" : "text-stone-700"}`}
                    />
                  ) : item.image ? (
                    <img
                      src={item.image}
                      className="w-14 h-14 object-contain translate-y-[2px]"
                      alt={item.name}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </motion.button>
              );
            })}
          </div>

          {/* 右侧单词列 */}
          <div className="flex flex-col justify-around">
            {rightItems.map((item) => {
              const isMatched = matchedIds.includes(item.id);
              const isRightSelected = rightSelection === item.id;
              return (
                <motion.button
                  key={`right-${item.id}`}
                  ref={(el) => {
                    if (el) rightRefs.current.set(item.id, el);
                  }}
                  disabled={isMatched || (wrongEffect && isRightSelected)}
                  onClick={() => !isMatched && setRightSelection(item.id)}
                  className={`relative h-14 w-full rounded-2xl flex items-center justify-center border-2 font-black italic tracking-wide transition-all duration-300 z-10
                    ${
                      isMatched
                        ? "bg-emerald-50 border-emerald-500 text-white"
                        : isRightSelected
                          ? wrongEffect
                            ? "bg-red-100 border-red-500 text-red-700 animate-shake"
                            : "bg-amber-100 border-amber-500 text-amber-700 scale-105 shadow-lg"
                          : "bg-white border-amber-900/10 text-stone-600 hover:border-amber-500/50"
                    }`}
                >
                  {item.name}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* 错误提示 / 生命值 */}
        <div className="mt-8 flex justify-center gap-2">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i < 3 - mistakes ? 1 : 0,
                opacity: i < 3 - mistakes ? 1 : 0,
              }}
              className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SpeechBubble = ({
  text,
  icon,
  show,
  onClick,
}: {
  text?: string;
  icon?: string;
  show: boolean;
  onClick?: () => void;
}) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 5 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col items-center z-[100] w-48 ${onClick ? "cursor-pointer pointer-events-auto" : "pointer-events-none"}`}
      >
        <div className="relative flex flex-col items-center">
          {/* 1. 最顶层内容 (z-20) */}
          <div className="relative z-20 p-3 flex items-center justify-center min-w-[60px]">
            {text && (
              <p className="text-[11px] font-bold text-neutral-800 text-center leading-relaxed px-2">
                {text}
              </p>
            )}
            {icon && (
              <img
                src={icon}
                alt="icon"
                className="w-8 h-8 object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* 2. 中间层气泡主体 qipao1 (z-10) */}
          <img
            src="/assets/qipao1.png"
            alt=""
            className="absolute inset-0 w-full h-full z-10"
            style={{ objectFit: "fill" }}
            referrerPolicy="no-referrer"
          />

          {/* 3. 最底层气泡箭头 qipao2 (z-0) */}
          <img
            src="/assets/qipao2.png"
            alt=""
            className="w-4 h-4 -mb-3 relative z-0"
            style={{ marginTop: "-8px" }}
            referrerPolicy="no-referrer"
          />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const TypewriterText = ({ text, onComplete, speed = 80, onWordTyped }: { text: string, onComplete?: () => void, speed?: number, onWordTyped?: () => void }) => {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const words = useMemo(() => text.split(" "), [text]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  
  const onWordTypedRef = useRef(onWordTyped);
  onWordTypedRef.current = onWordTyped;
  
  useEffect(() => {
    let i = 0;
    setDisplayedWords([]);
    const interval = setInterval(() => {
      setDisplayedWords(words.slice(0, i + 1));
      i++;
      onWordTypedRef.current?.();
      if (i >= words.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [words, speed]);
  return <span className="whitespace-pre-wrap">{displayedWords.join(" ")}</span>;
}

const ChatMessage = ({ sender, name, avatarBg, avatarImg, align, children, borderColor }: any) => {
  const isRight = align === 'right';
  
  // npc: Orange stroke (#F97316), me/player: Blue stroke (#2563EB)
  const strokeColor = isRight ? '#2563EB' : '#F97316';

  return (
    <div className={`flex w-full ${isRight ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex gap-3 max-w-[85%] ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar Plate Wrapper */}
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
          {/* Bottom Background Plate (qitatouxiangdi/zhujuetouxiangdi) */}
          <img 
            src={avatarBg} 
            className="absolute inset-0 w-full h-full object-contain" 
            referrerPolicy="no-referrer" 
          />
          {/* Top Avatar Face (npc1/zhujue1) */}
          <img 
            src={avatarImg} 
            className="absolute w-[68%] h-[68%] object-contain rounded-full" 
            style={{ top: '10%' }} 
            referrerPolicy="no-referrer" 
          />
          {/* Name Label centered over the bottom yellow region of the plate */}
          <div 
            className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 text-[#4E2B02] text-[9.5px] font-black uppercase whitespace-nowrap tracking-wide leading-none select-none" 
            style={{ transform: 'translateX(-50%)', zIndex: 12 }}
          >
            {name}
          </div>
        </div>
        
        {/* Dialogue Bubble */}
        <div 
          className="relative px-5 py-3 bg-white border-[3px] rounded-[20px] shadow-sm text-stone-800 font-bold text-sm leading-relaxed"
          style={{ borderColor: strokeColor }}
        >
          {children}
          {/* Outer Triangle Pointer (border matching bubble) */}
          <div 
            className={`absolute top-[14px] ${isRight ? '-right-[10px] border-l-[10px] border-y-transparent border-y-[8px]' : '-left-[10px] border-r-[10px] border-y-transparent border-y-[8px]'} w-0 h-0 z-0`} 
            style={isRight ? { borderLeftColor: strokeColor } : { borderRightColor: strokeColor }}
          />
          {/* Inner Triangle Pointer (white background overlay) */}
          <div className={`absolute top-[17px] ${isRight ? '-right-[5px] border-l-white border-l-[6px] border-y-transparent border-y-[6px]' : '-left-[5px] border-r-white border-r-[6px] border-y-transparent border-y-[6px]'} w-0 h-0 z-10`} />
        </div>
      </div>
    </div>
  );
}

const ONBOARDING_TITLES = [
  "LingoVille",
  "The most fun way to learn",
  "What language would you like to learn?",
  "Preferred App language?",
  "How much Spanish do you know?",
  "Why are you learning Spanish?",
  "I'm crafting your personalized journey",
  "Your learning journey is OK!",
  "Perfect!",
];

const SPOKEN_LANGUAGES = [
  { flag: "🇺🇸", name: "American English" },
  { flag: "🇬🇧", name: "British English" },
  { flag: "🇪🇸", name: "Spanish" },
  { flag: "🇫🇷", name: "French" },
  { flag: "🇩🇪", name: "German" },
  { flag: "🇯🇵", name: "Japanese" },
  { flag: "🇨🇳", name: "Chinese" },
  { flag: "🇮🇹", name: "Italian" },
  { flag: "🇰🇷", name: "Korean" },
  { flag: "🇷🇺", name: "Russian" },
];

const SceneryAnimations = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
      {/* Airplane */}
      <motion.div
        className="absolute top-[18%]"
        initial={{ left: "-30%" }}
        animate={{ left: "130%" }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: "linear",
          delay: 2,
        }}
      >
        <span className="text-4xl filter drop-shadow-sm opacity-80 inline-block scale-x-[-1]">
          ✈️
        </span>
      </motion.div>

      {/* Another Airplane delayed */}
      <motion.div
        className="absolute top-[12%]"
        initial={{ right: "-30%" }}
        animate={{ right: "130%" }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: "linear",
          delay: 15,
        }}
      >
        <span className="text-3xl filter drop-shadow-sm opacity-60 -rotate-[15deg] inline-block">
          ✈️
        </span>
      </motion.div>

      {/* Pigeon 1 */}
      <motion.div
        className="absolute top-[35%]"
        initial={{ left: "-20%", y: 0 }}
        animate={{ left: "120%", y: [-20, 20, -20] }}
        transition={{
          left: { duration: 25, repeat: Infinity, ease: "linear", delay: 5 },
          y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <span className="text-2xl filter drop-shadow opacity-90 inline-block scale-x-[-1]">
          🕊️
        </span>
      </motion.div>

      {/* Pigeon 2 */}
      <motion.div
        className="absolute top-[28%]"
        initial={{ right: "-20%", y: 0 }}
        animate={{ right: "120%", y: [15, -15, 15] }}
        transition={{
          right: { duration: 28, repeat: Infinity, ease: "linear", delay: 10 },
          y: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <span className="text-xl filter drop-shadow opacity-80 inline-block">
          🕊️
        </span>
      </motion.div>
    </div>
  );
};

export default function App() {
  const appRootRef = useRef<HTMLDivElement>(null);
  const sceneX = useMotionValue(0);
  const [joystickState, setJoystickState] = useState<{
    origin: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const joystickDelta = useRef(0);
  const rAFRef = useRef<number>();
  const [activeTab, setActiveTab] = useState<"town" | "profile" | "ai_course">(
    "town",
  );
  const [aiPracticeCategory, setAiPracticeCategory] = useState<string | null>(
    null,
  );
  const [scene, setScene] = useState<"exterior" | "interior">("exterior");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [diamonds, setDiamonds] = useState(0);
  const [stamina, setStamina] = useState(25);
  const [showTasks, setShowTasks] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showReferenceGrid, setShowReferenceGrid] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showLevelConfirm, setShowLevelConfirm] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showDialogueFlow, setShowDialogueFlow] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showVictoryMsg, setShowVictoryMsg] = useState(false);
  const [showWinStreak, setShowWinStreak] = useState(false);
  const [showBuildingUpgrade, setShowBuildingUpgrade] = useState(false);
  const [showNewTaskBubble, setShowNewTaskBubble] = useState(false);
  const [showGrannyExclamation, setShowGrannyExclamation] = useState(false);
  const [dismissedCardPhase, setDismissedCardPhase] = useState(0);
  const [animatingCompletedPhase, setAnimatingCompletedPhase] = useState<
    number | null
  >(null);
  const [isGrandmaIntroShown, setIsGrandmaIntroShown] = useState(false); // New state to control initial visibility
  const [winStreakNumber, setWinStreakNumber] = useState(1);

  // 新增：餐厅解锁相关状态
  const [isRestaurantUnlocked, setIsRestaurantUnlocked] = useState(false);
  const [showRestaurantUnlockDialogue, setShowRestaurantUnlockDialogue] =
    useState(false);
  const [isRestaurantFalling, setIsRestaurantFalling] = useState(false);
  const [victoryDialogueStep, setVictoryDialogueStep] = useState(0);
  const [showTownTabArrow, setShowTownTabArrow] = useState(false);
  const [userMistakes, setUserMistakes] = useState<any[]>([]);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingCarouselIdx, setOnboardingCarouselIdx] = useState(0);
  const [selectedLang, setSelectedLang] = useState("Spanish");
  const [spokenLang, setSpokenLang] = useState({
    flag: "🇺🇸",
    name: "American English",
  });
  const [isSelectLangDropdownOpen, setIsSelectLangDropdownOpen] =
    useState(false);
  const [knowledgeLevel, setKnowledgeLevel] = useState("Not very much");
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [nativeLang, setNativeLang] = useState("English");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [step1Progress, setStep1Progress] = useState(0);
  const [introStep, setIntroStep] = useState(0);
  const [preOnboardingName, setPreOnboardingName] = useState("");
  const [appUserId, setAppUserId] = useState<string | null>(() => {
    try {
      const stored = (localStorage.getItem("app_user_id") || "").trim().toUpperCase();
      return PLAYER_ID_PATTERN.test(stored) ? stored : null;
    } catch {
      return null;
    }
  });
  const [nameRegistrationStatus, setNameRegistrationStatus] = useState<
    "idle" | "checking" | "loading"
  >("idle");
  const [nameInputError, setNameInputError] = useState<string | null>(null);
  const [existingPlayerIdPrompt, setExistingPlayerIdPrompt] = useState<
    string | null
  >(null);
  const [preOnboardingDialogueStep, setPreOnboardingDialogueStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onboardingStep === 10) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [onboardingStep, preOnboardingDialogueStep]);

  const [preLevel2State, setPreLevel2State] = useState(0); // 0: initial, 1: recording, 2: success
  const [preLevel2IsPlaying, setPreLevel2IsPlaying] = useState(false);

  // New states for Step 2 and Step 3 custom animations
  const [step2Phase, setStep2Phase] = useState(0);
  const [step3Phase, setStep3Phase] = useState(0);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (step2Phase >= 1 && step2Phase <= 5) {
      t = setTimeout(() => {
        setStep2Phase(prev => prev + 1);
      }, 400); // Wait 400ms per word
    }
    return () => clearTimeout(t);
  }, [step2Phase]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (onboardingStep === 2) {
      setStep2Phase(0);
    } else if (onboardingStep === 3) {
      setStep3Phase(0);
      let p = 0;
      t = setInterval(() => {
        p++;
        if (p <= 4) setStep3Phase(p);
      }, 1000); // 1s per phase
    }
    return () => clearInterval(t);
  }, [onboardingStep]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (onboardingStep === 1) {
      setStep1Progress(0);
      const interval = 20; // 20ms per tick
      const duration = 2000; // 2 seconds total
      const steps = duration / interval;
      let currentProgress = 0;

      t = setInterval(() => {
        currentProgress += 100 / steps;
        if (currentProgress >= 100) {
          setStep1Progress(100);
          clearInterval(t);
        } else {
          setStep1Progress(Math.floor(currentProgress));
        }
      }, interval);
    }
    return () => clearInterval(t);
  }, [onboardingStep]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (onboardingStep === 7) {
      setLoadingProgress(0);
      const interval = 30; // 30ms per tick
      const duration = 4000; // 4 seconds total
      const steps = duration / interval;
      let currentProgress = 0;

      t = setInterval(() => {
        currentProgress += 100 / steps;
        if (currentProgress >= 100) {
          setLoadingProgress(100);
          clearInterval(t);
        } else {
          setLoadingProgress(Math.floor(currentProgress));
        }
      }, interval);
    }
    return () => clearInterval(t);
  }, [onboardingStep]);

  useEffect(() => {
    if (onboardingStep === 12) {
      const t1 = setTimeout(() => setIntroStep(4), 10);
      return () => {
        clearTimeout(t1);
      };
    }
  }, [onboardingStep]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (introStep === 5) {
      t = setTimeout(() => setShowGuideArrow(true), 500);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [introStep]);

  const [showTopCard, setShowTopCard] = useState(false);

  useEffect(() => {
    if (introStep >= 5) {
      setShowTopCard(true);
    } else {
      setShowTopCard(false);
    }
  }, [introStep]);

  // 小镇重建事件状态
  const [townEventStep, setTownEventStep] = useState(0); // 0: None, 1: Dialogue 1, 2: Building Fall, 3: Dialogue 2, 4: Dialogue 3, 5: Guide to Chapters
  const [houseImage, setHouseImage] = useState("/assets/home1home-1.png");
  const prevHouseImageRef = useRef(houseImage);
  const isFirstTimeImage = houseImage !== prevHouseImageRef.current;

  useEffect(() => {
    prevHouseImageRef.current = houseImage;
  }, [houseImage]);
  const [hasSeenTownEvent, setHasSeenTownEvent] = useState(false);
  const [isDiamondFlying, setIsDiamondFlying] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{
    title: string;
    id: number;
    status: string;
  } | null>(null);
  const [activeBubbleId, setActiveBubbleId] = useState<number | null>(null);
  const [zoomingToLevel, setZoomingToLevel] = useState<{
    id: number;
    x: string;
    y: number;
  } | null>(null);
  const [quizIndex, setQuizIndex] = useState(1);
  const [postLesson1DialogueStep, setPostLesson1DialogueStep] = useState(0);
  const [postCoffeeDiagShown, setPostCoffeeDiagShown] = useState(false);

  const [showSocial, setShowSocial] = useState(false);
  const [showSocialCreate, setShowSocialCreate] = useState(false);
  const [socialDraft, setSocialDraft] = useState("");
  const [socialPosts, setSocialPosts] = useState([
    {
      id: 1,
      author: "Bun",
      avatar: "/assets/BunNPC.png",
      content: "Just opened my new cafe! Come and get some fresh coffee ☕️",
      likes: 12,
      isLiked: false,
      comments: [],
      timestamp: "2 hours ago",
    },
  ]);
  const [socialReward, setSocialReward] = useState<{
    fans: number;
    customers: number;
  } | null>(null);
  const [guideSocialStep, setGuideSocialStep] = useState(0);

  useEffect(() => {
    if (
      quizIndex === 2 &&
      townEventStep === 5 &&
      scene === "exterior" &&
      postLesson1DialogueStep === 0 &&
      !postCoffeeDiagShown
    ) {
      const timer = setTimeout(() => {
        setPostLesson1DialogueStep(1);
        setPostCoffeeDiagShown(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [
    quizIndex,
    townEventStep,
    scene,
    postLesson1DialogueStep,
    postCoffeeDiagShown,
  ]);

  useEffect(() => {
    if (postLesson1DialogueStep === 4) {
      setGuideSocialStep(1);
      setPostLesson1DialogueStep(5);
    }
  }, [postLesson1DialogueStep]);

  const [showCourseOutline, setShowCourseOutline] = useState(false);
  const [showStarTooltip, setShowStarTooltip] = useState(false);
  const [flyingStarAnim, setFlyingStarAnim] = useState(false);
  const [pulsingStarIdx, setPulsingStarIdx] = useState<number | null>(null);
  const lastQuizIndexRef = useRef(quizIndex);
  const [fastForwardClicks, setFastForwardClicks] = useState(0);
  const fastForwardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quizRef = useRef<UnifiedQuizRef>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
    null,
  );
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const handleQuestionChange = useCallback((q: any) => {
    const nextId = q?.question_id || null;
    setCurrentQuestionId((prev) => (prev === nextId ? prev : nextId));
  }, []);

  const handleAudioPlay = useCallback(() => {
    setIsVideoMutedForQuestion(true);
  }, []);

  const handleQuizComplete = useCallback(() => {
    setShowQuiz(false);
    setShowVictory(true);
    setQuizIndex((prev) => Math.min(9, prev + 1));
  }, []);

  const handleQuizFail = useCallback(() => {
    setShowQuiz(false);
  }, []);

  const handleQuizMistake = useCallback((step: any) => {
    const lessonInfo =
      lessonsConfig.lessons.find((l: any) => l.lesson_id === quizIndex) ||
      lessonsConfig.lessons[0];
    
    setUserMistakes((prev) => {
      // Avoid duplicates based on instruction
      if (prev.some((m) => m.instruction === step.instruction)) return prev;
      return [...prev, { ...step, _lessonInfo: lessonInfo }];
    });
  }, [quizIndex]);

  useEffect(() => {
    if (currentQuestionId) {
      setIsVideoMutedForQuestion(false);
      setVideoSrc(`/media/${currentQuestionId}.png`);
    } else {
      setVideoSrc(null);
    }
  }, [currentQuestionId]);

  const handleVideoError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    if (!videoSrc || !currentQuestionId) return;

    // Default error handling for others
    e.currentTarget.style.display = "none";
    const parent = e.currentTarget.parentElement;
    if (parent && !parent.querySelector(".fallback-img")) {
      const img = document.createElement("img");
      img.src = "/assets/zhangjiebeijingtu.png";
      img.className =
        "absolute inset-0 w-full h-full object-cover fallback-img";
      parent.appendChild(img);
    }
  };

  const handleFastForward = () => {
    if (fastForwardTimerRef.current) clearTimeout(fastForwardTimerRef.current);

    setFastForwardClicks((prev) => {
      const newVal = prev + 1;
      if (newVal >= 2) {
        // Jump to last question
        if (quizRef.current) {
          quizRef.current.skipToLast();
          showMessage("Skipping to last question...");
        }
        return 0;
      }

      fastForwardTimerRef.current = setTimeout(() => {
        setFastForwardClicks(0);
      }, 2000);

      showMessage("Click again to skip");
      return newVal;
    });
  };

  const quizStep = quizIndex % 2 !== 0 ? "match" : "word";
  const MAX_STAMINA = 25;

  // 体力恢复逻辑：每5分钟恢复满（测试期间可以缩短，但按要求5分钟满）
  useEffect(() => {
    const timer = setInterval(
      () => {
        setStamina(MAX_STAMINA);
      },
      5 * 60 * 1000,
    ); // 5 minutes
    return () => clearInterval(timer);
  }, []);

  const [showStreakDraw, setShowStreakDraw] = useState(false);
  const [showStreakReward, setShowStreakReward] = useState(false);
  const [showWinStreak2, setShowWinStreak2] = useState(false);
  const [showGrannySofaDialogue, setShowGrannySofaDialogue] = useState(false);

  // 处理小镇重建事件
  useEffect(() => {
    if (townEventStep === 2) {
      const timer = setTimeout(() => {
        if (quizIndex === 2) {
          setHouseImage("/assets/home1home2-1.png");
        } else if (quizIndex === 6) {
          setHouseImage("/assets/lv2house-1.png");
        }
        // 等待建筑落下动画完成后进入下一步
        setTimeout(() => setTownEventStep(3), 1500);
      }, 500);
      return () => clearTimeout(timer);
    } else if (townEventStep === 3) {
      // 老奶奶头顶气泡显示3秒后，直接进入阶段5
      const timer = setTimeout(() => {
        setTownEventStep(5);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [townEventStep, quizIndex]);

  const [dialogueStep, setDialogueStep] = useState(0); // 0: Hide, 1: Granny, 2: Granny+NPC, 3: All
  const [showGuideArrow, setShowGuideArrow] = useState(false);

  useEffect(() => {
    if (guideSocialStep === 10) setShowGuideArrow(true);
  }, [guideSocialStep]);
  const [showInteriorGrannyExclamation, setShowInteriorGrannyExclamation] =
    useState(false);
  const [lastAnimatedLessonId, setLastAnimatedLessonId] = useState(1);
  const [hasNewTaskCompleted, setHasNewTaskCompleted] = useState(false);

  useEffect(() => {
    if (
      scene === "interior" &&
      !showVictory &&
      !showWinStreak &&
      !showWinStreak2 &&
      !showVictoryMsg &&
      !showBuildingUpgrade &&
      !showRestaurantUnlockDialogue &&
      !isTransitioning
    ) {
      if (quizIndex > lastQuizIndexRef.current) {
        lastQuizIndexRef.current = quizIndex;
        const completedLesson = lessonsConfig.lessons.find(
          (l) => l.lesson_id === quizIndex - 1,
        );
        const willGetFurniture =
          completedLesson?.reward_once?.type === "decoration" ||
          completedLesson?.reward_once?.type === "furniture";
        const delayForStar = 0; // Removed furniture-based delay

        // Trigger star flight
        setFlyingStarAnim(true);
        setTimeout(() => {
          setFlyingStarAnim(false);
          const currentStarIdx = Math.ceil((quizIndex - 1) / 2); // 1-based index of the star being lit
          setPulsingStarIdx(currentStarIdx);

          // Pop the START dialogue immediately after the star pulses
          setTimeout(() => {
            setPulsingStarIdx(null);
            setTimeout(() => {
              setShowLevelConfirm(true);
            }, 50); // Minimized UI reaction time
          }, 100); // 0.1s pulse time
        }, 1000); // 1.0s flight animation time
      }
    }
  }, [
    scene,
    quizIndex,
    showVictory,
    showWinStreak,
    showWinStreak2,
    showVictoryMsg,
    showBuildingUpgrade,
    showRestaurantUnlockDialogue,
    isTransitioning,
  ]);

  // Derived tasks from EXTERIOR_TASKS and quizIndex
  const currentTasks = useMemo(() => {
    // Show the tasks that haven't animated out yet, up to the current one
    return EXTERIOR_TASKS.map((task, idx) => ({
      ...task,
      id: idx + 1,
      lessonId: idx + 1,
      isCompleted: quizIndex > idx + 1,
      isActive: quizIndex === idx + 1,
    })).filter((task) => {
      // Show the task that is currently active,
      // or the one that just got completed but hasn't animated out yet.
      return (
        task.lessonId >= lastAnimatedLessonId && task.lessonId <= quizIndex
      );
    });
  }, [quizIndex, lastAnimatedLessonId]);

  // Handle task transition animation when modal is open
  useEffect(() => {
    if (showTasks && quizIndex > lastAnimatedLessonId) {
      // If we open the task menu and the latest completed lesson is ahead of what we last animated
      const timer = setTimeout(() => {
        setLastAnimatedLessonId(quizIndex);
      }, 1500); // Wait for the checkmark to be seen before sliding out
      return () => clearTimeout(timer);
    }
  }, [showTasks, quizIndex, lastAnimatedLessonId]);

  const [furniture, setFurniture] = useState<string[]>([]);

  const interiorContainerRef = useRef<HTMLDivElement>(null);
  const dragAreaRef = useRef<HTMLDivElement>(null);
  const [isDraggingScene, setIsDraggingScene] = useState(false);

  const townDragRef = useRef({
    isDragging: false,
    startX: 0,
    startSceneX: 0,
    startTime: 0,
    pointerId: -1,
    hasCaptured: false,
  });

  const onScenePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    townDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startSceneX: sceneX.get(),
      startTime: Date.now(),
      pointerId: e.pointerId,
      hasCaptured: false,
    };
    setIsDraggingScene(true);
    isDraggingSceneGlobalRef.current = false;
  };

  const onScenePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = townDragRef.current;
    if (!drag.isDragging || drag.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - drag.startX;
    const absDelta = Math.abs(deltaX);

    if (absDelta > 8) {
      isDraggingSceneGlobalRef.current = true;
      if (!drag.hasCaptured) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.hasCaptured = true;
        } catch (err) {
          console.warn("setPointerCapture failed", err);
        }
      }
    }

    let newX = drag.startSceneX + deltaX;
    const minX = sceneConstraints.left;
    const maxX = sceneConstraints.right;

    if (newX < minX) {
      newX = minX;
    } else if (newX > maxX) {
      newX = maxX;
    }

    sceneX.set(newX);
  };

  const onScenePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = townDragRef.current;
    if (!drag.isDragging || drag.pointerId !== e.pointerId) return;

    if (drag.hasCaptured) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        console.warn("releasePointerCapture failed", err);
      }
    }

    const deltaX = e.clientX - drag.startX;
    const duration = Date.now() - drag.startTime;
    const absDelta = Math.abs(deltaX);

    drag.isDragging = false;
    drag.pointerId = -1;
    drag.hasCaptured = false;
    setIsDraggingScene(false);

    const minX = sceneConstraints.left;
    const maxX = sceneConstraints.right;
    let finalX = sceneX.get();
    if (finalX < minX) {
      finalX = minX;
    } else if (finalX > maxX) {
      finalX = maxX;
    }

    sceneX.set(finalX);

    if (absDelta > 8 || duration > 300) {
      isDraggingSceneGlobalRef.current = true;
      setTimeout(() => {
        isDraggingSceneGlobalRef.current = false;
      }, 50);
    } else {
      isDraggingSceneGlobalRef.current = false;
    }
  };

  const [containerWidth, setContainerWidth] = useState(450);
  const [containerHeight, setContainerHeight] = useState(800);

  const [isInitializing, setIsInitializing] = useState(true);
  const [hasLoadedInitialProgress, setHasLoadedInitialProgress] = useState(false);

  const applyRemoteProgress = useCallback((data: any, fallbackUserId?: string) => {
    if (!data || Object.keys(data).length === 0) return;

    if (data.quizIndex !== undefined) {
      setQuizIndex(data.quizIndex);
      lastQuizIndexRef.current = data.quizIndex;
      setLastAnimatedLessonId(data.quizIndex);
    }
    if (data.townEventStep !== undefined) setTownEventStep(data.townEventStep);
    if (data.diamonds !== undefined) setDiamonds(data.diamonds);
    if (data.onboardingStep !== undefined) setOnboardingStep(data.onboardingStep);
    if (data.dismissedCardPhase !== undefined) setDismissedCardPhase(data.dismissedCardPhase);
    if (data.scene !== undefined) setScene(data.scene);
    if (data.furniture) setFurniture(data.furniture);
    if (data.isRestaurantUnlocked !== undefined) setIsRestaurantUnlocked(data.isRestaurantUnlocked);
    if (data.preOnboardingName !== undefined) {
      setPreOnboardingName(normalizePlayerId(data.preOnboardingName));
    } else if (fallbackUserId) {
      setPreOnboardingName(fallbackUserId);
    }
    if (data.preOnboardingDialogueStep !== undefined) {
      setPreOnboardingDialogueStep(data.preOnboardingDialogueStep);
    }
    if (Array.isArray(data.userMistakes)) setUserMistakes(data.userMistakes);
  }, []);

  useEffect(() => {
    const uid = appUserId;
    if (!uid) {
      try {
        const legacyUid = localStorage.getItem("app_user_id");
        if (legacyUid && !PLAYER_ID_PATTERN.test(legacyUid.trim().toUpperCase())) {
          localStorage.removeItem("app_user_id");
        }
      } catch (e) {
        console.error(e);
      }
      setIsInitializing(false);
      return;
    }

    fetch(getApiUrl("/api/progress/" + uid))
      .then(res => res.json())
      .then(data => {
        applyRemoteProgress(data, uid);
        setIsInitializing(false);
      })
      .catch(err => {
        console.error("Failed to load progress", err);
        setIsInitializing(false);
      });
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      setHasLoadedInitialProgress(true);
    }
  }, [isInitializing]);

  useEffect(() => {
    if (hasLoadedInitialProgress) {
      if (appUserId) {
        fetch(getApiUrl("/api/progress/" + appUserId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: appUserId,
            quizIndex,
            townEventStep,
            diamonds,
            onboardingStep,
            dismissedCardPhase,
            scene,
            furniture,
            isRestaurantUnlocked,
            preOnboardingName: appUserId,
            preOnboardingDialogueStep,
            userMistakes,
          })
        }).catch(err => console.error("Failed to save progress", err));
      }
    }
  }, [appUserId, quizIndex, townEventStep, diamonds, onboardingStep, dismissedCardPhase, scene, furniture, isRestaurantUnlocked, preOnboardingDialogueStep, userMistakes, hasLoadedInitialProgress]);

  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      const newWidth = w > 450 ? 450 : w;
      setContainerWidth(newWidth);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const sceneConstraints = useMemo(() => {
    const limit = 450 - containerWidth / 2;
    return { left: -limit, right: limit };
  }, [containerWidth]);

  // Smooth joystick scene panning
  useEffect(() => {
    if (activeTab === "town") {
      if (scene === "exterior") {
        sceneX.set(0);
      } else if (scene === "interior") {
        sceneX.set(450 - containerWidth / 2);
      }
    }
  }, [scene, activeTab, containerWidth, sceneX]);

  // 资源预加载
  useEffect(() => {
    const assets = [
      "/assets/BG2.png",
      "/assets/guanqia1bg.png",
      "/assets/cafeishineibeijing.png",
      "/assets/home1home-1.png",
      "/assets/home1home2-1.png",
      "/assets/BunNPC.png",
      "/assets/buntouxiang.png",
      "/assets/Amili.png",
      "/assets/Amilitouxiang.png",
      "/assets/cafeishineibeijing.png",
      "/assets/zairu.png",
      "/assets/qipao1.png",
      "/assets/qipao2.png",
      "/assets/start_low.png",
      "/assets/start_high.png",
      "/assets/renwudi.png",
      "/assets/renwu.png",
      "/assets/renwutishi.png",
      "/assets/youhappy.png",
      "/assets/youhappiness.png",
      "/assets/yousorrow.png",
      "/assets/youanger.png",
      "/assets/jackhappy.png",
      "/assets/jackhappiness.png",
      "/assets/jacksorrow.png",
      "/assets/jackanger.png",
      "/assets/MrsHendersonhappy.png",
      "/assets/MrsHendersonhappiness.png",
      "/assets/MrsHendersonsorrow.png",
      "/assets/MrsHendersonanger.png",
      "/assets/dingbuiconpng.png",
      "/assets/fanhui.png",
      "/assets/renwuguanbi.png",
      "/assets/renwuanniu.png",
      "/assets/renwudiban.png",
      "/assets/pojiuhome.png",
      "/assets/buntouxiang.png",
      "/assets/yindao.png",
      "/assets/tiaoguo.png",
      "/assets/datibg.png",
      "/assets/shenglibg.png",
      "/assets/npc.png",
      "/assets/car.png",
      "/assets/xiexin.png",
      "/assets/xinxiangzhuzi.png",
      "/assets/tanhao.png",
      "/assets/laonainaiqueren.png",
      "/assets/423anniu.png",
      "/assets/lianshengjiemian.png",
      "/assets/jianzhushengj.png",
      "/assets/xinrenwu.png",
      "/assets/1renwukapian.png",
      "/assets/shafajiangli.png",
      "/assets/shafa1.png",
    ];
    assets.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // 体力恢复逻辑：每5分钟恢复1点
  useEffect(() => {
    const recoveryInterval = setInterval(
      () => {
        setStamina((prev) => {
          if (prev < MAX_STAMINA) {
            return prev + 1;
          }
          return prev;
        });
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(recoveryInterval);
  }, []);

  // 胜利界面钻石飞出逻辑
  useEffect(() => {
    let flyTimer: NodeJS.Timeout;
    let hitTimer: NodeJS.Timeout;

    if (showVictory) {
      flyTimer = setTimeout(() => {
        setIsDiamondFlying(true);
        // 飞行持续 0.8s，结束后更新数量
        hitTimer = setTimeout(() => {
          setDiamonds((prev) => prev + 1);
        }, 800);
      }, 800);
    } else {
      setIsDiamondFlying(false);
    }

    return () => {
      clearTimeout(flyTimer);
      clearTimeout(hitTimer);
    };
  }, [showVictory]);

  const showMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const confirmNewPlayerId = async () => {
    const playerId = normalizePlayerId(preOnboardingName);
    setPreOnboardingName(playerId);
    setNameInputError(null);

    if (!PLAYER_ID_PATTERN.test(playerId)) {
      setNameInputError("请输入 4 个英文字母作为你的 ID。");
      return;
    }

    try {
      setNameRegistrationStatus("checking");
      const checkResp = await fetch(getApiUrl(`/api/users/${playerId}`));
      if (!checkResp.ok) throw new Error("check_failed");

      const checkData = await checkResp.json();
      if (checkData.exists) {
        setExistingPlayerIdPrompt(playerId);
        return;
      }

      const registerResp = await fetch(getApiUrl("/api/users/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: playerId,
          initialProgress: {
            playerId,
            quizIndex,
            townEventStep,
            diamonds,
            onboardingStep,
            dismissedCardPhase,
            scene,
            furniture,
            isRestaurantUnlocked,
            preOnboardingName: playerId,
            preOnboardingDialogueStep,
            userMistakes,
          },
        }),
      });

      if (registerResp.status === 409) {
        setExistingPlayerIdPrompt(playerId);
        return;
      }
      if (!registerResp.ok) throw new Error("register_failed");

      localStorage.setItem("app_user_id", playerId);
      setAppUserId(playerId);
      hapticFeedback.success?.();
      setPreOnboardingDialogueStep(3);
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      console.error("Failed to register player ID", err);
      setNameInputError("连接服务器失败，请检查网络后重试。");
    } finally {
      setNameRegistrationStatus("idle");
    }
  };

  const loadExistingPlayerId = async () => {
    if (!existingPlayerIdPrompt) return;

    try {
      setNameRegistrationStatus("loading");
      const playerId = existingPlayerIdPrompt;
      const resp = await fetch(getApiUrl(`/api/progress/${playerId}`));
      if (!resp.ok) throw new Error("load_failed");
      const data = await resp.json();

      localStorage.setItem("app_user_id", playerId);
      setAppUserId(playerId);
      applyRemoteProgress({ ...data, preOnboardingName: data.preOnboardingName || playerId }, playerId);
      setExistingPlayerIdPrompt(null);
      setNameInputError(null);
      showMessage(`已读取 ID ${playerId}`);
    } catch (err) {
      console.error("Failed to load player ID", err);
      setNameInputError("读取进度失败，请稍后再试。");
    } finally {
      setNameRegistrationStatus("idle");
    }
  };

  const rejectExistingPlayerId = () => {
    hapticFeedback.light?.();
    setExistingPlayerIdPrompt(null);
    setPreOnboardingName("");
    setNameInputError("这个 ID 已被注册，请重新输入。");
  };

  const [isVideoMutedForQuestion, setIsVideoMutedForQuestion] = useState(false);
  const quizVideoRef = useRef<HTMLVideoElement>(null);

  // 控制对话流的步进 (使用 JSON 课前剧情)
  useEffect(() => {
    if (!showDialogueFlow) {
      setDialogueStep(0);
    }
  }, [showDialogueFlow, quizIndex]);

  const advanceDialogueFlow = () => {
    const currentStory =
      preLessonStoriesConfig.lessons.find((l) => l.lesson_id === quizIndex) ||
      preLessonStoriesConfig.lessons[0];
    if (dialogueStep < currentStory.dialogues.length) {
      setDialogueStep((prev) => prev + 1);
    }
  };

  const handleStartGame = () => {
    setShowGuideArrow(false);
    setShowGrannyExclamation(false);
    if (guideSocialStep === 10) setGuideSocialStep(11);

    const willFlyStar = quizIndex > lastQuizIndexRef.current;

    if (scene === "interior") {
      if (!willFlyStar) {
        setShowLevelConfirm(true);
      }
    } else {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setScene("interior");
      }, 720);
      setTimeout(() => {
        setIsTransitioning(false);
        if (!willFlyStar) {
          setShowLevelConfirm(true);
        }
      }, 1800);
    }
  };

  const handleExitBuilding = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    setTimeout(() => {
      setScene("exterior");
    }, 720);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 1800);
  };

  useEffect(() => {
    if (scene === "exterior" && !isTransitioning) {
      if (quizIndex === 2 && townEventStep < 5) {
        if (townEventStep === 3 && dismissedCardPhase < 1) {
          if (animatingCompletedPhase === null) {
            setAnimatingCompletedPhase(dismissedCardPhase);
            hapticFeedback.success();
            setShowTopCard(true);
            setTimeout(() => {
              setShowTopCard(false);
              setTimeout(() => {
                setDismissedCardPhase(1);
                setAnimatingCompletedPhase(null);
                setShowTopCard(true);
                setTimeout(() => {
                  // Do not pop up new task bubble on step 1
                }, 500);
              }, 600);
            }, 1000); // Wait 1 second before hiding so user sees completion state
          }
        }
      } else {
        const targetPhase = Math.min(quizIndex - 1, EXTERIOR_TASKS.length - 1);
        if (dismissedCardPhase < targetPhase) {
          if (animatingCompletedPhase === null) {
            setAnimatingCompletedPhase(dismissedCardPhase);
            hapticFeedback.success();
            setShowTopCard(true);
            setTimeout(() => {
              setShowTopCard(false);
              setTimeout(() => {
                setDismissedCardPhase(targetPhase);
                setAnimatingCompletedPhase(null);
                setShowTopCard(true);
                setTimeout(() => {
                  if (targetPhase > 1) {
                    setShowNewTaskBubble(true);
                    hapticFeedback.success();
                  }
                }, 500);
                setTimeout(() => {
                  if (targetPhase > 1) {
                    setShowNewTaskBubble(false);
                  }
                }, 5500);
              }, 600);
            }, 1000); // Wait 1 second before hiding
          }
        }
      }
    }
  }, [
    scene,
    isTransitioning,
    townEventStep,
    dismissedCardPhase,
    quizIndex,
    animatingCompletedPhase,
  ]);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#1a1a1a] overflow-hidden flex justify-center items-center">
      {/* 手机比例容器 */}
      <div
        ref={appRootRef}
        className="relative w-full max-w-[450px] aspect-[9/19.5] bg-neutral-800 shadow-2xl overflow-hidden md:rounded-[48px] md:border-[12px] border-neutral-900 font-sans"
      >
        {isInitializing && (
          <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a1a1a] text-white">
            <div className="w-12 h-12 border-4 border-t-[#22c55e] border-white/20 rounded-full animate-spin"></div>
            <p className="mt-4 font-bold text-lg text-neutral-300">Syncing progress...</p>
          </div>
        )}
        {/* 场景层容器 */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            {activeTab === "town" && (
              <motion.div
                key="town-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                {/* 核心场景层 */}
                <div className="absolute inset-0" ref={dragAreaRef}>
                  {/* 全局环境氛围图层 - 颗粒 */}
                  <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={`dust-${i}`}
                        initial={{
                          opacity: 0,
                          y: "100%",
                          x: Math.random() * 100 + "%",
                        }}
                        animate={{
                          y: "-10%",
                          opacity: [0, 0.3, 0],
                          x: [
                            `${Math.random() * 100}%`,
                            `${Math.random() * 100}%`,
                          ],
                        }}
                        transition={{
                          duration: 15 + Math.random() * 10,
                          repeat: Infinity,
                          ease: "linear",
                          delay: i * 2,
                        }}
                        className="absolute w-1 h-1 bg-white/30 rounded-full blur-[1px]"
                      />
                    ))}
                  </div>

                  {/* 户外场景 */}
                  <div
                    className={`absolute inset-0 transition-opacity duration-300 ${scene === "exterior" ? "opacity-100" : "opacity-0 pointer-events-none"} overflow-hidden`}
                  >
                    <motion.div
                      style={{ x: sceneX }}
                      className={`absolute inset-y-0 left-1/2 -ml-[450px] w-[900px] h-full select-none touch-pan-y ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                      onPointerDown={onScenePointerDown}
                      onPointerMove={onScenePointerMove}
                      onPointerUp={onScenePointerUp}
                    >
                      {/* 背景图层 - 增加微弱呼吸缩放 */}
                      <div className="absolute inset-0 z-0">
                        <img
                          data-scene-bg="true"
                          src="/assets/BG2.png"
                          alt="City Background"
                          className="w-full h-full object-cover select-none"
                          referrerPolicy="no-referrer"
                          draggable={false}
                        />
                      </div>

                      <SceneryAnimations />

                      {/* 户外 UI 层 - 调整位置，将建筑和装饰物向上移动以符合视觉比例 */}
                      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none translate-y-[2%]">
                        <div className="relative w-96 h-96 flex items-center justify-center scale-[0.8]">
                          {/* 建筑物可点击进入 - 增加进度高亮效果 */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onPointerUp={(e) => {
                              if (!isDraggingSceneGlobalRef.current) {
                                handleStartGame();
                              }
                            }}
                            className={`relative cursor-pointer group z-20 ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                          >
                            <AnimatePresence mode="popLayout">
                              <motion.img
                                key={houseImage}
                                initial={
                                  isFirstTimeImage &&
                                  (houseImage === "/assets/home1home2-1.png" ||
                                    houseImage === "/assets/lv2house-1.png")
                                    ? { y: -500, opacity: 0 }
                                    : { y: 0, opacity: 1 }
                                }
                                animate={{
                                  y: 0,
                                  opacity: 1,
                                  rotate: isFirstTimeImage
                                    ? [0, 5, -5, 3, -3, 0]
                                    : 0,
                                }}
                                transition={{
                                  y: {
                                    type: "spring",
                                    damping: 15,
                                    stiffness: 100,
                                    duration: 1,
                                  },
                                  rotate: { delay: 1, duration: 2.0 },
                                }}
                                src={houseImage}
                                alt="House"
                                className="max-w-full max-h-full object-contain relative z-10"
                                referrerPolicy="no-referrer"
                                draggable={false}
                              />
                            </AnimatePresence>

                            {/* Backyard Rewards - Decorations surrounding the house */}
                            {quizIndex > 6 && (
                              <motion.div
                                key={`cafeizhuo-${quizIndex > 6}`}
                                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                                animate={{
                                  opacity: [0, 1, 1],
                                  scale: [0, 1.8, 1],
                                  x: [0, 0, -100],
                                  y: [0, 0, -20],
                                }}
                                transition={{
                                  duration: 2,
                                  times: [0, 0.4, 1],
                                  ease: "easeInOut",
                                }}
                                className="absolute right-40 bottom-24 w-[60px] h-auto z-20 opacity-90"
                              >
                                <motion.img
                                  src="/assets/cafeizhuo.png"
                                  animate={{
                                    rotate: [
                                      0, 0, 10, -10, 8, -8, 5, -5, 3, -3, 0,
                                    ],
                                  }}
                                  transition={{ delay: 1.2, duration: 2.0 }}
                                  className="w-full h-auto"
                                  referrerPolicy="no-referrer"
                                />
                              </motion.div>
                            )}
                            {quizIndex > 7 && (
                              <motion.div
                                key={`bbq-${quizIndex > 7}`}
                                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                                animate={{
                                  opacity: [0, 1, 1],
                                  scale: [0, 1.8, 1],
                                  x: [0, 0, 160],
                                  y: [0, 0, 60],
                                }}
                                transition={{
                                  duration: 2,
                                  times: [0, 0.4, 1],
                                  ease: "easeInOut",
                                }}
                                className="absolute left-24 bottom-18 w-8 h-auto z-30 drop-shadow-md"
                              >
                                <motion.img
                                  src="/assets/bbq.png"
                                  animate={{
                                    rotate: [
                                      0, 0, 10, -10, 8, -8, 5, -5, 3, -3, 0,
                                    ],
                                  }}
                                  transition={{ delay: 1.2, duration: 2.0 }}
                                  className="w-full h-auto -scale-x-100"
                                  referrerPolicy="no-referrer"
                                />
                              </motion.div>
                            )}
                            {quizIndex > 8 && (
                              <motion.div
                                key={`pisajiao-${quizIndex > 8}`}
                                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                                animate={{
                                  opacity: [0, 1, 1],
                                  scale: [0, 1.8, 1],
                                  x: [0, 0, 0],
                                  y: [0, 0, -20],
                                }}
                                transition={{
                                  duration: 2,
                                  times: [0, 0.4, 1],
                                  ease: "easeInOut",
                                }}
                                className="absolute left-1/2 -translate-x-1/2 bottom-12 w-12 h-auto z-30 drop-shadow-md"
                              >
                                <motion.img
                                  src="/assets/pisajiao.png"
                                  animate={{
                                    rotate: [
                                      0, 0, 10, -10, 8, -8, 5, -5, 3, -3, 0,
                                    ],
                                  }}
                                  transition={{ delay: 1.2, duration: 2.0 }}
                                  className="w-full h-auto"
                                  referrerPolicy="no-referrer"
                                />
                              </motion.div>
                            )}

                            {/* Restaurant Building - Positioned on the right side below the table */}
                            {(isRestaurantUnlocked || isRestaurantFalling) && (
                              <motion.div
                                key="restaurant-land"
                                initial={
                                  isRestaurantFalling
                                    ? {
                                        opacity: 0,
                                        scale: 0.5,
                                        y: -200,
                                        x: 210,
                                      }
                                    : {
                                        opacity: 1,
                                        scale: 1.47,
                                        x: 230,
                                        y: 190,
                                      }
                                }
                                animate={{
                                  opacity: 1,
                                  scale: 1.47,
                                  x: 230,
                                  y: 190,
                                }}
                                transition={{
                                  duration: isRestaurantFalling ? 2 : 0.5,
                                  type: "spring",
                                  damping: 12,
                                  stiffness: 70,
                                }}
                                className="absolute top-1/2 left-1/2 -ml-40 -mt-40 w-80 h-80 pointer-events-none z-[110]"
                              >
                                <motion.div
                                  whileHover={{ scale: 1.05 }}
                                  animate={{
                                    rotate: isRestaurantFalling
                                      ? [0, 10, -10, 7, -7, 0]
                                      : 0,
                                  }}
                                  transition={{ delay: 1.8, duration: 2.0 }}
                                  className={`relative w-full h-full cursor-pointer group ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                                  onPointerUp={(e) => {
                                    if (!isDraggingSceneGlobalRef.current && !isRestaurantFalling) {
                                      setScene("interior");
                                    }
                                  }}
                                >
                                  <img
                                    src="/assets/canting.png"
                                    className="w-full h-full object-contain drop-shadow-2xl"
                                    referrerPolicy="no-referrer"
                                    draggable={false}
                                  />
                                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-4 py-1.5 rounded-full text-sm font-black opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-2 whitespace-nowrap shadow-xl border-2 border-amber-400">
                                    ENTER RESTAURANT
                                  </div>
                                </motion.div>
                              </motion.div>
                            )}

                            {(townEventStep === 0 || townEventStep === 5) && (
                              <>
                                {/* 引导点击效果 */}
                                <div className="absolute inset-0 bg-yellow-400/0 group-hover:bg-yellow-400/5 transition-colors duration-300 rounded-3xl z-20" />
                              </>
                            )}

                            {/* 引导箭头 */}
                            {showGuideArrow && (
                              <motion.div
                                className="absolute -top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none"
                                animate={{ y: [0, 10, 0] }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.6)] border-4 border-white">
                                  <ArrowBigDown
                                    className="w-6 h-6 text-white translate-y-[2px]"
                                    fill="currentColor"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </motion.div>

                          {/* 社交平台发帖后的路人 */}
                          <AnimatePresence>
                            {guideSocialStep >= 7 && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.8, type: "spring" }}
                                className="absolute bottom-12 right-24 w-32 h-20 pointer-events-none z-30 drop-shadow-xl"
                              >
                                <img
                                  src="/assets/xingrentu.png"
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* 玩家从大巴下车后停留在场景中 */}
                          <AnimatePresence>
                            {introStep >= 2 && introStep < 5 && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1 }}
                                className="absolute inset-x-0 bottom-[-27%] flex items-center justify-center translate-x-[30%] z-[85] pointer-events-none"
                              >
                                <motion.div
                                  className={`relative w-14 h-14 cursor-pointer ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                                  initial={{ x: -140, y: 150, scale: 0.5 }}
                                  animate={{ x: -140, y: 150, scale: 1 }}
                                  transition={{ duration: 1 }}
                                >
                                  <motion.div
                                    animate={{
                                      y: [0, -4, 0],
                                      scaleY: [1, 0.94, 1],
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                    }}
                                  >
                                    <img
                                      src="/assets/npc.png"
                                      alt="Player"
                                      className="w-full h-full object-contain -scale-x-100"
                                      referrerPolicy="no-referrer"
                                    />
                                  </motion.div>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/30 rounded-full blur-sm -z-10" />
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* 小镇事件对话框 (包含 introStep 等事件) */}
                          <AnimatePresence>
                            {townEventStep === 1 && (
                              <motion.div
                                key="town-dialogue"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-[150] w-[85%] max-w-sm ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                                onPointerUp={(e) => {
                                  if (!isDraggingSceneGlobalRef.current && townEventStep === 1) {
                                    setTownEventStep(2);
                                  }
                                }}
                              >
                                <div className="relative bg-white/95 backdrop-blur-2xl border-4 border-amber-100 p-5 pt-7 rounded-[32px] shadow-2xl">
                                  {/* 老奶奶头像 - 放在左侧稍微压住边框 */}
                                  <div className="absolute -left-10 bottom-2 w-20 h-20 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-amber-50 z-10 rotate-[-5deg]">
                                    <img
                                      src="/assets/buntouxiang.png"
                                      className="w-full h-full object-cover -scale-x-100"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>

                                  {/* 对话内容 (向右偏移一点给头像留空间) */}
                                  <div className="pl-10 relative text-stone-800 font-bold leading-relaxed">
                                    <AnimatePresence mode="wait">
                                      <motion.p
                                        key={`dialogue-${townEventStep}`}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-sm tracking-tight"
                                      >
                                        {townEventStep === 1 && (
                                          <ConfigBubble
                                            file="guide_dialogues.json"
                                            field="text_en"
                                            align="start"
                                          >
                                            {guideDialoguesConfig.events.find(
                                              (e) =>
                                                e.event_id ===
                                                "town_event_intro",
                                            )?.dialogues[0]?.text_en ||
                                              "It used to be beautiful here, but now..."}
                                          </ConfigBubble>
                                        )}
                                      </motion.p>
                                    </AnimatePresence>

                                    <div className="mt-3 flex justify-end">
                                      <div className="text-[9px] text-amber-500/80 animate-pulse font-black flex items-center gap-1">
                                        <span>NEXT</span>
                                        <div className="w-1 h-1 bg-amber-500 rounded-full" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* 气泡尖角 - 调整到左侧对齐头像 */}
                                  <div className="absolute left-10 -bottom-2 w-4 h-4 bg-white/95 rotate-45 border-r-4 border-b-4 border-amber-100" />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* 指向章节按钮的箭头移至全局层 */}
                        </div>
                      </div>
                      {showReferenceGrid && <CoordinateGridOverlay />}
                    </motion.div>
                  </div>

                  {/* 室内场景 */}
                  <div
                    ref={interiorContainerRef}
                    className={`absolute inset-0 bg-neutral-900 transition-opacity duration-300 ${scene === "interior" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  >
                    {/* 飞出的星星 */}
                    <AnimatePresence>
                      {flyingStarAnim && (
                        <motion.div
                          initial={{
                            opacity: 0,
                            scale: 0,
                            top: "50%",
                            left: "50%",
                            x: "-50%",
                            y: "-50%",
                          }}
                          animate={{
                            opacity: [0, 1, 1, 1, 1],
                            scale: [0, 5, 5, 3, 1],
                            top: ["50%", "50%", "50%", "30%", "56px"],
                            left: ["50%", "50%", "50%", "40%", "35%"],
                            rotate: [0, 180, 270, 315, 360],
                          }}
                          exit={{ opacity: 0, scale: 1 }}
                          transition={{
                            duration: 3.0,
                            times: [0, 0.2, 0.6, 0.8, 1],
                            ease: "easeInOut",
                          }}
                          className="absolute z-[200] w-12 h-12 pointer-events-none drop-shadow-[0_0_20px_rgba(255,215,0,1)] flex items-center justify-center text-yellow-400"
                        >
                          <StarIcon fillRatio={1} pureGold={true} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 室内氛围：丁达尔光柱 - 提升层级到画布之上 */}
                    <motion.div
                      animate={{ opacity: [0.05, 0.15, 0.05] }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute -top-40 -left-20 w-[150%] h-[100%] bg-gradient-to-b from-white/20 to-transparent blur-[80px] rotate-[35deg] pointer-events-none z-[85]"
                    />

                    {/* 可滑动画布 */}
                    <motion.div
                      style={{ x: sceneX }}
                      className={`absolute inset-y-0 left-1/2 -ml-[450px] w-[900px] h-full select-none touch-pan-y ${scene === "interior" ? "pointer-events-auto" : "pointer-events-none"}`}
                      onPointerDown={onScenePointerDown}
                      onPointerMove={onScenePointerMove}
                      onPointerUp={onScenePointerUp}
                    >
                      {/* 背景图层 */}
                      <img
                        data-scene-bg="true"
                        src={
                          showQuiz
                            ? quizIndex === 2
                              ? "/assets/cafeishineibeijing2.png"
                              : quizIndex === 3
                                ? "/assets/cafeishineibeijing3.png"
                                : quizIndex === 4
                                  ? "/assets/cafeishineibeijing4.png"
                                  : "/assets/cafeishineibeijing.png"
                            : "/assets/jianzhunei2.png"
                        }
                        alt="Interior Scene"
                        className="w-full h-full object-cover select-none"
                        draggable={false}
                        referrerPolicy="no-referrer"
                      />

                      {/* 家具展示层 - 在画布内 */}
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {/* 标记位置 */}
                        <DecorationMarker
                          label="Photo Wall"
                          top="35%"
                          left="25%"
                          isPlaced={furniture.includes("photo_wall")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />
                        <DecorationMarker
                          label="Lamp"
                          top="47%"
                          left="33%"
                          isPlaced={furniture.includes("lamp")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />
                        <DecorationMarker
                          label="Coffee Table"
                          top="53%"
                          left="15%"
                          isPlaced={furniture.includes("table")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />
                        <DecorationMarker
                          label="Rug"
                          top="55%"
                          left="11%"
                          isPlaced={furniture.includes("rug")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />

                        {/* 实际放置的家具 */}
                        {furniture.includes("rug") && (
                          <motion.img
                            key="furniture-rug"
                            initial={{ opacity: 0, y: -400 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              rotate: [0, 10, -10, 7, -7, 5, -5, 0],
                            }}
                            transition={{
                              y: { type: "spring", damping: 12, stiffness: 80 },
                              rotate: { delay: 1.2, duration: 2.0 },
                            }}
                            src="/assets/jinagliditan.png"
                            className="absolute top-[52%] left-[4%] w-56 h-auto z-10"
                            referrerPolicy="no-referrer"
                            onPointerUp={(e) => {
                              if (!isDraggingSceneGlobalRef.current) {
                                setShowTasks(true);
                              }
                            }}
                          />
                        )}

                        {furniture.includes("photo_wall") && (
                          <motion.div
                            key="furniture-photo-wall"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="absolute top-[32%] left-[23%] flex flex-wrap gap-2 w-32"
                          >
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className="w-12 h-16 bg-white border-4 border-stone-800 shadow-lg p-1 -rotate-[5deg] even:rotate-[5deg]"
                              >
                                <div className="w-full h-full bg-stone-100 flex items-center justify-center overflow-hidden">
                                  <ImageIcon className="w-4 h-4 text-stone-300" />
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}

                        {furniture.includes("lamp") && (
                          <motion.div
                            key="furniture-lamp"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-[43%] left-[32%] flex flex-col items-center"
                          >
                            <div className="w-10 h-10 bg-amber-100 rounded-full blur-xl animate-pulse" />
                            <div className="w-12 h-8 bg-amber-500 rounded-t-full border-2 border-amber-600 relative overflow-hidden">
                              <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-400" />
                            </div>
                            <div className="w-1 h-12 bg-amber-900" />
                            <div className="w-6 h-2 bg-amber-900 rounded-full" />
                          </motion.div>
                        )}

                        {furniture.includes("table") && (
                          <motion.img
                            key="furniture-table"
                            initial={{ opacity: 0, y: -400 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              rotate: [0, 10, -10, 7, -7, 5, -5, 0],
                            }}
                            transition={{
                              y: {
                                type: "spring",
                                damping: 12,
                                stiffness: 80,
                                delay: 0.2,
                              },
                              rotate: { delay: 1.4, duration: 2.0 },
                            }}
                            src="/assets/jianglichaji.png"
                            className="absolute top-[48%] left-[12%] w-24 h-auto z-20"
                            referrerPolicy="no-referrer"
                            onPointerUp={(e) => {
                              if (!isDraggingSceneGlobalRef.current) {
                                setShowTasks(true);
                              }
                            }}
                          />
                        )}

                        {furniture.includes("shafa1") && (
                          <motion.div
                            key="furniture-shafa1"
                            initial={{ opacity: 0, y: -400 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              rotate: [0, 5, -5, 3, -3, 0],
                            }}
                            transition={{
                              y: {
                                type: "spring",
                                damping: 12,
                                stiffness: 80,
                                delay: 0.5,
                              },
                              rotate: { delay: 1.7, duration: 2.0 },
                            }}
                            className="absolute top-[45%] left-[28%] w-24 h-auto pointer-events-none z-[25]"
                          >
                            <img
                              src="/assets/shafa1.png"
                              alt="Sofa 1"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </motion.div>
                        )}
                      </div>
                      {showReferenceGrid && <CoordinateGridOverlay />}
                    </motion.div>
                  </div>

                  {/* 顶部UI条 (仅室内显示) */}
                  <AnimatePresence>
                    {scene === "interior" && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-6 left-[5%] right-[5%] w-[90%] h-16 bg-white z-[60] flex items-center shadow-md px-3 pointer-events-auto rounded-[24px]"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              handleExitBuilding();
                              hapticFeedback.light();
                            }}
                            className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-[#5A52E0] rounded-[16px] shadow-sm ml-1"
                          >
                            <img
                              src="/assets/fanhui.png"
                              alt="Back"
                              className="w-5 h-5 object-contain brightness-0 invert drop-shadow-sm pr-0.5"
                              referrerPolicy="no-referrer"
                            />
                          </motion.button>
                          <div className="flex flex-col justify-center flex-1 relative">
                            <span className="text-[#333] font-black text-[16px] leading-none mb-1 tracking-tight">
                              Home
                            </span>
                            <div
                              className="flex items-center gap-1.5"
                              onClick={() => {
                                setShowStarTooltip(true);
                                setTimeout(
                                  () => setShowStarTooltip(false),
                                  2000,
                                );
                              }}
                            >
                              <span className="text-stone-400 font-extrabold text-[12px] leading-none pb-[1px]">
                                {houseImage === "/assets/lv2house-1.png"
                                  ? "Lv. 4"
                                  : houseImage === "/assets/home1home2-1.png"
                                    ? "Lv. 3"
                                    : "Lv. 0"}
                              </span>
                              <div className="flex gap-0.5 items-center">
                                {[1, 2, 3, 4].map((idx) => {
                                  const completed = Math.min(
                                    8,
                                    Math.max(0, quizIndex - 1),
                                  );
                                  const ratio =
                                    completed >= idx * 2
                                      ? 1
                                      : completed === idx * 2 - 1
                                        ? 0.5
                                        : 0;
                                  return (
                                    <motion.div
                                      key={idx}
                                      animate={
                                        pulsingStarIdx === idx
                                          ? { scale: [1, 1.4, 1] }
                                          : { scale: 1 }
                                      }
                                      transition={{ duration: 0.5 }}
                                    >
                                      <StarIcon fillRatio={ratio} />
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>

                            <AnimatePresence>
                              {showStarTooltip && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                  className="absolute top-10 left-10 bg-[#FFD159] text-[#A66C00] font-black text-[12px] px-3 py-1.5 rounded-xl shadow-md z-50 whitespace-nowrap"
                                >
                                  <div className="absolute -top-1.5 left-4 w-3 h-3 bg-[#FFD159] rotate-45" />
                                  <span className="relative z-10">
                                    {quizIndex < 2
                                      ? `还要 ${1 - (quizIndex - 1) * 0.5} 颗星升级！`
                                      : quizIndex < 6
                                        ? `还要 ${0.5 * (5 - (quizIndex - 1))} 颗星升级！`
                                        : "已满级！"}
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="ml-auto flex items-center h-[34px]">
                            <div className="w-px h-full bg-stone-200 mr-4" />
                            <motion.button
                              className="flex items-center gap-1.5 shrink-0"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setShowCourseOutline(true)}
                            >
                              <span className="text-[#5A52E0] font-black text-[17px] mr-0.5">
                                {Math.min(8, Math.max(0, quizIndex - 1))}/8
                              </span>
                              <Book className="w-[22px] h-[22px] text-[#5A52E0]" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 首次进入场景立绘对话 (introStep === 4) */}
                  <AnimatePresence>
                    {introStep === 4 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[500] pointer-events-auto cursor-pointer flex flex-col justify-end pb-[35vh] px-4 sm:items-center"
                        onClick={() => setIntroStep(5)}
                      >
                        <div className="absolute inset-0" />

                        {/* 对话框与立绘 */}
                        <div className="relative w-full sm:w-full sm:max-w-md z-20 flex flex-col justify-end scale-[0.8] sm:scale-[0.8] origin-bottom">
                          {/* 角色立绘 - 正常大小，站在对话框左上方 */}
                          <div className="relative w-full h-[0px] pointer-events-none z-30">
                            <motion.img
                              initial={{ x: -40, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                              }}
                              src="/assets/BunNPC.png"
                              className="absolute bottom-[-20px] left-[-5%] h-[180px] sm:h-[220px] w-auto max-w-none object-contain drop-shadow-2xl pointer-events-none origin-bottom-left"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/95 backdrop-blur-md rounded-[32px] p-6 pt-10 sm:p-8 sm:pt-12 shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-4 border-stone-100 relative pointer-events-auto w-full z-20"
                          >
                            <div className="absolute -top-5 left-8 bg-amber-400 text-stone-900 px-6 py-1.5 rounded-xl font-black text-lg tracking-wider uppercase shadow-md z-30">
                              Bun
                            </div>
                            <p className="text-[20px] sm:text-[22px] leading-relaxed text-stone-800 font-black relative z-20">
                              Welcome to your new home. If you need any help, just ask me!
                            </p>
                            <p className="text-[16px] sm:text-[18px] leading-relaxed text-stone-500 font-bold mt-2 relative z-20">
                              欢迎来到新家，如果你遇到什么麻烦，随时找我哦。
                            </p>
                            <div className="absolute bottom-3 right-5 text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 z-20">
                              <motion.span
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                Tap to Continue ▶
                              </motion.span>
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 发朋友圈后的对话 (guideSocialStep === 7, 8, 9) */}
                  <AnimatePresence>
                    {guideSocialStep >= 7 && guideSocialStep <= 9 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[500] pointer-events-auto cursor-pointer flex flex-col justify-end pb-[35vh] px-4 sm:items-center"
                        onClick={() => {
                          if (guideSocialStep < 9) {
                            setGuideSocialStep((prev) => prev + 1);
                          } else {
                            setGuideSocialStep(10);
                          }
                        }}
                      >
                        <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />

                        {/* 对话框与立绘 */}
                        <div className="relative w-full sm:w-full sm:max-w-md z-20 flex flex-col justify-end scale-[0.8] sm:scale-[0.8] origin-bottom">
                          {/* 立绘根据阶段切换左/右 */}
                          <div className="relative w-full h-[0px] pointer-events-none z-30">
                            <AnimatePresence mode="wait">
                              {guideSocialStep !== 8 ? (
                                <motion.img
                                  key="bun"
                                  initial={{ x: -40, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  exit={{ x: -40, opacity: 0 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                  }}
                                  src="/assets/xiaotuzijiemian.png"
                                  className="absolute bottom-[-20px] left-[-5%] h-[180px] sm:h-[220px] w-auto max-w-none object-contain drop-shadow-2xl pointer-events-none origin-bottom-left"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <motion.img
                                  key="player"
                                  initial={{ x: 40, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  exit={{ x: 40, opacity: 0 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                  }}
                                  src="/assets/Amili.png"
                                  className="absolute bottom-[-20px] right-[0%] h-[160px] sm:h-[180px] w-auto max-w-none object-contain drop-shadow-2xl pointer-events-none origin-bottom-right"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                            </AnimatePresence>
                          </div>

                          <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/95 backdrop-blur-md rounded-[32px] p-6 pt-10 sm:p-8 sm:pt-12 shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-4 border-stone-100 relative pointer-events-auto w-full z-20"
                          >
                            <div
                              className={`absolute -top-5 ${guideSocialStep !== 8 ? "left-8 bg-amber-400" : "right-8 bg-blue-400"} text-stone-900 px-6 py-1.5 rounded-xl font-black text-lg tracking-wider uppercase shadow-md z-30`}
                            >
                              {guideSocialStep !== 8
                                ? "Mayor Barnaby"
                                : preOnboardingName || "You"}
                            </div>
                            <p className="text-[18px] sm:text-[20px] leading-relaxed text-stone-800 font-black relative z-20">
                              {guideSocialStep === 7 &&
                                "The neighbors here are great."}
                              {guideSocialStep === 8 &&
                                "Of course, our town used to be a top-tier civilized one."}
                              {guideSocialStep === 9 &&
                                "Tsk, let me promote our town, time to post a moment."}
                            </p>
                            <p className="text-[15px] sm:text-[17px] leading-relaxed text-stone-500 font-bold mt-2 relative z-20">
                              {guideSocialStep === 7 &&
                                "这里的邻居真不错。"}
                              {guideSocialStep === 8 &&
                                "当然，我们这曾经可是顶尖的文明小镇。"}
                              {guideSocialStep === 9 &&
                                "切，让我来宣传一下我们的小镇，发个朋友圈先。"}
                            </p>
                            <div className="absolute bottom-3 right-5 text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 z-20">
                              <motion.span
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                Tap to Continue ▶
                              </motion.span>
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 第一课结束后的咖啡对话 (postLesson1DialogueStep) */}
                  <AnimatePresence>
                    {postLesson1DialogueStep > 0 &&
                      postLesson1DialogueStep <= 3 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[500] pointer-events-auto cursor-pointer flex flex-col justify-end pb-[35vh] px-4 sm:items-center"
                          onClick={() =>
                            setPostLesson1DialogueStep((prev) => prev + 1)
                          }
                        >
                          <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />

                          {/* 对话框与立绘 */}
                          <div className="relative w-full sm:w-full sm:max-w-md z-20 flex flex-col justify-end scale-[0.8] sm:scale-[0.8] origin-bottom">
                            {/* 立绘根据阶段切换左/右 */}
                            <div className="relative w-full h-[0px] pointer-events-none z-30">
                              <AnimatePresence mode="wait">
                                {postLesson1DialogueStep !== 2 ? (
                                  <motion.img
                                    key="player"
                                    initial={{ x: 40, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 40, opacity: 0 }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 300,
                                      damping: 30,
                                    }}
                                    src="/assets/Amili.png"
                                    className="absolute bottom-[-20px] right-[0%] h-[160px] sm:h-[180px] w-auto max-w-none object-contain drop-shadow-2xl pointer-events-none origin-bottom-right"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <motion.img
                                    key="bun"
                                    initial={{ x: -40, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -40, opacity: 0 }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 300,
                                      damping: 30,
                                    }}
                                    src="/assets/BunNPC.png"
                                    className="absolute bottom-[-20px] left-[-5%] h-[180px] sm:h-[220px] w-auto max-w-none object-contain drop-shadow-2xl pointer-events-none origin-bottom-left"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                              </AnimatePresence>
                            </div>

                            <motion.div
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.1 }}
                              className="bg-white/95 backdrop-blur-md rounded-[32px] p-6 pt-10 sm:p-8 sm:pt-12 shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-4 border-stone-100 relative pointer-events-auto w-full z-20"
                            >
                              <div
                                className={`absolute -top-5 ${postLesson1DialogueStep !== 2 ? "right-8 bg-blue-400" : "left-8 bg-amber-400"} text-stone-900 px-6 py-1.5 rounded-xl font-black text-lg tracking-wider uppercase shadow-md z-30`}
                              >
                                {postLesson1DialogueStep !== 2
                                  ? preOnboardingName || "You"
                                  : "Bun"}
                              </div>
                              <p className="text-[18px] sm:text-[20px] leading-relaxed text-stone-800 font-black relative z-20">
                                {postLesson1DialogueStep === 1 &&
                                  "The coffee tastes great! It's unexpectedly good."}
                                {postLesson1DialogueStep === 2 &&
                                  "Of course! Our town has high standards!"}
                                {postLesson1DialogueStep === 3 &&
                                  "Hmm, I'll do you a favor and promote it on my social media."}
                              </p>
                              <p className="text-[15px] sm:text-[17px] leading-relaxed text-stone-500 font-bold mt-2 relative z-20">
                                {postLesson1DialogueStep === 1 &&
                                  "喝了一口这个咖啡，真不错呢。"}
                                {postLesson1DialogueStep === 2 &&
                                  "当然了，我们小镇可是很有水平的。"}
                                {postLesson1DialogueStep === 3 &&
                                  "切，勉强帮你们宣传一下吧，让我来发个朋友圈。"}
                              </p>
                              <div className="absolute bottom-3 right-5 text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 z-20">
                                <motion.span
                                  animate={{ opacity: [1, 0.3, 1] }}
                                  transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                  }}
                                >
                                  Tap to Continue ▶
                                </motion.span>
                              </div>
                            </motion.div>
                          </div>
                        </motion.div>
                      )}
                  </AnimatePresence>

                  {/* 场景底部控制 (不论场景 Exterior 或 Interior 都显示) */}
                  <div className="absolute bottom-[62px] left-0 right-0 px-6 z-30 pointer-events-none">
                    <div className="relative w-full h-24 flex items-center justify-center">
                      {/* 左下角复习图标 */}
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{
                          duration: 0.8,
                          ease: "backOut",
                          delay: 0.15,
                        }}
                        onClick={() => setShowReview(true)}
                        className="absolute left-0 bottom-full mb-4 w-14 h-14 flex items-center justify-center cursor-pointer pointer-events-auto"
                      >
                        <img
                          src="/assets/renwudi.png"
                          className="absolute inset-0 w-full h-full object-contain -z-10"
                          referrerPolicy="no-referrer"
                        />
                        <div className="w-[60%] h-[60%] flex items-center justify-center text-[#1899D6]">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m14 18 4-4-4-4" />
                            <path d="M18 14H8a4 4 0 0 1-4-4v-4" />
                            <circle cx="8" cy="6" r="2" fill="currentColor" />
                          </svg>
                        </div>
                      </motion.div>

                      {/* 左下角任务图标 */}
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{
                          duration: 0.8,
                          ease: "backOut",
                          delay: 0.1,
                        }}
                        onClick={() => setShowTasks(true)}
                        className="absolute left-0 w-14 h-14 flex items-center justify-center cursor-pointer pointer-events-auto"
                      >
                        <img
                          src="/assets/renwudi.png"
                          className="absolute inset-0 w-full h-full object-contain -z-10"
                          referrerPolicy="no-referrer"
                        />
                        <img
                          src="/assets/renwu.png"
                          className="w-[60%] h-[60%] object-contain"
                          referrerPolicy="no-referrer"
                        />
                        {currentTasks.filter((t) => !t.isCompleted).length >
                          0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center z-20">
                            <img
                              src="/assets/renwutishi.png"
                              className="absolute inset-0 w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <span className="relative z-10 text-[10px] font-bold text-white mb-0.5">
                              {
                                currentTasks.filter((t) => !t.isCompleted)
                                  .length
                              }
                            </span>
                          </div>
                        )}
                        {/* 新任务提示气泡 */}
                        <AnimatePresence>
                          {showNewTaskBubble && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.8 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-24 pointer-events-none z-[100]"
                            >
                              <img
                                src="/assets/xinrenwu.png"
                                className="w-full h-auto object-contain drop-shadow-md"
                                referrerPolicy="no-referrer"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      {/* 右下角朋友圈图标 */}
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        initial={{ x: 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{
                          duration: 0.8,
                          ease: "backOut",
                          delay: 0.15,
                        }}
                        onClick={() => {
                          setShowSocial(true);
                          if (guideSocialStep === 1) setGuideSocialStep(2);
                        }}
                        className="absolute right-0 w-14 h-14 flex items-center justify-center cursor-pointer pointer-events-auto"
                      >
                        <img
                          src="/assets/renwudi.png"
                          className="absolute inset-0 w-full h-full object-contain -z-10"
                          referrerPolicy="no-referrer"
                        />
                        <Smartphone className="w-1/2 h-1/2 text-white drop-shadow-md" />

                        {/* Guide Highlight */}
                        {guideSocialStep === 1 && (
                          <div className="absolute inset-0 border-4 border-yellow-400 rounded-2xl animate-pulse z-20">
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                              <ArrowBigDown className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-bounce" />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                  {/* Grid Toggle Button */}
                  <div className="absolute top-[88px] right-3 z-[150] pointer-events-auto">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowReferenceGrid(!showReferenceGrid);
                        hapticFeedback.light();
                      }}
                      className="p-2.5 bg-white/95 hover:bg-white backdrop-blur-md rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-stone-200/60 text-stone-700 flex items-center justify-center transition-all duration-200"
                    >
                      <div className={`w-5 h-5 flex items-center justify-center transition-transform ${showReferenceGrid ? 'opacity-100 text-[#5A52E0]' : 'opacity-65 text-stone-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <rect width="18" height="18" x="3" y="3" rx="2" />
                          <path d="M3 9h18" />
                          <path d="M3 15h18" />
                          <path d="M9 3v18" />
                          <path d="M15 3v18" />
                        </svg>
                      </div>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* My Profile Scene */}
            {activeTab === "profile" && (
              <motion.div
                key="profile-scene"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute inset-0 bg-[#F7F3F0] px-6 pt-12 pb-32 overflow-y-auto pointer-events-auto"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-stone-100 overflow-hidden">
                    <img
                      src="/assets/buntouxiang.png"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-stone-900 font-black text-2xl tracking-tight">
                      {preOnboardingName || "Maple Explorer"}
                    </h2>
                    <p className="text-stone-400 text-sm font-bold uppercase tracking-widest mt-1">
                      Learning Lv: 12
                    </p>

                    {/* Add Learning Language */}
                    <div className="inline-flex items-center gap-1.5 bg-white/60 mt-2 px-2 py-1 rounded-lg border border-white">
                      <span className="text-lg leading-none">🇬🇧</span>
                      <span className="text-stone-600 text-xs font-bold uppercase">
                        English
                      </span>
                    </div>
                  </div>
                </div>

                {/* Town Level */}
                <div className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm mb-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Home className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-stone-700 font-bold">
                        Town Level {townEventStep >= 5 ? 2 : 1}
                      </span>
                      <span className="text-amber-500 text-xs font-bold">
                        120/500 XP
                      </span>
                    </div>
                    <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 w-[24%]" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm text-center">
                    <div className="text-green-500 font-black text-2xl">
                      3 Days
                    </div>
                    <div className="text-stone-400 text-xs uppercase font-bold tracking-tight">
                      Current Streak
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm text-center">
                    <div className="text-orange-500 font-black text-2xl">
                      15 Days
                    </div>
                    <div className="text-stone-400 text-xs uppercase font-bold tracking-tight">
                      Best Streak
                    </div>
                  </div>
                  <div className="col-span-2 bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm text-center text-center">
                    <div className="text-blue-500 font-black text-2xl">
                      12 hr 30 min
                    </div>
                    <div className="text-stone-400 text-xs uppercase font-bold tracking-tight">
                      Total Time
                    </div>
                  </div>
                </div>

                <h3 className="text-stone-800 font-bold mb-3">
                  Building Progress
                </h3>
                <div className="space-y-3 mb-6">
                  <div className="bg-white/60 p-4 rounded-2xl flex items-center justify-between border border-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Home className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <div className="text-stone-700 font-bold">
                          Grandma's House
                        </div>
                        <div className="text-stone-400 text-xs font-medium">
                          Furniture & Routine
                        </div>
                      </div>
                    </div>
                    <div className="text-stone-500 font-bold">
                      Lv. {furniture.length + 1}
                    </div>
                  </div>
                  <div className="bg-white/60 p-4 rounded-2xl flex items-center justify-between border border-white opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Coffee className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <div className="text-stone-700 font-bold">
                          Cafe (Locked)
                        </div>
                        <div className="text-stone-400 text-xs font-medium">
                          Ordering & Socializing
                        </div>
                      </div>
                    </div>
                    <div className="text-stone-500 font-bold">Lv. 0</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {["Settings", "Help"].map((item, idx) => (
                    <motion.div
                      key={`${item}-${idx}`}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white/60 p-4 rounded-2xl flex items-center justify-between border border-white cursor-pointer"
                      onClick={() => showMessage(`${item} coming soon`)}
                    >
                      <span className="text-stone-700 font-bold">{item}</span>
                      <div className="w-6 h-6 flex items-center justify-center opacity-30">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Developer Tools / Test Controls */}
                <div className="mt-8 pt-6 border-t border-stone-200">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                    <h3 className="text-stone-800 font-bold text-xs uppercase tracking-wider">
                      Developer Sandbox / 调试功能
                    </h3>
                  </div>
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      hapticFeedback.success?.();
                      setShowResetConfirm(true);
                    }}
                    className="bg-rose-50 hover:bg-rose-100 border border-rose-200/60 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-colors duration-200"
                  >
                    <div className="flex items-center gap-3 font-sans">
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-500">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-rose-700 font-black text-sm">
                          清除进度并重启游戏
                        </div>
                        <div className="text-rose-400 text-[10px] font-bold mt-0.5">
                          Clear and Reset All Game Progress
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-rose-300" />
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === "ai_custom" && (
              <AiCustomQuizScreen
                stamina={stamina}
                setGlobalStamina={setStamina}
                onClose={() => setActiveTab("town")}
              />
            )}

            {/* AI Courses Scene */}
            {activeTab === "ai_course" && (
              <motion.div
                key="ai-course-scene"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute inset-0 bg-[#F7F3F0] px-6 pt-12 pb-32 overflow-y-auto pointer-events-auto"
              >
                <div className="flex flex-col mb-6">
                  <h2 className="text-stone-900 font-black text-3xl tracking-tight">
                    AI Speaking Course
                  </h2>
                  <p className="text-stone-500 font-bold mt-2">
                    Choose a scene to start practicing
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-stone-800 font-black text-xl mb-4">
                      Scene Categories
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setAiPracticeCategory("Community")}
                        className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-blue-200 transition-colors flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
                          <Home className="w-8 h-8 text-blue-500" />
                        </div>
                        <h4 className="text-stone-800 font-extrabold">
                          Community
                        </h4>
                      </div>
                      <div
                        onClick={() => setAiPracticeCategory("Cafe")}
                        className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-amber-200 transition-colors flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
                          <Coffee className="w-8 h-8 text-amber-500" />
                        </div>
                        <h4 className="text-stone-800 font-extrabold">Cafe</h4>
                      </div>
                      <div
                        onClick={() => setAiPracticeCategory("Hospital")}
                        className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-red-200 transition-colors flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-3">
                          <Plus className="w-8 h-8 text-red-500" />
                        </div>
                        <h4 className="text-stone-800 font-extrabold">
                          Hospital
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-stone-800 font-black text-xl mb-4">
                      Detailed Situations
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-orange-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">🛵</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Ordering Takeout
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Learn to order food via phone or app.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-green-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">🍳</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Cooking
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Discussing recipes and ingredients.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-purple-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">📦</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Picking Up Package
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Talking to couriers and post office.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-teal-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">🎒</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Getting Things
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Asking someone to grab items for you.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 顶部资源条 - 全局显示 (在 Profile / AI Course 界面或建筑内场景隐藏) */}
        <div
          className={`absolute top-10 left-0 right-0 px-6 z-[90] pointer-events-none transition-opacity duration-300 ${activeTab !== "town" || (activeTab === "town" && scene === "interior") ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}
        >
          <div className="relative w-full aspect-[400/60] flex items-center justify-center">
            <img
              src="/assets/dingbuiconpng.png"
              alt="Top Bar"
              className="w-full h-full object-contain z-10"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-1/2 left-[calc(92%-100px)] -translate-y-1/2 -translate-x-1/2 z-20">
              <span className="text-blue-400 text-[19px] font-black">
                {stamina}
              </span>
            </div>
          </div>
        </div>

        {/* 顶部的任务引导卡片 */}
        <div
          className={`absolute top-[100px] left-0 right-0 z-[90] pointer-events-none flex justify-center overflow-x-hidden min-h-[231px] transition-opacity duration-300 ${activeTab === "town" && scene === "exterior" ? "opacity-100" : "opacity-0"}`}
        >
          <AnimatePresence mode="popLayout">
            {showTopCard &&
              ((townEventStep !== 2 &&
                townEventStep < 5 &&
                dismissedCardPhase === 0) ||
                (townEventStep >= 5 &&
                  dismissedCardPhase < EXTERIOR_TASKS.length)) && (
                <motion.div
                  key={`top-task-card-${dismissedCardPhase}`}
                  initial={{ opacity: 0, x: 200, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -200, scale: 0.95 }}
                  transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`absolute drop-shadow-lg w-[308px] h-[231px] pointer-events-none`}
                >
                  <img
                    src="/assets/1renwukapian.png"
                    alt="Task Panel"
                    className="w-[308px] h-[231px] block"
                    referrerPolicy="no-referrer"
                  />

                  {/* 覆盖的视频/图片内容 */}
                  <div className="absolute top-[22px] left-[14px] w-[280px] h-[124px] rounded-[14px] overflow-hidden">
                    <img
                      src={`/media/L0${Math.min(9, dismissedCardPhase + 1)}_Q01.png`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes("L02_Q01.png")) {
                          target.src = "/media/L02_Q01.png";
                        }
                      }}
                    />
                    {/* 可选：叠加一层渐变以免遮挡文本太生硬，如果原卡片自带了阴影的话可以加点渐变 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-50" />
                  </div>

                  {/* 奖励内容（图）右上角 */}
                  <div className="absolute top-[2px] right-2 w-[72px] h-[72px] z-10">
                    <img
                      src={EXTERIOR_TASKS[dismissedCardPhase]?.rewardImage}
                      className="w-full h-full object-contain drop-shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="absolute bottom-[66px] left-6 right-6 z-10 flex flex-col justify-end">
                    {/* 任务标题（一行显示） */}
                    <h3 className="text-left font-black text-white text-[18px] sm:text-[20px] whitespace-nowrap overflow-hidden text-ellipsis w-full mb-1">
                      {EXTERIOR_TASKS[dismissedCardPhase]?.title}
                    </h3>
                    {/* 学习单词数剧（居中放置在按钮上方） */}
                    <div className="flex justify-center w-full pt-1">
                      <span className="font-bold text-[#8A6A4B] text-[13px] tracking-wide translate-y-1">
                        +8 words, +2 phrases
                      </span>
                    </div>
                  </div>

                  {/* Buttom Buttons */}
                  <div className="absolute bottom-4 left-5 right-5 flex justify-between gap-3 z-10">
                    <button
                      className={`flex-1 border-2 border-[#6C63FF] bg-white text-[#6C63FF] rounded-full py-1.5 font-black text-[15px] shadow-sm tracking-wide transition-opacity pointer-events-auto cursor-pointer ${animatingCompletedPhase !== null ? "opacity-30" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (animatingCompletedPhase === null) {
                          setShowTopCard(false);
                          setShowGrannyExclamation(true);
                          setIsGrandmaIntroShown(true);
                        }
                      }}
                    >
                      Later
                    </button>
                    <motion.button
                      className={`flex-1 flex items-center justify-center text-white rounded-full py-1.5 font-black text-[15px] tracking-wide transition-colors pointer-events-auto cursor-pointer ${animatingCompletedPhase !== null ? "bg-green-500 shadow-md" : "bg-[#6C63FF]"}`}
                      animate={
                        animatingCompletedPhase === null
                          ? {
                              scale: [1, 1.05, 1],
                              boxShadow: [
                                "0px 4px 6px -1px rgba(0, 0, 0, 0.1)",
                                "0px 0px 15px rgba(108,99,255,0.7)",
                                "0px 4px 6px -1px rgba(0, 0, 0, 0.1)",
                              ],
                            }
                          : {
                              scale: 1,
                              boxShadow: "0px 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            }
                      }
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (animatingCompletedPhase === null) {
                          handleStartGame();
                        }
                      }}
                    >
                      {animatingCompletedPhase !== null ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        "Start"
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </div>

        {/* 转场图层 */}
        <motion.div
          className="absolute inset-0 z-[100] pointer-events-none"
          initial={false}
          animate={{
            y: isTransitioning ? ["-100%", "0%", "0%", "-100%"] : "-100%",
          }}
          transition={{
            duration: 1.8,
            times: [0, 0.4, 0.6, 1],
            ease: "easeInOut",
          }}
        >
          <img
            src="/assets/zairu.png"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-64 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
            >
              <div className="bg-black/80 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3">
                <span className="text-white text-xs font-bold uppercase">
                  {toast}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 关卡进入确认弹窗 */}
        <AnimatePresence>
          {showLevelConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[9999] flex items-end justify-center bg-black/40 pointer-events-auto"
              onClick={() => setShowLevelConfirm(false)}
            >
              <div
                className="relative w-full max-w-[450px]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 确认弹窗背景图 - 从底部滑入 */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="w-full relative flex flex-col justify-end"
                >
                  {/* 关闭按键 */}
                  <button
                    onClick={() => {
                      setShowLevelConfirm(false);
                      setShowInteriorGrannyExclamation(true);
                    }}
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 z-[30]"
                  >
                    <div className="absolute inset-0 bg-black/40 rounded-full border border-white/20" />
                    <img
                      src="/assets/renwuguanbi.png"
                      alt="Close"
                      className="w-4 h-4 object-contain relative z-10 brightness-200"
                      referrerPolicy="no-referrer"
                    />
                  </button>

                  <div className="relative">
                    <img
                      src="/assets/laonainaiqueren.png"
                      alt="Confirm"
                      className="w-full h-auto object-contain drop-shadow-2xl translate-y-[2px]"
                      referrerPolicy="no-referrer"
                    />
                    {/* Add dynamic text over the modal image */}
                    {(() => {
                      const lessonInfo =
                        lessonsConfig.lessons.find(
                          (l: any) => l.lesson_id === quizIndex,
                        ) || lessonsConfig.lessons[0];
                      return (
                        <div className="absolute top-[30%] left-[10%] right-[10%] bottom-[18%] flex flex-col items-center justify-center text-center px-6">
                          <ConfigBubble
                            file="lessons.json"
                            field="title"
                            align="center"
                            theme="dark"
                          >
                            <h3 className="text-[#6C63FF] font-black text-2xl mb-1 tracking-tight">
                              {lessonInfo.title}
                            </h3>
                          </ConfigBubble>
                          <ConfigBubble
                            file="lessons.json"
                            field="title_cn"
                            align="center"
                            className="mt-1"
                          >
                            <h4 className="text-stone-600 font-black text-sm mb-3 opacity-80 uppercase tracking-widest">
                              {lessonInfo.title_cn}
                            </h4>
                          </ConfigBubble>
                          <ConfigBubble
                            file="lessons.json"
                            field="description"
                            align="center"
                            className="mt-1"
                          >
                            <p className="text-stone-800 text-sm font-bold leading-snug drop-shadow-sm">
                              {lessonInfo.description}
                            </p>
                          </ConfigBubble>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 最下方确认按钮，带有 START 字母 */}
                  <motion.div
                    className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[90%] h-16 cursor-pointer flex items-center justify-center group z-[20]"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowLevelConfirm(false);
                      setShowQuiz(true);
                      setIsVideoMutedForQuestion(false);
                    }}
                  >
                    <motion.div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                      animate={{ y: [0, 8, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <ArrowBigDown className="w-10 h-10 text-green-400 fill-green-400 drop-shadow-lg" />
                    </motion.div>
                    <img
                      src="/assets/423anniu.png"
                      alt="Play"
                      className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                      referrerPolicy="no-referrer"
                    />
                    <span className="relative z-10 text-white font-black text-2xl tracking-[0.2em] ml-1 drop-shadow-md">
                      START
                    </span>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 故事弹窗 - 明亮暖色设计 */}
        <AnimatePresence>
          {showStory && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center p-6 bg-white/20 backdrop-blur-md pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="relative w-full max-w-sm rounded-[40px] overflow-hidden border-4 border-white shadow-[0_24px_48px_-12px_rgba(120,80,40,0.2)] bg-white"
              >
                {/* 装饰背景层 - 暖色渐变 */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#FFFBF7] to-[#FDF4E9] z-0" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 blur-[60px] rounded-full z-0" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-100/40 blur-[40px] rounded-full z-0" />

                <div className="relative p-10 flex flex-col items-center z-10">
                  {/* 关闭按钮 */}
                  <button
                    onClick={() => {
                      setShowStory(false);
                      setShowGuideArrow(true);
                    }}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 group"
                  >
                    <div className="absolute inset-0 bg-stone-100 rounded-full group-hover:bg-amber-50 transition-colors" />
                    <img
                      src="/assets/renwuguanbi.png"
                      alt="Close"
                      className="w-5 h-5 object-contain relative z-10 opacity-60 group-hover:opacity-100 grayscale brightness-50"
                      referrerPolicy="no-referrer"
                    />
                  </button>

                  <div className="flex w-full gap-6 items-center mb-8 mt-4">
                    {/* 故事内容 (左侧) */}
                    <div className="flex-1">
                      <div className="space-y-1.5 mb-4 opacity-40">
                        <div className="w-10 h-0.5 bg-amber-700/60 rounded-full" />
                        <div className="w-6 h-0.5 bg-amber-700/30 rounded-full" />
                      </div>
                      <p className="text-stone-800 text-[16px] leading-[1.7] font-medium tracking-tight italic">
                        "Maple read on the sofa under a flickering lamp. Barnaby
                        came from the dining room and leaned in the doorway,
                        watching."
                      </p>
                    </div>

                    {/* Bun头像 (右侧) */}
                    <div className="w-20 h-20 relative flex-shrink-0">
                      <div className="absolute inset-0 bg-amber-400/10 rounded-full blur-2xl animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-2 border-amber-200/50 scale-110" />
                      <div className="absolute inset-0 rounded-full bg-stone-50 shadow-inner" />
                      <img
                        src="/assets/buntouxiang.png"
                        alt="Bun"
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.1)] -scale-x-100"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* 标题区 (下方) */}
                  <div className="w-full flex items-center gap-4 mt-2">
                    <div className="h-px flex-1 bg-amber-200/60" />
                    <span className="text-amber-800 font-extrabold text-[10px] uppercase tracking-[0.6em] italic opacity-60">
                      New Story
                    </span>
                    <div className="h-px flex-1 bg-amber-200/60" />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 场景详情全屏遮罩 */}
        <AnimatePresence>
          {showSceneModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowSceneModal(false);
                setShowQuiz(true);
                setIsVideoMutedForQuestion(false);
              }}
              className="absolute inset-0 z-[200] flex flex-col items-center justify-center p-12 bg-black/70 backdrop-blur-md cursor-pointer pointer-events-auto"
            >
              {/* 标题 */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8 flex items-center gap-4"
              >
                <div className="w-12 h-px bg-amber-400/50" />
                <h2 className="text-amber-400 font-black text-3xl tracking-widest uppercase italic drop-shadow-lg">
                  Scene
                </h2>
                <div className="w-12 h-px bg-amber-400/50" />
              </motion.div>

              {/* 内容 */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="max-w-md"
              >
                <p className="text-white text-lg leading-[2] font-medium italic text-center drop-shadow-md">
                  "Maple was reading on the living room sofa, with the old table
                  lamp flickering on and off. Barnaby walked over from the
                  dining room, stopped at the living room doorway, and leaned
                  against the frame watching for a moment."
                </p>
              </motion.div>

              {/* 点击关闭提示 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-12 text-white/50 text-[10px] uppercase tracking-[0.4em]"
              >
                Click anywhere to close
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 聊天式对话流 */}
        <AnimatePresence>
          {showDialogueFlow && (
            <div
              className="absolute inset-0 z-[210] flex flex-col pointer-events-auto overflow-hidden"
              onClick={advanceDialogueFlow}
            >
              <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md" />

              {/* 跳过按钮 */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDialogueStep(
                    (
                      preLessonStoriesConfig.lessons.find(
                        (l: any) => l.lesson_id === quizIndex,
                      ) || preLessonStoriesConfig.lessons[0]
                    ).dialogues.length,
                  );
                }}
                className="absolute top-10 right-6 w-20 h-8 z-30 flex items-center justify-center group"
              >
                <img
                  src="/assets/tiaoguo.png"
                  alt="Skip"
                  className="w-full h-full object-contain transition-transform group-hover:scale-105 active:scale-95"
                  referrerPolicy="no-referrer"
                />
              </motion.button>

              <div className="flex-1 relative w-full flex flex-col justify-end pointer-events-none pb-8 sm:pb-12 z-10">
                {(() => {
                  const currentStory =
                    preLessonStoriesConfig.lessons.find(
                      (l: any) => l.lesson_id === quizIndex,
                    ) || preLessonStoriesConfig.lessons[0];
                  const currentDialogue = currentStory.dialogues[dialogueStep];

                  if (!currentDialogue) return null;

                  // 动态映射立绘人物
                  let avatar = currentDialogue.avatar;
                  if (avatar === "/assets/Amilitouxiang.png")
                    avatar = "/assets/Amili.png";
                  else if (avatar === "/assets/buntouxiang.png")
                    avatar = "/assets/BunNPC.png";

                  return (
                    <div className="relative w-full h-[60vh] flex flex-col justify-end">
                      {/* Portrait */}
                      <motion.img
                        key={avatar}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        src={avatar}
                        alt={currentDialogue.speaker}
                        className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 max-w-[85%] w-auto max-h-[60vh] object-contain object-bottom drop-shadow-[0_15px_30px_rgba(0,0,0,0.5)] z-10 pointer-events-none origin-bottom"
                      />

                      {/* Dialogue Box */}
                      <motion.div
                        key={"dialog-" + dialogueStep}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full px-4 z-20 pointer-events-auto"
                      >
                        <div className="w-full max-w-sm mx-auto bg-white/95 backdrop-blur-xl border border-white/50 rounded-[24px] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)] pb-6 relative">
                          <h4 className="text-[14px] font-black text-amber-500 uppercase tracking-wider mb-2">
                            {currentDialogue.speaker}
                          </h4>
                          <ConfigBubble
                            file="pre_lesson_stories.json"
                            field="text_en"
                            align="left"
                            theme="light"
                          >
                            <p className="text-stone-800 font-bold text-[15px] leading-relaxed whitespace-pre-wrap">
                              {currentDialogue.text_en}
                            </p>
                            {currentDialogue.text_cn && (
                              <p className="text-stone-500 text-[13px] mt-2 font-medium">
                                {currentDialogue.text_cn}
                              </p>
                            )}
                          </ConfigBubble>
                        </div>
                      </motion.div>
                    </div>
                  );
                })()}

                {/* 课程标题及内容 (显示在最下方) */}
                <div className="absolute top-1/3 mt-10 left-0 right-0 flex flex-col items-center pointer-events-none z-0">
                  {dialogueStep >=
                    (
                      preLessonStoriesConfig.lessons.find(
                        (l: any) => l.lesson_id === quizIndex,
                      ) || preLessonStoriesConfig.lessons[0]
                    ).dialogues.length &&
                    (() => {
                      const lessonInfo =
                        lessonsConfig.lessons.find(
                          (l) => l.lesson_id === quizIndex,
                        ) || lessonsConfig.lessons[0];
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-center space-y-3"
                        >
                          <div className="inline-block py-1 px-4 bg-white/10 rounded-full border border-white/20">
                            <span className="text-amber-300 font-black text-xs uppercase tracking-[0.4em]">
                              {lessonInfo.unit_id.replace("-", " ")}
                            </span>
                          </div>
                          <ConfigBubble
                            file="lessons.json"
                            field="title"
                            align="center"
                          >
                            <h3 className="text-white text-3xl sm:text-4xl px-4 font-black italic drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] leading-tight">
                              {lessonInfo.title}
                            </h3>
                          </ConfigBubble>
                        </motion.div>
                      );
                    })()}
                </div>
              </div>

              {/* 4. 底部 Learn to Earn 按钮 */}
              {dialogueStep >=
                (
                  preLessonStoriesConfig.lessons.find(
                    (l: any) => l.lesson_id === quizIndex,
                  ) || preLessonStoriesConfig.lessons[0]
                ).dialogues.length && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-12 left-6 right-6 z-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowDialogueFlow(false);
                      setShowQuiz(true);
                      setIsVideoMutedForQuestion(false);
                    }}
                    className="w-full h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-between px-6 shadow-[0_8px_16px_rgba(245,158,11,0.3)] group active:scale-[0.98] transition-transform"
                  >
                    <span className="text-white font-black text-xl tracking-tight">
                      Learn to Earn
                    </span>
                    <div className="flex items-center gap-2 bg-black/10 py-2 px-3 rounded-xl border border-white/10">
                      <img
                        src="/assets/pojiuhome.png"
                        alt="Reward"
                        className="w-6 h-6 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-white font-black text-lg">+1</span>
                    </div>
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* 答题界面 */}
        <AnimatePresence>
          {showQuiz && (
            <div className="absolute inset-0 z-[250] bg-transparent flex flex-col pointer-events-auto overflow-hidden">
              {/* 顶部导航栏 - 浮动在最顶端其实是UnifiedQuiz里有进度条，但我们保留返回和体力 */}
              <div className="absolute top-10 left-0 right-0 h-20 flex items-center px-6 z-50 pointer-events-none">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowQuiz(false)}
                  className="w-10 h-10 flex-shrink-0 pointer-events-auto"
                >
                  <img
                    src="/assets/fanhui.png"
                    alt="Back"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.button>

                {/* Fast Forward Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleFastForward}
                  className="w-10 h-10 flex-shrink-0 pointer-events-auto ml-auto relative"
                >
                  <img
                    src="/assets/tiaoguo.png"
                    alt="Skip"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  {fastForwardClicks > 0 && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-sm"
                    >
                      {fastForwardClicks}
                    </motion.div>
                  )}
                </motion.button>
              </div>

              {/* Chat-Based Quiz UI */}
              <div className="relative flex-1 bg-transparent flex flex-col overflow-hidden w-full h-full">
                <UnifiedQuiz
                  key={quizIndex}
                  ref={quizRef}
                  lessonId={quizIndex}
                  background={
                    quizIndex === 2
                      ? "/assets/cafeishineibeijing2.png"
                      : quizIndex === 3
                        ? "/assets/cafeishineibeijing3.png"
                        : quizIndex === 4
                          ? "/assets/cafeishineibeijing4.png"
                          : "/assets/cafeishineibeijing.png"
                  }
                  stamina={stamina}
                  onQuestionChange={handleQuestionChange}
                  onAudioPlay={handleAudioPlay}
                  onComplete={handleQuizComplete}
                  onFail={handleQuizFail}
                  onMistake={handleQuizMistake}
                  setGlobalStamina={setStamina}
                />
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* 胜利结算界面 - 全屏设计 */}
        <AnimatePresence>
          {showVictory && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-0 z-[300] bg-white flex flex-col pointer-events-auto overflow-hidden"
            >
              {/* 胜利背景 - 全屏铺满 */}
              <div className="absolute inset-0 z-0">
                <img
                  src="/assets/shenglibg.png"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {/* 增加一个覆盖层使内容更清晰 */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-stone-900/40" />
              </div>

              {/* 顶部状态栏 */}
              <div className="relative z-10 h-20 flex items-center justify-between px-8 mt-10">
                <div className="flex flex-col">
                  <span className="text-blue-400 font-black text-xs uppercase tracking-[0.4em]">
                    Achievement
                  </span>
                  <div className="h-1 w-8 bg-blue-500 rounded-full mt-1 px-4" />
                </div>
              </div>

              {/* 飞翔的奖励动画 */}
              <AnimatePresence>
                {isDiamondFlying && (
                  <motion.img
                    initial={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      x: "-50%",
                      y: "-50%",
                      width: 64,
                      height: 64,
                      opacity: 1,
                      zIndex: 1000,
                    }}
                    animate={{
                      top: 80,
                      left: "calc(100% - 65px)",
                      width: 24,
                      height: 24,
                      opacity: 0,
                      scale: [1, 1.2, 0.4],
                    }}
                    transition={{
                      duration: 0.8,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    src={
                      EXTERIOR_TASKS[
                        Math.max(
                          0,
                          Math.min(quizIndex - 2, EXTERIOR_TASKS.length - 1),
                        )
                      ].rewardImage
                    }
                    className="pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                )}
              </AnimatePresence>

              {/* 核心内容区 */}
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
                {/* 标题 */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center mb-12"
                >
                  <h2 className="text-white font-black text-5xl uppercase italic tracking-tighter drop-shadow-2xl leading-none px-4">
                    Unit
                    <br />
                    Complete
                  </h2>
                </motion.div>

                {/* NPC 形象 - 居中展示 */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", duration: 1 }}
                  className="relative w-full max-w-[280px] aspect-square mb-12"
                >
                  {/* 后方光晕 */}
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-[80px] animate-pulse" />
                  <img
                    src="/assets/npc.png"
                    alt="NPC"
                    className="w-full h-full object-contain drop-shadow-[0_32px_64px_rgba(0,0,0,0.5)] relative z-10"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>

                {/* 奖励卡片 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[32px] p-6 flex items-center gap-4 shadow-2xl">
                    <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-lg relative">
                      <img
                        src={
                          quizIndex === 1
                            ? "/assets/xiexin.png"
                            : EXTERIOR_TASKS[
                                Math.max(
                                  0,
                                  Math.min(
                                    quizIndex - 2,
                                    EXTERIOR_TASKS.length - 1,
                                  ),
                                )
                              ]?.rewardImage || "/assets/box.png"
                        }
                        alt="Reward"
                        className="absolute w-[200%] h-[200%] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] z-20"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="pr-4 z-10 pl-4">
                      <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest block mb-1">
                        Items Earned
                      </span>
                      <span className="text-white font-black text-2xl leading-none">
                        {quizIndex === 1 ? "Welcome Card" : "+1"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* 底部按钮区 */}
              <div className="relative z-10 px-8 pb-20">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowVictory(false);
                    // 钻石已经在飞行结束后自动加过了，这里只需关闭界面
                    setIsDiamondFlying(false);

                    // Lesson 3 and 4 automatic furniture rewards
                    if (quizIndex === 4 && !furniture.includes("rug")) {
                      setFurniture((prev) => [...prev, "rug"]);
                    } else if (
                      quizIndex === 5 &&
                      !furniture.includes("table")
                    ) {
                      setFurniture((prev) => [...prev, "table"]);
                    }

                    // 如果是关卡2（胜利后quizIndex因为+1变成了3），跳入连胜抽奖流，否则走正常连胜/房屋升级流
                    if (quizIndex === 3) {
                      setShowStreakDraw(true);
                    } else {
                      setShowWinStreak(true);
                    }
                  }}
                  className="w-full h-18 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-[24px] flex items-center justify-center shadow-[0_20px_40px_-12px_rgba(37,99,235,0.5)] border-t border-white/20 transition-all duration-300 group"
                >
                  <span className="font-black text-2xl uppercase tracking-wider group-hover:tracking-widest transition-all">
                    Continue
                  </span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 新增连胜结算弹层 */}
        <AnimatePresence>
          {showWinStreak && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[350] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              {/* 连胜底图居中显示 */}
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/lianshengjiemian.png"
                  alt="Win Streak"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* 中心数字区域 */}
              <div className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10">
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.5, 0.8, 1.2, 1] }}
                  transition={{
                    delay: 0.5,
                    duration: 0.8,
                    times: [0, 0.2, 0.4, 0.8, 1],
                  }}
                  onAnimationComplete={() => {
                    if (winStreakNumber === 1) {
                      setWinStreakNumber(2);
                    }
                  }}
                  className="text-white text-9xl font-black drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                  style={{ textShadow: "0px 8px 16px rgba(0,0,0,0.8)" }}
                >
                  {winStreakNumber}
                </motion.div>
              </div>

              {/* 底部继续按钮区 */}
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    hapticFeedback.light();
                    setShowWinStreak(false);
                    // Return to map (exterior) for Lesson 6, 7, 8 (quizIndex 7, 8, 9)
                    if (quizIndex >= 7 && quizIndex <= 9) {
                      setActiveTab("town");
                      setScene("exterior");

                      // If Lesson 8 just finished, show the restaurant unlock dialogue first
                      if (quizIndex === 9) {
                        setShowRestaurantUnlockDialogue(true);
                        hapticFeedback.reward();
                      }
                    } else if (quizIndex === 2 || quizIndex === 6) {
                      setShowBuildingUpgrade(true);
                    } else {
                      // Default behavior
                      setActiveTab("town");
                      setScene("interior");
                    }
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Continue"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-2xl tracking-[0.1em] drop-shadow-md">
                    Continue
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第二关连胜抽奖界面 */}
        <AnimatePresence>
          {showStreakDraw && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[360] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/lianxuechoujiang.png"
                  alt="Streak Draw"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowStreakDraw(false);
                    setShowStreakReward(true);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Push"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-2xl tracking-[0.1em] drop-shadow-md">
                    PUSH
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第二关连胜奖品界面 */}
        <AnimatePresence>
          {showStreakReward && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[370] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/lianxuejiangpin.png"
                  alt="Streak Reward"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowStreakReward(false);
                    setShowWinStreak2(true);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Collect Continue"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-lg tracking-[0.05em] drop-shadow-md">
                    COLLECT CONTINUE
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第二关连胜结算弹层 */}
        <AnimatePresence>
          {showWinStreak2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[380] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/liangsheng2.png"
                  alt="Win Streak 2"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setWinStreakNumber(3);
                    setShowWinStreak2(false);
                    // Add sofa1 to furniture and go back to interior scene
                    if (!furniture.includes("shafa1")) {
                      setFurniture((prev) => [...prev, "shafa1"]);
                    }
                    setActiveTab("town");
                    setScene("interior");
                    setShowGrannySofaDialogue(true);

                    // Show task bubble - only if it's past the second lesson
                    if (quizIndex > 2 && quizIndex !== 3) {
                      setShowNewTaskBubble(true);
                      hapticFeedback.success();
                    }

                    setTimeout(() => {
                      setShowGrannySofaDialogue(false);
                      setShowNewTaskBubble(false);
                    }, 3000);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Continue"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-2xl tracking-[0.1em] drop-shadow-md">
                    Continue
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Restaurant Unlock Dialogue */}
        <AnimatePresence>
          {showRestaurantUnlockDialogue && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center border-4 border-amber-400 relative overflow-hidden"
              >
                {/* Bun Avatar Header */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-amber-50 border-b-4 border-amber-100 flex items-center px-6">
                  <div className="w-16 h-16 bg-white rounded-2xl p-1 border-2 border-amber-200 shadow-sm flex-shrink-0">
                    <img
                      src="/assets/buntouxiang.png"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="ml-4 text-left">
                    <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                      Bun says:
                    </div>
                    <div className="text-stone-800 font-black text-lg italic">
                      {(guideDialoguesConfig.events.find(
                        (e) => e.event_id === "building_unlock_reward",
                      )?.dialogues[0] as any)?.title || "Great News!"}
                    </div>
                  </div>
                </div>

                <div className="mt-20 flex flex-col items-center">
                  <div className="relative mb-6">
                    <motion.div
                      animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-0 bg-amber-100 rounded-full blur-2xl opacity-60"
                    />
                    <div className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center shadow-xl border-2 border-amber-50 relative z-10 p-4">
                      <img
                        src="/assets/canting.png"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-stone-800 mb-4 uppercase tracking-tighter">
                    LingoVille Expansion!
                  </h3>

                  <ConfigBubble
                    file="guide_dialogues.json"
                    field="text_en"
                    align="center"
                    className="mb-8"
                  >
                    <p className="text-stone-600 font-bold leading-relaxed">
                      "
                      {guideDialoguesConfig.events.find(
                        (e) => e.event_id === "building_unlock_reward",
                      )?.dialogues[0]?.text_en ||
                        "Wonderful! You've completed the Pizza Corner. Now it's time to unveil our grand Restaurant!"}
                      "
                    </p>
                  </ConfigBubble>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowRestaurantUnlockDialogue(false);
                      setIsRestaurantFalling(true);
                      setIsRestaurantUnlocked(true);
                      setTimeout(() => {
                        setIsRestaurantFalling(false);
                      }, 4000); // Increased time for the fancy landing
                    }}
                    className="w-full h-18 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-orange-200/50 transition-all border-b-6 border-orange-800 relative z-10 uppercase tracking-widest"
                  >
                    Unveil Now!
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 新增建筑升级弹层 */}
        <AnimatePresence>
          {showBuildingUpgrade && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[400] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              {/* 升级底图居中显示 */}
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/jianzhushengj.png"
                  alt="Building Upgrade"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* 底部 Upgrade 按钮区 */}
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowBuildingUpgrade(false);
                    // 返回主界面展示建筑升级效果
                    setActiveTab("town");
                    setScene("exterior");
                    setTownEventStep(2);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Upgrade"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-2xl tracking-[0.1em] drop-shadow-md">
                    Upgrade
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 课程简介弹窗 */}
        <AnimatePresence>
          {selectedLesson && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[160] flex items-center justify-center bg-black/60 p-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative w-full max-w-[1680px] aspect-[4/5] flex items-center justify-center p-2"
              >
                {/* 使用现有的任务底板作为背景 */}
                <img
                  src="/assets/renwudiban.png"
                  className="absolute inset-0 w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />

                {/* 关闭按钮 */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedLesson(null)}
                  className="absolute top-[-2%] right-[2%] w-10 h-10 z-20"
                >
                  <img
                    src="/assets/renwuguanbi.png"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.button>

                {/* 弹窗内容 */}
                <div className="relative z-10 w-[75%] h-[60%] mt-32 flex flex-col items-center">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 border-4 border-amber-200">
                    <Book className="w-10 h-10 text-amber-600" />
                  </div>

                  <h2 className="text-xl font-black text-amber-900 mb-2 truncate w-full text-center">
                    {selectedLesson.title}
                  </h2>
                  <div className="text-[12px] font-bold text-amber-800/70 mb-8 uppercase tracking-widest">
                    Lesson {selectedLesson.id}
                  </div>

                  <div className="bg-amber-50/50 rounded-2xl p-4 mb-8 w-full border border-amber-100/50">
                    <p className="text-sm text-amber-900/80 font-medium leading-relaxed text-center">
                      Through this lesson, you will master everyday expressions
                      about "{selectedLesson.title}", and improve your language
                      skills through interaction.
                    </p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setQuizIndex(selectedLesson.id);
                      setSelectedLesson(null);
                      setShowQuiz(true);
                      showMessage(`Start learning: ${selectedLesson.title}`);
                    }}
                    className="w-40 h-12 relative"
                  >
                    <img
                      src="/assets/renwuanniu.png"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-amber-900 mb-0.5 pointer-events-none tracking-wider">
                      Start Learning
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 任务弹窗 */}
        <AnimatePresence>
          {showVictoryMsg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                const messages =
                  guideDialoguesConfig.events.find(
                    (e) => e.event_id === "first_lesson_complete",
                  )?.dialogues || [];
                if (victoryDialogueStep < messages.length - 1) {
                  setVictoryDialogueStep((prev) => prev + 1);
                } else {
                  setShowVictoryMsg(false);
                  setShowTownTabArrow(true);
                }
              }}
              className="absolute inset-0 z-[250] flex items-end justify-center pb-32 bg-black/40 backdrop-blur-sm px-6 cursor-pointer pointer-events-auto"
            >
              <motion.div
                key={victoryDialogueStep}
                initial={{ y: 50, scale: 0.9, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                className="relative flex items-end gap-3 max-w-sm w-full"
              >
                {/* 外部左侧头像 */}
                <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl bg-stone-100 flex-shrink-0 overflow-hidden relative z-10">
                  <img
                    src="/assets/buntouxiang.png"
                    className="w-full h-full object-cover -scale-x-100"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* 对话框主体 */}
                <div className="bg-white rounded-3xl p-6 shadow-2xl relative flex-1">
                  <h4 className="text-amber-600 font-black text-xs uppercase tracking-widest mb-1">
                    Grandmother
                  </h4>
                  <ConfigBubble
                    file="guide_dialogues.json"
                    field="text_en"
                    align="start"
                  >
                    <p className="text-stone-800 font-bold leading-relaxed">
                      {guideDialoguesConfig.events.find(
                        (e) => e.event_id === "first_lesson_complete",
                      )?.dialogues[victoryDialogueStep]?.text_en ||
                        "Hey! Your performance just now was amazing"}
                    </p>
                  </ConfigBubble>
                  <div className="mt-2 text-stone-400 text-[10px] uppercase font-bold tracking-widest">
                    Tap anywhere to continue
                  </div>
                  {/* 小气泡尖角 */}
                  <div className="absolute -left-2 bottom-6 w-4 h-4 bg-white rotate-45" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 指向小镇图标的箭头 */}
        <AnimatePresence>
          {showTownTabArrow && activeTab !== "town" && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: [0, -10, 0],
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
              }}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center pointer-events-none"
            >
              <div className="bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg mb-2 whitespace-nowrap">
                Tap here to enter the town
              </div>
              <ArrowBigDown className="w-8 h-8 text-amber-500 fill-amber-500 drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>

        {showReview && (
          <ReviewScreen
            onClose={() => setShowReview(false)}
            stamina={stamina}
            setGlobalStamina={setStamina}
            mistakes={userMistakes}
          />
        )}

        {/* 指向章节图标的箭头 */}
        <AnimatePresence>
          {showTasks && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 p-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative w-full max-w-[1800px] aspect-[4/5] flex items-center justify-center p-2"
              >
                <img
                  src="/assets/renwudiban.png"
                  className="absolute inset-0 w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setShowTasks(false);
                    setHasNewTaskCompleted(false);
                  }}
                  className="absolute top-[-2%] right-[2%] w-12 h-12 z-20"
                >
                  <img
                    src="/assets/renwuguanbi.png"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.button>

                <div className="relative z-10 w-[82%] h-[60%] mt-32 flex flex-col gap-3 overflow-y-auto px-2 overflow-x-hidden pt-2">
                  <AnimatePresence initial={false}>
                    {currentTasks.map((task, idx) => (
                      <motion.div
                        layout
                        key={`task-${task.id}-${task.lessonId}`}
                        initial={{ opacity: 0, x: 200, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          x: -500,
                          transition: {
                            duration: 0.5,
                            ease: [0.32, 0, 0.67, 0],
                          },
                        }}
                        transition={{
                          duration: 0.4,
                          type: "spring",
                          damping: 20,
                        }}
                        className="bg-white/90 rounded-xl p-2.5 flex items-center gap-3 border-2 border-white shadow-sm flex-shrink-0"
                      >
                        <div className="w-12 h-12 bg-amber-100 rounded-lg flex-shrink-0 flex items-center justify-center border border-amber-200 relative overflow-hidden">
                          <img
                            src={task.rewardImage}
                            className="w-10 h-10 object-contain z-10"
                            referrerPolicy="no-referrer"
                          />
                          {task.isActive && (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 4,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="absolute inset-0 bg-gradient-to-t from-amber-400/20 to-transparent"
                            />
                          )}
                        </div>
                        <div className="flex-grow">
                          <h3 className="text-neutral-800 text-[11px] font-black uppercase leading-tight">
                            {task.title}
                          </h3>
                          <p className="text-stone-500 text-[8px] font-bold mt-0.5">
                            Lesson {task.lessonId}
                          </p>
                        </div>
                        <div className="absolute -top-1 -right-1 w-8 h-8 z-20 pointer-events-none">
                          <img
                            src={task.rewardImage}
                            className="w-full h-full object-contain drop-shadow-md"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if (task.isCompleted) {
                              // Already done, maybe show a check animation?
                              return;
                            }
                            setShowTasks(false);
                            handleStartGame();
                          }}
                          className={`w-14 h-7 flex-shrink-0 relative transition-opacity ${task.isCompleted ? "cursor-default" : ""}`}
                        >
                          <img
                            src="/assets/renwuanniu.png"
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-amber-950 mb-0.5 pointer-events-none uppercase">
                            {task.isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              "GO"
                            )}
                          </span>
                        </motion.button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 课程大纲弹窗 */}
        <AnimatePresence>
          {showCourseOutline && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="relative w-full max-w-[400px] max-h-[80%] bg-[#F5F5F7] rounded-[24px] shadow-xl flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-4 bg-white shadow-sm z-10">
                  <ConfigBubble file="lessons.json" field="outline_title">
                    <h2 className="text-[#333] font-black text-xl tracking-tight">
                      {(lessonsConfig as any).outline_title || "Course Outline"}
                    </h2>
                  </ConfigBubble>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCourseOutline(false)}
                    className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-full text-stone-500"
                  >
                    ×
                  </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
                  {lessonsConfig.lessons.map((lesson, idx) => {
                    const isCompleted = quizIndex > lesson.lesson_id;
                    const isCurrent = quizIndex === lesson.lesson_id;
                    const isLocked = quizIndex < lesson.lesson_id;
                    const stage = lesson.unit_id;

                    return (
                      <div
                        key={lesson.lesson_id}
                        className={`flex gap-4 p-4 rounded-[16px] border-2 transition-colors ${isCurrent ? "bg-white border-[#5A52E0] shadow-md" : isCompleted ? "bg-white/60 border-stone-200" : "bg-stone-50 border-stone-200/50 opacity-80"}`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden ${isCurrent ? "bg-[#5A52E0]/10" : isCompleted ? "bg-green-100" : "bg-stone-200"}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          ) : isLocked ? (
                            <div className="w-5 h-5 border-2 border-stone-400 rounded-full border-t-transparent flex items-center justify-center">
                              <div className="w-2 h-2 bg-stone-400 rounded-full" />
                            </div>
                          ) : (
                            <Book className="w-6 h-6 text-[#5A52E0]" />
                          )}
                        </div>
                        <div className="flex flex-col justify-center flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              {stage}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase ${isCurrent ? "text-[#5A52E0]" : isCompleted ? "text-green-500" : "text-stone-400"}`}
                            >
                              {isCompleted
                                ? "Completed"
                                : isCurrent
                                  ? "In Progress"
                                  : "Locked"}
                            </span>
                          </div>
                          <ConfigBubble file="lessons.json" field="title">
                            <h3
                              className={`font-black text-base ${isLocked ? "text-stone-400" : "text-stone-800"}`}
                            >
                              Lesson {lesson.lesson_id}: {lesson.title}
                            </h3>
                          </ConfigBubble>
                          <ConfigBubble
                            file="lessons.json"
                            field="description"
                            className="mt-1"
                          >
                            <p
                              className={`text-[12px] font-bold ${isLocked ? "text-stone-300" : "text-stone-500"}`}
                            >
                              {lesson.description}
                            </p>
                          </ConfigBubble>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Onboarding Flow: onboardingStep 1 to 9 */}
        <AnimatePresence>
          {onboardingStep <= 9 && (
            <motion.div
              key="onboarding-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[99999] bg-[#1a1a1a] flex flex-col items-center justify-between pointer-events-auto overflow-hidden"
            >
              {/* Background */}
              <img
                src={
                  onboardingStep === 1
                    ? "/assets/xinshou1.png"
                    : onboardingStep === 2
                    ? "/assets/xinshou2.png"
                    : onboardingStep === 3
                    ? "/assets/xinshou3.png"
                    : "/assets/quanbubg1.png"
                }
                className="absolute inset-0 w-full h-full object-cover"
                alt="Background"
                referrerPolicy="no-referrer"
              />

              {/* Header with Icon and Title */}
              <AnimatePresence>
                {onboardingStep > 3 && onboardingStep < 9 && (
                  <motion.div
                    key="top-header"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, position: "absolute" }}
                    transition={{ type: "tween", duration: 0.2 }}
                    className="relative z-20 w-full pt-16 px-6 flex flex-col pointer-events-auto shrink-0"
                  >
                    {/* Top Bar with Back Button & Progress */}
                    <motion.div
                      className="flex items-center w-full mb-8"
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                      }}
                    >
                      <button
                        onClick={() =>
                          setOnboardingStep((prev) => Math.max(1, prev - 1))
                        }
                        className="w-10 h-10 shrink-0 flex items-center justify-center p-2 rounded-xl group active:scale-95 transition-transform"
                      >
                        <img
                          src="/assets/fanhui.png"
                          className="w-full h-full object-contain drop-shadow-sm group-hover:brightness-90 brightness-0 opacity-70"
                          referrerPolicy="no-referrer"
                        />
                      </button>

                      {/* Progress bar for steps 3-6 */}
                      {onboardingStep >= 3 && onboardingStep <= 6 && (
                        <div className="flex-1 flex gap-2 mx-4 items-center">
                          {[1, 2, 3, 4].map((step) => (
                            <div
                              key={step}
                              className={`h-3 rounded-full flex-1 transition-colors duration-500 ${step <= onboardingStep - 2 ? "bg-[#58CC02]" : "bg-stone-400"}`}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>

                    <div className="flex items-start gap-4 relative w-full">
                      <motion.img
                        key={`rabbit-${onboardingStep}`}
                        initial={
                          onboardingStep >= 2 && onboardingStep <= 8
                            ? { x: -100, opacity: 0 }
                            : false
                        }
                        animate={
                          onboardingStep >= 2 && onboardingStep <= 8
                            ? { x: 0, opacity: 1 }
                            : false
                        }
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        src="/assets/xiaotuzijiemian.png"
                        alt="Rabbit Icon"
                        className={`object-contain drop-shadow-md flex-shrink-0 relative z-10 ${onboardingStep >= 3 && onboardingStep <= 8 ? "w-20 h-20" : "w-14 h-14"}`}
                        referrerPolicy="no-referrer"
                      />
                      {onboardingStep >= 3 && onboardingStep <= 8 ? (
                        <motion.div
                          key={`bubble-${onboardingStep}`}
                          initial={{ opacity: 0, scale: 0.5, x: -20 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.1,
                          }}
                          className="relative bg-slate-50 border-2 border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm mt-1"
                          style={{ transformOrigin: "top left" }}
                        >
                          <div className="absolute top-1 -left-2 w-3 h-3 bg-slate-50 border-l-2 border-t-2 border-slate-200 -rotate-45 z-0" />
                          <h1 className="relative z-10 text-stone-800 font-extrabold text-lg tracking-tight leading-snug">
                            {ONBOARDING_TITLES[onboardingStep - 1]}
                          </h1>
                        </motion.div>
                      ) : (
                        <motion.h1
                          key={`title-${onboardingStep}`}
                          initial={
                            onboardingStep === 2
                              ? { opacity: 0, x: -20 }
                              : false
                          }
                          animate={
                            onboardingStep === 2 ? { opacity: 1, x: 0 } : false
                          }
                          transition={{ delay: 0.1 }}
                          className="text-stone-800 font-extrabold text-2xl drop-shadow-sm tracking-tight leading-snug mt-2"
                        >
                          {ONBOARDING_TITLES[onboardingStep - 1]}
                        </motion.h1>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Middle Section Dynamic Content */}
              <div className="relative w-full flex-1 flex flex-col items-center z-10 pointer-events-auto px-6 mt-4 overflow-x-hidden overflow-y-auto">
                <AnimatePresence mode="wait">
                  {onboardingStep === 1 && (
                    <motion.div
                      key="step1"
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col items-center pt-16 w-full relative"
                    >
                      <h1 className="text-[#FF4B4B] font-black text-[2rem] drop-shadow-sm tracking-wide leading-[1.1] text-center mb-3">
                        The most fun way<br />to learn language
                      </h1>
                      <p className="text-black font-extrabold text-[1.1rem] drop-shadow-xs">
                        Start your language adventure Now!
                      </p>
                    </motion.div>
                  )}

                  {onboardingStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="relative flex-1 flex flex-col w-full items-center pt-16 pointer-events-none"
                    >
                      <h1 className="text-[#FF4B4B] font-black text-[2rem] drop-shadow-sm tracking-wide leading-[1.1] text-center mb-3">
                        Learning in<br />real-life situations
                      </h1>
                      <p className="text-black font-extrabold text-[1.1rem] drop-shadow-xs">
                        Immerse in real-world language.
                      </p>
                      
                      {/* Interaction Area */}
                      <div className="flex-1 w-full flex flex-col justify-center items-center mt-4">
                        {/* NPC avatars and bubbles */}
                        <div className="w-full flex justify-between items-start px-2 mb-4 shrink-0 relative h-32">
                          {/* Left NPC */}
                          <div className="flex gap-2">
                            <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                              <img src="/assets/qitatouxiangdi.png" className="absolute inset-0 w-full h-full object-contain" />
                              <img src="/assets/npc1.png" className="absolute w-[68%] h-[68%] object-contain rounded-full" style={{ top: '10%' }} />
                              <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 text-[#4E2B02] text-[8px] font-black uppercase whitespace-nowrap tracking-wide leading-none">MIA</div>
                            </div>
                            <div className="relative px-3 py-2 bg-white border-2 border-orange-400 rounded-xl shadow-sm text-stone-800 font-bold text-xs max-w-[140px]">
                              <TypewriterText 
                                text="Hey! What can I get for you?" 
                                onComplete={() => setTimeout(() => setStep2Phase(1), 500)} 
                              />
                              <div className="absolute top-[10px] -left-[8px] border-r-[8px] border-r-orange-400 border-y-transparent border-y-[6px] w-0 h-0" />
                              <div className="absolute top-[12px] -left-[5px] border-r-[6px] border-r-white border-y-transparent border-y-[4px] w-0 h-0" />
                            </div>
                          </div>

                          {/* Right NPC */}
                          {step2Phase >= 6 && (
                            <div className="flex gap-2 absolute right-2 top-10">
                              <div className="relative px-3 py-2 bg-white border-2 border-blue-500 rounded-xl shadow-sm text-stone-800 font-bold text-xs max-w-[140px]">
                                <TypewriterText text="I'd like a Latte, please." />
                                <div className="absolute top-[10px] -right-[8px] border-l-[8px] border-l-blue-500 border-y-transparent border-y-[6px] w-0 h-0" />
                                <div className="absolute top-[12px] -right-[5px] border-l-[6px] border-l-white border-y-transparent border-y-[4px] w-0 h-0" />
                              </div>
                              <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                                <img src="/assets/zhujuetouxiangdi.png" className="absolute inset-0 w-full h-full object-contain" />
                                <img src="/assets/zhujue1.png" className="absolute w-[68%] h-[68%] object-contain rounded-full" style={{ top: '10%' }} />
                                <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 text-[#4E2B02] text-[8px] font-black uppercase whitespace-nowrap tracking-wide leading-none">ME</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* White Board sentence builder */}
                        <div className="w-full bg-white rounded-2xl shadow-xl p-4 border-2 border-stone-200 mt-auto mb-8 max-w-[320px]">
                          {/* Target Blanks */}
                          <div className="flex flex-wrap gap-2 mb-6 min-h-[40px] items-center pb-2 border-b-2 border-stone-100">
                            {["I'd", "like", "a", "Latte", "please."].map((word, i) => (
                              <div key={i} className={`h-8 flex-shrink-0 flex items-center justify-center rounded-lg px-3 font-extrabold text-sm transition-all ${step2Phase > i ? "bg-white border-2 border-[#1CB0F6] text-[#1CB0F6] shadow-sm" : "border-b-2 border-stone-300 text-transparent"}`}>
                                {step2Phase > i ? word : word}
                              </div>
                            ))}
                          </div>
                          {/* Word Bank */}
                          <div className="flex gap-2 flex-wrap justify-center">
                            {["latte", "i'd", "please.", "a", "like"].map((word, i) => {
                              // map word to its answer index
                              const ansIdx = ["I'd", "like", "a", "Latte", "please."].findIndex(w => w.toLowerCase() === word.toLowerCase());
                              const isUsed = step2Phase > ansIdx;
                              return (
                                <div key={i} className={`px-4 py-2 rounded-xl font-extrabold text-sm transition-all ${isUsed ? "bg-stone-200 text-stone-300 shadow-none scale-95" : "bg-white border-2 border-stone-200 shadow-[0_4px_0_0_#e5e7eb] text-stone-700"}`}>
                                  {word}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="w-full flex-1 flex flex-col pt-16 items-center pointer-events-none"
                    >
                      <h1 className="text-[#FF4B4B] font-black text-[2rem] drop-shadow-sm tracking-wide leading-[1.1] text-center mb-3">
                        Learn a language<br />like playing a game
                      </h1>
                      <p className="text-black font-extrabold text-[1.1rem] drop-shadow-xs mb-8">
                        Every lesson grows your town.
                      </p>

                      <div className="flex-1 w-full flex flex-col items-center mt-2 relative perspective-1000">
                        {/* Activity Card */}
                        <motion.img 
                          src="/assets/xinshou31.png" 
                          className="w-48 object-contain drop-shadow-xl z-20"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                        />
                        
                        {step3Phase >= 1 && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-stone-400 my-2 z-10"
                          >
                            <ArrowDown className="w-8 h-8" strokeWidth={3} />
                          </motion.div>
                        )}

                        <div className="flex items-center gap-2 z-10 mt-2">
                          {step3Phase >= 2 && (
                            <motion.img 
                              src="/assets/xinshou32.png"
                              className="w-[100px] object-contain drop-shadow-lg"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                            />
                          )}
                          
                          {step3Phase >= 3 && (
                            <motion.div 
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              className="text-stone-400"
                            >
                              <ArrowRight className="w-6 h-6" strokeWidth={3} />
                            </motion.div>
                          )}

                          {step3Phase >= 4 && (
                            <motion.img 
                              src="/assets/xinshou33.png"
                              className="w-[120px] object-contain drop-shadow-2xl"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ 
                                opacity: 1, 
                                scale: [1, 1.05, 1],
                              }}
                              transition={{
                                scale: {
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 5 && (
                    <motion.div
                      key="step4"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed">
                        This will help to adapt the first lesson to your level.
                      </p>
                      <div className="flex flex-col gap-4 pb-8">
                        {[
                          { text: "Not very much", bars: 1 as const },
                          { text: "I know some", bars: 2 as const },
                          { text: "I know a lot", bars: 3 as const },
                        ].map((level, idx) => (
                          <div
                            key={`${level.text}-${idx}`}
                            onClick={() => setKnowledgeLevel(level.text)}
                            className={`bg-white rounded-2xl p-5 flex items-center justify-between shadow-sm border-2 ${knowledgeLevel === level.text ? "border-[#1CB0F6] bg-blue-50/50" : "border-stone-200"} cursor-pointer active:scale-95 transition-all w-full`}
                          >
                            <span className="text-stone-800 font-extrabold text-lg">
                              {level.text}
                            </span>
                            <SignalBars level={level.bars} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 6 && (
                    <motion.div
                      key="step5"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed">
                        We'll tailor lessons to your goal.
                      </p>
                      <div className="flex flex-col gap-3 pb-8">
                        {[
                          {
                            id: "travel",
                            text: "Travel & explore cultures",
                            Icon: Plane,
                          },
                          {
                            id: "move",
                            text: "Move to another country",
                            Icon: Home,
                          },
                          {
                            id: "education",
                            text: "Support my education",
                            Icon: GraduationCap,
                          },
                          {
                            id: "career",
                            text: "Boost my career",
                            Icon: Briefcase,
                          },
                          {
                            id: "connect",
                            text: "Connect with people",
                            Icon: Users,
                          },
                          { id: "fun", text: "Just for fun", Icon: Smile },
                          { id: "other", text: "Other", Icon: MoreHorizontal },
                        ].map((goal, idx) => {
                          const isSelected = learningGoals.includes(goal.id);
                          return (
                            <div
                              key={`${goal.id}-${idx}`}
                              onClick={() =>
                                setLearningGoals((prev) =>
                                  isSelected
                                    ? prev.filter((g) => g !== goal.id)
                                    : [...prev, goal.id],
                                )
                              }
                              className={`bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border-2 ${isSelected ? "border-[#1CB0F6] bg-blue-50/50" : "border-stone-200"} cursor-pointer active:scale-95 transition-all w-full`}
                            >
                              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                                <goal.Icon
                                  className={`w-8 h-8 ${isSelected ? "text-[#1CB0F6]" : "text-stone-400"}`}
                                />
                              </div>
                              <span
                                className={`font-extrabold text-lg ${isSelected ? "text-[#1CB0F6]" : "text-stone-800"}`}
                              >
                                {goal.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 4 && (
                    <motion.div
                      key="step6"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed text-center">
                        We'll use this language to help you learn. You can
                        change it in Settings.
                      </p>

                      <div className="relative w-full flex-1 flex items-center justify-center mt-8">
                        {/* Top floating UI */}
                        <div className="absolute top-0 flex flex-col mt-[-20px] left-1/2 -translate-x-1/2 w-[240px]">
                          <div className="bg-[#ccfbf1] text-[#0f766e] font-black px-4 py-2.5 rounded-2xl w-fit xl shadow-sm border-2 border-[#5eead4] z-10 self-start">
                            English
                          </div>
                          <div className="absolute top-[50%] left-[30%] -translate-x-1/2 -translate-y-1/2 z-20 flex">
                            <ArrowRightLeft className="w-8 h-8 text-stone-400 rotate-45 drop-shadow-md" />
                          </div>
                          <div className="bg-[#f3e8ff] text-[#7e22ce] font-black px-4 py-2.5 rounded-2xl w-fit shadow-sm border-2 border-[#d8b4fe] z-10 self-end mt-4">
                            Your native language
                          </div>
                        </div>

                        {/* Rabbit */}
                        <img
                          src="/assets/xiaotuzijiemian.png"
                          className="w-48 h-48 object-contain -translate-y-8 drop-shadow-xl"
                          referrerPolicy="no-referrer"
                        />

                        {/* Options */}
                        <div className="absolute bottom-8 left-4 flex flex-col gap-4 bg-white/50 backdrop-blur px-6 py-4 rounded-3xl shadow-sm border-2 border-white">
                          {["English", "Chinese"].map((lang, idx) => (
                            <div
                              key={`${lang}-${idx}`}
                              onClick={() => setNativeLang(lang)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${nativeLang === lang ? "border-[#58CC02] bg-[#58CC02]" : "border-stone-300 group-hover:border-stone-400"} transition-colors`}
                              >
                                {nativeLang === lang && (
                                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                                )}
                              </div>
                              <span
                                className={`font-extrabold text-lg ${nativeLang === lang ? "text-[#58CC02]" : "text-stone-500"}`}
                              >
                                {lang}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 7 && (
                    <motion.div
                      key="step7"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col items-center justify-center mt-2 max-w-sm px-4 space-y-12"
                    >
                      {/* Circular Progress */}
                      <div className="relative w-48 h-48 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                          <circle
                            cx="96"
                            cy="96"
                            r="80"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            className="text-stone-200"
                          />
                          <circle
                            cx="96"
                            cy="96"
                            r="80"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray="502.65"
                            strokeDashoffset={
                              502.65 - (502.65 * loadingProgress) / 100
                            }
                            className="text-[#58CC02] transition-all duration-100 ease-linear"
                          />
                        </svg>
                        <span className="text-5xl font-black text-[#58CC02] drop-shadow-sm">
                          {loadingProgress}%
                        </span>
                      </div>

                      {/* Loading Texts */}
                      <div className="flex flex-col gap-5 w-full px-2">
                        {[
                          {
                            text: "Analyzing your learning needs",
                            threshold: 0,
                          },
                          {
                            text: "Creating a personalized learning plan",
                            threshold: 33,
                          },
                          {
                            text: "Customizing exclusive content",
                            threshold: 66,
                          },
                        ].map((item, idx, arr) => {
                          const isStarted = loadingProgress >= item.threshold;
                          const isCompleted =
                            loadingProgress >= (arr[idx + 1]?.threshold ?? 100);

                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between text-[15px] font-bold ${isStarted ? "text-stone-700" : "text-stone-300"} transition-colors`}
                            >
                              <div className="flex items-center gap-1">
                                <span>{item.text}</span>
                                {isStarted && !isCompleted && <LoadingDots />}
                              </div>
                              {isCompleted && (
                                <CheckCircle2 className="w-6 h-6 text-[#1CB0F6] flex-shrink-0 drop-shadow-sm" />
                              )}
                              {!isCompleted && isStarted && (
                                <div className="w-6 h-6 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 8 && (
                    <motion.div
                      key="step8"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm px-2"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed text-center">
                        Tailored to your goals, level, and interests and
                        preference.
                      </p>

                      <div className="flex flex-col gap-4 pb-8 w-full">
                        {/* Button 1: English Level */}
                        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border-2 border-stone-200 cursor-pointer active:scale-95 transition-all w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <User className="w-6 h-6 text-blue-500" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-stone-500 font-bold text-[10px] uppercase tracking-wider">
                                English Level
                              </span>
                              <span className="text-stone-800 font-black text-lg">
                                Beginner - A1
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-stone-300" />
                        </div>

                        {/* Button 2: Learning Goal */}
                        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border-2 border-stone-200 cursor-pointer active:scale-95 transition-all w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <Plane className="w-6 h-6 text-green-500" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-stone-500 font-bold text-[10px] uppercase tracking-wider">
                                Learning Goal
                              </span>
                              <span className="text-stone-800 font-black text-lg">
                                Prepare to travel
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-stone-300" />
                        </div>

                        {/* Button 3: Language */}
                        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border-2 border-stone-200 cursor-pointer active:scale-95 transition-all w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                              <span className="text-2xl leading-none">🇺🇸</span>
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-stone-500 font-bold text-[10px] uppercase tracking-wider">
                                Language
                              </span>
                              <span className="text-stone-800 font-black text-lg">
                                English
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-stone-300" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 9 && (
                    <motion.div
                      key="step9"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                      }}
                      className="w-full flex-1 flex flex-col items-center justify-center mt-2 px-2 text-center h-full pb-8"
                    >
                      <h1 className="text-stone-800 font-black text-6xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] tracking-tighter uppercase mb-6 transform -rotate-3 text-[#58CC02] stroke-white stroke-2 z-10 relative">
                        Perfect!
                      </h1>
                      <img
                        src="/assets/xiaotuzijiemian.png"
                        className="w-64 h-64 object-contain drop-shadow-2xl animate-bounce translate-y-8"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Continue Button */}
              {onboardingStep !== 7 && (
                <div className="relative z-10 w-full p-8 pb-12 mt-auto">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (onboardingStep === 3) {
                        setOnboardingStep(10);
                      } else {
                        setOnboardingStep((prev) => prev + 1);
                      }
                    }}
                    className={`w-full text-white font-black text-xl py-4 rounded-2xl shadow-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest pointer-events-auto ${
                      onboardingStep <= 3
                        ? "bg-[#FF4B4B] hover:bg-[#e03d3d] border-[#c02d2d]" 
                        : "bg-[#1CB0F6] hover:bg-[#1899D6] border-[#127ea6]"
                    }`}
                  >
                    {onboardingStep === 1 ? "GO" : onboardingStep === 9 ? "Let's Start" : "Continue"}
                  </motion.button>
                </div>
              )}
              {onboardingStep === 7 && (
                <div
                  className={`relative z-10 w-full p-8 pb-12 mt-auto transition-opacity duration-300 ${loadingProgress >= 100 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOnboardingStep((prev) => prev + 1)}
                    className="w-full bg-[#58CC02] hover:bg-[#46a302] text-white font-black text-xl py-4 rounded-2xl shadow-xl border-b-4 border-[#3b8a02] active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest pointer-events-auto"
                  >
                    Start Learning
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pre-onboarding Levels (Step 10 and 11) */}
        <AnimatePresence>
          {onboardingStep === 10 && (
            <motion.div
              key="pre-level-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[99999] bg-white pointer-events-auto overflow-hidden flex flex-col"
            >
              {/* Crisp Onboarding Background (xinshou4) with soft light overlay */}
              <div className="absolute inset-0 z-0 select-none">
                <img src="/assets/xinshou4.png" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-[1px]" />
              </div>

              {/* Chat area */}
              <div 
                className="relative z-10 w-full h-full pb-[280px] flex flex-col px-4 pt-16 overflow-y-auto scroll-smooth" 
                ref={chatEndRef}
              >
                {/* Message 1 (Mia) */}
                <ChatMessage 
                  sender="mia" 
                  name="mia" 
                  avatarBg="/assets/qitatouxiangdi.png" 
                  avatarImg="/assets/npc1.png" 
                  align="left"
                >
                  <TypewriterText 
                    text="Hi, welcome to LingoVille! I'm Mia — your learning buddy." 
                    onComplete={() => { 
                      if (preOnboardingDialogueStep === 0) {
                        setTimeout(() => { 
                          setPreOnboardingDialogueStep(1); 
                          if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                        }, 800);
                      } 
                    }} 
                    onWordTyped={() => {
                      if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                    }}
                  />
                </ChatMessage>
                
                {/* Message 2 (Mia) */}
                {preOnboardingDialogueStep >= 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage 
                      sender="mia" 
                      name="mia" 
                      avatarBg="/assets/qitatouxiangdi.png" 
                      avatarImg="/assets/npc1.png" 
                      align="left"
                    >
                      {preOnboardingDialogueStep === 1 ? (
                        <TypewriterText 
                          text="Before we get started, let's get to know each other. What's your name?" 
                          onComplete={() => { 
                            if (preOnboardingDialogueStep === 1) {
                              setTimeout(() => { 
                                setPreOnboardingDialogueStep(2); 
                                if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                              }, 800);
                            } 
                          }} 
                          onWordTyped={() => {
                            if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                          }}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">Before we get started, let's get to know each other. What's your name?</span>
                      )}
                    </ChatMessage>
                  </motion.div>
                )}

                {/* Message 3 (Player typing or completed) */}
                {preOnboardingDialogueStep === 2 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage 
                      sender="me" 
                      name="me" 
                      avatarBg="/assets/zhujuetouxiangdi.png" 
                      avatarImg="/assets/zhujue1.png" 
                      align="right"
                    >
                      <span className="font-extrabold text-stone-800 text-sm flex items-center gap-1.5 leading-none">
                        <span>I'm</span>
                        <span className="inline-flex gap-1 items-end relative top-0.5">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`w-4 border-b-2 text-center pb-0 text-base font-black uppercase ${
                                preOnboardingName[idx] ? "border-[#2563EB] text-[#2563EB]" : "border-stone-400 text-stone-300"
                              }`}
                            >
                              {preOnboardingName[idx] || "\u00A0"}
                            </span>
                          ))}
                        </span>
                      </span>
                    </ChatMessage>
                  </motion.div>
                )}

                {preOnboardingDialogueStep >= 3 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage 
                      sender="me" 
                      name="me" 
                      avatarBg="/assets/zhujuetouxiangdi.png" 
                      avatarImg="/assets/zhujue1.png" 
                      align="right"
                    >
                      <span className="whitespace-pre-wrap font-black text-stone-800">I'm {preOnboardingName}</span>
                    </ChatMessage>
                  </motion.div>
                )}

                {/* Message 4 (Mia: Perfect, [User]!) */}
                {preOnboardingDialogueStep >= 3 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage 
                      sender="mia" 
                      name="mia" 
                      avatarBg="/assets/qitatouxiangdi.png" 
                      avatarImg="/assets/npc1.png" 
                      align="left"
                    >
                      {preOnboardingDialogueStep === 3 ? (
                        <TypewriterText 
                          text={`Perfect, ${preOnboardingName}!\nI’ve got your info here.`} 
                          onComplete={() => { 
                            if (preOnboardingDialogueStep === 3) {
                              setTimeout(() => { 
                                setPreOnboardingDialogueStep(4); 
                                if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                              }, 1200);
                            } 
                          }} 
                          onWordTyped={() => {
                            if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                          }}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">{`Perfect, ${preOnboardingName}!\nI’ve got your info here.`}</span>
                      )}
                    </ChatMessage>
                  </motion.div>
                )}

                {/* Introduction Card (xinshou41) displayed right under Msg 4 */}
                {preOnboardingDialogueStep >= 4 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="flex justify-start mb-6 pl-16 z-10"
                  >
                    <div className="bg-white/95 p-3 rounded-[24px] border-3 border-orange-400 shadow-xl max-w-[240px]">
                      <img src="/assets/xinshou41.png" className="w-full h-auto rounded-xl object-contain" referrerPolicy="no-referrer" />
                    </div>
                  </motion.div>
                )}

                {/* Message 5 (Mia: Everything's set!) */}
                {preOnboardingDialogueStep >= 4 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage 
                      sender="mia" 
                      name="mia" 
                      avatarBg="/assets/qitatouxiangdi.png" 
                      avatarImg="/assets/npc1.png" 
                      align="left"
                    >
                      {preOnboardingDialogueStep === 4 ? (
                        <TypewriterText 
                          text="Everything's set! Your town will grow as you learn — let's get started!" 
                          onComplete={() => { 
                            if (preOnboardingDialogueStep === 4) {
                              setTimeout(() => { 
                                setPreOnboardingDialogueStep(5); 
                                if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                              }, 800);
                            } 
                          }} 
                          onWordTyped={() => {
                            if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
                          }}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">Everything's set! Your town will grow as you learn — let's get started!</span>
                      )}
                    </ChatMessage>
                  </motion.div>
                )}
                <div className="h-20 shrink-0" />
              </div>

              {/* Onboarding Name Input Pad at Step 2 */}
              <AnimatePresence>
                {preOnboardingDialogueStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 25 }}
                    className="absolute bottom-4 w-full px-4 max-w-sm mx-auto pointer-events-auto z-50 left-1/2 -translate-x-1/2"
                  >
                    <div className="flex flex-col gap-2 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border-2 border-stone-200">
                      {/* Keyboard Letters Row 1 */}
                      <div className="flex justify-center gap-1">
                        {"ABCDEFGHIJKLM".split("").map((letter, idx) => (
                          <button
                            key={`${letter}-${idx}`}
                            onClick={() => {
                              if (preOnboardingName.length < 4) {
                                hapticFeedback.light?.();
                                setNameInputError(null);
                                setPreOnboardingName((prev) => prev + letter);
                              }
                            }}
                            className="flex-[1_1_0] min-w-0 aspect-[2/3] bg-stone-100 text-stone-800 font-extrabold text-[13px] rounded-md border-b-2 border-stone-300 shadow-xs active:border-b-0 active:translate-y-0.5 active:shadow-none flex items-center justify-center p-0 hover:bg-stone-200 uppercase"
                          >
                            {letter}
                          </button>
                        ))}
                      </div>

                      {/* Keyboard Letters Row 2 (with DEL) */}
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => {
                            hapticFeedback.light?.();
                            setNameInputError(null);
                            setPreOnboardingName((prev) => prev.slice(0, -1));
                          }}
                          className="flex-[1.5_1.5_0] min-w-0 bg-stone-400 text-white font-extrabold text-[11px] rounded-md border-b-2 border-stone-500 shadow-xs active:border-b-0 active:translate-y-0.5 active:shadow-none flex items-center justify-center hover:bg-stone-500"
                        >
                          DEL
                        </button>
                        {"NOPQRSTUVWXYZ".split("").map((letter, idx) => (
                          <button
                            key={`${letter}-${idx}`}
                            onClick={() => {
                              if (preOnboardingName.length < 4) {
                                hapticFeedback.light?.();
                                setNameInputError(null);
                                setPreOnboardingName((prev) => prev + letter);
                              }
                            }}
                            className="flex-[1_1_0] min-w-0 aspect-[2/3] bg-stone-100 text-stone-800 font-extrabold text-[13px] rounded-md border-b-2 border-stone-300 shadow-xs active:border-b-0 active:translate-y-0.5 active:shadow-none flex items-center justify-center p-0 hover:bg-stone-200 uppercase"
                          >
                            {letter}
                          </button>
                        ))}
                      </div>

                      {/* Confirm Name Action Button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        disabled={preOnboardingName.length < 4 || nameRegistrationStatus !== "idle"}
                        onClick={confirmNewPlayerId}
                        className={`w-full py-4 mt-1.5 rounded-2xl shadow-md border-b-4 transition-all uppercase tracking-widest font-black text-lg text-white ${
                          preOnboardingName.length < 4 || nameRegistrationStatus !== "idle"
                            ? "bg-stone-400 border-stone-500 cursor-not-allowed opacity-50"
                            : "bg-[#1CB0F6] hover:bg-[#1899D6] border-[#127ea6] active:border-b-0 active:translate-y-1"
                        }`}
                      >
                        {nameRegistrationStatus === "checking" ? "Checking..." : "Confirm Name"}
                      </motion.button>
                      {nameInputError && (
                        <p className="text-center text-rose-500 text-[12px] font-black leading-snug px-2">
                          {nameInputError}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {existingPlayerIdPrompt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[90] bg-black/65 backdrop-blur-sm flex items-center justify-center px-6 pointer-events-auto"
                  >
                    <motion.div
                      initial={{ scale: 0.92, y: 18 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.92, y: 18 }}
                      className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl border-4 border-sky-100 text-center"
                    >
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
                        <User className="w-8 h-8 text-sky-500" />
                      </div>
                      <h2 className="text-stone-800 font-black text-xl mb-2">
                        ID 已注册
                      </h2>
                      <p className="text-stone-500 font-bold text-sm leading-relaxed mb-5">
                        {existingPlayerIdPrompt} 已经有学习记录。要读取这个 ID 的课程进度和错题记录吗？
                      </p>
                      <div className="flex flex-col gap-3">
                        <button
                          disabled={nameRegistrationStatus === "loading"}
                          onClick={loadExistingPlayerId}
                          className="w-full bg-[#58CC02] text-white py-3.5 rounded-2xl font-black shadow-[0_4px_0_#3b8a02] active:translate-y-1 active:shadow-none disabled:opacity-60"
                        >
                          {nameRegistrationStatus === "loading" ? "读取中..." : "读取此 ID"}
                        </button>
                        <button
                          disabled={nameRegistrationStatus === "loading"}
                          onClick={rejectExistingPlayerId}
                          className="w-full bg-stone-100 text-stone-700 py-3.5 rounded-2xl font-black shadow-[0_4px_0_#d6d3d1] active:translate-y-1 active:shadow-none disabled:opacity-60"
                        >
                          重新起名
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 5: Continue to Town */}
              <AnimatePresence>
                {preOnboardingDialogueStep === 5 && (
                  <motion.div
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 25 }}
                    className="absolute bottom-8 w-full px-8 max-w-sm mx-auto pointer-events-auto z-50 left-1/2 -translate-x-1/2"
                  >
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setOnboardingStep(12)}
                      className="w-full bg-[#58CC02] hover:bg-[#46a302] text-white font-black text-2xl py-5 rounded-[20px] shadow-xl border-b-4 border-[#3b8a02] active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest pointer-events-auto"
                    >
                      Continue
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 虚拟摇杆 (Virtual Joystick) */}
        <AnimatePresence>
          {joystickState && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[999] pointer-events-none rounded-full border border-white/20 bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-lg"
              style={{
                width: 120,
                height: 120,
                left: joystickState.origin.x - 60,
                top: joystickState.origin.y - 60,
              }}
            >
              {/* Inner knob */}
              <motion.div
                className="w-12 h-12 rounded-full border border-white/30 bg-white/70 backdrop-blur-md shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                style={{
                  x: joystickState.current.x - joystickState.origin.x,
                  y: joystickState.current.y - joystickState.origin.y,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {aiPracticeCategory && (
            <AiSpeakingPractice
              category={aiPracticeCategory}
              onBack={() => setAiPracticeCategory(null)}
            />
          )}
        </AnimatePresence>

        {/* --- Social Media Modal --- */}
        <AnimatePresence>
          {showSocial && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 z-[300] bg-white flex flex-col pointer-events-auto"
            >
              {/* Head */}
              <div className="h-24 pt-10 sm:h-20 sm:pt-6 flex items-center justify-between px-4 border-b border-stone-200 shrink-0">
                <button
                  onClick={() => {
                    setShowSocial(false);
                    if (guideSocialStep === 6) setGuideSocialStep(7);
                  }}
                  className="relative w-10 h-10 flex items-center justify-center"
                >
                  <img
                    src="/assets/fanhui.png"
                    className="w-6 h-6 object-contain opacity-70 invert"
                  />
                  {guideSocialStep === 6 && (
                    <div className="absolute inset-0 border-4 border-yellow-400 rounded-xl animate-pulse z-20">
                      <div className="absolute top-1/2 -right-6 -translate-y-1/2 -rotate-90">
                        <ArrowBigDown className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-bounce" />
                      </div>
                    </div>
                  )}
                </button>
                <h2 className="text-xl font-black text-stone-800">Moments</h2>
                <div className="w-10 h-10" />
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto bg-stone-100">
                {/* Banner */}
                <div className="h-48 bg-stone-300 relative">
                  <img
                    src="/assets/BG2.png"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute -bottom-8 right-4 flex items-end gap-3 z-10">
                    <span className="text-white font-black text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {preOnboardingName || "You"}
                    </span>
                    <div className="w-16 h-16 rounded-xl border-2 border-white shadow-md overflow-hidden bg-white">
                      <img
                        src="/assets/Amili.png"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-12 px-4 pb-20 space-y-6">
                  {socialPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100"
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full border border-stone-200 overflow-hidden shrink-0">
                          <img
                            src={post.avatar}
                            className="w-full h-full object-cover origin-bottom"
                            style={{ objectPosition: "bottom" }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-stone-800">
                            {post.author}
                          </h3>
                          <p className="text-stone-600 mt-1 text-[15px]">
                            {post.content}
                          </p>

                          <div className="mt-3 flex items-center justify-between opacity-60 text-xs text-stone-500 font-bold">
                            <span>{post.timestamp}</span>
                            <div className="flex gap-4">
                              <button
                                className="flex items-center gap-1 active:scale-95"
                                onClick={() => {
                                  setSocialPosts((posts) =>
                                    posts.map((p) => {
                                      if (p.id === post.id) {
                                        return {
                                          ...p,
                                          isLiked: !p.isLiked,
                                          likes: p.isLiked
                                            ? p.likes - 1
                                            : p.likes + 1,
                                        };
                                      }
                                      return p;
                                    }),
                                  );
                                }}
                              >
                                <Heart
                                  className={`w-4 h-4 ${post.isLiked ? "fill-red-500 text-red-500" : ""}`}
                                />
                                <span>{post.likes}</span>
                              </button>
                              <button className="flex items-center gap-1 active:scale-95">
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {post.comments.length > 0 && (
                            <div className="mt-3 bg-stone-50 rounded-xl p-2 space-y-1">
                              {post.comments.map((comment, idx) => (
                                <div key={idx} className="text-xs">
                                  <span className="font-bold text-stone-700">
                                    {comment.author}:{" "}
                                  </span>
                                  <span className="text-stone-600">
                                    {comment.content}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create Btn */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowSocialCreate(true);
                  if (guideSocialStep === 2) setGuideSocialStep(3);
                }}
                className="absolute bottom-6 right-6 w-14 h-14 bg-[#58CC02] text-white rounded-full flex items-center justify-center border-b-4 border-[#3b8a02] shadow-xl"
              >
                <Plus className="w-6 h-6" strokeWidth={3} />
                {guideSocialStep === 2 && (
                  <div className="absolute inset-0 border-4 border-yellow-400 rounded-full animate-pulse z-20">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                      <ArrowBigDown className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-bounce" />
                    </div>
                  </div>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSocialCreate && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 z-[350] bg-white flex flex-col pointer-events-auto"
            >
              <div className="h-24 pt-10 sm:h-20 sm:pt-6 flex items-center justify-between px-4 border-b border-stone-200 shrink-0">
                <button
                  className="text-stone-500 font-bold px-2 py-2"
                  onClick={() => setShowSocialCreate(false)}
                >
                  Cancel
                </button>
                <h2 className="text-lg font-black text-stone-800">New Post</h2>
                <button
                  disabled={!socialDraft.trim()}
                  className={`font-bold px-4 py-1.5 rounded-full ${socialDraft.trim() ? "bg-[#58CC02] text-white" : "bg-stone-200 text-stone-400"}`}
                  onClick={() => {
                    setSocialPosts([
                      {
                        id: Date.now(),
                        author: preOnboardingName || "You",
                        avatar: "/assets/Amili.png",
                        content: socialDraft,
                        likes: 0,
                        isLiked: false,
                        comments: [],
                        timestamp: "Just now",
                      },
                      ...socialPosts,
                    ]);
                    setSocialDraft("");
                    setShowSocialCreate(false);

                    if (guideSocialStep === 3) {
                      setGuideSocialStep(4);
                      setTimeout(() => {
                        setSocialReward({ fans: 120, customers: 15 });
                        setGuideSocialStep(5);
                      }, 500);
                    }
                  }}
                >
                  Post
                </button>
              </div>
              <div className="p-4 flex-1 relative">
                <textarea
                  className="w-full h-40 bg-transparent resize-none outline-none text-lg text-stone-700"
                  placeholder="Share your moments..."
                  autoFocus
                  value={socialDraft}
                  onChange={(e) => setSocialDraft(e.target.value)}
                />
                {guideSocialStep === 3 && (
                  <div className="absolute top-24 left-1/2 -translate-x-1/2 w-4/5 text-center text-amber-500 font-black animate-pulse pointer-events-none">
                    Write a nice review and tap 'Post'!
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {socialReward && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[400] bg-black/80 flex items-center justify-center p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <Heart className="w-10 h-10 text-emerald-500 fill-emerald-500" />
                </div>
                <h2 className="text-2xl font-black text-stone-800 mb-2">
                  Great Post!
                </h2>
                <p className="text-stone-600 font-bold mb-6">
                  Your social media post went viral!
                </p>

                <div className="bg-stone-50 w-full rounded-2xl p-4 flex gap-4 mb-6">
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xl font-black text-pink-500">
                      +{socialReward.fans}
                    </span>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-1">
                      Fans
                    </span>
                  </div>
                  <div className="w-px bg-stone-200" />
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xl font-black text-amber-500">
                      +{socialReward.customers}
                    </span>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-1">
                      Customers
                    </span>
                  </div>
                </div>

                <button
                  className="w-full bg-[#1CB0F6] text-white font-black py-4 rounded-xl shadow-[0_4px_0_#1899D6] active:translate-y-1 active:shadow-none"
                  onClick={() => {
                    setSocialReward(null);
                    if (guideSocialStep === 5) setGuideSocialStep(6);
                  }}
                >
                  Awesome
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* --- End Social Media Modal --- */}

        {/* --- Reset Confirmation Modal --- */}
        <AnimatePresence>
          {showResetConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[500] bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border-4 border-rose-100 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mb-4 text-rose-500 animate-pulse animate-duration-1000">
                  <RotateCcw className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-stone-800 mb-2">
                  确认重置进度？
                </h2>
                <p className="text-xs font-bold text-rose-500 mb-4 font-mono">
                  RESET GAME PROGRESS
                </p>
                <p className="text-stone-600 font-bold text-xs leading-relaxed mb-6">
                  这会彻底清空你的游戏游玩历史、解锁的建筑/场景、购买的装饰和所有学习进度。此操作不可逆！
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    className="flex-1 bg-stone-100 text-stone-700 font-black py-3 px-4 rounded-xl shadow-[0_4px_0_#d6d3d1] active:translate-y-1 active:shadow-none hover:bg-stone-200 transition-colors text-xs"
                    onClick={() => {
                      hapticFeedback.light?.();
                      setShowResetConfirm(false);
                    }}
                  >
                    取消 / Cancel
                  </button>
                  <button
                    className="flex-1 bg-rose-500 text-white font-black py-3 px-4 rounded-xl shadow-[0_4px_0_#be123c] active:translate-y-1 active:shadow-none hover:bg-rose-600 transition-colors text-xs"
                    onClick={() => {
                      hapticFeedback.success?.();
                      try {
                        localStorage.removeItem("app_user_id");
                      } catch (e) {
                        console.error(e);
                      }
                      window.location.reload();
                    }}
                  >
                    确认 / Reset
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Navigation */}
        <AnimatePresence>
          {onboardingStep >= 12 &&
            !aiPracticeCategory &&
            !showReview &&
            !(activeTab === "town" && scene === "interior") && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="absolute bottom-0 left-0 right-0 h-16 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[200] flex items-center justify-around px-2 pb-3 rounded-b-[48px] overflow-hidden translate-y-1"
              >
                <button
                  onClick={() => {
                    hapticFeedback.light();
                    setActiveTab("town");
                  }}
                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 relative"
                >
                  <Home
                    className={`w-7 h-7 mt-2 ${activeTab === "town" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "town" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    hapticFeedback.light();
                    setActiveTab("ai_custom");
                  }}
                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 relative"
                >
                  <Sparkles
                    className={`w-7 h-7 mt-2 ${activeTab === "ai_custom" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "ai_custom" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    hapticFeedback.light();
                    setActiveTab("ai_course");
                  }}
                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 relative"
                >
                  <Mic
                    className={`w-7 h-7 mt-2 ${activeTab === "ai_course" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "ai_course" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    hapticFeedback.light();
                    setActiveTab("profile");
                  }}
                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 z-10 relative"
                >
                  <User
                    className={`w-7 h-7 mt-2 ${activeTab === "profile" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "profile" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}
