import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function dataDir() {
  return process.env.DOBRO_DATA_DIR || path.join(process.cwd(), 'data');
}

export async function readJson(rel, fallback = null) {
  try {
    const raw = await fs.readFile(path.join(dataDir(), rel), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function writeJson(rel, data) {
  const full = path.join(dataDir(), rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, full);
}

const chains = new Map();
export function withLock(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn());
  chains.set(key, run.catch(() => {}));
  return run;
}
