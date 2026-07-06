import { AuthProvider } from "@/components/AuthContext";
import EventNav from "@/components/EventNav";

// Envolve todas as rotas /evento/* com a sessão (AuthProvider) e a navegação
// persistente. As páginas filhas não precisam mais montar o próprio provider.
export default function EventoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="event-viewport">
        {children}
        <EventNav />
      </div>
    </AuthProvider>
  );
}
