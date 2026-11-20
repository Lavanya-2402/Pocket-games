"use client";

import { useState } from "react";
import { adjacent, makesMatch, N, TURNS, type TileMatchView } from "@/games/tilematch";
import type { BoardProps } from "./boards";
import { ScoreStrip } from "./dice";

/** Each kind of tile has its own colour AND shape, so colour alone never matters. */
const KIND = [
  { bg: "var(--x)", sym: "●", name: "red circle" },
  { bg: "var(--o)", sym: "◆", name: "teal diamond" },
  { bg: "var(--gold)", sym: "▲", name: "yellow triangle" },
  { bg: "var(--violet)", sym: "■", name: "purple square" },
  { bg: "#3d9bf0", sym: "★", name: "blue star" },
  { bg: "#4fb04a", sym: "♥", name: "green heart" },
];

/** Tile Match: swap two neighbours to line up three or more. */
export function TileMatchBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as TileMatchView;
  const [sel, setSel] = useState<number | null>(null);
  const [miss, setMiss] = useState(false);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const picked = myTurn ? sel : null;
  const roundsLeft = Math.ceil(s.turnsLeft / s.players.length);

  function tap(i: number) {
    setMiss(false);
    if (picked === null || !adjacent(picked, i)) return setSel(picked === i ? null : i);
    if (makesMatch(s.board, picked, i)) onMove({ a: picked, b: i });
    else setMiss(true);
    setSel(null);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <ScoreStrip layout={layout} scores={s.scores} who={who} turn={s.winner ? null : s.turn} />

      <div
        role="grid"
        aria-label="Tile board"
        className="grid gap-1 rounded-2xl bg-surface p-1.5"
        style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}
      >
        {s.board.map((k, i) => {
          const isSel = picked === i;
          const near = picked !== null && adjacent(picked, i);
          const moved = s.last && (s.last.a === i || s.last.b === i);
          return (
            <button
              key={`${i}:${k}`}
              role="gridcell"
              disabled={!myTurn}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${KIND[k].name}${isSel ? ", selected" : ""}`}
              aria-selected={isSel}
              onClick={() => tap(i)}
              style={{ background: KIND[k].bg }}
              className={`pop flex aspect-square items-center justify-center rounded-[22%] text-[min(5.2vw,1.4rem)] leading-none text-white transition
                ${isSel ? "z-10 scale-110 ring-4 ring-ink" : near ? "ring-2 ring-ink/50" : ""}
                ${moved && !isSel ? "ring-2 ring-white/70" : ""}`}
            >
              <span aria-hidden className="drop-shadow-sm">{KIND[k].sym}</span>
            </button>
          );
        })}
      </div>

      <p key={`${s.turnsLeft}-${miss}-${picked}`} role="status" className={`rise text-center text-sm ${miss ? "font-semibold text-x" : "text-muted"}`}>
        {miss ? "That swap doesn't line up three. Try another pair."
          : picked !== null ? "Now tap a tile next to it to swap them."
          : s.last
            ? `${who(s.last.by)} cleared ${s.last.cleared} tiles for ${s.last.pts} points${s.last.combo > 1 ? ` — a ${s.last.combo}-step chain!` : ""}${s.last.shuffled ? " No moves were left, so the board was dealt again." : ""}`
            : `Swap two neighbouring tiles to line up three. ${TURNS} turns each.`}
        {!s.winner && !miss && picked === null && <> · {roundsLeft} {roundsLeft === 1 ? "round" : "rounds"} left</>}
      </p>
    </div>
  );
}
