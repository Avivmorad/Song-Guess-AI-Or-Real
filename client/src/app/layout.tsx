import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Song Guess: AI Or Real",
    template: "%s · Song Guess: AI Or Real",
  },
  description:
    "A real-time multiplayer music game where players guess whether each track was made by AI or a human.",
  applicationName: "Song Guess: AI Or Real",
  keywords: ["music game", "multiplayer", "AI music", "party game"],
  openGraph: {
    type: "website",
    title: "Song Guess: AI Or Real",
    description: "Trust your ears. Question everything.",
    siteName: "Song Guess: AI Or Real",
  },
  twitter: {
    card: "summary_large_image",
    title: "Song Guess: AI Or Real",
    description: "A real-time multiplayer music deception game.",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090a0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
