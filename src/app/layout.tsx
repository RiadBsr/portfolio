import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Mono, Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050505',
}

export const metadata: Metadata = {
  title: "Riad Boussoura - Portfolio",
  description: "A showcase of my work and projects.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Riad B.",
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
