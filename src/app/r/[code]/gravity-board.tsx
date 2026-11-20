"use client";

import { dropRow, SIZE, type GravityState } from "@/games/gravity";
import type { BoardProps } from "./boards";

/** Gravity Flip: tap a column to drop a disc, or spend your one flip to rotate the board. */
export function GravityBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as GravityState;
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const disc = (seat: number) => (seat === 0 ? "bg-x" : "bg-o");
  const inLine = (r: number, c: number) => s.line?.some(([lr, lc]) => lr === r && lc === c);
  const canFlip = myTurn && mySeat !== null && s.flips[mySeat] > 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        key={`grid-${s.flipCount}`}
        role="grid"
        aria-label="Gravity Flip board"
        className={`grid w-full gap-1 rounded-3xl bg-line p-2 ${s.flipCount > 0 && s.last?.type === "flip" ? "spin-in" : ""}`}
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SIZE }, (_, c) => {
          const open = myTurn && dropRow(s.board, c) !== -1;
          return (
            <button
              key={c}
              role="gridcell"
              aria-label={`Drop in column ${c + 1}`}
              disabled={!open}
              onClick={() => onMove({ type: "drop", col: c })}
              className={`group flex flex-col gap-1 rounded-xl p-0.5 ${open ? "active:bg-ink/10" : ""}`}
            >
              {s.board.map((row, r) => {
                const v = row[c];
                const isLast = s.last?.cell?.[0] === r && s.last.cell[1] === c;
                const ghost = open && r === dropRow(s.board, c);
                return (
                  <span key={r} className="relative aspect-square w-full rounded-full bg-surface">
                    {v !== null && (
                      <span
                        className={`absolute inset-0 rounded-full ${disc(v)} ${isLast ? "drop" : ""}
                          ${inLine(r, c) ? "ring-[3px] ring-ink ring-offset-1 ring-offset-surface" : ""}`}
                        style={isLast ? ({ "--rows": r + 1 } as React.CSSProperties) : undefined}
                      />
                    )}
                    {ghost && <span aria-hidden className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-25 ${disc(s.turn)}`} />}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onMove({ type: "flip" })}
          disabled={!canFlip}
          className="h-12 flex-1 rounded-2xl border border-ink font-semibold transition active:scale-[0.98] disabled:border-line disabled:text-muted"
        >
          ↻ Flip the board
        </button>
        <div className="text-xs text-muted">
          {layout.map((seat) => (
            <div key={seat}>
              <span className={seat === 0 ? "text-x" : "text-o"}>●</span> {who(seat)}: {s.flips[seat] > 0 ? "flip ready" : "flip used"}
            </div>
          ))}
        </div>
      </div>

      {s.last?.type === "flip" && !s.winner && (
        <p key={`note-${s.flipCount}`} className="rise text-center text-sm text-muted">
          {who(s.last.by)} flipped the board — everything fell to the new bottom.
        </p>
      )}
    </div>
  );
}
