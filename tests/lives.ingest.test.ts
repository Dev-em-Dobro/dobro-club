import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { listLives } from "@/lib/lives";
import { POST } from "@/app/api/events/[eventId]/lives/route";

function post(eventId: string, body: unknown, apiKey?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const req = new NextRequest(`http://localhost/api/events/${eventId}/lives`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ eventId }) });
}

const liveBody = {
  title: "Live de aquecimento 1",
  startsAt: "2026-07-05T23:00:00.000Z",
  durationMin: 90,
  streamUrl: "https://www.youtube.com/embed/abc",
};

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("POST /api/events/[eventId]/lives", () => {
  it("401 sem X-Api-Key", async () => {
    expect((await post("evt_1", liveBody)).status).toBe(401);
  });

  it("401 com X-Api-Key errada", async () => {
    expect((await post("evt_1", liveBody, "errada")).status).toBe(401);
  });

  it("404 para evento inexistente", async () => {
    expect((await post("evt_nao", liveBody, "k")).status).toBe(404);
  });

  it("400 quando falta title", async () => {
    expect((await post("evt_1", { startsAt: liveBody.startsAt }, "k")).status).toBe(400);
  });

  it("201 cria a live e persiste os campos", async () => {
    const res = await post("evt_1", liveBody, "k");
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toMatch(/^live_/);
    const lives = await listLives("evt_1");
    expect(lives).toHaveLength(1);
    expect(lives[0].title).toBe("Live de aquecimento 1");
    expect(lives[0].startsAt).not.toBeNull();
    expect(lives[0].durationMin).toBe(90);
    expect(lives[0].streamUrl).toContain("/embed/");
  });

  it("201 com campos opcionais ausentes ⇒ persiste null (mock)", async () => {
    await post("evt_1", { title: "Só título" }, "k");
    const lives = await listLives("evt_1");
    expect(lives[0].startsAt).toBeNull();
    expect(lives[0].durationMin).toBeNull();
    expect(lives[0].streamUrl).toBeNull();
    expect(lives[0].recordingUrl).toBeNull();
  });
});
