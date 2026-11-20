"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountSheet, type AccountTab } from "@/components/account-sheet";
import { FriendsSheet } from "@/components/friends-sheet";
import { NewGameSheet } from "@/components/new-game-sheet";
import { StatsSheet } from "@/components/stats-sheet";
import { RulesCard } from "@/components/how-to-play";
import { Avatar, Sheet } from "@/components/ui";
import { CATALOG, GROUPS, type GameEntry } from "@/games/catalog";
import type { RoomOptions } from "@/games/runner";
import { api, localProfile, type RecentPlayer } from "@/lib/client";
import { friendAction, useSession } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const { ready, profile, username, social } = useSession();
  const [group, setGroup] = useState("all");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<null | "account" | "friends" | "stats">(null);
  const [tab, setTab] = useState<AccountTab>("profile");
  const [rulesFor, setRulesFor] = useState<string | null>(null);
  const [newGame, setNewGame] = useState<string | null>(null);
  // What the player was trying to do when we asked for their name first.
  const [afterName, setAfterName] = useState<null | (() => void)>(null);

  function withName(then: () => void) {
    if (profile.name.trim()) return then();
    setAfterName(() => then);
    setTab("profile");
    setSheet("account");
  }

  async function create(game: string, options: RoomOptions) {
    setBusy(game);
    setError("");
    try {
      const { code } = await api<{ code: string }>("/rooms", { game, options, ...localProfile() });
      router.push(`/r/${code}`);
    } catch (e) {
      setError((e as Error).message);
    }
    // This page stays alive in the background after navigating, so leave it tidy.
    setBusy(null);
    setNewGame(null);
  }

  /** New room of the same game; a friend also gets an invite on their phone. */
  async function playAgain(p: RecentPlayer) {
    setSheet(null);
    setError("");
    try {
      const { code } = await api<{ code: string }>("/rooms", { game: p.game, ...localProfile() });
      if (social.friends.some((f) => f.id === p.id)) {
        await friendAction({ action: "invite", id: p.id, code }).catch(() => {});
      }
      router.push(`/r/${code}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4) return setError("Codes are 4 letters");
    withName(() => router.push(`/r/${code}`));
  }

  const alerts = social.incoming.length + social.invites.length;
  const groups = GROUPS.filter((g) => group === "all" || g.id === group);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rise">
      <header className="flex items-center gap-2">
        <h1 className="mr-auto font-display text-xl font-extrabold tracking-tight whitespace-nowrap sm:text-3xl">Pocket Games</h1>
        <button
          onClick={() => setSheet("stats")}
          aria-label="Records and leaderboard"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
        >
          <span aria-hidden>🏆</span>
        </button>
        <button
          onClick={() => setSheet("friends")}
          aria-label={alerts ? `Friends, ${alerts} new` : "Friends"}
          className="relative flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold"
        >
          <span aria-hidden>👥</span>
          <span className="hidden sm:inline">Friends</span>
          {alerts > 0 && (
            <span className="pop absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-x px-1 text-xs font-bold text-white">
              {alerts}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setTab("profile");
            setSheet("account");
          }}
          aria-label="Your profile"
          className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-1 sm:pr-3"
        >
          <Avatar avatar={profile.avatar} color={profile.color} size={34} />
          <span className={`max-w-24 truncate text-sm font-semibold ${profile.name ? "hidden sm:inline" : "pr-2"}`}>
            {!ready ? "" : profile.name || "Set name"}
          </span>
        </button>
      </header>

      {social.invites.map((i) => (
        <div key={i.id} className="rise flex items-center gap-3 rounded-2xl border border-ink bg-surface p-2.5">
          <Avatar avatar={i.from.avatar} color={i.from.color} size={36} />
          <p className="min-w-0 flex-1 text-sm">
            <b>{i.from.name}</b> invited you to {i.gameName}
          </p>
          <Link href={`/r/${i.code}`} className="flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink">
            Join
          </Link>
          <button
            aria-label="Dismiss invite"
            className="size-9 rounded-full border border-line"
            onClick={() => friendAction({ action: "dismiss", invite: i.id }).catch(() => {})}
          >
            ×
          </button>
        </div>
      ))}

      <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-center lg:justify-between">
        <form onSubmit={join} className="flex gap-2 lg:w-80">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            placeholder="Have a code? ABCD"
            autoCapitalize="characters"
            aria-label="Room code"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 font-display text-lg tracking-[0.15em] outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus:border-ink"
          />
          <button className="h-12 rounded-2xl border border-ink px-5 font-semibold active:scale-[0.98] transition">Join</button>
        </form>

        <div role="tablist" aria-label="Game groups" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {[{ id: "all", name: "All" }, ...GROUPS].map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={group === g.id}
              onClick={() => setGroup(g.id)}
              className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition
                ${group === g.id ? "bg-accent text-accent-ink" : "border border-line bg-surface"}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-x">{error}</p>}

      <div className={`grid gap-x-6 gap-y-4 ${groups.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {groups.map((g) => {
          const games = CATALOG.filter((x) => x.group === g.id);
          const soon = games.filter((x) => x.soon);
          return (
            <section key={g.id} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2">
                <span className="font-display text-lg font-extrabold">{g.name}</span>
                <span className="truncate text-xs text-muted">{g.blurb}</span>
              </h2>
              <div className={`grid grid-cols-2 gap-2.5 ${groups.length > 1 ? "" : "sm:grid-cols-3 lg:grid-cols-4"}`}>
                {games.filter((x) => !x.soon).map((x) => (
                  <GameTile
                    key={x.id}
                    game={x}
                    busy={busy === x.id}
                    disabled={busy !== null}
                    onPlay={() => withName(() => setNewGame(x.id))}
                    onRules={() => setRulesFor(x.id)}
                  />
                ))}
              </div>
              {soon.length > 0 && group !== "all" && (
                <p className="text-xs text-muted">
                  <span className="font-semibold">Coming soon:</span> {soon.map((x) => x.name).join(" · ")}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted">
        {group === "all" && CATALOG.some((x) => x.soon) && (
          <>{CATALOG.filter((x) => x.soon).length} more games are coming — tap a group to see them. </>
        )}
        Tap a game to set it up, then share the code.
        {ready && !username && (
          <>
            {" "}
            <button
              className="underline"
              onClick={() => {
                setTab("account");
                setSheet("account");
              }}
            >
              Create an account
            </button>{" "}
            to add friends.
          </>
        )}
      </p>

      <AccountSheet
        open={sheet === "account"}
        onClose={() => {
          setSheet(null);
          setAfterName(null);
        }}
        tab={tab}
        onTab={setTab}
        prompt={afterName ? "Pick a name and a look. You can change them any time." : undefined}
        onSaved={() => {
          const then = afterName;
          setSheet(null);
          setAfterName(null);
          then?.();
        }}
      />
      <FriendsSheet
        open={sheet === "friends"}
        onClose={() => setSheet(null)}
        onPlayAgain={playAgain}
        onNeedAccount={() => {
          setTab("account");
          setSheet("account");
        }}
      />
      <NewGameSheet
        game={newGame}
        onClose={() => setNewGame(null)}
        onCreate={create}
        busy={busy !== null}
        loggedIn={!!username}
      />
      <StatsSheet
        open={sheet === "stats"}
        onClose={() => setSheet(null)}
        onNeedAccount={() => {
          setTab("account");
          setSheet("account");
        }}
      />
      <Sheet open={rulesFor !== null} onClose={() => setRulesFor(null)} title="How to play">
        {rulesFor && <RulesCard game={rulesFor} />}
      </Sheet>
    </div>
  );
}

function GameTile({
  game, busy, disabled, onPlay, onRules,
}: {
  game: GameEntry;
  busy: boolean;
  disabled: boolean;
  onPlay: () => void;
  onRules: () => void;
}) {
  return (
    <div className="relative h-full">
      <button
        onClick={onPlay}
        disabled={disabled}
        className={`flex h-full min-h-20 w-full flex-col justify-between gap-1.5 rounded-2xl bg-accent p-3 text-left text-accent-ink transition active:scale-[0.98]
          ${disabled && !busy ? "opacity-60" : ""}`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-display text-base leading-tight font-semibold sm:text-lg">{game.name}</span>
          <span aria-hidden className="shrink-0 text-xl leading-none">
            {game.icon === "✕◯" ? (
              <span className="font-display font-extrabold">
                <span className="text-x">✕</span>
                <span className="text-o">◯</span>
              </span>
            ) : game.icon}
          </span>
        </span>
        <span className="line-clamp-2 pr-8 text-xs leading-snug opacity-70">{busy ? "Opening room…" : game.tagline}</span>
      </button>
      <button
        onClick={onRules}
        aria-label={`How to play ${game.name}`}
        className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full border border-accent-ink/30 text-sm font-bold text-accent-ink"
      >
        ?
      </button>
    </div>
  );
}
