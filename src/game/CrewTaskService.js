const clamp = value => Math.max(0, Math.min(100, value));
const round = value => Math.round(value * 1000) / 1000;

export function crewStatus(crew) {
  if (crew.health < 50 || crew.fatigue >= 95) return 'Unavailable';
  if (crew.current_task_id) return 'Busy';
  if (crew.fatigue >= 85) return 'Resting';
  return 'Available';
}

export function taskEligibility(crew, task) {
  if (!crew || !task) return 'Crew or task not found.';
  if (task.status === 'COMPLETE') return 'Task already complete.';
  if (crewStatus(crew) !== 'Available' && crew.current_task_id !== task.task_id) return `${crew.name} is ${crewStatus(crew).toLowerCase()}.`;
  if (crew.engineering_skill < task.required_skill) return `Needs Engineering ${task.required_skill}.`;
  if (task.required_certification && crew.certification !== task.required_certification) return `Needs ${task.required_certification} certification.`;
  return null;
}

export function recordCrewTaskEvent(state, task, crew, event, detail = '') {
  state.crewTaskHistory.push({ event_id: state.crewTaskHistory.length + 1, tick: state.tick,
    task_id: task.task_id, crew_id: crew?.crew_id ?? null, event,
    fatigue: crew?.fatigue ?? null, health: crew?.health ?? null, detail });
}

function releaseCrew(state, task, detail) {
  const previous = state.crew.find(crew => crew.crew_id === task.assigned_crew_id);
  if (previous) {
    previous.current_task_id = null;
    recordCrewTaskEvent(state, task, previous, 'UNASSIGNED', detail);
  }
  task.assigned_crew_id = null;
  task.status = 'OPEN';
}

function assignCrew(state, task, crew, detail) {
  if (task.assigned_crew_id && task.assigned_crew_id !== crew.crew_id) releaseCrew(state, task, 'Reassigned');
  task.assigned_crew_id = crew.crew_id;
  task.status = 'ACTIVE';
  crew.current_task_id = task.task_id;
  crew.module_id = task.module_id;
  recordCrewTaskEvent(state, task, crew, 'ASSIGNED', detail);
}

export function executeTaskCommand(previous, command) {
  if (previous.ended) return { success: false, error: 'Shift ended.' };
  if (command.expectedStateVersion !== previous.version) return { success: false, error: 'Station changed. Review the task and retry.' };
  const task = previous.tasks.find(item => item.task_id === Number(command.taskId));
  if (!task) return { success: false, error: 'Select a valid task.' };
  if (task.status === 'COMPLETE') return { success: false, error: 'Task already complete.' };
  if (task.legacy) return { success: false, error: 'This repair is already managed by the operations desk.' };
  const state = structuredClone(previous);
  const nextTask = state.tasks.find(item => item.task_id === task.task_id);
  let message;
  if (command.type === 'assign') {
    if (nextTask.type === 'REACTOR_REPAIR' && !state.incident?.decision) return { success: false, error: 'Choose a containment response at Station before assigning Reactor repair crew.' };
    const crew = state.crew.find(person => person.crew_id === Number(command.crewId));
    const problem = taskEligibility(crew, nextTask);
    if (problem) return { success: false, error: problem };
    if (nextTask.type === 'REACTOR_REPAIR' && state.spares < 2 && !nextTask.supplies_reserved) return { success: false, error: 'Reactor repair needs 2 spares.' };
    if (nextTask.type === 'REACTOR_REPAIR' && !nextTask.supplies_reserved) { state.spares -= 2; nextTask.supplies_reserved = true; }
    assignCrew(state, nextTask, crew, 'Player assignment');
    message = `${crew.name} assigned to ${nextTask.title}.`;
  } else if (command.type === 'unassign') {
    if (!nextTask.assigned_crew_id) return { success: false, error: 'No crew member is assigned.' };
    releaseCrew(state, nextTask, 'Player removed assignment');
    message = `${nextTask.title} is waiting for crew.`;
  } else if (command.type === 'priority') {
    const priority = Number(command.priority);
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) return { success: false, error: 'Priority must be 1–5.' };
    nextTask.priority = priority;
    recordCrewTaskEvent(state, nextTask, state.crew.find(crew => crew.crew_id === nextTask.assigned_crew_id), 'PRIORITY', `P${priority}`);
    message = `${nextTask.title} priority set to P${priority}.`;
  } else return { success: false, error: 'Unknown task command.' };
  state.version++;
  state.commands.push({ type: `task-${command.type}`, taskId: task.task_id, crewId: command.crewId ?? null, priority: command.priority ?? null, tick: state.tick, version: state.version });
  state.history.push({ tick: state.tick, type: 'CREW TASK', message, deltas: {} });
  return { success: true, state };
}

export function advanceCrewTasks(state) {
  const events = [];
  for (const task of state.tasks) {
    if (task.status === 'OPEN' && task.source === 'routine') {
      const crew = state.crew.filter(person => !taskEligibility(person, task))
        .sort((a, b) => Number(b.role === 'Technician') - Number(a.role === 'Technician') || b.engineering_skill - a.engineering_skill || a.fatigue - b.fatigue || a.crew_id - b.crew_id)[0];
      if (crew) { assignCrew(state, task, crew, 'Automatic routine assignment'); events.push({ type: 'CREW TASK', message: `${crew.name} began ${task.title}.` }); }
    }
    if (task.status !== 'ACTIVE' || task.legacy) continue;
    const crew = state.crew.find(person => person.crew_id === task.assigned_crew_id);
    if (!crew || crew.health < 50 || crew.fatigue >= 95) {
      releaseCrew(state, task, 'Crew became unavailable');
      events.push({ type: 'CREW WARNING', message: `${task.title} paused: assigned crew unavailable.` });
      continue;
    }
    const pace = Math.max(0.45, 0.85 + (crew.engineering_skill - 2) * 0.2 - Math.max(0, crew.fatigue - 55) * 0.012 + (task.priority === 5 ? 0.25 : 0));
    task.progress = round(Math.min(task.duration, task.progress + pace));
    crew.fatigue = round(clamp(crew.fatigue + (task.priority === 5 ? 4 : 2)));
    if (crew.fatigue >= 80) crew.health = round(clamp(crew.health - 1));
    recordCrewTaskEvent(state, task, crew, 'PROGRESS', `${task.progress}/${task.duration}`);
    if (task.progress < task.duration) continue;
    task.status = 'COMPLETE';
    task.assigned_crew_id = crew.crew_id;
    crew.current_task_id = null;
    recordCrewTaskEvent(state, task, crew, 'COMPLETE', 'Task complete');
    if (task.type === 'INSPECTION') {
      const module = state.modules.find(item => item.module_id === task.module_id);
      if (module) module.wear = round(clamp(module.wear - 2));
    }
    if (task.type === 'REACTOR_REPAIR') {
      state.generation = state.nominalGeneration;
      const reactor = state.modules.find(item => item.module_id === task.module_id);
      if (reactor) reactor.wear = round(clamp(reactor.wear - 35));
      state.batteryOnline = false;
      if (state.incident) state.incident.status = 'resolved';
      state.workOrders.filter(order => order.module_id === task.module_id && order.status === 'ACTIVE').forEach(order => { order.status = 'RESOLVED'; });
    }
    if (task.type === 'OXYGEN_RECOVERY') {
      const habitat = state.modules.find(item => item.module_id === task.module_id);
      if (habitat) {
        habitat.oxygen_target = Math.max(habitat.oxygen_target, 95);
        habitat.oxygen_level = Math.max(habitat.oxygen_level, 95);
        habitat.wear = round(clamp(habitat.wear - 5));
      }
    }
    events.push({ type: 'CREW TASK COMPLETE', message: `${crew.name} completed ${task.title}.` });
  }
  return events;
}
