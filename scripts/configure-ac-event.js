/**
 * Configura o evento para onboarding via ActiveCampaign (Story 8.15).
 * Requer DATABASE_URL no .env ou .env.local.
 *
 * Uso:
 *   node scripts/configure-ac-event.js
 *   DOBRO_EVENT_API_KEY=minha-chave node scripts/configure-ac-event.js
 */
import "./load-env.js";
import { query, initSchema } from "../server/db.js";
import { hashApiKey } from "../server/events.js";

const slug = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";
const apiKey = process.env.DOBRO_EVENT_API_KEY || "ac-piloto-dobro-2026";
const hash = hashApiKey(apiKey);

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL ausente. Adicione a connection string do Neon no .env.local e rode de novo.",
  );
  process.exit(1);
}

await initSchema();

const { rows } = await query("SELECT id FROM events WHERE slug = $1", [slug]);

if (rows[0]) {
  await query(
    `UPDATE events
     SET api_key_hash = $1, onboarding_channel = 'active-campaign'
     WHERE slug = $2`,
    [hash, slug],
  );
  console.log(`Evento "${slug}" atualizado (id: ${rows[0].id}).`);
} else {
  await query(
    `INSERT INTO events (id, slug, name, status, api_key_hash, webhook_url, created_at, onboarding_channel)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      "evt_demo",
      slug,
      "Semana do Zero ao Programador Contratado",
      "active",
      hash,
      null,
      new Date().toISOString(),
      "active-campaign",
    ],
  );
  console.log(`Evento "${slug}" criado.`);
}

console.log("");
console.log("Guarde esta API key — use na automação da AC (?key=... ou X-Api-Key):");
console.log(`  ${apiKey}`);
console.log("");
console.log("URL do webhook (Modo A — ação Webhook nativa da AC):");
const base =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.DOBRO_BASE_URL ||
  "http://localhost:3000";
console.log(`  ${base}/api/e/${slug}/onboarding-ac?key=${apiKey}`);

process.exit(0);
