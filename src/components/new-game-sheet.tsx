"use client";

import { useState } from "react";
import { getEngine } from "@/games";
import type { RoomOptions } from "@/games/runner";
import { primaryBtn, Sheet } from "./ui";

const KEY = "pg.newgame";

function remembered(game: string): RoomOptions {
  const base: RoomOptions = { bestOf: 1, private: false, bot: null, rules: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { ...base, bestOf: saved.bestOf ?? 1, rules: saved.rules?.[game] ?? {} };
  } catch {
    return base;
  }
}

function remember(game: string, o: RoomOptions) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    localStorage.setItem(KEY, JSON.stringify({ bestOf: o.bestOf, rules: { ...saved.rules, [game]: o.rules } }));
  } catch {
    /* private mode */
  }
}

/** Options for a new room: opponent, match length, privacy and house rules. */
export function NewGameSheet({
  game, onClose, onCreate, busy, loggedIn,
}: {
  game: string | null;
  onClose: () => void;
  onCreate: (game: string, options: RoomOptions) => void;
  busy: boolean;
  loggedIn: boolean;
}) {
  return (
    <Sheet open={game !== null} onClose={onClose} title={game ? getEngine(game)?.name ?? "New game" : "New game"}>
      {game && <Form key={game} game={game} onCreate={onCreate} busy={busy} loggedIn={loggedIn} />}
    </Sheet>
  );
}

function Form({
  game, onCreate, busy, loggedIn,
}: {
  game: string;
  onCreate: (game: string, options: RoomOptions) => void;
  busy: boolean;
  loggedIn: boolean;
}) {
  const engine = getEngine(game);
  const [o, setO] = useState<RoomOptions>(() => remembered(game));
  const canBot = !!engine?.botMove;
  const rules = engine?.rules ?? [];

  const seg = (on: boolean) =>
    `h-11 rounded-xl text-sm font-semibold transition ${on ? "bg-surface shadow-sm" : "text-muted"}`;
  const label = "mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        remember(game, o);
        onCreate(game, o);
      }}
    >
      {canBot && (
        <div>
          <p className={label}>Play against</p>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-bg p-1">
            <button type="button" aria-pressed={!o.bot} className={seg(!o.bot)} onClick={() => setO({ ...o, bot: null })}>
              👥 A friend
            </button>
            <button
              type="button"
              aria-pressed={!!o.bot}
              className={seg(!!o.bot)}
              onClick={() => setO({ ...o, bot: o.bot ?? "easy", private: false })}
            >
              🤖 Computer
            </button>
          </div>
          {o.bot && (
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-bg p-1">
              {(["easy", "hard"] as const).map((lvl) => (
                <button key={lvl} type="button" aria-pressed={o.bot === lvl} className={seg(o.bot === lvl)} onClick={() => setO({ ...o, bot: lvl })}>
                  {lvl === "easy" ? "Easy" : "Hard"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className={label}>Match</p>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-bg p-1">
          {([1, 3, 5] as const).map((n) => (
            <button key={n} type="button" aria-pressed={o.bestOf === n} className={seg(o.bestOf === n)} onClick={() => setO({ ...o, bestOf: n })}>
              {n === 1 ? "Free play" : `Best of ${n}`}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {o.bestOf === 1
            ? "Play as many games as you like; the room keeps score."
            : `First to win ${Math.ceil(o.bestOf / 2)} games takes the match.`}
        </p>
      </div>

      {rules.length > 0 && (
        <div>
          <p className={label}>House rules</p>
          <div className="flex flex-col gap-1.5">
            {rules.map((r) => (
              <Toggle
                key={r.id}
                on={!!o.rules[r.id]}
                onChange={(on) => setO({ ...o, rules: { ...o.rules, [r.id]: on } })}
                title={r.label}
                hint={r.hint}
              />
            ))}
          </div>
        </div>
      )}

      {!o.bot && (
        <Toggle
          on={o.private}
          disabled={!loggedIn}
          onChange={(on) => setO({ ...o, private: on })}
          title="🔒 Private room"
          hint={loggedIn ? "Only your friends can join, and nobody can watch." : "Log in to make friends-only rooms."}
        />
      )}

      <button disabled={busy} className={primaryBtn}>
        {busy ? "Opening…" : o.bot ? "Start game" : "Create room"}
      </button>
    </form>
  );
}

function Toggle({
  on, onChange, title, hint, disabled = false,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-o" : "bg-line"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
