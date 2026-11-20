"use client";

import { useState } from "react";
import { higher, type Bid, type LiarsDiceView } from "@/games/liarsdice";
import type { BoardProps } from "./boards";

type Seat = 0 | 1;
const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

/** One die, drawn with pips so it looks the same on every phone. */
function Die({ face, size = 44, lit = false, dim = false }: { face: number | null; size?: number; lit?: boolean; dim?: boolean }) {
  return (
    <span
      role="img"
      aria-label={face ? `Die showing ${face}` : "Hidden die"}
      className={`grid shrink-0 grid-cols-3 grid-rows-3 rounded-[22%] border-2 transition
        ${face ? "bg-white" : "bg-accent"} ${lit ? "border-x" : "border-ink/15"} ${dim ? "opacity-35" : ""}`}
      style={{ width: size, height: size, padding: Math.round(size * 0.13) }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`m-auto size-[70%] rounded-full ${face && PIPS[face].includes(i) ? "bg-[#1d1a16]" : ""}`} />
      ))}
    </span>
  );
}

const plural = (q: number, face: number) => `${q} × ${face}${q === 1 ? "" : "s"}`;

export function LiarsDiceBoard({ state, mySeat, names, layout, onMove }: BoardProps) {
  const s = state as LiarsDiceView;
  const me = mySeat;
  // Everyone else, in a fixed order; you (or the first seat, for spectators) at the bottom.
  const bottom = (me ?? layout[0]) as Seat;
  const others = layout.filter((seat) => seat !== bottom) as Seat[];
  const who = (seat: number) => (seat === me ? "You" : names[seat]);
  const myTurn = me !== null && s.turn === me && !s.winner;
  const total = s.counts.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* The other players' hidden dice */}
      <div className="flex flex-col gap-1.5">
        {others.map((seat) => (
          <div
            key={seat}
            className={`flex items-center justify-between rounded-2xl border bg-surface px-3 py-1.5 ${s.turn === seat && !s.winner ? "border-ink" : "border-transparent"}`}
          >
            <span className="min-w-0 truncate text-sm font-semibold">
              {who(seat)}{" "}
              <span className="font-normal text-muted">· {s.counts[seat] > 0 ? `${s.counts[seat]} dice` : "out"}</span>
            </span>
            <span className="flex gap-1">
              {Array.from({ length: s.counts[seat] }, (_, i) => <Die key={i} face={null} size={others.length > 1 ? 20 : 26} />)}
            </span>
          </div>
        ))}
      </div>

      {/* Last round's showdown */}
      {s.reveal && (!s.bid || s.winner) && (
        <div key={s.round} className="rise flex flex-col gap-1.5 rounded-2xl border border-line p-2.5 text-sm">
          <p>
            <b>{who(s.reveal.caller)}</b> called {who(s.reveal.bid.by)}&apos;s bid of <b>{plural(s.reveal.bid.q, s.reveal.bid.face)}</b>.
            There {s.reveal.count === 1 ? "was" : "were"} <b>{s.reveal.count}</b>
            {" — "}
            {s.reveal.count >= s.reveal.bid.q ? "the bid was true" : "it was a bluff"}. <b>{who(s.reveal.loser)}</b> lose{s.reveal.loser === me ? "" : "s"} a die.
          </p>
          {[...others, bottom].filter((seat) => s.reveal!.dice[seat].length > 0).map((seat) => (
            <div key={seat} className="flex items-center gap-2">
              <span className="w-14 shrink-0 truncate text-xs text-muted">{who(seat)}</span>
              <span className="flex gap-1">
                {s.reveal!.dice[seat].map((d, i) => (
                  <Die key={i} face={d} size={others.length > 1 ? 20 : 24} lit={d === s.reveal!.bid.face} dim={d !== s.reveal!.bid.face} />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The bid on the table */}
      {!s.winner && (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-surface py-3">
          {s.bid ? (
            <>
              <span className="text-sm text-muted">{who(s.bid.by)} bid</span>
              <span className="font-display text-3xl font-extrabold">{s.bid.q} ×</span>
              <Die face={s.bid.face} size={40} />
            </>
          ) : (
            <span className="text-sm text-muted">Round {s.round} · {who(s.turn)} open{s.turn === me ? "" : "s"} the bidding · {total} dice in play</span>
          )}
        </div>
      )}

      {/* Your own dice */}
      {me !== null ? (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs text-muted">{s.hand.length ? "Your dice (only you can see these)" : "You're out of dice — watching the rest"}</span>
          <span className="flex gap-2">
            {s.hand.map((d, i) => <Die key={`${s.round}-${i}`} face={d} size={48} lit={s.bid?.face === d} />)}
          </span>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">{names[bottom]} · {s.counts[bottom]} dice</p>
      )}

      {myTurn && <Controls key={`${s.round}-${s.bid?.q}-${s.bid?.face}`} bid={s.bid} total={total} onMove={onMove} />}
    </div>
  );
}

function Controls({ bid, total, onMove }: { bid: Bid | null; total: number; onMove: (m: unknown) => void }) {
  // Start on the smallest legal raise.
  const [q, setQ] = useState(bid ? (bid.face === 6 ? bid.q + 1 : bid.q) : 1);
  const [face, setFace] = useState(bid ? (bid.face === 6 ? 1 : bid.face + 1) : 1);
  const legal = q <= total && higher(q, face, bid);
  const minQ = bid ? bid.q : 1;

  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-surface p-3 rise">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button" aria-label="Fewer dice" disabled={q <= minQ}
            onClick={() => setQ(q - 1)}
            className="size-11 rounded-full border border-line text-xl active:scale-95 disabled:opacity-30"
          >−</button>
          <span className="w-8 text-center font-display text-3xl font-extrabold tabular-nums">{q}</span>
          <button
            type="button" aria-label="More dice" disabled={q >= total}
            onClick={() => setQ(q + 1)}
            className="size-11 rounded-full border border-line text-xl active:scale-95 disabled:opacity-30"
          >+</button>
        </div>
        <span className="text-sm text-muted">dice showing</span>
      </div>
      <div className="flex justify-between">
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <button
            key={f}
            type="button"
            aria-label={`Face ${f}`}
            aria-pressed={face === f}
            onClick={() => setFace(f)}
            className={`rounded-xl p-1 transition active:scale-95 ${face === f ? "bg-bg ring-2 ring-ink" : ""}`}
          >
            <Die face={f} size={36} />
          </button>
        ))}
      </div>
      <div className={`grid gap-2 ${bid ? "grid-cols-[1.4fr_1fr]" : ""}`}>
        <button
          type="button"
          disabled={!legal}
          onClick={() => onMove({ type: "bid", q, face })}
          className="h-12 rounded-2xl bg-accent font-semibold text-accent-ink transition active:scale-[0.98] disabled:opacity-40"
        >
          {legal ? `Bid ${plural(q, face)}` : "Bid higher"}
        </button>
        {bid && (
          <button
            type="button"
            onClick={() => onMove({ type: "call" })}
            className="h-12 rounded-2xl border-2 border-x font-semibold text-x transition active:scale-[0.98]"
          >
            Liar!
          </button>
        )}
      </div>
    </div>
  );
}
