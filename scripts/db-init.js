import "./load-env.js";
import { initSchema } from '../server/db.js';
await initSchema();
console.log('schema ready');
process.exit(0);
