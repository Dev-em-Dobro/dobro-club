"use client";

import { useEffect, useState } from "react";
import { RESULT_KEY } from "@/components/IngressoForm";

interface Ticket {
  imageUrl: string;
  qrValue: string;
  shareUrl: string;
}
interface IngressoResult {
  leadId: string;
  isNew: boolean;
  magicLink: string;
  ticket: Ticket;
}

export default function IngressoProntoPage() {
  const [result, setResult] = useState<IngressoResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESULT_KEY);
      if (raw) setResult(JSON.parse(raw) as IngressoResult);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — o link já está visível na tela */
    }
  }

  if (!loaded) {
    return <main className="loading">Preparando seu ingresso…</main>;
  }

  if (!result) {
    return (
      <main className="ticket-screen ticket-screen--center">
        <div className="scroll-card">
          <h1 className="scroll-title">Seu ingresso expirou desta sessão</h1>
          <p className="scroll-text">
            Gere novamente para ver seu acesso na tela.
          </p>
        </div>
        <a className="btn" href="/ingresso">
          Gerar ingresso
        </a>
      </main>
    );
  }

  return (
    <main className="ticket-screen ticket-screen--center">
      <header className="ticket-head">
        <p className="ticket-kicker px">
          <span className="twinkle">⟡</span> Ingresso gerado
        </p>
        <h1 className="ticket-title px">
          {result.isNew ? "Está pronto!" : "Bem-vindo(a) de volta!"}
        </h1>
      </header>

      <div className="ticket-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="sprite"
          src={result.ticket.imageUrl}
          alt="Seu ingresso do evento"
        />
      </div>

      <section className="magic-box">
        <p className="magic-label px">SEU LINK DE ACESSO</p>
        <p className="magic-hint">
          Guarde este link — é a sua entrada no evento, sem senha. Também enviamos
          por e-mail.
        </p>
        <div className="magic-link">
          <a href={result.magicLink}>{result.magicLink}</a>
        </div>
        <button type="button" className="btn magic-copy" onClick={copyLink}>
          {copied ? "Copiado! ✓" : "Copiar link"}
        </button>
      </section>

      <a className="btn ticket-enter" href={result.magicLink}>
        Entrar no evento →
      </a>
    </main>
  );
}
