"use client";

import type { TicTacToeState } from "@/games/tictactoe";

export function TicTacToeBoard({
  state,
  canMove,
  onMove,
}: {
  state: TicTacToeState;
  canMove: boolean;
  onMove: (cell: number) => void;
}) {
  const nextMark = state.turn === 0 ? "X" : "O";
  return (
    <div
      role="grid"
      aria-label="Tic tac toe board"
      className="grid aspect-square w-full grid-cols-3 gap-2 rounded-3xl bg-line p-2"
    >
      {state.board.map((mark, i) => {
        const win = state.line?.includes(i);
        const open = canMove && !mark;
        return (
          <button
            key={i}
            role="gridcell"
            aria-label={mark ? `Cell ${i + 1}: ${mark}` : `Cell ${i + 1}: empty`}
            disabled={!open}
            onClick={() => onMove(i)}
            className={`group relative flex items-center justify-center rounded-2xl transition
              ${win ? "bg-ink" : "bg-surface"} ${open ? "active:scale-95" : ""}`}
          >
            {mark && (
              <span
                key={mark}
                className={`pop font-display text-[min(22vw,6.5rem)] font-extrabold leading-none
                  ${win ? "text-surface" : mark === "X" ? "text-x" : "text-o"}`}
              >
                {mark === "X" ? "✕" : "◯"}
              </span>
            )}
            {open && (
              <span
                aria-hidden
                className={`font-display text-[min(22vw,6.5rem)] font-extrabold leading-none opacity-0 group-hover:opacity-20
                  ${nextMark === "X" ? "text-x" : "text-o"}`}
              >
                {nextMark === "X" ? "✕" : "◯"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
