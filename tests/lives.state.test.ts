import { describe, it, expect } from "vitest";
import {
  liveState,
  isWatchable,
  watchResource,
  sanitizeDuration,
  DEFAULT_DURATION_MIN,
} from "@/lib/lives";

const MIN = 60 * 1000;

// Fábrica mínima: só os campos que as regras leem.
const live = (over: Partial<{
  startsAt: string | null;
  durationMin: number | null;
  streamUrl: string | null;
  recordingUrl: string | null;
}> = {}) => ({
  startsAt: null,
  durationMin: 90,
  streamUrl: null,
  recordingUrl: null,
  ...over,
});

const at = (offsetMin: number) => new Date(Date.now() + offsetMin * MIN).toISOString();

describe("liveState", () => {
  it("início no futuro ⇒ scheduled", () => {
    expect(liveState(live({ startsAt: at(60) }))).toBe("scheduled");
  });

  it("agora dentro da janela [início, início+dur] ⇒ live", () => {
    expect(liveState(live({ startsAt: at(-10), durationMin: 90 }))).toBe("live");
  });

  it("na borda do fim (now === início+dur) ⇒ live", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    const startsAt = new Date(now.getTime() - 90 * MIN).toISOString();
    expect(liveState(live({ startsAt, durationMin: 90 }), now)).toBe("live");
  });

  it("após a janela com gravação ⇒ recording", () => {
    expect(
      liveState(live({ startsAt: at(-200), durationMin: 90, recordingUrl: "rec" })),
    ).toBe("recording");
  });

  it("após a janela sem gravação ⇒ ended", () => {
    expect(liveState(live({ startsAt: at(-200), durationMin: 90 }))).toBe("ended");
  });

  it("startsAt ausente/inválido ⇒ scheduled (degradação segura)", () => {
    expect(liveState(live({ startsAt: null }))).toBe("scheduled");
    expect(liveState(live({ startsAt: "nao-e-data" }))).toBe("scheduled");
  });

  it("durationMin ausente/inválido ⇒ usa default (90)", () => {
    // início há 80 min: com default 90, ainda está ao vivo
    expect(liveState(live({ startsAt: at(-80), durationMin: null }))).toBe("live");
    expect(liveState(live({ startsAt: at(-80), durationMin: 0 }))).toBe("live");
    // início há 100 min: passou dos 90 default ⇒ ended (sem gravação)
    expect(liveState(live({ startsAt: at(-100), durationMin: null }))).toBe("ended");
  });
});

describe("sanitizeDuration", () => {
  it("valor válido é mantido; inválido cai no default", () => {
    expect(sanitizeDuration(45)).toBe(45);
    expect(sanitizeDuration(null)).toBe(DEFAULT_DURATION_MIN);
    expect(sanitizeDuration(0)).toBe(DEFAULT_DURATION_MIN);
    expect(sanitizeDuration(Number.NaN)).toBe(DEFAULT_DURATION_MIN);
    expect(sanitizeDuration(-5)).toBe(DEFAULT_DURATION_MIN);
  });
});

describe("isWatchable / watchResource", () => {
  it("isWatchable só em live e recording", () => {
    expect(isWatchable("live")).toBe(true);
    expect(isWatchable("recording")).toBe(true);
    expect(isWatchable("scheduled")).toBe(false);
    expect(isWatchable("ended")).toBe(false);
  });

  it("watchResource devolve o embed conforme o estado", () => {
    const l = live({ streamUrl: "stream", recordingUrl: "rec" });
    expect(watchResource(l, "live")).toBe("stream");
    expect(watchResource(l, "recording")).toBe("rec");
    expect(watchResource(l, "scheduled")).toBeNull();
    expect(watchResource(l, "ended")).toBeNull();
  });
});
