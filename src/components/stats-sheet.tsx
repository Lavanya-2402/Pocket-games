"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useSession, type Person } from "@/lib/session";
import { Avatar, primaryBtn, Sheet } from "./ui";

interface Tally { wins: number; losses: number; draws: number }
interface Stats {
  me: Tally;
  board: (Tally & { person: Person; you: boolean; vsYou: Tally | null })[];
  byGame: (Tally & { game: string; name: string })[];
  recent: { id: string; game: string; opponent: string; result: "win" | "loss" | "draw"; forfeit: boolean; vsBot: boolean; at: number }[];
}

const played = (t: Tally) => t.wins + t.losses + t.draws;
const rate = (t: Tally) => (played(t) ? Math.round((t.wins / played(t)) * 100) : 0);
const ago = (at: number) => {
  const mins = Math.max(1, Math.round((Date.now() - at) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};

/** Your win/loss record, the friends leaderboard, and recent games with replays. */
export function StatsSheet({ open, onClose, onNeedAccount }: { open: boolean; onClose: () => void; onNeedAccount: () => void }) {
  const { username } = useSession();
  return (
    <Sheet open={open} onClose={onClose} title="Records">
      {!username ? (
        <>
          <p className="text-muted">
            Create a free account to keep your win/loss record, climb a leaderboard with your friends and replay finished games.
          </p>
          <button className={primaryBtn} onClick={onNeedAccount}>Create account or log in</button>
        </>
      ) : (
        <Body onClose={onClose} />
      )}
    </Sheet>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Stats>("/stats").then(setStats).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p role="alert" className="text-sm text-x">{error}</p>;
  if (!stats) return <p className="py-6 text-center text-muted">Loading…</p>;

  const h = "mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted";
  const chip = { win: "bg-o text-white", loss: "bg-x text-white", draw: "bg-line text-ink" } as const;
  return (
    <>
      <section className="grid grid-cols-4 gap-2 text-center">
        {([["Won", stats.me.wins], ["Lost", stats.me.losses], ["Drawn", stats.me.draws], ["Win rate", `${rate(stats.me)}%`]] as const).map(([label, v]) => (
          <div key={label} className="rounded-2xl bg-bg py-2">
            <div className="font-display text-2xl font-extrabold tabular-nums">{v}</div>
            <div className="text-[11px] text-muted">{label}</div>
          </div>
        ))}
      </section>

      <section>
        <h3 className={h}>Friends leaderboard</h3>
        {stats.board.length === 1 && <p className="pb-1 text-sm text-muted">Add friends to see how you compare.</p>}
        <ol className="flex flex-col gap-1">
          {stats.board.map((row, i) => (
            <li key={row.person.id} className={`flex items-center gap-2.5 rounded-2xl px-2 py-1.5 ${row.you ? "bg-bg" : ""}`}>
              <span className="w-5 text-center font-display font-extrabold tabular-nums text-muted">{i + 1}</span>
              <Avatar avatar={row.person.avatar} color={row.person.color} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{row.you ? "You" : row.person.name}</div>
                {row.vsYou && played(row.vsYou) > 0 && (
                  <div className="text-[11px] text-muted">You vs them: {row.vsYou.wins}–{row.vsYou.losses}{row.vsYou.draws ? ` (${row.vsYou.draws} drawn)` : ""}</div>
                )}
              </div>
              <span className="text-sm tabular-nums">
                <b>{row.wins}</b><span className="text-muted"> W · {row.losses} L{row.draws ? ` · ${row.draws} D` : ""}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-1 text-[11px] text-muted">Games against the computer don&apos;t count.</p>
      </section>

      {stats.byGame.length > 0 && (
        <section>
          <h3 className={h}>By game</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {stats.byGame.map((g) => (
              <li key={g.game} className="flex justify-between gap-2">
                <span className="truncate">{g.name}</span>
                <span className="shrink-0 tabular-nums text-muted">{g.wins}–{g.losses}{g.draws ? `–${g.draws}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className={h}>Recent games</h3>
        {stats.recent.length === 0 && <p className="text-sm text-muted">Nothing yet. Finish a game and it will show up here.</p>}
        <ul className="flex flex-col gap-1">
          {stats.recent.map((g) => (
            <li key={g.id} className="flex items-center gap-2 text-sm">
              <span className={`w-12 shrink-0 rounded-full py-0.5 text-center text-[11px] font-bold uppercase ${chip[g.result]}`}>{g.result}</span>
              <span className="min-w-0 flex-1 truncate">
                {g.game} <span className="text-muted">vs {g.opponent}{g.forfeit ? " · forfeit" : ""} · {ago(g.at)}</span>
              </span>
              <Link
                href={`/replay/${g.id}`}
                onClick={onClose}
                aria-label={`Replay ${g.game} vs ${g.opponent}`}
                className="flex h-8 shrink-0 items-center rounded-full border border-line px-3 text-xs font-semibold"
              >
                ▶ Replay
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
