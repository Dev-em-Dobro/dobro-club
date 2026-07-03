/** @type {import('next').NextConfig} */
const nextConfig = {
  // Durante a migração, o app Next só enxerga `app/` e `lib/`; `server/`,
  // `dashboard/` e `scripts/` legados seguem existindo até o cutover.
  reactStrictMode: true,
  // pg-mem é usado só no fallback de dev (sem DATABASE_URL); mantê-lo externo
  // evita que o webpack tente empacotá-lo (e falhe) no server bundle.
  serverExternalPackages: ["pg-mem"],
};

export default nextConfig;
