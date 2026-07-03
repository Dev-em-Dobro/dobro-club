import { Suspense } from "react";
import IngressoChat from "@/components/IngressoChat";

export const metadata = {
  title: "Garanta seu ingresso — Dobro Club",
};

export default function IngressoPage() {
  return (
    <Suspense fallback={<main className="loading">Carregando…</main>}>
      <IngressoChat />
    </Suspense>
  );
}
