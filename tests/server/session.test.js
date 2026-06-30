import { describe, it, expect } from 'vitest';
import { signSession, verifySession } from '../../server/auth/session.js';

describe('session', () => {
  it('signs and verifies a payload round-trip', () => {
    const value = signSession({ leadId: 'lead_1', eventId: 'evt_1' });
    expect(verifySession(value)).toEqual({ leadId: 'lead_1', eventId: 'evt_1' });
  });

  it('rejects a tampered value', () => {
    const value = signSession({ leadId: 'lead_1', eventId: 'evt_1' });
    const tampered = value.slice(0, -2) + (value.endsWith('aa') ? 'bb' : 'aa');
    expect(verifySession(tampered)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifySession('')).toBeNull();
    expect(verifySession('no-dot')).toBeNull();
  });
});
