"use client";

/**
 * Feed do evento — placeholder. Estrutura as três seções planejadas:
 *  1. Novo conteúdo liberado (montado como placeholder navegável).
 *  2. Ranking / mural de streaks (stub "em breve").
 *  3. Missão do dia (stub "em breve").
 * Quando virar story própria, cada seção passa a consumir sua fonte de dados.
 */
export default function FeedMural() {
  return (
    <main className="content-screen">
      <header className="content-head">
        <h1 className="content-title">Feed</h1>
        <a className="tf-recover" href="/evento">
          ← Voltar ao hub
        </a>
      </header>

      {/* 1. Novo conteúdo liberado — card já montado (placeholder). */}
      <section className="content-section">
        <h2 className="content-section-title">Novidades</h2>
        <ul className="content-list">
          <li className="content-item">
            <div className="content-item-head">
              <span className="content-item-title">
                📜 Novo conteúdo liberado
                <span className="badge-gift">NOVO</span>
              </span>
              <a className="btn content-open" href="/evento/conteudo">
                Ver agora →
              </a>
            </div>
            <p className="content-item-desc">
              Uma nova aula acaba de abrir na sua jornada. (Placeholder — em
              breve este card é gerado quando o nivelamento liberar o próximo
              conteúdo.)
            </p>
          </li>
        </ul>
      </section>

      {/* 2. Ranking / mural de streaks — stub. */}
      <section className="content-section">
        <h2 className="content-section-title">🔥 Maiores sequências</h2>
        <ul className="content-list">
          <li className="content-item">
            <p className="content-item-desc">
              Em breve: o mural com as maiores sequências da semana para você
              comparar seu ritmo com o da comunidade.
            </p>
          </li>
        </ul>
      </section>

      {/* 3. Missão do dia — stub. */}
      <section className="content-section">
        <h2 className="content-section-title">🎯 Missão do dia</h2>
        <ul className="content-list">
          <li className="content-item">
            <p className="content-item-desc">
              Em breve: uma ação curta a cada dia para manter sua sequência viva
              e ganhar pontos de engajamento.
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}
