// Integração de saída com o ActiveCampaign (onboarding 8.15 — Opção 2).
// A plataforma grava o magic link num custom field do contato via API. É a
// ÚNICA escrita de volta na AC: nenhuma tag/score é gravada (revisão consciente
// e limitada do FR-009 "mão-única" da 8.15). Best-effort, no mesmo espírito do
// lib/webhook.ts: no-op silencioso quando a integração não está configurada.

export interface ACSyncResult {
  sent: boolean;
  reason?: string;
}

async function postWithRetry(
  url: string,
  payload: unknown,
  headers: Record<string, string>,
): Promise<ACSyncResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (res.ok) return { sent: true };
    } catch {
      // tenta de novo uma vez
    } finally {
      clearTimeout(timer);
    }
  }
  return { sent: false, reason: "failed" };
}

/**
 * Grava o `magicLink` no custom field do contato no ActiveCampaign, via
 * `POST /api/3/contact/sync` — que faz upsert do contato por e-mail e grava o
 * campo numa única chamada idempotente. Chamável em toda ingestão: o link nunca
 * muda para o mesmo lead, então re-gravar é inócuo e auto-cura falhas anteriores.
 *
 * No-op (best-effort) se `AC_API_URL`/`AC_API_TOKEN`/`AC_MAGIC_LINK_FIELD_ID`
 * não estiverem setados, ou se o lead não tiver e-mail (identidade canônica).
 */
export async function syncMagicLinkToAC(
  email: string | null | undefined,
  magicLink: string,
): Promise<ACSyncResult> {
  const base = (process.env.AC_API_URL || "").replace(/\/+$/, "");
  const token = process.env.AC_API_TOKEN;
  const fieldId = process.env.AC_MAGIC_LINK_FIELD_ID;
  if (!base || !token || !fieldId)
    return { sent: false, reason: "ac-not-configured" };
  if (!email) return { sent: false, reason: "no-email" };

  return postWithRetry(
    `${base}/api/3/contact/sync`,
    { contact: { email, fieldValues: [{ field: fieldId, value: magicLink }] } },
    { "Api-Token": token },
  );
}
