import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser tab icon. */
export default function Icon() {
  return new ImageResponse(<AppIcon size={64} />, size);
}
