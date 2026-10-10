export const sqlStages = [
  { level: 1, title: 'Filter', functions: ['SELECT', 'FROM', 'WHERE', 'AND / OR'], goal: 'Find the record that matters with WHERE.', example: "SELECT module_name, mw, oxygen_level FROM current_modules WHERE kind = 'habitat';" },
  { level: 2, title: 'Sort & summarize', functions: ['ORDER BY', 'LIMIT', 'COUNT', 'AVG', 'MIN / MAX', 'GROUP BY'], goal: 'Compare earlier repairs with a summary or sort.', example: "SELECT name, AVG(work_ticks) AS avg_ticks FROM repair_history WHERE task_type = 'REACTOR_MAINTENANCE' GROUP BY name ORDER BY avg_ticks;" },
  { level: 3, title: 'Relate tables', functions: ['JOIN', 'ON', 'AS', 'WITH'], goal: 'Relate a crew member to an earlier service record.', example: "SELECT c.name, h.outcome, h.work_ticks FROM crew c JOIN crew_service_history h ON h.crew_id = c.crew_id WHERE h.task_type = 'REACTOR_MAINTENANCE';" },
  { level: 4, title: 'Manage work orders', functions: ['INSERT', 'UPDATE', 'DELETE'], goal: 'Maintain work_orders. Active priority 4–5 Reactor work shortens repair.', example: "UPDATE work_orders SET priority = 4, status = 'ACTIVE' WHERE work_order_id = 1;" },
];

const aggregateTokens = new Set(['ORDER', 'GROUP', 'LIMIT', 'COUNT', 'AVG', 'MIN', 'MAX', 'SUM']);

export function nextSqlLevel(level, tokens) {
  if (level === 1 && tokens.includes('WHERE')) return 2;
  if (level === 2 && tokens.some(token => aggregateTokens.has(token))) return 3;
  if (level === 3 && tokens.includes('JOIN')) return 4;
  return level;
}

export function levelRestriction(level, tokens) {
  if (level < 2 && tokens.some(token => aggregateTokens.has(token))) return 'Complete the WHERE exercise before using sorting or aggregate functions.';
  if (level < 3 && tokens.some(token => ['JOIN', 'WITH'].includes(token))) return 'Complete the summary exercise before using JOIN or WITH.';
  if (level < 4 && tokens.some(token => ['INSERT', 'UPDATE', 'DELETE'].includes(token))) return 'Complete the JOIN exercise before changing work orders.';
  return null;
}
