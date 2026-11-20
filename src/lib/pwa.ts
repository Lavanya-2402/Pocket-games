"use client";

import { api } from "./client";

/** Installing the app and switching phone notifications on and off. Browser-only helpers. */

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Call once when the app starts: registers the service worker and catches the install offer. */
export function bootPwa() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  const onOffer = (e: Event) => {
    e.preventDefault(); // we show our own button in Settings instead of the browser's banner
    deferred = e as InstallPrompt;
    changed();
  };
  const onInstalled = () => {
    deferred = null;
    changed();
  };
  window.addEventListener("beforeinstallprompt", onOffer);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onOffer);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export function onInstallChange(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export const canOfferInstall = () => deferred !== null;

export async function offerInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  changed();
  return outcome === "accepted";
}

export const isInstalled = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const pushSupported = () =>
  VAPID_KEY !== "" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export const pushIsOn = async () => (await currentSubscription()) !== null;

/** Ask permission, subscribe this phone, and tell the server. Throws a readable message on failure. */
export async function enablePush() {
  if (!pushSupported()) throw new Error("This browser can't show notifications");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked for this site — allow them in your browser or phone settings");
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) }));
  const json = sub.toJSON();
  await api("/push", { subscribe: { endpoint: json.endpoint, keys: json.keys } });
}

/** Stop notifications on this phone (also done when logging out). Never throws. */
export async function disablePush() {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await api("/push", { unsubscribe: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* nothing to undo */
  }
}

export const sendTestPush = () => api<{ sent: number }>("/push", { test: true });
