"use client";

import { useEffect, useRef } from "react";
import { cleanAvatar, colorHex } from "@/lib/profile";

/** A player's emoji on their chosen colour, with an optional online dot. */
export function Avatar({
  avatar, color, size = 40, online,
}: {
  avatar?: string | null;
  color?: string | null;
  size?: number;
  online?: boolean;
}) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: colorHex(color), fontSize: size * 0.56, lineHeight: 1 }}
    >
      <span aria-hidden>{cleanAvatar(avatar)}</span>
      {online !== undefined && (
        <span
          role="img"
          aria-label={online ? "online" : "offline"}
          className={`absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-bg ${online ? "bg-[#3fbf6b]" : "bg-muted"}`}
        />
      )}
    </span>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-extrabold">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="size-9 rounded-full border border-line text-lg leading-none">
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export const inputClass =
  "h-12 w-full min-w-0 rounded-2xl border border-line bg-bg px-4 outline-none focus:border-ink";
export const primaryBtn =
  "h-12 rounded-2xl bg-accent px-5 font-semibold text-accent-ink transition active:scale-[0.98] disabled:opacity-40";
export const ghostBtn =
  "h-12 rounded-2xl border border-line px-5 font-semibold transition active:scale-[0.98] disabled:opacity-40";
