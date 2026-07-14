import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getEventBySlug, isTicketOnly } from "@/lib/events";
import { getLeadById } from "@/lib/leads";
import { buildTicketImageUrl } from "@/lib/ticket";
import IngressoChat from "@/components/IngressoChat";

/**
 * Gerador de ingresso por evento — é o link que circula no evento pago
 * (`/e/<slug>/ingresso`). O evento em modo `ticket-only` vive só aqui: sem hub,
 * sem magic link, sem recuperação. Um evento completo também pode ser gerado por
 * esta rota (mesmo chat), mantendo o fluxo com link de acesso.
 */

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.DOBRO_BASE_URL ||
    "http://localhost:3000"
  );
}

/**
 * Quando o link vem de um compartilhamento (`?ref=<leadId>`), o preview (WhatsApp,
 * Telegram, LinkedIn…) mostra **o ingresso de quem compartilhou** — é o que faz o
 * ingresso circular como moeda social em vez de um card genérico.
 */
export async function generateMetadata({ params, searchParams }: Props) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams]);
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Ingresso — Dobro Club" };

  const owner = ref ? await getLeadById(event.id, ref) : null;
  const title = event.name
    ? `Garanta seu ingresso — ${event.name}`
    : "Garanta seu ingresso — Dobro Club";
  const description = owner?.name
    ? `${owner.name} vai estar lá. Gere o seu ingresso também!`
    : "Gere seu ingresso personalizado do evento.";

  return {
    metadataBase: new URL(baseUrl()),
    title,
    description,
    openGraph: {
      title,
      description,
      images: [owner ? buildTicketImageUrl(owner) : "/ingresso-template.png"],
    },
  };
}

export default async function IngressoDoEventoPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  return (
    <Suspense fallback={<main className="loading">Carregando…</main>}>
      <IngressoChat
        slug={event.slug}
        eventName={event.name}
        ticketOnly={isTicketOnly(event)}
      />
    </Suspense>
  );
}
