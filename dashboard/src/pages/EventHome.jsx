import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NAV = ['Aulas', 'Comunidade', 'Feed', 'Ingresso', 'Indicações', 'Certificado'];

export default function EventHome() {
  const { loading, lead } = useAuth();
  if (loading) return <main className="screen"><p>Entrando…</p></main>;
  if (!lead) return <Navigate to="/link-invalido" replace />;
  return (
    <div className="event-shell">
      <header className="event-header">Olá, {lead.name || 'participante'} 👋</header>
      <main className="event-content"><p>Seu evento aparece aqui.</p></main>
      <nav className="bottom-nav" aria-label="Navegação do evento" aria-hidden="true">
        {NAV.map((item) => (
          <button key={item} type="button" disabled>{item}</button>
        ))}
      </nav>
    </div>
  );
}
