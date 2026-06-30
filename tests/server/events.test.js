import { describe, it, expect, beforeEach } from 'vitest';
import { useTestDb, seedEvent } from '../helpers/db.js';
import { getEvent, verifyApiKey } from '../../server/events.js';

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: 'evt_1', slug: 'piloto', apiKey: 'right-key' });
});

describe('events', () => {
  it('loads an event by id', async () => {
    expect((await getEvent('evt_1')).slug).toBe('piloto');
  });

  it('returns null for unknown event', async () => {
    expect(await getEvent('nope')).toBeNull();
  });

  it('verifies the api key', async () => {
    const ev = await getEvent('evt_1');
    expect(verifyApiKey(ev, 'right-key')).toBe(true);
    expect(verifyApiKey(ev, 'wrong-key')).toBe(false);
    expect(verifyApiKey(ev, '')).toBe(false);
  });
});
