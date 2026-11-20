"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { recentPlayers, type RecentPlayer } from "@/lib/client";
import { friendAction, useSession, type FriendAction, type Person } from "@/lib/session";
import { Avatar, ghostBtn, inputClass, primaryBtn, Sheet } from "./ui";

/** Friends list, requests, and invites. With `roomCode`, friends get an Invite button. */
export function FriendsSheet({
  open, onClose, roomCode, onNeedAccount, onPlayAgain,
}: {
  open: boolean;
  onClose: () => void;
  roomCode?: string;
  onNeedAccount: () => void;
  /** Start a new room of the same game with someone you played before. */
  onPlayAgain?: (p: RecentPlayer) => void;
}) {
  const { username, social, online } = useSession();
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<RecentPlayer[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
  useEffect(() => setRecent(open ? recentPlayers() : []), [open]);

  async function run(body: FriendAction, ok?: string) {
    setBusy(true);
    setNote("");
    try {
      await friendAction(body);
      if (ok) setNote(ok);
      if (body.action === "invite") setSent(new Set(sent).add(body.id));
      if (body.action === "add") setAdd("");
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy(false);
  }

  if (!username) {
    return (
      <Sheet open={open} onClose={onClose} title="Friends">
        <p className="text-muted">
          Create a free account to add friends by username, see who&apos;s online and invite them straight into a game.
        </p>
        <button className={primaryBtn} onClick={onNeedAccount}>Create account or log in</button>
      </Sheet>
    );
  }

  const row = (p: Person, right: React.ReactNode, showOnline = false) => (
    <li key={p.id} className="flex items-center gap-3 py-1.5">
      <Avatar avatar={p.avatar} color={p.color} size={40} online={showOnline ? online.has(p.id) : undefined} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{p.name}</div>
        <div className="truncate text-xs text-muted">@{p.username}</div>
      </div>
      {right}
    </li>
  );
  const small = "h-9 rounded-full px-3 text-sm font-semibold disabled:opacity-40";
  // Online friends first.
  const friends = [...social.friends].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)));

  return (
    <Sheet open={open} onClose={onClose} title={roomCode ? "Invite a friend" : "Friends"}>
      {social.invites.length > 0 && !roomCode && (
        <section>
          <h3 className="mb-1 font-display text-sm font-bold text-muted">Invites</h3>
          <ul>
            {social.invites.map((i) => row(i.from, (
              <span className="flex items-center gap-1">
                <Link href={`/r/${i.code}`} onClick={onClose} className={`${small} flex items-center bg-accent text-accent-ink`}>
                  Join {i.gameName}
                </Link>
                <button
                  aria-label="Dismiss invite"
                  className="size-9 rounded-full border border-line"
                  onClick={() => run({ action: "dismiss", invite: i.id })}
                >×</button>
              </span>
            )))}
          </ul>
        </section>
      )}

      {social.incoming.length > 0 && (
        <section>
          <h3 className="mb-1 font-display text-sm font-bold text-muted">Friend requests</h3>
          <ul>
            {social.incoming.map((p) => row(p, (
              <span className="flex gap-1">
                <button disabled={busy} className={`${small} bg-accent text-accent-ink`} onClick={() => run({ action: "accept", id: p.id })}>Accept</button>
                <button disabled={busy} className={`${small} border border-line`} onClick={() => run({ action: "remove", id: p.id })}>Decline</button>
              </span>
            )))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-1 font-display text-sm font-bold text-muted">
          Friends · {social.friends.length}
        </h3>
        {friends.length === 0 ? (
          <p className="py-2 text-sm text-muted">No friends yet. Add someone by their username below.</p>
        ) : (
          <ul>
            {friends.map((p) => row(p, roomCode ? (
              <button
                disabled={busy || sent.has(p.id)}
                className={`${small} bg-accent text-accent-ink`}
                onClick={() => run({ action: "invite", id: p.id, code: roomCode })}
              >
                {sent.has(p.id) ? "Invited ✓" : "Invite"}
              </button>
            ) : (
              <button
                disabled={busy}
                aria-label={`Remove ${p.name}`}
                className={`${small} border border-line text-muted`}
                onClick={() => confirm(`Remove ${p.name} from your friends?`) && run({ action: "remove", id: p.id })}
              >
                Remove
              </button>
            ), true))}
          </ul>
        )}
      </section>

      {!roomCode && recent.length > 0 && (
        <section>
          <h3 className="mb-1 font-display text-sm font-bold text-muted">Recently played with</h3>
          <ul>
            {recent.map((p) => {
              const isFriend = social.friends.some((f) => f.id === p.id);
              const asked = social.outgoing.some((f) => f.id === p.id) || sent.has(`add-${p.id}`);
              return (
                <li key={p.id} className="flex items-center gap-3 py-1.5">
                  <Avatar avatar={p.avatar} color={p.color} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted">{p.gameName}{isFriend ? " · friend" : ""}</div>
                  </div>
                  {!isFriend && (
                    <button
                      disabled={busy || asked}
                      className={`${small} border border-line`}
                      onClick={async () => {
                        await run({ action: "add", id: p.id }, `Friend request sent to ${p.name}`);
                        setSent((s) => new Set(s).add(`add-${p.id}`));
                      }}
                    >
                      {asked ? "Asked ✓" : "Add friend"}
                    </button>
                  )}
                  {onPlayAgain && (
                    <button disabled={busy} className={`${small} bg-accent text-accent-ink`} onClick={() => onPlayAgain(p)}>
                      Play again
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {social.outgoing.length > 0 && (
        <section>
          <h3 className="mb-1 font-display text-sm font-bold text-muted">Waiting for them to accept</h3>
          <ul>
            {social.outgoing.map((p) => row(p, (
              <button disabled={busy} className={`${small} border border-line text-muted`} onClick={() => run({ action: "remove", id: p.id })}>Cancel</button>
            )))}
          </ul>
        </section>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (add) run({ action: "add", username: add }, `Request sent to @${add}`);
        }}
      >
        <input
          value={add}
          onChange={(e) => setAdd(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16))}
          placeholder="Add by username"
          aria-label="Friend's username"
          autoCapitalize="none"
          className={inputClass}
        />
        <button disabled={busy || add.length < 3} className={ghostBtn}>Add</button>
      </form>
      <p className="text-xs text-muted">Your username: <b className="text-ink">@{username}</b></p>
      {note && <p role="status" className="text-sm">{note}</p>}
    </Sheet>
  );
}
