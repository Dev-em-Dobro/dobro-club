import { describe, it, expect, afterEach } from 'vitest';
import { generateToken, buildMagicLink } from '../../server/auth/token.js';

afterEach(() => {
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
});
