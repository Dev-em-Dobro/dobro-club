import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { createOrGetLead } from "@/lib/leads";
import { hasCompletedSurvey } from "@/lib/engagement";
import { signSession } from "@/lib/auth/session";
import { POST } from "@/app/api/evento/pesquisa/route";

function post(session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  const req = new NextRequest("http://localhost/api/evento/pesquisa", {
    method: "POST",
    headers,
  });
  return POST(req);
}

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto" });
});

describe("POST /api/evento/pesquisa", () => {
  it("401 sem sessão", async () => {
    expect((await post()).status).toBe(401);
  });

  it("marca a pesquisa como respondida para o lead da sessão", async () => {
    const { lead } = await createOrGetLead("evt_1", {
      name: "Ana",
      email: "a@x.com",
      phone: null,
    });
    expect(await hasCompletedSurvey(lead.id)).toBe(false);
    const res = await post({ leadId: lead.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    expect(await hasCompletedSurvey(lead.id)).toBe(true);
  });

  it("é idempotente (não duplica survey.completed)", async () => {
    const { lead } = await createOrGetLead("evt_1", {
      name: "Ana",
      email: "a@x.com",
      phone: null,
    });
    await post({ leadId: lead.id, eventId: "evt_1" });
    await post({ leadId: lead.id, eventId: "evt_1" });
    expect(await hasCompletedSurvey(lead.id)).toBe(true);
  });
});
