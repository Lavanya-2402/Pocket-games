"use client";

import { useEffect, useState } from "react";
import { Room } from "./room";

export function RoomFromUrl() {
  const [code, setCode] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only known in the browser
  useEffect(() => setCode((location.pathname.split("/")[2] ?? "").toUpperCase()), []);
  if (!code) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Room key={code} code={code} />;
}
