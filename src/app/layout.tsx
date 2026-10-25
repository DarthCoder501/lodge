import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "Inbox Stages",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
