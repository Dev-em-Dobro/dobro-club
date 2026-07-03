import crypto from "node:crypto";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function buildMagicLink(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.DOBRO_BASE_URL ||
    "http://localhost:3000";
  return `${base}/entrar/${token}`;
}
