import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

/** Install icons for the web app manifest: /icons/192, /icons/512 and /icons/512-maskable. */
const SIZES: Record<string, { px: number; maskable: boolean }> = {
  "96": { px: 96, maskable: false },
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "512-maskable": { px: 512, maskable: true },
};

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const spec = SIZES[(await ctx.params).size];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIcon size={spec.px} maskable={spec.maskable} />, {
    width: spec.px,
    height: spec.px,
    headers: { "cache-control": "public, max-age=604800" },
  });
}
