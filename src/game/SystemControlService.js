import { clamp, deriveState, metrics, recordEvent, round, snapshotReadings } from './SimulationEngine.js';

const moduleFor = (state, moduleId) => state.modules.find(module => module.module_id === Number(moduleId));

export function controlProblem(state, command) {
  if (state.ended) return 'Shift ended.';
  const module = moduleFor(state, command.moduleId);
  if (!module) return 'Select a valid module.';
  if (command.type === 'set-power') {
    const value = Number(command.value);
    if (!Number.isFinite(value) || value < 0 || value > 100) return 'Power must be 0-100 MW.';
  }
  if (command.type === 'set-oxygen-target') {
    const value = Number(command.value);
    if (!Number.isFinite(value) || value < 40 || value > 100) return 'Oxygen target must be 40-100%.';
  }
  if (command.type === 'set-module-mode' && !['operational', 'suspended'].includes(command.value)) return 'Select a valid module mode.';
  if (command.type === 'assign-crew') {
    const crew = state.crew.find(person => person.crew_id === Number(command.crewId));
    if (!crew) return 'Select a valid crew member.';
    if (crew.fatigue >= 85) return 'Crew member is too fatigued for reassignment.';
    if (crew.current_task_id) return 'Crew member is working on a task. Reassign them from Crew & tasks.';
  }
  if (!['set-power', 'set-oxygen-target', 'set-module-mode', 'assign-crew'].includes(command.type)) return 'Unknown control command.';
  return null;
}

export function executeControl(previous, command) {
  if (command.expectedStateVersion !== previous.version) return { success: false, error: 'Station changed. Review the current controls and retry.' };
  const error = controlProblem(previous, command);
  if (error) return { success: false, error };
  const state = structuredClone(previous); const before = metrics(state); const module = moduleFor(state, command.moduleId);
  let message;
  if (command.type === 'set-power') {
    module.mw = round(Number(command.value));
    message = `${module.module_name} power allocation changed.`;
  } else if (command.type === 'set-oxygen-target') {
    module.oxygen_target = round(Number(command.value));
    // Higher environmental targets consume more power; the precise rule is deliberately discoverable in data.
    module.mw = round(clamp(module.mw + Math.max(0, module.oxygen_target - 90) * 0.12, 0, 100));
    message = `${module.module_name} oxygen regulation changed.`;
  } else if (command.type === 'set-module-mode') {
    module.mw = command.value === 'suspended' ? 0 : module.nominal_mw;
    message = `${module.module_name} mode changed to ${command.value}.`;
  } else {
    const crew = state.crew.find(person => person.crew_id === Number(command.crewId));
    crew.module_id = module.module_id; crew.fatigue = round(clamp(crew.fatigue + 2));
    message = `${crew.crew_code} reassigned to ${module.module_name}.`;
  }
  state.version++;
  const savedCommand = { ...command, tick: state.tick, version: state.version, expectedStateVersion: undefined };
  delete savedCommand.expectedStateVersion;
  state.commands.push(savedCommand);
  deriveState(state); snapshotReadings(state); recordEvent(state, 'SYSTEM CONTROL', message, before);
  return { success: true, state };
}
