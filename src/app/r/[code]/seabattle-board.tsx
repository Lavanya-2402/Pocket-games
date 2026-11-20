"use client";

import { useState } from "react";
import {
  cells, fits, FLEET, randomFleet, SHIP_NAMES, SIZE,
  type SeaBattleMove, type SeaBattleView, type Ship, type Shot,
} from "@/games/seabattle";

type Seat = 0 | 1;
const key = (r: number, c: number) => `${r},${c}`;
const COLS = "ABCDEFGH";

export function SeaBattleBoard({
  state, mySeat, names, layout, onMove,
}: {
  state: SeaBattleView;
  mySeat: number | null;
  names: [string, string];
  /** Game seats in room-seat order, so positions and colours stay put across rematches. */
  layout: [number, number];
  onMove: (m: SeaBattleMove) => void;
}) {
  const me = mySeat === 0 || mySeat === 1 ? (mySeat as Seat) : null;
  const opp = me === null ? null : ((1 - me) as Seat);
  // Phones show one grid at a time (so nothing scrolls); wide screens show both.
  const [tab, setTab] = useState<"target" | "home">("target");

  if (state.phase === "place") {
    if (me !== null && !state.ready[me]) return <Placement onReady={(ships) => onMove({ type: "place", ships })} />;
    return (
      <div className="fit-tall flex flex-col gap-4">
        <p className="text-center text-sm text-muted">
          {me === null
            ? "Both players are placing their ships…"
            : `Ships placed. Waiting for ${names[opp!]}…`}
        </p>
        {me !== null && <Grid ships={state.visible[me]} shots={state.shots[opp!]} label="Your fleet" />}
      </div>
    );
  }

  // Battle. Players see enemy waters big (tap to fire) and their own fleet small.
  // Spectators see both grids.
  const top = (opp ?? layout[1]) as Seat;
  const bottom = (me ?? layout[0]) as Seat;
  const myTurn = me !== null && state.turn === me && !state.winner;
  const fired = new Set(state.shots[bottom].map((s) => key(s.r, s.c)));
  const last = state.last;

  return (
    <div className="flex flex-col gap-4">
      {last && (
        <p key={`${last.by}-${last.r}-${last.c}`} className="rise text-center text-sm">
          {last.by === me ? "You" : names[last.by]} fired at {COLS[last.c]}{last.r + 1}:{" "}
          <b className={last.hit ? "text-x" : ""}>{last.hit ? "Hit!" : "Miss"}</b>
          {last.sunk !== null && (
            <> — sank {last.by === me ? "their" : me !== null ? "your" : `${names[(1 - last.by) as Seat]}'s`}{" "}
              <b>{SHIP_NAMES[FLEET[last.sunk]]}</b>!</>
          )}
        </p>
      )}

      <div role="tablist" aria-label="Which grid to show" className="mx-auto grid w-full max-w-xs grid-cols-2 gap-1 rounded-2xl bg-line p-1 text-sm font-semibold lg:hidden">
        {(["target", "home"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-xl ${tab === t ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {t === "target"
              ? me === null ? names[top] : "Enemy waters"
              : me === null ? names[bottom] : `My fleet${state.sunk[bottom].length ? ` · ${state.sunk[bottom].length} sunk` : ""}`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:items-start lg:gap-6">
        <div className={`fit-tall flex-col gap-2 lg:flex ${tab === "target" ? "flex" : "hidden"}`}>
          <Grid
            label={me === null ? `${names[top]}'s waters` : myTurn ? "Enemy waters — tap to fire" : "Enemy waters"}
            ships={state.visible[top]}
            shots={state.shots[bottom]}
            sunk={state.sunk[top]}
            fleetOf={state.visible[top]}
            lastShot={last && last.by === bottom ? last : null}
            onCell={myTurn ? (r, c) => !fired.has(key(r, c)) && onMove({ type: "fire", r, c }) : undefined}
            enemy
          />
          <FleetStatus sunk={state.sunk[top]} label={me === null ? `${names[top]}'s ships` : "Enemy ships left"} />
        </div>
        <div className={`fit-tall flex-col gap-2 lg:flex lg:max-w-none ${tab === "home" ? "flex" : "hidden"}`}>
          <Grid
            label={me === null ? `${names[bottom]}'s waters` : "Your fleet"}
            ships={state.visible[bottom]}
            shots={state.shots[top]}
            sunk={state.sunk[bottom]}
            fleetOf={state.visible[bottom]}
            lastShot={last && last.by === top ? last : null}
          />
          <FleetStatus sunk={state.sunk[bottom]} label={me === null ? `${names[bottom]}'s ships` : "Your ships left"} />
        </div>
      </div>
    </div>
  );
}

function FleetStatus({ sunk, label }: { sunk: number[]; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted">
      <span>{label}:</span>
      {FLEET.map((len, i) => (
        <span key={i} className={`flex gap-0.5 ${sunk.includes(i) ? "opacity-25" : ""}`} title={SHIP_NAMES[len]}>
          {Array.from({ length: len }, (_, j) => <span key={j} className="h-2 w-2 rounded-sm bg-ink" />)}
        </span>
      ))}
    </div>
  );
}

function Grid({
  ships, shots, label, sunk = [], fleetOf = [], lastShot = null, onCell, enemy = false, small = false,
  selected = null,
}: {
  ships: Ship[];
  shots: Shot[];
  label: string;
  sunk?: number[];
  fleetOf?: Ship[];
  lastShot?: { r: number; c: number } | null;
  onCell?: (r: number, c: number) => void;
  enemy?: boolean;
  small?: boolean;
  selected?: number | null;
}) {
  const shipAt = new Map<string, number>();
  ships.forEach((s, i) => cells(s).forEach(([r, c]) => shipAt.set(key(r, c), i)));
  const shotAt = new Map(shots.map((s) => [key(s.r, s.c), s.hit]));
  const sunkCells = new Set(
    sunk.flatMap((i) => (fleetOf[i] ? cells(fleetOf[i]).map(([r, c]) => key(r, c)) : [])),
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-center text-xs font-medium text-muted">{label}</span>
      <div
        role="grid"
        aria-label={label}
        className={`grid gap-[3px] rounded-2xl bg-line p-[3px] ${small ? "" : ""}`}
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const r = Math.floor(i / SIZE), c = i % SIZE;
          const k = key(r, c);
          const ship = shipAt.get(k);
          const shot = shotAt.get(k);
          const isSunk = sunkCells.has(k);
          const isLast = lastShot?.r === r && lastShot?.c === c;
          const clickable = !!onCell && shot === undefined;
          return (
            <button
              key={k}
              role="gridcell"
              aria-label={`${COLS[c]}${r + 1}${shot === true ? " hit" : shot === false ? " miss" : ""}${ship !== undefined ? " ship" : ""}`}
              disabled={!onCell}
              onClick={() => onCell?.(r, c)}
              className={`relative flex aspect-square items-center justify-center rounded-[5px] transition
                ${isSunk ? "bg-ink" : ship !== undefined ? (selected === ship ? "bg-o" : "bg-muted/60") : enemy ? "bg-surface" : "bg-surface"}
                ${clickable ? "active:scale-90" : ""}
                ${isLast ? "ring-2 ring-x ring-offset-1 ring-offset-line" : ""}`}
            >
              {shot === true && (
                <span key="hit" className={`pop font-extrabold leading-none ${small ? "text-sm" : "text-xl"} ${isSunk ? "text-surface" : "text-x"}`}>✕</span>
              )}
              {shot === false && <span className={`pop rounded-full bg-muted ${small ? "size-1" : "size-1.5"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Place your fleet: tap a ship to select it, tap it again to rotate, tap water to move it. */
function Placement({ onReady }: { onReady: (ships: Ship[]) => void }) {
  const [ships, setShips] = useState<Ship[]>(() => randomFleet(Math.random));
  const [sel, setSel] = useState<number | null>(null);
  const [hint, setHint] = useState("Tap a ship to select it.");

  function tap(r: number, c: number) {
    const hitShip = ships.findIndex((s) => cells(s).some(([rr, cc]) => rr === r && cc === c));
    const others = (i: number) => ships.filter((_, j) => j !== i);
    if (hitShip !== -1 && hitShip !== sel) {
      setSel(hitShip);
      setHint("Tap it again to rotate, or tap water to move it.");
      return;
    }
    if (sel === null) return;
    const cur = ships[sel];
    const next: Ship = hitShip === sel
      ? { ...cur, dir: cur.dir === "h" ? "v" : "h" }
      : { ...cur, r, c };
    if (!fits(next, others(sel))) {
      setHint(hitShip === sel ? "No room to rotate here." : "It doesn't fit there.");
      return;
    }
    setShips(ships.map((s, j) => (j === sel ? next : s)));
    setHint(hitShip === sel ? "Rotated." : "Moved. Tap another ship, or press Ready.");
  }

  return (
    <div className="fit-tall flex flex-col gap-3">
      <p className="text-center text-sm text-muted">{hint}</p>
      <Grid ships={ships} shots={[]} label="Your fleet (secret)" onCell={tap} selected={sel} />
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setShips(randomFleet(Math.random));
            setSel(null);
          }}
          className="h-14 rounded-2xl border border-ink font-semibold active:scale-[0.98]"
        >
          🔀 Shuffle
        </button>
        <button
          onClick={() => onReady(ships)}
          className="h-14 rounded-2xl bg-accent font-semibold text-accent-ink active:scale-[0.98]"
        >
          Ready ⚓
        </button>
      </div>
    </div>
  );
}
