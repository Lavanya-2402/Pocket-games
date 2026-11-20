"use client";

import { count, flips, SIZE, type TerritoryState } from "@/games/territory";
import type { BoardProps } from "./boards";

/** Territory: tap an empty square; touching enemy pieces flip to your colour. */
export function TerritoryBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as TerritoryState;
  const pts = count(s.board);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const total = SIZE * SIZE;

  return (
    <div className="flex flex-col gap-3">
      {/* Share of the board, as one bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs">
          {layout.map((seat) => (
            <span key={seat} className="font-semibold">
              <span className={seat === 0 ? "text-x" : "text-o"}>●</span> {who(seat)} · {pts[seat]}
            </span>
          ))}
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`${who(layout[0])} ${pts[layout[0]]}, ${who(layout[1])} ${pts[layout[1]]}`}>
          <span className={layout[0] === 0 ? "bg-x" : "bg-o"} style={{ width: `${(pts[layout[0]] / total) * 100}%` }} />
          <span className="flex-1" />
          <span className={layout[1] === 0 ? "bg-x" : "bg-o"} style={{ width: `${(pts[layout[1]] / total) * 100}%` }} />
        </div>
      </div>

      <div
        role="grid"
        aria-label="Territory board"
        className="grid w-full gap-1.5 rounded-3xl bg-line p-2"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {s.board.map((v, i) => {
          const open = myTurn && v === null;
          const gain = open && mySeat !== null ? flips(s.board, i, mySeat).length : 0;
          const justFlipped = s.last?.flipped.includes(i);
          const justPlaced = s.last?.cell === i;
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${v === null ? `empty${gain ? `, flips ${gain}` : ""}` : v === 0 ? "coral" : "teal"}`}
              disabled={!open}
              onClick={() => onMove({ cell: i })}
              className={`relative flex aspect-square items-center justify-center rounded-xl bg-surface ${open ? "active:scale-95" : ""}`}
            >
              {v !== null && (
                <span
                  key={`${v}-${justFlipped ? s.last!.cell : "s"}`}
                  className={`size-[76%] rounded-full ${v === 0 ? "bg-x" : "bg-o"} ${justFlipped || justPlaced ? "pop" : ""}
                    ${justPlaced ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""}`}
                />
              )}
              {open && gain > 0 && (
                <span className="text-xs font-bold text-muted">+{gain}</span>
              )}
            </button>
          );
        })}
      </div>

      {s.last && !s.winner && (
        <p key={s.last.cell} className="rise text-center text-sm text-muted">
          {who(s.last.by)} flipped {s.last.flipped.length} piece{s.last.flipped.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
