import { scenario } from '../data/reactorScenario.js';
import { executeRead } from './queryPolicy.js';

function matches(rows, expected, columns) {
  if (rows.length !== expected.length || expected.length === 0) return false;
  const signature = row => JSON.stringify(columns.map(column => row[column]));
  return JSON.stringify(rows.map(signature).sort()) === JSON.stringify(expected.map(signature).sort());
}

// Validate facts and multiplicity, not a particular SQL spelling or row ordering.
// Replay against changed source facts too: hard-coded answer rows are not evidence.
export function evidenceForQuery(db, challengeDb, sql, result) {
  if (result.truncated) return [];
  const challenge = executeRead(challengeDb, sql);
  if (challenge.truncated) return [];
  return scenario.questions.filter(question => {
    if (!question.columns.every(column => result.columns.includes(column))) return false;
    const expected = executeRead(db, question.sql);
    const alternate = executeRead(challengeDb, question.sql);
    return matches(result.rows, expected.rows, question.columns) && matches(challenge.rows, alternate.rows, question.columns);
  }).map(question => question.id);
}

export function changeEvidenceFacts(db) {
  db.run(`PRAGMA query_only = OFF;
    UPDATE power_usage SET mw = mw + module_id;
    UPDATE modules SET occupants = occupants + 1, minimum_mw = minimum_mw + 1;
    UPDATE backups SET reserve_mwh = reserve_mwh + 0.37;
    UPDATE crew SET fatigue = fatigue + 1;
    UPDATE maintenance_logs SET repair_ticks = repair_ticks + 1;
  `);
}
