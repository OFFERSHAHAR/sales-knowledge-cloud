import { AsyncLocalStorage } from 'node:async_hooks';

// Postgres returns unquoted identifiers in lower case; the app uses camelCase names.
const CAMEL = { runid: 'runId', errortype: 'errorType', durationms: 'durationMs', createdat: 'createdAt', updatedat: 'updatedAt', userid: 'userId', dueat: 'dueAt', ticketid: 'ticketId', alertid: 'alertId', codehash: 'codeHash', displayname: 'displayName' };
const camel = row => { if (!row) return row; const out = {}; for (const [k, v] of Object.entries(row)) out[CAMEL[k] || k] = v; return out; };
// SQLite-style ? placeholders become $1..$n.
const numbered = sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS kb(id TEXT PRIMARY KEY, topic TEXT, title TEXT, keywords TEXT, answer TEXT, source TEXT, version INTEGER);
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, timestamp TEXT, status TEXT, fallback INTEGER, review INTEGER, tool INTEGER, errorType TEXT, durationMs INTEGER, engine TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY, kind TEXT, runId TEXT, status TEXT, payload TEXT, version INTEGER DEFAULT 1, createdAt TEXT, updatedAt TEXT);
CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, topic TEXT, question TEXT UNIQUE, count INTEGER, priority TEXT, status TEXT, runId TEXT, createdAt TEXT, updatedAt TEXT);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, timestamp TEXT, runId TEXT, actor TEXT, action TEXT, target TEXT, status TEXT, errorType TEXT);
CREATE TABLE IF NOT EXISTS feedback(runId TEXT PRIMARY KEY REFERENCES runs(id), rating INTEGER CHECK(rating IN (-1,1)), timestamp TEXT);
CREATE TABLE IF NOT EXISTS events(seq BIGSERIAL PRIMARY KEY, id TEXT UNIQUE, timestamp TEXT, runId TEXT, stage TEXT, status TEXT, detail TEXT, previous TEXT, hash TEXT);
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, role TEXT, state TEXT, strikes INTEGER DEFAULT 0, displayName TEXT, codeHash TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY, runId TEXT, userId TEXT, type TEXT, level INTEGER, owner TEXT, status TEXT, createdAt TEXT, updatedAt TEXT, dueAt BIGINT, evidence TEXT);
CREATE TABLE IF NOT EXISTS screenshots(id TEXT PRIMARY KEY, alertId TEXT, createdAt TEXT, png TEXT, sha256 TEXT);
CREATE TABLE IF NOT EXISTS persistent_sessions(id TEXT PRIMARY KEY, payload TEXT, expires BIGINT, userId TEXT);
CREATE TABLE IF NOT EXISTS ticket_runs(ticketId TEXT, runId TEXT, timestamp TEXT, PRIMARY KEY(ticketId, runId));
CREATE TABLE IF NOT EXISTS evidence_tokens(id TEXT PRIMARY KEY, alertId TEXT, expires BIGINT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT, updatedAt TEXT);
`;

// One small async API over either node-postgres (Neon) or PGlite (tests, local runs).
function wrap(exec, transaction) {
  const als = new AsyncLocalStorage();
  const run = (sql, params = []) => (als.getStore() || exec)(numbered(sql), params);
  return {
    all: async (sql, ...p) => (await run(sql, p)).map(camel),
    get: async (sql, ...p) => camel((await run(sql, p))[0]),
    run: async (sql, ...p) => { await run(sql, p); },
    exec: async sql => { for (const s of sql.split(';').map(x => x.trim()).filter(Boolean)) await run(s); },
    // Nested calls join the outer transaction, so everything inside commits or rolls back together.
    tx: fn => als.getStore() ? fn() : transaction(client => als.run(client, fn)),
  };
}

export async function connectPostgres(url) {
  const { default: pg } = await import('pg');
  pg.types.setTypeParser(20, Number); pg.types.setTypeParser(1700, Number);
  const pool = new pg.Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: true }, idleTimeoutMillis: 10000 });
  const db = wrap(async (sql, params) => (await pool.query(sql, params)).rows, async fn => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(async (sql, params) => (await client.query(sql, params)).rows);
      await client.query('COMMIT'); return out;
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  });
  db.close = () => pool.end();
  return db;
}

export async function connectPglite(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite(dataDir, { parsers: { 20: Number, 1700: Number } });
  const db = wrap(async (sql, params) => (await pg.query(sql, params)).rows, fn => pg.transaction(tx => fn(async (sql, params) => (await tx.query(sql, params)).rows)));
  db.close = () => pg.close();
  return db;
}
