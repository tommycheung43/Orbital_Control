import DatabaseManager
  from "../database/DatabaseManager.js";

class MissionValidator {
  // =========================================================
  // Main Validation Entry
  // =========================================================

  validate(
    mission,
    execution
  ) {
    if (!mission) {
      return {
        success: false,
        message:
          "No active incident is available for validation.",
      };
    }

    if (!mission.type) {
      return {
        success: false,
        message:
          "Incident validation type is missing.",
      };
    }

    switch (mission.type) {
      case "query-result":
        return this.validateQueryResult(
          mission,
          execution
        );

      case "database-state":
        return this.validateDatabaseState(
          mission
        );

      default:
        return {
          success: false,

          message:
            `Unsupported validation type: ${mission.type}`,
        };
    }
  }

  // =========================================================
  // Query Result Validation
  // =========================================================

  validateQueryResult(
    mission,
    execution
  ) {
    if (
      !execution ||
      !execution.success
    ) {
      return {
        success: false,

        message:
          "Execute valid SQL before submitting the incident response.",
      };
    }

    if (
      execution.type !==
      "query"
    ) {
      return {
        success: false,

        message:
          "This incident requires a query result.",
      };
    }

    const expectedRows =
      mission.expectedRows ?? [];

    const actualRows =
      execution.rows ?? [];

    const matches =
      this.compareRows(
        actualRows,
        expectedRows
      );

    if (!matches) {
      return {
        success: false,

        message:
          "The query executed successfully, but the result does not satisfy the incident objective.",
      };
    }

    return {
      success: true,

      message:
        "Incident objective satisfied.",
    };
  }

  // =========================================================
  // Database State Validation
  // =========================================================

  validateDatabaseState(
    mission
  ) {
    const validationQuery =
      mission.validationQuery;

    if (
      typeof validationQuery !==
        "string" ||
      validationQuery.trim() ===
        ""
    ) {
      console.error(
        "Database-state incident has no validationQuery:",
        mission
      );

      return {
        success: false,

        message:
          "Incident configuration error: validation query is missing.",
      };
    }

    try {
      const actualRows =
        DatabaseManager.query(
          validationQuery
        );

      const expectedRows =
        mission.expectedRows ?? [];

      console.log(
        "Incident database validation:",
        {
          actualRows,
          expectedRows,
        }
      );

      const matches =
        this.compareRows(
          actualRows,
          expectedRows
        );

      if (!matches) {
        return {
          success: false,

          message:
            "The incident is still unresolved. Check the current database state and continue investigating.",
        };
      }

      return {
        success: true,

        message:
          "The required station state has been verified.",
      };
    } catch (error) {
      console.error(
        "Failed to validate database state:",
        error
      );

      return {
        success: false,

        message:
          `Unable to verify database state: ${error.message}`,
      };
    }
  }

  // =========================================================
  // Row Comparison
  // =========================================================

  compareRows(
    actualRows,
    expectedRows
  ) {
    if (
      !Array.isArray(actualRows) ||
      !Array.isArray(expectedRows)
    ) {
      return false;
    }

    if (
      actualRows.length !==
      expectedRows.length
    ) {
      return false;
    }

    /*
     * We compare rows without depending
     * on their order.
     *
     * This means:
     *
     * [
     *   { name: "Bob" },
     *   { name: "Emma" }
     * ]
     *
     * is considered equal to:
     *
     * [
     *   { name: "Emma" },
     *   { name: "Bob" }
     * ]
     */
    const usedIndexes =
      new Set();

    for (
      const expectedRow
      of expectedRows
    ) {
      let matchingIndex =
        -1;

      for (
        let index = 0;
        index <
        actualRows.length;
        index++
      ) {
        if (
          usedIndexes.has(
            index
          )
        ) {
          continue;
        }

        if (
          this.compareSingleRow(
            actualRows[index],
            expectedRow
          )
        ) {
          matchingIndex =
            index;

          break;
        }
      }

      if (
        matchingIndex ===
        -1
      ) {
        return false;
      }

      usedIndexes.add(
        matchingIndex
      );
    }

    return true;
  }

  // =========================================================
  // Single Row Comparison
  // =========================================================

  compareSingleRow(
    actual,
    expected
  ) {
    if (
      typeof actual !==
        "object" ||
      actual === null ||
      typeof expected !==
        "object" ||
      expected === null
    ) {
      return false;
    }

    /*
     * Only fields declared in expected
     * need to match.
     *
     * Extra columns in actual data
     * are ignored.
     */
    return Object.keys(
      expected
    ).every(
      (key) => {
        return (
          actual[key] ===
          expected[key]
        );
      }
    );
  }
}

const missionValidator =
  new MissionValidator();

export default missionValidator;