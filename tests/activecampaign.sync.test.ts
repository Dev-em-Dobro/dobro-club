import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { syncMagicLinkToAC } from "@/lib/activecampaign";

const LINK = "https://dobro.club/entrar/tok123";

function mockFetch(impl: () => Promise<{ ok: boolean }>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn as unknown as typeof fetch);
  return fn;
}

beforeEach(() => {
  vi.stubEnv("AC_API_URL", "https://acme.api-us1.com");
  vi.stubEnv("AC_API_TOKEN", "tok-secreto");
  vi.stubEnv("AC_MAGIC_LINK_FIELD_ID", "7");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("syncMagicLinkToAC", () => {
  it("no-op quando não configurado (sem chamar a AC)", async () => {
    vi.stubEnv("AC_API_TOKEN", "");
    const fetchFn = mockFetch(async () => ({ ok: true }));
    const r = await syncMagicLinkToAC("ana@x.com", LINK);
    expect(r).toEqual({ sent: false, reason: "ac-not-configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("no-op quando o lead não tem e-mail", async () => {
    const fetchFn = mockFetch(async () => ({ ok: true }));
    const r = await syncMagicLinkToAC(null, LINK);
    expect(r).toEqual({ sent: false, reason: "no-email" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("faz POST em /api/3/contact/sync com header Api-Token e o campo do link", async () => {
    const fetchFn = mockFetch(async () => ({ ok: true }));
    const r = await syncMagicLinkToAC("ana@x.com", LINK);
    expect(r).toEqual({ sent: true });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://acme.api-us1.com/api/3/contact/sync");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Api-Token"]).toBe("tok-secreto");
    expect(JSON.parse(init.body as string)).toEqual({
      contact: {
        email: "ana@x.com",
        fieldValues: [{ field: "7", value: LINK }],
      },
    });
  });

  it("remove barra final da AC_API_URL ao montar a URL", async () => {
    vi.stubEnv("AC_API_URL", "https://acme.api-us1.com/");
    const fetchFn = mockFetch(async () => ({ ok: true }));
    await syncMagicLinkToAC("ana@x.com", LINK);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://acme.api-us1.com/api/3/contact/sync");
  });

  it("retry: falha nas duas tentativas ⇒ sent:false", async () => {
    const fetchFn = mockFetch(async () => ({ ok: false }));
    const r = await syncMagicLinkToAC("ana@x.com", LINK);
    expect(r).toEqual({ sent: false, reason: "failed" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
