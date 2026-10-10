// Earlier station shifts give learners a real comparison before the first emergency.
// Generation is deterministic so the same seed always produces the same evidence.
export function createCrewServiceHistory(seed, crew, reactorModuleId) {
  const records = [];
  for (const person of crew.filter(member => member.certification === 'REACTOR')) {
    for (let shift = 0; shift < 3; shift++) {
      const variation = ((Math.imul(seed ^ person.crew_id, 1103515245) + shift * 12345) >>> 0) % 23;
      const fatigueAfter = Math.min(96, Math.max(12, person.fatigue + variation - 10));
      const workTicks = Math.max(3, Math.ceil(7.5 - person.engineering_skill * 0.7 + fatigueAfter / 34 + variation / 16));
      records.push({ record_id: records.length + 1, crew_id: person.crew_id,
        module_id: reactorModuleId, recorded_at: -90 + shift * 20 + person.crew_id,
        task_type: 'REACTOR_MAINTENANCE', outcome: fatigueAfter >= 78 && variation >= 12 ? 'DELAYED' : 'COMPLETED',
        work_ticks: workTicks, fatigue_after: fatigueAfter });
    }
  }
  return records;
}
