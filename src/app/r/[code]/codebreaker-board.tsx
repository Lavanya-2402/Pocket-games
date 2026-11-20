"use client";

import { useState } from "react";
import { LEN, MAX_GUESSES, type CodeBreakerView, type Guess } from "@/games/codebreaker";
import type { BoardProps } from "./boards";

type Seat = 0 | 1;

/** Code Breaker: set a secret code, then take turns guessing each other's. */
export function CodeBreakerBoard({ state, mySeat, names, layout, onMove }: BoardProps) {
  const s = state as CodeBreakerView;
  const me = mySeat;
  const opp = me === null ? null : ((1 - me) as Seat);
  const myTurn = me !== null && s.phase === "guess" && s.turn === me && !s.winner;
  const setting = me !== null && s.phase === "set" && !s.ready[me];

  if (s.phase === "set") {
    return (
      <div className="flex flex-col gap-4">
        {setting ? (
          <>
            <p className="text-center text-sm text-muted">Choose a secret code: {LEN} different digits. Your opponent will try to crack it.</p>
            <Keypad label="Lock code" onSubmit={(code) => onMove({ type: "set", code })} />
          </>
        ) : (
          <p className="rounded-2xl bg-surface p-5 text-center text-muted">
            {me === null ? "Both players are choosing their codes…" : `Code locked: `}
            {me !== null && <b className="font-display tracking-[0.3em] text-ink">{s.secrets[me]}</b>}
            {me !== null && <span className="mt-1 block">Waiting for {names[opp!]}…</span>}
          </p>
        )}
      </div>
    );
  }

  // Columns in room-seat order so they don't swap sides between games.
  const cols = (me === null ? layout : [me, opp!]) as [Seat, Seat];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {cols.map((seat) => {
          const target = (1 - seat) as Seat;
          return (
            <div key={seat} className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-surface p-2.5">
              <div className="text-xs font-semibold">
                {seat === me ? "Your guesses" : `${names[seat]}'s guesses`}
                <span className="font-normal text-muted"> · {s.guesses[seat].length}/{MAX_GUESSES}</span>
              </div>
              <div className="text-[11px] text-muted">
                {seat === me ? `at ${names[target]}'s code` : target === me ? "at your code " : `at ${names[target]}'s code `}
                {s.secrets[target] && <b className="font-display tracking-[0.2em] text-ink">{s.secrets[target]}</b>}
              </div>
              <ol className="flex flex-col gap-1">
                {s.guesses[seat].map((g, i) => <Row key={i} g={g} latest={i === s.guesses[seat].length - 1} />)}
                {s.guesses[seat].length === 0 && <li className="py-2 text-center text-xs text-muted">No guesses yet</li>}
              </ol>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted">
        <span className="font-bold text-o">●</span> right digit, right place · <span className="font-bold text-x">○</span> right digit, wrong place
      </p>

      {myTurn && <Keypad key={s.guesses[me!].length} label="Guess" onSubmit={(code) => onMove({ type: "guess", code })} />}
    </div>
  );
}

function Row({ g, latest }: { g: Guess; latest: boolean }) {
  return (
    <li className={`flex items-center justify-between rounded-lg px-2 py-1 ${latest ? "bg-bg rise" : ""}`}>
      <span className="font-display text-base font-extrabold tracking-[0.2em]">{g.code}</span>
      <span className="flex gap-0.5 text-sm" aria-label={`${g.exact} in the right place, ${g.near} in the wrong place`}>
        {Array.from({ length: g.exact }, (_, i) => <span key={`e${i}`} className="text-o">●</span>)}
        {Array.from({ length: g.near }, (_, i) => <span key={`n${i}`} className="text-x">○</span>)}
        {g.exact + g.near === 0 && <span className="text-muted">–</span>}
      </span>
    </li>
  );
}

/** Four slots and a 0-9 pad. Each digit can be used once. */
function Keypad({ label, onSubmit }: { label: string; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-surface p-3">
      <div className="flex justify-center gap-2" aria-label={`Code so far: ${code || "empty"}`}>
        {Array.from({ length: LEN }, (_, i) => (
          <span
            key={i}
            className={`flex h-12 w-11 items-center justify-center rounded-xl border-2 font-display text-2xl font-extrabold
              ${code[i] ? "border-ink" : "border-line"}`}
          >
            {code[i] ?? ""}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {"1234567890".split("").map((d) => (
          <button
            key={d}
            type="button"
            disabled={code.includes(d) || code.length >= LEN}
            onClick={() => setCode(code + d)}
            className="h-11 rounded-xl border border-line font-display text-lg font-extrabold active:scale-95 disabled:opacity-25"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          aria-label="Delete last digit"
          disabled={!code}
          onClick={() => setCode(code.slice(0, -1))}
          className="col-span-2 h-11 rounded-xl border border-line text-lg active:scale-95 disabled:opacity-25"
        >
          ⌫
        </button>
      </div>
      <button
        type="button"
        disabled={code.length !== LEN}
        onClick={() => onSubmit(code)}
        className="h-12 rounded-2xl bg-accent font-semibold text-accent-ink transition active:scale-[0.98] disabled:opacity-40"
      >
        {code.length === LEN ? `${label} ${code}` : `Enter ${LEN} different digits`}
      </button>
    </div>
  );
}
