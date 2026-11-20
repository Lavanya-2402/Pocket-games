"use client";

import { useEffect, useRef, useState } from "react";

export const REACTIONS = ["👏", "😂", "😮", "🔥", "😡", "😢"] as const;
const QUICK = ["gg", "Nice one!", "Your turn 👀", "Rematch?", "Hurry up 😅"];
export const MAX_CHAT = 200;

export interface ChatMessage {
  id: string;
  from: string; // player id
  name: string;
  text: string;
  at: number;
}

export interface FloatingReaction {
  key: string;
  emoji: string;
  name: string;
  x: number; // 0..1 horizontal position
}

/** Big emoji that float up over the board for a couple of seconds. */
export function ReactionLayer({ items }: { items: FloatingReaction[] }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {items.map((r) => (
        <div
          key={r.key}
          className="float-up absolute bottom-24 flex flex-col items-center"
          style={{ left: `${10 + r.x * 70}%` }}
        >
          <span className="text-6xl drop-shadow">{r.emoji}</span>
          <span className="rounded-full bg-surface/90 px-2 text-xs font-medium">{r.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Reaction bar + chat button + chat sheet. */
export function ChatDock({
  messages, myId, unread, onOpen, onClose, onSend, onReact,
}: {
  messages: ChatMessage[];
  myId: string;
  unread: number;
  onOpen: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, messages.length]);
  // Close on the way out: a modal left open on a hidden page would block the next one.
  useEffect(() => {
    const d = dialog.current;
    return () => d?.close();
  }, []);

  function show() {
    dialog.current?.showModal();
    setOpen(true);
    onOpen();
  }

  function send(t: string) {
    const msg = t.trim().slice(0, MAX_CHAT);
    if (!msg) return;
    onSend(msg);
    setText("");
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 justify-between rounded-full border border-line bg-surface px-2 py-1">
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => onReact(e)}
              aria-label={`React ${e}`}
              className="size-10 rounded-full text-2xl transition active:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
        <button
          onClick={show}
          aria-label={unread ? `Chat, ${unread} unread` : "Chat"}
          className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl text-accent-ink"
        >
          💬
          {unread > 0 && (
            <span className="pop absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-x px-1 text-xs font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>

      <dialog
        ref={dialog}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-0 mt-auto h-[75dvh] max-h-none w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:h-[70dvh] sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-display text-xl font-extrabold">Chat</h2>
            <button onClick={() => dialog.current?.close()} className="text-sm text-muted">Close</button>
          </div>

          <div ref={list} className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="m-auto text-center text-sm text-muted">No messages yet. Say hi 👋</p>
            )}
            {messages.map((m) => {
              const mine = m.from === myId;
              return (
                <div key={m.id} className={`flex max-w-[80%] flex-col ${mine ? "self-end items-end" : "self-start"}`}>
                  {!mine && <span className="px-1 text-xs text-muted">{m.name}</span>}
                  <span
                    className={`rounded-2xl px-3 py-2 text-sm break-words ${mine ? "bg-accent text-accent-ink" : "bg-bg"}`}
                  >
                    {m.text}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 pb-2">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_CHAT}
              placeholder="Message"
              aria-label="Message"
              enterKeyHint="send"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 outline-none focus:border-ink"
            />
            <button
              disabled={!text.trim()}
              className="h-12 rounded-2xl bg-accent px-5 font-semibold text-accent-ink disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
