"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LiveState = "scheduled" | "live" | "recording" | "ended";

interface LiveItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  durationMin: number | null;
  state: LiveState;
  watchable: boolean;
  hasRecording: boolean;
}

interface LivesState {
  authenticated: boolean;
  surveyAnswered: boolean;
  lives: LiveItem[];
}

const SELF = "/evento/lives";

function whenLabel(iso: string | null): string {
  if (!iso) return "Em breve";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Em breve";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rótulo do estado (não-assistível) exibido no lugar do botão. */
function stateLabel(live: LiveItem): string {
  if (live.state === "scheduled") return `🕒 Em breve · ${whenLabel(live.startsAt)}`;
  return "⏹ Encerrada";
}

export default function LivesAquecimento() {
  const router = useRouter();
  const [data, setData] = useState<LivesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [embed, setEmbed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/evento/lives", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && (setData(d), setLoading(false)))
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function act(live: LiveItem) {
    if (!data) return;
    if (!live.watchable) {
      // Estado assistível mas sem gate/sessão ⇒ manda pro portão certo.
      if ((live.state === "live" || live.state === "recording")) {
        if (!data.authenticated) {
          router.push(
            `/evento/mestre?next=${encodeURIComponent(SELF)}&quero=${encodeURIComponent(live.title)}`,
          );
        } else if (!data.surveyAnswered) {
          router.push(`/evento/pesquisa?next=${encodeURIComponent(SELF)}`);
        }
      }
      return;
    }
    if (busy) return;
    setBusy(live.id);
    try {
      const r = await fetch(`/api/evento/lives/${live.id}/abrir`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) return;
      const { resource } = await r.json();
      if (resource) setEmbed((e) => ({ ...e, [live.id]: resource }));
    } finally {
      setBusy(null);
    }
  }

  function ctaLabel(live: LiveItem): string {
    if (live.watchable) {
      return live.state === "live" ? "🔴 Entrar ao vivo" : "▶️ Ver gravação";
    }
    // Estado assistível, mas bloqueado por gate/sessão.
    if (!data?.authenticated) return "Passar pelo Mestre 🔒";
    if (!data?.surveyAnswered) return "Responder pesquisa 🔒";
    return "";
  }

  if (loading) return <main className="loading">Carregando…</main>;
  if (!data) return <main className="loading">Não foi possível carregar.</main>;

  const locked = !data.authenticated || !data.surveyAnswered;

  return (
    <main className="content-screen">
      <header className="content-head">
        <h1 className="content-title">Lives de aquecimento</h1>
        <nav className="content-nav">
          <a className="tf-recover" href="/evento/conteudo">
            📜 Aulas e nivelamento →
          </a>
          <a className="tf-recover" href="/evento">
            ← Voltar ao hub
          </a>
        </nav>
      </header>

      {locked && (
        <p className="content-lock-note">
          🔒 Passe pelo Mestre do Evento e responda a pesquisa rápida para entrar
          nas lives ao vivo e ver as gravações.
        </p>
      )}

      <section className="content-section">
        {data.lives.length === 0 ? (
          <p className="content-empty">Agenda de lives em breve.</p>
        ) : (
          <ul className="content-list">
            {data.lives.map((live) => {
              // Live em estado não assistível (em breve / encerrada): mostra rótulo.
              const showState =
                !live.watchable && live.state !== "live" && live.state !== "recording";
              return (
                <li key={live.id} className="content-item">
                  <div className="content-item-head">
                    <span className="content-item-title">{live.title}</span>
                    {showState ? (
                      <span className="content-locked">{stateLabel(live)}</span>
                    ) : (
                      <button
                        className="btn content-open"
                        disabled={busy === live.id}
                        onClick={() => act(live)}
                      >
                        {ctaLabel(live)}
                      </button>
                    )}
                  </div>
                  {live.description && (
                    <p className="content-item-desc">{live.description}</p>
                  )}
                  {embed[live.id] && (
                    <div className="content-embed">
                      <iframe
                        src={embed[live.id]}
                        title={live.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
