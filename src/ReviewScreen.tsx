import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
  Volume2,
  Zap,
  Loader2,
} from "lucide-react";
import { getApiUrl } from "./utils/api";

// Default reading items
const DEFAULT_READING_ITEMS = [
  {
    type: "reading",
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
    sentence_en: "I baked some fresh scones for our new neighbors.",
    sentence_cn: "我为我们的新邻居烤了一些新鲜的司康饼。",
    key_vocabulary: {
      word: "Baked",
      phonetic: "/beɪkt/",
      translation: "烤（过去式）",
      example_en: "The bread is freshly baked.",
      example_cn: "这面包是刚烤好的。",
    },
  },
];

export const ReviewScreen = ({
  onClose,
  stamina,
  setGlobalStamina,
  mistakes = [],
}: {
  onClose: () => void;
  stamina: number;
  setGlobalStamina: React.Dispatch<React.SetStateAction<number>>;
  mistakes?: any[];
}) => {
  const [view, setView] = useState<"menu" | "quiz" | "completed" | "mistakes">("menu");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [items, setItems] = useState<any[]>(DEFAULT_READING_ITEMS);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  useEffect(() => {
    if (view === "quiz") {
      generateAiReadingItems();
    }
  }, [view]);

  const generateAiReadingItems = async () => {
    const cachedItemsStr = localStorage.getItem("ai_reading_items_cache");
    const cachedLenStr = localStorage.getItem("ai_reading_mistakes_length");
    const mLen = mistakes?.length || 0;
    
    if (cachedItemsStr && cachedLenStr && parseInt(cachedLenStr) === mLen) {
       const cachedItems = JSON.parse(cachedItemsStr);
       setItems(cachedItems);
       setCurrentIdx(0);
       return;
    }

    setIsLoadingAi(true);
    try {
      const resp = await fetch(getApiUrl("/api/review/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mistakes }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          // Ensure data items have required fields
          const validItems = data.filter((item: any) => item && item.sentence_en && item.key_vocabulary);
          if (validItems.length > 0) {
            setItems(validItems);
            setCurrentIdx(0);
            localStorage.setItem("ai_reading_items_cache", JSON.stringify(validItems));
            localStorage.setItem("ai_reading_mistakes_length", (mistakes?.length || 0).toString());
          }
        }
      }
    } catch (err) {
      console.error("Failed to generate AI questions", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleNext = () => {
    if (currentIdx < items.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setView("completed");
    }
  };

  return (
    <div className="absolute inset-0 z-[300] bg-black flex flex-col items-center justify-center font-sans overflow-hidden">
      {/* Background */}
      <img
        src="/assets/fuxibg.png"
        className="absolute inset-0 w-full h-full object-cover opacity-90"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 w-full z-50 p-6 pt-12 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => {
            if (view !== "menu") {
              setView("menu");
            } else {
              onClose();
            }
          }}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/50 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20">
          <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
          <span className="text-white font-black">{stamina}</span>
        </div>
      </div>

      {view === "menu" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full px-6 flex flex-col gap-6"
        >
          <h2 className="text-white text-[28px] font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-4">
            错题复习阅读
          </h2>
          <div className="flex gap-4">
            {/* Reading Mode Card */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView("quiz")}
              className="flex-1 aspect-square bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[24px] p-5 shadow-xl border-2 border-white/20 flex flex-col justify-end relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white text-[20px] font-black leading-tight mb-1">
                开始阅读
              </h3>
              <p className="text-blue-100 text-[13px] font-medium opacity-90">
                通过句子学习错题知识点
              </p>
            </motion.div>

            {/* Mistakes Book Card */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView("mistakes")}
              className="flex-1 aspect-square bg-gradient-to-br from-rose-400 to-rose-600 rounded-[24px] p-5 shadow-xl border-2 border-white/20 flex flex-col justify-end relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-4 right-4 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white text-[20px] font-black leading-tight mb-1">
                错题记录
              </h3>
              <p className="text-rose-100 text-[13px] font-medium opacity-90">
                查看历史做错的题目
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}

      {view === "quiz" && (
        <div className="absolute inset-0 flex flex-col justify-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full bg-white rounded-t-[40px] shadow-[0_-12px_60px_rgba(0,0,0,0.3)] z-20 flex flex-col max-h-[90vh] pb-10"
            >
              <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto my-5 shrink-0" />
              <div className="px-8 pb-4">
                <div className="flex justify-between items-center mb-8">
                  <span className="px-4 py-1 rounded-full bg-blue-50 text-[#1CB0F6] text-sm font-black border border-blue-100">
                    复习内容 {currentIdx + 1} / {items.length}
                  </span>
                  <div className="flex items-center gap-3">
                    {isLoadingAi && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="text-blue-400"
                      >
                        <Loader2 className="w-5 h-5" />
                      </motion.div>
                    )}
                    <button
                      className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#1CB0F6]"
                      onClick={() => {
                        const speech = new SpeechSynthesisUtterance(items[currentIdx].sentence_en);
                        speech.lang = "en-US";
                        window.speechSynthesis.speak(speech);
                      }}
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Main Content */}
                <div className="mb-10 text-center px-2">
                  <p className="text-[24px] font-black text-stone-800 mb-4 leading-tight">
                    {items[currentIdx].sentence_en}
                  </p>
                  <p className="text-[18px] font-bold text-stone-400">
                    {items[currentIdx].sentence_cn}
                  </p>
                </div>

                {/* Key Vocabulary Info Box */}
                <div className="bg-stone-50 rounded-[24px] p-6 border-2 border-stone-100 mb-10">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-[20px] font-black text-[#1CB0F6]">
                      {items[currentIdx].key_vocabulary.word}
                    </h4>
                    <span className="text-stone-400 font-mono text-sm font-bold">
                      {items[currentIdx].key_vocabulary.phonetic}
                    </span>
                    <span className="ml-auto text-stone-600 font-bold bg-stone-200/50 px-3 py-1 rounded-lg text-sm">
                      {items[currentIdx].key_vocabulary.translation}
                    </span>
                  </div>
                  <div className="space-y-2 border-t border-stone-200 pt-3">
                    <p className="text-stone-700 font-bold text-[15px]">
                      {items[currentIdx].key_vocabulary.example_en}
                    </p>
                    <p className="text-stone-400 text-sm font-medium">
                      {items[currentIdx].key_vocabulary.example_cn}
                    </p>
                  </div>
                </div>

                {/* Horizontal NEXT Button */}
                <button
                  onClick={handleNext}
                  className="w-full h-16 bg-[#1CB0F6] hover:bg-[#1899D6] text-white rounded-2xl flex items-center justify-center gap-3 shadow-[0_4px_0_#1899D6] active:translate-y-[4px] active:shadow-none transition-all"
                >
                  <span className="text-[18px] font-black">
                    {currentIdx < items.length - 1 ? "下一个" : "完成复习"}
                  </span>
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {view === "completed" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full px-6 flex flex-col items-center justify-center gap-6 mt-20"
        >
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)] border-4 border-white mb-2">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-white text-[32px] font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            复习完成！
          </h2>
          <p className="text-white/90 text-[16px] font-medium text-center max-w-[80%] mb-4 drop-shadow-md">
            你已经学习了这些知识点，继续保持！
          </p>
          <button
            onClick={() => {
              setView("menu");
              setCurrentIdx(0);
            }}
            className="w-full max-w-[280px] bg-[#1CB0F6] text-white py-4 rounded-full font-black text-[18px] shadow-[0_6px_0_#1899D6] active:translate-y-[6px] active:shadow-none transition-all"
          >
            回主界面
          </button>
        </motion.div>
      )}

      {view === "mistakes" && (
        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="relative z-10 w-full h-full pt-28 px-6 flex flex-col pb-6 overflow-hidden"
        >
          <h2 className="text-white text-[28px] font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-6 shrink-0">
            我的错题本
          </h2>
          {!mistakes || mistakes.length === 0 ? (
            <div className="bg-white/20 backdrop-blur-md rounded-[24px] p-8 text-center text-white border-2 border-white/20 mt-10">
               <Layers className="w-12 h-12 text-white/50 mx-auto mb-4" />
               <p className="text-[18px] font-bold">暂无错题记录</p>
               <p className="text-white/70 text-sm mt-2">做错题目后，这里会自动为你记录</p>
            </div>
          ) : (() => {
            const grouped: Record<string, { title: string, mistakes: any[] }> = {};
            (mistakes || []).forEach((m: any) => {
                const lessonInfo = m._lessonInfo;
                let groupKey = "其他";
                let groupTitle = "其他课节练习";
                if (lessonInfo) {
                    groupKey = `unit_${lessonInfo.unit_id}_lesson_${lessonInfo.lesson_id}`;
                    groupTitle = `${lessonInfo.unit_id.replace('-', ' ')} 第${lessonInfo.lesson_id}课：${lessonInfo.title_cn || lessonInfo.title}`;
                }
                if (!grouped[groupKey]) {
                    grouped[groupKey] = { title: groupTitle, mistakes: [] };
                }
                grouped[groupKey].mistakes.push(m);
            });

            return (
               <div className="flex-1 overflow-y-auto w-full pr-2 pb-10 space-y-6 custom-scrollbar">
                  {Object.values(grouped).map((group, groupIdx) => (
                      <div key={groupIdx} className="space-y-4">
                          <div className="sticky top-0 z-10 bg-white/20 backdrop-blur-md rounded-[16px] py-3 px-5 border border-white/30 shadow-sm flex items-center gap-3">
                              <div className="w-2 h-6 bg-rose-400 rounded-full" />
                              <h3 className="text-white font-black text-[18px] drop-shadow-sm">{group.title}</h3>
                          </div>
                          <div className="space-y-4 pl-2 border-l border-white/20 ml-4 py-2">
                              {group.mistakes.map((m: any, i: number) => {
                                 const instruction = m.instruction || (m.type === "narrator" ? m.text_cn : m.sentence_cn) || "未知题目";
                                 const questionText = m.text || m.sentence_en || "";
                                 return (
                                   <div key={i} className="bg-white rounded-[24px] p-6 shadow-xl relative border-2 border-stone-100 flex flex-col shrink-0">
                                     <div className="absolute top-4 right-4 bg-rose-100 text-rose-600 text-xs font-bold px-2.5 py-1.5 rounded-xl shrink-0">
                                       No. {i + 1}
                                     </div>
                                     <h3 className="font-bold text-stone-800 text-[16px] mb-3 pr-16 leading-snug">{instruction}</h3>
                                     {questionText && (
                                       <div className="text-[15px] font-medium text-stone-600 mb-4 bg-stone-50 rounded-xl p-4 border border-stone-200">
                                         {questionText}
                                       </div>
                                     )}
                                     {m.options && m.options.length > 0 && (
                                       <div className="flex flex-col gap-2">
                                          <div className="text-sm font-bold text-stone-400 mb-1">选项参考:</div>
                                          {m.options.map((opt: any, optIdx: number) => (
                                             <div key={optIdx} className={`text-[14px] font-medium p-3 rounded-xl border ${opt.is_correct ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>
                                                <span className="font-black mr-2 bg-white/50 px-2 py-0.5 rounded-md text-stone-600">{opt.label}</span>
                                                {opt.text}
                                                {opt.is_correct && <CheckCircle2 className="w-5 h-5 inline-block ml-2 text-emerald-500 float-right mt-[-2px]" />}
                                             </div>
                                          ))}
                                       </div>
                                     )}
                                     {m.pairs && m.pairs.length > 0 && (
                                       <div className="flex flex-col gap-2">
                                          <div className="text-sm font-bold text-stone-400 mb-1 bg-stone-50 p-2 rounded w-fit">配对参考</div>
                                          <div className="grid grid-cols-2 gap-3">
                                            {m.pairs.map((pair: any, pairIdx: number) => (
                                               <div key={pairIdx} className="bg-emerald-50 text-emerald-700 font-bold p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-[14px]">
                                                 <span>{pair.word}</span>
                                                 <span className="text-emerald-400">━</span>
                                                 <span>{pair.image}</span>
                                               </div>
                                            ))}
                                          </div>
                                       </div>
                                     )}
                                   </div>
                                 );
                              })}
                          </div>
                      </div>
                  ))}
               </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
};
