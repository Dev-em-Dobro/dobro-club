import 'dotenv/config';
import { createApp } from './server/app.js';
import { initSchema } from './server/db.js';

const SECRET = process.env.DOBRO_SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!SECRET || SECRET === 'dev-secret-change-me')) {
  throw new Error('DOBRO_SESSION_SECRET must be set to a strong, non-default value in production');
}

await initSchema();

const port = process.env.PORT || 3001;
createApp().listen(port, () => console.log(`Dobro Club API on :${port}`));
