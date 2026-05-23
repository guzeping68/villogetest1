import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Mic, Send, Volume2, Store, HeartPulse, MessagesSquare } from 'lucide-react';

interface Task {
  id: number;
  description: string;
  completed: boolean;
}

const getCategoryData = (cat: string) => {
  if (cat === 'Hospital') {
    return {
      tasks: [
        { id: 1, description: 'Say "I have a headache"', completed: false },
        { id: 2, description: 'Ask "Where is the pharmacy?"', completed: false },
        { id: 3, description: 'Say "Thank you, doctor"', completed: false },
      ],
      initialMessages: [
        { type: 'system', text: 'Welcome to the Hospital! Please complete the tasks above.' },
        { type: 'ai', audioLength: 2, text: "Hello! How can I help you today?", translation: "你好！今天我能怎么帮助你？" },
      ],
      userReplies: [
        { text: "I have a headache.", translation: "我头痛。" },
        { text: "Where is the pharmacy?", translation: "药房在哪里？" },
        { text: "Thank you, doctor.", translation: "谢谢医生。" },
      ],
      aiReplies: [
        { text: "I see. Let me check your temperature.", translation: "我明白了。让我给你量个体温。" },
        { text: "The pharmacy is on the first floor.", translation: "药房在一楼。" },
      ]
    }
  } else if (cat === 'Community') {
    return {
      tasks: [
        { id: 1, description: 'Say "Good morning"', completed: false },
        { id: 2, description: 'Ask "How are you?"', completed: false },
        { id: 3, description: 'Say "Have a nice day"', completed: false },
      ],
      initialMessages: [
        { type: 'system', text: 'Welcome to the Community! Please complete the tasks.' },
        { type: 'ai', audioLength: 2, text: "Good morning! Nice weather today.", translation: "早上好！今天天气真不错。" },
      ],
      userReplies: [
        { text: "Good morning!", translation: "早上好！" },
        { text: "How are you?", translation: "你好吗？" },
        { text: "Have a nice day!", translation: "祝你有愉快的一天！" },
      ],
      aiReplies: [
        { text: "Yes, it is very sunny. Are you going to work?", translation: "是的，阳光明媚。你去上班吗？" },
        { text: "I'm doing great, thanks for asking!", translation: "我很好，谢谢你的关心！" },
      ]
    }
  }
  // Cafe
  return {
    tasks: [
      { id: 1, description: 'Say "Hello"', completed: false },
      { id: 2, description: 'Ask "How much is it?"', completed: false },
      { id: 3, description: 'Say "Thank you"', completed: false },
    ],
    initialMessages: [
      { type: 'system', text: 'Welcome to the Cafe! Please complete the tasks above.' },
      { type: 'ai', audioLength: 2, text: "Welcome! What would you like to order?", translation: "欢迎！您想点些什么？" },
    ],
    userReplies: [
      { text: "I'd like a coffee, please.", translation: "我想要一杯咖啡。" },
      { text: "How much is it?", translation: "多少钱？" },
      { text: "Thank you.", translation: "谢谢。" },
    ],
    aiReplies: [
      { text: "A coffee, sure! Anything else?", translation: "好的，咖啡！还要别的吗？" },
      { text: "That will be $3.", translation: "一共3美元。" },
    ]
  }
}

type Message = { type: 'system' | 'user' | 'ai', audioLength?: number, text: string, translation?: string };

export function AiSpeakingPractice({ onBack, category }: { onBack: () => void, category: string }) {
  const data = getCategoryData(category);
  const [tasks, setTasks] = useState<Task[]>(data.tasks);
  
  const [messages, setMessages] = useState<Message[]>(data.initialMessages as Message[]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  const [taskIndex, setTaskIndex] = useState(0);

  const handleMicClick = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      // stop and send
      setIsRecording(false);
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      
      const uReply = data.userReplies[taskIndex] || { text: '...', translation: '...' };
      const userMessage: Message = { type: 'user', audioLength: recordingSeconds > 0 ? recordingSeconds : 3, text: uReply.text, translation: uReply.translation };
      setMessages(prev => [...prev, userMessage]);

      // Complete a task
      if (taskIndex < tasks.length) {
        setTasks(prev => prev.map((t, i) => i === taskIndex ? { ...t, completed: true } : t));
        const currentTaskIndex = taskIndex;
        setTaskIndex(prev => prev + 1);
        
        // fake ai reply
        setTimeout(() => {
          if (currentTaskIndex < data.aiReplies.length) {
             const aiReply = data.aiReplies[currentTaskIndex];
             setMessages(prev => [...prev, { type: 'ai', audioLength: 3, text: aiReply.text, translation: aiReply.translation }]);
          } else {
            setMessages(prev => [...prev, { type: 'system', text: 'Congratulations! You have completed all tasks.' }]);
            setTimeout(() => {
              onBack();
            }, 3000);
          }
        }, 1500);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    }
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#F5F8FA] z-[200] flex flex-col font-sans"
    >
      {/* Top 1/3 Scene */}
      <div className="relative h-[30%] min-h-[200px] w-full bg-gradient-to-b from-blue-100 to-[#F5F8FA] overflow-hidden rounded-b-3xl shadow-sm">
        <button 
          onClick={onBack}
          className="absolute top-12 left-4 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center z-20 hover:bg-white"
        >
          <ChevronLeft className="w-6 h-6 text-stone-700" />
        </button>
        <div className="absolute top-12 right-6 bg-white/50 backdrop-blur-md px-3 py-1 rounded-full z-20">
          <span className="font-bold text-stone-700 text-sm">{category}</span>
        </div>
        
        {/* Fake Character & Scene */}
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
          {category === 'Hospital' && <HeartPulse className="absolute bottom-[20%] text-blue-200 w-32 h-32 opacity-50" />}
          {category === 'Community' && <MessagesSquare className="absolute bottom-[20%] text-blue-200 w-32 h-32 opacity-50" />}
          {category === 'Cafe' && <Store className="absolute bottom-[20%] text-blue-200 w-32 h-32 opacity-50" />}
          <motion.img 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            src="/assets/npc.png" 
            className="w-[120px] h-[120px] object-contain drop-shadow-md relative z-10 translate-y-2"
          />
        </div>
      </div>

      {/* Tasks Section */}
      <div className="px-6 py-4">
        <h3 className="font-extrabold text-stone-800 text-lg mb-3">Tasks</h3>
        <div className="flex flex-col gap-2">
          {tasks.map((task, idx) => (
            <div key={task.id} className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${task.completed ? 'bg-green-500 text-white' : 'bg-stone-200 text-stone-500'}`}>
                {task.completed ? '✓' : idx + 1}
              </div>
              <span className={`font-semibold text-[15px] ${task.completed ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                {task.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col w-full ${msg.type === 'user' ? 'items-end' : msg.type === 'ai' ? 'items-start' : 'items-center'}`}
          >
            {msg.type === 'system' && (
              <div className="bg-stone-200/50 px-4 py-2 rounded-full text-xs font-bold text-stone-500 my-2">
                {msg.text}
              </div>
            )}
            {(msg.type === 'user' || msg.type === 'ai') && (
              <div className={`flex flex-col max-w-[80%] ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl ${msg.type === 'user' ? 'bg-[#6C63FF] text-white rounded-tr-sm' : 'bg-white text-stone-800 shadow-sm rounded-tl-sm'}`}>
                  {msg.type === 'ai' && <Volume2 className="w-5 h-5 opacity-60" />}
                  <span className="font-bold flex items-center gap-2">
                    {msg.audioLength && <span className="text-sm">{msg.audioLength}"</span>}
                  </span>
                  {msg.type === 'user' && <Volume2 className="w-5 h-5 opacity-80" />}
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  <span className={`text-[13px] font-semibold ${msg.type === 'user' ? 'text-stone-600 text-right' : 'text-stone-600'}`}>{msg.text}</span>
                  <span className={`text-[12px] font-medium opacity-60 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>{msg.translation}</span>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Bottom Audio Input */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-stone-100 p-4 pb-8 flex flex-col items-center justify-center">
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-16 bg-black/80 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording... {recordingSeconds}s
          </motion.div>
        )}
        
        <button 
          onClick={handleMicClick}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-colors ${isRecording ? 'bg-[#6C63FF] text-white shadow-[#6C63FF]/30' : 'bg-white border-2 border-stone-200 text-[#6C63FF]'}`}
        >
          {isRecording ? <Send className="w-6 h-6 ml-1" /> : <Mic className="w-7 h-7" />}
        </button>
        <span className="text-stone-400 font-bold text-xs mt-2">{isRecording ? 'Tap to Send' : 'Tap to Speak'}</span>
      </div>
    </motion.div>
  );
}
