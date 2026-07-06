"use client";

// Nunca travamos a navegação: todo item aponta direto para a sua página, que
// cuida do próprio estado (a de conteúdo guia o anônimo pelo Mestre; o feed é
// aberto a todos). Itens sem `href` ainda são placeholders desabilitados.
const NAV: Array<{ label: string; ico: string; href?: string }> = [
  { label: "Aulas", ico: "📜", href: "/evento/conteudo" },
  { label: "Comunidade", ico: "💬" },
  { label: "Feed", ico: "🗞️", href: "/evento/feed" },
  { label: "Ingresso", ico: "🎟️", href: "/meu-acesso" },
  { label: "Indicações", ico: "🤝" },
  { label: "Certificado", ico: "🏆" },
];

// Navegação persistente do evento: barra inferior no mobile, sidebar à esquerda
// no desktop (o CSS de `.event-nav` cuida da troca por largura).
export default function EventNav() {
  return (
    <nav className="event-nav" aria-label="Navegação do evento">
      {NAV.map(({ label, ico, href }) => {
        const target = href;
        return target ? (
          <a key={label} href={target}>
            <span className="ico" aria-hidden="true">
              {ico}
            </span>
            <span className="lbl">{label}</span>
          </a>
        ) : (
          <button key={label} type="button" disabled>
            <span className="ico" aria-hidden="true">
              {ico}
            </span>
            <span className="lbl">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
