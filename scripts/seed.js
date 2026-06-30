import { writeJson } from '../server/data/store.js';
import { hashApiKey } from '../server/events.js';

await writeJson('events/evt_demo.json', {
  id: 'evt_demo',
  slug: 'demo',
  name: 'Demo Dobro Club',
  status: 'active',
  apiKeyHash: hashApiKey('demo-key'),
  webhookUrl: null,
  createdAt: new Date().toISOString()
});
console.log('seeded evt_demo (api key: demo-key)');
