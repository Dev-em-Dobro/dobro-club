"use client";

import { useState } from "react";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";
const onlyDigits = (v: string) => v.replace(/\D/g, "");
const isValidPhone = (v: string) => /^\d{12,13}$/.test(v);

interface Access {
  name: string | null;
  magicLink: string;
}

export default function RecuperarLinkPage() {
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = onlyDigits(phone);
    if (!isValidPhone(digits)) {
      setError("Use DDI + DDD + número (só números). Ex.: 5584991153472");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/e/${encodeURIComponent(DEFAULT_SLUG)}/ingresso/acessar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: digits }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.magicLink) {
        setAccess({ name: data.name ?? null, magicLink: data.magicLink });
      } else {
        setError(
          data.message ||
            data.error ||
            "Não encontramos um ingresso com esse telefone.",
        );
      }
    } catch {
      setError("Falha de conexão. Tente novamente em instantes.");
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
          Informe o telefone que você usou para gerar o ingresso.
        </p>
      </header>

      {access ? (
        <div className="scroll-card">
          <h1 className="scroll-title">
            {access.name
              ? `Boas-vindas de volta, ${access.name}!`
              : "Achamos seu acesso!"}
          </h1>
          <p className="scroll-text">Aqui está o seu link para acessar o evento:</p>
          <a className="btn scroll-cta" href={access.magicLink}>
            Entrar no evento →
          </a>
          <p className="scroll-hint">
            Guarde este link — ele é o seu acesso pessoal.
          </p>
        </div>
      ) : (
        <form className="ticket-form" onSubmit={onSubmit} noValidate>
          <label className="tf-field">
            <span>Telefone (DDI + DDD + número)</span>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5584991153472"
              autoComplete="tel"
              required
            />
          </label>
          {error && <p className="tf-error">{error}</p>}
          <button type="submit" className="btn tf-submit" disabled={submitting}>
            {submitting ? "Buscando…" : "Recuperar meu link"}
          </button>
          <p className="tf-recover">
            Ainda não tem ingresso? <a href="/ingresso">Gerar agora</a>
          </p>
        </form>
      )}
    </main>
  );
}
