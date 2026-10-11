import { connectPostgres } from '../lib/db.mjs';
import { createApp } from '../lib/app.mjs';

// One app per warm function instance; every request shares its database pool.
let ready;
const app = () => ready ||= (async () => {
  if (!process.env.DATABASE_URL || !process.env.VAULT_KEY) throw new Error('DATABASE_URL and VAULT_KEY must be set');
  return createApp({ db: await connectPostgres(process.env.DATABASE_URL) });
})().catch(e => { ready = undefined; throw e; });

export default async function handler(req, res) {
  try { return await (await app()).handler(req, res); }
  catch (e) {
    console.error(e);
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ errorType: 'SERVICE_UNAVAILABLE', message: 'השירות אינו זמין כרגע. נסו שוב בעוד דקה.' }));
  }
}
export const config = { maxDuration: 60 };
