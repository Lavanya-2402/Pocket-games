"use client";

import { MINES, SIZE, TARGET, type MinefieldView } from "@/games/minefield";
import type { BoardProps } from "./boards";
import { scoreCols, seatColor } from "./seat";

const NUM = ["", "text-o", "text-[#5f9f45]", "text-x", "text-[#7b61d1]", "text-[#d9a21b]", "text-ink", "text-ink", "text-ink"];

/** Minefield Duel: a shared grid; mines are points. */
export function MinefieldBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as MinefieldView;
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const left = MINES - s.found.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 text-center" style={scoreCols(layout.length)}>
        {layout.map((seat) => (
          <div key={seat} className="rounded-2xl bg-surface py-1.5">
            <span className="font-display text-2xl font-extrabold tabular-nums" style={{ color: seatColor(seat) }}>{s.found[seat]}</span>
            <span className="ml-1.5 text-xs text-muted">{who(seat)}{layout.length === 2 ? ` · of ${TARGET} to win` : ""}</span>
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label="Minefield"
        className="grid w-full gap-[3px] rounded-2xl bg-line p-[3px]"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {s.cells.map((v, i) => {
          const open = myTurn && v === null;
          const mineBy = v !== null && v >= 10 ? v - 10 : null;
          const leftover = v === null && s.mines?.[i]; // unfound mine, shown at the end
          const isLast = s.last?.cell === i;
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${
                v === null ? "unopened" : mineBy !== null ? `mine found by ${who(mineBy)}` : `${v} mines nearby`}`}
              disabled={!open}
              onClick={() => onMove({ cell: i })}
              style={mineBy !== null ? { background: seatColor(mineBy) } : undefined}
              className={`flex aspect-square items-center justify-center rounded-[5px] font-display text-lg font-extrabold transition
                ${v === null ? "bg-accent/85" : mineBy === null ? "bg-surface" : ""}
                ${open ? "active:scale-90" : ""} ${isLast ? "ring-2 ring-ink ring-offset-1 ring-offset-line" : ""}`}
            >
              {mineBy !== null ? <span className="pop text-base">💣</span>
                : leftover ? <span className="text-sm opacity-60">💣</span>
                : v !== null && v > 0 ? <span className={`pop ${NUM[v]}`}>{v}</span> : null}
            </button>
          );
        })}
      </div>

      <p key={s.last?.cell ?? "start"} className="rise text-center text-sm text-muted">
        {s.last
          ? s.last.mine
            ? `${who(s.last.by)} found a mine — ${s.last.by === mySeat ? "go" : "goes"} again · ${left} left`
            : `${who(s.last.by)} opened a safe square · ${left} mines left`
          : `${MINES} mines are hidden. Find most of them.`}
      </p>
    </div>
  );
}
