import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { createInitialState, advanceTick, metrics } from '../src/game/SimulationEngine.js';
import { executeAction, actionProblem } from '../src/game/ActionService.js';
import { executeControl } from '../src/game/SystemControlService.js';
import { scenario, decisions } from '../src/data/reactorScenario.js';
import { defaultScenario, validateScenario } from '../src/data/scenarioConfig.js';
import { buildDatabase } from '../src/database/GameplayRepository.js';
import { executeRead, executeWorkOrderMutation, validateReadQuery } from '../src/investigation/queryPolicy.js';
import { nextSqlLevel } from '../src/investigation/curriculum.js';
import { evidenceForQuery, changeEvidenceFacts } from '../src/investigation/evidence.js';
import { StationSession } from '../src/game/StationSession.js';
import { buildDebrief, deriveMission, missionCompletion } from '../src/game/MissionGuide.js';
import { crewStatus, executeTaskCommand, taskEligibility } from '../src/game/CrewTaskService.js';

const SQL = await initSqlJs();
const tickToIncident = seed => { let state = createInitialState(seed); for (let i = 0; i < 3; i++) state = advanceTick(state); return state; };
const cards = state => scenario.questions.map(question => ({ id: question.id, questionId: question.id, version: state.version, incidentId: state.incident.id }));
const apply = (state, type) => executeAction(state, { type, expectedStateVersion: state.version }, cards(state));

function invariant(state) {
  for (const number of [state.safety, ...state.modules.flatMap(module => [module.wear, module.oxygen_level]), ...state.crew.map(crew => crew.fatigue)]) assert.ok(Number.isFinite(number) && number >= 0 && number <= 100);
  assert.ok(state.battery >= 0 && state.spares >= 0);
  assert.equal(new Set(state.readings.map(reading => reading.recorded_at)).size, state.readings.length);
}

test('same seed and action sequence produce the same full run', () => {
  const run = () => {
    let state = tickToIncident(42);
    for (const type of ['suspend-industry', 'assign-engineer', 'repair-reactor']) { const result = apply(state, type); assert.ok(result.success, result.error); state = result.state; }
    for (let i = 0; i < 20; i++) state = advanceTick(state);
    return state;
  };
  assert.deepEqual(run(), run());
  assert.notDeepEqual(createInitialState(42), createInitialState(10000));
});

test('multiple seeds have at least two viable containment choices and repair paths', () => {
  for (const seed of [1, 42, 10000, 123456, 4294967295]) {
    const initial = tickToIncident(seed);
    const viable = decisions.filter(action => !actionProblem(initial, action.id, cards(initial)));
    assert.ok(viable.length >= 2);
    for (const action of viable) {
      let state = apply(initial, action.id).state;
      const delta = Object.entries(metrics(state)).filter(([key, value]) => value !== metrics(initial)[key]);
      assert.ok(delta.length >= 2, action.id);
      state = apply(state, 'assign-engineer').state;
      state = apply(state, 'repair-reactor').state;
      for (let i = 0; i < 20; i++) { state = advanceTick(state); invariant(state); }
      assert.equal(state.incident.status, 'resolved');
      assert.equal(state.generation, 100);
      assert.ok(state.history.some(event => event.type === 'FOLLOW-UP' && event.message.includes(action.id)));
      if (action.id !== 'use-battery') assert.ok(apply(state, 'restore-loads').success);
    }
  }
});

test('actions need current state but do not require SQL evidence', () => {
  const state = tickToIncident(42); const before = structuredClone(state);
  assert.equal(executeAction(state, { type: 'suspend-industry', expectedStateVersion: -1 }, cards(state)).success, false);
  assert.equal(executeAction(state, { type: 'suspend-industry', expectedStateVersion: state.version }, []).success, true);
  assert.deepEqual(state, before);
  const contained = apply(state, 'suspend-industry').state;
  assert.equal(apply(contained, 'use-battery').success, false);
  assert.equal(apply(state, 'repair-reactor').success, false);
});

test('deadline escalation, zero reserve and run end stay bounded and recoverable', () => {
  let state = tickToIncident(1);
  while (state.tick < state.incident.deadline) state = advanceTick(state);
  assert.equal(state.incident.status, 'escalated'); assert.equal(state.generation, 55);
  assert.ok(apply(state, 'assign-engineer').success);
  state.battery = 0;
  assert.equal(apply(state, 'use-battery').success, false);
  for (let i = 0; i < 120; i++) { state = advanceTick(state); invariant(state); }
  assert.ok(state.ended); assert.strictEqual(advanceTick(state), state);
});

test('database mirrors authoritative values and current readings without duplicate rows', () => {
  let state = tickToIncident(42); state = apply(state, 'suspend-industry').state;
  const db = buildDatabase(SQL, state);
  try {
    assert.equal(executeRead(db, 'SELECT COUNT(*) AS count FROM modules').rows[0].count, 3);
    const rows = executeRead(db, 'SELECT * FROM current_modules').rows;
    assert.equal(rows.length, 3); assert.equal(rows.find(row => row.module_name === 'Industry').mw, 0);
    assert.equal(executeRead(db, 'SELECT version FROM snapshot_meta').rows[0].version, state.version);
  } finally { db.close(); }
});

test('system controls work without SQL and record consequences for investigation', () => {
  const initial = createInitialState(42);
  const power = executeControl(initial, { type: 'set-power', moduleId: 2, value: 35, expectedStateVersion: initial.version });
  assert.ok(power.success, power.error);
  assert.equal(power.state.modules.find(module => module.module_id === 2).mw, 35);
  assert.equal(power.state.commands.at(-1).type, 'set-power');
  assert.equal(power.state.history.at(-1).type, 'SYSTEM CONTROL');
  const oxygen = executeControl(power.state, { type: 'set-oxygen-target', moduleId: 2, value: 98, expectedStateVersion: power.state.version });
  assert.ok(oxygen.success, oxygen.error);
  assert.equal(oxygen.state.modules.find(module => module.module_id === 2).oxygen_target, 98);
  assert.ok(oxygen.state.modules.find(module => module.module_id === 2).mw > 35);
  assert.equal(executeControl(initial, { type: 'set-power', moduleId: 2, value: 10, expectedStateVersion: -1 }).success, false);
});

test('teacher scenarios can add, change and remove optional modules within safe limits', async () => {
  const custom = defaultScenario();
  custom.title = 'Teacher test';
  custom.modules.push({ module_id: 99, module_name: 'Research', kind: 'support', nominal_mw: 12, minimum_mw: 5, occupants: 4, can_defer: 1, wear: 20, oxygen_level: 94 });
  assert.equal(validateScenario(custom).valid, true);
  const invalid = structuredClone(custom); invalid.modules = invalid.modules.filter(module => module.kind !== 'reactor');
  assert.equal(validateScenario(invalid).valid, false);
  const repository = { init: async () => {}, project: () => {}, exportSnapshot: () => new Uint8Array(), close: () => {} };
  const runner = { close: () => {} };
  const session = new StationSession(repository, runner); await session.init(12);
  const applied = session.applyScenario(custom);
  assert.ok(applied.success);
  assert.equal(session.snapshot().modules.length, 4);
  assert.equal(session.snapshot().modules.at(-1).module_name, 'Research');
});

test('database contains enough history to require filtering', () => {
  const state = createInitialState(42); const db = buildDatabase(SQL, state);
  try {
    assert.ok(executeRead(db, 'SELECT COUNT(*) AS count FROM power_usage').rows[0].count >= 1500);
    assert.ok(executeRead(db, 'SELECT COUNT(*) AS count FROM oxygen_readings').rows[0].count >= 1500);
    assert.equal(executeRead(db, 'SELECT * FROM power_usage', 200).truncated, true);
    assert.equal(executeRead(db, 'SELECT COUNT(*) AS count FROM crew').rows[0].count, 48);
  } finally { db.close(); }
});

test('earlier crew repairs support a useful first-incident SQL comparison', () => {
  const state = createInitialState(42);
  assert.deepEqual(state.crewServiceHistory, createInitialState(42).crewServiceHistory);
  assert.notDeepEqual(state.crewServiceHistory, createInitialState(43).crewServiceHistory);
  assert.equal(state.crewServiceHistory.length, state.crew.filter(crew => crew.certification === 'REACTOR').length * 3);
  const db = buildDatabase(SQL, state);
  try {
    const records = executeRead(db, "SELECT name, outcome, work_ticks, fatigue_after FROM repair_history WHERE task_type = 'REACTOR_MAINTENANCE'", 300, 1).rows;
    assert.equal(records.length, state.crewServiceHistory.length);
    assert.ok(new Set(records.map(row => row.work_ticks)).size > 1);
    const summary = executeRead(db, "SELECT name, COUNT(*) AS jobs, AVG(work_ticks) AS avg_ticks FROM repair_history WHERE task_type = 'REACTOR_MAINTENANCE' GROUP BY name ORDER BY avg_ticks", 300, 2).rows;
    assert.equal(summary.length, state.crewServiceHistory.length / 3);
    assert.ok(summary.every(row => row.jobs === 3));
    const joined = executeRead(db, "SELECT c.name, h.outcome FROM crew_service_history h JOIN crew c ON c.crew_id = h.crew_id WHERE h.task_type = 'REACTOR_MAINTENANCE'", 300, 3).rows;
    assert.equal(joined.length, records.length);
  } finally { db.close(); }
});

test('all oracle queries produce evidence on at least three seeds', () => {
  for (const seed of [1, 42, 10000]) {
    const state = tickToIncident(seed); const db = buildDatabase(SQL, state); const challenge = buildDatabase(SQL, state);
    try {
      changeEvidenceFacts(challenge);
      for (const question of scenario.questions) {
        const result = executeRead(db, question.sql);
        assert.ok(evidenceForQuery(db, challenge, question.sql, result).includes(question.id));
      }
      const equivalent = `WITH current AS (${scenario.questions[0].sql.slice(0, -1)}) SELECT * FROM current ORDER BY module_name DESC;`;
      assert.ok(evidenceForQuery(db, challenge, equivalent, executeRead(db, equivalent)).includes('loads'));
    } finally { db.close(); challenge.close(); }
  }
});

test('missing, duplicate, hard-coded and truncated evidence is rejected', () => {
  const state = tickToIncident(42); const db = buildDatabase(SQL, state); const challenge = buildDatabase(SQL, state);
  try {
    changeEvidenceFacts(challenge);
    const oracle = scenario.questions.find(question => question.id === 'maintenance').sql.slice(0, -1).replace(/ ORDER BY recorded_at DESC LIMIT 28$/, '');
    for (const sql of [`${oracle} LIMIT 1`, `${oracle} UNION ALL ${oracle}`, 'SELECT 1 AS module_id']) {
      assert.deepEqual(evidenceForQuery(db, challenge, sql, executeRead(db, sql)), []);
    }
    const rows = executeRead(db, oracle).rows;
    const hardcoded = rows.map(row => 'SELECT ' + Object.entries(row).map(([key, value]) => `${typeof value === 'string' ? `'${value}'` : value} AS ${key}`).join(', ')).join(' UNION ALL ');
    assert.deepEqual(evidenceForQuery(db, challenge, hardcoded, executeRead(db, hardcoded)), []);
    assert.deepEqual(evidenceForQuery(db, challenge, oracle, { ...executeRead(db, oracle), truncated: true }), []);
  } finally { db.close(); challenge.close(); }
});

test('read policy blocks writes, stacked SQL and administrative bypasses', () => {
  const db = buildDatabase(SQL, tickToIncident(42));
  try {
    for (const sql of ['UPDATE modules SET occupants=0', 'SELECT 1; DELETE FROM modules', 'PRAGMA query_only=OFF', "ATTACH ':memory:' AS other", 'WITH x AS (SELECT 1) DELETE FROM crew', "SELECT load_extension('x')", 'SELECT 1; /* comment */ SELECT 2']) assert.throws(() => executeRead(db, sql));
    validateReadQuery("-- SELECT is safe\nSELECT '; UPDATE' AS text; -- done");
    assert.equal(executeRead(db, "SELECT '; UPDATE' AS text;").rows[0].text, '; UPDATE');
    assert.throws(() => executeRead(db, 'SELECT 1 AS same, 2 AS same'));
    assert.equal(executeRead(db, 'SELECT * FROM modules', 2).truncated, true);
    assert.equal(executeRead(db, 'SELECT COUNT(*) AS count FROM modules').rows[0].count, 3);
  } finally { db.close(); }
});

test('SQL curriculum unlocks concepts in order and keeps early queries short', () => {
  const db = buildDatabase(SQL, createInitialState(42));
  try {
    const beginner = "SELECT module_name, mw FROM current_modules WHERE kind = 'habitat'";
    assert.equal(executeRead(db, beginner, 300, 1).rows.length, 1);
    assert.equal(nextSqlLevel(1, validateReadQuery(beginner, 1)), 2);
    assert.throws(() => executeRead(db, 'SELECT * FROM current_modules ORDER BY mw', 300, 1));
    assert.equal(nextSqlLevel(2, validateReadQuery('SELECT COUNT(*) AS total FROM current_modules', 2)), 3);
    assert.throws(() => executeRead(db, 'SELECT * FROM crew JOIN assignments ON assignments.crew_id = crew.crew_id', 300, 2));
    assert.equal(nextSqlLevel(3, validateReadQuery('SELECT crew.crew_id FROM crew JOIN assignments ON assignments.crew_id = crew.crew_id', 3)), 4);
  } finally { db.close(); }
});

test('level 4 safely supports INSERT, UPDATE and DELETE on work orders only', () => {
  const db = buildDatabase(SQL, createInitialState(42));
  try {
    assert.throws(() => executeWorkOrderMutation(db, "UPDATE work_orders SET priority=4 WHERE work_order_id=1", 3));
    assert.equal(executeWorkOrderMutation(db, "INSERT INTO work_orders VALUES (3, 1, 'COOLANT', 3, 'OPEN', 'Inspect loop')", 4).rows[0].affected_rows, 1);
    const updated = executeWorkOrderMutation(db, "UPDATE work_orders SET priority=4, status='ACTIVE' WHERE work_order_id=1", 4);
    assert.equal(updated.mutationRows.find(row => row.work_order_id === 1).status, 'ACTIVE');
    const removed = executeWorkOrderMutation(db, "DELETE FROM work_orders WHERE status='RESOLVED'", 4);
    assert.equal(removed.mutationRows.some(row => row.status === 'RESOLVED'), false);
    assert.throws(() => executeWorkOrderMutation(db, 'UPDATE modules SET occupants=0', 4));
    assert.throws(() => executeWorkOrderMutation(db, 'DELETE FROM work_orders; DELETE FROM modules', 4));
  } finally { db.close(); }
});

test('a prioritized Reactor work order shortens the repair', () => {
  let normal = tickToIncident(42); normal = apply(normal, 'suspend-industry').state; normal = apply(normal, 'assign-engineer').state;
  const prioritized = structuredClone(normal);
  prioritized.workOrders.find(order => order.module_id === 1).priority = 4;
  prioritized.workOrders.find(order => order.module_id === 1).status = 'ACTIVE';
  const normalRepair = apply(normal, 'repair-reactor').state.repair.remaining;
  const priorityRepair = apply(prioritized, 'repair-reactor').state.repair.remaining;
  assert.equal(priorityRepair, normalRepair - 1);
});

test('mission guide derives a clear objective from authoritative state', () => {
  const investigation = { history: [], level: 1 };
  let state = createInitialState(42);
  assert.equal(deriveMission(state, investigation).phase, 'control');
  assert.match(deriveMission(state, investigation).title, /Restore Habitat power/);
  state = executeControl(state, { type: 'set-power', moduleId: 2, value: 50, expectedStateVersion: state.version }).state;
  assert.equal(deriveMission(state, investigation).phase, 'stabilize');
  assert.equal(deriveMission(state, investigation).target, 'resume');
  investigation.history.push({ success: true, version: state.version });
  assert.equal(deriveMission(state, investigation).phase, 'stabilize');
  while (!state.incident) state = advanceTick(state);
  assert.equal(deriveMission(state, investigation).title, 'Contain the Reactor fault');
  state = apply(state, 'suspend-industry').state;
  assert.equal(deriveMission(state, investigation).phase, 'recover');
});

test('debrief reports outcomes and one actionable next practice', () => {
  const state = createInitialState(42);
  const debrief = buildDebrief(state, { history: [], level: 1 });
  assert.equal(debrief.cards.length, 3);
  assert.equal(debrief.cards[0].value, 'Awaiting incident');
  assert.equal(debrief.cards[2].value, 'Response pending');
  assert.match(debrief.recommendation, /SQL Toolkit/);
  assert.ok(debrief.cards.every(card => card.label && card.value && card.detail));
});

test('optional investigation only counts after the latest control change', () => {
  const investigation = { history: [{ success: true, version: 0 }], level: 2 };
  let state = createInitialState(42);
  state = executeControl(state, { type: 'set-power', moduleId: 2, value: 50, expectedStateVersion: state.version }).state;
  state = executeControl(state, { type: 'set-power', moduleId: 3, value: 25, expectedStateVersion: state.version }).state;
  assert.equal(state.commands.at(-1).version, state.version);
  assert.equal(missionCompletion(state, investigation).investigate, false);
  assert.equal(deriveMission(state, investigation).target, 'resume');
  investigation.history.push({ success: true, version: state.version });
  assert.equal(missionCompletion(state, investigation).investigate, true);
});

test('mission completion never credits bypassed onboarding steps', () => {
  let state = tickToIncident(42);
  let completion = missionCompletion(state, { history: [], level: 1 });
  assert.equal(completion.control, false); assert.equal(completion.investigate, false);
  state = executeControl(state, { type: 'set-power', moduleId: 1, value: 8, expectedStateVersion: state.version }).state;
  completion = missionCompletion(state, { history: [{ success: true, version: 0 }], level: 2 });
  assert.equal(completion.control, false); assert.equal(completion.investigate, false);
  state = executeControl(state, { type: 'set-power', moduleId: 2, value: 50, expectedStateVersion: state.version }).state;
  completion = missionCompletion(state, { history: [{ success: true, version: 0 }], level: 2 });
  assert.equal(completion.control, true); assert.equal(completion.investigate, false);
});

test('first task is a real Habitat shortfall and restoring it opens station play', () => {
  const state = createInitialState(42);
  const habitat = state.modules.find(module => module.kind === 'habitat');
  assert.ok(habitat.mw < habitat.minimum_mw);
  assert.equal(habitat.status, 'Warning');
  assert.equal(state.incident, null);
  const restored = executeControl(state, { type: 'set-power', moduleId: habitat.module_id, value: habitat.nominal_mw, expectedStateVersion: state.version });
  assert.ok(restored.success);
  assert.equal(restored.state.modules.find(module => module.kind === 'habitat').status, 'Normal');
  assert.equal(deriveMission(restored.state, { history: [], level: 1 }).target, 'resume');
});

test('teacher scenarios with no safe power threshold fall back to a general control task', () => {
  const custom = defaultScenario();
  const habitat = custom.modules.find(module => module.kind === 'habitat');
  habitat.minimum_mw = 0;
  const state = createInitialState(42, custom);
  assert.equal(state.intro, null);
  assert.equal(deriveMission(state, { history: [], level: 1 }).phase, 'control');
});

test('containment choices expose qualitative comparison metadata', () => {
  for (const decision of decisions) {
    assert.ok(decision.impacts.length >= 2);
    assert.ok(decision.tempo);
    assert.ok(decision.tradeoff);
  }
});

test('new sessions begin paused for the briefing', async () => {
  const repository = { init: async () => {}, project: () => {}, exportSnapshot: () => new Uint8Array(), close: () => {} };
  const runner = { close: () => {} };
  const session = new StationSession(repository, runner); await session.init(42);
  assert.equal(session.paused, true);
  session.advance(20000); assert.equal(session.state.tick, 0);
  session.setPaused(false); for (let i = 0; i < 5; i++) session.advance(1000); assert.equal(session.state.tick, 1);
});

test('pause, investigation mode, speed and failed projection preserve state', async () => {
  const repository = { init: async () => {}, project: () => {}, exportSnapshot: () => new Uint8Array(), close: () => {} };
  const runner = { close: () => {} };
  const session = new StationSession(repository, runner); await session.init(42);
  session.setPaused(true); for (let i = 0; i < 10; i++) session.advance(1000); assert.equal(session.state.tick, 0);
  session.setPaused(false); session.setInvestigation(true); for (let i = 0; i < 10; i++) session.advance(1000); assert.equal(session.state.tick, 0);
  session.setInvestigation(false); session.setSpeed(2); for (let i = 0; i < 5; i++) session.advance(1000); assert.equal(session.state.tick, 2);
  const before = session.snapshot(); repository.project = () => { throw new Error('projection failed'); };
  assert.throws(() => session.commit(advanceTick(session.state))); assert.deepEqual(session.snapshot(), before);
});

test('review preserves query, evidence and action order within the same tick', async () => {
  const repository = { init: async () => {}, project: () => {}, exportSnapshot: () => new Uint8Array(), close: () => {} };
  const runner = { close: () => {}, run: async () => ({ success: true, rows: [], evidence: ['loads'] }) };
  const session = new StationSession(repository, runner); await session.init();
  session.commit(tickToIncident(42));
  await session.query(scenario.questions[0].sql); assert.ok(session.pin().success);
  assert.ok(session.act('suspend-industry').success);
  assert.deepEqual(session.timeline.slice(-4).map(event => event.type), ['QUERY #1 / v3', 'SQL LEVEL', 'EVIDENCE PINNED', 'ACTION']);
  assert.equal(session.pin().success, false);
  session.reset(1);
  assert.equal(session.timeline.length, 1); assert.equal(session.investigation.history.length, 0);
});

test('routine inspection assigns itself and completes without player micromanagement', () => {
  let state = createInitialState(42);
  assert.equal(state.tasks[0].status, 'OPEN');
  for (let i = 0; i < 5; i++) state = advanceTick(state);
  assert.equal(state.tasks[0].status, 'COMPLETE');
  assert.ok(state.crewTaskHistory.some(event => event.task_id === 1 && event.event === 'ASSIGNED'));
  assert.ok(state.crewTaskHistory.some(event => event.task_id === 1 && event.event === 'COMPLETE'));
  assert.ok(state.history.some(event => event.type === 'CREW TASK COMPLETE'));
});

test('Reactor task requires containment, certification, skill and available health', () => {
  let state = tickToIncident(42);
  const task = state.tasks.find(item => item.type === 'REACTOR_REPAIR');
  assert.ok(task);
  assert.equal(executeTaskCommand(state, { type: 'assign', taskId: task.task_id, crewId: 7, expectedStateVersion: state.version }).success, false);
  state = apply(state, 'suspend-industry').state;
  assert.equal(taskEligibility(state.crew[0], task), null);
  assert.equal(taskEligibility(state.crew[6], task), null);
  assert.match(taskEligibility(state.crew[1], task), /Engineering|certification/);
  state.crew[6].health = 40;
  assert.equal(crewStatus(state.crew[6]), 'Unavailable');
  assert.equal(executeTaskCommand(state, { type: 'assign', taskId: task.task_id, crewId: 7, expectedStateVersion: state.version }).success, false);
});

test('crew choice and priority change task pace, fatigue and health deterministically', () => {
  const incident = apply(tickToIncident(42), 'suspend-industry').state;
  const taskId = incident.tasks.find(task => task.type === 'REACTOR_REPAIR').task_id;
  const assign = (state, crewId) => executeTaskCommand(state, { type: 'assign', taskId, crewId, expectedStateVersion: state.version }).state;
  const tired = advanceTick(advanceTick(assign(incident, 1)));
  const rested = advanceTick(advanceTick(assign(incident, 7)));
  assert.ok(tired.tasks.find(task => task.task_id === taskId).progress < rested.tasks.find(task => task.task_id === taskId).progress);
  assert.ok(tired.crew[0].health < incident.crew[0].health);
  const fast = executeTaskCommand(assign(incident, 7), { type: 'priority', taskId, priority: 5, expectedStateVersion: incident.version + 1 }).state;
  const fastTick = advanceTick(advanceTick(fast));
  assert.ok(fastTick.tasks.find(task => task.task_id === taskId).progress > rested.tasks.find(task => task.task_id === taskId).progress);
  assert.ok(fastTick.crew[6].fatigue > rested.crew[6].fatigue);
});

test('chosen engineer completes Reactor repair and SQL records the task history', () => {
  let state = apply(tickToIncident(42), 'suspend-industry').state;
  const taskId = state.tasks.find(task => task.type === 'REACTOR_REPAIR').task_id;
  const assigned = executeTaskCommand(state, { type: 'assign', taskId, crewId: 7, expectedStateVersion: state.version });
  assert.ok(assigned.success, assigned.error); state = assigned.state;
  assert.equal(deriveMission(state, { history: [], level: 1 }).target, 'resume');
  for (let i = 0; i < 25 && state.generation < state.nominalGeneration; i++) state = advanceTick(state);
  assert.equal(state.generation, state.nominalGeneration);
  assert.equal(state.incident.status, 'resolved');
  assert.equal(state.tasks.find(task => task.task_id === taskId).status, 'COMPLETE');
  assert.equal(state.crew[6].current_task_id, null);
  const db = buildDatabase(SQL, state);
  try {
    const history = executeRead(db, "SELECT c.name, t.title, h.event FROM crew_task_history h JOIN crew c ON c.crew_id = h.crew_id JOIN tasks t ON t.task_id = h.task_id WHERE t.type = 'REACTOR_REPAIR' AND h.event = 'COMPLETE'", 300, 3).rows;
    assert.equal(history.length, 1);
    assert.equal(history[0].name, state.crew[6].name);
    assert.equal(executeRead(db, 'SELECT status FROM tasks WHERE task_id = 2').rows[0].status, 'COMPLETE');
    assert.throws(() => executeRead(db, 'UPDATE crew SET fatigue = 0 WHERE crew_id = 7'));
  } finally { db.close(); }
});

test('low Habitat oxygen creates a powered recovery task that crew can complete', () => {
  let state = apply(tickToIncident(42), 'reduce-habitat').state;
  for (let i = 0; i < 16 && !state.tasks.some(task => task.type === 'OXYGEN_RECOVERY'); i++) state = advanceTick(state);
  const task = state.tasks.find(item => item.type === 'OXYGEN_RECOVERY');
  assert.ok(task, 'expected low oxygen to create a recovery task');
  assert.equal(deriveMission(state, { history: [], level: 1 }).target, 'crew');
  const crew = state.crew.find(member => !taskEligibility(member, task));
  assert.ok(crew, 'expected an eligible Oxygen technician');
  const before = metrics(state);
  const assigned = executeTaskCommand(state, { type: 'assign', taskId: task.task_id, crewId: crew.crew_id, expectedStateVersion: state.version });
  assert.ok(assigned.success, assigned.error); state = assigned.state;
  assert.equal(metrics(state).taskLoad, task.power_draw);
  assert.equal(metrics(state).balance, before.balance - task.power_draw);
  assert.equal(deriveMission(state, { history: [], level: 1 }).target, 'resume');
  for (let i = 0; i < 12 && state.tasks.find(item => item.task_id === task.task_id).status !== 'COMPLETE'; i++) state = advanceTick(state);
  assert.equal(state.tasks.find(item => item.task_id === task.task_id).status, 'COMPLETE');
  assert.ok(state.modules.find(module => module.kind === 'habitat').oxygen_level >= 95);
  const db = buildDatabase(SQL, state);
  try {
    const row = executeRead(db, `SELECT status, power_draw FROM tasks WHERE task_id = ${task.task_id}`).rows[0];
    assert.deepEqual(row, { status: 'COMPLETE', power_draw: 3 });
    assert.equal(executeRead(db, `SELECT COUNT(*) AS count FROM crew_task_history WHERE task_id = ${task.task_id} AND event = 'COMPLETE'`).rows[0].count, 1);
  } finally { db.close(); }
});

test('unavailable assigned crew pauses repair and preserves progress', () => {
  let state = apply(tickToIncident(42), 'suspend-industry').state;
  const taskId = state.tasks.find(task => task.type === 'REACTOR_REPAIR').task_id;
  state = executeTaskCommand(state, { type: 'assign', taskId, crewId: 7, expectedStateVersion: state.version }).state;
  state = advanceTick(state);
  const progress = state.tasks.find(task => task.task_id === taskId).progress;
  state.crew[6].health = 40;
  state = advanceTick(state);
  assert.equal(state.tasks.find(task => task.task_id === taskId).status, 'OPEN');
  assert.equal(state.tasks.find(task => task.task_id === taskId).progress, progress);
  assert.equal(state.crew[6].current_task_id, null);
  assert.ok(state.crewTaskHistory.some(event => event.task_id === taskId && event.event === 'UNASSIGNED'));
});
