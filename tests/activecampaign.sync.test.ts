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

  it("não aplica tag quando AC_ONBOARDING_TAG_ID não está setado", async () => {
    const fetchFn = mockFetch(async () => ({
      ok: true,
      json: async () => ({ contact: { id: "42" } }),
    }));
    const r = await syncMagicLinkToAC("ana@x.com", LINK);
    expect(r).toEqual({ sent: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("aplica a tag de onboarding DEPOIS de gravar o link quando a tag está setada", async () => {
    vi.stubEnv("AC_ONBOARDING_TAG_ID", "53414");
    const fetchFn = vi.fn(async (url: string) =>
      String(url).endsWith("/api/3/contact/sync")
        ? { ok: true, json: async () => ({ contact: { id: "42" } }) }
        : { ok: true, json: async () => ({}) },
    );
    vi.stubGlobal("fetch", fetchFn as unknown as typeof fetch);

    const r = await syncMagicLinkToAC("ana@x.com", LINK);
    expect(r).toEqual({ sent: true });

    // 1ª chamada grava o link; 2ª aplica a tag (ordem importa p/ %MAGIC_LINK%).
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [syncUrl] = fetchFn.mock.calls[0] as unknown as [string];
    expect(syncUrl).toBe("https://acme.api-us1.com/api/3/contact/sync");

    const [tagUrl, tagInit] = fetchFn.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(tagUrl).toBe("https://acme.api-us1.com/api/3/contactTags");
    expect((tagInit.headers as Record<string, string>)["Api-Token"]).toBe(
      "tok-secreto",
    );
    expect(JSON.parse(tagInit.body as string)).toEqual({
      contactTag: { contact: "42", tag: "53414" },
    });
  });

  it("tag-failed: link gravado mas a AC recusa a tag ⇒ sent:false", async () => {
    vi.stubEnv("AC_ONBOARDING_TAG_ID", "53414");
    const fetchFn = vi.fn(async (url: string) =>
      String(url).endsWith("/api/3/contact/sync")
        ? { ok: true, json: async () => ({ contact: { id: "42" } }) }
        : { ok: false, json: async () => ({}) },
    );
    vi.stubGlobal("fetch", fetchFn as unknown as typeof fetch);

    const r = await syncMagicLinkToAC("ana@x.com", LINK);
    expect(r).toEqual({ sent: false, reason: "tag-failed" });
  });

  it("no-contact-id: sync sem id de contato ⇒ não tenta aplicar a tag", async () => {
    vi.stubEnv("AC_ONBOARDING_TAG_ID", "53414");
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchFn as unknown as typeof fetch);

    const r = await syncMagicLinkToAC("ana@x.com", LINK);
    expect(r).toEqual({ sent: false, reason: "no-contact-id" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
