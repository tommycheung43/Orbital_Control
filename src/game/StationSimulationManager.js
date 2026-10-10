import DatabaseManager
  from "../database/DatabaseManager.js";

import OperationHistoryManager
  from "./OperationHistoryManager.js";

import StationStateManager
  from "./StationStateManager.js";

import stationRules
  from "../data/stationRules.js";

class StationSimulationManager {
  constructor() {
    this.scene =
      null;

    this.running =
      false;

    this.incidentActive =
      false;

    this.incidentCompleted =
      false;

    this.systemTimers =
      [];

    this.incidentTimer =
      null;

    this.onDatabaseChanged =
      null;

    this.onIncidentStarted =
      null;

    this.onIncidentResolved =
      null;
  }

  // =========================================================
  // Init
  // =========================================================

  init(
    scene,
    {
      onDatabaseChanged = null,
      onIncidentStarted = null,
      onIncidentResolved = null,
    } = {}
  ) {
    this.scene =
      scene;

    this.onDatabaseChanged =
      onDatabaseChanged;

    this.onIncidentStarted =
      onIncidentStarted;

    this.onIncidentResolved =
      onIncidentResolved;
  }

  // =========================================================
  // Start
  // =========================================================

  start() {
    if (
      this.running
    ) {
      return;
    }

    if (
      !this.scene
    ) {
      throw new Error(
        "StationSimulationManager must be initialized with a Phaser Scene."
      );
    }

    this.running =
      true;

    this.incidentActive =
      false;

    this.incidentCompleted =
      false;

    /*
     * Immediately make sure starting
     * database state is internally consistent.
     */
    StationStateManager
      .reconcileAll({
        logChanges:
          true,
      });

    OperationHistoryManager
      .recordSystemEvent({
        operation:
          "STATION ONLINE",

        target:
          "Orbital Control",

        message:
          "Autonomous station systems are online.",

        severity:
          "neutral",
      });

    this.createBackgroundTimers();

    /*
     * Prototype incident.
     */
    this.scheduleFirstIncident(
      15000
    );

    this.notifyDatabaseChanged();
  }

  // =========================================================
  // Background Simulation
  // =========================================================

  createBackgroundTimers() {
    // -------------------------------------------------------
    // Power
    // -------------------------------------------------------

    const powerTimer =
      this.scene.time.addEvent({
        delay:
          8000,

        loop:
          true,

        callback:
          () => {
            this.simulateModulePowerChange();
          },
      });

    // -------------------------------------------------------
    // Supplies
    // -------------------------------------------------------

    const supplyTimer =
      this.scene.time.addEvent({
        delay:
          12000,

        loop:
          true,

        callback:
          () => {
            this.simulateSupplyConsumption();
          },
      });

    // -------------------------------------------------------
    // Crew Movement
    // -------------------------------------------------------

    const crewTimer =
      this.scene.time.addEvent({
        delay:
          18000,

        loop:
          true,

        callback:
          () => {
            this.simulateCrewMovement();
          },
      });

    this.systemTimers.push(
      powerTimer,
      supplyTimer,
      crewTimer
    );
  }

  // =========================================================
  // Generic System Commit
  // =========================================================

  commitSystemChange(
    sql,
    {
      operation =
        "SYSTEM UPDATE",

      target =
        null,

      message =
        null,

      severity =
        "neutral",

      reconcile =
        true,
    } = {}
  ) {
    const result =
      DatabaseManager
        .executeSystemSQL(
          sql
        );

    if (
      !result.success
    ) {
      console.error(
        "Autonomous system update failed:",
        result.error
      );

      return result;
    }

    if (
      message
    ) {
      OperationHistoryManager
        .recordSystemEvent({
          operation,
          target,
          message,
          severity,
        });
    }

    /*
     * IMPORTANT:
     *
     * The station automatically checks whether
     * this DB change affects derived system state.
     */
    if (
      reconcile
    ) {
      StationStateManager
        .reconcileAll({
          logChanges:
            true,
        });
    }

    this.notifyDatabaseChanged();

    return result;
  }

  // =========================================================
  // Module Power
  // =========================================================

  simulateModulePowerChange() {
    if (
      !this.running
    ) {
      return;
    }

    const modules =
      DatabaseManager.query(`
        SELECT
          module_id,
          module_name,
          power_level
        FROM modules;
      `);

    if (
      modules.length ===
      0
    ) {
      return;
    }

    const selected =
      modules[
        Math.floor(
          Math.random() *
          modules.length
        )
      ];

    const change =
      Math.random() <
      0.5
        ? -2
        : 2;

    const oldPower =
      selected.power_level;

    const newPower =
      Math.max(
        0,
        Math.min(
          100,
          oldPower +
            change
        )
      );

    if (
      oldPower ===
      newPower
    ) {
      return;
    }

    this.commitSystemChange(
      `
        UPDATE modules
        SET power_level = ${newPower}
        WHERE module_id = ${selected.module_id};
      `,
      {
        operation:
          "POWER UPDATE",

        target:
          selected.module_name,

        message:
          `${selected.module_name} power changed from ${oldPower}% to ${newPower}%.`,
      }
    );
  }

  // =========================================================
  // Supply Consumption
  // =========================================================

  simulateSupplyConsumption() {
    if (
      !this.running
    ) {
      return;
    }

    const rows =
      DatabaseManager.query(`
        SELECT
          supply_id,
          quantity
        FROM supplies
        WHERE item_name = 'Food Pack';
      `);

    if (
      rows.length ===
      0
    ) {
      return;
    }

    const supply =
      rows[0];

    if (
      supply.quantity <=
      0
    ) {
      return;
    }

    const oldQuantity =
      supply.quantity;

    const newQuantity =
      Math.max(
        0,
        oldQuantity - 5
      );

    let severity =
      "neutral";

    const supplyRules =
      stationRules
        .supplies[
          "Food Pack"
        ];

    if (
      newQuantity <=
      supplyRules
        .criticalAtOrBelow
    ) {
      severity =
        "danger";
    } else if (
      newQuantity <=
      supplyRules
        .warningAtOrBelow
    ) {
      severity =
        "warning";
    }

    this.commitSystemChange(
      `
        UPDATE supplies
        SET quantity = ${newQuantity}
        WHERE supply_id = ${supply.supply_id};
      `,
      {
        operation:
          "SUPPLY USE",

        target:
          "Food Pack",

        message:
          `Routine crew consumption reduced Food Pack supply from ${oldQuantity} to ${newQuantity}.`,

        severity,
      }
    );
  }

  // =========================================================
  // Crew Movement
  // =========================================================

  simulateCrewMovement() {
    if (
      !this.running
    ) {
      return;
    }

    const crew =
      DatabaseManager.query(`
        SELECT
          crew_id,
          name,
          sector,
          status
        FROM crew
        WHERE status = 'Active';
      `);

    if (
      crew.length ===
      0
    ) {
      return;
    }

    const selected =
      crew[
        Math.floor(
          Math.random() *
          crew.length
        )
      ];

    const possibleSectors =
      stationRules
        .crew
        .routineSectors
        .filter(
          (sector) =>
            sector !==
            selected.sector
        );

    if (
      possibleSectors.length ===
      0
    ) {
      return;
    }

    const destination =
      possibleSectors[
        Math.floor(
          Math.random() *
          possibleSectors.length
        )
      ];

    this.commitSystemChange(
      `
        UPDATE crew
        SET sector = '${destination}'
        WHERE crew_id = ${selected.crew_id};
      `,
      {
        operation:
          "CREW MOVEMENT",

        target:
          selected.name,

        message:
          `${selected.name} moved from ${selected.sector} to ${destination} during routine station operations.`,

        severity:
          "neutral",
      }
    );
  }

  // =========================================================
  // Incident Scheduling
  // =========================================================

  scheduleFirstIncident(
    delay
  ) {
    if (
      !this.running ||
      this.incidentActive ||
      this.incidentCompleted
    ) {
      return;
    }

    if (
      this.incidentTimer
    ) {
      this.incidentTimer
        .remove();

      this.incidentTimer =
        null;
    }

    this.incidentTimer =
      this.scene.time
        .delayedCall(
          delay,
          () => {
            this.triggerOxygenIncident();
          }
        );
  }

  // =========================================================
  // Oxygen Incident
  // =========================================================

  triggerOxygenIncident() {
    if (
      !this.running ||
      this.incidentActive ||
      this.incidentCompleted
    ) {
      return;
    }

    const rows =
      DatabaseManager.query(`
        SELECT
          module_id,
          oxygen_level
        FROM modules
        WHERE module_name = 'Habitation';
      `);

    if (
      rows.length ===
      0
    ) {
      console.error(
        "Habitation module does not exist."
      );

      return;
    }

    const oldOxygen =
      rows[0]
        .oxygen_level;

    /*
     * Notice:
     *
     * We DO NOT manually set status='Critical'.
     *
     * The monitoring system derives it
     * automatically from oxygen_level.
     */
    const result =
      this.commitSystemChange(
        `
          UPDATE modules
          SET oxygen_level = 45
          WHERE module_name = 'Habitation';
        `,
        {
          operation:
            "OXYGEN FAILURE",

          target:
            "Habitation",

          message:
            `Habitation oxygen level dropped from ${oldOxygen}% to 45%.`,

          severity:
            "danger",
        }
      );

    if (
      !result.success
    ) {
      return;
    }

    this.incidentActive =
      true;

    OperationHistoryManager
      .recordIncidentEvent({
        operation:
          "OXYGEN ALERT",

        target:
          "Habitation",

        message:
          "Habitation environmental monitoring detected a critical oxygen anomaly. Operator intervention required.",

        severity:
          "danger",
      });

    this.onIncidentStarted?.();
  }

  // =========================================================
  // Resolve Incident
  // =========================================================

  resolveIncident() {
    if (
      !this.incidentActive
    ) {
      return;
    }

    /*
     * One final automatic consistency check.
     */
    StationStateManager
      .reconcileAll({
        logChanges:
          true,
      });

    this.incidentActive =
      false;

    this.incidentCompleted =
      true;

    OperationHistoryManager
      .recordIncidentEvent({
        operation:
          "INCIDENT CLOSED",

        target:
          "Habitation",

        message:
          "Environmental monitoring confirms stable Habitation operating conditions.",

        severity:
          "info",
      });

    this.notifyDatabaseChanged();

    this.onIncidentResolved?.();
  }

  // =========================================================
  // State
  // =========================================================

  isIncidentActive() {
    return this.incidentActive;
  }

  hasCompletedPrototypeIncident() {
    return this.incidentCompleted;
  }

  // =========================================================
  // UI Notification
  // =========================================================

  notifyDatabaseChanged() {
    this.onDatabaseChanged?.();
  }

  // =========================================================
  // Stop
  // =========================================================

  stop() {
    this.running =
      false;

    this.incidentActive =
      false;

    this.systemTimers.forEach(
      (timer) => {
        timer?.remove();
      }
    );

    this.systemTimers =
      [];

    if (
      this.incidentTimer
    ) {
      this.incidentTimer
        .remove();

      this.incidentTimer =
        null;
    }

    this.scene =
      null;

    this.onDatabaseChanged =
      null;

    this.onIncidentStarted =
      null;

    this.onIncidentResolved =
      null;
  }
}

const stationSimulationManager =
  new StationSimulationManager();

export default stationSimulationManager;