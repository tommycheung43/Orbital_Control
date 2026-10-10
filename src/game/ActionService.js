import { decisions, operations } from '../data/reactorScenario.js';
import { deriveState, metrics, moduleByKind, recordEvent, snapshotReadings } from './SimulationEngine.js';
import { crewStatus, recordCrewTaskEvent } from './CrewTaskService.js';

export function actionProblem(state, actionId, evidence = []) {
  const definition = [...decisions, ...operations].find(action => action.id === actionId);
  if (!definition) return 'Unknown action.';
  if (state.ended) return 'This shift has ended.';
  if (!state.incident) return 'Waiting for an alert.';
  if (decisions.some(action => action.id === actionId) && state.incident.decision) return 'Containment already selected.';
  if (decisions.some(action => action.id === actionId) && state.incident.status === 'resolved') return 'Reactor is already repaired.';
  const industry = moduleByKind(state, 'industry');
  const habitat = moduleByKind(state, 'habitat');
  const reactor = moduleByKind(state, 'reactor');
  if (actionId === 'suspend-industry' && (industry.occupants > 0 || !industry.can_defer)) return 'Industry cannot be suspended now.';
  if (actionId === 'reduce-habitat' && (habitat.occupants > 12 || state.battery < 1)) return 'Habitat reduction unavailable.';
  if (actionId === 'use-battery') {
    const required = Math.max(0, metrics(state).demand - state.generation) * state.maintenance[0].repair_ticks * 5 / 3600;
    if (state.battery < required || state.batteryMax < metrics(state).demand - state.generation) return 'Insufficient backup for the repair window.';
  }
  const assigned = state.crew.find(crew => crew.module_id === reactor.module_id && crew.certification === 'REACTOR' && crew.fatigue < 70);
  if (actionId === 'assign-engineer' && (assigned || state.repair)) return 'A qualified engineer is already assigned.';
  if (actionId === 'assign-engineer' && !state.crew.some(crew => crew.certification === 'REACTOR' && crew.fatigue < 65 && crewStatus(crew) === 'Available')) return 'No rested, certified engineer is available.';
  if (actionId === 'repair-reactor') {
    if (state.tasks?.some(task => task.type === 'REACTOR_REPAIR' && task.status === 'ACTIVE' && !task.legacy)) return 'Crew task repair is already underway.';
    if (state.repair) return 'Repair in progress.';
    if (state.generation === state.nominalGeneration) return 'Reactor repaired.';
    if (!assigned) return 'Assign an engineer with fatigue below 70.';
    if (state.spares < 2) return 'Needs 2 spares.';
  }
  if (actionId === 'restore-loads' && state.generation < 90) return 'Complete Reactor repair first.';
  if (actionId === 'restore-loads' && state.modules.every(module => module.mw === module.nominal_mw)) return 'Allocations already normal.';
  return null;
}

export function executeAction(previous, command, evidence = []) {
  if (command.expectedStateVersion !== previous.version) return { success: false, error: 'Station changed. Refresh the investigation snapshot before acting.' };
  const error = actionProblem(previous, command.type, evidence);
  if (error) return { success: false, error };
  const state = structuredClone(previous);
  const before = metrics(state);
  const followUp = (kind, reason) => state.scheduled.push({ kind, reason, source: command.type, dueTick: state.tick + 3 });
  switch (command.type) {
    case 'suspend-industry': moduleByKind(state, 'industry').mw = 0; followUp('backlog', 'Suspended Industry created production backlog.'); break;
    case 'reduce-habitat': {
      const habitat = moduleByKind(state, 'habitat'); habitat.mw = Math.max(0, habitat.minimum_mw - 15); habitat.oxygen_level = Math.max(0, habitat.oxygen_level - 2);
      followUp('fatigue', 'Reduced Habitat service increased crew fatigue.'); break;
    }
    case 'use-battery': state.batteryOnline = true; state.battery = Math.max(0, state.battery - 0.05); followUp('wear', 'Reserve transfer increased regulator wear.'); break;
    case 'assign-engineer': {
      const crew = state.crew.filter(person => person.certification === 'REACTOR' && person.fatigue < 65 && crewStatus(person) === 'Available').sort((a, b) => a.fatigue - b.fatigue || a.crew_id - b.crew_id)[0];
      crew.module_id = moduleByKind(state, 'reactor').module_id; crew.fatigue += 5;
      followUp('wear', `${crew.crew_code}'s reassignment deferred routine maintenance.`);
      break;
    }
    case 'repair-reactor': {
      const reactorId = moduleByKind(state, 'reactor').module_id;
      const crew = state.crew.find(person => person.module_id === reactorId && person.certification === 'REACTOR' && person.fatigue < 70);
      state.spares -= 2; crew.fatigue += 3;
      const prioritized = state.workOrders.some(order => order.module_id === reactorId && order.status === 'ACTIVE' && order.priority >= 4);
      state.repair = { crewId: crew.crew_id, remaining: Math.max(2, state.maintenance[0].repair_ticks - Number(prioritized)) };
      const task = state.tasks?.find(item => item.type === 'REACTOR_REPAIR');
      if (task) {
        task.status = 'ACTIVE'; task.legacy = true; task.assigned_crew_id = crew.crew_id; task.supplies_reserved = true;
        crew.current_task_id = task.task_id;
        recordCrewTaskEvent(state, task, crew, 'ASSIGNED', 'Operations desk repair');
      }
      break;
    }
    case 'restore-loads': for (const module of state.modules) module.mw = module.nominal_mw; break;
  }
  if (decisions.some(action => action.id === command.type)) {
    state.incident.decision = command.type;
    state.incident.status = 'contained';
  }
  state.version++;
  snapshotReadings(state);
  state.commands.push({ ...command, tick: state.tick, evidenceIds: evidence.map(card => card.id) });
  deriveState(state);
  const label = [...decisions, ...operations].find(action => action.id === command.type).label;
  recordEvent(state, 'ACTION', label, before);
  return { success: true, state };
}

