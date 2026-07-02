import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./legacy-shell.css";

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
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
