"use client";

import { useState } from "react";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

export default function RecuperarLinkPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/e/${encodeURIComponent(DEFAULT_SLUG)}/ingresso/recuperar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        },
      );
      const data = await res.json().catch(() => ({}));
      // Resposta neutra: nunca revela se o e-mail existe (FR-018).
      setMessage(
        data.message ||
          "Se este e-mail estiver cadastrado, enviamos o link de acesso.",
      );
    } catch {
      setMessage(
        "Se este e-mail estiver cadastrado, enviamos o link de acesso.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ticket-screen ticket-screen--center">
      <header className="ticket-head">
        <p className="ticket-kicker px">
          <span className="twinkle">⟡</span> Perdeu o acesso?
        </p>
        <h1 className="ticket-title px">Recuperar meu link</h1>
        <p className="ticket-sub">
          Informe seu e-mail e reenviamos seu link de acesso.
        </p>
      </header>

      {message ? (
        <div className="scroll-card">
          <h1 className="scroll-title">Verifique seu e-mail</h1>
          <p className="scroll-text">{message}</p>
        </div>
      ) : (
        <form className="ticket-form" onSubmit={onSubmit} noValidate>
          <label className="tf-field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>
          <button type="submit" className="btn tf-submit" disabled={submitting}>
            {submitting ? "Enviando…" : "Reenviar meu link"}
          </button>
          <p className="tf-recover">
            Ainda não tem ingresso? <a href="/ingresso">Gerar agora</a>
          </p>
        </form>
      )}
    </main>
  );
}
