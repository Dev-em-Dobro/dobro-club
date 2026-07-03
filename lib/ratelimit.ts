// Rate limiter fixed-window em memória, adequado a Route Handlers do Next
// (o express-rate-limit da 8.1 depende do Express e foi substituído aqui).
// Nota: memória por instância; para múltiplas instâncias, trocar por store
// compartilhado (ex.: Redis) — fora do escopo v1.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface Limiter {
  check(key: string): { ok: boolean; retryAfterMs: number };
}

export function makeLimiter({
  windowMs,
  max,
}: {
  windowMs: number;
  max: number;
}): Limiter {
  return {
    check(key: string) {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || now >= b.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterMs: 0 };
      }
      if (b.count >= max) {
        return { ok: false, retryAfterMs: b.resetAt - now };
      }
      b.count += 1;
      return { ok: true, retryAfterMs: 0 };
    },
  };
}

/** Extrai o IP do cliente de uma Request do Next (respeita X-Forwarded-For). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** Reseta o estado (usado em testes). */
export function resetLimitersForTests(): void {
  buckets.clear();
}
