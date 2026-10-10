import { scenario } from './reactorScenario.js';

export const defaultScenario = () => structuredClone(scenario);

export function validateScenario(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') return { valid: false, errors: ['Scenario must be an object.'] };
  if (typeof candidate.title !== 'string' || !candidate.title.trim()) errors.push('Title is required.');
  for (const [field, min, max] of [['triggerTick', 1, 60], ['deadlineTicks', 6, 180], ['runTicks', 30, 600], ['historySamples', 100, 2000]]) {
    const value = Number(candidate[field]);
    if (!Number.isInteger(value) || value < min || value > max) errors.push(`${field} must be an integer from ${min} to ${max}.`);
  }
  if (!Array.isArray(candidate.modules) || candidate.modules.length < 3 || candidate.modules.length > 12) errors.push('Use 3 to 12 modules.');
  const modules = Array.isArray(candidate.modules) ? candidate.modules : [];
  const names = new Set();
  for (const [index, module] of modules.entries()) {
    if (!module.module_name?.trim()) errors.push(`Module ${index + 1} needs a name.`);
    const normalized = module.module_name?.trim().toLowerCase();
    if (normalized && names.has(normalized)) errors.push(`Module name must be unique: ${module.module_name}.`);
    names.add(normalized);
    if (!['reactor', 'habitat', 'industry', 'support'].includes(module.kind)) errors.push(`Module ${index + 1} has an invalid type.`);
    for (const [field, min, max] of [['nominal_mw', 0, 100], ['minimum_mw', 0, 100], ['occupants', 0, 200], ['wear', 0, 100], ['oxygen_level', 0, 100]]) {
      const value = Number(module[field]);
      if (!Number.isFinite(value) || value < min || value > max) errors.push(`${module.module_name || `Module ${index + 1}`} ${field} must be ${min}-${max}.`);
    }
    if (Number(module.minimum_mw) > Number(module.nominal_mw)) errors.push(`${module.module_name} minimum power cannot exceed nominal power.`);
  }
  for (const kind of ['reactor', 'habitat', 'industry']) {
    if (modules.filter(module => module.kind === kind).length !== 1) errors.push(`Scenario needs exactly one ${kind} module.`);
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeScenario(candidate) {
  const config = structuredClone(candidate);
  config.id = String(config.id || 'teacher-scenario');
  config.contentVersion = Number(config.contentVersion || 1) + 1;
  config.schemaVersion = 4; config.tickMs = 5000; config.title = config.title.trim();
  config.alert = scenario.alert;
  config.questions = structuredClone(scenario.questions);
  for (const field of ['triggerTick', 'deadlineTicks', 'runTicks', 'historySamples']) config[field] = Number(config[field]);
  config.modules = config.modules.map((module, index) => ({
    module_id: index + 1, module_name: module.module_name.trim(), kind: module.kind,
    nominal_mw: Number(module.nominal_mw), minimum_mw: Number(module.minimum_mw), occupants: Number(module.occupants),
    can_defer: Number(Boolean(Number(module.can_defer))), wear: Number(module.wear), oxygen_level: Number(module.oxygen_level),
  }));
  return config;
}
