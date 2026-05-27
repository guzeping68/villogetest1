export type TownBgmController = {
  cleanup: () => void;
  setActive: (active: boolean) => void;
  unlock: () => void;
};

const TOWN_BGM_VOLUME = 0.016;
const TOWN_BGM_BAR_MS = 6200;

const chordProgression = [
  [261.63, 329.63, 392.0, 523.25],
  [293.66, 349.23, 440.0, 587.33],
  [220.0, 329.63, 392.0, 493.88],
  [196.0, 293.66, 392.0, 523.25],
];

export const createTownBgmController = (): TownBgmController => {
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let intervalId: number | null = null;
  let unlocked = false;
  let active = false;
  let chordIndex = 0;

  const ensureContext = () => {
    if (typeof window === "undefined") return null;
    if (context) return context;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    context = new AudioContextClass();
    masterGain = context.createGain();
    filter = context.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 1450;
    filter.Q.value = 0.28;
    masterGain.gain.value = 0;

    filter.connect(masterGain);
    masterGain.connect(context.destination);

    return context;
  };

  const fadeTo = (value: number, seconds = 1.2) => {
    const ctx = ensureContext();
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(value, now, seconds / 4);
  };

  const playChord = () => {
    const ctx = ensureContext();
    if (!ctx || !filter || !active || !unlocked) return;

    const now = ctx.currentTime;
    const notes = chordProgression[chordIndex % chordProgression.length];
    chordIndex += 1;

    notes.forEach((frequency, noteIndex) => {
      const oscillator = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const start = now + noteIndex * 0.035;
      const duration = 3.9;

      oscillator.type = noteIndex === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.detune.setValueAtTime(noteIndex === 0 ? -7 : 4, start);

      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.12, start + 0.75);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(noteGain);
      noteGain.connect(filter);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.08);
    });

    if (chordIndex % 4 === 2) {
      const sparkle = ctx.createOscillator();
      const sparkleGain = ctx.createGain();
      const sparkleStart = now + 2.1;

      sparkle.type = "sine";
      sparkle.frequency.setValueAtTime(1046.5, sparkleStart);
      sparkle.frequency.exponentialRampToValueAtTime(1567.98, sparkleStart + 0.55);
      sparkleGain.gain.setValueAtTime(0.0001, sparkleStart);
      sparkleGain.gain.exponentialRampToValueAtTime(0.035, sparkleStart + 0.12);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, sparkleStart + 1.15);

      sparkle.connect(sparkleGain);
      sparkleGain.connect(filter);
      sparkle.start(sparkleStart);
      sparkle.stop(sparkleStart + 1.25);
    }
  };

  const stopScheduler = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };

  const startScheduler = () => {
    if (!active || !unlocked || intervalId !== null) return;
    playChord();
    intervalId = window.setInterval(playChord, TOWN_BGM_BAR_MS);
  };

  const unlock = () => {
    if (unlocked) return;
    const ctx = ensureContext();
    if (!ctx) return;
    unlocked = true;
    void ctx.resume().finally(() => {
      if (active) {
        fadeTo(TOWN_BGM_VOLUME);
        startScheduler();
      }
    });
  };

  const setActive = (nextActive: boolean) => {
    active = nextActive;
    if (!active) {
      fadeTo(0, 0.8);
      stopScheduler();
      return;
    }

    if (!unlocked) return;
    const ctx = ensureContext();
    if (!ctx) return;
    void ctx.resume().finally(() => {
      fadeTo(TOWN_BGM_VOLUME);
      startScheduler();
    });
  };

  const cleanup = () => {
    active = false;
    stopScheduler();
    if (context) {
      void context.close().catch(() => {});
    }
    context = null;
    masterGain = null;
    filter = null;
  };

  return { cleanup, setActive, unlock };
};
