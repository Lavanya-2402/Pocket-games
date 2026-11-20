"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GAME_UI } from "@/app/r/[code]/boards";
import { getEngine } from "@/games";
import { api, me } from "@/lib/client";

interface ReplayData {
  id: string; game: string; gameName: string; names: string[];
  winner: string | null; forfeit: boolean; at: number;
  seed: number; order: [string, string]; rules: Record<string, boolean>; log: [number, unknown][];
}

/** Step through a finished game, rebuilt on this phone from its seed and move list. */
export function Replay() {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const id = location.pathname.split("/")[2] ?? "";
    api<ReplayData>(`/replays/${id}`).then(setData).catch((e: Error) => setError(e.message));
  }, []);

  // Every position of the game, start to finish.
  const states = useMemo(() => {
    if (!data) return [];
    const engine = getEngine(data.game)!;
    let s = engine.init(data.order, data.seed, data.rules);
    const out = [s];
    for (const [seat, move] of data.log) {
      try {
        s = engine.apply(s, move, data.order[seat]);
      } catch {
        break; // a move from an older version of the rules: stop at the last good position
      }
      out.push(s);
    }
    return out;
  }, [data]);
  const last = states.length - 1;

  // Auto-play runs until the last position, then simply stops.
  const running = playing && step < last;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setStep((n) => Math.min(last, n + 1)), 900);
    return () => clearTimeout(t);
  }, [running, step, last]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-10">
        <h1 className="font-display text-3xl font-extrabold">{error}</h1>
        <Link href="/" className="underline">Back home</Link>
      </div>
    );
  }
  if (!data || !states.length) return <p className="pt-10 text-center text-muted">Loading replay…</p>;

  const engine = getEngine(data.game)!;
  const ui = GAME_UI[data.game];
  const myId = me().id;
  const seat = data.order.indexOf(myId);
  const mySeat = seat === 0 || seat === 1 ? seat : null;
  const names: [string, string] = [data.names[0] ?? "Player 1", data.names[1] ?? "Player 2"];
  const who = (s: number) => (s === mySeat ? "You" : names[s]);
  // You see what you saw: your own hidden things, not the other player's — until the end.
  const base = engine.viewFor(states[step], mySeat === null ? null : myId) as object;
  const atEnd = step === last;
  const view = atEnd && data.forfeit ? { ...base, winner: data.winner } : base;
  const mover = step > 0 ? data.log[step - 1][0] : null;
  const btn = "flex size-11 items-center justify-center rounded-full border border-line bg-surface text-lg disabled:opacity-30";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 lg:max-w-xl">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="Home" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface">←</Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-extrabold">Replay · {data.gameName}</h1>
          <p className="truncate text-xs text-muted">
            {who(0)} vs {who(1)} · {new Date(data.at).toLocaleDateString()}
          </p>
        </div>
      </header>

      <p aria-live="polite" className="text-center text-sm">
        {step === 0 ? "Start of the game"
          : atEnd
            ? <b>{data.winner === null ? "It ended in a draw" : `${who(data.order.indexOf(data.winner))} won${data.forfeit ? " — the other player ran out of time" : ""}`}</b>
            : <>Move {step} of {last} · <b>{who(mover!)}</b></>}
      </p>

      {/* The real board, switched off: you're watching, not playing. */}
      <div inert className={`pointer-events-none ${ui?.fit ?? ""}`}>
        {ui && (
          <ui.Board state={view} mySeat={mySeat as 0 | 1 | null} names={names} layout={[0, 1]} myTurn={false} onMove={() => {}} />
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 bg-bg/95 px-4 py-2 backdrop-blur">
        <input
          type="range" min={0} max={last} value={step}
          onChange={(e) => {
            setPlaying(false);
            setStep(Number(e.target.value));
          }}
          aria-label="Position in the game"
          className="w-full accent-[var(--ink)]"
        />
        <div className="flex items-center justify-center gap-2">
          <button className={btn} aria-label="Go to start" disabled={step === 0} onClick={() => { setPlaying(false); setStep(0); }}>⏮</button>
          <button className={btn} aria-label="Back one move" disabled={step === 0} onClick={() => { setPlaying(false); setStep(step - 1); }}>◀</button>
          <button
            className="flex h-11 items-center rounded-full bg-accent px-6 font-semibold text-accent-ink"
            onClick={() => {
              if (atEnd) {
                setStep(0);
                setPlaying(true);
              } else setPlaying(!running);
            }}
          >
            {running ? "⏸ Pause" : atEnd ? "↺ Watch again" : "▶ Play"}
          </button>
          <button className={btn} aria-label="Forward one move" disabled={atEnd} onClick={() => { setPlaying(false); setStep(step + 1); }}>▶</button>
          <button className={btn} aria-label="Go to end" disabled={atEnd} onClick={() => { setPlaying(false); setStep(last); }}>⏭</button>
        </div>
      </div>
    </div>
  );
}
