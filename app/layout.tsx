import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { Atmosphere } from "@/components/shell/atmosphere";
import { SIDEBAR_STORAGE_KEY } from "@/lib/navigation";
import "./globals.css";

/** Interface text — clean and highly readable. */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** Labels and, later, counters and timers. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Editorial display — variable width + optical size for oversized headings. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

/** Italic serif accent, used sparingly. */
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  title: {
    default: "The Makerie",
    template: "%s · The Makerie",
  },
  description:
    "A personal crafting studio for knitting, crochet, cross-stitch and needlepoint. A creative world by Muse.",
  applicationName: "The Makerie",
  appleWebApp: {
    capable: true,
    title: "Makerie",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  colorScheme: "light",
  // Matches the midnight mobile header so the browser chrome reads as one bar.
  themeColor: "#0a1230",
};

/** Restores the saved sidebar state before first paint (no layout flash). */
const sidebarScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)})==="collapsed")document.documentElement.setAttribute("data-sidebar","collapsed")}catch(e){}})()`;

/**
 * Document + atmosphere only. Navigation chrome lives in the (studio) route
 * group so a future full-screen crafting session can opt out of it.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-sidebar="expanded"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: sidebarScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-neon px-4 py-2 text-sm font-semibold text-midnight focus:not-sr-only focus:fixed focus:top-[max(1rem,env(safe-area-inset-top))] focus:left-4"
        >
          Skip to content
        </a>
        <Atmosphere />
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
