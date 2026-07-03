import { describe, it, expect } from "vitest";
import { ingressoPhase, ingressoWindowOpensAt } from "@/lib/ingresso";
import type { EventRow } from "@/lib/events";

const DAY = 24 * 60 * 60 * 1000;

function event(weekStartsAt: string | null): Pick<EventRow, "weekStartsAt"> {
  return { weekStartsAt };
}

describe("ingressoWindowOpensAt", () => {
  it("abre 3 dias antes do início da semana", () => {
    const start = new Date("2026-08-10T00:00:00.000Z");
    const opens = ingressoWindowOpensAt(event(start.toISOString()));
    expect(opens?.toISOString()).toBe(
      new Date(start.getTime() - 3 * DAY).toISOString(),
    );
  });

  it("é null quando o evento não tem data marcada", () => {
    expect(ingressoWindowOpensAt(event(null))).toBeNull();
  });

  it("é null para data inválida", () => {
    expect(ingressoWindowOpensAt(event("nao-e-data"))).toBeNull();
  });
});

describe("ingressoPhase", () => {
  const start = new Date("2026-08-10T00:00:00.000Z");
  const opensAt = new Date(start.getTime() - 3 * DAY); // 2026-08-07

  it("é 'provisoria' antes da janela abrir", () => {
    const now = new Date(opensAt.getTime() - 1 * DAY);
    expect(ingressoPhase(event(start.toISOString()), now)).toBe("provisoria");
  });

  it("é 'oficial' exatamente na abertura da janela (T-3 dias)", () => {
    expect(ingressoPhase(event(start.toISOString()), opensAt)).toBe("oficial");
  });

  it("é 'oficial' depois da janela abrir", () => {
    const now = new Date(opensAt.getTime() + 1 * DAY);
    expect(ingressoPhase(event(start.toISOString()), now)).toBe("oficial");
  });

  it("é 'provisoria' quando o evento não tem data marcada", () => {
    const now = new Date("2999-01-01T00:00:00.000Z");
    expect(ingressoPhase(event(null), now)).toBe("provisoria");
  });
});
