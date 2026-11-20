"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, inputClass } from "@/components/ui";
import { api, ApiError } from "@/lib/client";
import { useSession } from "@/lib/session";

interface Row {
  id: string; username: string; name: string; avatar: string; color: string;
  joined: number; resetCode: string | null; locked: boolean; phones: number;
}
type Action = "reset" | "clear" | "unlock" | "logout" | "delete";

/** Owner tools: see accounts and help people who are locked out — without opening Supabase. */
export function Owner() {
  const { ready, username } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    api<{ accounts: Row[] }>("/owner")
      .then((d) => setRows(d.accounts))
      .catch((e: ApiError) => (e.status === 403 || e.status === 401 ? setDenied(true) : setError(e.message)));
  }, []);
  useEffect(() => {
    if (ready) load();
  }, [ready, load, username]);

  async function act(row: Row, action: Action) {
    if (action === "delete" && !confirm(`Delete @${row.username} for good? Their friends and login go too. This can't be undone.`)) return;
    setBusy(row.id);
    setError("");
    try {
      await api("/owner", { action, id: row.id });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy("");
  }

  const shell = (body: React.ReactNode) => (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="Home" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface">←</Link>
        <h1 className="font-display text-2xl font-extrabold">Owner tools</h1>
      </header>
      {body}
    </div>
  );

  if (denied) {
    return shell(
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 text-sm">
        <p className="font-semibold">This page is only for the game owner.</p>
        <p className="text-muted">
          {username ? <>You&apos;re logged in as <b>@{username}</b>, which isn&apos;t on the owner list.</> : "Log in with your owner account first (Profile → Account on the home page)."}
        </p>
        <p className="text-muted">
          To become the owner: create an account in the app, then add its username to the{" "}
          <code className="rounded bg-bg px-1">OWNER_USERNAMES</code> setting — in <code className="rounded bg-bg px-1">.env.local</code> on your
          computer and under Environment Variables on Vercel — and restart / redeploy.
        </p>
      </div>,
    );
  }
  if (!rows) return shell(<p className="text-muted">{error || "Loading…"}</p>);

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.username.includes(q) || r.name.toLowerCase().includes(q)) : rows;
  const small = "h-9 rounded-full border border-line px-3 text-sm font-semibold disabled:opacity-40";

  return shell(
    <>
      <p className="text-sm text-muted">
        {rows.length} account{rows.length === 1 ? "" : "s"}. Passwords can&apos;t be read by anyone. To help someone who forgot theirs,
        make a reset code and tell them: they open <b>Profile → Account → Forgot password</b> and enter it with a new password.
      </p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or username" aria-label="Search accounts" className={inputClass} />
      {error && <p role="alert" className="text-sm text-x">{error}</p>}

      <ul className="flex flex-col gap-2">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
            <div className="flex items-center gap-3">
              <Avatar avatar={r.avatar} color={r.color} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.name} <span className="font-normal text-muted">@{r.username}</span></div>
                <div className="text-xs text-muted">
                  Joined {new Date(r.joined).toLocaleDateString()} · logged in on {r.phones} phone{r.phones === 1 ? "" : "s"}
                  {r.locked && <span className="ml-1 font-semibold text-x">· locked after wrong passwords</span>}
                </div>
              </div>
            </div>

            {r.resetCode && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-2">
                <span className="text-sm">
                  Reset code: <b className="font-display text-xl tracking-[0.2em]">{r.resetCode}</b>
                  <span className="block text-xs text-muted">Works once. Give it to @{r.username} only.</span>
                </span>
                <button className={small} onClick={() => navigator.clipboard?.writeText(r.resetCode!)}>Copy</button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button disabled={busy === r.id} className={`${small} bg-accent text-accent-ink`} onClick={() => act(r, "reset")}>
                {r.resetCode ? "New reset code" : "Make reset code"}
              </button>
              {r.resetCode && <button disabled={busy === r.id} className={small} onClick={() => act(r, "clear")}>Cancel code</button>}
              {r.locked && <button disabled={busy === r.id} className={small} onClick={() => act(r, "unlock")}>Unlock</button>}
              {r.phones > 0 && <button disabled={busy === r.id} className={small} onClick={() => act(r, "logout")}>Log out everywhere</button>}
              {r.username !== username && (
                <button disabled={busy === r.id} className={`${small} text-x`} onClick={() => act(r, "delete")}>Delete</button>
              )}
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-muted">No accounts match.</li>}
      </ul>
    </>,
  );
}
