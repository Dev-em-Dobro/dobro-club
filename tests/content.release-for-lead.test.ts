import { describe, it, expect } from "vitest";
import {
  isLessonReleasedForLead,
  isItemReleasedForLead,
  releaseForLeadAt,
} from "@/lib/content";

const DAY = 24 * 60 * 60 * 1000;

// Story 8.16: aulas de nivelamento liberam por lead = entrada + offset*dia.
// Fábrica mínima cobrindo só os campos que as regras leem.
const lesson = (releaseOffsetDays: number | null, releaseAt: string | null = null) => ({
  kind: "lesson" as const,
  releaseOffsetDays,
  releaseAt,
});
const doc = (releaseAt: string | null) => ({
  kind: "doc" as const,
  releaseOffsetDays: null,
  releaseAt,
});

describe("isLessonReleasedForLead", () => {
  it("offset 0 + entrada no passado ⇒ liberado", () => {
    const entry = new Date(Date.now() - 1 * DAY).toISOString();
    expect(isLessonReleasedForLead(lesson(0), entry)).toBe(true);
  });

  it("offset 2 + entrada há 1 dia ⇒ NÃO liberado", () => {
    const entry = new Date(Date.now() - 1 * DAY).toISOString();
    expect(isLessonReleasedForLead(lesson(2), entry)).toBe(false);
  });

  it("offset 2 + entrada há 3 dias ⇒ liberado", () => {
    const entry = new Date(Date.now() - 3 * DAY).toISOString();
    expect(isLessonReleasedForLead(lesson(2), entry)).toBe(true);
  });

  it("liberado exatamente na borda (now === entrada + offset)", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    const entry = new Date(now.getTime() - 2 * DAY).toISOString();
    expect(isLessonReleasedForLead(lesson(2), entry, now)).toBe(true);
  });

  it("offset ausente/negativo/NaN ⇒ tratado como 0 (libera com entrada no passado)", () => {
    const entry = new Date(Date.now() - 1 * DAY).toISOString();
    expect(isLessonReleasedForLead(lesson(null), entry)).toBe(true);
    expect(isLessonReleasedForLead(lesson(-5), entry)).toBe(true);
    expect(isLessonReleasedForLead(lesson(Number.NaN), entry)).toBe(true);
  });

  it("entrada inválida/ausente ⇒ tratada como agora (só offset 0 libera)", () => {
    expect(isLessonReleasedForLead(lesson(0), null)).toBe(true);
    expect(isLessonReleasedForLead(lesson(0), "nao-e-data")).toBe(true);
    expect(isLessonReleasedForLead(lesson(2), null)).toBe(false);
  });

  it("entrada no futuro ⇒ nem a aula de offset 0 libera antes da hora", () => {
    const entry = new Date(Date.now() + 5 * DAY).toISOString();
    expect(isLessonReleasedForLead(lesson(0), entry)).toBe(false);
  });
});

describe("isItemReleasedForLead (precedência)", () => {
  it("kind='lesson' ⇒ usa a regra por-lead (ignora releaseAt de calendário)", () => {
    const entry = new Date(Date.now() - 1 * DAY).toISOString();
    const future = new Date(Date.now() + 10 * DAY).toISOString();
    // releaseAt no futuro, mas offset 0 + entrada passada ⇒ liberado por-lead
    expect(isItemReleasedForLead(lesson(0, future), entry)).toBe(true);
  });

  it("kind='doc' ⇒ cai no calendário (isReleased), ignora offset", () => {
    const past = new Date(Date.now() - 1 * DAY).toISOString();
    const future = new Date(Date.now() + 5 * DAY).toISOString();
    expect(isItemReleasedForLead(doc(past), null)).toBe(true);
    expect(isItemReleasedForLead(doc(future), null)).toBe(false);
  });
});

describe("releaseForLeadAt", () => {
  it("lesson ⇒ entrada + offset*dia", () => {
    const entry = new Date("2026-07-01T00:00:00.000Z").toISOString();
    const got = releaseForLeadAt(lesson(2), entry);
    expect(got).toBe(new Date("2026-07-03T00:00:00.000Z").toISOString());
  });

  it("lesson com offset ausente ⇒ entrada (offset 0)", () => {
    const entry = new Date("2026-07-01T00:00:00.000Z").toISOString();
    expect(releaseForLeadAt(lesson(null), entry)).toBe(entry);
  });

  it("não-lesson ⇒ reflete o releaseAt de calendário", () => {
    const at = new Date("2026-08-01T00:00:00.000Z").toISOString();
    expect(releaseForLeadAt(doc(at), null)).toBe(at);
  });
});
