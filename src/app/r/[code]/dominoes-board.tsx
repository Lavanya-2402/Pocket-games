"use client";

import { useState } from "react";
import { fits, pips, type DominoView, type Side, type Tile } from "@/games/dominoes";
import type { BoardProps } from "./boards";
import { seatColor } from "./seat";

const PIPS: number[][] = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

function Half({ n, size }: { n: number; size: number }) {
  return (
    <span className="grid grid-cols-3 grid-rows-3" style={{ width: size, height: size, padding: size * 0.14 }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`m-auto size-[72%] rounded-full ${PIPS[n].includes(i) ? "bg-[#1b1c4b]" : ""}`} />
      ))}
    </span>
  );
}

/** One domino. `upright` stands it on end (used for the hand). */
function Domino({ tile, size, upright = false, lit = false, dim = false }: { tile: Tile; size: number; upright?: boolean; lit?: boolean; dim?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`Domino ${tile[0]} and ${tile[1]}`}
      className={`inline-flex shrink-0 items-center rounded-md border-2 bg-white transition ${upright ? "flex-col" : ""}
        ${lit ? "border-ink shadow-md" : "border-[#1b1c4b]/20"} ${dim ? "opacity-40" : ""}`}
    >
      <Half n={tile[0]} size={size} />
      <span className={`bg-[#1b1c4b]/25 ${upright ? "h-px w-[70%]" : "h-[70%] w-px"}`} />
      <Half n={tile[1]} size={size} />
    </span>
  );
}

/** Dominoes: match the ends of the line; draw when you can't. */
export function DominoesBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as DominoView;
  const [choose, setChoose] = useState<number | null>(null); // tile that fits both ends
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const bottom = mySeat ?? layout[0];
  const others = layout.filter((seat) => seat !== bottom);
  const left = s.chain[0]?.[0], right = s.chain[s.chain.length - 1]?.[1];
  const canPlay = myTurn && s.hand.some((t) => fits(t, s.chain).length > 0);
  const picking = myTurn && choose !== null && s.hand[choose] ? choose : null;
  const last = s.last;

  function tap(i: number) {
    const sides = fits(s.hand[i], s.chain);
    if (!sides.length) return;
    // Both ends take it, and it matters which: ask.
    if (sides.length === 2 && left !== right) return setChoose(i);
    setChoose(null);
    onMove({ type: "play", tile: i, side: sides[0] });
  }
  const play = (side: Side) => {
    onMove({ type: "play", tile: picking, side });
    setChoose(null);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* The other players */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, others.length)}, minmax(0, 1fr))` }}>
        {others.map((seat) => (
          <div key={seat} className={`min-w-0 rounded-2xl border bg-surface px-2.5 py-1.5 text-sm ${s.turn === seat && !s.winner ? "border-ink" : "border-transparent"}`}>
            <b className="block truncate" style={{ color: seatColor(seat) }}>{who(seat)}</b>
            <span className="text-xs text-muted">{s.counts[seat]} tile{s.counts[seat] === 1 ? "" : "s"}{s.hands ? ` · ${pips(s.hands[seat])} pips` : ""}</span>
          </div>
        ))}
      </div>

      {/* The line on the table */}
      <div className="flex min-h-28 flex-col justify-center gap-2 rounded-3xl bg-surface p-2.5">
        {s.chain.length === 0
          ? <p className="text-center text-sm text-muted">The table is empty. {who(s.turn)} can start with any tile.</p>
          : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1.5">
                {s.chain.map((t, i) => (
                  <Domino key={`${t[0]}-${t[1]}`} tile={t} size={s.chain.length > 14 ? 17 : 21} lit={i === 0 || i === s.chain.length - 1} />
                ))}
              </div>
              <p className="text-center text-xs text-muted">
                Open ends: <b className="text-ink">{left}</b> on the left, <b className="text-ink">{right}</b> on the right · {s.stock} in the pile
              </p>
            </>
          )}
      </div>

      <p key={`${last?.by}-${last?.kind}-${s.chain.length}-${s.stock}`} role="status" className="rise text-center text-sm text-muted">
        {!last ? "Match a number at either end of the line."
          : last.kind === "play" ? `${who(last.by)} played ${last.tile![0]}–${last.tile![1]}.`
          : last.kind === "draw" ? `${who(last.by)} drew a tile.`
          : `${who(last.by)} couldn't move and passed.`}
        {s.winner && s.passes >= s.players.length ? " Nobody can move — the lightest hand wins." : ""}
      </p>

      {picking !== null && (
        <div className="rise grid grid-cols-2 gap-2">
          <button type="button" onClick={() => play("left")} className="chunk h-12 rounded-2xl bg-accent font-semibold text-accent-ink">← Left end ({left})</button>
          <button type="button" onClick={() => play("right")} className="chunk h-12 rounded-2xl bg-accent font-semibold text-accent-ink">Right end ({right}) →</button>
        </div>
      )}

      {/* Your tiles */}
      {mySeat !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Your tiles · {s.hand.length}{s.winner ? ` · ${pips(s.hand)} pips` : ""}</span>
            {myTurn && !canPlay && (
              <button
                type="button"
                onClick={() => onMove({ type: s.stock > 0 ? "draw" : "pass" })}
                className="chunk h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
              >
                {s.stock > 0 ? `Draw a tile (${s.stock} left)` : "Pass"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {s.hand.map((t, i) => {
              const ok = myTurn && fits(t, s.chain).length > 0;
              return (
                <button
                  key={`${t[0]}-${t[1]}`}
                  type="button"
                  disabled={!ok}
                  onClick={() => tap(i)}
                  className={`transition active:scale-95 ${ok ? "-translate-y-1" : ""} ${picking === i ? "-translate-y-2.5" : ""}`}
                >
                  <Domino tile={t} size={30} upright lit={ok} dim={myTurn && !ok} />
                </button>
              );
            })}
          </div>
          {myTurn && !canPlay && <p className="text-center text-xs text-muted">None of your tiles fit.</p>}
        </div>
      ) : (
        <p className="text-center text-sm text-muted">{names[bottom]} · {s.counts[bottom]} tiles</p>
      )}
    </div>
  );
}
