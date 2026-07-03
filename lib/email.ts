import { Resend } from "resend";

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!client && process.env.RESEND_API_KEY)
    client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/** Permite testes resetarem o client cacheado entre execuções. */
export function resetClientForTests(): void {
  client = null;
}

function fromAddress(): string {
  const f = process.env.EMAIL_FROM;
  const fallback = "Dobro Club <onboarding@resend.dev>";
  if (f && !f.includes("<")) {
    console.warn(
      '[email] EMAIL_FROM is set but missing angle brackets (expected "Name <addr@domain>"); falling back to test sender',
    );
    return fallback;
  }
  return f && f.includes("<") ? f : fallback;
}

/** Escapa strings do usuário antes de embutir no HTML. */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MagicLinkEmailInput {
  name?: string | null;
  eventName?: string | null;
  magicLink: string;
}

export function magicLinkHtml({
  name,
  eventName,
  magicLink,
}: MagicLinkEmailInput): string {
  const greeting = name ? `Olá, ${esc(name)}!` : "Olá!";
  return `<!doctype html><html><body style="margin:0;background:#030617;font-family:Mulish,Arial,sans-serif;color:#eef8fa;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#0a1020;border:3px solid #983a92;border-radius:8px;padding:28px;text-align:center">
    <p style="font-family:'Press Start 2P',monospace;color:#facc16;font-size:14px;margin:0 0 8px">DOBRO CLUB</p>
    <h1 style="font-size:18px;margin:8px 0">${greeting}</h1>
    <p style="color:#9aa6b8">Seu acesso ${eventName ? `ao <b style="color:#eef8fa">${esc(eventName)}</b>` : "ao evento"} está pronto. É só clicar para entrar — sem senha.</p>
    <a href="${magicLink}" style="display:inline-block;margin:18px 0;padding:14px 26px;background:#facc16;color:#030617;font-weight:800;text-decoration:none;border-radius:6px;box-shadow:0 4px 0 #b77807">Entrar no evento</a>
    <p style="color:#5a6b82;font-size:12px;margin-top:18px">Se o botão não funcionar, cole no navegador:<br>${magicLink}</p>
  </div></body></html>`;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
}

export async function sendMagicLinkEmail({
  to,
  name,
  eventName,
  magicLink,
}: MagicLinkEmailInput & { to?: string | null }): Promise<SendResult> {
  const c = getClient();
  if (!c) return { sent: false, reason: "no-resend-key" };
  if (!to) return { sent: false, reason: "no-recipient" };
  try {
    const { error } = await c.emails.send({
      from: fromAddress(),
      to,
      subject: "Seu acesso ao evento — Dobro Club",
      html: magicLinkHtml({ name, eventName, magicLink }),
    });
    if (error) return { sent: false, reason: error.message || String(error) };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}
