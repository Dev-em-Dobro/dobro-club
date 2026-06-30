// Gera (ou recupera) um magic link para um lead, sem precisar de servidor nem curl.
// Uso:  node scripts/magic-link.js "Nome" email@exemplo.com
//       npm run link -- "Nome" email@exemplo.com
// Evento: usa EVENT_ID (padrão evt_demo). Base do link: DOBRO_BASE_URL (padrão http://localhost:3001).
import { createOrGetLead } from '../server/leads.js';
import { buildMagicLink } from '../server/auth/token.js';

const [name = 'Convidado', email = 'teste@dobro.club'] = process.argv.slice(2);
const eventId = process.env.EVENT_ID || 'evt_demo';

const { lead, isNew } = await createOrGetLead(eventId, { name, email });

console.log('');
console.log(`  Evento : ${eventId}`);
console.log(`  Lead   : ${lead.name} <${lead.email}>  (${isNew ? 'novo' : 'já existia'})`);
console.log('  Magic link:');
console.log(`  ${buildMagicLink(lead.token)}`);
console.log('');
console.log('  Abra esse link com o servidor rodando (npm start) para entrar logado.');
console.log('');
