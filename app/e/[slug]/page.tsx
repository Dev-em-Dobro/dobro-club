import { AuthProvider } from "@/components/AuthContext";
import EventHome from "@/components/EventHome";

export default function EventPage() {
  return (
    <AuthProvider>
      <EventHome />
    </AuthProvider>
  );
}
