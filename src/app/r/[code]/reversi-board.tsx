"use client";

import { count, flips, SIZE, type ReversiState } from "@/games/reversi";
import type { BoardProps } from "./boards";
import { ScoreStrip } from "./dice";
import { seatColor } from "./seat";

/** Reversi: trap their discs between yours to flip them. */
export function ReversiBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as ReversiState;
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const last = s.last;

  return (
    <div className="flex flex-col gap-2.5">
      <ScoreStrip layout={layout} scores={count(s.board)} who={who} turn={s.winner ? null : s.turn} />

      <div
        role="grid"
        aria-label="Reversi board"
        className="grid w-full gap-[3px] rounded-2xl bg-line p-[3px]"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {s.board.map((v, i) => {
          const gain = myTurn && mySeat !== null && v === null ? flips(s.board, i, mySeat).length : 0;
          const flipped = last?.flipped.includes(i);
          const placed = last?.cell === i;
          return (
            <button
              key={i}
              role="gridcell"
              disabled={gain === 0}
              aria-label={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${v === null ? (gain ? `empty, flips ${gain}` : "empty") : `${v === mySeat ? "your" : `${names[v]}'s`} disc`}`}
              onClick={() => onMove({ cell: i })}
              className={`flex aspect-square items-center justify-center rounded-[6px] bg-surface ${gain ? "active:scale-90" : ""}`}
            >
              {v !== null ? (
                <span
                  key={`${v}-${flipped ? last!.cell : "s"}`}
                  className={`size-[80%] rounded-full shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] ${flipped || placed ? "pop" : ""} ${placed ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""}`}
                  style={{ background: seatColor(v) }}
                />
              ) : gain > 0 ? (
                <span className="flex size-[46%] items-center justify-center rounded-full border-2 border-dashed border-ink/45 text-[10px] font-bold text-muted">{gain}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p key={last?.cell ?? "start"} role="status" className="rise text-center text-sm text-muted">
        {!last ? "Place a disc so their discs are trapped in a line between two of yours."
          : `${who(last.by)} flipped ${last.flipped.length}.${last.skipped ? ` ${who(1 - last.by)} had no move, so ${last.by === mySeat ? "you go" : `${names[last.by]} goes`} again.` : ""}`}
      </p>
    </div>
  );
}
