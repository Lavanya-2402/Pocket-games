"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, getName, me, realtime, setName, type RoomView } from "@/lib/client";
import { missLimit } from "@/games/runner";
import { isMuted, play, setMuted } from "@/lib/sound";
import { HowToPlayButton } from "@/components/how-to-play";
import { getEngine } from "@/games";
import type { BidTacToeView } from "@/games/bidtactoe";
import type { Connect4State } from "@/games/connect4";
import type { DuelView } from "@/games/duel";
import type { TicTacToeState } from "@/games/tictactoe";
import { BidTacToeBoard } from "./bidtactoe-board";
import { Connect4Board } from "./connect4-board";
import { DuelBoard } from "./duel-board";
import type { SeaBattleView } from "@/games/seabattle";
import { SeaBattleBoard } from "./seabattle-board";
import { TicTacToeBoard } from "./tictactoe-board";
import { AwayBanner, TurnClock } from "./turn-clock";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ChatDock, MAX_CHAT, REACTIONS, ReactionLayer, type ChatMessage, type FloatingReaction,
} from "./chat";

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
  const [online, setOnline] = useState<Set<string>>(new Set()); // player ids with the room open
  const [linkUp, setLinkUp] = useState(true); // our own realtime connection
  const [presenceReady, setPresenceReady] = useState(false); // got the first presence list
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Chat + reactions: sent straight between phones over the room channel (not stored).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const chatOpenRef = useRef(false);
  const lastSentRef = useRef({ chat: 0, react: 0 });
  const viewRef = useRef<RoomView | null>(null);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const displayName = useCallback((id: string, fallback: string) => {
    // Use the server's name for seated players so names can't be faked.
    return viewRef.current?.players.find((p) => p.id === id)?.name ?? fallback;
  }, []);

  const receiveChat = useCallback((m: ChatMessage) => {
    if (!m?.text || typeof m.text !== "string") return;
    const clean = { ...m, text: m.text.slice(0, MAX_CHAT), name: displayName(m.from, String(m.name).slice(0, 20)) };
    setMessages((list) => [...list.slice(-49), clean]);
    if (!chatOpenRef.current) setUnread((n) => n + 1);
    play("chat");
  }, [displayName]);

  const showReaction = useCallback((emoji: unknown, from: unknown) => {
    if (typeof emoji !== "string" || !(REACTIONS as readonly string[]).includes(emoji)) return;
    const key = `${Date.now()}-${Math.random()}`;
    const r = { key, emoji, name: displayName(String(from), "Spectator"), x: Math.random() };
    setFloating((f) => [...f.slice(-7), r]);
    if (from !== me().id) play("react");
    setTimeout(() => setFloating((f) => f.filter((x) => x.key !== key)), 2300);
  }, [displayName]);

  function sendChat(text: string) {
    const now = Date.now();
    if (now - lastSentRef.current.chat < 800) return; // light spam guard
    lastSentRef.current.chat = now;
    const m: ChatMessage = { id: `${now}-${Math.random()}`, from: me().id, name: getName(), text, at: now };
    setMessages((list) => [...list.slice(-49), { ...m, name: "You" }]);
    channelRef.current?.send({ type: "broadcast", event: "chat", payload: m });
  }

  function sendReaction(emoji: string) {
    const now = Date.now();
    if (now - lastSentRef.current.react < 600) return;
    lastSentRef.current.react = now;
    showReaction(emoji, me().id);
    channelRef.current?.send({ type: "broadcast", event: "react", payload: { emoji, from: me().id } });
  }

  const accept = useCallback((v: RoomView) => {
    const fresher = pendingRef.current ? v.version > versionRef.current : v.version >= versionRef.current;
    if (fresher) {
      // Someone else's move (ours plays its own sound on tap). Skip the very first load.
      if (versionRef.current >= 0 && v.version > versionRef.current && !pendingRef.current && v.state) play("opponent");
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
  // Presence (who has the room open) also rides on this channel.
  useEffect(() => {
    if (!view) return;
    const myId = me().id;
    const ch = realtime()
      .channel(`room:${code}`, { config: { presence: { key: myId } } })
      .on("broadcast", { event: "update" }, ({ payload }) => {
        if (payload?.view) accept(payload.view as RoomView);
        else if ((payload?.version ?? Infinity) > versionRef.current) refresh();
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => receiveChat(payload as ChatMessage))
      .on("broadcast", { event: "react" }, ({ payload }) => showReaction(payload?.emoji, payload?.from))
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(ch.presenceState())));
        setPresenceReady(true);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLinkUp(true);
          ch.track({ at: Date.now() });
          refresh(); // catch up on anything missed while disconnected
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLinkUp(false);
        }
      });
    channelRef.current = ch;
    const poll = setInterval(() => document.visibilityState === "visible" && refresh(), 5000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    const onNet = () => setLinkUp(navigator.onLine);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      channelRef.current = null;
      realtime().removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
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

  // Game-over fanfare (not when opening a room that already finished).
  const winner = view?.winner ?? null;
  const prevWinner = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevWinner.current === null && winner !== null) {
      const myId = me().id;
      const seated = viewRef.current?.players.some((p) => p.id === myId);
      play(winner === "draw" ? "draw" : !seated || winner === myId ? "win" : "lose");
    }
    if (viewRef.current?.state || winner !== null) prevWinner.current = winner;
  }, [winner, view?.state]);

  const [mutedState, setMutedState] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
  useEffect(() => setMutedState(isMuted()), []);

  async function move(m: unknown) {
    if (!view?.state || !view.you || pendingRef.current) return;
    setError("");
    play("tap");
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
      play("error");
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
  const away = presenceReady && view.state && !view.winner
    ? view.players.filter((p) => p.id !== myId && !online.has(p.id))
    : [];
  const isOnline = (id?: string) => !!id && (id === myId || !presenceReady || online.has(id));

  let status: string;
  if (!view.state) status = "Waiting for a friend to join…";
  else if (view.winner === "draw") status = "It's a draw";
  else if (view.winner) status = view.winner === myId ? "You win! 🎉" : `${nameOf(view, view.winner)} wins`;
  else if (SIMULTANEOUS.has(view.game)) {
    const s = view.state as { pending: unknown[]; round: number };
    const mine = isPlayer ? s.pending[view.you!.seat!] : null;
    const verb = view.game === "duel" ? "pick your move" : "place your bid";
    status = !isPlayer ? `Round ${s.round}: choosing…` : mine ? "Locked in" : `Round ${s.round}: ${verb}`;
  } else if (view.game === "seabattle" && (view.state as SeaBattleView).phase === "place") {
    const ready = (view.state as SeaBattleView).ready;
    status = !isPlayer ? "Placing ships…" : ready[view.you!.seat!] ? "Ships ready" : "Place your ships";
  } else if (view.turn === myId) status = view.game === "seabattle" ? "Your shot" : "Your turn";
  else status = isPlayer ? `${opponent?.name ?? "Opponent"}'s turn` : `${nameOf(view, view.turn)}'s turn`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted">← Home</Link>
        <button
          onClick={() => {
            setMuted(!mutedState);
            setMutedState(!mutedState);
            if (mutedState) play("tap");
          }}
          aria-label={mutedState ? "Unmute sounds" : "Mute sounds"}
          aria-pressed={mutedState}
          className="ml-auto mr-2 size-10 rounded-full border border-line bg-surface text-lg"
        >
          {mutedState ? "🔇" : "🔊"}
        </button>
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
              <div className="flex items-center gap-1.5 truncate text-sm">
                {p && (
                  <span
                    aria-label={isOnline(p.id) ? "online" : "offline"}
                    className={`size-2 shrink-0 rounded-full ${isOnline(p.id) ? "bg-o" : "bg-line ring-1 ring-muted"}`}
                  />
                )}
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

      {!linkUp && (
        <p role="status" className="rounded-2xl bg-x/15 px-4 py-3 text-center text-sm">
          Connection lost — reconnecting…
        </p>
      )}
      {away.map((p) => (
        <AwayBanner key={p.id} name={p.name} forfeitAt={forfeitAt(view, p.id)} offset={offset} />
      ))}

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
      {view.state != null && view.game === "seabattle" && (
        <SeaBattleBoard
          state={view.state as SeaBattleView}
          mySeat={view.you?.seat ?? null}
          names={[seat(0)?.name ?? "P1", seat(1)?.name ?? "P2"]}
          onMove={move}
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

      <ChatDock
        messages={messages}
        myId={me().id}
        unread={unread}
        onOpen={() => {
          chatOpenRef.current = true;
          setUnread(0);
        }}
        onClose={() => {
          chatOpenRef.current = false;
        }}
        onSend={sendChat}
        onReact={sendReaction}
      />
      <ReactionLayer items={floating} />

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

/** When an absent player will forfeit if their clock keeps running out, or null if it isn't running. */
function forfeitAt(v: RoomView, id: string) {
  const { deadline, limit, waitingOn, misses } = v.clock;
  if (deadline === null || !waitingOn.includes(id)) return null;
  const left = missLimit(limit) - (misses[id] ?? 0) - 1; // turns after this one
  return deadline + left * limit * 1000;
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
  if (v.game === "seabattle") return "⚓";
  return i === 0 ? "✕" : "◯";
}
