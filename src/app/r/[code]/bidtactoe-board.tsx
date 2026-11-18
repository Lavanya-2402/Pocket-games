"use client";

import { useState } from "react";
import type { BidTacToeView, Seat } from "@/games/bidtactoe";

const MARK = ["✕", "◯"] as const;
const COLOR = ["text-x", "text-o"] as const;
const CELL_NAMES = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
];

export function BidTacToeBoard({
  state,
  mySeat,
  names,
  onBid,
}: {
  state: BidTacToeView;
  mySeat: number | null;
  names: [string, string];
  onBid: (bid: number, cell: number) => void;
}) {
  const me = mySeat === 0 || mySeat === 1 ? (mySeat as Seat) : null;
  const opp = me === null ? null : ((1 - me) as Seat);
  const myPending = me === null ? null : state.pending[me];
  const locked = myPending !== null && myPending !== "hidden" ? myPending : null;
  const canBid = me !== null && !state.winner && !locked;

  // Reset the picker every round by keying state on the round number.
  const [pick, setPick] = useState<{ round: number; cell: number | null; bid: number }>({
    round: state.round, cell: null, bid: 0,
  });
  const current = pick.round === state.round ? pick : { round: state.round, cell: null, bid: 0 };
  const max = me === null ? 0 : state.coins[me];
  const bid = Math.min(current.bid, max);
  const setBid = (b: number) => setPick({ ...current, bid: Math.max(0, Math.min(max, Math.round(b))) });
  const setCell = (c: number) => setPick({ ...current, cell: c });

  const who = (s: Seat) => (s === me ? "You" : names[s]);
  const target = locked ? locked.cell : current.cell;

  return (
    <div className="flex flex-col gap-4">
      {/* Coins */}
      <div className="grid grid-cols-2 gap-3">
        {([0, 1] as Seat[]).map((s) => (
          <div key={s} className="rounded-2xl bg-surface px-4 py-3">
            <div className="flex items-center justify-between text-sm text-muted">
              <span className="truncate">{who(s)} <span className={COLOR[s]}>{MARK[s]}</span></span>
              {state.tieHolder === s && (
                <span title="Wins tied bids" className="rounded-full border border-line px-2 text-xs">tie ⚖</span>
              )}
            </div>
            <div className="font-display text-3xl font-extrabold tabular-nums">
              {state.coins[s]}<span className="ml-1 text-base text-muted">coins</span>
            </div>
            {!state.winner && (
              <div className="text-xs text-muted">
                {state.pending[s] ? "Bid locked ✓" : "Choosing…"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Last round reveal */}
      {state.last && (
        <p key={state.round} className="rise rounded-2xl border border-line px-4 py-3 text-sm">
          <span className="font-semibold">Round {state.round - 1}:</span>{" "}
          {who(0)} bid <b>{state.last.bids[0].bid}</b>, {who(1)} bid <b>{state.last.bids[1].bid}</b>
          {state.last.tie && " (tie)"} → <b>{who(state.last.won)}</b> placed{" "}
          <span className={COLOR[state.last.won]}>{MARK[state.last.won]}</span>{" "}
          {CELL_NAMES[state.last.bids[state.last.won].cell]}
          {state.last.won !== me && me !== null && state.last.bids[me].cell !== state.last.bids[state.last.won].cell &&
            ` (you wanted ${CELL_NAMES[state.last.bids[me].cell]})`}
          .
        </p>
      )}

      {/* Board */}
      <div role="grid" aria-label="Bid-Tac-Toe board" className="grid aspect-square w-full grid-cols-3 gap-2 rounded-3xl bg-line p-2">
        {state.board.map((v, i) => {
          const win = state.line?.includes(i);
          const chosen = target === i && v === null;
          return (
            <button
              key={i}
              role="gridcell"
              aria-label={`${CELL_NAMES[i]}: ${v === null ? "empty" : MARK[v]}`}
              aria-selected={chosen}
              disabled={!canBid || v !== null}
              onClick={() => setCell(i)}
              className={`relative flex items-center justify-center rounded-2xl transition
                ${win ? "bg-ink" : "bg-surface"} ${chosen ? "ring-4 ring-ink ring-inset" : ""}
                ${canBid && v === null ? "active:scale-95" : ""}`}
            >
              {v !== null && (
                <span key={`${i}-${v}`} className={`pop font-display text-[min(20vw,6rem)] font-extrabold leading-none ${win ? "text-surface" : COLOR[v]}`}>
                  {MARK[v]}
                </span>
              )}
              {chosen && me !== null && (
                <span aria-hidden className={`font-display text-[min(20vw,6rem)] font-extrabold leading-none opacity-25 ${COLOR[me]}`}>
                  {MARK[me]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bidding */}
      {canBid && (
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 rise">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setBid(bid - 1)}
              aria-label="Bid one less"
              className="size-12 rounded-full border border-line text-2xl active:scale-95"
            >−</button>
            <div className="text-center">
              <div className="font-display text-5xl font-extrabold tabular-nums">{bid}</div>
              <div className="text-xs text-muted">of {max} coins</div>
            </div>
            <button
              onClick={() => setBid(bid + 1)}
              aria-label="Bid one more"
              className="size-12 rounded-full border border-line text-2xl active:scale-95"
            >+</button>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            value={bid}
            onChange={(e) => setBid(Number(e.target.value))}
            aria-label="Bid amount"
            className="w-full accent-[var(--ink)]"
          />
          <div className="grid grid-cols-5 gap-2">
            {[0, 5, 10, 25].map((b) => (
              <button
                key={b}
                onClick={() => setBid(b)}
                disabled={b > max}
                className={`h-10 rounded-xl border text-sm tabular-nums disabled:opacity-30 ${bid === b ? "border-ink" : "border-line"}`}
              >{b}</button>
            ))}
            <button
              onClick={() => setBid(max)}
              className={`h-10 rounded-xl border text-sm ${bid === max ? "border-ink" : "border-line"}`}
            >Max</button>
          </div>
          <button
            disabled={current.cell === null}
            onClick={() => current.cell !== null && onBid(bid, current.cell)}
            className="h-14 rounded-2xl bg-accent font-semibold text-accent-ink transition active:scale-[0.98] disabled:opacity-40"
          >
            {current.cell === null ? "Tap a square first" : `Lock in ${bid} on ${CELL_NAMES[current.cell]}`}
          </button>
        </div>
      )}

      {locked && !state.winner && opp !== null && (
        <p className="text-center text-sm text-muted">
          You locked in <b className="text-ink">{locked.bid}</b> on {CELL_NAMES[locked.cell]}.{" "}
          {state.pending[opp] ? "Revealing…" : `Waiting for ${names[opp]}…`}
        </p>
      )}

      {state.round <= 2 && !state.winner && (
        <p className="text-center text-xs text-muted">
          Pick a square and a secret bid. Higher bid places its mark and pays those coins to the other player.
          Ties go to whoever holds ⚖, which then switches sides.
        </p>
      )}
    </div>
  );
}
