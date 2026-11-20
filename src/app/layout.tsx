import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "800"] });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pocket Games",
  description: "Two phones, one game. Share a code and play.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
};

const THEME_BOOT = `try{var d=document.documentElement,t=localStorage.getItem("pg.theme"),s=localStorage.getItem("pg.skin");if(t==="light"||t==="dark")d.dataset.theme=t;if(s)d.dataset.skin=s}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col font-sans">
        {/* Runs before anything is drawn, so a saved theme never flashes the wrong colours. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <main className="w-full flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
