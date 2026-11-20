"use client";

import { useState } from "react";
import { AVATARS, COLOR_KEYS, COLORS, type Profile } from "@/lib/profile";
import { login, logout, register, resetPassword, saveProfile, useSession } from "@/lib/session";
import { Avatar, ghostBtn, inputClass, primaryBtn, Sheet } from "./ui";

export type AccountTab = "profile" | "account";

/** Edit how you look (everyone), and sign up / log in / reset password (accounts). */
export function AccountSheet({
  open, onClose, tab, onTab, prompt, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tab: AccountTab;
  onTab: (t: AccountTab) => void;
  prompt?: string; // e.g. "Pick a name to start playing"
  onSaved?: () => void;
}) {
  const { username } = useSession();
  return (
    <Sheet open={open} onClose={onClose} title={tab === "profile" ? "Your profile" : "Account"}>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-bg p-1 text-sm font-semibold">
        {(["profile", "account"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            aria-pressed={tab === t}
            className={`h-10 rounded-xl capitalize ${tab === t ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {t === "account" && username ? `@${username}` : t}
          </button>
        ))}
      </div>
      {tab === "profile"
        ? <ProfileForm prompt={prompt} onSaved={() => (onSaved ? onSaved() : onClose())} />
        : <AccountForm onDone={onClose} />}
    </Sheet>
  );
}

function ProfileForm({ prompt, onSaved }: { prompt?: string; onSaved: () => void }) {
  const { profile } = useSession();
  const [draft, setDraft] = useState<Profile>(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return setError("Enter a name");
    setBusy(true);
    setError("");
    try {
      await saveProfile(draft);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {prompt && <p className="text-sm text-muted">{prompt}</p>}
      <div className="flex items-center gap-3">
        <Avatar avatar={draft.avatar} color={draft.color} size={56} />
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          maxLength={20}
          autoComplete="nickname"
          placeholder="Your name"
          aria-label="Your name"
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Avatar</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setDraft({ ...draft, avatar: a })}
              aria-pressed={draft.avatar === a}
              aria-label={`Avatar ${a}`}
              className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition active:scale-90
                ${draft.avatar === a ? "bg-bg ring-2 ring-ink" : ""}`}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Colour</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDraft({ ...draft, color: c })}
              aria-pressed={draft.color === c}
              aria-label={`Colour ${c}`}
              className={`aspect-square rounded-full transition active:scale-90 ${draft.color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
              style={{ background: COLORS[c] }}
            />
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-sm text-x">{error}</p>}
      <button disabled={busy} className={primaryBtn}>{prompt ? "Save & play" : "Save"}</button>
    </form>
  );
}

type Mode = "signup" | "login" | "reset";

function AccountForm({ onDone }: { onDone: () => void }) {
  const { username, profile } = useSession();
  const [mode, setMode] = useState<Mode>("signup");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (username) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
          <Avatar avatar={profile.avatar} color={profile.color} size={48} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{profile.name}</div>
            <div className="text-sm text-muted">@{username}</div>
          </div>
        </div>
        <p className="text-sm text-muted">
          Friends add you by your username. Your profile follows you to any phone you log in on.
        </p>
        <button
          className={ghostBtn}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await logout();
            setBusy(false);
            onDone();
          }}
        >
          Log out
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !profile.name.trim()) return setError("Set your name in the Profile tab first");
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await register(user, pass);
      else if (mode === "login") await login(user, pass);
      else await resetPassword(user, code, pass);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  const title = { signup: "Create account", login: "Log in", reset: "Set new password" }[mode];
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {mode === "signup" && "Optional. An account lets you add friends, invite them to games, and keep your profile on any phone."}
        {mode === "login" && "Welcome back."}
        {mode === "reset" && "Forgot your password? Ask the game owner for a reset code, then choose a new password here."}
      </p>
      <input
        value={user}
        onChange={(e) => setUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16))}
        placeholder="Username"
        aria-label="Username"
        autoComplete="username"
        autoCapitalize="none"
        className={inputClass}
      />
      {mode === "reset" && (
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Reset code"
          aria-label="Reset code"
          autoComplete="one-time-code"
          className={inputClass}
        />
      )}
      <input
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        type="password"
        placeholder={mode === "login" ? "Password" : mode === "reset" ? "New password (6+ characters)" : "Password (6+ characters)"}
        aria-label={mode === "reset" ? "New password" : "Password"}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className={inputClass}
      />
      {error && <p role="alert" className="text-sm text-x">{error}</p>}
      <button disabled={busy || !user || !pass || (mode === "reset" && !code)} className={primaryBtn}>{title}</button>
      <div className="flex justify-center gap-4 text-sm text-muted">
        {mode !== "signup" && <button type="button" className="underline" onClick={() => { setMode("signup"); setError(""); }}>Create account</button>}
        {mode !== "login" && <button type="button" className="underline" onClick={() => { setMode("login"); setError(""); }}>Log in</button>}
        {mode !== "reset" && <button type="button" className="underline" onClick={() => { setMode("reset"); setError(""); }}>Forgot password</button>}
      </div>
    </form>
  );
}
