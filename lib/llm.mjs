import dns from 'node:dns/promises';
import net from 'node:net';

const fail = (status, type, message) => Object.assign(new Error(message), { status, type });

// Free OpenRouter model ids change often, so the list is read live and cached briefly.
// Preferred families are tried first because they follow JSON schemas and handle Hebrew well.
const PREFERRED = [/nemotron-3-super/i, /gemma-4-31b/i, /gemma-4/i, /nemotron-3-ultra/i, /qwen/i, /llama-3\.3-70b/i, /deepseek/i, /mistral/i, /gpt-oss/i, /gemma/i, /llama/i];
// Models for audio, safety screening or code, and very small models, follow the Hebrew JSON task poorly.
const UNSUITABLE = /vision|image|audio|embed|lyria|music|tts|safety|guard|code|coder|omni/i;
const tooSmall = id => { const m = id.match(/(\d+(?:\.\d+)?)b\b/i); return m && Number(m[1]) < 7; };
let cache = { at: 0, models: [] }, lastGood = null;
// Only ids ending in :free are ever called, and every request carries a zero price cap,
// so a paid model can never be billed even if an admin types one in.
export const isFreeModel = id => typeof id === 'string' && /^[\w.-]+\/[\w.:-]+:free$/.test(id);
export async function freeModels(fetchImpl = fetch) {
  if (Date.now() - cache.at < 30 * 60000 && cache.models.length) return cache.models;
  const r = await fetchImpl('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('models list unavailable');
  const { data } = await r.json();
  const free = data.filter(m => isFreeModel(m.id) && Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)
    .filter(m => !UNSUITABLE.test(m.id) && !tooSmall(m.id) && (m.context_length || 0) >= 8000)
    .map(m => ({ id: m.id, structured: (m.supported_parameters || []).includes('structured_outputs') }));
  const rank = m => { const i = PREFERRED.findIndex(rx => rx.test(m.id)); return (i < 0 ? 99 : i) * 2 + (m.structured ? 0 : 1); };
  cache = { at: Date.now(), models: free.sort((a, b) => rank(a) - rank(b)) };
  return cache.models;
}

export function parseJson(text) {
  if (typeof text !== 'string') throw new Error('empty');
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(body); } catch {}
  const start = body.indexOf('{'), end = body.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
  throw new Error('no json');
}

async function openRouterCall({ model, structured, system, user, schema, key, timeoutMs, fetchImpl }) {
  if (!isFreeModel(model)) throw new Error('paid model refused');
  const body = { model, temperature: 0, max_tokens: 2500, provider: { max_price: { prompt: 0, completion: 0, request: 0 } }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: structured ? { type: 'json_schema', json_schema: { name: 'sales_followup', strict: true, schema } } : { type: 'json_object' } };
  const r = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sales Knowledge Agent' }, body: JSON.stringify(body) });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    // The free daily allowance is shared by every free model; trying others would only waste time.
    if (r.status === 429 && /per-day|per day|daily/i.test(detail)) throw fail(429, 'FREE_QUOTA_EXHAUSTED', 'המכסה היומית של המודלים החינמיים נוצלה. אפשר לחבר אולמה של צוות במסך "חיבור מודל" או לנסות שוב מחר. לא בוצע חיוב.');
    if (r.status === 402) throw fail(402, 'PAYMENT_REFUSED', 'הבקשה דרשה תשלום ולכן נחסמה. המערכת משתמשת במודלים חינמיים בלבד.');
    throw new Error('status ' + r.status);
  }
  const payload = await r.json();
  const choice = payload.choices?.[0];
  if (!choice || choice.finish_reason === 'length') throw new Error('truncated');
  return parseJson(choice.message?.content);
}

// Blocks a team's bridge URL from pointing at this server's own network (SSRF).
function privateAddress(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const v = ip.toLowerCase(); return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && privateAddress(v.slice(7));
}
export async function checkBridgeUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw fail(400, 'BRIDGE_URL_INVALID', 'כתובת הגשר אינה תקינה.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || net.isIP(url.hostname)) throw fail(400, 'BRIDGE_URL_INVALID', 'כתובת הגשר חייבת להיות https עם שם מארח, בלי פורט ובלי פרטי התחברות.');
  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some(a => privateAddress(a.address))) throw fail(400, 'BRIDGE_URL_INVALID', 'כתובת הגשר מפנה לרשת פנימית או שאינה קיימת.');
  return url.origin;
}

async function ollamaCall({ base, model, token, system, user, schema, timeoutMs, fetchImpl, trusted }) {
  // Only a local run (server.mjs) sets LOCAL_OLLAMA_URL; every other address must pass the public-network check.
  const origin = trusted ? base : await checkBridgeUrl(base);
  const r = await fetchImpl(origin + '/api/chat', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ model, stream: false, think: false, format: schema, options: { temperature: 0, num_predict: 700, num_ctx: 4096 }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
  if (!r.ok) throw new Error('status ' + r.status);
  const payload = await r.json();
  if (!payload.done || payload.done_reason === 'length') throw new Error('truncated');
  return parseJson(payload.message?.content);
}

// settings: {provider:'openrouter'|'ollama', openrouterModel?, ollamaUrl?, ollamaModel?, ollamaToken?}
export async function callModel({ settings, system, user, schema, env = process.env, fetchImpl = fetch, budgetMs = 55000 }) {
  const deadline = Date.now() + budgetMs, left = () => deadline - Date.now();
  if (settings.provider === 'ollama') {
    if (!settings.ollamaUrl || !settings.ollamaModel) throw fail(503, 'LLM_NOT_CONFIGURED', 'גשר האולמה לא הוגדר. מנהל יכול להגדיר אותו במסך "חיבור מודל".');
    try { return { raw: await ollamaCall({ base: settings.ollamaUrl, model: settings.ollamaModel, token: settings.ollamaToken, system, user, schema, timeoutMs: Math.min(left(), 50000), fetchImpl, trusted: !!env.LOCAL_OLLAMA_URL && settings.ollamaUrl === env.LOCAL_OLLAMA_URL }), engine: `ollama-bridge/${settings.ollamaModel}` }; }
    catch (e) { if (e.type) throw e; throw fail(503, 'LLM_UNAVAILABLE', 'הגשר לאולמה של הצוות לא החזיר תשובה תקינה בזמן. בדקו שהגשר והמודל פועלים. הפנייה נשמרה לבדיקה.'); }
  }
  const key = env.OPENROUTER_API_KEY;
  if (!key) throw fail(503, 'LLM_NOT_CONFIGURED', 'מפתח OpenRouter לא הוגדר בשרת.');
  let candidates = [];
  try { candidates = await freeModels(fetchImpl); } catch {}
  // An admin's chosen model goes first, then the model that last answered, then the ranked list.
  const first = [settings.openrouterModel, lastGood].filter(isFreeModel);
  candidates = [...first.map(id => candidates.find(m => m.id === id) || { id, structured: false }), ...candidates.filter(m => !first.includes(m.id))];
  if (!candidates.length) throw fail(503, 'LLM_UNAVAILABLE', 'לא נמצא מודל חינמי זמין ב-OpenRouter כרגע. הפנייה נשמרה לבדיקה.');
  // Every attempt counts against the free daily allowance, so at most three models are tried.
  for (const m of candidates.slice(0, 3)) {
    if (left() < 6000) break;
    try { const raw = await openRouterCall({ model: m.id, structured: m.structured, system, user, schema, key, timeoutMs: Math.min(left(), 40000), fetchImpl }); lastGood = m.id; return { raw, engine: `openrouter/${m.id}` }; }
    catch (e) { if (e.type) throw e; if (lastGood === m.id) lastGood = null; }
  }
  throw fail(503, 'LLM_UNAVAILABLE', 'המודלים החינמיים ב-OpenRouter לא החזירו תשובה תקינה בזמן. אפשר לנסות שוב או לחבר אולמה של הצוות. הפנייה נשמרה לבדיקה.');
}
