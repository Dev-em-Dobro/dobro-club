"use client";

import { useEffect, useState } from "react";

interface Badge {
  id: string;
  name: string;
  description: string;
  criterion: string;
  earned: boolean;
}

interface GamificacaoState {
  streak: { current: number; longest: number };
  badges: Badge[];
}

export default function GamificacaoPainel() {
  const [data, setData] = useState<GamificacaoState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/evento/gamificacao", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && (setData(d), setLoading(false)))
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <main className="loading">Carregando…</main>;
  if (!data) return <main className="loading">Não foi possível carregar.</main>;

  const { current, longest } = data.streak;

  return (
    <main className="content-screen">
      <header className="content-head">
        <h1 className="content-title">Meu progresso</h1>
        <a className="tf-recover" href="/evento">
          ← Voltar ao hub
        </a>
      </header>

      <section className="content-section">
        <div className="streak-hero">
          <span className="streak-flame" aria-hidden>🔥</span>
          <span className="streak-count">{current}</span>
          <span className="streak-label">
            {current === 0
              ? "Comece hoje sua sequência!"
              : current === 1
                ? "dia seguido — volte amanhã!"
                : "dias seguidos"}
          </span>
          {longest > 0 && (
            <span className="streak-best">Melhor sequência: {longest}</span>
          )}
        </div>
      </section>

      <section className="content-section">
        <h2 className="content-section-title">Conquistas</h2>
        <ul className="badge-grid">
          {data.badges.map((b) => (
            <li
              key={b.id}
              className={`badge-item${b.earned ? " badge-earned" : " badge-locked"}`}
            >
              <span className="badge-icon" aria-hidden>{b.earned ? "🏅" : "🔒"}</span>
              <span className="badge-name">{b.name}</span>
              <span className="badge-desc">{b.earned ? b.description : b.criterion}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
