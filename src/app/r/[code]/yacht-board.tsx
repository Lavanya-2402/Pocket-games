"use client";

import { useState } from "react";
import { CATS, ROLLS, scoreFor, total, type YachtView } from "@/games/yacht";
import type { BoardProps } from "./boards";
import { Die, ScoreStrip } from "./dice";

/** Yacht Dice: five dice, three rolls, twelve boxes to fill. */
export function YachtBoard(p: BoardProps) {
  const s = p.state as YachtView;
  // Fresh choices for every roll and every turn.
  return <Inner key={`${s.turn}-${s.rolls}-${s.last?.cat ?? "x"}`} {...p} />;
}

function Inner({ state, mySeat, names, layout, myTurn, onMove }: BoardProps) {
  const s = state as YachtView;
  const [hold, setHold] = useState<boolean[]>(s.held);
  const [cat, setCat] = useState<number | null>(null);
  const [peek, setPeek] = useState<number | null>(null); // whose card to look at
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  const shown = peek ?? (s.winner ? mySeat ?? layout[0] : s.turn);
  const card = s.cards[shown];
  const rolled = s.rolls > 0;
  const canPick = myTurn && rolled && shown === mySeat;
  const rollsLeft = ROLLS - s.rolls;

  return (
    <div className="flex flex-col gap-2.5">
      <ScoreStrip layout={layout} scores={s.cards.map(total)} who={who} turn={s.winner ? null : s.turn} />

      {/* Dice: tap to keep some before rolling again */}
      <div className="flex items-end justify-center gap-2 rounded-3xl bg-surface px-2 pt-3 pb-2">
        {s.dice.map((d, i) => {
          const canHold = myTurn && rolled && rollsLeft > 0;
          return (
            <button
              key={i}
              type="button"
              disabled={!canHold}
              aria-pressed={hold[i]}
              aria-label={d ? `Die ${i + 1} shows ${d}${hold[i] ? ", kept" : ""}` : `Die ${i + 1}, not rolled`}
              onClick={() => setHold(hold.map((h, j) => (j === i ? !h : h)))}
              className={`flex flex-col items-center gap-0.5 transition ${hold[i] && rolled ? "-translate-y-1.5" : ""}`}
            >
              <span key={`${s.rolls}-${d}`} className={hold[i] ? "" : "pop"}><Die face={d || null} size={50} lit={hold[i] && rolled} /></span>
              <span className={`h-3.5 text-[10px] font-bold ${hold[i] && rolled ? "text-x" : "text-transparent"}`}>kept</span>
            </button>
          );
        })}
      </div>

      {myTurn && (
        <div className={`grid gap-2 ${cat !== null && rollsLeft > 0 ? "grid-cols-2" : ""}`}>
          {rollsLeft > 0 && (
            <button
              type="button"
              disabled={rolled && hold.every(Boolean)}
              onClick={() => onMove({ type: "roll", hold })}
              className={`h-12 rounded-2xl font-semibold disabled:opacity-40 ${cat === null ? "chunk bg-accent text-accent-ink" : "border-2 border-ink"}`}
            >
              {rolled ? `Roll again · ${rollsLeft} left` : "Roll the dice"}
            </button>
          )}
          {cat !== null && (
            <button type="button" onClick={() => onMove({ type: "score", cat })} className="chunk h-12 rounded-2xl bg-accent font-semibold text-accent-ink">
              Score {scoreFor(s.dice, cat)} · {CATS[cat].label}
            </button>
          )}
        </div>
      )}

      {/* One player's card: twelve boxes, each used once */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
          <span className="font-display font-bold">{shown === mySeat ? "Your card" : `${names[shown]}'s card`}</span>
          {layout.length > 1 && (
            <span className="flex gap-1">
              {layout.map((seat) => (
                <button
                  key={seat}
                  type="button"
                  aria-pressed={shown === seat}
                  onClick={() => setPeek(seat)}
                  className={`max-w-20 truncate rounded-full px-2.5 py-1 text-xs font-semibold ${shown === seat ? "bg-accent text-accent-ink" : "border border-line"}`}
                >
                  {who(seat)}
                </button>
              ))}
            </span>
          )}
        </div>
        <div className="grid grid-flow-col grid-cols-2 grid-rows-6 gap-1.5">
          {CATS.map((c, i) => {
            const taken = card[i] !== null;
            const offer = canPick && !taken;
            return (
              <button
                key={c.id}
                type="button"
                disabled={!offer}
                aria-pressed={cat === i}
                title={c.hint}
                onClick={() => setCat(cat === i ? null : i)}
                className={`flex h-10 items-center justify-between rounded-xl border px-2.5 text-sm transition
                  ${cat === i ? "border-ink bg-ink text-bg" : taken ? "border-transparent bg-surface" : offer ? "border-ink/40 border-dashed" : "border-line"}`}
              >
                <span className={taken || cat === i ? "font-semibold" : ""}>{c.label}</span>
                <span className={`font-display font-extrabold tabular-nums ${taken || cat === i ? "" : "text-muted"}`}>
                  {taken ? card[i] : offer ? scoreFor(s.dice, i) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p key={`${s.last?.by}-${s.last?.cat}`} className="rise text-center text-sm text-muted">
        {myTurn && rolled && cat === null
          ? rollsLeft > 0 ? "Tap dice to keep them, or tap a box to score." : "Out of rolls — tap a box to score."
          : s.last ? `${who(s.last.by)} scored ${s.last.pts} in ${CATS[s.last.cat].label}.` : "Three rolls a turn. Fill every box."}
      </p>
    </div>
  );
}
