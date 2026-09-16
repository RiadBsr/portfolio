import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Mono, Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";

// Paused: only Space Mono renders on the pause screen, so the other four
// families are kept (the portfolio still needs them) but no longer preloaded.
// Drop the four `preload: false` lines when the site comes back.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-space-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
  preload: false,
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050505',
}

// Paused: no name, no description of the owner, no icons, no manifest.
// The real metadata lives in src/app/_paused/ — see "Paused state" in README.md.
export const metadata: Metadata = {
  title: "Work in Progress",
  description: "This site is temporarily offline.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${spaceMono.variable} ${bebasNeue.variable} ${dmSans.variable}`}>
        {children}
      </body>
    </html>
  );
}
