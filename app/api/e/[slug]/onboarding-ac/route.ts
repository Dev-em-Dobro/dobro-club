import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug, verifyApiKey } from "@/lib/events";
import { validateLeadInput } from "@/lib/validate";
import { createOrGetLead } from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";
import { syncMagicLinkToAC } from "@/lib/activecampaign";

// Ingestão vinda da ação "Webhook" nativa do ActiveCampaign (onboarding 8.15).
// Diferente da rota da 8.1 (/events/:id/leads, JSON + header X-Api-Key), o
// webhook do AC manda o corpo form-urlencoded e NÃO permite header customizado.
// Por isso aqui: auth por ?key= (o api_key do evento) e corpo lido como form.
// Fluxo: valida a key → cria/recupera o lead → grava o magic link de volta no
// contato do AC (que a automação de onboarding lê via %MAGIC_LINK%).

/** Lê os campos do contato do corpo do AC (form-encoded) ou de um JSON, tolerante a variações de nome. */
async function readContactFields(
  req: NextRequest,
): Promise<{ name: string; email: string; phone: string }> {
  const obj: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      Object.assign(obj, (await req.json()) as Record<string, unknown>);
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries())
        obj[k] = typeof v === "string" ? v : "";
    }
  } catch {
    // corpo vazio/ilegível → a validação reprova adiante
  }

  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  const first = pick("contact[first_name]", "first_name", "firstName");
  const last = pick("contact[last_name]", "last_name", "lastName");
  const name = pick("contact[name]", "name") || `${first} ${last}`.trim();
  const email = pick("contact[email]", "email");
  const phone = pick("contact[phone]", "phone");
  return { name, email, phone };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "evento não encontrado" }, { status: 404 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!verifyApiKey(event, key)) {
    return NextResponse.json({ error: "key inválida" }, { status: 401 });
  }

  const { ok, errors, value } = validateLeadInput(await readContactFields(req));
  if (!ok) return NextResponse.json({ errors }, { status: 400 });

  const { lead, isNew } = await createOrGetLead(event.id, value);
  const magicLink = buildMagicLink(lead.token);

  // Grava o link no AC em TODA ingestão (não só isNew): idempotente e auto-cura
  // falhas anteriores. Aqui o sync é o próprio propósito do endpoint (não um
  // efeito colateral de uma resposta ao usuário), então aguardamos o resultado.
  const sync = await syncMagicLinkToAC(lead.email, magicLink);
  if (!sync.sent)
    console.warn("[onboarding-ac] AC sync não enviado:", sync.reason);

  return NextResponse.json({ leadId: lead.id, isNew, magicLink, acSync: sync.sent });
}
