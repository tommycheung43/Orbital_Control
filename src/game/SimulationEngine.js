import { scenario as defaultScenario } from '../data/reactorScenario.js';
import { createCrewTask } from '../data/crewTasks.js';
import { createCrewServiceHistory } from '../data/crewServiceHistory.js';
import { advanceCrewTasks, crewStatus, recordCrewTaskEvent } from './CrewTaskService.js';

export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const round = value => Math.round(value * 1000) / 1000;
export const moduleByKind = (state, kind) => state.modules.find(module => module.kind === kind);

export function createInitialState(seed = 42, scenario = defaultScenario) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an integer from 0 to 4294967295.');
  let rng = seed >>> 0;
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  const modules = scenario.modules.map(source => ({ ...structuredClone(source), mw: source.nominal_mw,
    oxygen_target: source.oxygen_level, oxygen_level: round(clamp(source.oxygen_level + (random() - 0.5) * 4)), status: 'Normal' }));
  const habitat = modules.find(module => module.kind === 'habitat');
  const industry = modules.find(module => module.kind === 'industry');
  habitat.occupants = clamp(habitat.occupants + Math.floor(random() * 7) - 3, 0, 200);
  const intro = habitat.minimum_mw >= 2 && habitat.nominal_mw > habitat.minimum_mw
    ? { moduleId: habitat.module_id, targetMw: habitat.nominal_mw, startingMw: habitat.minimum_mw - 2 }
    : null;
  if (intro) habitat.mw = intro.startingMw;
  const givenNames = ['Maya', 'Noah', 'Ari', 'Lena', 'Iris', 'Owen', 'Tala', 'Jun'];
  const familyNames = ['Chen', 'Patel', 'Okafor', 'Kim', 'Santos', 'Morgan'];
  const crew = Array.from({ length: 48 }, (_, index) => {
    const certification = index % 6 === 0 ? 'REACTOR' : index % 5 === 0 ? 'OXYGEN' : index % 4 === 0 ? 'SAFETY' : 'GENERAL';
    const role = certification === 'REACTOR' ? 'Engineer' : certification === 'OXYGEN' ? 'Technician' : certification === 'SAFETY' ? 'Medic' : 'Operator';
    return {
      crew_id: index + 1, crew_code: `CR-${String(index + 1).padStart(3, '0')}`,
      name: `${givenNames[index % givenNames.length]} ${familyNames[Math.floor(index / givenNames.length)]}`,
      role, engineering_skill: role === 'Engineer' ? index === 6 ? 2 : 3 : role === 'Technician' ? 1 + index % 2 : 0,
      fatigue: index === 0 ? 78 : index === 6 ? 25 : Math.floor(8 + random() * 62),
      health: 96 + Math.floor(random() * 5), certification,
      module_id: index % 6 === 0 ? industry.module_id : modules[index % modules.length].module_id,
      current_task_id: null,
    };
  });
  const repairTicks = 5 + Math.floor(random() * 4);
  const reactor = modules.find(module => module.kind === 'reactor');
  const state = {
    seed, rng, scenarioId: scenario.id, scenarioTitle: scenario.title,
    contentVersion: scenario.contentVersion, schemaVersion: scenario.schemaVersion,
    triggerTick: scenario.triggerTick, deadlineTicks: scenario.deadlineTicks, runTicks: scenario.runTicks,
    historySamples: scenario.historySamples, tick: 0, version: 0, ended: false,
    generation: 100, nominalGeneration: 100, battery: 2 + Math.floor(random() * 5), batteryCapacity: 8,
    batteryMax: 30, batteryOnline: false, spares: 6, backlog: 0, safety: 100, repair: null,
    modules, crew, intro,
    tasks: [createCrewTask('habitatInspection', 1, habitat.module_id)], crewTaskHistory: [],
    crewServiceHistory: createCrewServiceHistory(seed, crew, reactor.module_id),
    maintenance: [{ log_id: 1, module_id: reactor.module_id, recorded_at: -6, finding: 'Output regulator inspection deferred', repair_ticks: repairTicks }],
    workOrders: [
      { work_order_id: 1, module_id: reactor.module_id, task_type: 'REGULATOR', priority: 2, status: 'OPEN', note: 'Inspect output regulator' },
      { work_order_id: 2, module_id: industry.module_id, task_type: 'FILTER', priority: 1, status: 'RESOLVED', note: 'Duplicate filter report' },
    ],
    readings: [{ recorded_at: 0, loads: Object.fromEntries(modules.map(module => [module.module_id, module.mw])) }],
    oxygenReadings: [{ recorded_at: 0, levels: Object.fromEntries(modules.map(module => [module.module_id, module.oxygen_level])) }],
    incident: null, scheduled: [], commands: [],
    history: [{ tick: 0, type: intro ? 'POWER NOTICE' : 'STATION ONLINE', message: intro ? 'Habitat power is below its safe minimum.' : `Seed ${seed}. Autonomous systems online.`, deltas: {} }],
  };
  return deriveState(state);
}

export function metrics(state) {
  const taskLoad = (state.tasks ?? []).filter(task => task.status === 'ACTIVE').reduce((sum, task) => sum + (task.power_draw ?? 0), 0);
  const demand = state.modules.reduce((sum, module) => sum + module.mw, 0) + taskLoad;
  const deficit = Math.max(0, demand - state.generation);
  const batteryOutput = state.batteryOnline ? Math.min(deficit, state.batteryMax, state.battery * 3600 / 5) : 0;
  const occupied = state.modules.filter(module => module.occupants > 0);
  const source = occupied.length ? occupied : state.modules;
  const oxygen = source.reduce((sum, module) => sum + module.oxygen_level * Math.max(1, module.occupants), 0) / source.reduce((sum, module) => sum + Math.max(1, module.occupants), 0);
  const industry = moduleByKind(state, 'industry'); const reactor = moduleByKind(state, 'reactor');
  return { generation: round(state.generation), demand: round(demand), taskLoad: round(taskLoad), balance: round(state.generation + batteryOutput - demand),
    battery: round(state.battery), oxygen: round(oxygen), throughput: industry?.mw > 0 ? round(industry.mw / Math.max(1, industry.nominal_mw) * 100) : 0,
    backlog: state.backlog, wear: round(reactor?.wear ?? 0), spares: state.spares,
    fatigue: round(state.crew.reduce((sum, crew) => sum + crew.fatigue, 0) / state.crew.length),
    crewReady: state.crew.filter(crew => crewStatus(crew) === 'Available').length, safety: round(state.safety) };
}

export function recordEvent(state, type, message, before = metrics(state)) {
  const after = metrics(state);
  const deltas = Object.fromEntries(Object.entries(after).map(([key, value]) => [key, round(value - before[key])]).filter(([, value]) => value !== 0));
  state.history.push({ tick: state.tick, type, message, deltas });
}

export function snapshotReadings(state) {
  state.readings.push({ recorded_at: state.tick, loads: Object.fromEntries(state.modules.map(module => [module.module_id, module.mw])) });
  state.oxygenReadings.push({ recorded_at: state.tick, levels: Object.fromEntries(state.modules.map(module => [module.module_id, module.oxygen_level])) });
  for (const collection of [state.readings, state.oxygenReadings]) {
    const latest = new Map(collection.map(reading => [reading.recorded_at, reading]));
    collection.splice(0, collection.length, ...latest.values());
  }
}

export function deriveState(state) {
  const summary = metrics(state);
  for (const module of state.modules) module.status = module.mw === 0 ? 'Suspended' : module.oxygen_level < 50 ? 'Critical' : module.mw < module.minimum_mw || module.oxygen_level < 70 ? 'Warning' : 'Normal';
  const reactor = moduleByKind(state, 'reactor');
  if (state.generation < state.nominalGeneration && reactor) reactor.status = 'Warning';
  state.safety = round(clamp(100 - Math.max(0, 85 - summary.oxygen) * 2 - Math.max(0, -summary.balance) * 2));
  return state;
}

export function advanceTick(previous) {
  if (previous.ended) return previous;
  const state = structuredClone(previous); state.tick++; state.version++;
  const reactor = moduleByKind(state, 'reactor');
  if (state.tick === state.triggerTick) {
    const before = metrics(state); state.generation = state.nominalGeneration * 0.75;
    state.incident = { id: state.scenarioId, status: 'active', startedAt: state.tick, deadline: state.tick + state.deadlineTicks, decision: null };
    state.tasks.push(createCrewTask('reactorRepair', state.tasks.length + 1, reactor.module_id, state.maintenance[0].repair_ticks));
    recordEvent(state, 'ALERT', 'Reactor output -25%.', before);
  }
  const before = metrics(state); const summary = metrics(state);
  if (state.batteryOnline && summary.demand > state.generation) state.battery = round(Math.max(0, state.battery - Math.min(summary.demand - state.generation, state.batteryMax) * 5 / 3600));
  for (const module of state.modules) {
    const powerRatio = module.minimum_mw === 0 ? 1 : module.mw / module.minimum_mw;
    const targetDelta = Math.sign(module.oxygen_target - module.oxygen_level) * Math.min(0.5, Math.abs(module.oxygen_target - module.oxygen_level));
    const oxygenDelta = module.mw === 0 || powerRatio < 1 || metrics(state).balance < 0 ? -1.2 : targetDelta;
    module.oxygen_level = round(clamp(module.oxygen_level + oxygenDelta));
    module.wear = round(clamp(module.wear + (module.mw > 0 ? 0.08 + Math.max(0, module.mw - module.nominal_mw) * 0.02 : 0)));
  }
  const habitat = moduleByKind(state, 'habitat');
  if (state.incident && habitat?.oxygen_level <= 88 && !state.tasks.some(task => task.type === 'OXYGEN_RECOVERY')) {
    const prior = metrics(state);
    state.tasks.push(createCrewTask('oxygenRecovery', state.tasks.length + 1, habitat.module_id));
    recordEvent(state, 'CREW WARNING', 'Habitat oxygen is low. A certified scrubber task was added.', prior);
  }
  for (const crew of state.crew) crew.fatigue = round(clamp(crew.fatigue + (state.repair && crew.crew_id === state.repair.crewId ? 0.8 : -0.1)));
  const taskBefore = metrics(state);
  for (const event of advanceCrewTasks(state)) recordEvent(state, event.type, event.message, taskBefore);
  if (state.repair && --state.repair.remaining === 0) {
    state.generation = state.nominalGeneration; reactor.wear = Math.max(0, reactor.wear - 35); state.batteryOnline = false; state.repair = null;
    state.workOrders.filter(order => order.module_id === reactor.module_id && order.status === 'ACTIVE').forEach(order => { order.status = 'RESOLVED'; });
    if (state.incident) state.incident.status = 'resolved';
    const task = state.tasks.find(item => item.type === 'REACTOR_REPAIR');
    if (task && task.status !== 'COMPLETE') {
      task.status = 'COMPLETE'; task.progress = task.duration;
      const worker = state.crew.find(person => person.crew_id === state.repair?.crewId || person.current_task_id === task.task_id);
      if (worker) { worker.current_task_id = null; recordCrewTaskEvent(state, task, worker, 'COMPLETE', 'Operations desk repair'); }
    }
    recordEvent(state, 'REPAIR COMPLETE', 'Reactor output restored.', before);
  }
  const due = state.scheduled.filter(effect => effect.dueTick <= state.tick);
  state.scheduled = state.scheduled.filter(effect => effect.dueTick > state.tick);
  for (const effect of due) {
    const prior = metrics(state);
    if (effect.kind === 'backlog') state.backlog += 12;
    if (effect.kind === 'fatigue') state.crew.forEach(crew => { crew.fatigue = round(clamp(crew.fatigue + 8)); });
    if (effect.kind === 'wear') reactor.wear = round(clamp(reactor.wear + 4));
    recordEvent(state, 'FOLLOW-UP', `${effect.reason} (${effect.source})`, prior);
  }
  if (state.incident?.status === 'active' && state.tick >= state.incident.deadline) {
    state.incident.status = 'escalated'; state.generation = 55;
    recordEvent(state, 'OVERLOAD TRIP', 'Response window expired. Generation limited to 55 MW.', before);
  }
  deriveState(state); snapshotReadings(state);
  if (state.tick % 3 === 0) recordEvent(state, 'TELEMETRY', 'Station telemetry recorded.', before);
  if (state.tick >= state.runTicks || state.modules.some(module => module.occupants > 0 && module.oxygen_level === 0)) {
    state.ended = true; recordEvent(state, 'SHIFT REVIEW', 'Shift ended. Review actions and outcomes.');
  }
  return state;
}
