"use client";

import { useEffect, useState } from "react";

/** Re-render every `ms` while mounted. */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
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
