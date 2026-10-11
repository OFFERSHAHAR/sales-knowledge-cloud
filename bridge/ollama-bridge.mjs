// Ollama bridge for a team that wants the cloud system to use its own local model.
// It exposes only POST /api/chat, requires a random bearer token, and forwards to Ollama on this computer.
// Usage: node ollama-bridge.mjs   (no dependencies; Node 18+)
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

const PORT = Number(process.env.BRIDGE_PORT || 11500);
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const tokenFile = new URL('./bridge-token.txt', import.meta.url);
if (!fs.existsSync(tokenFile)) fs.writeFileSync(tokenFile, crypto.randomBytes(24).toString('base64url'), { mode: 0o600 });
const TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
const same = (a, b) => typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/chat') return json(res, 404, { error: 'not found' });
  if (!same(req.headers.authorization, `Bearer ${TOKEN}`)) return json(res, 401, { error: 'unauthorized' });
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 64000) return json(res, 413, { error: 'too large' }); chunks.push(c); }
  try {
    const up = await fetch(OLLAMA + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks), signal: AbortSignal.timeout(55000) });
    res.writeHead(up.status, { 'Content-Type': 'application/json' }); res.end(Buffer.from(await up.arrayBuffer()));
  } catch { json(res, 502, { error: 'ollama unavailable' }); }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\nOllama bridge listening on http://127.0.0.1:${PORT} -> ${OLLAMA}`);
  console.log(`Bridge token (paste into "חיבור מודל"): ${TOKEN}\n`);
});
