"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RulesCard } from "@/components/how-to-play";
import { RULES } from "@/games/rules";
import { api, getName, setName } from "@/lib/client";

export default function Home() {
  const router = useRouter();
  const [name, setNameState] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
  useEffect(() => setNameState(getName()), []);

  const nameOk = name.trim().length > 0;

  async function create(game: string) {
    if (!nameOk) return setError("Enter your name first");
    setBusy(true);
    setError("");
    setName(name);
    try {
      const { code } = await api<{ code: string }>("/rooms", { game, name: name.trim() });
      router.push(`/r/${code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (!nameOk) return setError("Enter your name first");
    if (code.length !== 4) return setError("Codes are 4 letters");
    setName(name);
    router.push(`/r/${code}`);
  }

  return (
    <div className="flex flex-col gap-8 rise">
      <header className="pt-6">
        <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight">
          Pocket<br />Games
        </h1>
        <p className="mt-3 text-muted">Two phones, one game. Share a code and play.</p>
      </header>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted">Your name</span>
        <input
          value={name}
          onChange={(e) => setNameState(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          placeholder="e.g. Sam"
          className="h-14 rounded-2xl border border-line bg-surface px-4 text-lg outline-none focus:border-ink"
        />
      </label>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Start a game</h2>
        <button
          onClick={() => create("tictactoe")}
          disabled={busy}
          className="flex h-20 items-center justify-between rounded-2xl bg-accent px-5 text-accent-ink active:scale-[0.98] transition disabled:opacity-60"
        >
          <span className="font-display text-2xl font-semibold">Tic Tac Toe</span>
          <span aria-hidden className="font-display text-2xl">
            <span className="text-x">✕</span> <span className="text-o">◯</span>
          </span>
        </button>
        <button
          onClick={() => create("connect4")}
          disabled={busy}
          className="flex h-20 items-center justify-between rounded-2xl bg-accent px-5 text-accent-ink active:scale-[0.98] transition disabled:opacity-60"
        >
          <span className="font-display text-2xl font-semibold">Connect Four</span>
          <span aria-hidden className="flex gap-1">
            <span className="size-5 rounded-full bg-x" />
            <span className="size-5 rounded-full bg-o" />
            <span className="size-5 rounded-full bg-x" />
            <span className="size-5 rounded-full bg-o" />
          </span>
        </button>
        <button
          onClick={() => create("bidtactoe")}
          disabled={busy}
          className="flex h-20 items-center justify-between rounded-2xl bg-accent px-5 text-left text-accent-ink active:scale-[0.98] transition disabled:opacity-60"
        >
          <span>
            <span className="block font-display text-2xl font-semibold">Bid-Tac-Toe</span>
            <span className="block text-xs opacity-70">Secret bids decide who places</span>
          </span>
          <span aria-hidden className="font-display text-xl">
            <span className="text-x">✕</span> <span className="opacity-80">100</span>
          </span>
        </button>
        <button
          onClick={() => create("duel")}
          disabled={busy}
          className="flex h-20 items-center justify-between rounded-2xl bg-accent px-5 text-left text-accent-ink active:scale-[0.98] transition disabled:opacity-60"
        >
          <span>
            <span className="block font-display text-2xl font-semibold">Duel</span>
            <span className="block text-xs opacity-70">Attack, defend or charge — at the same time</span>
          </span>
          <span aria-hidden className="text-2xl">⚔️</span>
        </button>
        <button
          onClick={() => create("seabattle")}
          disabled={busy}
          className="flex h-20 items-center justify-between rounded-2xl bg-accent px-5 text-left text-accent-ink active:scale-[0.98] transition disabled:opacity-60"
        >
          <span>
            <span className="block font-display text-2xl font-semibold">Sea Battle</span>
            <span className="block text-xs opacity-70">Hide your fleet, hunt theirs</span>
          </span>
          <span aria-hidden className="text-2xl">⚓</span>
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">How to play</h2>
        {Object.keys(RULES).map((g) => (
          <details key={g} className="group rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              {RULES[g].title}
              <span aria-hidden className="text-muted transition group-open:rotate-45">+</span>
            </summary>
            <div className="px-4 pb-4">
              <RulesCard game={g} hideTitle />
            </div>
          </details>
        ))}
      </section>

      <form onSubmit={join} className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Have a code?</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            placeholder="ABCD"
            inputMode="text"
            autoCapitalize="characters"
            aria-label="Room code"
            className="h-14 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-center font-display text-2xl tracking-[0.4em] uppercase outline-none focus:border-ink"
          />
          <button className="h-14 rounded-2xl border border-ink px-6 font-semibold active:scale-[0.98] transition">
            Join
          </button>
        </div>
      </form>

      {error && <p role="alert" className="text-x">{error}</p>}
    </div>
  );
}
