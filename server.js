import { createApp } from './server/app.js';

const port = process.env.PORT || 3001;
createApp().listen(port, () => {
  console.log(`Dobro Club API on :${port}`);
});
