import type { Metadata } from "next";
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
  title: "Shares Viewer - Live Mining Arena",
  description:
    "Visualisation en temps réel du travail de vos mineurs Bitcoin. Suivez vos shares, votre progression et votre personnage dans une arène gamifiée.",
  keywords: [
    "bitcoin",
    "mining",
    "shares",
    "ckpool",
    "hashrate",
    "crypto",
    "dashboard",
    "gamification",
  ],
  authors: [{ name: "Les Chauffagistes" }],
  creator: "Les Chauffagistes",

  icons: {
    icon: "/logos/chauffagistes.webp",
    shortcut: "/logos/chauffagistes.webp",
    apple: "/logos/chauffagistes.webp",
  },

  openGraph: {
    title: "Shares Viewer - Live Mining Arena",
    description:
      "Visualisez en temps réel vos shares et votre poids dans le minage Bitcoin, avec une expérience gamifiée.",
    url: "https://shares.chauffagistes-btc.fr",
    siteName: "Shares Viewer",
    images: [
      {
        url: "/logos/chauffagistes.webp",
        width: 512,
        height: 512,
        alt: "Shares Viewer",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Shares Viewer - Live Mining Arena",
    description:
      "Suivez vos mineurs en temps réel avec une expérience gamifiée.",
    images: ["/logos/chauffagistes.webp"],
  },

  metadataBase: new URL("https://shares.chauffagistes-btc.fr"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}