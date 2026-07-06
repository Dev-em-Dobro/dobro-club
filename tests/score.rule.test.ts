import { describe, it, expect } from "vitest";
import { scoreFromCounts, weightOf, WEIGHTS } from "@/lib/score";

describe("WEIGHTS", () => {
  it("cobre os 8 tipos da taxonomia com pesos > 0", () => {
    const types = [
      "survey.completed",
      "referral.signup",
      "lesson.completed",
      "live.opened",
      "ticket.shared",
      "lesson.started",
      "content.opened",
      "hub.viewed",
    ];
    for (const t of types) expect(WEIGHTS[t]).toBeGreaterThan(0);
  });

  it("weightOf de tipo sem peso ⇒ 0", () => {
    expect(weightOf("tipo.inexistente")).toBe(0);
  });
});

describe("scoreFromCounts", () => {
  it("soma weight×count por tipo e sum(points) === score", () => {
    const { score, breakdown } = scoreFromCounts([
      { type: "survey.completed", count: 1 }, // 10
      { type: "live.opened", count: 1 }, //       5
      { type: "content.opened", count: 3 }, //    6
    ]);
    expect(score).toBe(21);
    expect(breakdown.reduce((s, b) => s + b.points, 0)).toBe(21);
    const live = breakdown.find((b) => b.type === "live.opened")!;
    expect(live).toMatchObject({ count: 1, weight: 5, points: 5 });
  });

  it("tipo sem peso ⇒ weight:0, points:0 (não quebra; contagem preservada)", () => {
    const { score, breakdown } = scoreFromCounts([
      { type: "hub.viewed", count: 2 }, //   2
      { type: "tipo.novo", count: 5 }, //    0
    ]);
    expect(score).toBe(2);
    const novo = breakdown.find((b) => b.type === "tipo.novo")!;
    expect(novo).toMatchObject({ count: 5, weight: 0, points: 0 });
  });

  it("determinístico: mesma entrada em qualquer ordem ⇒ mesmo score", () => {
    const a = scoreFromCounts([
      { type: "survey.completed", count: 1 },
      { type: "content.opened", count: 2 },
    ]);
    const b = scoreFromCounts([
      { type: "content.opened", count: 2 },
      { type: "survey.completed", count: 1 },
    ]);
    expect(a.score).toBe(b.score);
  });

  it("lista vazia ⇒ score 0 e breakdown vazio", () => {
    const { score, breakdown } = scoreFromCounts([]);
    expect(score).toBe(0);
    expect(breakdown).toEqual([]);
  });
});
