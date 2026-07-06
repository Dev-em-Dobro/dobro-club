import { describe, it, expect } from "vitest";
import { evaluateBadges, BADGES, type BadgeCtx } from "@/lib/gamification";

const ctx = (over: Partial<BadgeCtx> = {}): BadgeCtx => ({
  counts: {},
  streak: { current: 0, longest: 0 },
  score: 0,
  ...over,
});

const earned = (badges: ReturnType<typeof evaluateBadges>, id: string) =>
  badges.find((b) => b.id === id)!.earned;

describe("evaluateBadges", () => {
  it("catálogo sempre presente com criterion e earned", () => {
    const badges = evaluateBadges(ctx());
    expect(badges).toHaveLength(BADGES.length);
    for (const b of badges) {
      expect(typeof b.criterion).toBe("string");
      expect(typeof b.earned).toBe("boolean");
    }
  });

  it("primeira-live: earned com live.opened >= 1", () => {
    expect(earned(evaluateBadges(ctx()), "primeira-live")).toBe(false);
    expect(earned(evaluateBadges(ctx({ counts: { "live.opened": 1 } })), "primeira-live")).toBe(true);
  });

  it("explorador: earned com content.opened >= 5", () => {
    expect(earned(evaluateBadges(ctx({ counts: { "content.opened": 4 } })), "explorador")).toBe(false);
    expect(earned(evaluateBadges(ctx({ counts: { "content.opened": 5 } })), "explorador")).toBe(true);
  });

  it("streak-3 / streak-7 usam o longest", () => {
    const b = evaluateBadges(ctx({ streak: { current: 0, longest: 3 } }));
    expect(earned(b, "streak-3")).toBe(true);
    expect(earned(b, "streak-7")).toBe(false);
    expect(earned(evaluateBadges(ctx({ streak: { current: 0, longest: 7 } })), "streak-7")).toBe(true);
  });

  it("engajado: earned com score >= 20 (lead score 8.18)", () => {
    expect(earned(evaluateBadges(ctx({ score: 19 })), "engajado")).toBe(false);
    expect(earned(evaluateBadges(ctx({ score: 20 })), "engajado")).toBe(true);
  });

  it("determinístico: mesma entrada ⇒ mesmo resultado", () => {
    const c = ctx({ counts: { "live.opened": 1 }, score: 20 });
    expect(evaluateBadges(c)).toEqual(evaluateBadges(c));
  });

  it("badge com test que lança ⇒ earned:false, sem derrubar os demais", () => {
    // counts null força erro dentro de um test que acessa counts['...']
    const bad = { counts: null as unknown as Record<string, number>, streak: { current: 0, longest: 0 }, score: 0 };
    const badges = evaluateBadges(bad);
    expect(badges).toHaveLength(BADGES.length);
    for (const b of badges) expect(b.earned).toBe(false);
  });
});
