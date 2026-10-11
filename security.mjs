import crypto from 'node:crypto';

// The 32-byte key comes from the VAULT_KEY environment variable (base64), never from the repository.
export function createVault(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid vault key: VAULT_KEY must be 32 bytes, base64 encoded');
  return {
    seal(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.');},
    open(value){const [v,iv,tag,data]=value.split('.');if(v!=='v1')throw new Error('Unencrypted or invalid data');const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');},
    sign(value){return crypto.createHmac('sha256',key).update(value).digest('hex');}
  };
}
export function verifyChain(rows,vault) {
  let previous='GENESIS';
  for(const row of rows){if(row.previous!==previous||row.hash!==vault.sign([row.id,row.timestamp,row.runId,row.stage,row.status,row.detail,row.previous].join('|')))return {valid:false,at:row.id,count:rows.length};previous=row.hash;}
  return {valid:true,count:rows.length,lastHash:previous};
}
export const SQL_ATTACK=/\bunion\s+(all\s+)?select\b|\b(drop|truncate|alter)\s+table\b|['"]\s*(or|and)\s+['"\d\s]+\s*=|;\s*(delete|insert|update|select)\b|\bor\s+1\s*=\s*1|\bexec\s*\(|sleep\s*\(\s*\d+\s*\)|--\s*$/iu;
export function normalizeThreat(s){let v=s.normalize('NFKC').replace(/[​-‏‪-‮⁦-⁩﻿]/g,'');for(let i=0;i<2;i++){try{v=decodeURIComponent(v);}catch{break;}}return v;}
