"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanAvatar, cleanColor, randomAvatar, randomColor, type Profile } from "./profile";
import type { RoomView } from "./server";
import { uuid } from "@/games/util";

export type { RoomView };

function store(key: string, make: () => string) {
  let v = localStorage.getItem(key);
  if (!v) {
    v = make();
    localStorage.setItem(key, v);
  }
  return v;
}

/** Anonymous identity kept on this phone. The secret proves ownership to the server. */
export function me() {
  return {
    id: store("pg.id", uuid),
    secret: store("pg.secret", () => uuid() + uuid()),
  };
}

export const getName = () => localStorage.getItem("pg.name") ?? "";
export const setName = (n: string) => localStorage.setItem("pg.name", n.trim());

export async function api<T = RoomView>(path: string, body?: unknown): Promise<T> {
  const { id, secret } = me();
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-player-id": id, "x-player-secret": secret },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong");
  return data as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let sb: SupabaseClient | null = null;
export function realtime() {
  if (!sb) {
    sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return sb;
}

// ---- Profile kept on this phone (guests and logged-in players alike) ----

export function localProfile(): Profile {
  return {
    name: getName(),
    avatar: cleanAvatar(store("pg.avatar", randomAvatar)),
    color: cleanColor(store("pg.color", randomColor)),
  };
}

export function setLocalProfile(p: Profile) {
  setName(p.name);
  localStorage.setItem("pg.avatar", cleanAvatar(p.avatar));
  localStorage.setItem("pg.color", cleanColor(p.color));
}

/** Become a specific account on this phone (after sign-up / login). */
export function setIdentity(id: string, secret: string) {
  localStorage.setItem("pg.id", id);
  localStorage.setItem("pg.secret", secret);
}

/** Forget the account; the next `me()` call makes a fresh guest identity. */
export function clearIdentity() {
  localStorage.removeItem("pg.id");
  localStorage.removeItem("pg.secret");
}
