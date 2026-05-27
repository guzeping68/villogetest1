import React, { useEffect, useMemo, useState } from "react";
import {
  normalizeSpeechText,
  SPEECH_PROGRESS_EVENT,
  type SpeechProgressEventDetail,
} from "../utils/speech";

type SpeechProgressState = {
  isActive: boolean;
  isComplete: boolean;
  activeWordCount: number;
};

const useSpeechProgressForText = (text?: string | null) => {
  const normalizedText = useMemo(() => normalizeSpeechText(text), [text]);
  const [state, setState] = useState<SpeechProgressState>({
    isActive: false,
    isComplete: false,
    activeWordCount: 0,
  });

  useEffect(() => {
    if (!normalizedText || typeof window === "undefined") return;

    const handleProgress = (event: Event) => {
      const detail = (event as CustomEvent<SpeechProgressEventDetail>).detail;
      if (!detail || detail.text !== normalizedText) return;

      if (detail.status === "cancel") {
        setState((current) => ({
          ...current,
          isActive: false,
          activeWordCount: 0,
        }));
        return;
      }

      if (detail.status === "complete") {
        setState({
          isActive: false,
          isComplete: true,
          activeWordCount: detail.totalWords,
        });
        return;
      }

      setState({
        isActive: true,
        isComplete: false,
        activeWordCount: detail.activeWordCount,
      });
    };

    window.addEventListener(SPEECH_PROGRESS_EVENT, handleProgress);
    return () => {
      window.removeEventListener(SPEECH_PROGRESS_EVENT, handleProgress);
    };
  }, [normalizedText]);

  return state;
};

export const SpeechProgressText = ({
  text,
  speechMatchText,
  underlineWords = false,
  underlineClassName = "border-stone-400/45",
  className = "",
}: {
  text?: string | null;
  speechMatchText?: string | null;
  underlineWords?: boolean;
  underlineClassName?: string;
  className?: string;
}) => {
  const safeText = typeof text === "string" ? text : "";
  const parts = useMemo(() => safeText.split(/(\s+)/), [safeText]);
  const progress = useSpeechProgressForText(speechMatchText ?? safeText);
  const hasSpeechUnderline = progress.isActive || progress.isComplete;
  let wordIndex = -1;

  if (!underlineWords && !hasSpeechUnderline) {
    return <span className={className}>{safeText}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (/^\s+$/.test(part)) return part;

        wordIndex += 1;
        const isActiveSpeechWord =
          progress.isActive && wordIndex < progress.activeWordCount;
        const speechUnderlineClass = isActiveSpeechWord
          ? "border-emerald-400"
          : underlineWords
            ? underlineClassName
            : "border-transparent";

        return (
          <span
            key={`${part}-${index}`}
            className={`inline-block border-b border-dashed pb-[1px] leading-[inherit] transition-colors duration-150 ${speechUnderlineClass}`}
          >
            {part}
          </span>
        );
      })}
    </span>
  );
};
