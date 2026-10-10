export const scenario = {
  id: 'reactor-instability', contentVersion: 4, schemaVersion: 4, tickMs: 5000,
  triggerTick: 3, deadlineTicks: 48, runTicks: 90, historySamples: 500,
  title: 'Reactor instability', alert: 'Reactor output -25%. Choose a containment response; use SQL if you need more detail.',
  modules: [
    { module_id: 1, module_name: 'Reactor', kind: 'reactor', nominal_mw: 10, minimum_mw: 10, occupants: 2, can_defer: 0, wear: 65, oxygen_level: 96 },
    { module_id: 2, module_name: 'Habitat', kind: 'habitat', nominal_mw: 50, minimum_mw: 40, occupants: 8, can_defer: 0, wear: 15, oxygen_level: 95 },
    { module_id: 3, module_name: 'Industry', kind: 'industry', nominal_mw: 30, minimum_mw: 20, occupants: 0, can_defer: 1, wear: 30, oxygen_level: 91 },
  ],
  questions: [
    { id: 'loads', level: 1, label: 'Habitat status', columns: ['module_name', 'mw', 'minimum_mw', 'occupants', 'oxygen_level'], sql: "SELECT module_name, mw, minimum_mw, occupants, oxygen_level FROM current_modules WHERE kind = 'habitat';" },
    { id: 'backup', level: 1, label: 'Battery reserve', columns: ['module_name', 'reserve_mwh', 'capacity_mwh', 'max_mw'], sql: "SELECT module_name, reserve_mwh, capacity_mwh, max_mw FROM current_backups WHERE module_name = 'Habitat';" },
    { id: 'maintenance', level: 2, label: 'Recent Reactor maintenance', columns: ['log_id', 'module_name', 'recorded_at', 'finding', 'repair_ticks'], sql: "SELECT log_id, module_name, recorded_at, finding, repair_ticks FROM maintenance_history WHERE kind = 'reactor' ORDER BY recorded_at DESC LIMIT 28;" },
    { id: 'crew', level: 3, label: 'Repair crew JOIN', columns: ['crew_id', 'crew_code', 'fatigue', 'certification', 'module_id'], sql: "SELECT c.crew_id, c.crew_code, c.fatigue, cert.certification, a.module_id FROM crew c JOIN crew_certifications cert ON cert.crew_id = c.crew_id JOIN assignments a ON a.crew_id = c.crew_id WHERE cert.certification = 'REACTOR';" },
  ],
};

export const decisions = [
  { id: 'suspend-industry', label: 'Suspend Industry', impacts: ['Power', 'Production', 'Maintenance'], tempo: 'Immediate relief', tradeoff: 'Production backlog risk' },
  { id: 'reduce-habitat', label: 'Reduce Habitat power', impacts: ['Power', 'Oxygen', 'Crew', 'Safety'], tempo: 'Immediate relief', tradeoff: 'Life-support and fatigue risk' },
  { id: 'use-battery', label: 'Use battery reserve', impacts: ['Power', 'Reserve', 'Maintenance'], tempo: 'Temporary relief', tradeoff: 'Reserve and equipment-wear risk' },
];

export const operations = [
  { id: 'assign-engineer', label: 'Reassign engineer', impacts: ['Crew', 'Maintenance'], tempo: 'Preparation', tradeoff: 'Adds fatigue and delays routine work' },
  { id: 'repair-reactor', label: 'Initiate Reactor repair', impacts: ['Maintenance', 'Supplies', 'Power'], tempo: 'Timed recovery', tradeoff: 'Consumes spares and crew capacity' },
  { id: 'restore-loads', label: 'Restore module allocations', impacts: ['Power', 'Oxygen', 'Production'], tempo: 'Final recovery', tradeoff: 'Raises station demand' },
];
