"use client";

import { useAuth } from "./AuthContext";
import { useGamificacao } from "./useGamificacao";
import EventNav from "./EventNav";

export default function EventHome() {
  const { loading, lead } = useAuth();
  // Sem sessão o progresso não existe: o fetch fica desligado e o banner
  // aparece "apagado" como convite a entrar.
  const { data } = useGamificacao(!!lead);
  if (loading) return <main className="loading">Entrando…</main>;

  const streak = data?.streak.current ?? 0;

  return (
    <div className="event-shell">
      <header className="hud">
        <div className="hud-text">
          <p className="hud-hello">
            Olá, <b>{lead?.name || "aventureiro(a)"}</b>
          </p>
          <p className="hud-sub">
            Bem-vindo(a) à sua jornada <span className="twinkle">⟡</span>
          </p>
        </div>
        <a
          className={`streak-chip${lead ? "" : " streak-chip-off"}`}
          href={lead ? "/evento/gamificacao" : "/recuperar-ingresso"}
          aria-label={
            lead ? `Sequência de ${streak} dia(s)` : "Entre para começar sua sequência"
          }
          title={lead ? "Ver meu progresso" : "Entre para começar sua sequência"}
        >
          <span className="streak-chip-flame" aria-hidden>🔥</span>
          <span className="streak-chip-count">{streak}</span>
        </a>
      </header>

      <main className="event-content">

        <section className="window">
          <div className="window-bar">
            <span>EVENTO</span>
            <span className="window-dots">
              <i></i>
              <i></i>
              <i></i>
            </span>
          </div>
          <div className="window-body">
            <div>
              <h2 className="px">Sua jornada começa aqui</h2>
              <p>
                Em breve suas aulas, missões e recompensas aparecem neste salão.
              </p>
            </div>
          </div>
        </section>
      </main>

      <EventNav />
    </div>
  );
}
