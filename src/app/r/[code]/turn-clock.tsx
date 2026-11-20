"use client";

import { useEffect, useState } from "react";
import { play } from "@/lib/sound";

/** Re-render every `ms` while mounted. */
export function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Shown while the opponent has closed the room. If their clock is running, counts
 * down to the forfeit (their remaining missed turns × turn length).
 */
export function AwayBanner({
  name, forfeitAt, offset, auto = false,
}: {
  name: string;
  forfeitAt: number | null;
  offset: number;
  /** Three or more players: nobody forfeits, their turns are just played for them. */
  auto?: boolean;
}) {
  const now = useNow(500) + offset;
  const secs = forfeitAt === null ? null : Math.max(0, Math.ceil((forfeitAt - now) / 1000));
  return (
    <div role="status" className="rise flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-muted" />
      <span>
        <b>{name} left the room.</b>{" "}
        {auto
          ? "Their turns will be played automatically until they come back."
          : secs === null
          ? "If they don't come back, their clock will run out on their next turn."
          : secs > 0
            ? <>They forfeit in <b className="tabular-nums">{secs}s</b> unless they come back.</>
            : "Waiting for the forfeit…"}
      </span>
    </div>
  );
}

/**
 * Countdown for the current turn. `offset` = server clock − phone clock, so both
 * phones show the same time even if their clocks disagree.
 */
export function TurnClock({
  deadline, total, offset, label, urgent,
}: {
  deadline: number;
  total: number;
  offset: number;
  label: string;
  urgent: boolean; // true when it's *your* time running out
}) {
  const now = useNow(250) + offset;
  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const frac = Math.min(1, left / (total * 1000));
  const low = secs <= 5;
  // Tick each of your last 5 seconds.
  useEffect(() => {
    if (urgent && secs > 0 && secs <= 5) play("tick");
  }, [secs, urgent]);
  return (
    <div className="flex flex-col gap-1.5" role="timer" aria-live={low && urgent ? "assertive" : "off"}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className={`font-display font-extrabold tabular-nums ${low ? "text-x" : ""}`}>
          {secs > 0 ? `${secs}s` : "Time!"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-linear ${low ? "bg-x" : urgent ? "bg-ink" : "bg-muted"}`}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
    </div>
  );
}
