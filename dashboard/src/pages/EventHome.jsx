import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NAV = [
  { label: 'Aulas', ico: '📜' },
  { label: 'Comunidade', ico: '💬' },
  { label: 'Feed', ico: '🗞️' },
  { label: 'Ingresso', ico: '🎟️' },
  { label: 'Indicações', ico: '🤝' },
  { label: 'Certificado', ico: '🏆' }
];

export default function EventHome() {
  const { loading, lead } = useAuth();
  if (loading) return <main className="loading">Entrando…</main>;

  return (
    <div className="event-shell">
      <header className="hud">
        <div className="hud-text">
          <p className="hud-hello">Olá, <b>{lead?.name || 'aventureiro(a)'}</b></p>
          <p className="hud-sub">Bem-vindo(a) à sua jornada <span className="twinkle">⟡</span></p>
        </div>
      </header>

      <main className="event-content">
        <section className="window">
          <div className="window-bar">
            <span>EVENTO</span>
            <span className="window-dots"><i></i><i></i><i></i></span>
          </div>
          <div className="window-body">
            <div>
              <h2 className="px">Sua jornada começa aqui</h2>
              <p>Em breve suas aulas, missões e recompensas aparecem neste salão.</p>
            </div>
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Navegação do evento" aria-hidden="true">
        {NAV.map(({ label, ico }) => (
          <button key={label} type="button" disabled>
            <span className="ico" aria-hidden="true">{ico}</span>
            <span className="lbl">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
