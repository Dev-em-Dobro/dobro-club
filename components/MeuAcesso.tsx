"use client";

import { useAuth } from "./AuthContext";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

export default function MeuAcesso() {
  const { loading, lead } = useAuth();

  if (loading) return <main className="loading">Carregando…</main>;

  // Sem sessão válida: encaminha para a recuperação por telefone.
  if (!lead?.magicLink) {
    return (
      <main className="ticket-screen ticket-screen--center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sprite scroll-mage" src="/sprites/happy-mage.png" alt="" />
        <div className="scroll-card">
          <h1 className="scroll-title">Precisa entrar primeiro</h1>
          <p className="scroll-text">
            Recupere seu link de acesso pelo telefone para continuar.
          </p>
          <a className="btn scroll-cta" href="/recuperar-link">
            Recuperar meu link →
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="ticket-screen ticket-screen--center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sprite scroll-mage" src="/sprites/happy-mage.png" alt="" />
      <div className="scroll-card">
        <h1 className="scroll-title">Seu link de acesso</h1>
        <p className="scroll-text">
          {lead.name ? `${lead.name}, guarde` : "Guarde"} este link — é o seu
          acesso pessoal ao evento.
        </p>
        <a className="btn scroll-cta" href={lead.magicLink}>
          Entrar no evento →
        </a>
        <p className="scroll-hint">
          Esqueceu? Recupere pelo telefone em{" "}
          <a href="/recuperar-link">recuperar acesso</a>.
        </p>
      </div>
      <a className="tf-recover" href={`/e/${EVENT_SLUG}`}>
        ← Voltar
      </a>
    </main>
  );
}
