// Alert sounds, synthesised with the Web Audio API (no audio files to load).
// Browsers keep audio locked until the user clicks or types on the page once.

export type SoundKind = 'new' | 'ready' | 'alert';

const PREF_KEY = 'bp_sound';
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export function onSoundChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function soundEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {}
  if (on) unlockAudio();
  notify();
}

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    ctx.onstatechange = notify;
  }
  return ctx;
}

export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume().then(notify, () => {});
}

export const audioLocked = () => {
  const c = audio();
  return !c || c.state !== 'running';
};

function tone(c: AudioContext, freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.25) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Plays an alert. Returns false when muted or the browser has not unlocked audio yet. */
export function playSound(kind: SoundKind) {
  if (!soundEnabled()) return false;
  const c = audio();
  if (!c || c.state !== 'running') return false;
  const t = c.currentTime;
  if (kind === 'new') {
    // Two-note bell: a new ticket or delivery
    tone(c, 880, t, 0.4);
    tone(c, 1318.5, t + 0.18, 0.6);
  } else if (kind === 'ready') {
    // Rising three notes: order ready for pickup
    tone(c, 659.3, t, 0.3);
    tone(c, 880, t + 0.15, 0.3);
    tone(c, 1108.7, t + 0.3, 0.5);
  } else {
    // Urgent triple beep: overdue
    for (let i = 0; i < 3; i++) tone(c, 740, t + i * 0.28, 0.2, 'square', 0.12);
  }
  return true;
}

// The first click or key press anywhere unlocks audio for the rest of the session.
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
