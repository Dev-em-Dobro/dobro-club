/**
 * Cria (ou atualiza) um evento e imprime o link do gerador de ingresso.
 * Requer DATABASE_URL no .env / .env.local.
 *
 * Uso:
 *   node scripts/create-event.js --slug=imersao --name="Imersão Dev em Dobro"
 *   node scripts/create-event.js --slug=piloto --name="Semana ..." --mode=full
 *
 * `--mode=ticket-only` (padrão) = evento pago: só o gerador de ingresso, sem hub,
 * sem magic link e sem recuperação de acesso. `--mode=full` = evento completo.
 */
import crypto from "node:crypto";
import "./load-env.js";
import { query } from "../server/db.js";
import { hashApiKey } from "../server/events.js";

function arg(name, fallback = null) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const slug = arg("slug");
const name = arg("name", slug);
const mode = arg("mode", "ticket-only");
const apiKey = arg("key", `k-${crypto.randomBytes(8).toString("hex")}`);

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL ausente. Adicione a connection string do Neon no .env.local e rode de novo.",
  );
  process.exit(1);
}
if (!slug) {
  console.error('Faltou --slug. Ex.: node scripts/create-event.js --slug=imersao --name="Imersão"');
  process.exit(1);
}
if (mode !== "ticket-only" && mode !== "full") {
  console.error(`--mode inválido: "${mode}". Use ticket-only ou full.`);
  process.exit(1);
}

// A coluna é nova (modo do evento); garante-a antes de escrever.
await query("ALTER TABLE events ADD COLUMN IF NOT EXISTS mode text");

const { rows } = await query("SELECT id FROM events WHERE slug = $1", [slug]);
const id = rows[0]?.id || `evt_${crypto.randomBytes(6).toString("hex")}`;

if (rows[0]) {
  await query("UPDATE events SET name = $1, mode = $2, status = 'active' WHERE id = $3", [
    name,
    mode,
    id,
  ]);
  console.log(`Evento "${slug}" atualizado (id: ${id}, mode: ${mode}).`);
} else {
  await query(
    `INSERT INTO events (id, slug, name, status, api_key_hash, webhook_url, created_at, mode)
     VALUES ($1,$2,$3,'active',$4,NULL,$5,$6)`,
    [id, slug, name, hashApiKey(apiKey), new Date().toISOString(), mode],
  );
  console.log(`Evento "${slug}" criado (id: ${id}, mode: ${mode}).`);
  console.log(`API key (guarde — só aparece agora): ${apiKey}`);
}

const base =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.DOBRO_BASE_URL ||
  "http://localhost:3000";

console.log("");
console.log("Link do gerador de ingresso (é este que você divulga):");
console.log(`  ${base}/e/${slug}/ingresso`);

process.exit(0);
