/** @type {import('next').NextConfig} */
const nextConfig = {
  // Durante a migração, o app Next só enxerga `app/` e `lib/`; `server/`,
  // `dashboard/` e `scripts/` legados seguem existindo até o cutover.
  reactStrictMode: true,
  // pg-mem é usado só no fallback de dev (sem DATABASE_URL); mantê-lo externo
  // evita que o webpack tente empacotá-lo (e falhe) no server bundle.
  serverExternalPackages: ["pg-mem"],

  /**
   * `ingresso.devemdobro.com` é o domínio do gerador: a raiz dele serve o Mestre
   * do Evento (`/ingresso`) sem redirect, então a URL divulgada continua limpa.
   * Precisa ser `beforeFiles` — a raiz casa com `app/page.tsx` (o hub), e as
   * demais fases de rewrite só rodam depois da checagem de filesystem, quando
   * a home já teria respondido. Só a raiz é reescrita: todo o resto do app
   * (`/api/*`, `/e/<slug>/ingresso`, magic links) segue igual nesse host.
   */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "ingresso.devemdobro.com" }],
          destination: "/ingresso",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
