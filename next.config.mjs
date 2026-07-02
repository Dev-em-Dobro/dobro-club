/** @type {import('next').NextConfig} */
const nextConfig = {
  // Durante a migração, o app Next só enxerga `app/` e `lib/`; `server/`,
  // `dashboard/` e `scripts/` legados seguem existindo até o cutover.
  reactStrictMode: true,
};

export default nextConfig;
