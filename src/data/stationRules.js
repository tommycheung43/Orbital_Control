const stationRules = {
  // =========================================================
  // Module Operating Thresholds
  // =========================================================

  modules: {
    oxygen_level: {
      criticalBelow: 50,
      warningBelow: 70,
    },

    power_level: {
      criticalBelow: 40,
      warningBelow: 65,
    },
  },

  // =========================================================
  // Supply Thresholds
  // =========================================================

  supplies: {
    "Food Pack": {
      criticalAtOrBelow: 25,
      warningAtOrBelow: 50,
    },
  },

  // =========================================================
  // Crew Simulation
  // =========================================================

  crew: {
    routineSectors: [
      "A",
      "B",
      "C",
      "Engineering",
      "Medical",
      "Habitation",
    ],
  },
};

export default stationRules;