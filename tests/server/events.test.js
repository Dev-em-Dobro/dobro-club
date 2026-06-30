import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJson } from '../../server/data/store.js';
import { getEvent, verifyApiKey, hashApiKey } from '../../server/events.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
  await writeJson('events/evt_1.json', {
    id: 'evt_1', slug: 'piloto', apiKeyHash: hashApiKey('right-key')
  });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
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
