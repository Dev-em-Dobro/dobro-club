import { Suspense } from "react";
import MestreCaptura from "@/components/MestreCaptura";

export default function MestrePage() {
  return (
    <Suspense fallback={<main className="loading">Carregando…</main>}>
      <MestreCaptura />
    </Suspense>
  );
}
