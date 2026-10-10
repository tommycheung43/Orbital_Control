import initSqlJs from 'sql.js';
import { executeRead, executeWorkOrderMutation, readTokens } from './queryPolicy.js';
import { changeEvidenceFacts, evidenceForQuery } from './evidence.js';

const ready = initSqlJs({ locateFile: () => new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).href });
self.onmessage = async ({ data }) => {
  let db, challenge;
  try {
    const SQL = await ready;
    db = new SQL.Database(data.snapshot);
    const tokens = readTokens(data.sql);
    if (['INSERT', 'UPDATE', 'DELETE'].includes(tokens[0])) {
      const result = executeWorkOrderMutation(db, data.sql, data.level);
      self.postMessage({ success: true, ...result, evidence: [] });
      return;
    }
    challenge = new SQL.Database(data.snapshot); changeEvidenceFacts(challenge);
    const result = executeRead(db, data.sql, 300, data.level);
    let evidence = [];
    // A useful exploration query may not execute against altered validation facts.
    try { evidence = evidenceForQuery(db, challenge, data.sql, result); } catch { /* no evidence awarded */ }
    self.postMessage({ success: true, ...result, evidence });
  } catch (error) { self.postMessage({ success: false, error: error.message }); }
  finally { db?.close(); challenge?.close(); }
};
