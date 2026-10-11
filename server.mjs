// Local run: `npm start`. Uses Neon when DATABASE_URL is set, otherwise an embedded Postgres in ./data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { connectPostgres, connectPglite } from './lib/db.mjs';
import { createApp } from './lib/app.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(ROOT, 'data'); fs.mkdirSync(dataDir, { recursive: true });
const keyFile = path.join(dataDir, 'vault.key');
if (!process.env.VAULT_KEY) {
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  process.env.VAULT_KEY = fs.readFileSync(keyFile, 'utf8').trim();
}
const keysFile = path.join(dataDir, 'local-keys.json');
if (!fs.existsSync(keysFile)) fs.writeFileSync(keysFile, JSON.stringify({ reviewer: crypto.randomBytes(18).toString('base64url'), analyst: crypto.randomBytes(18).toString('base64url'), webhook: crypto.randomBytes(24).toString('base64url') }, null, 2), { mode: 0o600 });
const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));

// Without an OpenRouter key, a local run talks straight to Ollama on this computer.
if (!process.env.OPENROUTER_API_KEY) {
  process.env.LLM_PROVIDER ||= 'ollama';
  process.env.LOCAL_OLLAMA_URL ||= 'http://127.0.0.1:11434';
}
const db = process.env.DATABASE_URL ? await connectPostgres(process.env.DATABASE_URL) : await connectPglite(path.join(dataDir, 'pglite'));
const app = await createApp({ db, keys: process.env.DATABASE_URL ? undefined : keys, timer: true });
const port = Number(process.env.PORT || 8765);
app.server.listen(port, '127.0.0.1', () => console.log(`\nמעגל מכירות | Sales & Knowledge Agent\nhttp://127.0.0.1:${port}\n${process.env.DATABASE_URL ? 'מסד נתונים: Neon' : 'מסד נתונים מקומי. קודי גישה מקומיים: data/local-keys.json'}\n`));
