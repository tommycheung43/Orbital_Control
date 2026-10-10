import initSqlJs from 'sql.js';
import { crewStatus } from '../game/CrewTaskService.js';

export const tableDescriptions = {
  modules: 'Current module configuration and status.',
  power_usage: 'Power history by module and tick. Thousands of rows; filter recorded_at.',
  oxygen_readings: 'Oxygen history by module and tick.',
  backups: 'Habitat battery storage and output limits.',
  crew: 'Current crew name, role, engineering skill, health, fatigue and task.',
  crew_certifications: 'Crew qualifications.',
  assignments: 'Current crew-to-module assignments.',
  tasks: 'Current work queue, requirements, priority, progress, power draw and assigned crew.',
  crew_task_history: 'Assignment, progress and completion history by crew and task.',
  crew_service_history: 'Earlier station-shift repair records, including duration and fatigue after work.',
  maintenance_logs: 'Historical inspections and faults.',
  control_actions: 'Player GUI commands and parameters.',
  work_orders: 'Writable maintenance queue. INSERT, UPDATE and DELETE unlock at SQL level 4.',
  current_modules: 'Beginner view: current power and oxygen in one table.',
  current_backups: 'Beginner view: module names with current battery values.',
  crew_roster: 'Convenience view: current crew, skill, certification, availability and module.',
  repair_history: 'Beginner view: earlier Reactor maintenance outcomes with crew names.',
  maintenance_history: 'Convenience view: maintenance records with module details.',
  snapshot_meta: 'Run seed, version and content metadata.',
};

const historicalValue = (seed, moduleId, sample, baseline, spread) => {
  const mixed = Math.imul((seed ^ (moduleId * 2654435761) ^ sample) >>> 0, 1597334677) >>> 0;
  return Math.round((baseline + ((mixed % 1001) / 1000 - 0.5) * spread) * 1000) / 1000;
};

export function buildDatabase(SQL, state) {
  const db = new SQL.Database();
  try {
    db.run(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE modules (module_id INTEGER PRIMARY KEY, module_name TEXT NOT NULL, kind TEXT NOT NULL, nominal_mw REAL NOT NULL, minimum_mw REAL NOT NULL, occupants INTEGER NOT NULL, can_defer INTEGER NOT NULL, wear REAL NOT NULL, oxygen_target REAL NOT NULL, status TEXT NOT NULL);
      CREATE TABLE power_usage (module_id INTEGER NOT NULL REFERENCES modules, mw REAL NOT NULL, recorded_at INTEGER NOT NULL, PRIMARY KEY(module_id, recorded_at));
      CREATE TABLE oxygen_readings (module_id INTEGER NOT NULL REFERENCES modules, oxygen_level REAL NOT NULL, recorded_at INTEGER NOT NULL, PRIMARY KEY(module_id, recorded_at));
      CREATE TABLE backups (module_id INTEGER PRIMARY KEY REFERENCES modules, reserve_mwh REAL NOT NULL, capacity_mwh REAL NOT NULL, max_mw REAL NOT NULL);
      CREATE TABLE crew (crew_id INTEGER PRIMARY KEY, crew_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, engineering_skill INTEGER NOT NULL, fatigue REAL NOT NULL, health REAL NOT NULL, status TEXT NOT NULL, current_task_id INTEGER);
      CREATE TABLE crew_certifications (crew_id INTEGER NOT NULL REFERENCES crew, certification TEXT NOT NULL, PRIMARY KEY(crew_id, certification));
      CREATE TABLE assignments (crew_id INTEGER PRIMARY KEY REFERENCES crew, module_id INTEGER NOT NULL REFERENCES modules);
      CREATE TABLE tasks (task_id INTEGER PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, module_id INTEGER NOT NULL REFERENCES modules, priority INTEGER NOT NULL, required_skill INTEGER NOT NULL, required_certification TEXT, assigned_crew_id INTEGER REFERENCES crew, duration REAL NOT NULL, progress REAL NOT NULL, status TEXT NOT NULL, risk TEXT NOT NULL, source TEXT NOT NULL, power_draw REAL NOT NULL);
      CREATE TABLE crew_task_history (event_id INTEGER PRIMARY KEY, tick INTEGER NOT NULL, task_id INTEGER NOT NULL REFERENCES tasks, crew_id INTEGER REFERENCES crew, event TEXT NOT NULL, fatigue REAL, health REAL, detail TEXT NOT NULL);
      CREATE TABLE crew_service_history (record_id INTEGER PRIMARY KEY, crew_id INTEGER NOT NULL REFERENCES crew, module_id INTEGER NOT NULL REFERENCES modules, recorded_at INTEGER NOT NULL, task_type TEXT NOT NULL, outcome TEXT NOT NULL, work_ticks INTEGER NOT NULL, fatigue_after REAL NOT NULL);
      CREATE TABLE maintenance_logs (log_id INTEGER PRIMARY KEY, module_id INTEGER NOT NULL REFERENCES modules, recorded_at INTEGER NOT NULL, finding TEXT NOT NULL, repair_ticks INTEGER NOT NULL);
      CREATE TABLE control_actions (action_id INTEGER PRIMARY KEY, recorded_at INTEGER NOT NULL, action_type TEXT NOT NULL, module_id INTEGER, parameter TEXT);
      CREATE TABLE work_orders (work_order_id INTEGER PRIMARY KEY, module_id INTEGER NOT NULL REFERENCES modules, task_type TEXT NOT NULL CHECK(length(task_type) BETWEEN 1 AND 32), priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 5), status TEXT NOT NULL CHECK(status IN ('OPEN','ACTIVE','RESOLVED')), note TEXT NOT NULL CHECK(length(note) <= 120));
      CREATE TABLE snapshot_meta (seed INTEGER, version INTEGER, tick INTEGER, schema_version INTEGER, content_version INTEGER, history_samples INTEGER);
      CREATE INDEX idx_power_tick ON power_usage(recorded_at);
      CREATE INDEX idx_oxygen_tick ON oxygen_readings(recorded_at);
      CREATE INDEX idx_maintenance_module_tick ON maintenance_logs(module_id, recorded_at);
      CREATE INDEX idx_crew_task_tick ON crew_task_history(task_id, tick);
      CREATE INDEX idx_crew_service_worker_tick ON crew_service_history(crew_id, recorded_at);
    `);
    db.run('BEGIN');
    const insert = (table, values) => db.run(`INSERT INTO ${table} VALUES (${values.map(() => '?').join(',')})`, values);
    for (const module of state.modules) insert('modules', [module.module_id, module.module_name, module.kind, module.nominal_mw, module.minimum_mw, module.occupants, module.can_defer, module.wear, module.oxygen_target, module.status]);

    const powerStatement = db.prepare('INSERT OR REPLACE INTO power_usage VALUES (?, ?, ?)');
    const oxygenStatement = db.prepare('INSERT OR REPLACE INTO oxygen_readings VALUES (?, ?, ?)');
    try {
      for (let sample = -state.historySamples; sample < 0; sample++) {
        for (const module of state.modules) {
          powerStatement.run([module.module_id, Math.max(0, historicalValue(state.seed, module.module_id, sample, module.nominal_mw, 16)), sample]);
          oxygenStatement.run([module.module_id, Math.max(35, Math.min(100, historicalValue(state.seed + 17, module.module_id, sample, module.oxygen_target, 18))), sample]);
        }
      }
      for (const reading of state.readings) for (const module of state.modules) powerStatement.run([module.module_id, reading.loads[module.module_id], reading.recorded_at]);
      for (const reading of state.oxygenReadings) for (const module of state.modules) oxygenStatement.run([module.module_id, reading.levels[module.module_id], reading.recorded_at]);
      for (const module of state.modules) {
        powerStatement.run([module.module_id, module.mw, state.tick]);
        oxygenStatement.run([module.module_id, module.oxygen_level, state.tick]);
      }
    } finally { powerStatement.free(); oxygenStatement.free(); }

    const habitat = state.modules.find(module => module.kind === 'habitat');
    insert('backups', [habitat.module_id, state.battery, state.batteryCapacity, state.batteryMax]);
    for (const crew of state.crew) {
      insert('crew', [crew.crew_id, crew.crew_code, crew.name, crew.role, crew.engineering_skill, crew.fatigue, crew.health, crewStatus(crew), crew.current_task_id]);
      insert('crew_certifications', [crew.crew_id, crew.certification]); insert('assignments', [crew.crew_id, crew.module_id]);
    }
    for (const task of state.tasks) insert('tasks', [task.task_id, task.type, task.title, task.module_id, task.priority, task.required_skill, task.required_certification, task.assigned_crew_id, task.duration, task.progress, task.status, task.risk, task.source, task.power_draw ?? 0]);
    for (const event of state.crewTaskHistory) insert('crew_task_history', [event.event_id, event.tick, event.task_id, event.crew_id, event.event, event.fatigue, event.health, event.detail]);
    for (const record of state.crewServiceHistory) insert('crew_service_history', [record.record_id, record.crew_id, record.module_id, record.recorded_at, record.task_type, record.outcome, record.work_ticks, record.fatigue_after]);
    let logId = 1;
    const findings = ['Routine inspection complete', 'Filter wear observed', 'Calibration checked', 'Load variance recorded', 'Seal inspection due'];
    for (let sample = -240; sample < 0; sample += 3) {
      const module = state.modules[Math.abs(sample / 3) % state.modules.length];
      insert('maintenance_logs', [logId++, module.module_id, sample, findings[logId % findings.length], 2 + (logId % 7)]);
    }
    for (const log of state.maintenance) insert('maintenance_logs', [logId++, log.module_id, log.recorded_at, log.finding, log.repair_ticks]);
    state.commands.forEach((command, index) => insert('control_actions', [index + 1, command.tick, command.type, command.moduleId ?? null, JSON.stringify({ value: command.value, crewId: command.crewId })]));
    state.workOrders.forEach(order => insert('work_orders', [order.work_order_id, order.module_id, order.task_type, order.priority, order.status, order.note]));
    insert('snapshot_meta', [state.seed, state.version, state.tick, state.schemaVersion, state.contentVersion, state.historySamples]);
    db.run(`
      CREATE VIEW current_modules AS
        SELECT m.module_id, m.module_name, m.kind, p.mw, m.minimum_mw, m.occupants, m.can_defer, m.wear, m.oxygen_target, o.oxygen_level, m.status
        FROM modules m
        JOIN power_usage p ON p.module_id = m.module_id AND p.recorded_at = (SELECT MAX(recorded_at) FROM power_usage)
        JOIN oxygen_readings o ON o.module_id = m.module_id AND o.recorded_at = (SELECT MAX(recorded_at) FROM oxygen_readings);
      CREATE VIEW current_backups AS SELECT m.module_id, m.module_name, b.reserve_mwh, b.capacity_mwh, b.max_mw FROM backups b JOIN modules m ON m.module_id = b.module_id;
      CREATE VIEW crew_roster AS SELECT c.crew_id, c.crew_code, c.name, c.role, c.engineering_skill, c.fatigue, c.health, c.status, c.current_task_id, cert.certification, a.module_id, m.module_name FROM crew c JOIN crew_certifications cert ON cert.crew_id = c.crew_id JOIN assignments a ON a.crew_id = c.crew_id JOIN modules m ON m.module_id = a.module_id;
      CREATE VIEW repair_history AS SELECT h.record_id, h.recorded_at, c.crew_id, c.name, c.engineering_skill, m.module_name, h.task_type, h.outcome, h.work_ticks, h.fatigue_after FROM crew_service_history h JOIN crew c ON c.crew_id = h.crew_id JOIN modules m ON m.module_id = h.module_id;
      CREATE VIEW maintenance_history AS SELECT l.log_id, l.module_id, m.module_name, m.kind, l.recorded_at, l.finding, l.repair_ticks FROM maintenance_logs l JOIN modules m ON m.module_id = l.module_id;
    `);
    db.run('COMMIT');
    return db;
  } catch (error) { try { db.run('ROLLBACK'); } catch { /* no active transaction */ } db.close(); throw error; }
}

export class GameplayRepository {
  async init() { this.SQL = await initSqlJs({ locateFile: () => new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).href }); }
  project(state) { const next = buildDatabase(this.SQL, state); this.db?.close(); this.db = next; }
  exportSnapshot() { return this.db.export(); }
  close() { this.db?.close(); this.db = null; }
}
