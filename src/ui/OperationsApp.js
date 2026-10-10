import { decisions, operations } from '../data/reactorScenario.js';
import { metrics } from '../game/SimulationEngine.js';
import { actionProblem } from '../game/ActionService.js';
import { tableDescriptions } from '../database/GameplayRepository.js';
import { defaultScenario } from '../data/scenarioConfig.js';
import { sqlStages } from '../investigation/curriculum.js';
import { buildDebrief, deriveMission, introStatus, missionCompletion, missionPhases } from '../game/MissionGuide.js';
import { crewStatus, taskEligibility } from '../game/CrewTaskService.js';
import { SqlAgentService } from '/ai_agent/SqlAgentService.js';

const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const byId = id => document.getElementById(id);
const badge = (label, tone) => element('span', label, `status-badge ${tone}`);

const API_BASE_URL = 'http://127.0.0.1:8000';

export default class OperationsApp {
  constructor(session) {
    this.session = session; this.mode = 'station'; this.busy = false;
    this.sqlAgent = new SqlAgentService();
    this.abort = new AbortController(); this.actionNodes = new Map(); this.controlModuleId = null; this.selectedTaskId = null;
    this.bind('pause-time', 'click', () => session.setPaused(!session.paused));
    this.bind('time-speed', 'change', event => session.setSpeed(Number(event.target.value)));
    for (const mode of ['station', 'crew', 'control', 'investigation', 'review', 'teacher']) this.bind(`${mode}-mode`, 'click', () => this.setMode(mode));
    this.bind('open-investigation', 'click', () => this.setMode('investigation'));
    this.bind('open-crew', 'click', () => this.setMode('crew'));
    this.bind('crew-return', 'click', () => this.setMode('station'));
    this.bind('crew-search', 'input', () => this.renderCrewRoster(this.session.snapshot()));
    this.bind('crew-investigate', 'click', () => {
      this.setMode('investigation');
      this.loadSql("SELECT name, outcome, work_ticks, fatigue_after FROM repair_history WHERE task_type = 'REACTOR_MAINTENANCE';");
    });
    this.bind('control-investigate', 'click', () => this.setMode('investigation'));
    this.bind('return-decision', 'click', () => this.setMode(this.investigationReturnMode ?? 'station'));
    this.bind('execute-sql', 'click', () => this.runQuery());
    this.bind('mission-continue', 'click', () => this.followMission());
    this.bind('sql-stage-example', 'click', () => this.loadSql(sqlStages[this.session.investigation.level - 1].example));
    document.querySelectorAll('.sql-preset').forEach(button => button.addEventListener('click', () => this.loadSql(button.dataset.sql), { signal: this.abort.signal }));
    this.bindControlForms();
    this.bindTeacherTools();
    this.bind('pin-evidence', 'click', () => {
      const result = session.pin();
      this.message(result.success ? 'Evidence pinned. Ready to compare actions.' : result.error);
    });
    this.bind('new-run', 'click', () => {
      if (this.busy) return;
      const seed = Number(byId('run-seed').value);
      try { session.reset(seed); this.setMode('station'); byId('query-results').replaceChildren(); byId('query-feedback').textContent = ''; this.message(`New run ready with seed ${seed}. Follow the briefing, then resume.`); }
      catch (error) { this.message(error.message); }
    });
    this.bind('export-review', 'click', () => {
      const record = { simulation: session.snapshot(), investigation: session.investigation, analytics: session.analytics, timeline: session.timeline };
      const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
      const link = element('a'); link.href = url; link.download = `orbital-run-${record.simulation.seed}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.key === 'Enter' && this.mode === 'investigation') { event.preventDefault(); this.runQuery(); }
      if (event.key === 'Escape' && this.mode !== 'station') this.setMode('station');
    }, { signal: this.abort.signal });
    this.buildActions(decisions, 'decision-list'); this.buildActions(operations, 'operation-list');
    for (const [table, description] of Object.entries(tableDescriptions)) {
      const details = element('details'); details.append(element('summary', table), element('p', description)); byId('schema-list').append(details);
    }
    try {
      const saved = localStorage.getItem('orbital-control-scenario');
      if (saved) session.applyScenario(JSON.parse(saved), session.state.seed);
    } catch { /* start with the bundled scenario */ }
    this.unsubscribe = session.subscribe(() => this.render()); this.render();
    this.loadTeacherForm(session.getScenario());
    this.message('Habitat power is below its safe minimum.');
  }
  bind(id, type, callback) { byId(id).addEventListener(type, callback, { signal: this.abort.signal }); }
  message(text) { byId('status-message').textContent = text; }
  loadSql(sql) { byId('sql-input').value = sql; byId('sql-input').focus(); }
  followMission() {
    const mission = deriveMission(this.session.snapshot(), this.session.investigation);
    if (mission.target === 'intro') {
      const { intro } = this.session.state;
      const result = this.session.control({ type: 'set-power', moduleId: intro.moduleId, value: intro.targetMw });
      this.message(result.success ? 'Habitat power restored.' : result.error);
      return;
    }
    if (mission.target === 'resume') { this.setMode('station'); this.session.setPaused(false); return; }
    if (mission.target === 'station') {
      this.setMode('station');
      if (mission.phase === 'stabilize') decisions.map(action => this.actionNodes.get(action.id)?.button).find(button => button && !button.disabled)?.focus();
      if (mission.phase === 'recover') { byId('recovery-panel').open = true; byId('recovery-panel').querySelector('summary').focus(); }
      return;
    }
    this.setMode(mission.target);
    if (mission.query) this.loadSql(mission.query);
  }
  setMode(mode) {
    if (mode === 'investigation' && this.mode !== 'investigation') this.investigationReturnMode = this.mode === 'crew' ? 'crew' : 'station';
    if (['investigation', 'teacher', 'crew'].includes(this.mode) && mode !== this.mode) this.session.setPaused(true);
    this.mode = mode;
    byId('advanced-menu').open = false;
    this.session.setInvestigation(['investigation', 'teacher', 'crew'].includes(mode));
    for (const name of ['station', 'crew', 'control', 'investigation', 'review', 'teacher']) {
      byId(`${name}-view`).hidden = name !== mode;
      byId(`${name}-mode`).setAttribute('aria-pressed', String(name === mode));
    }
    byId('mission-guide').hidden = mode === 'teacher';
    byId('return-decision').textContent = this.investigationReturnMode === 'crew' ? 'Return to crew' : 'Return to station';
    if (mode === 'investigation') byId('sql-input').focus();
    else if (mode === 'crew') byId('crew-title').focus();
    else if (mode === 'control') byId('control-mode').focus();
    else if (mode === 'teacher') byId('scenario-title').focus();
    else if (mode === 'station') byId('station-mode').focus();
    else byId('review-mode').focus();
  }
  bindControlForms() {
    const submit = (formId, type, value) => this.bind(formId, 'submit', event => {
      event.preventDefault();
      const result = this.session.control({ type, moduleId: this.controlModuleId, ...value() });
      this.message(result.success ? 'Control applied. Use SQL to inspect the result.' : result.error);
    });
    submit('power-control', 'set-power', () => ({ value: Number(byId('power-value').value) }));
    submit('oxygen-control', 'set-oxygen-target', () => ({ value: Number(byId('oxygen-value').value) }));
    submit('mode-control', 'set-module-mode', () => ({ value: byId('module-mode').value }));
    submit('crew-control', 'assign-crew', () => ({ crewId: Number(byId('crew-value').value) }));
  }
  bindTeacherTools() {
    this.bind('add-module', 'click', () => this.addTeacherModule({ module_name: 'Support', kind: 'support', nominal_mw: 10, minimum_mw: 5, occupants: 0, can_defer: 1, wear: 10, oxygen_level: 90 }));
    this.bind('reset-scenario', 'click', () => this.loadTeacherForm(defaultScenario()));
    this.bind('scenario-form', 'submit', event => {
      event.preventDefault(); const candidate = this.readTeacherForm();
      const result = this.session.applyScenario(candidate, Number(byId('run-seed').value));
      if (!result.success) { byId('teacher-errors').textContent = result.errors.join(' '); return; }
      byId('teacher-errors').textContent = '';
      try { localStorage.setItem('orbital-control-scenario', JSON.stringify(result.scenario)); } catch { /* persistence is optional */ }
      this.loadTeacherForm(result.scenario); this.setMode('station'); this.message('Scenario saved. Follow the briefing, then resume.');
    });
    this.bind('teacher-export', 'click', () => this.downloadJson(this.readTeacherForm(), 'orbital-scenario.json'));
    this.bind('teacher-import', 'click', () => byId('scenario-file').click());
    this.bind('scenario-file', 'change', async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { this.loadTeacherForm(JSON.parse(await file.text())); byId('teacher-errors').textContent = 'Imported. Review, then save.'; }
      catch { byId('teacher-errors').textContent = 'Could not read this scenario file.'; }
      event.target.value = '';
    });
  }
  downloadJson(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = element('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  addTeacherModule(module) {
    const row = element('div', undefined, 'teacher-module');
    const fields = [
      ['module_name', 'Name', 'text'], ['kind', 'Type', 'select'], ['nominal_mw', 'Normal MW', 'number'], ['minimum_mw', 'Minimum MW', 'number'],
      ['occupants', 'Occupants', 'number'], ['wear', 'Wear %', 'number'], ['oxygen_level', 'Oxygen %', 'number'], ['can_defer', 'Deferrable', 'checkbox'],
    ];
    for (const [name, labelText, type] of fields) {
      const label = element('label', labelText); let input;
      if (type === 'select') {
        input = element('select'); for (const value of ['reactor', 'habitat', 'industry', 'support']) { const option = element('option', value); option.value = value; input.append(option); }
        input.value = module[name];
      } else { input = element('input'); input.type = type; if (type === 'checkbox') input.checked = Boolean(Number(module[name])); else input.value = module[name]; }
      input.dataset.field = name; if (type === 'number') { input.min = '0'; input.max = '100'; input.step = '1'; }
      label.append(input); row.append(label);
    }
    const remove = element('button', 'Delete module'); remove.type = 'button'; remove.addEventListener('click', () => row.remove(), { signal: this.abort.signal }); row.append(remove);
    byId('teacher-modules').append(row);
  }
  loadTeacherForm(config) {
    byId('scenario-title').value = config.title ?? '';
    byId('scenario-trigger').value = config.triggerTick ?? 3; byId('scenario-deadline').value = config.deadlineTicks ?? 48;
    byId('scenario-run').value = config.runTicks ?? 90; byId('scenario-history').value = config.historySamples ?? 500;
    byId('teacher-modules').replaceChildren(); for (const module of config.modules ?? []) this.addTeacherModule(module);
  }
  readTeacherForm() {
    const base = this.session.getScenario();
    return { ...base, title: byId('scenario-title').value, triggerTick: Number(byId('scenario-trigger').value), deadlineTicks: Number(byId('scenario-deadline').value),
      runTicks: Number(byId('scenario-run').value), historySamples: Number(byId('scenario-history').value), modules: [...byId('teacher-modules').children].map(row => {
        const value = field => row.querySelector(`[data-field="${field}"]`); return {
          module_name: value('module_name').value, kind: value('kind').value, nominal_mw: Number(value('nominal_mw').value), minimum_mw: Number(value('minimum_mw').value),
          occupants: Number(value('occupants').value), wear: Number(value('wear').value), oxygen_level: Number(value('oxygen_level').value), can_defer: Number(value('can_defer').checked),
        };
      }) };
  }
  buildActions(definitions, containerId) {
    for (const action of definitions) {
      const card = element('div', undefined, 'action-card');
      const button = element('button', action.label);
      const reason = element('p', '', 'action-reason');
      reason.id = `reason-${action.id}`; button.setAttribute('aria-describedby', reason.id);
      button.addEventListener('click', () => {
        try {
          const result = this.session.act(action.id);
          this.message(result.success ? (containerId === 'decision-list' ? `${action.label} applied. Assign repair crew next; use SQL to inspect the consequences.` : `${action.label} applied. Use SQL to inspect the consequences.`) : result.error);
        } catch (error) { this.message(`Action could not be committed: ${error.message}`); }
      }, { signal: this.abort.signal });
      const impacts = element('div', undefined, 'action-meta');
      action.impacts.forEach(impact => impacts.append(element('span', impact)));
      card.append(button, impacts, element('p', `${action.tempo} · ${action.tradeoff}`, 'tradeoff'), reason); byId(containerId).append(card);
      this.actionNodes.set(action.id, { button, reason, card });
    }
  }

  async runQuery() {
    if (this.busy) return;
    this.busy = true; this.render();
    byId('query-feedback').textContent = 'Running query in an isolated snapshot…';
    try {
      const sqlCode = byId('sql-input').value;
      const query = await this.session.query(byId('sql-input').value);
      this.renderResult(query);
      this.renderAskAgentButton(sqlCode);
    } catch (error) { byId('query-feedback').textContent = error.message; }
    finally {
      this.busy = false; 
      this.render(); 
    }
  }

  /**
   * @param {string} sqlCode
   */
  renderAskAgentButton(sqlCode) {
    let btn = byId('ask-agent-btn');
    if (!btn) {
      btn = element('button', 'Ask AI Agent', 'btn-ask-agent');
      btn.id = 'ask-agent-btn';
      btn.style.marginLeft = '12px';
      byId('query-feedback').appendChild(btn);
    }

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => this.showAiExplanationDialog(sqlCode), 
                            { signal: this.abort.signal });
  }

  /**
   * @param {string} sqlCode
   */

  async showAiExplanationDialog(sqlCode) {
    let dialog = byId('ai-explanation-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'ai-explanation-dialog';
      dialog.className = 'ai-dialog';
      document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
      <div class="ai-dialog-header">
        <h3 class="ai-dialog-title">AI Agent SQL Explanation</h3>
        <button id="close-ai-modal" class="ai-dialog-close-btn">✕</button>
      </div>
      <div id="ai-modal-body" class="ai-dialog-body">
        <em>Analyzing your SQL code, please wait...</em>
      </div>
    `;

    dialog.querySelector('#close-ai-modal').addEventListener('click', () => dialog.close());
    
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    try {
      const explanation = await this.sqlAgent.explainSql(sqlCode);
      const formattedExplanation = explanation.replace(/\n/g, '<br/>');
      dialog.querySelector('#ai-modal-body').innerHTML = `<p>${formattedExplanation}</p>`;
    } catch (error) {
      dialog.querySelector('#ai-modal-body').innerHTML = `<span class="ai-dialog-error">Failed to get AI explanation: ${error.message}</span>`;
    }
  }

  renderResult(query) {
    const container = byId('query-results'); container.replaceChildren();
    if (!query.success) { byId('query-feedback').textContent = query.error; return; }
    byId('query-feedback').textContent = query.mutationType ? `${query.mutationType} changed ${query.rows[0].affected_rows} work order row(s).` : `${query.rows.length} rows${query.truncated ? ' (limit reached)' : ''} · v${query.version} · ${query.evidence.length ? `Optional challenge match: ${query.evidence.join(', ')}` : 'Use these results to inform your decision'}`;
    const table = element('table'); const head = element('thead'); const heading = element('tr');
    for (const column of query.columns) { const th = element('th', column); th.scope = 'col'; heading.append(th); }
    head.append(heading); table.append(head);
    const body = element('tbody');
    for (const row of query.rows) {
      const tr = element('tr'); for (const column of query.columns) tr.append(element('td', row[column] === null ? 'NULL' : String(row[column]))); body.append(tr);
    }
    table.append(body); container.append(table);
  }
  render() {
    const state = this.session.snapshot(); const summary = metrics(state); const scenario = this.session.getScenario();
    const intro = introStatus(state);
    const openingProblem = Boolean(state.intro && !intro.complete && !state.incident);
    const currentMission = deriveMission(state, this.session.investigation);
    byId('status-message').hidden = openingProblem;
    const notice = state.history.findLast(event => event.type !== 'TELEMETRY');
    const activeAlert = state.incident && ['active', 'escalated'].includes(state.incident.status) && !state.incident.decision;
    const noticeText = activeAlert ? `${scenario.title}: ${scenario.alert} Choose a response at Station.` : notice?.message;
    if (noticeText && noticeText !== this.lastNotice) { this.lastNotice = noticeText; this.message(noticeText); }
    byId('run-clock').textContent = `Shift tick ${state.tick}`;
    byId('time-state').textContent = state.ended ? 'Shift ended' : this.mode === 'crew' ? 'Paused for crew management' : this.session.investigating ? 'Paused for investigation' : this.session.paused ? 'Paused — resume when ready' : `Running at ${this.session.speed}×`;
    byId('pause-time').textContent = this.session.paused ? 'Resume time' : 'Pause time';
    byId('pause-time').hidden = openingProblem;
    byId('pause-time').disabled = this.session.investigating || state.ended;
    byId('new-run').disabled = this.busy;
    const displayMetrics = [['Power balance', `${summary.balance} MW`], ['Oxygen', `${summary.oxygen.toFixed(1)}%`], ['Battery', `${summary.battery.toFixed(2)} MWh`], ['Production', `${summary.throughput}%`], ['Reactor wear', `${summary.wear.toFixed(1)}%`], ['Crew fatigue', `${summary.fatigue.toFixed(1)}%`]];
    byId('metrics').replaceChildren(...displayMetrics.map(([label, value]) => { const card = element('div', undefined, 'metric'); card.append(element('span', label), element('strong', value)); return card; }));
    const urgentTasks = state.tasks.filter(task => task.status === 'OPEN' && task.source === 'incident').length;
    const activeTasks = state.tasks.filter(task => task.status === 'ACTIVE').length;
    const pulse = [
      ['Power', `${summary.balance >= 0 ? '+' : ''}${summary.balance} MW`, summary.balance < 0 ? 'danger' : 'success'],
      ['Oxygen', `${summary.oxygen.toFixed(1)}%`, summary.oxygen < 70 ? 'danger' : summary.oxygen < 85 ? 'warning' : 'success'],
      ['Crew ready', `${summary.crewReady}/${state.crew.length}`, summary.crewReady < state.crew.length * .75 ? 'warning' : 'crew'],
      ['Spares', String(state.spares), state.spares < 2 ? 'warning' : 'information'],
      ['Work queue', `${urgentTasks} urgent · ${activeTasks} working`, urgentTasks ? 'warning' : 'information'],
    ];
    byId('station-pulse').hidden = openingProblem;
    byId('station-pulse').replaceChildren(...pulse.map(([label, value, tone]) => {
      const card = element('div', undefined, 'pulse-card'); card.dataset.tone = tone;
      card.append(element('span', label), element('strong', value)); return card;
    }));
    byId('module-summary').replaceChildren(...state.modules.map(module => element('p', `${module.module_name}: ${module.status} · ${module.mw} MW`)));
    byId('crew-readiness').textContent = `${summary.crewReady} crew available · ${state.tasks.filter(task => task.status === 'ACTIVE').length} tasks active`;
    byId('incident-title').parentElement.dataset.severity = state.incident?.status === 'escalated' ? 'critical' : state.incident?.status === 'active' ? 'warning' : openingProblem ? 'warning' : 'information';
    byId('incident-title').textContent = state.incident ? `${scenario.title} · ${state.incident.status}` : openingProblem ? 'Habitat needs power' : state.intro ? 'Habitat power restored' : 'Station ready';
    const crewRepair = state.tasks.find(task => task.type === 'REACTOR_REPAIR' && task.status !== 'COMPLETE');
    const oxygenTask = state.tasks.find(task => task.type === 'OXYGEN_RECOVERY' && task.status !== 'COMPLETE');
    byId('incident-brief').textContent = oxygenTask?.status === 'ACTIVE' ? 'Habitat scrubber recovery is active and drawing extra power.' : oxygenTask ? 'Habitat oxygen is low. Assign a certified technician from Crew & tasks.' : state.incident?.status === 'resolved' ? 'Output restored. Resume normal allocations.' : state.incident?.status === 'contained' ? crewRepair?.status === 'ACTIVE' ? 'Contained. Crew are repairing the Reactor; resume time to advance the work.' : 'Contained. Assign an engineer and repair the Reactor.' : state.incident ? scenario.alert : openingProblem ? 'You are the station operator. Habitat life support needs steady power.' : currentMission.phase === 'investigate' ? 'Next, inspect the result in Investigation.' : 'Power is stable. Resume time for the next alert.';
    byId('incident-deadline').textContent = oxygenTask ? (oxygenTask.status === 'ACTIVE' ? `Scrubber task active · ${oxygenTask.power_draw} MW load` : `Oxygen task awaiting crew · ${oxygenTask.power_draw} MW load when active`) : state.repair ? `Repair: ${state.repair.remaining} ticks · Spares ${state.spares}` : state.incident?.status === 'active' ? `${Math.max(0, state.incident.deadline - state.tick)} ticks to overload` : crewRepair ? (crewRepair.status === 'ACTIVE' ? `Crew repair in progress · Spares ${state.spares}` : `Repair task awaiting crew · Spares ${state.spares}`) : openingProblem || state.incident ? '' : `Next alert at tick ${scenario.triggerTick}`;
    byId('incident-deadline').hidden = openingProblem;
    const showConsequence = Boolean(state.intro && intro.complete && !state.incident);
    byId('first-action-feedback').hidden = !showConsequence;
    if (showConsequence) byId('first-action-feedback').textContent = `${intro.module.module_name} is now ${intro.module.status.toLowerCase()}. Power demand rose. You can inspect exact readings with SQL, or resume for the next alert.`;
    byId('investigation-mode').hidden = openingProblem;
    byId('open-investigation').hidden = openingProblem;
    byId('evidence-section').hidden = !state.incident;
    const recoveryStage = state.incident?.status ?? 'idle';
    byId('decision-list').hidden = !state.incident || recoveryStage === 'resolved';
    byId('decision-heading').hidden = !state.incident || recoveryStage === 'resolved';
    byId('recovery-panel').hidden = !state.incident;
    if (recoveryStage !== this.recoveryStage) {
      this.recoveryStage = recoveryStage;
      byId('recovery-panel').open = ['contained', 'resolved', 'escalated'].includes(recoveryStage);
    }
    for (const [id, nodes] of this.actionNodes) {
      const problem = actionProblem(state, id, this.session.investigation.evidence);
      nodes.button.disabled = Boolean(problem); nodes.reason.textContent = problem || 'Ready';
      nodes.card.hidden = decisions.some(action => action.id === id) && Boolean(state.incident?.decision) && state.incident.decision !== id
        || ['assign-engineer', 'repair-reactor'].includes(id) && state.tasks.some(task => task.type === 'REACTOR_REPAIR');
    }
    byId('execute-sql').disabled = this.busy;
    const last = this.session.investigation.lastQuery;
    byId('pin-evidence').disabled = this.busy || !last?.success || !last.evidence.length || last.version !== state.version || !state.incident;
    byId('snapshot-label').textContent = `Current snapshot v${state.version} · tick ${state.tick}`;
    this.renderControls(state);
    this.renderCrew(state);
    this.renderMission(state);
    this.renderCurriculum();
    this.renderQuestions(state);
    this.renderHistory(state);
  }
  renderMission(state) {
    const mission = deriveMission(state, this.session.investigation); this.currentMission = mission;
    const completion = missionCompletion(state, this.session.investigation);
    const guide = byId('mission-guide');
    guide.classList.toggle('urgent', state.incident?.status === 'active');
    guide.classList.toggle('critical', state.incident?.status === 'escalated');
    byId('mission-title').textContent = mission.title; byId('mission-detail').textContent = mission.detail;
    const managementPaused = ['crew', 'investigation', 'teacher'].includes(this.mode);
    const timeRunning = mission.target === 'resume' && !this.session.paused && !managementPaused;
    byId('mission-continue').textContent = mission.target === 'resume' && managementPaused ? 'Return and resume' : timeRunning ? 'Time running' : mission.cta;
    byId('mission-continue').disabled = timeRunning;
    byId('mission-rail').replaceChildren(...missionPhases.map((phase, index) => {
      const status = completion[phase.id] ? 'complete' : index === mission.phaseIndex ? 'current' : phase.id === 'investigate' && index < mission.phaseIndex ? 'optional' : index < mission.phaseIndex ? 'missed' : 'upcoming';
      const node = element('span', undefined, `mission-step ${status}`);
      node.append(element('strong', `0${index + 1}`), document.createTextNode(phase.label));
      if (index === mission.phaseIndex) node.setAttribute('aria-current', 'step'); return node;
    }));
  }
  renderControls(state) {
    if (!state.modules.some(module => module.module_id === this.controlModuleId)) this.controlModuleId = state.intro?.moduleId ?? state.modules[0]?.module_id ?? null;
    byId('control-module-list').replaceChildren(...state.modules.map(module => {
      const button = element('button', `${module.module_name} · ${module.status}`);
      button.type = 'button'; button.setAttribute('aria-pressed', String(module.module_id === this.controlModuleId));
      button.addEventListener('click', () => { this.controlModuleId = module.module_id; this.renderControls(this.session.snapshot()); }, { signal: this.abort.signal });
      return button;
    }));
    const module = state.modules.find(item => item.module_id === this.controlModuleId);
    if (!module) return;
    byId('control-target-summary').textContent = `${module.module_name} · ${module.status} · ${module.mw} MW · O₂ ${module.oxygen_level.toFixed(1)}%`;
    if (document.activeElement !== byId('power-value')) byId('power-value').value = module.mw;
    if (document.activeElement !== byId('oxygen-value')) byId('oxygen-value').value = module.oxygen_target;
    byId('module-mode').value = module.mw === 0 ? 'suspended' : 'operational';
    const selectedCrew = byId('crew-value').value;
    byId('crew-value').replaceChildren(...state.crew.map(crew => {
      const option = element('option', `${crew.crew_code} · ${crew.certification} · fatigue ${crew.fatigue.toFixed(0)}`); option.value = crew.crew_id; return option;
    }));
    if ([...byId('crew-value').options].some(option => option.value === selectedCrew)) byId('crew-value').value = selectedCrew;
  }
  renderCrew(state) {
    const counts = Object.fromEntries(['Available', 'Busy', 'Resting', 'Unavailable'].map(status => [status, state.crew.filter(crew => crewStatus(crew) === status).length]));
    byId('crew-summary').replaceChildren(...Object.entries(counts).map(([status, count]) => {
      const card = element('div', undefined, 'crew-summary-item');
      card.append(badge(status, status.toLowerCase()), element('strong', String(count)));
      return card;
    }));
    const emergency = [...state.tasks].filter(task => task.source === 'incident' && task.status !== 'COMPLETE').sort((a, b) => b.priority - a.priority)[0];
    if (!state.tasks.some(task => task.task_id === this.selectedTaskId) || (this.mode !== 'crew' && emergency)) this.selectedTaskId = emergency?.task_id ?? state.tasks[0]?.task_id;
    const tasks = [...state.tasks].sort((a, b) => Number(a.status === 'COMPLETE') - Number(b.status === 'COMPLETE') || b.priority - a.priority);
    byId('task-list').replaceChildren(...tasks.map(task => {
      const button = element('button', undefined, `task-card priority-${task.priority}`);
      button.type = 'button'; button.setAttribute('aria-pressed', String(task.task_id === this.selectedTaskId));
      button.append(element('strong', task.title), element('span', `P${task.priority} · ${task.status} · ${state.modules.find(module => module.module_id === task.module_id)?.module_name ?? 'Module'}`));
      button.addEventListener('click', () => { this.selectedTaskId = task.task_id; this.renderCrew(this.session.snapshot()); }, { signal: this.abort.signal });
      return button;
    }));
    const task = state.tasks.find(item => item.task_id === this.selectedTaskId);
    if (!task) return;
    const detail = byId('selected-task-detail'); detail.replaceChildren();
    const assigned = state.crew.find(crew => crew.crew_id === task.assigned_crew_id);
    detail.append(element('span', 'SELECTED TASK', 'eyebrow'), element('h3', task.title),
      badge(task.status, task.status === 'COMPLETE' ? 'available' : task.status === 'ACTIVE' ? 'busy' : 'warning'),
      element('p', `Technical skill ${task.required_skill}+ · ${task.required_certification ?? 'No certification'} · ${task.risk} risk · ${task.power_draw ?? 0} MW while active`),
      element('p', assigned ? `Assigned: ${assigned.name}` : 'Waiting for crew.'));
    const progress = element('progress'); progress.max = task.duration; progress.value = task.progress;
    progress.setAttribute('aria-label', `${task.title} progress`);
    detail.append(progress, element('p', `${task.progress.toFixed(1)} / ${task.duration} work units`));
    if (task.status !== 'COMPLETE' && !task.legacy) {
      const form = element('form', undefined, 'priority-form');
      const label = element('label', 'Priority'); const select = element('select');
      for (let value = 1; value <= 5; value++) { const option = element('option', `P${value}`); option.value = String(value); select.append(option); }
      select.value = String(task.priority); label.append(select);
      const submit = element('button', 'Set priority'); submit.type = 'submit';
      form.append(label, submit);
      form.addEventListener('submit', event => {
        event.preventDefault(); const result = this.session.manageTask({ type: 'priority', taskId: task.task_id, priority: Number(select.value) });
        this.message(result.success ? result.state.history.at(-1).message : result.error);
      }, { signal: this.abort.signal });
      detail.append(form);
      if (assigned) {
        const remove = element('button', 'Remove assignment'); remove.type = 'button';
        remove.addEventListener('click', () => { const result = this.session.manageTask({ type: 'unassign', taskId: task.task_id }); this.message(result.success ? 'Crew removed from task.' : result.error); }, { signal: this.abort.signal });
        detail.append(remove);
      }
    }
    const needsContainment = task.type === 'REACTOR_REPAIR' && !state.incident?.decision;
    const candidates = task.status === 'COMPLETE' || task.legacy || needsContainment ? [] : state.crew.filter(crew => !taskEligibility(crew, task));
    byId('candidate-summary').textContent = task.status === 'COMPLETE' ? 'Task complete.' : task.legacy ? 'Operations desk controls this repair.' : needsContainment ? 'Choose a containment response at Station first.' : candidates.length ? `${candidates.length} eligible crew. Compare readiness before assigning.` : 'No available crew meets the requirements.';
    byId('candidate-list').replaceChildren(...candidates.sort((a, b) => a.fatigue - b.fatigue || a.crew_id - b.crew_id).map(crew => {
      const card = element('article', undefined, 'crew-card');
      const heading = element('div', undefined, 'crew-card-heading');
      heading.append(element('strong', crew.name), badge(crew.role, 'crew'));
      card.append(heading, element('p', `${crewStatus(crew)} · Engineering ${crew.engineering_skill}/3 · Fatigue ${crew.fatigue.toFixed(0)}% · Health ${crew.health.toFixed(0)}%`),
        element('p', `${crew.certification} certified`, 'crew-certification'));
      const assign = element('button', crew.crew_id === task.assigned_crew_id ? 'Assigned' : `Assign ${crew.name}`);
      assign.type = 'button'; assign.disabled = crew.crew_id === task.assigned_crew_id;
      assign.addEventListener('click', () => {
        const result = this.session.manageTask({ type: 'assign', taskId: task.task_id, crewId: crew.crew_id });
        this.message(result.success ? result.state.history.at(-1).message : result.error);
      }, { signal: this.abort.signal });
      card.append(assign); return card;
    }));
    this.renderCrewRoster(state);
  }
  renderCrewRoster(state) {
    const search = byId('crew-search').value.trim().toLowerCase();
    const matches = state.crew.filter(crew => `${crew.name} ${crew.crew_code}`.toLowerCase().includes(search));
    const rows = matches.slice(0, 20).map(crew => {
      const task = state.tasks.find(item => item.task_id === crew.current_task_id);
      return element('p', `${crew.crew_code} · ${crew.name} · ${crew.role} · ${crewStatus(crew)} · Eng ${crew.engineering_skill} · Fatigue ${crew.fatigue.toFixed(0)}% · Health ${crew.health.toFixed(0)}% · ${crew.certification} · ${task?.title ?? 'No task'}`);
    });
    if (matches.length > 20) rows.push(element('p', `${matches.length - 20} more crew. Refine the search to find someone.`));
    if (!matches.length) rows.push(element('p', 'No crew found. Try another name or code.'));
    byId('crew-roster').replaceChildren(...rows);
  }
  renderCurriculum() {
    const level = this.session.investigation.level; const stage = sqlStages[level - 1];
    byId('sql-stage-title').textContent = `Level ${level} · ${stage.title}`;
    byId('sql-stage-goal').textContent = stage.goal;
    byId('sql-functions').replaceChildren(...stage.functions.map(name => element('code', name)));
    byId('sql-level-track').replaceChildren(...sqlStages.map(item => element('span', String(item.level), item.level <= level ? 'unlocked' : 'locked')));
    byId('write-guide').classList.toggle('locked', level < 4);
    byId('write-guide').querySelectorAll('button').forEach(button => { button.disabled = level < 4; });
    document.querySelectorAll('.sql-preset[data-min-level]').forEach(button => { button.disabled = level < Number(button.dataset.minLevel); });
  }
  renderQuestions(state) {
    const questions = this.session.getScenario().questions.filter(question => (question.level ?? 1) <= this.session.investigation.level).map(question => {
      const card = element('div', undefined, 'evidence-card');
      const evidence = this.session.investigation.evidence.find(item => item.questionId === question.id);
      const status = evidence ? evidence.version === state.version ? 'Pinned' : 'Stale — refresh' : 'Not pinned';
      card.append(element('strong', `L${question.level ?? 1} · ${question.label}`), element('p', status));
      const detail = element('details'); detail.append(element('summary', 'Required columns'), element('p', question.columns.join(', '), 'columns-hint')); card.append(detail);
      const hint = element('button', 'Use example');
      hint.addEventListener('click', () => { this.loadSql(question.sql); this.session.recordHint(question.id); }, { signal: this.abort.signal });
      card.append(hint); return card;
    });
    byId('evidence-questions').replaceChildren(...questions);
  }
  renderHistory(state) {
    const summary = metrics(state);
    const debrief = buildDebrief(state, this.session.investigation);
    const formatEvent = event => {
      const item = element('li'); item.append(element('strong', `T${event.tick} · ${event.type}`), element('p', event.message));
      const deltas = Object.entries(event.deltas ?? {}).map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`).join(' · ');
      if (deltas) item.append(element('p', deltas, 'delta')); return item;
    };
    byId('recent-events').replaceChildren(...state.history.slice(-4).reverse().map(formatEvent));
    byId('review-events').replaceChildren(...this.session.timeline.filter(event => event.type !== 'TELEMETRY').map(formatEvent));
    byId('review-summary').textContent = `${state.ended ? 'Completed' : 'Live'} run · seed ${state.seed} · ${this.session.investigation.history.length} queries · ${this.session.analytics.filter(event => event.type === 'HINT').length} guided hints · ${state.commands.length} actions · oxygen ${summary.oxygen.toFixed(1)}% · reserve ${state.battery.toFixed(2)} MWh · backlog ${state.backlog}.`;
    byId('debrief-cards').replaceChildren(...debrief.cards.map(card => {
      const node = element('article', undefined, 'debrief-card'); node.append(element('span', card.label), element('strong', card.value), element('p', card.detail)); return node;
    }));
    byId('debrief-recommendation').textContent = debrief.recommendation;
    byId('query-history').replaceChildren(...this.session.investigation.history.slice(-15).reverse().map(query => {
      const button = element('button', `#${query.id} / v${query.version}: ${query.sql}`);
      button.className = 'history-query'; button.addEventListener('click', () => { byId('sql-input').value = query.sql; byId('sql-input').focus(); }, { signal: this.abort.signal }); return button;
    }));
  }
  destroy() { this.unsubscribe(); this.abort.abort(); }
}
