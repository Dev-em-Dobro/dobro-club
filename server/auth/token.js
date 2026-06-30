import crypto from 'node:crypto';
import { readJson, writeJson, withLock } from '../data/store.js';

const INDEX = 'tokens/index.json';

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function buildMagicLink(token) {
  const base = process.env.DOBRO_BASE_URL || 'http://localhost:3001';
  return `${base}/entrar/${token}`;
}

export async function addToken(token, ref) {
  return withLock(INDEX, async () => {
    const idx = await readJson(INDEX, {});
    idx[token] = ref;
    await writeJson(INDEX, idx);
  });
}

export async function lookupToken(token) {
  const idx = await readJson(INDEX, {});
  return idx[token] || null;
}
