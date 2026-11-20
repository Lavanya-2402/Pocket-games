"use client";

import { useState } from "react";
import { rankOf, RANKS, SUITS, type GoFishView } from "@/games/gofish";
import type { BoardProps } from "./boards";
import { seatColor } from "./seat";

const WORDS: Record<string, string> = { A: "Aces", J: "Jacks", Q: "Queens", K: "Kings" };
const plural = (rank: number) => WORDS[RANKS[rank]] ?? `${RANKS[rank]}s`;

/** Go Fish: pick a rank you hold and a player to ask. */
export function GoFishBoard({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as GoFishView;
  const [rankPick, setRank] = useState<number | null>(null);
  const [fromPick, setFrom] = useState<number | null>(null);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const bottom = mySeat ?? layout[0];
  const others = layout.filter((seat) => seat !== bottom);
  const groups = Array.from({ length: 13 }, (_, rank) => ({ rank, cards: s.hand.filter((c) => rankOf(c) === rank) })).filter((g) => g.cards.length);
  // Choices only count while they are still possible.
  const rank = myTurn && rankPick !== null && groups.some((g) => g.rank === rankPick) ? rankPick : null;
  const from = myTurn ? (others.length === 1 ? others[0] : fromPick) : null;
  const last = s.last;

  return (
    <div className="flex flex-col gap-2.5">
      {/* The other players: tap one to ask them */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, others.length)}, minmax(0, 1fr))` }}>
        {others.map((seat) => (
          <button
            key={seat}
            type="button"
            disabled={!myTurn || others.length === 1}
            aria-pressed={from === seat}
            onClick={() => setFrom(seat)}
            className={`min-w-0 rounded-2xl border-2 bg-surface px-2.5 py-1.5 text-left text-sm transition
              ${from === seat && myTurn ? "border-ink" : s.turn === seat && !s.winner ? "border-ink/40" : "border-transparent"}`}
          >
            <b className="block truncate" style={{ color: seatColor(seat) }}>{who(seat)}</b>
            <span className="text-xs text-muted">{s.counts[seat]} card{s.counts[seat] === 1 ? "" : "s"} · {s.sets[seat].length} set{s.sets[seat].length === 1 ? "" : "s"}</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-16 items-center justify-center gap-3 rounded-3xl bg-surface px-3 py-2.5 text-sm">
        <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-accent text-accent-ink">
          <b className="font-display text-base leading-none">{s.deck}</b>
          <span className="text-[9px] leading-tight">pond</span>
        </span>
        <p key={`${last?.by}-${last?.rank}-${last?.got}-${s.deck}`} role="status" className="rise min-w-0">
          {!last ? "Ask for a rank you hold. Collect all four to make a set."
            : <>
                <b>{who(last.by)}</b> asked {last.from === mySeat ? "you" : names[last.from]} for {plural(last.rank)}
                {last.got ? <> and <b className="text-o">got {last.got}</b>.</>
                  : last.lucky ? <> — go fish… and <b className="text-o">drew one!</b></>
                  : <> — <b className="text-x">go fish!</b></>}
                {last.made.length > 0 && <> <b>Set of {last.made.map(plural).join(" and ")} 🎉</b></>}
              </>}
        </p>
      </div>

      {mySeat !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Your hand · {s.hand.length}</span>
            <span className="text-xs text-muted">
              Your sets: {s.sets[mySeat].length ? s.sets[mySeat].map((r) => RANKS[r]).join(" ") : "none yet"}
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {groups.map((g) => (
              <button
                key={g.rank}
                type="button"
                disabled={!myTurn}
                aria-pressed={rank === g.rank}
                aria-label={`${g.cards.length} ${g.cards.length === 1 ? RANKS[g.rank] : plural(g.rank)}`}
                onClick={() => setRank(rank === g.rank ? null : g.rank)}
                className={`flex h-[4.4rem] w-12 flex-col items-center justify-between rounded-xl border-2 bg-white py-1 text-[#1b1c4b] transition
                  ${rank === g.rank ? "-translate-y-2 border-ink shadow-md" : "border-[#1b1c4b]/15"}`}
              >
                <span className="font-display text-xl leading-none font-extrabold">{RANKS[g.rank]}</span>
                <span className="text-[13px] leading-none tracking-tighter">
                  {g.cards.map((c) => {
                    const suit = Math.floor(c / 13);
                    return <span key={c} className={suit === 1 || suit === 2 ? "text-[#d5412b]" : ""}>{SUITS[suit]}</span>;
                  })}
                </span>
                <span className="text-[9px] leading-none text-[#5f6290]">{g.cards.length} of 4</span>
              </button>
            ))}
            {!groups.length && <p className="py-4 text-sm text-muted">{s.winner ? "No cards left." : "You're out of cards — waiting for the others."}</p>}
          </div>
          {myTurn && (
            <button
              type="button"
              disabled={rank === null || from === null}
              onClick={() => {
                onMove({ from, rank });
                setRank(null);
              }}
              className="chunk h-12 rounded-2xl bg-accent font-semibold text-accent-ink disabled:opacity-40"
            >
              {rank === null ? "Tap a card to ask for it"
                : from === null ? "Now tap who to ask"
                : `Ask ${names[from]} for ${plural(rank)}`}
            </button>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-muted">{names[bottom]} · {s.counts[bottom]} cards · {s.sets[bottom].length} sets</p>
      )}
    </div>
  );
}
