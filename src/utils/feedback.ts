import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

type HapticKind =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error"
  | "reward"
  | "clean";

const HAPTIC_FALLBACKS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 24,
  heavy: 42,
  success: 50,
  warning: [16, 40, 16],
  error: [10, 50, 10],
  reward: [50, 30, 50],
  clean: [25, 40, 25, 40, 70],
};

const fallbackVibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const triggerHaptic = (
  kind: HapticKind = "light",
  fallbackPattern: number | number[] = HAPTIC_FALLBACKS[kind],
) => {
  if (typeof window === "undefined") return;

  void (async () => {
    try {
      if (kind === "success" || kind === "reward") {
        await Haptics.notification({ type: NotificationType.Success });
        return;
      }
      if (kind === "warning" || kind === "clean") {
        await Haptics.notification({ type: NotificationType.Warning });
        return;
      }
      if (kind === "error") {
        await Haptics.notification({ type: NotificationType.Error });
        return;
      }

      await Haptics.impact({
        style:
          kind === "heavy"
            ? ImpactStyle.Heavy
            : kind === "medium"
              ? ImpactStyle.Medium
              : ImpactStyle.Light,
      });
    } catch {
      fallbackVibrate(fallbackPattern);
    }
  })();
};

let lastButtonClickSoundAt = 0;
let lastDialogueAppearSoundAt = 0;
let lastQuestionAppearSoundAt = 0;
let lastCorrectAnswerSoundAt = 0;
let lastSoftErrorSoundAt = 0;
let lastSceneSwipeSoundAt = 0;
let lastVictoryFeedbackAt = 0;
let sharedSfxContext: AudioContext | null = null;
let hasSfxVisibilityCleanup = false;

const closeSharedSfxContext = () => {
  if (!sharedSfxContext) return;
  const ctx = sharedSfxContext;
  sharedSfxContext = null;
  void ctx.close().catch(() => {});
};

const getSharedSfxContext = () => {
  if (typeof window === "undefined") return null;
  if (typeof document !== "undefined" && document.hidden) return null;

  if (!hasSfxVisibilityCleanup && typeof document !== "undefined") {
    hasSfxVisibilityCleanup = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) closeSharedSfxContext();
    });
  }

  if (sharedSfxContext && sharedSfxContext.state !== "closed") {
    if (sharedSfxContext.state === "suspended") {
      void sharedSfxContext.resume().catch(() => {});
    }
    return sharedSfxContext;
  }

  const AudioContext =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return null;

  sharedSfxContext = new AudioContext();
  return sharedSfxContext;
};

const playShortTone = ({
  frequency,
  endFrequency,
  startTime,
  duration,
  type = "sine",
  volume,
}: {
  frequency: number;
  endFrequency?: number;
  startTime: number;
  duration: number;
  type?: OscillatorType;
  volume: number;
}) => {
  const ctx = getSharedSfxContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + startTime;
  const end = start + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(endFrequency, end);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
};

export const playButtonClickSound = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastButtonClickSoundAt < 55) return;
  lastButtonClickSoundAt = now;

  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1040, start);
    osc.frequency.exponentialRampToValueAtTime(620, start + 0.045);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.075);

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 120);
  } catch {
    // Audio feedback is best-effort.
  }
};

export const playDialogueAppearSound = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastDialogueAppearSoundAt < 120) return;
  lastDialogueAppearSoundAt = now;

  try {
    playShortTone({
      frequency: 740,
      endFrequency: 520,
      startTime: 0,
      duration: 0.085,
      type: "triangle",
      volume: 0.035,
    });
    playShortTone({
      frequency: 980,
      endFrequency: 760,
      startTime: 0.035,
      duration: 0.075,
      type: "sine",
      volume: 0.018,
    });
  } catch {
    // Best-effort UI sound.
  }
};

export const playQuestionAppearSound = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastQuestionAppearSoundAt < 180) return;
  lastQuestionAppearSoundAt = now;

  try {
    playShortTone({
      frequency: 660,
      endFrequency: 880,
      startTime: 0,
      duration: 0.11,
      type: "sine",
      volume: 0.038,
    });
    playShortTone({
      frequency: 1320,
      endFrequency: 1180,
      startTime: 0.085,
      duration: 0.12,
      type: "triangle",
      volume: 0.024,
    });
  } catch {
    // Best-effort UI sound.
  }
};

export const playCorrectAnswerSound = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastCorrectAnswerSoundAt < 140) return;
  lastCorrectAnswerSoundAt = now;

  try {
    playShortTone({
      frequency: 523.25,
      endFrequency: 659.25,
      startTime: 0,
      duration: 0.11,
      type: "sine",
      volume: 0.055,
    });
    playShortTone({
      frequency: 783.99,
      endFrequency: 1046.5,
      startTime: 0.07,
      duration: 0.16,
      type: "triangle",
      volume: 0.044,
    });
  } catch {
    // Best-effort UI sound.
  }
};

export const playSoftErrorSound = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastSoftErrorSoundAt < 160) return;
  lastSoftErrorSoundAt = now;

  try {
    playShortTone({
      frequency: 392,
      endFrequency: 311,
      startTime: 0,
      duration: 0.16,
      type: "triangle",
      volume: 0.16,
    });
    playShortTone({
      frequency: 330,
      endFrequency: 262,
      startTime: 0.06,
      duration: 0.18,
      type: "sine",
      volume: 0.13,
    });
    playShortTone({
      frequency: 262,
      endFrequency: 220,
      startTime: 0.12,
      duration: 0.15,
      type: "triangle",
      volume: 0.1,
    });
  } catch {
    // Best-effort UI sound.
  }
};

export const playSceneSwipeSound = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastSceneSwipeSoundAt < 180) return;
  lastSceneSwipeSoundAt = now;

  try {
    const ctx = getSharedSfxContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const duration = 0.46;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < sampleCount; index += 1) {
      const progress = index / sampleCount;
      const envelope = Math.sin(progress * Math.PI);
      channel[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    const highpass = ctx.createBiquadFilter();
    const bandpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    source.buffer = buffer;
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(520, start);
    highpass.frequency.exponentialRampToValueAtTime(1200, start + duration);
    bandpass.type = "bandpass";
    bandpass.Q.setValueAtTime(0.8, start);
    bandpass.frequency.setValueAtTime(1850, start);
    bandpass.frequency.exponentialRampToValueAtTime(560, start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.26, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + duration + 0.03);

    playShortTone({
      frequency: 1480,
      endFrequency: 360,
      startTime: 0.015,
      duration: 0.34,
      type: "sawtooth",
      volume: 0.08,
    });
    playShortTone({
      frequency: 920,
      endFrequency: 260,
      startTime: 0.06,
      duration: 0.3,
      type: "triangle",
      volume: 0.07,
    });
  } catch {
    // Best-effort scene transition sound.
  }
};

export const playVictoryCelebrationFeedback = () => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastVictoryFeedbackAt < 900) return;
  lastVictoryFeedbackAt = now;

  triggerHaptic("light", 18);
  window.setTimeout(() => triggerHaptic("medium", 32), 120);
  window.setTimeout(() => triggerHaptic("heavy", 56), 270);

  try {
    const hits = [
      { at: 0, notes: [523.25, 659.25], volume: 0.035, duration: 0.18 },
      { at: 0.12, notes: [659.25, 783.99], volume: 0.045, duration: 0.21 },
      { at: 0.27, notes: [783.99, 1046.5, 1318.51], volume: 0.055, duration: 0.32 },
    ];

    hits.forEach((hit) => {
      hit.notes.forEach((frequency, index) => {
        playShortTone({
          frequency,
          endFrequency: frequency * (index === 0 ? 1.08 : 1.12),
          startTime: hit.at + index * 0.018,
          duration: hit.duration,
          type: index === 0 ? "triangle" : "sine",
          volume: hit.volume * (index === 0 ? 1 : 0.72),
        });
      });
    });

    [1567.98, 1760, 2093].forEach((frequency, index) => {
      playShortTone({
        frequency,
        endFrequency: frequency * 1.18,
        startTime: 0.46 + index * 0.065,
        duration: 0.22,
        type: "sine",
        volume: 0.018,
      });
    });
  } catch {
    // Best-effort celebration feedback.
  }
};
