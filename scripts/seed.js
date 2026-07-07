import "./load-env.js";
import { query, initSchema } from '../server/db.js';
import { hashApiKey } from '../server/events.js';

await initSchema();
await query(
  `INSERT INTO events (id, slug, name, status, api_key_hash, webhook_url, created_at)
   VALUES ('evt_demo','demo','Demo Dobro Club','active',$1,NULL,$2)
   ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name,
     status = EXCLUDED.status, api_key_hash = EXCLUDED.api_key_hash`,
  [hashApiKey('demo-key'), new Date().toISOString()]
);
console.log('seeded evt_demo (api key: demo-key)');
process.exit(0);
