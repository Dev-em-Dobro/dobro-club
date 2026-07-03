import { AuthProvider } from "@/components/AuthContext";
import EventoHub from "@/components/EventoHub";

export default function EventoPage() {
  return (
    <AuthProvider>
      <EventoHub />
    </AuthProvider>
  );
}
