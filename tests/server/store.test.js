import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson, withLock } from '../../server/data/store.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

describe('store', () => {
  it('round-trips JSON and creates nested dirs', async () => {
    await writeJson('events/evt_1/leads.json', [{ id: 'a' }]);
    expect(await readJson('events/evt_1/leads.json')).toEqual([{ id: 'a' }]);
  });

  it('returns fallback when file is missing', async () => {
    expect(await readJson('nope.json', [])).toEqual([]);
  });

  it('leaves no .tmp file behind after write', async () => {
    await writeJson('x.json', { ok: true });
    const files = await fs.readdir(tmp);
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('serializes concurrent locked appends without losing data', async () => {
    const append = (n) =>
      withLock('list.json', async () => {
        const arr = await readJson('list.json', []);
        arr.push(n);
        await writeJson('list.json', arr);
      });
    await Promise.all([1, 2, 3, 4, 5].map(append));
    const arr = await readJson('list.json', []);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
