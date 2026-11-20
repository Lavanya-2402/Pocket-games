"use client";

import { TARGET, type GreedyView } from "@/games/greedy";
import type { BoardProps } from "./boards";
import { Die } from "./dice";
import { seatColor } from "./seat";

/** Greedy Dice: keep rolling to grow the pot, bank it before a 1 takes it away. */
export function GreedyBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as GreedyView;
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const last = s.last;
  const dice = last?.dice ?? null;
  const lost = last?.kind === "bust" || last?.kind === "wipe";

  return (
    <div className="flex flex-col gap-3">
      {/* Race to the target */}
      <div className="flex flex-col gap-2">
        {layout.map((seat) => (
          <div key={seat} className={`rounded-2xl border bg-surface px-3 py-2 ${s.turn === seat && !s.winner ? "border-ink" : "border-transparent"}`}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <b className="truncate">{who(seat)}</b>
              <span className="text-muted">
                <b className="font-display text-xl font-extrabold tabular-nums" style={{ color: seatColor(seat) }}>{s.scores[seat]}</b> / {TARGET}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (s.scores[seat] / TARGET) * 100)}%`, background: seatColor(seat) }} />
            </div>
          </div>
        ))}
      </div>

      {/* The dice and the pot */}
      <div className="flex items-center justify-center gap-5 rounded-3xl bg-surface py-4">
        <span key={`${last?.by}-${last?.amount}-${dice?.join("")}-${s.pot}`} className="pop flex gap-2">
          <Die face={dice?.[0] ?? null} size={58} lit={dice?.[0] === 1} />
          <Die face={dice?.[1] ?? null} size={58} lit={dice?.[1] === 1} />
        </span>
        <span className="flex flex-col items-center">
          <span className="text-xs text-muted">In the pot</span>
          <span className="font-display text-4xl leading-none font-black tabular-nums">{s.pot}</span>
        </span>
      </div>

      <p key={`${last?.by}-${last?.kind}-${last?.amount}`} role="status" className={`rise text-center text-sm ${lost ? "font-semibold text-x" : "text-muted"}`}>
        {!last ? `Roll as often as you dare. Bank the pot before a 1 shows up. First to ${TARGET} wins.`
          : last.kind === "wipe" ? `Two 1s! ${who(last.by)} lost everything — ${last.amount} points gone.`
          : last.kind === "bust" ? `A 1! ${who(last.by)} lost the pot of ${last.amount}.`
          : last.kind === "bank" ? `${who(last.by)} banked ${last.amount}.`
          : `${who(last.by)} rolled ${last.amount}. ${last.by === mySeat ? "Roll again or bank it?" : ""}`}
      </p>

      {myTurn && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onMove({ type: "roll" })} className="chunk h-14 rounded-2xl bg-accent font-semibold text-accent-ink">
            🎲 Roll
          </button>
          <button
            type="button"
            disabled={s.pot === 0}
            onClick={() => onMove({ type: "bank" })}
            className="h-14 rounded-2xl border-2 border-ink font-semibold transition active:scale-[0.98] disabled:opacity-35"
          >
            Bank {s.pot > 0 ? s.pot : ""}
          </button>
        </div>
      )}
    </div>
  );
}
