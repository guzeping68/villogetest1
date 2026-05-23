import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Square, Sparkles, ArrowLeft, History } from "lucide-react";
import { UnifiedQuiz } from "./UnifiedQuiz";
import { getApiUrl } from "./utils/api";

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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Load history from localStorage
    try {
      const saved = localStorage.getItem("ai_custom_quiz_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {}

    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "zh-CN";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

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

  const handlePointerDown = () => {
    if (!recognitionRef.current) {
      alert("您的浏览器不支持语音识别功能，建议使用 Chrome 浏览器。");
      return;
    }
    setTranscript("");
    setIsRecording(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Ignored if already started
    }
  };

  const handlePointerUp = () => {
    if (isRecording && recognitionRef.current) {
      setIsRecording(false);
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const generateQuiz = async (text: string) => {
    if (!text.trim()) return;
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
          alert("题目生成失败，请重试。");
        }
      } else {
        setView("input");
        alert("服务器错误，请重试。");
      }
    } catch (e) {
      console.error(e);
      setView("input");
      alert("网络错误，请重试。");
    }
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
                     onClick={() => generateQuiz(transcript)}
                     disabled={!transcript.trim() || isRecording}
                     className="bg-[#58CC02] text-white px-6 py-2 rounded-xl font-bold text-lg shadow-[0_4px_0_#58a700] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:shadow-[0_4px_0_#58a700] disabled:translate-y-0 disabled:active:translate-y-0 transition-all"
                   >
                     生成学习内容
                   </button>
                 </div>
               </div>
            </div>

            <div className="w-full h-32 flex items-center justify-center mt-6">
              <button
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? "bg-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]" 
                    : "bg-[#1CB0F6] shadow-[0_6px_0_#1899D6] active:translate-y-2 active:shadow-none"
                }`}
              >
                {isRecording ? <Square className="w-8 h-8 text-white fill-current animate-pulse" /> : <Mic className="w-8 h-8 text-white" />}
              </button>
            </div>
            <p className="text-stone-400 font-bold text-sm mt-3 uppercase tracking-widest">长按说话</p>
          </div>
        )}
      </div>
    </div>
  );
}
