import type { MetadataRoute } from "next";

/** Lets phones install Pocket Games to the home screen and open it full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocket Games",
    short_name: "Pocket Games",
    description: "Two phones, one game. Share a code and play.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111230",
    theme_color: "#111230",
    categories: ["games"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
