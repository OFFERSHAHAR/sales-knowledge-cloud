import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createVault, verifyChain, SQL_ATTACK, normalizeThreat } from '../security.mjs';
import { SCHEMA } from './db.mjs';
import { callModel, checkBridgeUrl, freeModels, isFreeModel } from './llm.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROMPT = fs.readFileSync(path.join(ROOT, 'system-prompt.txt'), 'utf8');
const SEED = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed.json'), 'utf8'));
const STEP_TITLES = ['לתאם פגישת המשך', 'להכין הצעה לבדיקה', 'לברר מידע חסר', 'לחזור ללקוח'];
const INJECTION = /ignore\s+(all\s+)?(previous|prior|system)\s+instructions|reveal.{0,30}(system|prompt)|system\s*prompt|answer\s+even\s+if|without\s+permission|delete\s+(all|database|records)|send\s+(email|mail)|התעלם.{0,25}(הוראות|קודמות)|חשוף.{0,25}(פרומפט|prompt|מערכת)|גלה.{0,25}(פרומפט|הוראות)|שלח.{0,20}ללא אישור|מחק.{0,20}(מידע|רשומות|הכל)|ענה.{0,25}(לא יודע|בלי מידע)|<\/?(script|iframe)|javascript:|\[INST\]|<\|system|role\s*[:=]\s*["']?system/iu;
const stamp = () => new Date().toISOString();
const uid = p => `${p}-${crypto.randomUUID()}`;
const clean = s => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[דוא״ל הוסר]').replace(/(?:\+?972[- ]?|0)5\d[- ]?\d{3}[- ]?\d{4}/g, '[טלפון הוסר]').replace(/\b(?:sk-[\w-]+|\d{13,19})\b/g, '[סוד הוסר]');
const fail = (status, type, message) => Object.assign(new Error(message), {status, type});
function text(value, name, min=1, max=1000) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw fail(400, 'INVALID_INPUT', `שדה ${name} אינו תקין או חורג מהמגבלה (${max}).`);
  return value.trim();
}
function shape(obj, keys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).some(k => !keys.includes(k))) throw fail(400, 'INVALID_SCHEMA', 'מבנה הבקשה אינו מורשה.');
}
function safeKnowledge(value) {
  if (INJECTION.test(normalizeThreat(value)) || SQL_ATTACK.test(normalizeThreat(value))) throw fail(422,'KNOWLEDGE_INJECTION','ניסיון הזרקה בהצעת הידע נחסם. החשבון הארגוני הוכנס להסגר.');
  if (/\bsk-[\w-]+\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?972[- ]?|0)5\d[- ]?\d{3}[- ]?\d{4}|\b\d{13,19}\b/iu.test(value)) throw fail(400, 'UNSAFE_KNOWLEDGE', 'הידע מכיל מידע רגיש. נדרש ניסוח עובדתי ללא פרטים אישיים.');
}
function questionTopic(q) {
  const groups = [['מחיר', /מחיר|עלות|עולה|price|cost|תשלום/i], ['אבטחה', /אבטח|פרטיות|הצפנ|תקן|iso|security|privacy/i], ['אינטגרציות', /אינטגר|crm|api|חיבור|integration/i], ['הטמעה', /הטמע|הקמה|זמן|implementation/i], ['תמיכה', /תמיכ|support/i], ['מסחרי', /הנחה|חוזה|התחייב|discount/i]];
  return groups.find(([, rx]) => rx.test(q))?.[0] || 'כללי';
}
// Models often rephrase instead of quoting. A rephrased quote is replaced by the source
// sentence it clearly came from, so only text that literally appears in the notes is ever kept.
const STOP = new Set(['האם','אם','את','של','על','עם','גם','כי','זה','זו','הוא','היא','הם','לא','מה','או','אך','כל']);
const terms = s => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).map(w => w.length > 3 && /^[והבלמשכ]/.test(w) ? w.slice(1) : w).filter(w => w.length > 1 && !STOP.has(w)));
export function groundQuote(q, notes) {
  if (typeof q !== 'string') return null;
  const t = q.trim();
  if (t.length >= 5 && notes.includes(t)) return t;
  const want = terms(t);
  if (want.size < 2) return null;
  let best = null, score = 0;
  for (const s of notes.split(/(?<=[.!?…])\s+|\n+/u).map(x => x.trim()).filter(x => x.length >= 5 && x.length <= 250)) {
    const have = terms(s), shared = [...want].filter(w => have.has(w)).length;
    if (shared >= 2 && shared / want.size > score) { score = shared / want.size; best = s; }
  }
  return score >= 0.6 ? best : null;
}
export function validateModel(obj, notes) {
  try {
    shape(obj, ['summaryQuotes', 'needs', 'nextSteps']);
    for (const field of ['summaryQuotes','needs','nextSteps']) if (!Array.isArray(obj[field]) || obj[field].length > 3) throw new Error('array');
    const ground = list => [...new Set(list.map(q => groundQuote(q, notes)).filter(q => q && !INJECTION.test(q)))];
    obj.nextSteps.forEach(s => { shape(s, ['title','evidence']); if (!STEP_TITLES.includes(s.title)) throw new Error('action'); });
    obj = {summaryQuotes: ground(obj.summaryQuotes), needs: ground(obj.needs), nextSteps: obj.nextSteps.map(s => ({title: s.title, evidence: groundQuote(s.evidence, notes)})).filter(s => s.evidence && !INJECTION.test(s.evidence))};
    if (!obj.summaryQuotes.length) obj.summaryQuotes = obj.needs.slice(0, 3);
    const quote = q => { text(q, 'quote', 5, 250); if (!notes.includes(q) || INJECTION.test(q)) throw new Error('ungrounded'); };
    obj.summaryQuotes.forEach(quote); obj.needs.forEach(quote); obj.nextSteps.forEach(s => quote(s.evidence));
    if (JSON.stringify(obj).length > 3000 || [...obj.summaryQuotes,...obj.needs,...obj.nextSteps.map(s=>s.evidence)].join('').length > 1200) throw new Error('length');
    if (!obj.summaryQuotes.length) throw new Error('empty');
    return obj;
  } catch { throw fail(502, 'MODEL_OUTPUT_INVALID', 'פלט המודל לא עבר בדיקת מקור וסכמה. נדרשת בדיקה אנושית.'); }
}
const OUTPUT_SCHEMA = {type:'object',additionalProperties:false,required:['summaryQuotes','needs','nextSteps'],properties:{summaryQuotes:{type:'array',maxItems:3,items:{type:'string'}},needs:{type:'array',maxItems:3,items:{type:'string'}},nextSteps:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['title','evidence'],properties:{title:{type:'string',enum:STEP_TITLES},evidence:{type:'string'}}}}}};
const STATIC = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/capture.js':'capture.js','/checklist.json':'checklist.json','/guide.html':'guide.html','/guide.css':'guide.css','/favicon.svg':'favicon.svg'};
const MIME = {html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml'};

export async function createApp(options={}) {
  const env = options.env || process.env;
  const db = options.db;
  const vault = createVault(options.vaultKey || Buffer.from(env.VAULT_KEY || '', 'base64'));
  await db.exec(SCHEMA);
  // Test and local runs pass fixed codes; the cloud deployment creates personal accounts with scripts/accounts.mjs.
  if (options.keys) {
    await db.run('INSERT INTO accounts(id,role,state,strikes,displayName,codeHash) VALUES(?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING','ofer','reviewer','active',0,'עופר',vault.sign(options.keys.reviewer));
    await db.run('INSERT INTO accounts(id,role,state,strikes,displayName,codeHash) VALUES(?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING','sales-demo','analyst','active',0,'איש מכירות · דמו',vault.sign(options.keys.analyst));
  }
  if (!(await db.get('SELECT COUNT(*) AS n FROM kb')).n) for (const k of SEED) await db.run('INSERT INTO kb VALUES(?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING',k.id,k.topic,vault.seal(k.title),vault.seal(JSON.stringify(k.keywords)),vault.seal(k.answer),vault.seal(k.source),k.version);
  const webhookKey = env.WEBHOOK_KEY || options.keys?.webhook;
  const allowedHosts = (env.ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean);
  const escalationMs = options.escalationMs || 60000;
  const rates = new Map(); let activeLLM = 0, lastTick = 0;

  async function settings() {
    const rows = await db.all('SELECT key,value FROM settings');
    const s = Object.fromEntries(rows.map(r => [r.key, vault.open(r.value)]));
    return {provider: s.provider || env.LLM_PROVIDER || 'openrouter', openrouterModel: s.openrouterModel || env.OPENROUTER_MODEL || '', ollamaUrl: s.ollamaUrl || env.LOCAL_OLLAMA_URL || '', ollamaModel: s.ollamaModel || env.OLLAMA_MODEL || (env.LOCAL_OLLAMA_URL ? 'gemma4:latest' : ''), ollamaToken: s.ollamaToken || ''};
  }
  const engineLabel = s => options.llm ? 'test-provider' : s.provider === 'ollama' ? `גשר אולמה · ${s.ollamaModel || 'לא הוגדר'}` : `OpenRouter · ${s.openrouterModel || 'מודל חינמי אוטומטי'}`;
  const kbRows = async () => (await db.all('SELECT * FROM kb ORDER BY id')).map(k=>({...k,title:vault.open(k.title),answer:vault.open(k.answer),source:vault.open(k.source),keywords:JSON.parse(vault.open(k.keywords))}));
  // The audit chain is serialized with a transaction-scoped lock so concurrent requests cannot fork it.
  const event = (runId,stage,status,detail={}) => db.tx(async () => {
    await db.get('SELECT pg_advisory_xact_lock(731400) AS locked');
    const id=uid('EVT'),timestamp=stamp(),sealed=vault.seal(JSON.stringify(detail)),previous=(await db.get('SELECT hash FROM events ORDER BY seq DESC LIMIT 1'))?.hash||'GENESIS';
    const hash=vault.sign([id,timestamp,runId,stage,status,sealed,previous].join('|'));
    await db.run('INSERT INTO events(id,timestamp,runId,stage,status,detail,previous,hash) VALUES(?,?,?,?,?,?,?,?)',id,timestamp,runId,stage,status,sealed,previous,hash);
  });
  const audit = async (runId, actor, action, target, status='success', errorType=null) => {await db.run('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)',uid('AUD'),stamp(),runId,actor,action,target,status,errorType);await event(runId,action,status,{actor,target,errorType});};
  const log = async r => {const safe={...r};delete safe.evidenceToken;await db.run('INSERT INTO runs VALUES(?,?,?,?,?,?,?,?,?,?)',r.runId,r.timestamp,r.status,+r.fallback,+r.review,+r.tool,r.errorType,r.durationMs,r.engine,vault.seal(JSON.stringify(safe)));await event(r.runId,'response',r.status,safe);};
  const addItem = async (kind, runId, payload) => {
    const id=uid(kind.toUpperCase()), now=stamp(); await db.run('INSERT INTO items(id,kind,runId,status,payload,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)',id,kind,runId,'pending',vault.seal(JSON.stringify(payload)),now,now); return id;
  };
  async function search(q) {
    // Retrieval is lexical and conservative; use vetted semantic retrieval when the KB grows.
    const lower=q.toLowerCase();
    const found=(await kbRows()).map(k=>({k,score:k.keywords.reduce((n,w)=>n+(lower.includes(w.toLowerCase())?w.length:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if (!found.length || (found.length>1 && found[0].score === found[1].score)) return null;
    const best=found[0].k;
    // Unknown qualifiers and negations must not be answered by a broad FAQ match.
    const tokens=lower.replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(t=>t.length>2);
    const generic=new Set(['מהו','מהם','מהן','האם','כמה','מה','של','את','הוא','היא','יש','the','what','does','how','you','your','לחבילה','חבילה','חבילת','הבסיס','בסיס','מוצר','המוצר','שירות','השירות','אפשר','ניתן','לכם','שלכם']);
    const corpus=(best.title+' '+best.answer+' '+best.keywords.join(' ')).toLowerCase();
    if (tokens.some(t=>!generic.has(t) && !corpus.includes(t) && !best.keywords.some(w=>t.includes(w.toLowerCase())))) return null;
    return best;
  }
  const linkRun = (ticketId,runId,now) => db.run('INSERT INTO ticket_runs VALUES(?,?,?) ON CONFLICT DO NOTHING',ticketId,runId,now);
  async function ticket(q,runId) {
    const question=clean(q).replace(/\s+/g,' ').trim(), topic=questionTopic(question), now=stamp();
    const existing=(await db.all('SELECT * FROM tickets')).find(t=>vault.open(t.question)===question);
    if (existing) {
      const count=existing.count+1,priority=count>=3?'גבוהה':/אבטחה|מסחרי/.test(topic)?'גבוהה':'בינונית';
      await db.run('UPDATE tickets SET count=?,priority=?,status=?,updatedAt=? WHERE id=?',count,priority,existing.status==='resolved'?'reopened':existing.status,now,existing.id); await linkRun(existing.id,runId,now); return existing.id;
    }
    const id=uid('GAP'); await db.run('INSERT INTO tickets VALUES(?,?,?,?,?,?,?,?,?)',id,topic,vault.seal(question),1,/אבטחה|מסחרי/.test(topic)?'גבוהה':'בינונית','open',runId,now,now); await linkRun(id,runId,now); return id;
  }
  // Every question the knowledge base already answers, mapped to the record that answers it.
  async function answeredQuestions() {
    const probes=['מה מחיר חבילת הבסיס?','כמה זמן לוקחת הטמעה?','מה שעות התמיכה?'];
    for(const i of await db.all("SELECT payload FROM items WHERE kind='knowledge' AND status='approved'")){const p=JSON.parse(vault.open(i.payload));if(p.question)probes.push(p.question);}
    const out=new Map();for(const q of probes){const id=(await search(q))?.id;if(id)out.set(q,id);}return out;
  }
  async function tool(name,input,ctx) {
    const contracts={kb_search:['question'],create_missing_ticket:['question'],create_sales_task:['title','evidence'],create_email_draft:['subject','body']};
    if (!contracts[name] || ctx.actor !== 'orchestrator') throw fail(403,'TOOL_FORBIDDEN','הכלי או הפעולה אינם מורשים.');
    shape(input,contracts[name]);await event(ctx.runId,'tool_request','validated',{tool:name,input});
    let result;
    if (name==='kb_search') result=await search(text(input.question,'question',2,400));
    if (name==='create_missing_ticket') result={id:await ticket(text(input.question,'question',2,400),ctx.runId)};
    if (name==='create_sales_task') {
      if (!STEP_TITLES.includes(input.title) || !ctx.notes.includes(text(input.evidence,'evidence',5,250))) throw fail(400,'TOOL_SCHEMA','אסמכתת המשימה אינה תקינה.');
      result={id:await addItem('task',ctx.runId,input)};
    }
    if (name==='create_email_draft') {text(input.subject,'subject',2,100);text(input.body,'body',5,5000);result={id:await addItem('draft',ctx.runId,input)};}
    await audit(ctx.runId,'orchestrator',name,result?.id || 'kb','success');await event(ctx.runId,'tool_result','success',{tool:name,result}); return result;
  }
  const owners=['אחראי אבטחה','מנהל צוות','מנהל מערכת'];
  async function securityIncident(runId,userId,type,detail) {
    const id=uid('ALERT'),now=stamp();
    await db.run('INSERT INTO alerts VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,runId,userId||'external',type,1,owners[0],'open',now,now,Date.now()+escalationMs,vault.seal(JSON.stringify(detail)));
    if(userId){await db.run("UPDATE accounts SET state='quarantined',strikes=strikes+1 WHERE id=?",userId);await db.run('DELETE FROM persistent_sessions WHERE userId=?',userId);}
    await event(runId,'security_alert','open',{alertId:id,userId:userId||'external',owner:owners[0],level:1,quarantined:!!userId,type});
    const token=crypto.randomBytes(24).toString('base64url');await db.run('INSERT INTO evidence_tokens VALUES(?,?,?)',vault.sign(token),id,Date.now()+120000);return {alertId:id,evidenceToken:token};
  }
  async function escalationTick() {
    lastTick=Date.now();
    for(const a of await db.all("SELECT * FROM alerts WHERE status='open' AND level<3 AND dueAt<?",Date.now())) {
      const level=a.level+1;await db.run('UPDATE alerts SET level=?,owner=?,updatedAt=?,dueAt=? WHERE id=?',level,owners[level-1],stamp(),Date.now()+escalationMs,a.id);
      await event(a.runId,'hierarchy_escalation','open',{alertId:a.id,level,owner:owners[level-1]});
    }
  }
  async function housekeeping() {
    await db.run('DELETE FROM persistent_sessions WHERE expires<?',Date.now());await db.run('DELETE FROM evidence_tokens WHERE expires<?',Date.now());
    for(const [k,v] of rates)if(Date.now()-v.start>60000)rates.delete(k);
  }
  async function workflow(body,actor='analyst',mode='sales',userId=null) {
    const started=Date.now(); const r={runId:uid('RUN'),timestamp:stamp(),status:'success',fallback:false,review:false,tool:false,errorType:null,engine:'guardrails',durationMs:0,mode,actor,userId};
    try {
      shape(body,mode==='sales'?['notes','questions']:['question']);
      const notes=mode==='sales'?text(body.notes,'הערות',15,4000):'';
      const questions=mode==='sales'?(body.questions??[]):[text(body.question,'שאלה',2,400)];
      if (!Array.isArray(questions)||questions.length>5) throw fail(400,'INVALID_INPUT','עד 5 שאלות בכל שיחה.');
      questions.forEach(q=>text(q,'שאלה',2,400));
      const normalized=normalizeThreat(notes+' '+questions.join(' '));
      await event(r.runId,'input','received',{actor,userId,mode,notes:clean(notes),questions:questions.map(clean)});
      if (INJECTION.test(normalized)) throw fail(422,'PROMPT_INJECTION','זוהו הוראות חשודות. הבקשה נחסמה והחשבון הארגוני הוכנס להסגר.');
      if (SQL_ATTACK.test(normalized)) throw fail(422,'SQL_INJECTION','זוהה ניסיון הזרקת SQL. הבקשה נחסמה והחשבון הארגוני הוכנס להסגר.');
      await event(r.runId,'validation','passed',{schema:true,length:true,injectionScreen:true});
      r.risk=/הנחה|חוזה|התחייב|discount|guarantee|רגיש|רפואי|כרטיס אשראי/iu.test(notes+' '+questions.join(' '))?'high':'low';
      r.escalation=r.risk==='high'?'מנהל מכירות / אחראי אבטחה':'מנהל מכירות';
      r.answers=[];r.ticketIds=[];r.taskIds=[];
      const ctx={actor:'orchestrator',runId:r.runId,notes:clean(notes)};
      const relevant=[];
      for (const rawQ of questions) {
        const q=clean(rawQ),k=await tool('kb_search',{question:q},ctx);r.tool=true;
        if (k) {r.answers.push({question:q,answer:k.answer,source:k.source,sourceId:k.id,version:k.version,grounded:true});relevant.push({id:k.id,answer:k.answer,source:k.source});}
        else {r.fallback=true;r.review=true;r.answers.push({question:q,answer:'אין מידע מאושר לשאלה זו. נפתח כרטיס ידע חסר לבדיקה אנושית.',source:null,grounded:false});r.ticketIds.push((await tool('create_missing_ticket',{question:q},ctx)).id);}
      }
      if (mode==='sales') {
        r.review=true;
        if (activeLLM>=4) throw fail(429,'LLM_BUSY','המודל עסוק. נסה שוב בעוד רגע.');
        activeLLM++;
        let result;
        try {
          const s=await settings();r.engine=engineLabel(s);
          await event(r.runId,'llm_request','started',{engine:r.engine,notes:ctx.notes,approvedKnowledge:relevant,promptHash:crypto.createHash('sha256').update(PROMPT).digest('hex')});
          let raw;
          if (options.llm) raw=await options.llm(ctx.notes,relevant);
          else {const out=await callModel({settings:s,system:PROMPT,user:JSON.stringify({dataOnly:true,notes:ctx.notes,approvedKnowledge:relevant}),schema:OUTPUT_SCHEMA,env,fetchImpl:options.fetchImpl});raw=out.raw;r.engine=out.engine;}
          await event(r.runId,'llm_output','received',{engine:r.engine,output:raw});result=validateModel(raw,ctx.notes);await event(r.runId,'grounding','passed',{validated:result});
        } finally {activeLLM--;}
        r.summary=result.summaryQuotes;r.needs=result.needs;r.nextSteps=result.nextSteps;
        try {
          await db.tx(async () => {
            for (const step of result.nextSteps) r.taskIds.push((await tool('create_sales_task',step,ctx)).id);
            if (!r.taskIds.length) r.taskIds.push((await tool('create_sales_task',{title:'לחזור ללקוח',evidence:result.summaryQuotes[0]},ctx)).id);
            const answerText=r.answers.map(a=>a.grounded?`${a.question}\n${a.answer}\nמקור: ${a.source}`:`${a.question}\nנדרש בירור; אין תשובה מאושרת.`).join('\n\n');
            const draft={subject:'טיוטת המשך לשיחת המכירה',body:`שלום,\nתודה על השיחה. להלן הנקודות שתועדו בה (טעונות בדיקה):\n${result.summaryQuotes.map(q=>'• '+q).join('\n')}\n\n${answerText}\n\nצעדי המשך מוצעים:\n${result.nextSteps.map(s=>'• '+s.title).join('\n') || '• לחזור ללקוח'}\n\nטיוטה לבדיקה בלבד. אין בה התחייבות מסחרית.\nבברכה, צוות המכירות`};
            r.draftId=(await tool('create_email_draft',draft,ctx)).id;r.tool=true;
          });
        } catch(e) {r.taskIds=[];delete r.draftId;throw e;}
      }
      r.status=r.review||r.risk==='high'?'review':'success';r.review ||= r.risk==='high';
    } catch(e) {
      r.status=['PROMPT_INJECTION','SQL_INJECTION'].includes(e.type)?'blocked':e.status===400?'invalid':'error';r.errorType=e.type||'INTERNAL_ERROR';r.message=e.type?e.message:'אירעה שגיאה. הפנייה נרשמה לבדיקה.';r.httpStatus=e.status||500;
      if(!e.type) console.error(e);
      r.review=true;r.fallback=true;
      const id=await addItem('incident',r.runId,{errorType:r.errorType,escalation:r.errorType==='PROMPT_INJECTION'?'אחראי אבטחה':'מנהל מכירות / אחראי טכני'});r.incidentId=id;
      await audit(r.runId,actor,'workflow_failed',id,'error',r.errorType);
      if(r.status==='blocked') Object.assign(r,await securityIncident(r.runId,userId,r.errorType,{notes:clean(typeof body?.notes==='string'?body.notes:''),question:clean(typeof body?.question==='string'?body.question:''),questions:Array.isArray(body?.questions)?body.questions.filter(q=>typeof q==='string').map(clean):[]}));
    }
    r.durationMs=Date.now()-started;await log(r);return r;
  }
  async function state() {
    const runs=(await db.all('SELECT * FROM runs ORDER BY timestamp DESC LIMIT 200')).map(x=>{const result=JSON.parse(vault.open(x.result));delete result.evidenceToken;return {...x,result};});
    const totals=await db.get(`SELECT COUNT(*) AS n, SUM((status IN ('success','review'))::int) AS good, SUM(fallback) AS fallback, SUM(review) AS review, SUM(tool) AS tool, SUM((errorType IS NOT NULL)::int) AS errors, AVG(durationMs) AS latency FROM runs`);
    const n=totals.n, pct=x=>n?Math.round((x||0)/n*100):0;
    const items=(await db.all('SELECT * FROM items ORDER BY createdAt DESC LIMIT 200')).map(x=>({...x,payload:JSON.parse(vault.open(x.payload))}));
    const feedback=await db.get('SELECT COUNT(*) AS n, SUM((rating=1)::int) AS positive FROM feedback');
    const topics=await db.all('SELECT topic,SUM(count) AS count,COUNT(*) AS tickets FROM tickets GROUP BY topic ORDER BY count DESC');
    const calls=await db.all('SELECT ticketId,runId,timestamp FROM ticket_runs ORDER BY timestamp DESC');
    const tickets=(await db.all('SELECT * FROM tickets ORDER BY priority DESC,count DESC')).map(t=>({...t,question:vault.open(t.question),calls:calls.filter(c=>c.ticketId===t.id).map(({runId,timestamp})=>({runId,timestamp}))}));
    return {runs,items,kb:await kbRows(),tickets,audit:await db.all('SELECT * FROM audit ORDER BY timestamp DESC LIMIT 100'),metrics:{totalRuns:n,successRate:pct(totals.good),fallbackRate:pct(totals.fallback),humanReviewRate:pct(totals.review),toolUsageRate:pct(totals.tool),errorRate:pct(totals.errors),averageLatencyMs:Math.round(totals.latency||0),feedbackCount:feedback.n,positiveFeedbackRate:feedback.n?Math.round(feedback.positive/feedback.n*100):0,topMissingTopics:topics},engine:engineLabel(await settings())};
  }
  async function review(body,session) {
    if (session.role!=='reviewer') throw fail(403,'FORBIDDEN','הפעולה דורשת הרשאת מנהל.');
    shape(body,['id','version','decision']);text(body.id,'id',5,100);
    if (!['approve','reject'].includes(body.decision)||!Number.isInteger(body.version)) throw fail(400,'INVALID_INPUT','החלטה או גרסה לא תקינות.');
    const item=await db.get('SELECT * FROM items WHERE id=?',body.id);
    if (!item) throw fail(404,'NOT_FOUND','הרשומה לא נמצאה.');
    if (item.status!=='pending'||item.version!==body.version) throw fail(409,'STALE_REVIEW','הרשומה כבר טופלה או השתנתה. רענן את התצוגה.');
    const p=JSON.parse(vault.open(item.payload)), approved=body.decision==='approve',now=stamp();
    return db.tx(async () => {
      if (approved&&item.kind==='knowledge') {
        safeKnowledge(p.answer+' '+p.question+' '+p.source+' '+p.title);
        const t=await db.get('SELECT * FROM tickets WHERE id=?',p.ticketId);
        if (!t || t.status==='resolved') throw fail(409,'STALE_REVIEW','כרטיס הידע כבר נפתר.');
        const keywords=p.question.replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(w=>w.length>2 && !['האם','מהו','כמה','what','does','the'].includes(w));
        if (!keywords.length) throw fail(400,'INVALID_INPUT','השאלה אינה מכילה מילות חיפוש משמעותיות.');
        const before=await answeredQuestions();
        const kbId=uid('KB');await db.run('INSERT INTO kb VALUES(?,?,?,?,?,?,?)',kbId,t.topic,vault.seal(p.title),vault.seal(JSON.stringify(keywords)),vault.seal(p.answer),vault.seal(p.source),1);
        // The new record must answer its own question and must not take over or blank out an existing answer.
        if ((await search(p.question))?.id!==kbId) throw fail(409,'KB_REGRESSION','הרשומה החדשה לא תענה על השאלה שבכרטיס, כי היא חופפת לרשומה קיימת. האישור בוטל ובסיס הידע לא השתנה.');
        for (const [q,id] of before) if ((await search(q))?.id!==id) throw fail(409,'KB_REGRESSION',`הרשומה החדשה הייתה משנה את התשובה הקיימת לשאלה "${q}". האישור בוטל ובסיס הידע לא השתנה.`);
        await db.run('UPDATE tickets SET status=?,updatedAt=? WHERE id=?','resolved',now,t.id);
        p.kbId=kbId;
        for(const other of await db.all("SELECT * FROM items WHERE kind='knowledge' AND status='pending' AND id<>?",item.id))if(JSON.parse(vault.open(other.payload)).ticketId===t.id)await db.run("UPDATE items SET status='superseded',version=version+1,updatedAt=? WHERE id=?",now,other.id);
      }
      const status=approved?'approved':'rejected';
      await db.run('UPDATE items SET status=?,payload=?,version=version+1,updatedAt=? WHERE id=?',status,vault.seal(JSON.stringify(p)),now,item.id);
      await audit(item.runId,session.role,`${body.decision}_${item.kind}`,item.id);return {id:item.id,status};
    });
  }
  async function saveSettings(body,session) {
    shape(body,['provider','openrouterModel','ollamaUrl','ollamaModel','ollamaToken']);
    if (!['openrouter','ollama'].includes(body.provider)) throw fail(400,'INVALID_INPUT','ספק מודל לא תקין.');
    const next={provider:body.provider};
    if (body.openrouterModel!==undefined) next.openrouterModel=body.openrouterModel===''?'':text(body.openrouterModel,'מודל OpenRouter',3,120);
    if (next.openrouterModel && !isFreeModel(next.openrouterModel)) throw fail(400,'PAID_MODEL_REFUSED','מותר לבחור רק מודל חינמי, ששמו מסתיים ב-:free. המערכת לא משתמשת במודלים בתשלום.');
    if (body.provider==='ollama'||body.ollamaUrl) {
      next.ollamaUrl=await checkBridgeUrl(text(body.ollamaUrl,'כתובת הגשר',10,300));
      next.ollamaModel=text(body.ollamaModel,'שם המודל',2,80);if(!/^[\w.:/-]+$/.test(next.ollamaModel))throw fail(400,'INVALID_INPUT','שם מודל לא תקין.');
    }
    if (typeof body.ollamaToken==='string'&&body.ollamaToken!=='') next.ollamaToken=text(body.ollamaToken,'מפתח הגשר',16,200);
    const now=stamp();
    await db.tx(async()=>{for(const [k,v] of Object.entries(next))await db.run('INSERT INTO settings VALUES(?,?,?) ON CONFLICT (key) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt',k,vault.seal(v),now);
      await audit(uid('CFG'),session.userId,'update_llm_settings',next.provider);});
    return publicSettings();
  }
  async function publicSettings() {
    const s=await settings();
    return {provider:s.provider,openrouterModel:s.openrouterModel,ollamaUrl:s.ollamaUrl,ollamaModel:s.ollamaModel,hasBridgeToken:!!s.ollamaToken,openrouterConfigured:!!env.OPENROUTER_API_KEY,engine:engineLabel(s)};
  }
  async function readBody(req,limit=24000) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw fail(415,'CONTENT_TYPE','נדרש JSON.');
    let raw;
    if (req.body!==undefined) raw=typeof req.body==='string'?req.body:Buffer.isBuffer(req.body)?req.body.toString('utf8'):JSON.stringify(req.body);
    else {const chunks=[];let length=0;for await (const chunk of req) {length+=chunk.length;if(length>limit) throw fail(413,'PAYLOAD_TOO_LARGE','הבקשה גדולה מדי.');chunks.push(chunk);}raw=Buffer.concat(chunks).toString('utf8');}
    if (Buffer.byteLength(raw)>limit) throw fail(413,'PAYLOAD_TOO_LARGE','הבקשה גדולה מדי.');
    try {return JSON.parse(raw);} catch {throw fail(400,'INVALID_JSON','JSON לא תקין.');}
  }
  function rate(key,limit=60) {
    const now=Date.now(),r=rates.get(key);if(!r||now-r.start>60000){rates.set(key,{start:now,n:1});return;}
    if (++r.n>limit) throw fail(429,'RATE_LIMIT','יותר מדי בקשות. נסה שוב בעוד דקה.');
  }
  const secure=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
  async function sessionFor(sidHash) {
    if (!sidHash) return null;
    const row=await db.get('SELECT * FROM persistent_sessions WHERE id=?',sidHash);if(!row||row.expires<Date.now())return null;
    return JSON.parse(vault.open(row.payload));
  }
  async function handler(req,res) {
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
    const send=(status,obj,extra={})=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(obj));};
    const client=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    let session, endpoint;
    try {
      rate(client,options.rateLimit||120);
      const host=req.headers.host||'';
      const local=/^(localhost|127\.0\.0\.1):\d+$/.test(host);
      if(!local&&!allowedHosts.includes(host)) throw fail(403,'HOST_FORBIDDEN','גישה למארח זה אינה מורשית.');
      const proto=local?'http':'https';
      const url=new URL(req.url,`${proto}://${host}`);endpoint=url.pathname;
      if (endpoint==='/api/index') {endpoint=url.searchParams.get('route')||'';if(!/^\/api\/[\w/-]{1,150}$/.test(endpoint)) throw fail(400,'INVALID_PATH','נתיב לא תקין.');}
      if (req.method==='GET'&&STATIC[endpoint]) {const file=STATIC[endpoint];res.writeHead(200,{...headers,'Content-Type':MIME[file.split('.').pop()]});res.end(fs.readFileSync(path.join(ROOT,'public',file)));return;}
      if (req.method==='GET'&&endpoint==='/api/health') {await db.get('SELECT 1 AS ok');send(200,{status:'ok'});return;}
      if (req.method==='POST') {
        const origin=req.headers.origin;
        if (origin && origin!==`${proto}://${host}`) throw fail(403,'ORIGIN_FORBIDDEN','מקור הבקשה אינו מורשה.');
        if (req.headers['sec-fetch-site']==='cross-site') throw fail(403,'ORIGIN_FORBIDDEN','מקור הבקשה אינו מורשה.');
      }
      if (Date.now()-lastTick>5000) {await escalationTick();await housekeeping();}
      if(endpoint==='/api/evidence'&&req.method==='POST') {
        const b=await readBody(req,1500000);shape(b,['token','png']);text(b.token,'token',20,100);
        const permit=await db.get('SELECT * FROM evidence_tokens WHERE id=?',vault.sign(b.token));
        if(!permit||permit.expires<Date.now())throw fail(403,'EVIDENCE_FORBIDDEN','הרשאת צילום פגה.');
        text(b.png,'png',100,1400000);if(!b.png.startsWith('data:image/png;base64,'))throw fail(400,'INVALID_IMAGE','נדרש PNG.');
        const bytes=Buffer.from(b.png.slice(22),'base64');if(bytes.length>1000000||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.length<24||bytes.readUInt32BE(16)>4096||bytes.readUInt32BE(20)>4096)throw fail(400,'INVALID_IMAGE','צילום לא תקין.');
        const id=uid('IMG'),hash=crypto.createHash('sha256').update(bytes).digest('hex');await db.run('INSERT INTO screenshots VALUES(?,?,?,?,?)',id,permit.alertId,stamp(),vault.seal(b.png),hash);await db.run('DELETE FROM evidence_tokens WHERE id=?',permit.id);
        const a=await db.get('SELECT * FROM alerts WHERE id=?',permit.alertId);await event(a.runId,'browser_screenshot','captured',{id,alertId:a.id,sha256:hash,clientEvidence:true});send(201,{id,sha256:hash});return;
      }
      if (endpoint==='/api/login'&&req.method==='POST') {
        rate('login:'+client,options.loginRate||8);const body=await readBody(req);shape(body,['role','key']);
        if(!['analyst','reviewer'].includes(body.role)||typeof body.key!=='string'||body.key.length<8||body.key.length>100) throw fail(401,'AUTH_FAILED','פרטי הכניסה אינם נכונים.');
        const account=await db.get('SELECT * FROM accounts WHERE codeHash=? AND role=?',vault.sign(body.key),body.role);
        if(!account) throw fail(401,'AUTH_FAILED','פרטי הכניסה אינם נכונים.');
        if(account.state==='quarantined')throw fail(423,'USER_QUARANTINED','החשבון בהסגר. רק מנהל מורשה יכול לשחררו לאחר בדיקה.');
        const id=crypto.randomBytes(32).toString('base64url'),csrf=crypto.randomBytes(24).toString('base64url'),s={role:account.role,userId:account.id,name:account.displayName||account.id,csrf,expires:Date.now()+8*3600000};
        await db.run('INSERT INTO persistent_sessions VALUES(?,?,?,?)',vault.sign(id),vault.seal(JSON.stringify(s)),s.expires,account.id);await audit(uid('AUTH'),account.id,'login',account.role);
        send(200,{role:s.role,userId:s.userId,name:s.name,csrf},{'Set-Cookie':`agent_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${proto==='https'?'; Secure':''}`});return;
      }
      if (endpoint==='/api/webhook'&&req.method==='POST') {
        if (!webhookKey||!secure(req.headers.authorization,`Bearer ${webhookKey}`)) throw fail(401,'UNAUTHORIZED','נדרש אימות Webhook.');
        const body=await readBody(req),r=await workflow(body,'webhook');send(r.httpStatus||200,r);return;
      }
      const sid=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('agent_session='))?.split('=')[1];
      const sidHash=sid?vault.sign(sid):'';session=await sessionFor(sidHash);if(!session) throw fail(401,'UNAUTHORIZED','נדרשת כניסה למערכת.');
      if(req.method==='POST'&&!secure(req.headers['x-csrf-token'],session.csrf)) throw fail(403,'CSRF_FAILED','הבקשה חסרה אימות פעולה.');
      if (endpoint==='/api/session'&&req.method==='GET') {send(200,{role:session.role,name:session.name,csrf:session.csrf});return;}
      if (endpoint==='/api/logout'&&req.method==='POST') {await db.run('DELETE FROM persistent_sessions WHERE id=?',sidHash);send(200,{ok:true},{'Set-Cookie':`agent_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${proto==='https'?'; Secure':''}`});return;}
      if (endpoint==='/api/state'&&req.method==='GET') {const view=await state();if(session.role!=='reviewer'){view.audit=[];view.runs=view.runs.filter(r=>r.result.userId===session.userId);const ids=new Set(view.runs.map(r=>r.id));view.items=view.items.filter(i=>ids.has(i.runId));}send(200,{...view,role:session.role});return;}
      if (['/api/sales','/api/ask'].includes(endpoint)&&req.method==='POST') {rate('ai:'+session.userId,options.aiRate||20);const r=await workflow(await readBody(req),session.role,endpoint==='/api/ask'?'ask':'sales',session.userId);send(r.httpStatus||200,r);return;}
      if (endpoint==='/api/review'&&req.method==='POST') {send(200,await review(await readBody(req),session));return;}
      if (endpoint==='/api/propose'&&req.method==='POST') {
        const b=await readBody(req);shape(b,['ticketId','title','answer','source']);
        const t=await db.get('SELECT * FROM tickets WHERE id=?',text(b.ticketId,'ticket',5,100));if(!t) throw fail(404,'NOT_FOUND','כרטיס לא נמצא.');if(t.status==='resolved') throw fail(409,'STALE_REVIEW','כרטיס זה כבר נפתר.');
        const p={ticketId:t.id,question:vault.open(t.question),title:text(b.title,'כותרת',3,100),answer:text(b.answer,'תשובה',10,1000),source:text(b.source,'מקור',5,200)};
        await event(t.runId,'knowledge_proposal_input','received',{actor:session.userId,proposal:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,clean(v)]))});safeKnowledge(Object.values(p).join(' '));const id=await addItem('knowledge',t.runId,p);await audit(t.runId,session.role,'propose_knowledge',id);send(201,{id,status:'pending'});return;
      }
      if (endpoint==='/api/feedback'&&req.method==='POST') {
        const b=await readBody(req);shape(b,['runId','rating']);if(![-1,1].includes(b.rating)) throw fail(400,'INVALID_INPUT','דירוג אינו תקין.');
        if(!await db.get('SELECT id FROM runs WHERE id=?',text(b.runId,'runId',5,100))) throw fail(404,'NOT_FOUND','הרצה לא נמצאה.');
        await db.run('INSERT INTO feedback VALUES(?,?,?) ON CONFLICT(runId) DO UPDATE SET rating=excluded.rating,timestamp=excluded.timestamp',b.runId,b.rating,stamp());send(200,{ok:true});return;
      }
      if (endpoint.startsWith('/api/export/')&&req.method==='GET') {
        if(session.role!=='reviewer') throw fail(403,'FORBIDDEN','ייצוא דורש מנהל.');
        const item=await db.get('SELECT * FROM items WHERE id=?',endpoint.slice('/api/export/'.length));
        if(!item||item.kind!=='draft') throw fail(404,'NOT_FOUND','טיוטה לא נמצאה.');if(item.status!=='approved') throw fail(409,'NOT_APPROVED','הטיוטה טרם אושרה.');
        const p=JSON.parse(vault.open(item.payload));await audit(item.runId,session.role,'export_approved_draft',item.id);
        res.writeHead(200,{...headers,'Content-Type':'message/rfc822','Content-Disposition':'attachment; filename="approved-follow-up.eml"'});
        res.end(`Subject: =?UTF-8?B?${Buffer.from(p.subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(p.body).toString('base64').match(/.{1,76}/g).join('\r\n')}`);return;
      }
      if (endpoint==='/api/llm'&&req.method==='GET') {if(session.role!=='reviewer')throw fail(403,'FORBIDDEN','נדרשת הרשאת מנהל.');const out=await publicSettings();try{out.freeModels=(await freeModels(options.fetchImpl)).slice(0,20).map(m=>m.id);}catch{out.freeModels=[];}send(200,out);return;}
      if (endpoint==='/api/llm'&&req.method==='POST') {if(session.role!=='reviewer')throw fail(403,'FORBIDDEN','נדרשת הרשאת מנהל.');send(200,await saveSettings(await readBody(req),session));return;}
      if (endpoint==='/api/llm/test'&&req.method==='POST') {
        if(session.role!=='reviewer')throw fail(403,'FORBIDDEN','נדרשת הרשאת מנהל.');rate('llmtest:'+session.userId,6);
        const notes='לקוח הדמו ביקש הצעה לצוות של עשרה אנשים. סוכם לחזור ללקוח עד יום חמישי.',started=Date.now(),s=await settings();
        const out=options.llm?{raw:await options.llm(notes,[]),engine:'test-provider'}:await callModel({settings:s,system:PROMPT,user:JSON.stringify({dataOnly:true,notes,approvedKnowledge:[]}),schema:OUTPUT_SCHEMA,env,fetchImpl:options.fetchImpl});
        const v=validateModel(out.raw,notes);await audit(uid('LLMTEST'),session.userId,'test_llm',out.engine);send(200,{ok:true,engine:out.engine,ms:Date.now()-started,summary:v.summaryQuotes});return;
      }
      if(endpoint==='/api/security'&&req.method==='GET') {
        if(session.role!=='reviewer')throw fail(403,'FORBIDDEN','נדרשת הרשאת מנהל.');await escalationTick();
        const alerts=await db.all('SELECT * FROM alerts ORDER BY createdAt DESC'),shots=await db.all('SELECT id,alertId,sha256,createdAt FROM screenshots');
        send(200,{accounts:(await db.all('SELECT id,role,state,strikes,displayName FROM accounts ORDER BY role DESC,id')),alerts:alerts.map(a=>({...a,evidence:JSON.parse(vault.open(a.evidence)),screenshots:shots.filter(x=>x.alertId===a.id).map(({id,sha256,createdAt})=>({id,sha256,createdAt}))})),integrity:verifyChain(await db.all('SELECT * FROM events ORDER BY seq'),vault),events:(await db.all('SELECT * FROM events ORDER BY seq DESC LIMIT 300')).map(e=>({...e,detail:JSON.parse(vault.open(e.detail))})),delivery:{channel:'מרכז התראות פנימי',externalConfigured:false,owners,escalationSeconds:escalationMs/1000}});return;
      }
      if(endpoint==='/api/logs/export'&&req.method==='GET') {
        if(session.role!=='reviewer')throw fail(403,'FORBIDDEN','נדרשת הרשאת מנהל.');
        await audit(uid('EXPORT'),session.userId,'export_full_audit','events');const events=await db.all('SELECT * FROM events ORDER BY seq');
        send(200,{exportedAt:stamp(),integrity:verifyChain(events,vault),events:events.map(e=>({...e,detail:JSON.parse(vault.open(e.detail))})),runs:(await db.all('SELECT * FROM runs ORDER BY timestamp')).map(r=>({...r,result:JSON.parse(vault.open(r.result))}))},{'Content-Disposition':'attachment; filename="audit-export.json"'});return;
      }
      if(endpoint==='/api/security/action'&&req.method==='POST') {
        if(session.role!=='reviewer')throw fail(403,'FORBIDDEN','נדרשת הרשאת מנהל.');const b=await readBody(req);shape(b,['alertId','action','reason']);text(b.reason,'סיבת החלטה',10,300);
        if(!['acknowledge','resolve','release'].includes(b.action))throw fail(400,'INVALID_INPUT','פעולה לא תקינה.');const a=await db.get('SELECT * FROM alerts WHERE id=?',text(b.alertId,'alertId',5,100));if(!a)throw fail(404,'NOT_FOUND','התראה לא נמצאה.');
        if(b.action==='release') {if(a.userId==='external')throw fail(400,'INVALID_INPUT','משתמש חיצוני אינו חשבון ארגוני.');await db.run("UPDATE accounts SET state='active' WHERE id=?",a.userId);}
        else await db.run('UPDATE alerts SET status=?,updatedAt=? WHERE id=?',b.action==='resolve'?'resolved':'acknowledged',stamp(),a.id);
        await event(a.runId,'security_'+b.action,'success',{alertId:a.id,actor:session.userId,userId:a.userId,reason:clean(b.reason)});send(200,{ok:true});return;
      }
      if(endpoint.startsWith('/api/screenshot/')&&req.method==='GET') {
        if(session.role!=='reviewer')throw fail(403,'FORBIDDEN','נדרשת הרשאת מנהל.');const image=await db.get('SELECT * FROM screenshots WHERE id=?',endpoint.slice(16));if(!image)throw fail(404,'NOT_FOUND','צילום לא נמצא.');res.writeHead(200,{...headers,'Content-Type':'image/png'});res.end(Buffer.from(vault.open(image.png).slice(22),'base64'));return;
      }
      if(endpoint==='/api/tools') Object.assign(req,await securityIncident(uid('MISUSE'),session.userId,'TOOL_FORBIDDEN',{path:endpoint}));
      throw fail(endpoint==='/api/tools'?403:404,endpoint==='/api/tools'?'TOOL_FORBIDDEN':'NOT_FOUND','הפעולה אינה זמינה.');
    } catch(e) {
      const id=uid('REQ'),type=e.type||'INTERNAL_ERROR';
      if(!e.type) console.error(e);
      try {
        await audit(id,session?.role||'anonymous',endpoint||'request','http','error',type);
        if(type==='KNOWLEDGE_INJECTION'&&session)Object.assign(req,await securityIncident(id,session.userId,type,{path:endpoint}));
        // Every rejected API request is observable without persisting its sensitive payload.
        await log({runId:id,timestamp:stamp(),status:'error',fallback:false,review:false,tool:false,errorType:type,durationMs:0,engine:'http-boundary',mode:'request'});
      } catch(logError) {console.error(logError);}
      if(!res.headersSent) send(e.status||500,{errorType:type,message:e.type?e.message:'אירעה שגיאה פנימית.',runId:id,...(req.evidenceToken?{evidenceToken:req.evidenceToken,alertId:req.alertId}:{})});
    }
  }
  const server=http.createServer(handler);server.requestTimeout=120000;server.headersTimeout=10000;
  const timer=options.timer?setInterval(()=>{escalationTick().catch(()=>{});housekeeping().catch(()=>{});},options.escalationMs?20:10000):null;timer?.unref();
  return {server,handler,db,vault,workflow,tool,state,escalationTick,settings,close:async()=>{if(timer)clearInterval(timer);await db.close?.();}};
}
