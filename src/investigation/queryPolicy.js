import { levelRestriction } from './curriculum.js';

// Tokenize rather than splitting on semicolons: quoted strings and comments can contain them.
export function readTokens(sql) {
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('Enter a SELECT query.');
  if (sql.length > 12000) throw new Error('Query exceeds the 12,000 character limit.');
  const tokens = [];
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    if (/\s/.test(char)) { i++; continue; }
    if (sql.slice(i, i + 2) === '--') { i = sql.indexOf('\n', i); if (i < 0) break; continue; }
    if (sql.slice(i, i + 2) === '/*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unclosed SQL comment.');
      i = end + 2; continue;
    }
    if (char === "'" || char === '"' || char === '`' || char === '[') {
      const endChar = char === '[' ? ']' : char;
      let closed = false; i++;
      while (i < sql.length) {
        if (sql[i++] === endChar) {
          if (sql[i] === endChar && char !== '[') { i++; continue; }
          closed = true; break;
        }
      }
      if (!closed) throw new Error('Unclosed SQL quote.');
      tokens.push('QUOTED'); continue;
    }
    const word = sql.slice(i).match(/^[A-Za-z_][A-Za-z_0-9]*/);
    if (word) { tokens.push(word[0].toUpperCase()); i += word[0].length; }
    else { tokens.push(char); i++; }
  }
  return tokens;
}

export function validateReadQuery(sql, level = 4) {
  const tokens = readTokens(sql);
  if (tokens.at(-1) === ';') tokens.pop();
  if (tokens.includes(';')) throw new Error('Run one query at a time.');
  if (!['SELECT', 'WITH'].includes(tokens[0])) throw new Error('Investigation is read-only. Use station actions to change operations.');
  const forbidden = new Set(['INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'CREATE', 'DROP', 'ALTER', 'PRAGMA', 'ATTACH', 'DETACH', 'VACUUM', 'REINDEX', 'ANALYZE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'LOAD_EXTENSION']);
  if (tokens.some(token => forbidden.has(token))) throw new Error('Only read-only SELECT / WITH queries are available in investigation.');
  const restriction = levelRestriction(level, tokens);
  if (restriction) throw new Error(restriction);
  return tokens;
}

export function executeRead(db, sql, limit = 300, level = 4) {
  validateReadQuery(sql, level);
  db.run('PRAGMA query_only = ON');
  const statement = db.prepare(sql);
  try {
    const columns = statement.getColumnNames();
    if (new Set(columns).size !== columns.length) throw new Error('Duplicate result column names. Use aliases to distinguish them.');
    const rows = [];
    while (statement.step()) {
      if (rows.length === limit) return { columns, rows, truncated: true };
      rows.push(statement.getAsObject());
    }
    return { columns, rows, truncated: false };
  } finally { statement.free(); }
}

export function executeWorkOrderMutation(db, sql, level = 4) {
  const tokens = readTokens(sql);
  if (tokens.at(-1) === ';') tokens.pop();
  if (tokens.includes(';')) throw new Error('Run one statement at a time.');
  const type = tokens[0];
  if (!['INSERT', 'UPDATE', 'DELETE'].includes(type)) throw new Error('Use SELECT for investigation, or INSERT / UPDATE / DELETE for work orders.');
  const restriction = levelRestriction(level, tokens);
  if (restriction) throw new Error(restriction);
  const table = type === 'INSERT' && tokens[1] === 'INTO' ? tokens[2] : type === 'UPDATE' ? tokens[1] : type === 'DELETE' && tokens[1] === 'FROM' ? tokens[2] : null;
  if (table !== 'WORK_ORDERS') throw new Error('Only work_orders can be changed. Station telemetry stays read-only.');
  const forbidden = new Set(['SELECT', 'WITH', 'PRAGMA', 'ATTACH', 'DETACH', 'CREATE', 'DROP', 'ALTER', 'REPLACE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'LOAD_EXTENSION']);
  if (tokens.slice(1).some(token => forbidden.has(token))) throw new Error('Work-order statements cannot contain subqueries or administrative commands.');
  db.run('PRAGMA query_only = OFF'); db.run('BEGIN');
  try {
    db.run(sql);
    const affected = db.getRowsModified();
    const result = executeRead(db, 'SELECT work_order_id, module_id, task_type, priority, status, note FROM work_orders ORDER BY work_order_id');
    db.run('COMMIT');
    return { columns: ['affected_rows'], rows: [{ affected_rows: affected }], truncated: false, mutationRows: result.rows, mutationType: type };
  } catch (error) { db.run('ROLLBACK'); throw error; }
}
