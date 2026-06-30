import { createApp } from './server/app.js';

const SECRET = process.env.DOBRO_SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!SECRET || SECRET === 'dev-secret-change-me')) {
  throw new Error('DOBRO_SESSION_SECRET must be set to a strong, non-default value in production');
}

const port = process.env.PORT || 3001;
createApp().listen(port, () => {
  console.log(`Dobro Club API on :${port}`);
});
