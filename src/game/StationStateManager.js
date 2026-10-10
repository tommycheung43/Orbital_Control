import DatabaseManager
  from "../database/DatabaseManager.js";

import OperationHistoryManager
  from "./OperationHistoryManager.js";

import stationRules
  from "../data/stationRules.js";

class StationStateManager {
  constructor() {
    this.reconciling = false;
  }

  // =========================================================
  // Reconcile Entire Station
  // =========================================================

  reconcileAll({
    logChanges = true,
  } = {}) {
    if (this.reconciling) {
      return {
        success: true,
        changed: false,
      };
    }

    this.reconciling = true;

    try {
      const moduleResult =
        this.reconcileModules({
          logChanges,
        });

      return {
        success: true,

        changed:
          moduleResult.changed,
      };
    } catch (error) {
      console.error(
        "Station state reconciliation failed:",
        error
      );

      return {
        success: false,

        changed: false,

        error:
          error.message,
      };
    } finally {
      this.reconciling =
        false;
    }
  }

  // =========================================================
  // Module State
  // =========================================================

  reconcileModules({
    logChanges = true,
  } = {}) {
    const modules =
      DatabaseManager.query(`
        SELECT
          module_id,
          module_name,
          oxygen_level,
          power_level,
          status
        FROM modules;
      `);

    let changed =
      false;

    modules.forEach(
      (module) => {
        const expectedStatus =
          this.calculateModuleStatus(
            module
          );

        if (
          module.status ===
          expectedStatus
        ) {
          return;
        }

        const result =
          DatabaseManager
            .executeSystemSQL(`
              UPDATE modules
              SET status = '${expectedStatus}'
              WHERE module_id = ${module.module_id};
            `);

        if (
          !result.success
        ) {
          console.error(
            `Unable to update status for ${module.module_name}:`,
            result.error
          );

          return;
        }

        changed =
          true;

        if (
          logChanges
        ) {
          OperationHistoryManager
            .recordSystemEvent({
              operation:
                "STATUS UPDATE",

              target:
                module.module_name,

              message:
                `${module.module_name} status automatically changed from ${module.status} to ${expectedStatus}.`,

              severity:
                this.statusToSeverity(
                  expectedStatus
                ),
            });
        }
      }
    );

    return {
      success: true,
      changed,
    };
  }

  // =========================================================
  // Calculate Module Status
  // =========================================================

  calculateModuleStatus(
    module
  ) {
    const oxygen =
      Number(
        module.oxygen_level
      );

    const power =
      Number(
        module.power_level
      );

    const oxygenRules =
      stationRules
        .modules
        .oxygen_level;

    const powerRules =
      stationRules
        .modules
        .power_level;

    // -------------------------------------------------------
    // Critical
    // -------------------------------------------------------

    if (
      oxygen <
        oxygenRules
          .criticalBelow ||
      power <
        powerRules
          .criticalBelow
    ) {
      return "Critical";
    }

    // -------------------------------------------------------
    // Warning
    // -------------------------------------------------------

    if (
      oxygen <
        oxygenRules
          .warningBelow ||
      power <
        powerRules
          .warningBelow
    ) {
      return "Warning";
    }

    // -------------------------------------------------------
    // Healthy
    // -------------------------------------------------------

    return "Normal";
  }

  // =========================================================
  // Severity
  // =========================================================

  statusToSeverity(
    status
  ) {
    switch (status) {
      case "Critical":
        return "danger";

      case "Warning":
        return "warning";

      case "Normal":
        return "info";

      default:
        return "neutral";
    }
  }
}

const stationStateManager =
  new StationStateManager();

export default stationStateManager;