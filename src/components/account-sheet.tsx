"use client";

import Link from "next/link";
import { useState } from "react";
import { AVATARS, COLOR_KEYS, COLORS, type Profile } from "@/lib/profile";
import { changePassword, login, logout, register, resetPassword, saveProfile, useSession } from "@/lib/session";
import { isMuted, play, setMuted } from "@/lib/sound";
import { getSkin, getTheme, setSkin, setTheme, SKINS, THEMES, type Skin, type Theme } from "@/lib/theme";
import { Avatar, ghostBtn, inputClass, primaryBtn, Sheet } from "./ui";

export type AccountTab = "profile" | "account" | "settings";

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
    <Sheet open={open} onClose={onClose} title={tab === "profile" ? "Your profile" : tab === "account" ? "Account" : "Settings"}>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-bg p-1 text-sm font-semibold">
        {(["profile", "account", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            aria-pressed={tab === t}
            className={`h-10 truncate rounded-xl px-1 capitalize ${tab === t ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {t === "account" && username ? `@${username}` : t}
          </button>
        ))}
      </div>
      {tab === "profile" && <ProfileForm prompt={prompt} onSaved={() => (onSaved ? onSaved() : onClose())} />}
      {tab === "account" && <AccountForm onDone={onClose} />}
      {tab === "settings" && <SettingsForm />}
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

/** Look and sound, saved on this phone. Changes apply straight away. */
function SettingsForm() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [skin, setSkinState] = useState<Skin>(() => getSkin());
  const [sound, setSound] = useState(() => !isMuted());
  const label = "mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className={label}>Theme</p>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-bg p-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              aria-pressed={theme === t.id}
              onClick={() => {
                setTheme(t.id);
                setThemeState(t.id);
              }}
              className={`h-11 rounded-xl text-sm font-semibold ${theme === t.id ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Auto follows your phone&apos;s light or dark setting.</p>
      </div>

      <div>
        <p className={label}>Board and card colours</p>
        <div className="grid grid-cols-5 gap-2">
          {SKINS.map((k) => (
            <button
              key={k.id}
              aria-pressed={skin === k.id}
              aria-label={`${k.label} colours`}
              onClick={() => {
                setSkin(k.id);
                setSkinState(k.id);
              }}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 py-2 text-xs font-semibold ${skin === k.id ? "border-ink" : "border-line"}`}
            >
              <span className="flex -space-x-1.5">
                <span className="size-6 rounded-full ring-2 ring-surface" style={{ background: k.x }} />
                <span className="size-6 rounded-full ring-2 ring-surface" style={{ background: k.o }} />
              </span>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <button
        role="switch"
        aria-checked={sound}
        onClick={() => {
          setMuted(sound);
          setSound(!sound);
          if (!sound) play("tap");
        }}
        className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{sound ? "🔊" : "🔇"} Sound effects</span>
          <span className="block text-xs text-muted">Taps, turns, wins and chat pings.</span>
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${sound ? "bg-o" : "bg-line"}`}>
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${sound ? "left-[1.375rem]" : "left-0.5"}`} />
        </span>
      </button>
    </div>
  );
}

type Mode = "signup" | "login" | "reset";

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <>
        <button className={ghostBtn} onClick={() => setOpen(true)}>Change password</button>
        {note && <p role="status" className="text-sm">{note}</p>}
      </>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-line p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote("");
        try {
          await changePassword(current, next);
          setCurrent("");
          setNext("");
          setOpen(false);
          setNote("Password changed. Your other phones were logged out.");
        } catch (err) {
          setNote((err as Error).message);
        }
        setBusy(false);
      }}
    >
      <input
        value={current} onChange={(e) => setCurrent(e.target.value)} type="password"
        placeholder="Current password" aria-label="Current password" autoComplete="current-password" className={inputClass}
      />
      <input
        value={next} onChange={(e) => setNext(e.target.value)} type="password"
        placeholder="New password (6+ characters)" aria-label="New password" autoComplete="new-password" className={inputClass}
      />
      {note && <p role="alert" className="text-sm text-x">{note}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={ghostBtn} onClick={() => setOpen(false)}>Cancel</button>
        <button disabled={busy || !current || next.length < 6} className={primaryBtn}>Change</button>
      </div>
    </form>
  );
}

function AccountForm({ onDone }: { onDone: () => void }) {
  const { username, profile, owner } = useSession();
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
        <ChangePassword />
        {owner && (
          <Link href="/owner" onClick={onDone} className={`${ghostBtn} flex items-center justify-center`}>
            🛠 Owner tools
          </Link>
        )}
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
