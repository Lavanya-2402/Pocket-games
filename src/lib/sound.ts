"use client";

/**
 * Tiny synthesized sound effects (Web Audio, no files). Phones only allow audio after
 * a tap, so the context is created/resumed on the first touch.
 */

let ctx: AudioContext | null = null;
let muted: boolean | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
}

export function isMuted() {
  if (muted === null) {
    try {
      muted = localStorage.getItem("pg.muted") === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("pg.muted", m ? "1" : "0");
  } catch {
    /* private mode */
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; to?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const { type = "sine", gain = 0.12, at = 0, to } = opts;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS = {
  /** You made a move. */
  tap: () => tone(660, 0.08, { type: "triangle", gain: 0.14 }),
  /** The other player moved / a round was revealed. */
  opponent: () => {
    tone(440, 0.07, { type: "triangle" });
    tone(554, 0.09, { type: "triangle", at: 0.07 });
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: "triangle", gain: 0.13, at: i * 0.1 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, { type: "sine", gain: 0.12, at: i * 0.14 })),
  draw: () => {
    tone(440, 0.15, { type: "sine" });
    tone(440, 0.15, { type: "sine", at: 0.18 });
  },
  chat: () => tone(880, 0.12, { type: "sine", gain: 0.08, to: 1320 }),
  react: () => tone(600, 0.1, { type: "sine", gain: 0.07, to: 900 }),
  /** Last seconds of your turn. */
  tick: () => tone(1000, 0.04, { type: "square", gain: 0.04 }),
  error: () => tone(200, 0.15, { type: "sawtooth", gain: 0.06, to: 140 }),
} as const;

export type Sound = keyof typeof SOUNDS;

export function play(s: Sound) {
  if (isMuted()) return;
  try {
    SOUNDS[s]();
  } catch {
    /* audio unavailable */
  }
}
