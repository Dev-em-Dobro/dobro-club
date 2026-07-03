import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Mulish } from "next/font/google";
import "./globals.css";
import "./legacy-shell.css";

// design.md §3 — display pixel (títulos/botões) + corpo legível.
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-press-start",
});
const mulish = Mulish({
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mulish",
});

export const metadata: Metadata = {
  title: "Dobro Club — Evento",
  description: "Ambiente oficial do evento de lançamento.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1117",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${pressStart.variable} ${mulish.variable}`}>
      <body>{children}</body>
    </html>
  );
}
