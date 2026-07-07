// Integração de saída com o ActiveCampaign (onboarding 8.15 — Opção 2).
// A plataforma grava o magic link num custom field do contato e, se configurada,
// aplica a tag que dispara a automação de onboarding. Best-effort, no mesmo
// espírito do lib/webhook.ts: no-op silencioso quando a integração não está
// configurada.

export interface ACSyncResult {
  sent: boolean;
  reason?: string;
}

interface ACPostResult<T> {
  ok: boolean;
  body?: T;
}

async function acPost<T = unknown>(
  url: string,
  payload: unknown,
  token: string,
): Promise<ACPostResult<T>> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "Api-Token": token },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (res.ok) {
        let body: T | undefined;
        try {
          body = (await res.json()) as T;
        } catch {
          // corpo vazio/sem JSON — segue com body indefinido
        }
        return { ok: true, body };
      }
    } catch {
      // tenta de novo uma vez
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false };
}

/**
 * Grava o `magicLink` no custom field do contato no ActiveCampaign, via
 * `POST /api/3/contact/sync` — que faz upsert do contato por e-mail e grava o
 * campo numa única chamada idempotente. Chamável em toda ingestão: o link nunca
 * muda para o mesmo lead, então re-gravar é inócuo e auto-cura falhas anteriores.
 *
 * Se `AC_ONBOARDING_TAG_ID` estiver setado, na sequência aplica essa tag ao
 * contato (`POST /api/3/contactTags`) — é ela que dispara a automação de
 * onboarding. A ORDEM importa: o campo do link é gravado ANTES, então quando o
 * gatilho "tag adicionada" ler %MAGIC_LINK%, o valor já está lá. Re-aplicar a
 * tag é inócuo: a AC não re-dispara o gatilho para uma tag que o contato já tem.
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
  const tagId = process.env.AC_ONBOARDING_TAG_ID;
  if (!base || !token || !fieldId)
    return { sent: false, reason: "ac-not-configured" };
  if (!email) return { sent: false, reason: "no-email" };

  const sync = await acPost<{ contact?: { id?: string | number } }>(
    `${base}/api/3/contact/sync`,
    { contact: { email, fieldValues: [{ field: fieldId, value: magicLink }] } },
    token,
  );
  if (!sync.ok) return { sent: false, reason: "failed" };

  // Sem tag configurada, o comportamento é o de sempre: só a gravação do link.
  if (!tagId) return { sent: true };

  const contactId = sync.body?.contact?.id;
  if (!contactId) return { sent: false, reason: "no-contact-id" };

  const tag = await acPost(
    `${base}/api/3/contactTags`,
    { contactTag: { contact: String(contactId), tag: tagId } },
    token,
  );
  if (!tag.ok) return { sent: false, reason: "tag-failed" };

  return { sent: true };
}
