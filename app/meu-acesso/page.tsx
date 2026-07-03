import { AuthProvider } from "@/components/AuthContext";
import MeuAcesso from "@/components/MeuAcesso";

export default function MeuAcessoPage() {
  return (
    <AuthProvider>
      <MeuAcesso />
    </AuthProvider>
  );
}
