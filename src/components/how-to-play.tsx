"use client";

import { useEffect, useRef } from "react";
import { getEngine } from "@/games";
import { RULES } from "@/games/rules";

/** The rules for one game, as a card. */
export function RulesCard({ game, hideTitle = false }: { game: string; hideTitle?: boolean }) {
  const r = RULES[game];
  if (!r) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        {!hideTitle && <h3 className="font-display text-2xl font-extrabold">{r.title}</h3>}
        <p className="text-sm text-muted">
          {r.tagline}
          {(getEngine(game)?.maxPlayers ?? 2) > 2 && <> For 2 to {getEngine(game)!.maxPlayers} players.</>}
        </p>
      </div>
      <p className="rounded-2xl bg-bg px-4 py-3 text-sm">
        <span className="font-semibold">Goal: </span>{r.goal}
      </p>
      <div>
        <h4 className="mb-2 font-display text-sm font-bold text-muted">How to play</h4>
        <ol className="flex flex-col gap-2 text-sm">
          {r.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h4 className="mb-2 font-display text-sm font-bold text-muted">Tips</h4>
        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          {r.tips.map((t, i) => <li key={i}>💡 {t}</li>)}
        </ul>
      </div>
    </div>
  );
}

/** A "How to play" button that opens the rules in a bottom sheet. */
export function HowToPlayButton({ game, className = "", compact = false }: { game: string; className?: string; compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Close on the way out: a modal left open on a hidden page would block the next one.
  useEffect(() => {
    const d = ref.current;
    return () => d?.close();
  }, []);
  if (!RULES[game]) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="How to play"
        className={`shrink-0 rounded-full border border-line bg-surface ${compact ? "size-10 font-bold" : "px-4 py-2 text-sm"} ${className}`}
      >
        {compact ? "?" : "How to play"}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current.close()}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <RulesCard game={game} />
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="h-12 rounded-2xl bg-accent font-semibold text-accent-ink"
          >
            Got it
          </button>
        </div>
      </dialog>
    </>
  );
}
