import { metrics, moduleByKind } from './SimulationEngine.js';

export const missionPhases = [
  { id: 'control', label: 'Restore' },
  { id: 'investigate', label: 'Research · optional' },
  { id: 'stabilize', label: 'Stabilize' },
  { id: 'recover', label: 'Recover' },
  { id: 'review', label: 'Review' },
];

const controlTypes = new Set(['set-power', 'set-oxygen-target', 'set-module-mode', 'assign-crew']);

function learningContext(state, investigation) {
  const lastControl = state.commands.findLast(command => controlTypes.has(command.type) && !command.type.startsWith('sql-'));
  const successfulQueries = investigation.history.filter(query => query.success && lastControl && query.version >= lastControl.version);
  return { lastControl, successfulQueries };
}

export function introStatus(state) {
  const module = state.modules.find(item => item.module_id === state.intro?.moduleId);
  return { module, complete: !state.intro || Boolean(module && module.mw >= state.intro.targetMw) };
}

export function missionCompletion(state, investigation) {
  const { lastControl, successfulQueries } = learningContext(state, investigation);
  const allocationsNormal = state.modules.every(module => module.mw === module.nominal_mw);
  return {
    control: Boolean(lastControl) && introStatus(state).complete, investigate: successfulQueries.length > 0,
    stabilize: Boolean(state.incident?.decision), recover: state.incident?.status === 'resolved' && allocationsNormal,
    review: state.ended,
  };
}

export function deriveMission(state, investigation) {
  const { lastControl } = learningContext(state, investigation);
  const usedControl = Boolean(lastControl);
  if (state.ended) return mission('review', 'Review the completed shift', 'Compare the outcome with your SQL investigation.', 'Open review', 'review');

  if (state.incident) {
    if (['active', 'escalated'].includes(state.incident.status) && !state.incident.decision) {
      return mission('stabilize', 'Contain the Reactor fault', 'Compare the affected systems, then choose one response.', 'Open operations', 'station');
    }
    const oxygenTask = state.tasks?.find(task => task.type === 'OXYGEN_RECOVERY' && task.status !== 'COMPLETE');
    if (oxygenTask?.status === 'ACTIVE') {
      const worker = state.crew.find(crew => crew.crew_id === oxygenTask.assigned_crew_id);
      return mission('recover', 'Monitor the scrubber crew', `${worker?.name ?? 'Assigned crew'} is restoring Habitat oxygen. The task uses ${oxygenTask.power_draw} MW while active.`, 'Resume recovery', 'resume');
    }
    if (oxygenTask) return mission('recover', 'Assign an Oxygen technician', 'Habitat oxygen is low. Compare eligible crew and the task power cost before assigning one.', 'Open crew tasks', 'crew');
    if (state.generation < state.nominalGeneration) {
      const crewTask = state.tasks?.find(task => task.type === 'REACTOR_REPAIR');
      if (crewTask?.status === 'ACTIVE' && !crewTask.legacy) {
        const worker = state.crew.find(crew => crew.crew_id === crewTask.assigned_crew_id);
        return mission('recover', 'Monitor the Reactor crew', `${worker?.name ?? 'Assigned crew'} is repairing the regulator. Resume time to advance the task.`, 'Resume repair', 'resume');
      }
      const reactorId = moduleByKind(state, 'reactor').module_id;
      const assigned = state.crew.some(crew => crew.module_id === reactorId && crew.certification === 'REACTOR' && crew.fatigue < 70);
      if (state.repair) return mission('recover', 'Monitor the repair', `${state.repair.remaining} ticks remain. Resume time when ready.`, 'Open operations', 'station');
      if (crewTask && crewTask.status === 'OPEN') return mission('recover', 'Assign Reactor repair crew', 'Compare eligible engineers, then assign one to the repair task.', 'Open crew tasks', 'crew');
      if (!assigned) return mission('recover', 'Assign a Reactor engineer', 'Choose a rested, certified crew member before repair.', 'Open recovery', 'station');
      return mission('recover', 'Start the Reactor repair', 'A priority 4–5 active work order can shorten the repair.', 'Open recovery', 'station');
    }
    if (state.modules.some(module => module.mw !== module.nominal_mw)) return mission('recover', 'Restore normal allocations', 'Generation is stable. Bring curtailed modules back online.', 'Open recovery', 'station');
    return mission('review', 'Review this recovery', 'Inspect the outcome and choose what to improve next run.', 'Open review', 'review');
  }

  if (!introStatus(state).complete) {
    const habitat = introStatus(state).module;
    return mission('control', 'Restore Habitat power', `${habitat.mw} MW now · ${habitat.minimum_mw} MW safe minimum.`, `Restore to ${state.intro.targetMw} MW`, 'intro');
  }
  if (!usedControl) return mission('control', 'Make one controlled change', 'Choose a module and adjust power.', 'Open controls', 'control');
  return mission('stabilize', 'Prepare for the first alert', 'Resume time to see the station respond. SQL investigation is available whenever you need more detail.', 'Resume time', 'resume');
}

function mission(phase, title, detail, cta, target, query = null) {
  return { phase, phaseIndex: missionPhases.findIndex(item => item.id === phase), title, detail, cta, target, query };
}

export function buildDebrief(state, investigation) {
  const summary = metrics(state);
  const queryCount = investigation.history.filter(query => query.success).length;
  const controlCount = state.commands.filter(command => controlTypes.has(command.type) && !command.type.startsWith('sql-')).length;
  const prioritized = state.workOrders.some(order => order.task_type === 'REGULATOR' && order.priority >= 4);
  const incidentStarted = Boolean(state.incident);
  const recovered = state.incident?.status === 'resolved' && state.generation === state.nominalGeneration;
  const stable = summary.safety >= 75 && summary.oxygen >= 70;
  let recommendation = 'Make a control change, then inspect the result when you need more detail.';
  if (!queryCount) recommendation = 'Use the SQL Toolkit to investigate at least one consequence.';
  else if (investigation.level < 3) recommendation = 'Advance to summaries and JOINs to explain relationships, not single rows.';
  else if (!recovered && state.incident) recommendation = 'Prioritize containment, assign a certified engineer, then complete repair.';
  else if (!prioritized && investigation.level === 4) recommendation = 'Try an ACTIVE priority 4 Reactor work order before starting repair.';
  else if (!stable) recommendation = 'Protect oxygen and safety while restoring production.';
  else recommendation = 'Replay with a different containment choice and compare the timeline.';
  return {
    cards: [
      { label: 'Station', value: !incidentStarted ? 'Awaiting incident' : recovered ? 'Recovered' : stable ? 'Stable' : 'At risk', detail: `Safety ${summary.safety.toFixed(0)}% · Oxygen ${summary.oxygen.toFixed(1)}%` },
      { label: 'Investigation', value: `SQL level ${investigation.level}`, detail: `${queryCount} successful ${queryCount === 1 ? 'query' : 'queries'}` },
      { label: 'Operations', value: !incidentStarted ? 'Response pending' : state.incident?.decision ? 'Response committed' : 'Decision required', detail: `${controlCount} control ${controlCount === 1 ? 'change' : 'changes'} · ${state.commands.length} total actions` },
    ],
    recommendation,
  };
}
