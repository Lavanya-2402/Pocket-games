"use client";

import { COLS, FACES, pairsWon, PAIRS, type MemoryView } from "@/games/memory";
import type { BoardProps } from "./boards";
import { scoreCols, seatColor } from "./seat";

/** Memory Match: a grid of face-down cards; flip two to find a pair. */
export function MemoryBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as MemoryView;
  const pts = pairsWon(s);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const tint = seatColor;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 text-center" style={scoreCols(layout.length)}>
        {layout.map((seat) => (
          <div key={seat} className="rounded-2xl bg-surface py-1.5">
            <span className="font-display text-2xl font-extrabold tabular-nums" style={{ color: tint(seat) }}>{pts[seat]}</span>
            <span className="ml-1.5 text-xs text-muted">{who(seat)}{layout.length === 2 ? " · pairs" : ""}</span>
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label="Memory cards"
        className="grid w-full gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {s.faces.map((face, i) => {
          const owner = s.owner[i];
          const up = face !== null;
          const flippable = myTurn && owner === null && !(s.up.length === 1 && s.up[0] === i);
          // A mismatched pair stays visible until the next flip; it can be picked again.
          const showing = s.up.includes(i);
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={`Card ${i + 1}: ${up ? FACES[face] : "face down"}${owner !== null ? `, won by ${who(owner)}` : ""}`}
              disabled={!flippable}
              onClick={() => onMove({ card: i })}
              className={`relative flex aspect-[4/5] items-center justify-center rounded-xl border-2 text-3xl transition
                ${up ? "bg-surface" : "border-transparent bg-accent"} ${flippable ? "active:scale-95" : ""}
                ${showing ? "border-ink" : up ? "border-line" : ""} ${owner !== null ? "opacity-55" : ""}`}
              style={owner !== null ? { borderColor: tint(owner) } : undefined}
            >
              {up
                ? <span key="face" className="pop">{FACES[face]}</span>
                : <span aria-hidden className="font-display text-lg font-extrabold text-accent-ink/40">?</span>}
            </button>
          );
        })}
      </div>

      <p key={s.last ? s.last.cards.join("-") : "start"} className="rise min-h-5 text-center text-sm text-muted">
        {s.up.length === 1
          ? `${who(s.turn)} turned one over…`
          : s.last
            ? s.last.pair
              ? `${who(s.last.by)} found a pair — ${s.last.by === mySeat ? "go" : "goes"} again`
              : "No match. Remember where they are!"
            : `Find the ${PAIRS} pairs.`}
      </p>
    </div>
  );
}
