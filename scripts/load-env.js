/**
 * Carrega .env.local (prioridade) e depois .env — para scripts Node fora do Next.
 */
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  const path = resolve(root, file);
  if (existsSync(path)) dotenv.config({ path });
}
