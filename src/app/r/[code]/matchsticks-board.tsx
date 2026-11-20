"use client";

import { useState } from "react";
import type { MatchsticksState } from "@/games/matchsticks";
import type { BoardProps } from "./boards";

/** Matchsticks: take any number from one row; don't be left with the last one. */
export function MatchsticksBoard({ state, mySeat, names, myTurn, onMove }: BoardProps) {
  const s = state as MatchsticksState;
  const [pickRow, setPickRow] = useState<number | null>(null);
  const [pickTake, setPickTake] = useState(0);
  const who = (seat: number) => (seat === mySeat ? "You" : names[seat]);
  // A selection only counts while it is still possible.
  const row = myTurn && pickRow !== null && pickTake <= s.rows[pickRow] ? pickRow : null;
  const take = row === null ? 0 : pickTake;
  const left = s.rows.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-3xl bg-surface p-3">
        {s.rows.map((n, r) => (
          <div key={r} className="flex h-16 items-center justify-center gap-2.5" role="group" aria-label={`Row ${r + 1}: ${n} sticks`}>
            {n === 0 && <span className="text-xs text-muted">empty</span>}
            {Array.from({ length: n }, (_, i) => {
              // Tapping a stick takes it and every stick to its right.
              const chosen = row === r && i >= n - take;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!myTurn}
                  aria-label={`Take ${n - i} from row ${r + 1}`}
                  aria-pressed={chosen}
                  onClick={() => {
                    const same = row === r && take === n - i;
                    setPickRow(same ? null : r);
                    setPickTake(same ? 0 : n - i);
                  }}
                  className={`flex h-14 w-5 flex-col items-center transition ${chosen ? "-translate-y-2 opacity-45" : ""}`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full bg-x" />
                  <span className="-mt-0.5 w-1.5 flex-1 rounded-b-sm bg-[var(--gold)]" />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {myTurn && (
        <button
          type="button"
          disabled={take === 0}
          onClick={() => {
            onMove({ row, take });
            setPickRow(null);
          }}
          className="chunk h-13 rounded-2xl bg-accent py-3 font-semibold text-accent-ink disabled:opacity-40"
        >
          {take === 0 ? "Tap a stick to choose" : `Take ${take} from row ${row! + 1}`}
        </button>
      )}

      <p key={`${s.last?.by}-${left}`} role="status" className="rise text-center text-sm text-muted">
        {s.last ? `${who(s.last.by)} took ${s.last.take} from row ${s.last.row + 1}. ` : ""}
        {s.winner ? "The last stick was taken." : `${left} left. Whoever takes the last stick loses.`}
      </p>
    </div>
  );
}
