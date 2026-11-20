"use client";

import { useEffect, useState } from "react";
import {
  bootPwa, canOfferInstall, disablePush, enablePush, isInstalled, isIos, offerInstall, onInstallChange,
  pushIsOn, pushSupported, sendTestPush,
} from "@/lib/pwa";
import { useSession } from "@/lib/session";
import { ghostBtn, primaryBtn } from "./ui";

/** Mounted once in the layout: registers the service worker and listens for the install offer. */
export function PwaBoot() {
  useEffect(() => bootPwa(), []);
  return null;
}

/** "Install as an app" and "Invite notifications", shown in Profile → Settings. */
export function AppSettings() {
  const { username } = useSession();
  const [, refresh] = useState(0);
  const [on, setOn] = useState<boolean | null>(null); // null = still checking
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => onInstallChange(() => refresh((n) => n + 1)), []);
  useEffect(() => {
    pushIsOn().then(setOn).catch(() => setOn(false));
  }, []);

  const label = "mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted";
  const installed = isInstalled();
  const supported = pushSupported();

  async function toggle() {
    setBusy(true);
    setNote("");
    try {
      if (on) {
        await disablePush();
        setOn(false);
      } else {
        await enablePush();
        setOn(true);
        setNote("On. You'll get a notification when a friend invites you.");
      }
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <div>
        <p className={label}>Install as an app</p>
        {installed ? (
          <p className="text-sm">✓ Installed — you&apos;re using the app.</p>
        ) : canOfferInstall() ? (
          <button className={`${primaryBtn} w-full`} onClick={() => offerInstall()}>📲 Install Pocket Games</button>
        ) : (
          <p className="text-sm text-muted">
            {isIos()
              ? <>In Safari, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.</>
              : <>Open your browser&apos;s menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</>}
            {" "}You get a home-screen icon and a full-screen game.
          </p>
        )}
      </div>

      <div>
        <p className={label}>Invite notifications</p>
        {!username ? (
          <p className="text-sm text-muted">Log in to get a notification when a friend invites you to play.</p>
        ) : !supported ? (
          <p className="text-sm text-muted">
            {isIos() && !installed
              ? "On iPhone, install the app first (above), then open it from your home screen and turn this on."
              : "Notifications aren't available in this browser, or aren't set up on this server yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              role="switch"
              aria-checked={!!on}
              disabled={busy || on === null}
              onClick={toggle}
              className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">🔔 Notify me on this phone</span>
                <span className="block text-xs text-muted">When a friend invites you, or sends a friend request.</span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-o" : "bg-line"}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
              </span>
            </button>
            {on && (
              <button
                className={ghostBtn}
                disabled={busy}
                onClick={async () => {
                  setNote("");
                  try {
                    const { sent } = await sendTestPush();
                    setNote(sent ? "Test sent — it should appear in a moment." : "Couldn't reach this phone. Try switching it off and on again.");
                  } catch (e) {
                    setNote((e as Error).message);
                  }
                }}
              >
                Send a test notification
              </button>
            )}
          </div>
        )}
        {note && <p role="status" className="mt-1.5 text-sm">{note}</p>}
      </div>
    </>
  );
}
