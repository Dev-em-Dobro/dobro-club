import { describe, it, expect, afterEach, vi } from 'vitest';
import { sendMagicLinkEmail, magicLinkHtml, resetClientForTests } from '../../server/email.js';

afterEach(() => { delete process.env.RESEND_API_KEY; vi.restoreAllMocks(); resetClientForTests(); });

describe('email', () => {
  it('builds branded html with the link', () => {
    const html = magicLinkHtml({ name: 'Diego', eventName: 'Piloto', magicLink: 'http://x/entrar/tok' });
    expect(html).toContain('http://x/entrar/tok');
    expect(html).toContain('Diego');
  });
  it('no-ops without an API key', async () => {
    const r = await sendMagicLinkEmail({ to: 'a@b.com', magicLink: 'x' });
    expect(r).toEqual({ sent: false, reason: 'no-resend-key' });
  });
  it('reports no-recipient when key present but no "to"', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const r = await sendMagicLinkEmail({ to: null, magicLink: 'x' });
    expect(r.sent).toBe(false);
  });
});
