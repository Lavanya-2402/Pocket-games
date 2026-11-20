"use client";

import { PITS, type MancalaState } from "@/games/mancala";
import type { BoardProps } from "./boards";
import { seatColor } from "./seat";

/** A few stones drawn as dots, so a pit looks as full as it is. */
function Stones({ n, color }: { n: number; color: string }) {
  return (
    <span aria-hidden className="flex max-w-[2.1rem] flex-wrap items-center justify-center gap-[2px]">
      {Array.from({ length: Math.min(n, 12) }, (_, i) => (
        <span key={i} className="size-[5px] rounded-full" style={{ background: color }} />
      ))}
    </span>
  );
}

/** Mancala: your six pits along the bottom, your store on the right. */
export function MancalaBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as MancalaState;
  const me = mySeat ?? layout[0];
  const opp = 1 - me;
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const last = s.last;

  const store = (seat: number) => (
    <div
      key={`s${seat}`}
      aria-label={`${who(seat)}: ${s.pits[seat * 7 + PITS]} stones in the store`}
      className="row-span-2 flex flex-col items-center justify-center gap-1 rounded-[1.4rem] border-2 bg-bg py-2"
      style={{ borderColor: seatColor(seat) }}
    >
      <span key={s.pits[seat * 7 + PITS]} className="pop font-display text-2xl font-black tabular-nums" style={{ color: seatColor(seat) }}>
        {s.pits[seat * 7 + PITS]}
      </span>
      <span className="max-w-full truncate px-0.5 text-[10px] text-muted">{who(seat)}</span>
    </div>
  );

  const pitAt = (seat: number, pit: number) => {
    const n = s.pits[seat * 7 + pit];
    const mine = seat === mySeat;
    const can = mine && myTurn && n > 0;
    const sown = last?.by === seat && last.pit === pit;
    return (
      <button
        key={`${seat}-${pit}`}
        type="button"
        disabled={!can}
        aria-label={`${mine ? "Your" : `${names[seat]}'s`} pit ${pit + 1}: ${n} stones`}
        onClick={() => onMove({ pit })}
        className={`flex aspect-[3/5] flex-col items-center justify-center gap-1 rounded-[1.1rem] bg-bg transition
          ${can ? "ring-2 ring-ink/60 active:scale-90" : ""} ${sown ? "ring-2 ring-ink" : ""} ${n === 0 ? "opacity-55" : ""}`}
      >
        <span key={n} className="pop font-display text-lg leading-none font-extrabold tabular-nums">{n}</span>
        <Stones n={n} color={seatColor(seat)} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1.15fr_repeat(6,1fr)_1.15fr] grid-rows-2 gap-1.5 rounded-[2rem] bg-surface p-2">
        {store(opp)}
        {/* The far side runs right to left */}
        {Array.from({ length: PITS }, (_, i) => pitAt(opp, PITS - 1 - i))}
        {store(me)}
        {Array.from({ length: PITS }, (_, i) => pitAt(me, i))}
      </div>

      <p key={`${last?.by}-${last?.pit}-${s.pits[6]}-${s.pits[13]}`} role="status" className="rise text-center text-sm text-muted">
        {!last ? "Tap one of your pits. Its stones are sown one by one, anticlockwise →"
          : last.captured ? `${who(last.by)} captured ${last.captured} stones!`
          : last.again ? `${who(last.by)} finished in ${last.by === mySeat ? "your" : "their"} store — ${last.by === mySeat ? "go" : "goes"} again.`
          : `${who(last.by)} sowed pit ${last.pit + 1}.`}
      </p>
      <p className="text-center text-xs text-muted">
        {mySeat !== null ? "Your pits are the bottom row; your store is on the right." : `${names[me]}'s pits are the bottom row.`}
      </p>
    </div>
  );
}
