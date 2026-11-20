"use client";

import { COLS, JUMPS, LAST, type ClimbView } from "@/games/climb";
import type { BoardProps } from "./boards";
import { Die } from "./dice";
import { seatColor } from "./seat";

/** Column and row (from the top) of a square; the numbers snake up from the bottom left. */
function place(n: number): [number, number] {
  const fromBottom = Math.floor((n - 1) / COLS);
  const along = (n - 1) % COLS;
  return [fromBottom % 2 === 0 ? along : COLS - 1 - along, COLS - 1 - fromBottom];
}
const centre = (n: number) => place(n).map((v) => v + 0.5) as [number, number];
const SQUARES = Array.from({ length: LAST }, (_, i) => i + 1);

/** Climb & Slide: a race up the board with ropes to climb and slides to fall down. */
export function ClimbBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as ClimbView;
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const last = s.last;
  const waiting = layout.filter((seat) => s.pos[seat] === 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <div className="grid gap-[2px] overflow-hidden rounded-2xl bg-line p-[2px]" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {Array.from({ length: LAST }, (_, i) => {
            // Cell i in reading order → which square number sits there.
            const col = i % COLS, row = Math.floor(i / COLS);
            const n = SQUARES.find((q) => place(q)[0] === col && place(q)[1] === row)!;
            const here = layout.filter((seat) => s.pos[seat] === n);
            const jump = JUMPS[n];
            return (
              <div
                key={n}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-[4px] text-[10px] leading-none
                  ${n === LAST ? "bg-accent text-accent-ink" : (col + row) % 2 ? "bg-surface" : "bg-bg"}`}
              >
                <span className="absolute top-0.5 left-1 opacity-60">{n === LAST ? "🏁" : n}</span>
                {jump && <span className={`absolute right-0.5 bottom-0.5 font-bold ${jump > n ? "text-o" : "text-x"}`}>{jump > n ? "▲" : "▼"}{jump}</span>}
                <span className="z-10 flex flex-wrap items-center justify-center gap-[1px]">
                  {here.map((seat) => (
                    <span
                      key={seat}
                      aria-label={`${who(seat)} on ${n}`}
                      className={`pop rounded-full border-2 border-white shadow ${here.length > 1 ? "size-3" : "size-4"}`}
                      style={{ background: seatColor(seat) }}
                    />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        {/* Ropes and slides drawn over the squares */}
        <svg viewBox={`0 0 ${COLS} ${COLS}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {Object.entries(JUMPS).map(([from, to]) => {
            const [x1, y1] = centre(Number(from));
            const [x2, y2] = centre(to);
            const up = to > Number(from);
            return (
              <line
                key={from} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={up ? "var(--o)" : "var(--x)"} strokeWidth={0.13} strokeLinecap="round" opacity={0.42}
                strokeDasharray={up ? "0.02 0.3" : undefined}
              />
            );
          })}
        </svg>
      </div>

      {waiting.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          Waiting to start:
          {waiting.map((seat) => (
            <span key={seat} className="flex items-center gap-1">
              <span className="size-3 rounded-full" style={{ background: seatColor(seat) }} />{who(seat)}
            </span>
          ))}
        </p>
      )}

      <div className="flex items-center gap-3 rounded-2xl bg-surface p-2.5">
        <span key={`${last?.by}-${last?.from}-${last?.roll}`} className="pop"><Die face={last?.roll ?? null} size={46} /></span>
        <p className="min-w-0 flex-1 text-sm">
          {!last ? `First to square ${LAST} wins. ▲ ropes take you up, ▼ slides take you down.`
            : <>
                <b>{who(last.by)}</b> rolled {last.roll}
                {last.to > last.landed ? <> and <b className="text-o">climbed a rope to {last.to}</b></>
                  : last.to < last.landed ? <> and <b className="text-x">slid down to {last.to}</b></>
                  : <> → {last.to}</>}
                {last.roll === 6 && !s.winner ? " · a six rolls again" : ""}
              </>}
        </p>
        {myTurn && (
          <button type="button" onClick={() => onMove({ type: "roll" })} className="chunk h-12 shrink-0 rounded-2xl bg-accent px-5 font-semibold text-accent-ink">
            Roll
          </button>
        )}
      </div>
    </div>
  );
}
