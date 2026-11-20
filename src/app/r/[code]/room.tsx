"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, getName, localProfile, me, realtime, type RoomView } from "@/lib/client";
import { AVATARS, COLOR_KEYS } from "@/lib/profile";
import { saveProfile, useSession } from "@/lib/session";
import { AccountSheet, type AccountTab } from "@/components/account-sheet";
import { FriendsSheet } from "@/components/friends-sheet";
import { Avatar } from "@/components/ui";
import { missLimit } from "@/games/runner";
import { isMuted, play, setMuted } from "@/lib/sound";
import { usePeerLink, type Signal } from "@/lib/p2p";
import { HowToPlayButton } from "@/components/how-to-play";
import { getEngine } from "@/games";
import type { BidTacToeView } from "@/games/bidtactoe";
import type { Connect4State } from "@/games/connect4";
import type { DuelView } from "@/games/duel";
import type { TicTacToeState } from "@/games/tictactoe";
import { BidTacToeBoard } from "./bidtactoe-board";
import { Connect4Board } from "./connect4-board";
import { DuelBoard } from "./duel-board";
import type { ColorRushView } from "@/games/colorrush";
import type { SeaBattleView } from "@/games/seabattle";
import { ColorRushBoard } from "./colorrush-board";
import { SeaBattleBoard } from "./seabattle-board";
import { TicTacToeBoard } from "./tictactoe-board";
import { AwayBanner, TurnClock } from "./turn-clock";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ChatDock, MAX_CHAT, REACTIONS, ReactionLayer, type ChatMessage, type FloatingReaction,
} from "./chat";

const SIMULTANEOUS = new Set(["bidtactoe", "duel"]);

export function Room({ code }: { code: string }) {
  const session = useSession();
  const name = session.ready ? session.profile.name : null; // null = still reading this phone
  const [sheet, setSheet] = useState<null | "friends" | "account">(null);
  const [accountTab, setAccountTab] = useState<AccountTab>("account");
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
  const rtcRef = useRef<((s: Signal) => void) | null>(null); // direct-link signaling handler
  const peerSendRef = useRef<(msg: unknown) => boolean>(() => false); // direct-link send

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

  // Chat/reactions may arrive twice (direct link + server channel); show each once.
  const seenRef = useRef(new Set<string>());
  const firstTime = (id: unknown) => {
    if (typeof id !== "string") return true;
    if (seenRef.current.has(id)) return false;
    seenRef.current.add(id);
    if (seenRef.current.size > 300) seenRef.current = new Set([...seenRef.current].slice(-150));
    return true;
  };

  const receiveChat = useCallback((m: ChatMessage) => {
    if (!m?.text || typeof m.text !== "string" || !firstTime(m.id)) return;
    const clean = { ...m, text: m.text.slice(0, MAX_CHAT), name: displayName(m.from, String(m.name).slice(0, 20)) };
    setMessages((list) => [...list.slice(-49), clean]);
    if (!chatOpenRef.current) setUnread((n) => n + 1);
    play("chat");
  }, [displayName]);

  const showReaction = useCallback((emoji: unknown, from: unknown, id?: unknown) => {
    if (typeof emoji !== "string" || !(REACTIONS as readonly string[]).includes(emoji) || !firstTime(id)) return;
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
    // Direct link first (instant on same Wi-Fi); the channel copy reaches spectators too.
    peerSendRef.current({ t: "chat", m });
    channelRef.current?.send({ type: "broadcast", event: "chat", payload: m });
  }

  function sendReaction(emoji: string) {
    const now = Date.now();
    if (now - lastSentRef.current.react < 600) return;
    lastSentRef.current.react = now;
    const payload = { emoji, from: me().id, id: `${now}-${Math.random()}` };
    showReaction(emoji, me().id, payload.id);
    peerSendRef.current({ t: "react", ...payload });
    channelRef.current?.send({ type: "broadcast", event: "react", payload });
  }

  // A move that arrived over the direct link is shown before the server confirms it.
  // Until a newer server version arrives, don't let an older poll undo it.
  const directRef = useRef<{ base: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  const accept = useCallback((v: RoomView) => {
    const holding = pendingRef.current || directRef.current !== null;
    const fresher = holding ? v.version > versionRef.current : v.version >= versionRef.current;
    if (fresher) {
      const sawDirect = directRef.current !== null && v.version === directRef.current.base + 1;
      if (directRef.current && v.version > directRef.current.base) {
        clearTimeout(directRef.current.timer);
        directRef.current = null;
      }
      // Someone else's move (ours plays its own sound on tap; direct moves already played). Skip the first load.
      if (versionRef.current >= 0 && v.version > versionRef.current && !pendingRef.current && !sawDirect && v.state) play("opponent");
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

  // Join (takes a seat if one is free, otherwise spectates).
  useEffect(() => {
    if (!name) return;
    api(`/rooms/${code}/join`, localProfile())
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
      .on("broadcast", { event: "react" }, ({ payload }) => showReaction(payload?.emoji, payload?.from, payload?.id))
      .on("broadcast", { event: "rtc" }, ({ payload }) => rtcRef.current?.(payload as Signal))
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

  // ---- Same-Wi-Fi fast mode: direct phone-to-phone link (see src/lib/p2p.ts) ----
  const [fastMode, setFastMode] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
  useEffect(() => setFastMode(localStorage.getItem("pg.fast") !== "0"), []);

  const myIdNow = view?.you && view.you.seat !== null ? view.you.id : null;
  const peerIdNow = myIdNow ? view?.players.find((p) => p.id !== myIdNow)?.id ?? null : null;

  const onPeerMessage = useCallback((msg: unknown) => {
    const m = msg as { t?: string } & Record<string, unknown>;
    if (m.t === "chat") receiveChat(m.m as ChatMessage);
    else if (m.t === "react") showReaction(m.emoji, m.from, m.id);
    else if (m.t === "move") {
      // Opponent's move, straight from their phone. Show it now if it applies cleanly to
      // the exact board we have; the server's update confirms (or corrects) it shortly.
      const v = viewRef.current;
      const engine = v && getEngine(v.game);
      if (!v?.state || !engine || engine.hiddenInfo || v.winner || m.base !== v.version) return;
      const by = String(m.by);
      if (by === myIdNow || !v.players.some((p) => p.id === by)) return;
      if (engine.validate(v.state, m.move, by) !== null) return;
      const state = engine.apply(v.state, m.move, by);
      const timer = setTimeout(() => {
        directRef.current = null;
        refresh(); // server never confirmed — resync
      }, 4000);
      if (directRef.current) clearTimeout(directRef.current.timer);
      directRef.current = { base: v.version, timer };
      setView({ ...v, state, turn: engine.turn(state), winner: engine.winner(state) });
      play("opponent");
    }
  }, [receiveChat, showReaction, myIdNow, refresh]);

  const { status: linkStatus, send: peerSend, onSignal: peerSignal } = usePeerLink({
    enabled: fastMode,
    myId: myIdNow,
    peerId: peerIdNow,
    peerOnline: !!peerIdNow && online.has(peerIdNow),
    sendSignal: (s) => channelRef.current?.send({ type: "broadcast", event: "rtc", payload: s }),
    onMessage: onPeerMessage,
  });
  useEffect(() => {
    rtcRef.current = peerSignal;
    peerSendRef.current = peerSend;
  }, [peerSignal, peerSend]);

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
      // Same Wi-Fi: hand the move straight to the other phone too.
      peerSendRef.current({ t: "move", move: m, base: view.version, by: view.you.id });
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
          if (n) saveProfile({ ...session.profile, name: n });
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
  // The game keeps its own player order (index 0 moves first), which flips on every
  // rematch. Room seats never change. Boards work in game order, so translate here.
  const gameOrder = ((view.state as { players?: string[] } | null)?.players ?? []) as string[];
  const roleOf = (id?: string) => (id ? gameOrder.indexOf(id) : -1);
  const gameSeat = myId && roleOf(myId) !== -1 ? roleOf(myId) : null;
  const gameNames: [string, string] = [nameOf(view, gameOrder[0] ?? null), nameOf(view, gameOrder[1] ?? null)];
  // Game seats listed in room-seat order: lets boards keep each player in the same place every game.
  const firstSeat = roleOf(view.players.find((p) => p.seat === 0)?.id) === 1 ? 1 : 0;
  const layout: [number, number] = [firstSeat, 1 - firstSeat];
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
    const mine = gameSeat !== null ? s.pending[gameSeat] : null;
    const verb = view.game === "duel" ? "pick your move" : "place your bid";
    status = !isPlayer ? `Round ${s.round}: choosing…` : mine ? "Locked in" : `Round ${s.round}: ${verb}`;
  } else if (view.game === "seabattle" && (view.state as SeaBattleView).phase === "place") {
    const ready = (view.state as SeaBattleView).ready;
    status = gameSeat === null ? "Placing ships…" : ready[gameSeat] ? "Ships ready" : "Place your ships";
  } else if (view.turn === myId) status = view.game === "seabattle" ? "Your shot" : "Your turn";
  else status = isPlayer ? `${opponent?.name ?? "Opponent"}'s turn` : `${nameOf(view, view.turn)}'s turn`;

  const playing = view.state != null;
  const fit = view.game === "tictactoe" || view.game === "connect4"
    ? "fit-square"
    : view.game === "seabattle" ? "w-full" : "mx-auto w-full lg:max-w-lg";
  const openAccount = (t: AccountTab) => {
    setAccountTab(t);
    setSheet("account");
  };

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-x-8">
      <header className="flex items-center gap-2 lg:col-span-2">
        <Link
          href="/"
          aria-label="Home"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface"
        >
          ←
        </Link>
        <span className="mr-auto min-w-0 truncate font-display text-lg font-extrabold"><span className="hidden sm:inline">{view.gameName}</span></span>
        {isPlayer && (
          <button
            onClick={() => {
              localStorage.setItem("pg.fast", fastMode ? "0" : "1");
              setFastMode(!fastMode);
            }}
            aria-pressed={fastMode}
            aria-label={`Same Wi-Fi fast mode: ${!fastMode ? "off" : linkStatus === "direct" ? "connected" : "on, not connected"}`}
            className={`flex h-10 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition
              ${linkStatus === "direct" ? "border-o bg-o text-white" : "border-line bg-surface"} ${fastMode ? "" : "opacity-50"}`}
          >
            ⚡<span className="hidden sm:inline">{!fastMode ? "Off" : linkStatus === "direct" ? "Direct" : linkStatus === "connecting" ? "…" : "Wi-Fi"}</span>
          </button>
        )}
        <button
          onClick={() => {
            setMuted(!mutedState);
            setMutedState(!mutedState);
            if (mutedState) play("tap");
          }}
          aria-label={mutedState ? "Unmute sounds" : "Mute sounds"}
          aria-pressed={mutedState}
          className="size-10 shrink-0 rounded-full border border-line bg-surface text-lg"
        >
          {mutedState ? "🔇" : "🔊"}
        </button>
        <HowToPlayButton game={view.game} compact />
        <button
          onClick={share}
          aria-label={`Share room ${code}`}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm"
        >
          <span className="font-display font-extrabold tracking-[0.15em]">{code}</span>
          <span aria-hidden>↗</span>
        </button>
      </header>

      {/* Who's playing, whose turn, and the clock. Beside the board on wide screens. */}
      <section className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-2">
        {/* Simultaneous games show their own player cards (coins / HP). */}
        {!(SIMULTANEOUS.has(view.game) && view.state) && (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((s) => {
              const p = seat(s);
              const active = p && view.turn === p.id;
              const look = p ? lookFor(p) : null;
              return (
                <div
                  key={s}
                  className={`flex min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2 transition ${active ? "border-ink bg-surface" : "border-line"}`}
                >
                  {look
                    ? <Avatar avatar={look.avatar} color={look.color} size={36} online={isOnline(p!.id)} />
                    : <span className="size-9 shrink-0 rounded-full border border-dashed border-muted" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {p ? p.name : <span className="font-normal text-muted">waiting…</span>}
                    {p?.id === myId && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  {playing && p && (
                    <span className={`font-display text-lg leading-none font-extrabold ${roleOf(p.id) === 1 ? "text-o" : "text-x"}`}>
                      {markFor(view, p.id)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p aria-live="polite" className="text-center font-display text-2xl font-extrabold lg:text-3xl">{status}</p>
        {view.clock.forfeit && (
          <p className="-mt-2 text-center text-sm text-muted">
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
      </section>

      {/* The game itself */}
      <section className={`flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-span-2 lg:row-start-2 ${playing ? fit : ""}`}>
        {!playing && (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line p-6 text-center lg:py-16">
            <p className="text-muted">On the other phone, open the link or enter this code:</p>
            <p className="font-display text-5xl font-extrabold tracking-[0.2em]">{code}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={share} className="h-12 rounded-2xl bg-accent px-5 font-semibold text-accent-ink">Share link</button>
              <button onClick={() => setSheet("friends")} className="h-12 rounded-2xl border border-ink px-5 font-semibold">
                Invite a friend
              </button>
            </div>
          </div>
        )}

        {playing && view.game === "tictactoe" && (
          <TicTacToeBoard
            state={view.state as TicTacToeState}
            canMove={isPlayer && view.turn === myId}
            onMove={(cell) => move({ cell })}
          />
        )}
        {playing && view.game === "bidtactoe" && (
          <BidTacToeBoard
            state={view.state as BidTacToeView}
            mySeat={gameSeat}
            names={gameNames}
            layout={layout}
            onBid={(bid, cell) => move({ bid, cell })}
          />
        )}
        {playing && view.game === "duel" && (
          <DuelBoard
            state={view.state as DuelView}
            mySeat={gameSeat}
            names={gameNames}
            layout={layout}
            onAct={(action) => move({ action })}
          />
        )}
        {playing && view.game === "seabattle" && (
          <SeaBattleBoard
            state={view.state as SeaBattleView}
            mySeat={gameSeat}
            names={gameNames}
            layout={layout}
            onMove={move}
          />
        )}
        {playing && view.game === "colorrush" && (
          <ColorRushBoard
            state={view.state as ColorRushView}
            mySeat={gameSeat}
            names={gameNames}
            layout={layout}
            onMove={move}
          />
        )}
        {playing && view.game === "connect4" && (
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
      </section>

      {/* Chat and reactions: pinned to the bottom of the screen on phones. */}
      <section className="sticky bottom-0 z-20 -mx-4 flex min-w-0 flex-col gap-1.5 bg-bg/95 px-4 py-2 backdrop-blur lg:static lg:col-start-2 lg:row-start-3 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        {error && <p role="alert" className="text-center text-sm text-x">{error}</p>}
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
        {(!isPlayer || view.spectators > 0) && (
          <p className="text-center text-xs text-muted">
            {!isPlayer ? "You're spectating." : `${view.spectators} watching`}
          </p>
        )}
      </section>

      <ReactionLayer items={floating} />
      <FriendsSheet
        open={sheet === "friends"}
        onClose={() => setSheet(null)}
        roomCode={code}
        onNeedAccount={() => openAccount("account")}
      />
      <AccountSheet
        open={sheet === "account"}
        onClose={() => setSheet(null)}
        tab={accountTab}
        onTab={setAccountTab}
      />
    </div>
  );
}

/** Avatar + colour for a player; rooms from before profiles get a stable look from their id. */
function lookFor(p: { id: string; avatar: string | null; color: string | null }) {
  let h = 0;
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    avatar: p.avatar ?? AVATARS[h % AVATARS.length],
    color: p.color ?? COLOR_KEYS[(h >>> 8) % COLOR_KEYS.length],
  };
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
  if (v.game !== "tictactoe") return ""; // no per-player piece in the other games
  return i === 0 ? "✕" : "◯";
}
