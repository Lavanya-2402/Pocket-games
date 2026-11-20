"use client";

import { useState } from "react";
import { isKing, legalMoves, ownerOf, QUIET_LIMIT, SIZE, type CheckersState } from "@/games/checkers";
import type { BoardProps } from "./boards";
import { seatColor } from "./seat";

/** Checkers: tap a piece, then where it should go. Multi-jumps are tapped square by square. */
export function CheckersBoard({ state, mySeat, names, myTurn, onMove }: BoardProps) {
  const s = state as CheckersState;
  const [pick, setPick] = useState<{ from: number; path: number[] } | null>(null);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const flip = mySeat === 1; // you always play up the board
  const moves = myTurn && mySeat !== null ? legalMoves(s.board, mySeat) : [];
  // A selection only counts while it still matches a legal move.
  const sel = pick && moves.some((m) => m.from === pick.from && pick.path.every((v, i) => m.path[i] === v)) ? pick : null;
  const live = sel ? moves.filter((m) => m.from === sel.from && sel.path.every((v, i) => m.path[i] === v)) : [];
  const targets = new Set(live.map((m) => m.path[sel!.path.length]));
  const movable = new Set(moves.map((m) => m.from));
  const mustJump = moves.length > 0 && Math.abs(Math.floor(moves[0].path[0] / SIZE) - Math.floor(moves[0].from / SIZE)) === 2;
  const last = s.last;
  const counts = [0, 1].map((seat) => s.board.filter((p) => p !== null && ownerOf(p) === seat).length);

  function tap(sq: number) {
    if (sel && targets.has(sq)) {
      const path = [...sel.path, sq];
      const done = live.find((m) => m.path.length === path.length && m.path[path.length - 1] === sq);
      if (done) {
        onMove({ from: sel.from, path });
        setPick(null);
      } else setPick({ from: sel.from, path }); // more jumps to come
      return;
    }
    setPick(movable.has(sq) && sel?.from !== sq ? { from: sq, path: [] } : null);
  }

  const order = Array.from({ length: SIZE * SIZE }, (_, i) => (flip ? SIZE * SIZE - 1 - i : i));
  const standing = sel?.path.length ? sel.path[sel.path.length - 1] : sel?.from;

  return (
    <div className="flex flex-col gap-2.5">
      <div role="grid" aria-label="Checkers board" className="grid w-full overflow-hidden rounded-2xl border-4 border-line" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
        {order.map((sq) => {
          const r = Math.floor(sq / SIZE), c = sq % SIZE;
          const dark = (r + c) % 2 === 1;
          const p = s.board[sq];
          const isTarget = targets.has(sq);
          const canPick = movable.has(sq);
          const trail = last && (last.from === sq || last.path.includes(sq));
          return (
            <button
              key={sq}
              role="gridcell"
              disabled={!dark || !(isTarget || canPick)}
              aria-label={`Row ${r + 1}, column ${c + 1}: ${p === null ? (isTarget ? "move here" : "empty") : `${ownerOf(p) === mySeat ? "your" : `${names[ownerOf(p)]}'s`} ${isKing(p) ? "king" : "piece"}`}`}
              onClick={() => tap(sq)}
              className={`relative flex aspect-square items-center justify-center ${dark ? "bg-[#7f83c9]" : "bg-[#e6e8fb]"} ${trail && dark ? "bg-[#9da1e0]" : ""}`}
            >
              {p !== null && (
                <span
                  className={`flex size-[78%] items-center justify-center rounded-full border-2 border-white/80 text-[min(4vw,1.1rem)] leading-none text-white shadow-[0_3px_0_rgba(0,0,0,0.3)] transition
                    ${sel?.from === sq ? "scale-110 ring-4 ring-white" : canPick && !sel ? "ring-2 ring-white/80" : ""}
                    ${sel && sel.from === sq && sel.path.length ? "opacity-40" : ""} ${last?.path[last.path.length - 1] === sq ? "pop" : ""}`}
                  style={{ background: seatColor(ownerOf(p)) }}
                >
                  {isKing(p) ? "♛" : ""}
                </span>
              )}
              {isTarget && <span className="absolute size-[38%] rounded-full bg-white/85 ring-2 ring-ink/40" />}
              {standing === sq && sel!.path.length > 0 && <span className="absolute size-[60%] rounded-full border-2 border-dashed border-white" />}
            </button>
          );
        })}
      </div>

      <p key={`${last?.from}-${last?.path.join()}-${sel?.from}-${sel?.path.length}`} role="status" className="rise text-center text-sm text-muted">
        {sel?.path.length ? "Keep jumping — tap the next square."
          : sel ? "Now tap where it should go."
          : myTurn && mustJump ? <b className="text-ink">You must capture. Tap the piece that can jump.</b>
          : last ? `${who(last.by)} ${last.taken.length ? `captured ${last.taken.length}` : "moved"}${last.crowned ? " and got a king 👑" : ""}.`
          : "Tap one of your pieces, then the square to move to."}
        {" "}{who(0)} {counts[0]} · {who(1)} {counts[1]}
        {s.quiet >= QUIET_LIMIT - 10 && !s.winner ? ` · draw in ${QUIET_LIMIT - s.quiet} moves unless someone captures` : ""}
      </p>
    </div>
  );
}
