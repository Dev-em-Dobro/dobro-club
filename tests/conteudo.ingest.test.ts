import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { listContentItems } from "@/lib/content";
import { POST } from "@/app/api/events/[eventId]/conteudo/route";

function post(eventId: string, body: unknown, apiKey?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const req = new NextRequest(`http://localhost/api/events/${eventId}/conteudo`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ eventId }) });
}

const lesson = {
  kind: "lesson",
  title: "Nivelamento 1",
  resource: "https://www.youtube.com/embed/abc",
  position: 1,
};

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("POST /api/events/[eventId]/conteudo", () => {
  it("401 sem X-Api-Key", async () => {
    const res = await post("evt_1", lesson);
    expect(res.status).toBe(401);
  });

  it("401 com X-Api-Key errada", async () => {
    const res = await post("evt_1", lesson, "errada");
    expect(res.status).toBe(401);
  });

  it("404 para evento inexistente", async () => {
    const res = await post("evt_nao", lesson, "k");
    expect(res.status).toBe(404);
  });

  it("400 para kind inválido", async () => {
    const res = await post("evt_1", { ...lesson, kind: "video" }, "k");
    expect(res.status).toBe(400);
  });

  it("400 quando falta title", async () => {
    const res = await post("evt_1", { kind: "lesson" }, "k");
    expect(res.status).toBe(400);
  });

  it("201 cria o item com chave válida", async () => {
    const res = await post("evt_1", lesson, "k");
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toMatch(/^cont_/);
    const items = await listContentItems("evt_1");
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("lesson");
    expect(items[0].resource).toContain("/embed/");
  });

  // Story 8.16 (US2): curadoria define o offset de liberação por aula.
  it("201 persiste releaseOffsetDays quando informado", async () => {
    const res = await post("evt_1", { ...lesson, releaseOffsetDays: 2 }, "k");
    expect(res.status).toBe(201);
    const items = await listContentItems("evt_1");
    expect(items[0].releaseOffsetDays).toBe(2);
  });

  it("201 sem releaseOffsetDays ⇒ persiste null (tratado como 0 no cálculo)", async () => {
    await post("evt_1", lesson, "k");
    const items = await listContentItems("evt_1");
    expect(items[0].releaseOffsetDays).toBeNull();
  });
});
