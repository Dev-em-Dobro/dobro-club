// Monta o objeto `ticket` do response de captação (reuso pelos Route Handlers).
// Mantém a borda HTTP fina: toda a composição de URLs vive em `lib/ticket.ts`.

import type { Lead } from "./leads";
import type { EventRow } from "./events";
import { buildTicketImageUrl, qrValue, shareUrl } from "./ticket";

export interface Ticket {
  imageUrl: string;
  qrValue: string;
  shareUrl: string;
}

export function buildTicket(lead: Lead): Ticket {
  return {
    imageUrl: buildTicketImageUrl(lead),
    qrValue: qrValue(lead),
    shareUrl: shareUrl(lead),
  };
}

/**
 * Janela de ingresso: o ingresso oficial só é liberado **3 dias antes** de a
 * semana do evento começar. Derivado em TS (Constituição VI — sem coluna
 * GENERATED). `null` quando o evento ainda não tem `weekStartsAt` marcado.
 */
export const INGRESSO_WINDOW_DAYS = 3;

export function ingressoWindowOpensAt(
  event: Pick<EventRow, "weekStartsAt">,
): Date | null {
  if (!event.weekStartsAt) return null;
  const start = new Date(event.weekStartsAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - INGRESSO_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export type IngressoPhase = "provisoria" | "oficial";

/**
 * Estado do ingresso para o hub (Story 8.12): `provisoria` enquanto a janela não
 * abriu (credencial de pré-evento) e `oficial` a partir de T-3 dias. É só função
 * do tempo — na virada nada migra, o mesmo lead/ticket muda de fase.
 */
export function ingressoPhase(
  event: Pick<EventRow, "weekStartsAt">,
  now: Date = new Date(),
): IngressoPhase {
  const opensAt = ingressoWindowOpensAt(event);
  if (opensAt && now.getTime() >= opensAt.getTime()) return "oficial";
  return "provisoria";
}
