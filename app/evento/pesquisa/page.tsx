import { Suspense } from "react";
import PesquisaPlaceholder from "@/components/PesquisaPlaceholder";

export default function PesquisaPage() {
  return (
    <Suspense fallback={<main className="loading">Carregando…</main>}>
      <PesquisaPlaceholder />
    </Suspense>
  );
}
