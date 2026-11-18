"use client";

import {
  COST, MAX_DEFENDS, MAX_ENERGY, MAX_HP, MAX_ROUNDS, whyNot,
  type Action, type DuelView,
} from "@/games/duel";

type Seat = 0 | 1;

const INFO: Record<Action, { icon: string; label: string; hint: string }> = {
  attack: { icon: "⚔️", label: "Attack", hint: `${COST.attack} energy · 1 dmg · blocked by Defend` },
  defend: { icon: "🛡️", label: "Defend", hint: `Free · blocks Attack · max ${MAX_DEFENDS} in a row` },
  charge: { icon: "⚡", label: "Charge", hint: `Free · +1 energy (max ${MAX_ENERGY})` },
  blast: { icon: "💥", label: "Blast", hint: `${COST.blast} energy · 2 dmg · can't be blocked` },
};
const ORDER: Action[] = ["attack", "defend", "charge", "blast"];
const COLOR = ["text-x", "text-o"] as const;
const BG = ["bg-x", "bg-o"] as const;

export function DuelBoard({
  state,
  mySeat,
  names,
  onAct,
}: {
  state: DuelView;
  mySeat: number | null;
  names: [string, string];
  onAct: (action: Action) => void;
}) {
  const me = mySeat === 0 || mySeat === 1 ? (mySeat as Seat) : null;
  const opp = me === null ? null : ((1 - me) as Seat);
  const mine = me === null ? null : state.pending[me];
  const locked = mine && mine !== "hidden" ? mine : null;
  const canAct = me !== null && !state.winner && !locked;
  const who = (s: Seat) => (s === me ? "You" : names[s]);
  // Show "you" on the bottom, like a fighting game.
  const order: Seat[] = me === 1 ? [0, 1] : [1, 0];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted">
        Round {Math.min(state.round, MAX_ROUNDS)} of {MAX_ROUNDS}
      </p>

      {order.map((s, idx) => (
        <div key={s} className="flex flex-col gap-3">
          <Fighter
            name={who(s)}
            seat={s}
            hp={state.hp[s]}
            energy={state.energy[s]}
            status={state.winner ? null : state.pending[s] ? "Ready ✓" : "Choosing…"}
            took={state.last?.damage[s] ?? 0}
            round={state.round}
          />
          {idx === 0 && state.last && (
            <Reveal last={state.last} who={who} round={state.round} />
          )}
        </div>
      ))}

      {canAct && (
        <div className="grid grid-cols-2 gap-3 rise">
          {ORDER.map((a) => {
            const blocked = whyNot(state, me!, a);
            return (
              <button
                key={a}
                disabled={!!blocked}
                onClick={() => onAct(a)}
                title={blocked ?? INFO[a].hint}
                className="flex min-h-24 flex-col items-start justify-between rounded-2xl bg-surface p-3 text-left ring-1 ring-line transition active:scale-[0.97] disabled:opacity-35"
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-xl font-extrabold">{INFO[a].label}</span>
                  <span aria-hidden className="text-2xl">{INFO[a].icon}</span>
                </span>
                <span className="text-xs leading-snug text-muted">{blocked ?? INFO[a].hint}</span>
              </button>
            );
          })}
        </div>
      )}

      {locked && !state.winner && opp !== null && (
        <p className="text-center text-sm text-muted">
          You picked <b className="text-ink">{INFO[locked].icon} {INFO[locked].label}</b>.{" "}
          {state.pending[opp] ? "Revealing…" : `Waiting for ${names[opp]}…`}
        </p>
      )}

      {state.round <= 2 && !state.winner && (
        <p className="text-center text-xs text-muted">
          Both pick at the same time, then reveal. Charge to power up, Defend to block attacks, save 3 energy for an unblockable Blast.
        </p>
      )}
    </div>
  );
}

function Fighter({
  name, seat, hp, energy, status, took, round,
}: {
  name: string; seat: Seat; hp: number; energy: number; status: string | null; took: number; round: number;
}) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <span className={`truncate font-display text-lg font-extrabold ${COLOR[seat]}`}>{name}</span>
        {status && <span className="text-xs text-muted">{status}</span>}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex gap-1" aria-label={`${hp} of ${MAX_HP} health`}>
          {Array.from({ length: MAX_HP }, (_, i) => (
            <span
              key={`${i}-${round}`}
              className={`h-3 w-6 rounded-full ${i < hp ? BG[seat] : "bg-line"} ${took > 0 && i >= hp && i < hp + took ? "pop" : ""}`}
            />
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1" aria-label={`${energy} energy`}>
          {Array.from({ length: MAX_ENERGY }, (_, i) => (
            <span key={i} className={`text-sm ${i < energy ? "" : "opacity-20 grayscale"}`}>⚡</span>
          ))}
        </span>
      </div>
    </div>
  );
}

function Reveal({
  last, who, round,
}: {
  last: NonNullable<DuelView["last"]>; who: (s: Seat) => string; round: number;
}) {
  const line = (s: Seat) => {
    const dealt = last.damage[s === 0 ? 1 : 0];
    return `${who(s)} ${INFO[last.actions[s]].label.toLowerCase()}${dealt ? ` (${dealt} dmg)` : ""}`;
  };
  return (
    <div key={round} className="rise flex items-center justify-center gap-4 py-1">
      <span className="text-4xl pop" aria-hidden>{INFO[last.actions[0]].icon}</span>
      <span className="text-center text-sm">
        <span className="block">{line(0)}</span>
        <span className="block text-muted">vs</span>
        <span className="block">{line(1)}</span>
      </span>
      <span className="text-4xl pop" aria-hidden>{INFO[last.actions[1]].icon}</span>
    </div>
  );
}
