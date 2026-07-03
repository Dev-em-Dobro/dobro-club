"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "lesson" | "doc" | "codequest";

interface Item {
  id: string;
  kind: Kind;
  title: string;
  description: string | null;
  isGift: boolean;
  releaseAt: string | null;
  available: boolean;
}

interface ConteudoState {
  authenticated: boolean;
  surveyAnswered: boolean;
  items: Item[];
}

const SELF = "/evento/conteudo";
const SECTIONS: { kind: Kind; title: string; empty: string }[] = [
  { kind: "lesson", title: "Aulas de nivelamento", empty: "Aulas em breve." },
  { kind: "doc", title: "Materiais e presentes", empty: "Materiais em breve." },
  { kind: "codequest", title: "CodeQuest", empty: "Acesso em breve." },
];

function releaseLabel(iso: string | null): string {
  if (!iso) return "Em breve";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Em breve";
  return `Libera em ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

export default function ConteudoDia1() {
  const router = useRouter();
  const [data, setData] = useState<ConteudoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [embed, setEmbed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/evento/conteudo", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && (setData(d), setLoading(false)))
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Item liberado: abre (embed/nova aba). Item travado: manda pro portão certo,
  // preservando a intenção (Mestre → pesquisa → volta pro conteúdo).
  async function act(item: Item) {
    if (!data) return;
    if (!item.available) {
      if (!data.authenticated) {
        router.push(
          `/evento/mestre?next=${encodeURIComponent(SELF)}&quero=${encodeURIComponent(item.title)}`,
        );
      } else if (!data.surveyAnswered) {
        router.push(`/evento/pesquisa?next=${encodeURIComponent(SELF)}`);
      }
      return;
    }
    if (busy) return;
    setBusy(item.id);
    try {
      const r = await fetch(`/api/evento/conteudo/${item.id}/abrir`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) return;
      const { resource } = await r.json();
      if (!resource) return;
      if (item.kind === "lesson") {
        setEmbed((e) => ({ ...e, [item.id]: resource }));
      } else {
        window.open(resource, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(null);
    }
  }

  function ctaLabel(item: Item): string {
    if (item.available) {
      return item.kind === "lesson"
        ? "Assistir"
        : item.kind === "codequest"
          ? "Abrir CodeQuest ↗"
          : "Abrir ↗";
    }
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
        <h1 className="content-title">Conteúdo do evento</h1>
        <a className="tf-recover" href="/evento">
          ← Voltar ao hub
        </a>
      </header>

      {locked && (
        <p className="content-lock-note">
          🔒 Passe pelo Mestre do Evento e responda a pesquisa rápida para liberar
          aulas, materiais e o CodeQuest.
        </p>
      )}

      {SECTIONS.map(({ kind, title, empty }) => {
        const items = data.items.filter((i) => i.kind === kind);
        return (
          <section key={kind} className="content-section">
            <h2 className="content-section-title">{title}</h2>
            {items.length === 0 ? (
              <p className="content-empty">{empty}</p>
            ) : (
              <ul className="content-list">
                {items.map((item) => {
                  const futureLocked =
                    !item.available && data.authenticated && data.surveyAnswered;
                  return (
                    <li key={item.id} className="content-item">
                      <div className="content-item-head">
                        <span className="content-item-title">
                          {item.title}
                          {item.isGift && <span className="badge-gift">🎁 presente</span>}
                        </span>
                        {futureLocked ? (
                          <span className="content-locked">
                            🔒 {releaseLabel(item.releaseAt)}
                          </span>
                        ) : (
                          <button
                            className="btn content-open"
                            disabled={busy === item.id}
                            onClick={() => act(item)}
                          >
                            {ctaLabel(item)}
                          </button>
                        )}
                      </div>
                      {item.description && (
                        <p className="content-item-desc">{item.description}</p>
                      )}
                      {embed[item.id] && (
                        <div className="content-embed">
                          <iframe
                            src={embed[item.id]}
                            title={item.title}
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
        );
      })}
    </main>
  );
}
