"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Pesquisa rápida — placeholder (Story 8.2 ainda não migrada). Ao concluir,
 * emite `survey.completed` (POST /api/evento/pesquisa) e volta para a intenção
 * (`?next`). Trocar o miolo pelo embed real da pesquisa quando existir.
 */
export default function PesquisaPlaceholder() {
  const router = useRouter();
  const params = useSearchParams();
  // Só aceita destino interno (evita open redirect via ?next=https://evil.com).
  const raw = params.get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : "/evento/conteudo";
  const [busy, setBusy] = useState(false);

  async function concluir() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/evento/pesquisa", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        router.push(next);
        return;
      }
      // Sem sessão → passar pelo Mestre antes.
      router.push(`/evento/mestre?next=${encodeURIComponent(next)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ticket-screen ticket-screen--center">
      <div className="scroll-card">
        <h1 className="scroll-title">Pesquisa rápida</h1>
        <p className="scroll-text">
          Responda pra gente te conhecer melhor e liberar o conteúdo do evento.
        </p>
        <p className="scroll-hint">
          (Em breve o formulário completo aparece aqui.)
        </p>
        <button
          className="btn scroll-cta"
          onClick={concluir}
          disabled={busy}
        >
          {busy ? "Enviando…" : "Concluir e liberar conteúdo →"}
        </button>
      </div>
    </main>
  );
}
