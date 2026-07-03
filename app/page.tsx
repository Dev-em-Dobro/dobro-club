import { AuthProvider } from "@/components/AuthContext";
import EventHome from "@/components/EventHome";

export default function Home() {
  return (
    <AuthProvider>
      <EventHome />
    </AuthProvider>
  );
}
