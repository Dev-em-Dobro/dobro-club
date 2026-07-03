import { describe, it, expect } from "vitest";
import { isReleased } from "@/lib/content";

const DAY = 24 * 60 * 60 * 1000;
const item = (releaseAt: string | null) => ({ releaseAt });

describe("isReleased", () => {
  it("liberado quando releaseAt é null", () => {
    expect(isReleased(item(null))).toBe(true);
  });

  it("bloqueado quando releaseAt está no futuro", () => {
    const future = new Date(Date.now() + 5 * DAY).toISOString();
    expect(isReleased(item(future))).toBe(false);
  });

  it("liberado quando releaseAt está no passado", () => {
    const past = new Date(Date.now() - 5 * DAY).toISOString();
    expect(isReleased(item(past))).toBe(true);
  });

  it("liberado exatamente na borda (now === releaseAt)", () => {
    const now = new Date("2026-08-01T23:00:00.000Z");
    expect(isReleased(item(now.toISOString()), now)).toBe(true);
  });

  it("ignora releaseAt inválido tratando como liberado", () => {
    expect(isReleased(item("nao-e-data"))).toBe(true);
  });
});
