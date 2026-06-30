import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createOrGetLead, getLeadByToken, getLeadById, touchLastSeen, setRevoked
} from '../../server/leads.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

describe('leads', () => {
  it('creates a new lead with a token', async () => {
    const { lead, isNew } = await createOrGetLead('evt_1', { name: 'Diego', email: 'd@x.com' });
    expect(isNew).toBe(true);
    expect(lead.id).toMatch(/^lead_/);
    expect(lead.token).toBeTruthy();
    expect(lead.revoked).toBe(false);
  });

  it('is idempotent by email', async () => {
    const a = await createOrGetLead('evt_1', { email: 'd@x.com' });
    const b = await createOrGetLead('evt_1', { email: 'd@x.com' });
    expect(b.isNew).toBe(false);
    expect(b.lead.token).toBe(a.lead.token);
  });

  it('finds a lead by its token', async () => {
    const { lead } = await createOrGetLead('evt_1', { email: 'd@x.com' });
    const found = await getLeadByToken(lead.token);
    expect(found.id).toBe(lead.id);
    expect(await getLeadByToken('nope')).toBeNull();
  });

  it('touches lastSeenAt', async () => {
    const { lead } = await createOrGetLead('evt_1', { email: 'd@x.com' });
    expect(lead.lastSeenAt).toBeNull();
    await touchLastSeen('evt_1', lead.id);
    expect((await getLeadById('evt_1', lead.id)).lastSeenAt).toBeTruthy();
  });

  it('revokes a lead', async () => {
    const { lead } = await createOrGetLead('evt_1', { email: 'd@x.com' });
    await setRevoked('evt_1', lead.id, true);
    expect((await getLeadById('evt_1', lead.id)).revoked).toBe(true);
  });
});
