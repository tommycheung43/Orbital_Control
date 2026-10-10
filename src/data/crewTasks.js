export const crewRoles = {
  Engineer: 'Repairs and emergency systems work',
  Technician: 'Routine inspection and maintenance',
  Medic: 'Crew health and readiness',
  Operator: 'General station operations',
};

export const taskTemplates = {
  habitatInspection: {
    type: 'INSPECTION', title: 'Inspect Habitat filters', priority: 1,
    required_skill: 1, required_certification: null, duration: 2, risk: 'Low', source: 'routine', power_draw: 0,
  },
  reactorRepair: {
    type: 'REACTOR_REPAIR', title: 'Repair Reactor regulator', priority: 4,
    required_skill: 2, required_certification: 'REACTOR', duration: 6, risk: 'High', source: 'incident', power_draw: 4,
  },
  oxygenRecovery: {
    type: 'OXYGEN_RECOVERY', title: 'Stabilize Habitat scrubbers', priority: 5,
    required_skill: 1, required_certification: 'OXYGEN', duration: 4, risk: 'Medium', source: 'incident', power_draw: 3,
  },
};

export function createCrewTask(templateId, taskId, moduleId, duration) {
  const template = taskTemplates[templateId];
  if (!template) throw new Error(`Unknown crew task template: ${templateId}`);
  return { task_id: taskId, module_id: moduleId, ...template,
    duration: duration ?? template.duration, progress: 0, status: 'OPEN', assigned_crew_id: null, supplies_reserved: false };
}
