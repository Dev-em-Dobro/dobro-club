"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

interface Ticket {
  imageUrl: string;
  qrValue: string;
  shareUrl: string;
}

interface EventoState {
  lead: { id: string; name: string | null; eventId: string };
  phase: "provisoria" | "oficial";
  ticket: Ticket;
  windowOpensAt: string | null;
  surveyAnswered: boolean;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export default function EventoHub() {
  const { loading: authLoading, lead } = useAuth();
  const [data, setData] = useState<EventoState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    fetch("/api/evento", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && (setData(d), setLoading(false)))
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authLoading]);

  if (authLoading || loading) return <main className="loading">Carregando…</main>;

  // Sem sessão válida: encaminha para a recuperação (mesmo padrão do MeuAcesso).
  if (!lead || !data) {
    return (
      <main className="ticket-screen ticket-screen--center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sprite scroll-mage" src="/sprites/happy-mage.png" alt="" />
        <div className="scroll-card">
          <h1 className="scroll-title">Precisa entrar primeiro</h1>
          <p className="scroll-text">
            Recupere seu link de acesso pelo telefone para continuar.
          </p>
          <a className="btn scroll-cta" href="/recuperar-ingresso">
            Recuperar meu link →
          </a>
        </div>
      </main>
    );
  }

  const isProvisoria = data.phase === "provisoria";
  const dias = daysUntil(data.windowOpensAt);
  const firstName = data.lead.name?.split(" ")[0];

  return (
    <main className="ticket-screen ticket-screen--center">
      <div className="scroll-card">
        <h1 className="scroll-title">
          {firstName ? `${firstName}, ` : ""}
          {isProvisoria ? "você já está dentro" : "seu ingresso está liberado"}
        </h1>

        {/* Credencial provisória (pré-evento) OU ingresso oficial — mesma imagem
            derivada da 8.3; a distinção é o selo/estado (US1/US2). */}
        <figure className="ticket-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ticket-image"
            src={data.ticket.imageUrl}
            alt={isProvisoria ? "Credencial provisória" : "Ingresso do evento"}
          />
          <figcaption className={`ticket-badge ticket-badge--${data.phase}`}>
            {isProvisoria ? "Credencial provisória" : "Ingresso oficial"}
          </figcaption>
        </figure>

        {isProvisoria ? (
          <p className="scroll-text">
            {dias === null
              ? "Seu ingresso oficial é liberado poucos dias antes do evento começar."
              : dias === 0
                ? "Seu ingresso oficial é liberado hoje!"
                : `Seu ingresso oficial libera em ${dias} ${dias === 1 ? "dia" : "dias"}.`}
          </p>
        ) : (
          <p className="scroll-text">
            Seu ingresso está pronto — baixe e compartilhe com quem você quer
            trazer para o evento.
          </p>
        )}

        {/* Gate da pesquisa (US3): conteúdo bloqueado até responder. */}
        {data.surveyAnswered ? (
          <a className="btn scroll-cta" href="/evento/conteudo">
            Ir para o conteúdo →
          </a>
        ) : (
          <div className="hub-gate" aria-live="polite">
            <p className="scroll-hint">
              🔒 Responda a pesquisa rápida para liberar as aulas e os presentes.
            </p>
            <a
              className="btn scroll-cta"
              href="/evento/pesquisa?next=/evento/conteudo"
            >
              Responder pesquisa →
            </a>
          </div>
        )}
      </div>

      <a className="tf-recover" href={`/e/${EVENT_SLUG}`}>
        ← Voltar
      </a>
    </main>
  );
}
