"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, getName, realtime, setName, type RoomView } from "@/lib/client";
import { HowToPlayButton } from "@/components/how-to-play";
import { getEngine } from "@/games";
import type { BidTacToeView } from "@/games/bidtactoe";
import type { Connect4State } from "@/games/connect4";
import type { DuelView } from "@/games/duel";
import type { TicTacToeState } from "@/games/tictactoe";
import { BidTacToeBoard } from "./bidtactoe-board";
import { Connect4Board } from "./connect4-board";
import { DuelBoard } from "./duel-board";
import { TicTacToeBoard } from "./tictactoe-board";
import { TurnClock } from "./turn-clock";

const SIMULTANEOUS = new Set(["bidtactoe", "duel"]);

export function Room({ code }: { code: string }) {
  const [name, setNameState] = useState<string | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState("");
  const versionRef = useRef(-1);
  const youRef = useRef<RoomView["you"]>(null);
  const pendingRef = useRef(false); // a move is in flight; don't let stale data undo it
  const [offset, setOffset] = useState(0); // server clock − phone clock

  const accept = useCallback((v: RoomView) => {
    const fresher = pendingRef.current ? v.version > versionRef.current : v.version >= versionRef.current;
    if (fresher) {
      versionRef.current = v.version;
      setOffset(v.clock.serverNow - Date.now());
      if (v.you) youRef.current = v.you;
      setView(v.you ? v : { ...v, you: youRef.current });
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      accept(await api(`/rooms/${code}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setFatal("Room not found");
    }
  }, [accept, code]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
  useEffect(() => setNameState(getName()), []);

  // Join (takes a seat if one is free, otherwise spectates).
  useEffect(() => {
    if (!name) return;
    api(`/rooms/${code}/join`, { name })
      .then(accept)
      .catch((e: ApiError) => setFatal(e.status === 404 ? "Room not found" : e.message));
  }, [name, code, accept]);

  // Live updates: the realtime message carries the new board (no refetch needed);
  // hidden-info games send only a version, so we fetch our own view. Polling is a safety net.
  useEffect(() => {
    if (!view) return;
    const ch = realtime()
      .channel(`room:${code}`)
      .on("broadcast", { event: "update" }, ({ payload }) => {
        if (payload?.view) accept(payload.view as RoomView);
        else if ((payload?.version ?? Infinity) > versionRef.current) refresh();
      })
      .subscribe();
    const poll = setInterval(() => document.visibilityState === "visible" && refresh(), 5000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      realtime().removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [!!view, code, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Turn clock: when the deadline passes, ask the server to enforce it. The server
  // checks the time itself, so an early or duplicate call is harmless.
  const tick = useCallback(() => {
    api(`/rooms/${code}/tick`, {}).then(accept).catch(() => {});
  }, [accept, code]);
  const deadline = view?.clock.deadline ?? null;
  useEffect(() => {
    if (deadline === null) return;
    const wait = deadline - (Date.now() + offset) + 400;
    const t = setTimeout(tick, Math.max(0, wait));
    // If the first try was too early (clock drift) or lost, keep nudging.
    const retry = setInterval(() => Date.now() + offset > deadline + 2500 && tick(), 3000);
    return () => {
      clearTimeout(t);
      clearInterval(retry);
    };
  }, [deadline, offset, tick]);

  async function move(m: unknown) {
    if (!view?.state || !view.you || pendingRef.current) return;
    setError("");
    // Optimistic: run the same pure engine locally so the mark appears instantly.
    // The server still decides; its answer replaces this.
    const engine = getEngine(view.game);
    if (engine && !engine.hiddenInfo && engine.validate(view.state, m, view.you.id) === null) {
      const state = engine.apply(view.state, m, view.you.id);
      setView({ ...view, state, turn: engine.turn(state), winner: engine.winner(state) });
    }
    pendingRef.current = true;
    try {
      const next = await api(`/rooms/${code}/move`, { move: m, version: view.version });
      pendingRef.current = false;
      accept(next);
    } catch (e) {
      pendingRef.current = false;
      setError((e as Error).message);
      setView(view); // undo the optimistic mark
      refresh();
    }
  }

  async function rematch() {
    try {
      accept(await api(`/rooms/${code}/rematch`, {}));
    } catch (e) {
      setError((e as Error).message);
      refresh();
    }
  }

  async function share() {
    const url = `${location.origin}/r/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Play with me", text: `Room ${code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setError("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  }

  if (fatal) {
    return (
      <div className="flex flex-col gap-4 pt-10 rise">
        <h1 className="font-display text-3xl font-extrabold">{fatal}</h1>
        <Link href="/" className="underline">Back home</Link>
      </div>
    );
  }

  if (name === null) return <p className="pt-10 text-muted">Loading…</p>;

  if (!name) {
    return (
      <form
        className="flex flex-col gap-4 pt-10 rise"
        onSubmit={(e) => {
          e.preventDefault();
          const n = String(new FormData(e.currentTarget).get("name") ?? "").trim();
          if (n) {
            setName(n);
            setNameState(n);
          }
        }}
      >
        <h1 className="font-display text-3xl font-extrabold">Joining room {code}</h1>
        <input
          name="name"
          autoFocus
          maxLength={20}
          placeholder="Your name"
          className="h-14 rounded-2xl border border-line bg-surface px-4 text-lg outline-none focus:border-ink"
        />
        <button className="h-14 rounded-2xl bg-accent font-semibold text-accent-ink">Join</button>
      </form>
    );
  }

  if (!view) return <p className="pt-10 text-muted">Joining…</p>;

  const seat = (s: number) => view.players.find((p) => p.seat === s);
  const myId = view.you?.id;
  const isPlayer = view.you?.seat !== null && view.you?.seat !== undefined;
  const opponent = view.players.find((p) => p.id !== myId);

  let status: string;
  if (!view.state) status = "Waiting for a friend to join…";
  else if (view.winner === "draw") status = "It's a draw";
  else if (view.winner) status = view.winner === myId ? "You win! 🎉" : `${nameOf(view, view.winner)} wins`;
  else if (SIMULTANEOUS.has(view.game)) {
    const s = view.state as { pending: unknown[]; round: number };
    const mine = isPlayer ? s.pending[view.you!.seat!] : null;
    const verb = view.game === "duel" ? "pick your move" : "place your bid";
    status = !isPlayer ? `Round ${s.round}: choosing…` : mine ? "Locked in" : `Round ${s.round}: ${verb}`;
  } else if (view.turn === myId) status = "Your turn";
  else status = isPlayer ? `${opponent?.name ?? "Opponent"}'s turn` : `${nameOf(view, view.turn)}'s turn`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted">← Home</Link>
        <button
          onClick={share}
          className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm"
        >
          Room <span className="font-display font-extrabold tracking-[0.2em]">{code}</span> · Share
        </button>
      </header>

      {/* Simultaneous games show their own player cards (coins / HP). */}
      {!(SIMULTANEOUS.has(view.game) && view.state) && <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((s) => {
          const p = seat(s);
          const active = p && view.turn === p.id;
          return (
            <div
              key={s}
              className={`rounded-2xl border px-4 py-3 transition ${active ? "border-ink bg-surface" : "border-line"}`}
            >
              <div className={`font-display text-xl font-extrabold ${s === 0 ? "text-x" : "text-o"}`}>
                {view.state ? markFor(view, p?.id) : s === 0 ? "P1" : "P2"}
              </div>
              <div className="truncate text-sm">
                {p ? p.name : <span className="text-muted">waiting…</span>}
                {p?.id === myId && <span className="text-muted"> (you)</span>}
              </div>
            </div>
          );
        })}
      </div>}

      <p aria-live="polite" className="font-display text-3xl font-extrabold text-center">{status}</p>
      {view.clock.forfeit && (
        <p className="-mt-4 text-center text-sm text-muted">
          {view.clock.forfeit === myId ? "You" : nameOf(view, view.clock.forfeit)} ran out of time too many times.
        </p>
      )}

      {view.clock.deadline !== null && !view.winner && (
        <TurnClock
          key={view.clock.deadline}
          deadline={view.clock.deadline}
          total={view.clock.limit}
          offset={offset}
          urgent={!!myId && view.clock.waitingOn.includes(myId)}
          label={clockLabel(view, myId)}
        />
      )}

      {!view.state && (
        <div className="rounded-2xl border border-dashed border-line p-5 text-center text-muted">
          On the other phone, open this link or enter code{" "}
          <span className="font-display font-extrabold tracking-[0.2em] text-ink">{code}</span>.
        </div>
      )}

      {view.state != null && view.game === "tictactoe" && (
        <TicTacToeBoard
          state={view.state as TicTacToeState}
          canMove={isPlayer && view.turn === myId}
          onMove={(cell) => move({ cell })}
        />
      )}
      {view.state != null && view.game === "bidtactoe" && (
        <BidTacToeBoard
          state={view.state as BidTacToeView}
          mySeat={view.you?.seat ?? null}
          names={[seat(0)?.name ?? "P1", seat(1)?.name ?? "P2"]}
          onBid={(bid, cell) => move({ bid, cell })}
        />
      )}
      {view.state != null && view.game === "duel" && (
        <DuelBoard
          state={view.state as DuelView}
          mySeat={view.you?.seat ?? null}
          names={[seat(0)?.name ?? "P1", seat(1)?.name ?? "P2"]}
          onAct={(action) => move({ action })}
        />
      )}
      {view.state != null && view.game === "connect4" && (
        <Connect4Board
          state={view.state as Connect4State}
          canMove={isPlayer && view.turn === myId}
          onMove={(col) => move({ col })}
        />
      )}

      {view.winner && isPlayer && (
        <button onClick={rematch} className="h-14 rounded-2xl bg-accent font-semibold text-accent-ink rise">
          Rematch
        </button>
      )}

      <HowToPlayButton game={view.game} className="self-center" />

      {!isPlayer && <p className="text-center text-sm text-muted">You&apos;re spectating.</p>}
      {view.spectators > 0 && isPlayer && (
        <p className="text-center text-sm text-muted">{view.spectators} watching</p>
      )}
      {error && <p role="alert" className="text-center text-sm text-x">{error}</p>}
    </div>
  );
}

function nameOf(v: RoomView, id: string | null) {
  return v.players.find((p) => p.id === id)?.name ?? "Someone";
}

function clockLabel(v: RoomView, myId?: string) {
  const waiting = v.clock.waitingOn;
  if (myId && waiting.includes(myId)) {
    const misses = v.clock.misses[myId] ?? 0;
    return misses > 0 ? `Your time · missed ${misses} turn${misses > 1 ? "s" : ""}` : "Your time";
  }
  if (waiting.length === 1) return `${nameOf(v, waiting[0])}'s time`;
  return "Round time";
}

function markFor(v: RoomView, id?: string) {
  const players = (v.state as { players?: string[] } | null)?.players;
  const i = id ? players?.indexOf(id) : -1;
  if (i !== 0 && i !== 1) return "–";
  if (v.game === "connect4") return "●";
  return i === 0 ? "✕" : "◯";
}
