// Creates personal access codes in the database named by DATABASE_URL.
// Usage: node scripts/accounts.mjs <managers> <salespeople> [output file]
// Codes are written only to the output file (default ACCESS-CODES.txt, git-ignored); the database stores an HMAC of each code.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { connectPostgres } from '../lib/db.mjs';
import { createApp } from '../lib/app.mjs';

const [managers = '5', sales = '5', out = 'ACCESS-CODES.txt'] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !process.env.VAULT_KEY) { console.error('DATABASE_URL and VAULT_KEY are required'); process.exit(1); }
const db = await connectPostgres(process.env.DATABASE_URL);
const app = await createApp({ db });
const lines = ['מעגל מכירות — קודי גישה אישיים', 'כתובת: https://sales-knowledge-ofer.vercel.app', 'כל קוד שייך לאדם אחד. אין לפרסם את הקובץ.', ''];
const make = async (role, prefix, label, n) => {
  for (let i = 1; i <= n; i++) {
    const id = `${prefix}-${String(i).padStart(2, '0')}`, code = crypto.randomBytes(15).toString('base64url');
    await db.run('INSERT INTO accounts(id,role,state,strikes,displayName,codeHash) VALUES(?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET codeHash=excluded.codeHash, state=\'active\'', id, role, 'active', 0, `${label} ${i}`, app.vault.sign(code));
    lines.push(`${label} ${i} | תפקיד: ${role === 'reviewer' ? 'מנהל מכירות וידע' : 'איש מכירות'} | קוד: ${code}`);
  }
  lines.push('');
};
const owner = crypto.randomBytes(15).toString('base64url');
await db.run('INSERT INTO accounts(id,role,state,strikes,displayName,codeHash) VALUES(?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET codeHash=excluded.codeHash, state=\'active\'', 'ofer', 'reviewer', 'active', 0, 'עופר', app.vault.sign(owner));
lines.push(`עופר (בעל המערכת) | תפקיד: מנהל מכירות וידע | קוד: ${owner}`, '');
await make('reviewer', 'manager', 'מנהל', Number(managers));
await make('analyst', 'sales', 'איש מכירות', Number(sales));
fs.writeFileSync(out, lines.join('\n'), { mode: 0o600 });
console.log(`Created ${managers} manager and ${sales} sales accounts. Codes written to ${out}`);
await db.close();
