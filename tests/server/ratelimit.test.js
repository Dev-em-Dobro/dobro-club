import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeLimiter } from '../../server/ratelimit.js';

describe('makeLimiter', () => {
  it('returns 429 after the limit is exceeded', async () => {
    const app = express();
    app.use(makeLimiter({ windowMs: 60000, max: 2 }));
    app.get('/x', (req, res) => res.send('ok'));

    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(429);
  });
});
