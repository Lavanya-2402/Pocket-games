"use client";

import { useState } from "react";
import {
  canPlay, COLORS, identical, RULES, type Card, type Color, type ColorRushMove, type ColorRushView,
} from "@/games/colorrush";

type Seat = 0 | 1;

const HEX: Record<Color, string> = {
  coral: "var(--x)",
  teal: "var(--o)",
  gold: "var(--gold)",
  violet: "var(--violet)",
};
const LABEL: Record<Color, string> = { coral: "Coral", teal: "Teal", gold: "Gold", violet: "Violet" };
const RAINBOW = `conic-gradient(${HEX.coral} 0 25%, ${HEX.gold} 0 50%, ${HEX.teal} 0 75%, ${HEX.violet} 0)`;

function symbol(card: Card) {
  switch (card.kind) {
    case "num": return String(card.value);
    case "block": return "⊘";
    case "plus2": return "+2";
    case "wild": return "✦";
    case "wild4": return "+4";
  }
}

function describe(card: Card) {
  const name = { num: String(card.value), block: "Block", plus2: "+2", wild: "Rainbow", wild4: "Rainbow +4" }[card.kind];
  return card.color ? `${LABEL[card.color]} ${name}` : name;
}

/** Our own card design: colored card, light oval, big symbol, small corner marks. */
export function CardFace({ card, size = "md", dim = false, lift = false }: {
  card: Card; size?: "sm" | "md" | "lg"; dim?: boolean; lift?: boolean;
}) {
  const dims = { sm: "w-10 h-14 text-base", md: "w-14 h-20 text-2xl", lg: "w-20 h-28 text-4xl sm:w-24 sm:h-36 sm:text-5xl" }[size];
  const wild = card.color === null;
  return (
    <span
      className={`relative flex shrink-0 select-none items-center justify-center rounded-xl border-2 border-white/80 font-display font-extrabold shadow-md transition
        ${dims} ${dim ? "opacity-40" : ""} ${lift ? "-translate-y-2 ring-2 ring-ink" : ""}`}
      style={{ background: wild ? RAINBOW : HEX[card.color!] }}
    >
      <span className="absolute inset-[18%_12%] -rotate-12 rounded-[50%] bg-white/90" />
      <span className="relative" style={{ color: wild ? "#1d1a16" : HEX[card.color!] }}>{symbol(card)}</span>
      {size !== "sm" && (
        <span className="absolute top-0.5 left-1 text-[10px] text-white">{symbol(card)}</span>
      )}
    </span>
  );
}

function CardBack({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "w-8 h-12", md: "w-14 h-20", lg: "w-20 h-28 sm:w-24 sm:h-36" }[size];
  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-xl border-2 border-white/80 bg-ink shadow-md ${dims}`}>
      <span className="absolute inset-[18%_12%] rounded-[50%]" style={{ background: RAINBOW, opacity: 0.85 }} />
      <span className="relative font-display text-xs font-extrabold text-white">CR</span>
    </span>
  );
}

export function ColorRushBoard({
  state, mySeat, names, layout, onMove,
}: {
  state: ColorRushView;
  mySeat: number | null;
  names: [string, string];
  /** Game seats in room-seat order, so positions and colours stay put across rematches. */
  layout: [number, number];
  onMove: (m: ColorRushMove) => void;
}) {
  const me = mySeat === 0 || mySeat === 1 ? (mySeat as Seat) : null;
  const opp = (me === null ? layout[1] : 1 - me) as Seat;
  const bottom = (me ?? layout[0]) as Seat;
  const myTurn = me !== null && state.turn === me && !state.winner;
  const [picking, setPicking] = useState<Card | null>(null); // Rainbow waiting for a color

  const who = (s: Seat) => (s === me ? "You" : names[s]);
  const last = state.last;
  const rules = state.rules ?? {};
  const stack = state.stack ?? 0;
  const penaltyName = state.stackKind === "wild4" ? "+4" : "+2";
  const live = me !== null && !state.winner;

  /** Can this card be played right now? On your turn, or as a jump-in. */
  function playable(card: Card) {
    if (!live) return false;
    if (!myTurn) return !!rules.jumpin && stack === 0 && !state.drew && identical(card, state.top);
    if (stack > 0) return card.kind === state.stackKind;
    return canPlay(card, state.top, state.color);
  }
  const canDraw = myTurn && (stack > 0 || !state.drew);
  const canCall = live && !!rules.lastcard && state.hand.length <= 2 && !state.called?.[me!];
  const canCatch = live && !!rules.lastcard && state.uncalled === opp;
  const onRules = RULES.filter((r) => rules[r.id as keyof typeof rules]);

  function tapCard(card: Card) {
    if (!playable(card)) return;
    if (card.color === null) setPicking(card);
    else onMove({ type: "play", card: card.id });
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      {/* Opponent */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          <b>{who(opp)}</b> · {state.counts[opp]} card{state.counts[opp] === 1 ? "" : "s"}
          {state.counts[opp] === 1 && !state.winner && <span className="ml-1 font-bold text-x">Last card!</span>}
        </span>
        <span className="flex -space-x-5">
          {Array.from({ length: Math.min(state.counts[opp], 8) }, (_, i) => <CardBack key={i} size="sm" />)}
        </span>
      </div>

      {/* Table */}
      <div className="flex items-center justify-center gap-6 rounded-3xl bg-surface py-3 sm:py-5">
        <button
          onClick={() => canDraw && onMove({ type: "draw" })}
          disabled={!canDraw}
          aria-label={stack > 0 ? `Draw ${stack} cards` : `Draw a card (${state.deckCount} left)`}
          className={`flex flex-col items-center gap-1 transition ${canDraw ? "active:scale-95" : "opacity-70"}`}
        >
          <CardBack size="lg" />
          <span className={`text-xs ${canDraw && stack > 0 ? "font-bold text-x" : "text-muted"}`}>
            {canDraw ? (stack > 0 ? `Tap to draw ${stack}` : "Tap to draw") : `${state.deckCount} left`}
          </span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <span key={state.top.id} className="pop"><CardFace card={state.top} size="lg" /></span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="size-3 rounded-full" style={{ background: HEX[state.color] }} />
            {LABEL[state.color]} in play
          </span>
        </div>
      </div>

      {stack > 0 && !state.winner && (
        <p role="status" className="rounded-2xl bg-x/15 px-3 py-2 text-center text-sm font-semibold">
          {penaltyName} stack: {stack} cards waiting.{" "}
          {myTurn ? `Answer with a ${penaltyName}, or draw ${stack}.` : `${who(state.turn)} must answer or draw.`}
        </p>
      )}

      {last && (
        <p key={JSON.stringify(last)} className="rise text-center text-sm sm:-mt-2">
          {who(last.by)}{" "}
          {last.note === "call" ? <b>called &ldquo;Last card!&rdquo;</b>
            : last.note === "catch" ? <>caught {who((1 - last.by) as Seat)} not calling last card — <b>{who((1 - last.by) as Seat)} drew 2</b></>
            : last.play
              ? <>{last.note === "jumpin" ? "jumped in with" : "played"} <b>{describe(last.play)}</b>{last.color && <> → {LABEL[last.color]}</>}
                  {last.note === "swap" && <> and <b>swapped hands</b></>}
                  {last.forced > 0 && <>; {who((1 - last.by) as Seat)} drew {last.forced}</>}
                  {(last.play.kind === "block" || last.forced > 0) && !state.winner && <> — {who(last.by)} go{last.by === me ? "" : "es"} again</>}</>
              : last.drew ? `drew ${last.drew === 1 ? "a card" : `${last.drew} cards`}` : "passed"}
          .
        </p>
      )}

      {(canCall || canCatch) && (
        <div className="flex justify-center gap-2">
          {canCatch && (
            <button onClick={() => onMove({ type: "catch" })} className="pop h-11 rounded-full bg-x px-5 font-semibold text-white active:scale-95">
              Catch {names[opp]}! (+2)
            </button>
          )}
          {canCall && (
            <button onClick={() => onMove({ type: "call" })} className="h-11 rounded-full border-2 border-ink px-5 font-semibold active:scale-95">
              📣 Last card!
            </button>
          )}
        </div>
      )}

      {/* Rainbow color picker */}
      {picking && (
        <div className="rise flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4">
          <p className="text-center text-sm font-semibold">Choose the next color</p>
          <div className="grid grid-cols-4 gap-2">
            {COLORS.map((col) => (
              <button
                key={col}
                onClick={() => {
                  onMove({ type: "play", card: picking.id, color: col });
                  setPicking(null);
                }}
                className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-white active:scale-95"
                style={{ background: HEX[col] }}
              >
                {LABEL[col]}
              </button>
            ))}
          </div>
          <button onClick={() => setPicking(null)} className="text-sm text-muted">Cancel</button>
        </div>
      )}

      {/* Your hand */}
      {me !== null ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Your hand · {state.hand.length}</span>
            {myTurn && state.drew && stack === 0 && (
              <button onClick={() => onMove({ type: "pass" })} className="rounded-full border border-ink px-4 py-1.5 font-semibold">
                Pass
              </button>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 pt-2">
            {sortHand(state.hand).map((card) => {
              const ok = playable(card);
              return (
                <button
                  key={card.id}
                  onClick={() => tapCard(card)}
                  disabled={!ok}
                  aria-label={describe(card) + (ok ? (myTurn ? ", playable" : ", jump in") : "")}
                  className="transition active:scale-95"
                >
                  <CardFace card={card} dim={myTurn && !ok} lift={ok} />
                </button>
              );
            })}
          </div>
          {myTurn && stack === 0 && !state.drew && !state.hand.some((c) => canPlay(c, state.top, state.color)) && (
            <p className="text-center text-xs text-muted">No match — tap the deck to draw.</p>
          )}
          {myTurn && state.drew && stack === 0 && (
            <p className="text-center text-xs text-muted">You drew a playable card — play it or pass.</p>
          )}
          {!myTurn && live && state.hand.some(playable) && (
            <p className="text-center text-xs font-semibold">You hold the same card — tap it to jump in!</p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-muted">{names[bottom]} · {state.counts[bottom]} cards</p>
      )}

      {onRules.length > 0 && (
        <p className="text-center text-[11px] text-muted">House rules: {onRules.map((r) => r.label).join(" · ")}</p>
      )}
    </div>
  );
}

function sortHand(hand: Card[]) {
  const order = (c: Card) => (c.color ? COLORS.indexOf(c.color) : 9) * 100 + (c.value ?? 20 + ["block", "plus2", "wild", "wild4"].indexOf(c.kind));
  return [...hand].sort((a, b) => order(a) - order(b));
}
