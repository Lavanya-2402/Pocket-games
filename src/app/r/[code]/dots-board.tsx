"use client";

import { N, score, type DotsMove, type DotsState } from "@/games/dots";
import type { BoardProps } from "./boards";
import { scoreCols, seatColor } from "./seat";

const STEP = 20; // SVG units between dots
const PAD = 6;
const SIZE = N * STEP + PAD * 2;
const pos = (i: number) => PAD + i * STEP;

/** Dots and Boxes on an SVG grid: tap a gap between two dots to draw the line. */
export function DotsBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as DotsState;
  const pts = score(s);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const fill = seatColor;
  const isLast = (o: "h" | "v", r: number, c: number) => s.last?.o === o && s.last.r === r && s.last.c === c;

  const line = (o: "h" | "v", r: number, c: number) => {
    const owner = (o === "h" ? s.h : s.v)[r][c];
    const x1 = pos(c), y1 = pos(r);
    const x2 = o === "h" ? pos(c + 1) : x1;
    const y2 = o === "v" ? pos(r + 1) : y1;
    const move: DotsMove = { o, r, c };
    return (
      <g key={`${o}${r}-${c}`}>
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={owner === null ? "var(--line)" : fill(owner)}
          strokeWidth={owner === null ? 1 : isLast(o, r, c) ? 3 : 2.2}
          strokeLinecap="round"
          strokeDasharray={owner === null ? "1 2.5" : undefined}
        />
        {owner === null && myTurn && (
          // Fat invisible target so the line is easy to hit with a thumb.
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="transparent" strokeWidth={9} strokeLinecap="round"
            className="cursor-pointer"
            role="button"
            aria-label={`Draw ${o === "h" ? "horizontal" : "vertical"} line, row ${r + 1}, column ${c + 1}`}
            onClick={() => onMove(move)}
          />
        )}
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 text-center" style={scoreCols(layout.length)}>
        {layout.map((seat) => (
          <div key={seat} className="rounded-2xl bg-surface py-1.5">
            <span className="font-display text-2xl font-extrabold tabular-nums" style={{ color: fill(seat) }}>{pts[seat]}</span>
            <span className="ml-1.5 text-xs text-muted">{who(seat)}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full touch-manipulation rounded-3xl bg-surface" role="group" aria-label="Dots and Boxes board">
        {s.boxes.map((row, r) => row.map((owner, c) => owner !== null && (
          <rect
            key={`b${r}-${c}`}
            x={pos(c) + 1.4} y={pos(r) + 1.4} width={STEP - 2.8} height={STEP - 2.8} rx={2.5}
            fill={fill(owner)} opacity={0.3}
            className="pop" style={{ transformOrigin: `${pos(c) + STEP / 2}px ${pos(r) + STEP / 2}px` }}
          />
        )))}
        {Array.from({ length: N + 1 }, (_, r) => Array.from({ length: N }, (_, c) => line("h", r, c)))}
        {Array.from({ length: N }, (_, r) => Array.from({ length: N + 1 }, (_, c) => line("v", r, c)))}
        {Array.from({ length: (N + 1) * (N + 1) }, (_, i) => (
          <circle key={i} cx={pos(i % (N + 1))} cy={pos(Math.floor(i / (N + 1)))} r={1.6} fill="var(--ink)" pointerEvents="none" />
        ))}
      </svg>

      {s.last && !s.winner && (
        <p key={`${s.last.o}${s.last.r}${s.last.c}`} className="rise text-center text-sm text-muted">
          {s.last.closed > 0
            ? `${who(s.last.by)} closed ${s.last.closed === 2 ? "two boxes" : "a box"} — ${s.last.by === mySeat ? "go" : "goes"} again`
            : `${who(s.last.by)} drew a line`}
        </p>
      )}
    </div>
  );
}
