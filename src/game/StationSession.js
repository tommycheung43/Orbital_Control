import { createInitialState, advanceTick } from './SimulationEngine.js';
import { executeAction } from './ActionService.js';
import { executeControl } from './SystemControlService.js';
import { executeTaskCommand } from './CrewTaskService.js';
import { defaultScenario, normalizeScenario, validateScenario } from '../data/scenarioConfig.js';
import { GameplayRepository } from '../database/GameplayRepository.js';
import { QueryRunner } from '../investigation/QueryRunner.js';
import { nextSqlLevel } from '../investigation/curriculum.js';
import { readTokens } from '../investigation/queryPolicy.js';

export class StationSession {
  constructor(repository = new GameplayRepository(), runner = new QueryRunner()) {
    this.repository = repository; this.runner = runner; this.listeners = new Set();
    this.paused = true; this.investigating = false; this.speed = 1;
    this.investigation = { history: [], evidence: [], lastQuery: null, level: 1 };
    this.analytics = []; this.timeline = []; this.elapsed = 0; this.scenario = defaultScenario();
  }
  async init(seed = 42) { await this.repository.init(); this.reset(seed); }
  reset(seed) {
    this.runner.close();
    const initial = createInitialState(seed, this.scenario);
    this.repository.project(initial);
    this.state = initial;
    this.timeline = structuredClone(initial.history);
    this.paused = true; this.investigating = false; this.elapsed = 0;
    this.investigation = { history: [], evidence: [], lastQuery: null, level: 1 };
    this.analytics = []; this.emit();
  }
  commit(state) {
    this.repository.project(state);
    this.timeline.push(...structuredClone(state.history.slice(this.state?.history.length ?? 0)));
    this.state = state;
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { this.listeners.forEach(listener => listener()); }
  snapshot() { return structuredClone(this.state); }
  advance(delta) {
    if (this.paused || this.investigating || this.state.ended) return;
    this.elapsed += Math.min(delta, 1000) * this.speed;
    while (this.elapsed >= 5000) { this.elapsed -= 5000; this.commit(advanceTick(this.state)); this.emit(); }
  }
  setInvestigation(open) { this.investigating = open; this.emit(); }
  setPaused(paused) { this.paused = paused; this.emit(); }
  setSpeed(speed) { if ([0.25, 1, 2].includes(speed)) this.speed = speed; this.emit(); }
  recordHint(questionId) { this.analytics.push({ type: 'HINT', tick: this.state.tick, questionId }); }
  async query(sql) {
    let version = this.state.version;
    const tick = this.state.tick;
    const result = await this.runner.run(sql, this.repository.exportSnapshot(), this.investigation.level);
    if (result.success && result.mutationRows) {
      const next = structuredClone(this.state); next.workOrders = result.mutationRows; next.version++;
      next.commands.push({ type: `sql-${result.mutationType.toLowerCase()}`, tick, table: 'work_orders' });
      next.history.push({ tick, type: 'SQL WORK ORDER', message: `${result.mutationType} changed ${result.rows[0].affected_rows} row(s).`, deltas: {} });
      this.commit(next); version = next.version;
    }
    const query = { id: this.investigation.history.length + 1, sql, version, tick, ...result };
    this.investigation.history.push(query);
    this.investigation.lastQuery = query;
    this.timeline.push({ tick, type: `QUERY #${query.id} / v${version}`, message: `${sql}\n${result.success ? `${result.rows.length} rows; evidence: ${result.evidence.join(', ') || 'none'}` : result.error}` });
    this.analytics.push({ type: 'QUERY', tick, version, success: result.success });
    if (result.success) {
      const nextLevel = nextSqlLevel(this.investigation.level, readTokens(sql));
      if (nextLevel > this.investigation.level) {
        this.investigation.level = nextLevel;
        this.timeline.push({ tick, type: 'SQL LEVEL', message: `SQL level ${nextLevel} unlocked.` });
      }
    }
    this.emit(); return query;
  }
  pin() {
    const query = this.investigation.lastQuery;
    if (!query?.success || query.version !== this.state.version || !this.state.incident || !query.evidence.length) return { success: false, error: 'Run a current query containing the requested facts before pinning evidence.' };
    for (const questionId of query.evidence) {
      this.investigation.evidence = this.investigation.evidence.filter(card => card.questionId !== questionId);
      this.investigation.evidence.push({ id: `${query.id}:${questionId}`, queryId: query.id, questionId, version: query.version, incidentId: this.state.incident.id });
    }
    this.analytics.push({ type: 'EVIDENCE', tick: this.state.tick, queryId: query.id, questions: query.evidence });
    this.timeline.push({ tick: this.state.tick, type: 'EVIDENCE PINNED', message: `Query #${query.id}: ${query.evidence.join(', ')}` });
    this.emit(); return { success: true };
  }
  act(type) {
    const result = executeAction(this.state, { type, expectedStateVersion: this.state.version }, this.investigation.evidence);
    if (result.success) this.commit(result.state);
    this.analytics.push({ type: 'DECISION', tick: this.state.tick, action: type, success: result.success });
    this.emit(); return result;
  }
  control(command) {
    const result = executeControl(this.state, { ...command, expectedStateVersion: this.state.version });
    if (result.success) this.commit(result.state);
    this.analytics.push({ type: 'CONTROL', tick: this.state.tick, command: command.type, success: result.success });
    this.emit(); return result;
  }
  manageTask(command) {
    const result = executeTaskCommand(this.state, { ...command, expectedStateVersion: this.state.version });
    if (result.success) this.commit(result.state);
    this.analytics.push({ type: 'CREW_TASK', tick: this.state.tick, command: command.type, success: result.success });
    this.emit(); return result;
  }
  applyScenario(candidate, seed = this.state?.seed ?? 42) {
    const validation = validateScenario(candidate);
    if (!validation.valid) return { success: false, errors: validation.errors };
    this.scenario = normalizeScenario(candidate);
    this.reset(seed);
    return { success: true, scenario: structuredClone(this.scenario) };
  }
  getScenario() { return structuredClone(this.scenario); }
  close() { this.runner.close(); this.repository.close(); this.listeners.clear(); }
}

export default new StationSession();
