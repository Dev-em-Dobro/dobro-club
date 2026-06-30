import crypto from 'node:crypto';

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function buildMagicLink(token) {
  const base = process.env.DOBRO_BASE_URL || 'http://localhost:3001';
  return `${base}/entrar/${token}`;
}
