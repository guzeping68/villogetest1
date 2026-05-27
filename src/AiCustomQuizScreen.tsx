import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Square, Sparkles, ArrowLeft, History, Zap, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { UnifiedQuiz } from "./UnifiedQuiz";
import { getApiUrl } from "./utils/api";
import {
  getMicrophonePermissionMessage,
  isMicrophonePermissionFailure,
  requestMicrophoneAccess,
} from "./utils/microphone";

const AI_CUSTOM_STAMINA_COST = 8;
const AI_CUSTOM_MAX_RECORD_SECONDS = 10;
const AI_CUSTOM_RECOGNITION_LANG_KEY = "lingoville_ai_custom_recognition_lang";

type RecognitionLanguage = "zh-CN" | "en-US";
type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const getInitialRecognitionLanguage = (): RecognitionLanguage => {
  if (typeof window === "undefined") return "zh-CN";
  try {
    const saved = window.localStorage.getItem(AI_CUSTOM_RECOGNITION_LANG_KEY);
    if (saved === "zh-CN" || saved === "en-US") return saved;
  } catch {}
  return navigator.language?.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
};

const createWebSpeechRecognition = (
  language: RecognitionLanguage,
): WebSpeechRecognition | null => {
  if (typeof window === "undefined") return null;
  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;

  try {
    const recognition = new SpeechRecognitionCtor() as WebSpeechRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;
    return recognition;
  } catch {
    return null;
  }
};

const mergeRecognizedText = (base: string, liveText: string) => {
  const cleanBase = base.trim();
  const cleanLiveText = liveText.replace(/\s+/g, " ").trim();
  if (!cleanLiveText) return cleanBase;
  if (!cleanBase) return cleanLiveText;
  return `${cleanBase}\n${cleanLiveText}`;
};

export function AiCustomQuizScreen({ 
  onClose,
  stamina,
  setGlobalStamina
}: { 
  onClose: () => void;
  stamina: number;
  setGlobalStamina: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [view, setView] = useState<"input" | "loading" | "quiz" | "victory" | "history">("input");
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [quizItems, setQuizItems] = useState<any[]>([]);
  const [history, setHistory] = useState<{ id: string; prompt: string; date: string }[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [showStaminaHint, setShowStaminaHint] = useState(false);
  const [paymentHint, setPaymentHint] = useState("");
  const [recognitionLanguage, setRecognitionLanguage] =
    useState<RecognitionLanguage>(getInitialRecognitionLanguage);
  const [speechStatus, setSpeechStatus] = useState("长按说话，支持中文 / English");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const nativePartialHandleRef = useRef<{ remove: () => Promise<void> } | null>(
    null,
  );
  const nativeListeningHandleRef = useRef<{ remove: () => Promise<void> } | null>(
    null,
  );
  const activeRecognitionModeRef = useRef<"native" | "web" | null>(null);
  const transcriptValueRef = useRef("");
  const recordBaseRef = useRef("");
  const liveRecognitionTextRef = useRef("");
  const permissionPendingRef = useRef(false);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    transcriptValueRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    // Load history from localStorage
    try {
      const saved = localStorage.getItem("ai_custom_quiz_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {}

    return () => {
      void stopRecording();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AI_CUSTOM_RECOGNITION_LANG_KEY, recognitionLanguage);
    } catch {}
  }, [recognitionLanguage]);

  const clearRecordingTimers = () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const removeNativeListeners = async () => {
    try {
      await nativePartialHandleRef.current?.remove();
    } catch {}
    try {
      await nativeListeningHandleRef.current?.remove();
    } catch {}
    nativePartialHandleRef.current = null;
    nativeListeningHandleRef.current = null;
  };

  const finishRecordingUi = (message?: string) => {
    clearRecordingTimers();
    setIsRecording(false);
    setRecordingSeconds(0);
    activeRecognitionModeRef.current = null;
    if (message) setSpeechStatus(message);
  };

  const updateLiveTranscript = (text: string) => {
    liveRecognitionTextRef.current = text;
    setTranscript(mergeRecognizedText(recordBaseRef.current, text));
  };

  const stopRecording = async () => {
    if (!isRecording && !activeRecognitionModeRef.current) return;
    setSpeechStatus("正在整理识别内容...");

    if (activeRecognitionModeRef.current === "native") {
      try {
        await SpeechRecognition.stop();
      } catch {}
      await removeNativeListeners();
    } else {
      try {
        recognitionRef.current?.stop();
      } catch {
        try {
          recognitionRef.current?.abort();
        } catch {}
      }
    }

    const recognized = liveRecognitionTextRef.current.trim();
    finishRecordingUi(
      recognized
        ? "已识别，内容已放入上方输入框"
        : "没有听清，可以再按住说一遍",
    );
  };

  const startRecordingTimers = () => {
    clearRecordingTimers();
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((seconds) =>
        Math.min(AI_CUSTOM_MAX_RECORD_SECONDS, seconds + 1),
      );
    }, 1000);
    stopTimeoutRef.current = setTimeout(() => {
      void stopRecording();
    }, AI_CUSTOM_MAX_RECORD_SECONDS * 1000);
  };

  const ensureNativeSpeechPermission = async () => {
    const available = await SpeechRecognition.available();
    if (!available.available) return false;
    let permissions = await SpeechRecognition.checkPermissions();
    const hasSpeechPermission = permissions.speechRecognition === "granted";
    const microphonePermission = (permissions as { microphone?: string }).microphone;
    if (!hasSpeechPermission || microphonePermission !== "granted") {
      permissions = await SpeechRecognition.requestPermissions();
    }
    const finalMicrophonePermission = (permissions as { microphone?: string })
      .microphone;
    return (
      permissions.speechRecognition === "granted" &&
      (finalMicrophonePermission === undefined ||
        finalMicrophonePermission === "granted")
    );
  };

  const startNativeRecording = async () => {
    const hasPermission = await ensureNativeSpeechPermission();
    if (!hasPermission) {
      setSpeechStatus("没有麦克风或语音识别权限，请在系统设置里允许。");
      return false;
    }

    await removeNativeListeners();
    try {
      await SpeechRecognition.removeAllListeners();
    } catch {}

    nativePartialHandleRef.current = await SpeechRecognition.addListener(
      "partialResults",
      (data: { matches: string[] }) => {
        const bestMatch = data.matches?.find(Boolean) || "";
        if (bestMatch) updateLiveTranscript(bestMatch);
      },
    );
    nativeListeningHandleRef.current = await SpeechRecognition.addListener(
      "listeningState",
      (data: { status: "started" | "stopped" }) => {
        if (data.status === "stopped" && activeRecognitionModeRef.current === "native") {
          void removeNativeListeners();
          finishRecordingUi(
            liveRecognitionTextRef.current.trim()
              ? "已识别，内容已放入上方输入框"
              : "没有听清，可以再按住说一遍",
          );
        }
      },
    );

    activeRecognitionModeRef.current = "native";
    await SpeechRecognition.start({
      language: recognitionLanguage,
      maxResults: 5,
      partialResults: true,
      popup: false,
    });
    return true;
  };

  const startWebRecording = async () => {
    const microphonePermission = await requestMicrophoneAccess();
    if (
      isMicrophonePermissionFailure(microphonePermission) &&
      microphonePermission.reason !== "unsupported"
    ) {
      setSpeechStatus(getMicrophonePermissionMessage(microphonePermission, "zh"));
      return false;
    }

    const recognition = createWebSpeechRecognition(recognitionLanguage);
    if (!recognition) {
      setSpeechStatus("当前环境不支持语音识别，请在手机包或 Chrome/Safari 中使用。");
      return false;
    }

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript || "";
        if (result?.isFinal) {
          finalText += `${text} `;
        } else {
          interimText += `${text} `;
        }
      }
      updateLiveTranscript(`${finalText}${interimText}`.trim());
    };

    recognition.onerror = (event: any) => {
      const message =
        event?.error === "not-allowed" ||
        event?.error === "service-not-allowed"
          ? "没有麦克风权限，请允许后再试。"
          : event?.error === "network"
            ? "语音识别需要联网，请检查网络。"
            : "没有听清，可以再按住说一遍。";
      setSpeechStatus(message);
    };

    recognition.onend = () => {
      if (activeRecognitionModeRef.current === "web") {
        finishRecordingUi(
          liveRecognitionTextRef.current.trim()
            ? "已识别，内容已放入上方输入框"
            : "没有听清，可以再按住说一遍",
        );
      }
    };

    recognitionRef.current = recognition;
    activeRecognitionModeRef.current = "web";
    recognition.start();
    return true;
  };

  const startRecording = async () => {
    if (isRecording || permissionPendingRef.current) return;
    permissionPendingRef.current = true;
    recordBaseRef.current = transcriptValueRef.current;
    liveRecognitionTextRef.current = "";
    setSpeechStatus("正在听... 松手后会填入上方输入框");

    try {
      let started = false;
      if (Capacitor.isNativePlatform()) {
        try {
          started = await startNativeRecording();
        } catch (nativeError) {
          console.warn("Native speech recognition unavailable, using web fallback.", nativeError);
          activeRecognitionModeRef.current = null;
          started = await startWebRecording();
        }
      } else {
        started = await startWebRecording();
      }
      if (!started) {
        finishRecordingUi();
        return;
      }
      setIsRecording(true);
      startRecordingTimers();
    } catch (e) {
      console.error("Failed to start speech recognition", e);
      void removeNativeListeners();
      finishRecordingUi("语音识别启动失败，可以重试一次。");
    } finally {
      permissionPendingRef.current = false;
    }
  };

  const saveToHistory = (text: string) => {
    const newItem = {
      id: Date.now().toString(),
      prompt: text.trim(),
      date: new Date().toLocaleDateString()
    };
    const newHistory = [newItem, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    try {
      localStorage.setItem("ai_custom_quiz_history", JSON.stringify(newHistory));
    } catch (e) {}
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void startRecording();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void stopRecording();
  };

  const generateQuiz = async (text: string, chargeStamina = false) => {
    if (!text.trim()) return;
    if (chargeStamina) {
      setGlobalStamina((prev) => Math.max(0, prev - AI_CUSTOM_STAMINA_COST));
    }
    setView("loading");
    try {
      const resp = await fetch(getApiUrl("/api/review/generate/custom"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text })
      });
      if (resp.ok) {
        const data = await resp.json();
        const validItems = data.filter((item: any) => item);
        if (validItems.length > 0) {
          saveToHistory(text);
          setQuizItems(validItems);
          setView("quiz");
        } else {
          setView("input");
          if (chargeStamina) {
            setGlobalStamina((prev) => prev + AI_CUSTOM_STAMINA_COST);
          }
          alert("题目生成失败，请重试。");
        }
      } else {
        setView("input");
        if (chargeStamina) {
          setGlobalStamina((prev) => prev + AI_CUSTOM_STAMINA_COST);
        }
        alert("服务器错误，请重试。");
      }
    } catch (e) {
      console.error(e);
      setView("input");
      if (chargeStamina) {
        setGlobalStamina((prev) => prev + AI_CUSTOM_STAMINA_COST);
      }
      alert("网络错误，请重试。");
    }
  };

  const requestGenerateQuiz = () => {
    const text = transcript.trim();
    if (!text || isRecording) return;
    if (stamina < AI_CUSTOM_STAMINA_COST) {
      setPaymentHint("");
      setShowStaminaHint(true);
      return;
    }
    setPendingPrompt(text);
  };

  const confirmGenerateQuiz = () => {
    if (!pendingPrompt) return;
    if (stamina < AI_CUSTOM_STAMINA_COST) {
      setPendingPrompt(null);
      setPaymentHint("");
      setShowStaminaHint(true);
      return;
    }
    const text = pendingPrompt;
    setPendingPrompt(null);
    void generateQuiz(text, true);
  };

  if (view === "quiz") {
    return (
      <div className="absolute inset-0 z-[200] bg-[#F7F3F0]">
        <UnifiedQuiz
          items={quizItems}
          background="none"
          stamina={stamina}
          setGlobalStamina={setGlobalStamina}
          onComplete={() => { setView("victory"); }}
          onFail={() => { setView("input"); setTranscript(""); setQuizItems([]); }}
        />

        <div className="absolute top-12 left-4 z-[210]">
          <button
            className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md text-stone-400 active:scale-95"
            onClick={() => { setView("input"); setTranscript(""); setQuizItems([]); }}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  if (view === "victory") {
    return (
      <div className="absolute inset-0 z-[200] bg-[#F7F3F0] flex flex-col items-center justify-center">
        <div className="w-full max-w-md px-6 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="w-40 h-40 bg-yellow-400 rounded-full flex items-center justify-center shadow-[0_10px_0_#d97706] mb-10"
          >
            <Sparkles className="w-20 h-20 text-white" />
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-black text-stone-700 mb-4"
          >
            完成学习！
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-stone-500 font-bold mb-10"
          >
            你已经完成了自定义场景的训练！
          </motion.p>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            onClick={() => { setView("input"); setTranscript(""); setQuizItems([]); }}
            className="w-full bg-[#58CC02] text-white py-4 rounded-2xl font-black text-xl shadow-[0_6px_0_#58a700] active:translate-y-2 active:shadow-[0_0px_0_#58a700]"
          >
            确认
          </motion.button>
        </div>
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="absolute inset-0 z-[200] bg-[#f9f9f9] flex flex-col">
        <div className="w-full pt-12 pb-4 px-4 flex items-center bg-white shadow-sm">
          <button
            className="w-10 h-10 flex items-center justify-center text-stone-400 active:scale-95"
            onClick={() => setView("input")}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <span className="flex-1 text-center font-black text-xl text-stone-700 pr-10">历史记录</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center text-stone-400 font-bold py-10">
              暂无定制记录
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id} 
                className="bg-white p-4 rounded-2xl shadow-sm border-2 border-stone-100 flex flex-col cursor-pointer active:border-[#1CB0F6] active:bg-[#f2fbff]"
                onClick={() => {
                  setTranscript(item.prompt);
                  setView("input");
                }}
              >
                <span className="text-xs font-bold text-stone-400 mb-1">{item.date}</span>
                <p className="text-stone-700 font-medium line-clamp-3">{item.prompt}</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[150] bg-[#f9f9f9] flex flex-col items-center pt-12 pb-32">
      <div className="w-full mb-8 flex items-center px-4 relative">
        <button
          className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-stone-400 active:scale-95"
          onClick={onClose}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="flex-1 text-center font-black text-xl text-stone-700">定制化学习</span>
        <button
          className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm text-[#1CB0F6] active:scale-95 absolute right-4"
          onClick={() => setView("history")}
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 w-full max-w-md px-6 flex flex-col items-center justify-center">
        {view === "loading" ? (
          <div className="flex flex-col items-center gap-4 text-stone-500 font-bold">
            <Sparkles className="w-12 h-12 text-[#1CB0F6] animate-pulse" />
            <p className="text-xl text-[#1CB0F6] text-center">AI 正在为您生成故事对白...<br/><span className="text-sm">这可能需要几秒钟</span></p>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col items-center">
            <div className="w-full flex-1 flex items-center justify-center">
               <div className="bg-white rounded-3xl p-5 w-full min-h-[220px] shadow-sm border-2 border-stone-200 flex flex-col relative focus-within:border-[#1cb0f6] transition-colors">
                 <textarea
                   className="w-full flex-1 resize-none outline-none text-xl font-medium text-stone-800 leading-relaxed bg-transparent placeholder-stone-300"
                   placeholder="按住下方按钮说话，或直接在此输入您想学的内容..."
                   value={transcript}
                   onChange={(e) => setTranscript(e.target.value)}
                 />
                 <div className="flex justify-end mt-4">
                   <button
                     onClick={requestGenerateQuiz}
                     disabled={!transcript.trim() || isRecording}
                     className="bg-[#58CC02] text-white px-6 py-2 rounded-xl font-bold text-lg shadow-[0_4px_0_#58a700] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:shadow-[0_4px_0_#58a700] disabled:translate-y-0 disabled:active:translate-y-0 transition-all"
                   >
                     生成学习内容
                   </button>
                 </div>
               </div>
            </div>

            <div className="mt-5 flex items-center rounded-full bg-white p-1 shadow-sm border-2 border-stone-100">
              {[
                { value: "zh-CN" as const, label: "中文" },
                { value: "en-US" as const, label: "EN" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={isRecording}
                  onClick={() => setRecognitionLanguage(item.value)}
                  className={`h-9 min-w-[68px] rounded-full px-4 text-sm font-black transition-all ${
                    recognitionLanguage === item.value
                      ? "bg-[#1CB0F6] text-white shadow-[0_3px_0_#1688C8]"
                      : "text-stone-400 active:bg-stone-100"
                  } disabled:opacity-60`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="w-full h-32 flex items-center justify-center mt-3">
              <button
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(event) => event.preventDefault()}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? "bg-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]" 
                    : "bg-[#1CB0F6] shadow-[0_6px_0_#1899D6] active:translate-y-2 active:shadow-none"
                } touch-none select-none`}
              >
                {isRecording ? <Square className="w-8 h-8 text-white fill-current animate-pulse" /> : <Mic className="w-8 h-8 text-white" />}
              </button>
            </div>
            <p className="text-stone-400 font-bold text-sm mt-3 text-center leading-relaxed">
              {isRecording
                ? `正在听... ${recordingSeconds}/${AI_CUSTOM_MAX_RECORD_SECONDS}s`
                : speechStatus}
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {pendingPrompt && (
          <motion.div
            className="absolute inset-0 z-[260] flex items-center justify-center bg-black/35 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPendingPrompt(null)}
          >
            <motion.div
              className="w-full max-w-[340px] rounded-[28px] bg-white p-5 shadow-[0_24px_54px_rgba(15,23,42,0.28)] border border-white"
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.94 }}
              transition={{ type: "spring", damping: 17, stiffness: 180 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1CB0F6]">
                    AI Custom Lesson
                  </p>
                  <h3 className="mt-1 text-[23px] font-black text-stone-900">
                    确认生成学习内容？
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingPrompt(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 rounded-[20px] bg-cyan-50 border border-cyan-100 px-4 py-3">
                <div className="flex items-center gap-2 text-cyan-700">
                  <Zap className="h-5 w-5 fill-cyan-400" strokeWidth={3} />
                  <span className="text-[15px] font-black">
                    本次生成将消耗 {AI_CUSTOM_STAMINA_COST} 点体力
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-[13px] font-bold leading-relaxed text-stone-600">
                  {pendingPrompt}
                </p>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingPrompt(null)}
                  className="h-[50px] w-[110px] rounded-[18px] border-2 border-stone-200 bg-white text-[15px] font-black text-stone-500 active:scale-[0.97]"
                >
                  再想想
                </button>
                <button
                  type="button"
                  onClick={confirmGenerateQuiz}
                  className="h-[50px] flex-1 rounded-[18px] bg-[#58CC02] text-[16px] font-black text-white shadow-[0_5px_0_#3f9300] active:translate-y-[4px] active:shadow-none"
                >
                  确认生成
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStaminaHint && (
          <motion.div
            className="absolute inset-0 z-[260] flex items-center justify-center bg-black/35 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowStaminaHint(false)}
          >
            <motion.div
              className="w-full max-w-[340px] rounded-[28px] bg-white p-5 shadow-[0_24px_54px_rgba(15,23,42,0.28)] border border-white"
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.94 }}
              transition={{ type: "spring", damping: 17, stiffness: 180 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Zap className="h-8 w-8 fill-amber-400" strokeWidth={3} />
              </div>
              <h3 className="mt-4 text-center text-[23px] font-black text-stone-900">
                体力不足
              </h3>
              <p className="mt-3 text-center text-[14px] font-bold leading-relaxed text-stone-600">
                AI 定制学习每次需要 {AI_CUSTOM_STAMINA_COST} 点体力。做错题本中的题，答对可以获得 1 点体力。
              </p>
              {paymentHint && (
                <p className="mt-3 rounded-[14px] bg-rose-50 px-3 py-2 text-center text-[13px] font-black text-rose-500">
                  {paymentHint}
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowStaminaHint(false)}
                  className="h-[50px] w-[110px] rounded-[18px] border-2 border-stone-200 bg-white text-[15px] font-black text-stone-500 active:scale-[0.97]"
                >
                  知道了
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentHint("当前无法支付")}
                  className="h-[50px] flex-1 rounded-[18px] bg-[#1CB0F6] text-[16px] font-black text-white shadow-[0_5px_0_#1688C8] active:translate-y-[4px] active:shadow-none"
                >
                  购买体力
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
