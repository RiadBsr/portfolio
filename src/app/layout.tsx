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

const title = "Riad Boussoura - AI & Computer Vision Engineer";
const description =
  "AI & Computer Vision engineer in Paris. Interactive 3D portfolio: Sim-to-Real 360° stitching at GoPro, synthetic data in Blender, PyTorch, and an AI clone you can talk to.";

// og:image comes from the opengraph-image.png file convention next to this layout
export const metadata: Metadata = {
  metadataBase: new URL("https://riadboussoura.com"),
  title,
  description,
  openGraph: { title, description, url: "/", siteName: "Riad Boussoura", type: "website" },
  twitter: { card: "summary_large_image", title, description },
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
