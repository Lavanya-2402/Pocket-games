import type { Metadata, Viewport } from "next";
import { DM_Sans, Grandstander } from "next/font/google";
import { PwaBoot } from "@/components/app-settings";
import "./globals.css";

// Grandstander: round, slightly wobbly lettering, like the lid of a board-game box.
const display = Grandstander({ variable: "--font-display", subsets: ["latin"] });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pocket Games",
  description: "27 games to play with friends, each on your own phone. Share a code and play.",
  applicationName: "Pocket Games",
  appleWebApp: { capable: true, title: "Pocket Games", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edeefa" },
    { media: "(prefers-color-scheme: dark)", color: "#111230" },
  ],
};

const THEME_BOOT = `try{var d=document.documentElement,t=localStorage.getItem("pg.theme"),s=localStorage.getItem("pg.skin");if(t==="light"||t==="dark")d.dataset.theme=t;if(s)d.dataset.skin=s}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col font-sans">
        {/* Runs before anything is drawn, so a saved theme never flashes the wrong colours. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <PwaBoot />
        <main className="w-full flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
