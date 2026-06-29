import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateToken, buildMagicLink, addToken, lookupToken } from '../../server/auth/token.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
  delete process.env.DOBRO_BASE_URL;
});

describe('token', () => {
  it('generates unique url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it('builds a magic link from base url', () => {
    process.env.DOBRO_BASE_URL = 'https://dobro.club';
    expect(buildMagicLink('abc')).toBe('https://dobro.club/entrar/abc');
  });

  it('stores and looks up a token reference', async () => {
    await addToken('tok1', { leadId: 'lead_1', eventId: 'evt_1' });
    expect(await lookupToken('tok1')).toEqual({ leadId: 'lead_1', eventId: 'evt_1' });
    expect(await lookupToken('missing')).toBeNull();
  });
});
