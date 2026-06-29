import { describe, it, expect } from 'vitest';
import { validateLeadInput } from '../../server/validate.js';

describe('validateLeadInput', () => {
  it('accepts a valid email-only lead and normalizes', () => {
    const r = validateLeadInput({ name: ' Diego ', email: 'D@X.COM' });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: 'Diego', email: 'd@x.com', phone: null });
  });

  it('accepts a phone-only lead', () => {
    const r = validateLeadInput({ phone: '+5511999999999' });
    expect(r.ok).toBe(true);
  });

  it('rejects when neither email nor phone present', () => {
    const r = validateLeadInput({ name: 'X' });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects a malformed email', () => {
    const r = validateLeadInput({ email: 'not-an-email' });
    expect(r.ok).toBe(false);
  });
});
