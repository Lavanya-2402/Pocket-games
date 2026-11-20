"use client";

import { TARGET, THROWS, type RpsView, type Throw } from "@/games/rps";
import type { BoardProps } from "./boards";
import { seatColor } from "./seat";

const HAND: Record<Throw, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const NAME: Record<Throw, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" };

/** Rock Paper Scissors: both pick in secret, both are shown together. */
export function RpsBoard({ state, mySeat, names, layout, onMove }: BoardProps) {
  const s = state as RpsView;
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const mine = mySeat !== null ? s.pending[mySeat] : null;
  const canPick = mySeat !== null && !s.winner && !mine;
  const last = s.last;

  return (
    <div className="flex flex-col gap-3">
      {/* Score: first to the target */}
      <div className="grid grid-cols-2 gap-2">
        {layout.map((seat) => (
          <div key={seat} className="rounded-2xl bg-surface px-3 py-2 text-center">
            <span className="block truncate text-sm font-semibold">{who(seat)}</span>
            <span className="flex justify-center gap-1.5 pt-1" role="img" aria-label={`${s.wins[seat]} of ${TARGET} rounds won`}>
              {Array.from({ length: TARGET }, (_, i) => (
                <span key={i} className="size-3.5 rounded-full border-2" style={{ borderColor: seatColor(seat), background: i < s.wins[seat] ? seatColor(seat) : "transparent" }} />
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* The last round, face to face (a new pick stays hidden until both are in) */}
      <div key={s.round} className="flex items-center justify-around rounded-3xl bg-surface py-4">
        {layout.map((seat, i) => {
          const waiting = s.pending[seat] !== null;
          const shown = last ? HAND[last.throws[seat]] : "❔";
          const won = last?.winner === seat;
          return (
            <div key={seat} className="flex flex-col items-center gap-1">
              <span className={`pop text-6xl leading-none ${i === 0 ? "-scale-x-100" : ""} ${last && !won && last.winner !== null ? "opacity-40" : ""}`}>
                {shown}
              </span>
              <span className="text-xs text-muted">
                {last ? NAME[last.throws[seat]] : who(seat)}
                {waiting && !s.winner && <b className="text-o"> · picked ✓</b>}
              </span>
            </div>
          );
        })}
      </div>

      <p key={`${s.round}-${mine}`} role="status" className="rise text-center text-sm text-muted">
        {mine && mine !== "hidden" && !s.winner ? `You picked ${NAME[mine]}. Waiting for ${names[1 - mySeat!]}…`
          : !last ? `Pick at the same time. First to win ${TARGET} rounds.`
          : last.winner === null ? "Same pick — nobody scores. Go again."
          : `${NAME[last.throws[last.winner]]} beats ${NAME[last.throws[1 - last.winner]]}. ${who(last.winner)} ${last.winner === mySeat ? "win" : "wins"} the round.`}
      </p>

      {mySeat !== null && !s.winner && (
        <div className="grid grid-cols-3 gap-2">
          {THROWS.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!canPick}
              aria-pressed={mine === t}
              onClick={() => onMove({ pick: t })}
              className={`flex h-24 flex-col items-center justify-center gap-1 rounded-2xl font-semibold transition
                ${mine === t ? "bg-ink text-bg" : canPick ? "chunk bg-accent text-accent-ink" : "bg-surface opacity-40"}`}
            >
              <span className="text-4xl leading-none">{HAND[t]}</span>
              <span className="text-sm">{NAME[t]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
