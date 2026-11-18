"use client";

import { COLS, dropRow, type Connect4State } from "@/games/connect4";

export function Connect4Board({
  state,
  canMove,
  onMove,
}: {
  state: Connect4State;
  canMove: boolean;
  onMove: (col: number) => void;
}) {
  const isWin = (r: number, c: number) => state.line?.some(([lr, lc]) => lr === r && lc === c);
  const disc = (seat: 0 | 1) => (seat === 0 ? "bg-x" : "bg-o");

  return (
    <div
      role="grid"
      aria-label="Connect Four board"
      className="grid w-full gap-1.5 rounded-3xl bg-line p-2"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: COLS }, (_, c) => {
        const open = canMove && dropRow(state.board, c) !== -1;
        return (
          <button
            key={c}
            role="gridcell"
            aria-label={`Drop in column ${c + 1}`}
            disabled={!open}
            onClick={() => onMove(c)}
            className={`group flex flex-col gap-1.5 rounded-2xl p-0.5 transition ${open ? "active:bg-ink/10" : ""}`}
          >
            {state.board.map((row, r) => {
              const v = row[c];
              const isLast = state.last?.[0] === r && state.last?.[1] === c;
              const ghost = open && r === dropRow(state.board, c);
              return (
                <span key={r} className="relative aspect-square w-full rounded-full bg-surface">
                  {v !== null && (
                    <span
                      key={`${r}-${c}-${v}`}
                      className={`absolute inset-0 rounded-full ${disc(v)} ${isLast ? "drop" : ""}
                        ${isWin(r, c) ? "ring-4 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                      style={isLast ? ({ "--rows": r + 1 } as React.CSSProperties) : undefined}
                    />
                  )}
                  {ghost && (
                    <span
                      aria-hidden
                      className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-25 ${disc(state.turn)}`}
                    />
                  )}
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}
