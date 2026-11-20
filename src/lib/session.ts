"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useSyncExternalStore } from "react";
import {
  api, ApiError, clearIdentity, localProfile, me, realtime, setIdentity, setLocalProfile,
} from "./client";
import type { Profile } from "./profile";

/**
 * Who is using this phone (guest or logged-in account), their friends, and which
 * friends are online. One shared store, so every screen shows the same thing.
 */

export interface Person { id: string; username: string; name: string; avatar: string; color: string }
export interface Invite { id: number; from: Person; code: string; gameName: string; at: number }
export interface Social { friends: Person[]; incoming: Person[]; outgoing: Person[]; invites: Invite[] }

interface State {
  ready: boolean; // localStorage has been read
  profile: Profile;
  username: string | null; // null = guest
  social: Social;
  online: ReadonlySet<string>; // account ids with the app open
}

const NO_SOCIAL: Social = { friends: [], incoming: [], outgoing: [], invites: [] };
const INITIAL: State = {
  ready: false,
  profile: { name: "", avatar: "🦊", color: "coral" },
  username: null,
  social: NO_SOCIAL,
  online: new Set(),
};

let state = INITIAL;
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let channels: RealtimeChannel[] = [];
function disconnect() {
  channels.forEach((c) => realtime().removeChannel(c));
  channels = [];
}

/** Logged-in only: listen for friend/invite pings and share "I'm online". */
function connect() {
  disconnect();
  const id = me().id;
  const user = realtime()
    .channel(`user:${id}`)
    .on("broadcast", { event: "ping" }, () => refreshSocial())
    .subscribe();
  const lobby = realtime().channel("lobby", { config: { presence: { key: id } } });
  lobby
    .on("presence", { event: "sync" }, () => set({ online: new Set(Object.keys(lobby.presenceState())) }))
    .subscribe((s) => {
      if (s === "SUBSCRIBED") lobby.track({});
    });
  channels = [user, lobby];
}

function adopt(account: Person) {
  const profile = { name: account.name, avatar: account.avatar, color: account.color };
  setLocalProfile(profile);
  localStorage.setItem("pg.user", account.username);
  set({ profile, username: account.username });
}

function becomeGuest() {
  clearIdentity();
  localStorage.removeItem("pg.user");
  disconnect();
  set({ username: null, social: NO_SOCIAL, online: new Set() });
}

let started = false;
function start() {
  if (started) return;
  started = true;
  const username = localStorage.getItem("pg.user");
  set({ ready: true, profile: localProfile(), username });
  if (!username) return;
  api<{ account: Person }>("/account/me")
    .then(({ account }) => {
      adopt(account);
      connect();
      refreshSocial();
    })
    .catch((e) => {
      if (e instanceof ApiError && e.status === 401) becomeGuest(); // logged out elsewhere / password reset
    });
}

export function useSession() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => INITIAL,
  );
  useEffect(start, []);
  return s;
}

interface LoginPayload { id: string; secret: string; account: Person }
function signedIn(p: LoginPayload) {
  setIdentity(p.id, p.secret);
  adopt(p.account);
  connect();
  refreshSocial();
}

export async function register(username: string, password: string) {
  signedIn(await api<LoginPayload>("/account/register", { username, password, ...state.profile }));
}

export async function login(username: string, password: string) {
  signedIn(await api<LoginPayload>("/account/login", { username, password }));
}

export async function resetPassword(username: string, code: string, password: string) {
  signedIn(await api<LoginPayload>("/account/reset", { username, code, password }));
}

export async function logout() {
  await api("/account/me", { logout: true }).catch(() => {});
  becomeGuest();
}

/** Save name / avatar / colour on this phone, and on the account if logged in. */
export async function saveProfile(profile: Profile) {
  const clean = { ...profile, name: profile.name.trim() };
  if (state.username) {
    const { account } = await api<{ account: Person }>("/account/me", clean);
    adopt(account);
  } else {
    setLocalProfile(clean);
    set({ profile: clean });
  }
}

export async function refreshSocial() {
  if (!state.username) return;
  try {
    set({ social: await api<Social>("/friends") });
  } catch {
    /* keep the last list */
  }
}

export type FriendAction =
  | { action: "add"; username: string }
  | { action: "accept" | "remove"; id: string }
  | { action: "invite"; id: string; code: string }
  | { action: "dismiss"; invite: number };

export async function friendAction(body: FriendAction) {
  set({ social: await api<Social>("/friends", body) });
}
