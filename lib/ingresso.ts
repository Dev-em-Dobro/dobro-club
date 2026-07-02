// Monta o objeto `ticket` do response de captação (reuso pelos Route Handlers).
// Mantém a borda HTTP fina: toda a composição de URLs vive em `lib/ticket.ts`.

import type { Lead } from "./leads";
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
