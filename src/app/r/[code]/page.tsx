import { Suspense } from "react";
import { Room } from "./room";

async function RoomFromParams({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Room key={code} code={code.toUpperCase()} />;
}

export default function RoomPage({ params }: PageProps<"/r/[code]">) {
  return (
    <Suspense fallback={<p className="pt-10 text-muted">Loading…</p>}>
      <RoomFromParams params={params} />
    </Suspense>
  );
}
