"use client";

import { SIZE, type FiveState } from "@/games/five";
import type { BoardProps } from "./boards";

/** Five in a Row: stones on a 10×10 grid. */
export function FiveBoard({ state, myTurn, onMove }: BoardProps) {
  const s = state as FiveState;
  return (
    <div
      role="grid"
      aria-label="Five in a Row board"
      className="grid w-full gap-[2px] rounded-2xl bg-line p-[3px]"
      style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
    >
      {s.board.map((v, i) => {
        const win = s.line?.includes(i);
        const open = myTurn && v === null;
        return (
          <button
            key={i}
            role="gridcell"
            aria-label={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${v === null ? "empty" : v === 0 ? "coral" : "teal"}`}
            disabled={!open}
            onClick={() => onMove({ cell: i })}
            className={`group relative flex aspect-square items-center justify-center rounded-[4px] bg-surface ${open ? "active:bg-line" : ""}`}
          >
            {v !== null && (
              <span
                className={`pop size-[78%] rounded-full ${v === 0 ? "bg-x" : "bg-o"}
                  ${win ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : s.last === i ? "ring-2 ring-ink/40" : ""}`}
              />
            )}
            {open && (
              <span className={`size-[78%] rounded-full opacity-0 group-hover:opacity-25 ${s.turn === 0 ? "bg-x" : "bg-o"}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
