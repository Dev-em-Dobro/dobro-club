import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { getLeadByPhone } from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";
import { normalizePhone, isValidPhone } from "@/lib/validate";
import { makeLimiter, clientIp } from "@/lib/ratelimit";

// Recuperação por telefone: o participante informa o número (DDI+DD+número) e
// recebe o próprio magic link NA TELA. Decisão de produto ciente do trade-off:
// telefone não é segredo, então isso permite acesso a quem souber o número.
// Mitigação: rate limit estrito para conter enumeração/abuso.
const limiter = makeLimiter({ windowMs: 60_000, max: 5 });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const rl = limiter.check(`acessar:${clientIp(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "muitas tentativas, tente novamente em instantes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "evento não encontrado" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: "telefone inválido — use DDI + DDD + número, ex.: 5584991153472" },
      { status: 400 },
    );
  }

  const lead = await getLeadByPhone(event.id, phone);
  if (!lead || lead.revoked) {
    return NextResponse.json(
      { ok: false, message: "Não encontramos um ingresso com esse telefone." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    name: lead.name,
    magicLink: buildMagicLink(lead.token),
  });
}
