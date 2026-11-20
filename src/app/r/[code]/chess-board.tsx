"use client";

import { useState } from "react";
import { legalMoves, ownerOf, type ChessState, type Promo } from "@/games/chess";
import type { BoardProps } from "./boards";

// The solid chess symbols, forced to draw as text (not emoji) so they can be coloured.
const GLYPH: Record<string, string> = { k: "♚︎", q: "♛︎", r: "♜︎", b: "♝︎", n: "♞︎", p: "♟︎" };
const NAME: Record<string, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const FULL: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const square = (i: number) => `${"abcdefgh"[i & 7]}${8 - (i >> 3)}`;
// An outline made of shadows: it sits behind the piece, so the piece itself stays solid.
const WHITE = { color: "#ffffff", textShadow: "0 1px 0 #1b1c4b, 0 -1px 0 #1b1c4b, 1px 0 0 #1b1c4b, -1px 0 0 #1b1c4b, 1px 1px 0 #1b1c4b, -1px 1px 0 #1b1c4b, 1px -1px 0 #1b1c4b, -1px -1px 0 #1b1c4b, 0 3px 2px rgba(0,0,0,0.3)" } as const;
const BLACK = { color: "#1b1c4b", textShadow: "0 1px 0 #ffffff, 0 -1px 0 #ffffff, 1px 0 0 #ffffff, -1px 0 0 #ffffff, 1px 1px 0 #ffffff, -1px 1px 0 #ffffff, 1px -1px 0 #ffffff, -1px -1px 0 #ffffff" } as const;

function Piece({ p, className = "" }: { p: string; className?: string }) {
  return <span aria-hidden className={`leading-none ${className}`} style={ownerOf(p) === 0 ? WHITE : BLACK}>{GLYPH[p.toLowerCase()]}</span>;
}

/** Chess: tap a piece to see where it can go, then tap the square. */
export function ChessBoard({ state, mySeat, names, myTurn, onMove }: BoardProps) {
  const s = state as ChessState;
  const [pick, setPick] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const flip = mySeat === 1; // you always play up the board
  const legal = myTurn ? legalMoves(s) : [];
  const sel = pick !== null && legal.some((m) => m.from === pick) ? pick : null;
  const targets = new Set(legal.filter((m) => m.from === sel).map((m) => m.to));
  const movable = new Set(legal.map((m) => m.from));
  const last = s.last;
  const checked = s.check && !s.winner ? s.board.indexOf(s.turn === 0 ? "K" : "k") : -1;
  const asking = myTurn && promo ? promo : null;

  function tap(sq: number) {
    setPromo(null);
    if (sel !== null && targets.has(sq)) {
      if (legal.some((m) => m.from === sel && m.to === sq && m.promo)) setPromo({ from: sel, to: sq });
      else onMove({ from: sel, to: sq });
      return setPick(null);
    }
    setPick(movable.has(sq) && sel !== sq ? sq : null);
  }

  /** Pieces of this colour that have been taken. */
  const taken = (seat: number) =>
    Object.entries(FULL).flatMap(([t, n]) => {
      const p = seat === 0 ? t.toUpperCase() : t;
      return Array(Math.max(0, n - s.board.filter((x) => x === p).length)).fill(p) as string[];
    });

  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i));
  const top = flip ? 0 : 1;

  const tray = (seat: number) => (
    <div className="flex h-6 items-center justify-between gap-2 text-xs text-muted">
      <span className="truncate font-semibold" style={{ color: "var(--ink)" }}>{who(seat)} · {seat === 0 ? "White" : "Black"}</span>
      <span className="flex text-lg">{taken(1 - seat).map((p, i) => <Piece key={i} p={p} />)}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {tray(top)}
      <div role="grid" aria-label="Chess board" className="grid w-full grid-cols-8 overflow-hidden rounded-xl border-4 border-line">
        {order.map((sq) => {
          const r = sq >> 3, c = sq & 7;
          const dark = (r + c) % 2 === 1;
          const p = s.board[sq];
          const isTarget = targets.has(sq);
          const trail = last && (last.from === sq || last.to === sq);
          return (
            <button
              key={sq}
              role="gridcell"
              disabled={!myTurn}
              aria-label={`${square(sq)}: ${p ? `${ownerOf(p) === 0 ? "white" : "black"} ${NAME[p.toLowerCase()]}` : "empty"}${isTarget ? ", can move here" : ""}`}
              onClick={() => tap(sq)}
              className={`relative flex aspect-square items-center justify-center text-[min(9.4vw,2.6rem)] lg:text-[min(5.4vh,2.6rem)]
                ${trail ? (dark ? "bg-[#b9a04a]" : "bg-[#efe0a0]") : dark ? "bg-[#7f83c9]" : "bg-[#e6e8fb]"}
                ${sel === sq ? "outline outline-4 -outline-offset-4 outline-white" : ""}
                ${checked === sq ? "outline outline-4 -outline-offset-4 outline-[#e2553d]" : ""}`}
            >
              {p && <Piece p={p} className={last?.to === sq ? "pop" : ""} />}
              {isTarget && (
                <span className={`absolute rounded-full ${p ? "inset-1 border-4 border-white/85" : "size-[30%] bg-white/85 ring-2 ring-[#1b1c4b]/30"}`} />
              )}
            </button>
          );
        })}
      </div>
      {tray(1 - top)}

      {asking && (
        <div className="rise flex items-center justify-center gap-2 rounded-2xl bg-surface p-2">
          <span className="text-sm text-muted">Promote to</span>
          {(["q", "r", "b", "n"] as Promo[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-label={NAME[t]}
              onClick={() => {
                onMove({ ...asking, promo: t });
                setPromo(null);
              }}
              className="flex size-12 items-center justify-center rounded-xl bg-[#7f83c9] text-3xl active:scale-95"
            >
              <Piece p={mySeat === 0 ? t.toUpperCase() : t} />
            </button>
          ))}
        </div>
      )}

      <p key={`${s.plies}-${sel}`} role="status" className="rise text-center text-sm text-muted">
        {s.end === "mate" ? "Checkmate."
          : s.end === "stalemate" ? "Stalemate — no legal move, and not in check. A draw."
          : s.end === "fifty" ? "Fifty moves without a capture or a pawn move. A draw."
          : s.end === "material" ? "Not enough pieces left to checkmate. A draw."
          : s.end === "length" ? "The game reached the move limit. A draw."
          : sel !== null ? "Tap a marked square to move there."
          : <>
              {s.check && <b className="text-x">Check! </b>}
              {last
                ? `${who(last.by)} ${last.castled ? "castled" : `moved a ${NAME[last.piece.toLowerCase()]} ${square(last.from)} → ${square(last.to)}`}${last.took ? `, taking a ${NAME[last.took.toLowerCase()]}` : ""}.`
                : "White moves first. Tap a piece to see where it can go."}
            </>}
      </p>
    </div>
  );
}
