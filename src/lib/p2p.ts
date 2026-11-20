"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Same-Wi-Fi fast mode: a direct WebRTC data channel between the two phones.
 *
 * - Signaling (offer / answer / ICE) rides on the room's existing Realtime channel.
 * - No STUN/TURN servers are configured, so only local-network ("host") routes can
 *   connect. Phones on different networks simply never link and keep using the server.
 * - The server stays the authority: whatever travels here is a speed-up that the
 *   server's own update confirms or replaces a moment later.
 */

export type LinkStatus = "off" | "connecting" | "direct";

export interface Signal {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice" | "bye";
  data?: unknown;
}

const CONNECT_TIMEOUT_MS = 8000;

export function p2pSupported() {
  return typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined";
}

export class PeerLink {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private timer: ReturnType<typeof setTimeout>;
  closed = false;

  constructor(
    private myId: string,
    private peerId: string,
    private signal: (s: Signal) => void,
    private onMessage: (msg: unknown) => void,
    private onStatus: (s: LinkStatus) => void,
    initiator: boolean,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: [] }); // local network only
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.send_({ kind: "ice", data: e.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState;
      if (st === "failed" || st === "closed" || st === "disconnected") this.fail();
    };
    this.pc.ondatachannel = (e) => this.attach(e.channel);
    this.timer = setTimeout(() => this.dc?.readyState !== "open" && this.fail(), CONNECT_TIMEOUT_MS);
    onStatus("connecting");
    if (initiator) {
      this.attach(this.pc.createDataChannel("game", { ordered: true }));
      this.pc.createOffer()
        .then((o) => this.pc.setLocalDescription(o))
        .then(() => this.send_({ kind: "offer", data: this.pc.localDescription }))
        .catch(() => this.fail());
    }
  }

  private send_(s: Omit<Signal, "from" | "to">) {
    if (!this.closed) this.signal({ ...s, from: this.myId, to: this.peerId });
  }

  private attach(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onopen = () => {
      clearTimeout(this.timer);
      this.onStatus("direct");
    };
    dc.onclose = () => this.fail();
    dc.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data));
      } catch {
        /* ignore junk */
      }
    };
  }

  async handle(s: Signal) {
    if (this.closed) return;
    try {
      if (s.kind === "offer") {
        await this.pc.setRemoteDescription(s.data as RTCSessionDescriptionInit);
        await this.flushIce();
        await this.pc.setLocalDescription(await this.pc.createAnswer());
        this.send_({ kind: "answer", data: this.pc.localDescription });
      } else if (s.kind === "answer") {
        await this.pc.setRemoteDescription(s.data as RTCSessionDescriptionInit);
        await this.flushIce();
      } else if (s.kind === "ice") {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(s.data as RTCIceCandidateInit);
        else this.pendingIce.push(s.data as RTCIceCandidateInit);
      } else if (s.kind === "bye") {
        this.fail();
      }
    } catch {
      this.fail();
    }
  }

  private async flushIce() {
    for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
  }

  send(msg: unknown) {
    if (this.dc?.readyState !== "open") return false;
    try {
      this.dc.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  private fail() {
    if (this.closed) return;
    this.close(false);
    this.onStatus("off");
  }

  close(sayBye = true) {
    if (this.closed) return;
    if (sayBye) this.send_({ kind: "bye" });
    this.closed = true;
    clearTimeout(this.timer);
    try {
      this.dc?.close();
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}

/**
 * Keep a direct link to `peerId` while both are in the room. Returns the link status,
 * a `send` that reports whether the message went direct, and `onSignal` for the
 * room channel to forward "rtc" broadcasts into.
 */
export function usePeerLink({
  enabled, myId, peerId, peerOnline, sendSignal, onMessage,
}: {
  enabled: boolean;
  myId: string | null;
  peerId: string | null;
  peerOnline: boolean;
  sendSignal: (s: Signal) => void;
  onMessage: (msg: unknown) => void;
}) {
  const [status, setStatus] = useState<LinkStatus>("off");
  const link = useRef<PeerLink | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Latest callbacks without re-creating the link.
  const cb = useRef({ sendSignal, onMessage });
  useEffect(() => {
    cb.current = { sendSignal, onMessage };
  });

  const active = enabled && p2pSupported() && !!myId && !!peerId && peerOnline;

  const make = useCallback((initiator: boolean) => {
    link.current?.close(false);
    link.current = new PeerLink(
      myId!, peerId!,
      (s) => cb.current.sendSignal(s),
      (m) => cb.current.onMessage(m),
      (st) => setStatus(st),
      initiator,
    );
  }, [myId, peerId]);

  // The player with the smaller id starts; the other answers when the offer arrives.
  useEffect(() => {
    if (!active) return;
    if (myId! < peerId!) make(true);
    return () => {
      link.current?.close();
      link.current = null;
      setStatus("off");
    };
  }, [active, myId, peerId, make, attempt]);

  // If a link drops while both are still here, try again after a short pause.
  useEffect(() => {
    if (!active || status !== "off" || myId! > peerId!) return;
    const t = setTimeout(() => setAttempt((n) => n + 1), 15000);
    return () => clearTimeout(t);
  }, [active, status, myId, peerId]);

  const onSignal = useCallback((s: Signal) => {
    if (!active || s.to !== myId || s.from !== peerId) return;
    if (s.kind === "offer" && (!link.current || link.current.closed || myId! > peerId!)) make(false);
    link.current?.handle(s);
  }, [active, myId, peerId, make]);

  const send = useCallback((msg: unknown) => link.current?.send(msg) ?? false, []);

  return { status: active ? status : "off", send, onSignal };
}
