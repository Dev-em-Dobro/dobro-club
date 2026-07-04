import { describe, it, expect } from "vitest";
import { dayKey, computeStreak } from "@/lib/gamification";

// today fixo p/ determinismo: 2026-07-10T12:00Z ⇒ dia SP (UTC-3) = 2026-07-10
const TODAY = new Date("2026-07-10T12:00:00.000Z");

describe("dayKey (fuso São Paulo, UTC-3)", () => {
  it("agrupa por dia local; 23h e 00h05 do dia seguinte ⇒ dias distintos", () => {
    // 02:30Z = 23:30 SP do dia anterior
    expect(dayKey("2026-07-05T02:30:00.000Z")).toBe("2026-07-04");
    // 03:05Z = 00:05 SP
    expect(dayKey("2026-07-05T03:05:00.000Z")).toBe("2026-07-05");
  });

  it("meio do dia UTC cai no mesmo dia SP", () => {
    expect(dayKey("2026-07-10T12:00:00.000Z")).toBe("2026-07-10");
  });
});

describe("computeStreak", () => {
  it("3 dias consecutivos terminando hoje ⇒ current 3, longest 3", () => {
    const r = computeStreak(["2026-07-08", "2026-07-09", "2026-07-10"], TODAY);
    expect(r).toEqual({ current: 3, longest: 3 });
  });

  it("gap de 1 dia quebra o streak atual", () => {
    const r = computeStreak(
      ["2026-07-05", "2026-07-08", "2026-07-09", "2026-07-10"],
      TODAY,
    );
    expect(r.current).toBe(3); // 08,09,10
    expect(r.longest).toBe(3);
  });

  it("vários eventos no mesmo dia ⇒ conta 1", () => {
    const r = computeStreak(["2026-07-10", "2026-07-10", "2026-07-10"], TODAY);
    expect(r.current).toBe(1);
  });

  it("tolerância: último ativo = ontem e hoje vazio ⇒ streak vigente mantém", () => {
    const r = computeStreak(["2026-07-08", "2026-07-09"], TODAY); // hoje (10) vazio
    expect(r.current).toBe(2);
  });

  it("quebrado: último ativo anterior a ontem ⇒ current 0", () => {
    const r = computeStreak(["2026-07-05"], TODAY);
    expect(r).toEqual({ current: 0, longest: 1 });
  });

  it("longest = maior sequência histórica (mesmo com current 0)", () => {
    const r = computeStreak(
      ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-06"],
      TODAY,
    );
    expect(r.longest).toBe(3);
    expect(r.current).toBe(0);
  });

  it("sem dias ativos ⇒ {0,0}", () => {
    expect(computeStreak([], TODAY)).toEqual({ current: 0, longest: 0 });
  });
});
