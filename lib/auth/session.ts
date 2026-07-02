import crypto from "node:crypto";

export interface SessionPayload {
  leadId: string;
  eventId: string;
}

function secret(): string {
  return process.env.DOBRO_SESSION_SECRET || "dev-secret-change-me";
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto
    .createHmac("sha256", secret())
    .update(body)
    .digest("base64url");
  return `${body}.${mac}`;
}

export function verifySession(value: unknown): SessionPayload | null {
  if (!value || typeof value !== "string") return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
  } catch {
    return null;
  }
}

/** Nome do cookie de sessão (mesmo da 8.1). */
export const COOKIE = "dc_session";
export const COOKIE_MAX_AGE = 180 * 24 * 60 * 60 * 1000; // 180 dias
