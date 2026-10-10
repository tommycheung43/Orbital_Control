import initSqlJs from "sql.js";

class DatabaseManager {
  constructor() {
    this.SQL = null;

    this.db = null;

    this.initialized = false;
  }

  // =========================================================
  // Initialization
  // =========================================================

  async init() {
    if (this.initialized) {
      console.warn(
        "DatabaseManager has already been initialized."
      );

      return;
    }

    try {
      this.SQL = await initSqlJs({
        locateFile: () =>
          "/sql-wasm.wasm",
      });

      this.db =
        new this.SQL.Database();

      this.createTables();

      this.seedDatabase();

      this.initialized = true;

      console.log(
        "SQLite database initialized successfully."
      );
    } catch (error) {
      console.error(
        "Failed to initialize SQLite database:",
        error
      );

      throw error;
    }
  }

  // =========================================================
  // Safety Checks
  // =========================================================

  ensureInitialized() {
    if (
      !this.initialized ||
      !this.db
    ) {
      throw new Error(
        "Database has not been initialized."
      );
    }
  }

  ensureDatabaseObject() {
    if (!this.db) {
      throw new Error(
        "SQLite database object does not exist."
      );
    }
  }

  // =========================================================
  // Tables
  // =========================================================

  createTables() {
    this.ensureDatabaseObject();

    this.db.run(`
      CREATE TABLE IF NOT EXISTS crew (
        crew_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        sector TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS modules (
        module_id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL,
        oxygen_level INTEGER NOT NULL,
        power_level INTEGER NOT NULL,
        status TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS supplies (
        supply_id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        location TEXT NOT NULL
      );
    `);
  }

  // =========================================================
  // Prototype Starting Data
  // =========================================================

  seedDatabase() {
    this.ensureDatabaseObject();

    const crewCount =
      this.getSingleValue(`
        SELECT COUNT(*)
        FROM crew;
      `);

    if (crewCount === 0) {
      this.db.run(`
        INSERT INTO crew
        (
          name,
          role,
          status,
          sector
        )
        VALUES
        (
          'Alice',
          'Engineer',
          'Active',
          'A'
        ),
        (
          'Bob',
          'Scientist',
          'Injured',
          'B'
        ),
        (
          'Charlie',
          'Security',
          'Active',
          'C'
        ),
        (
          'Emma',
          'Engineer',
          'Active',
          'B'
        );
      `);
    }

    const moduleCount =
      this.getSingleValue(`
        SELECT COUNT(*)
        FROM modules;
      `);

    if (moduleCount === 0) {
      this.db.run(`
        INSERT INTO modules
        (
          module_name,
          oxygen_level,
          power_level,
          status
        )
        VALUES
        (
          'Engineering',
          95,
          80,
          'Normal'
        ),
        (
          'Habitation',
          70,
          90,
          'Normal'
        ),
        (
          'Medical',
          100,
          75,
          'Normal'
        ),
        (
          'Reactor',
          100,
          60,
          'Critical'
        );
      `);
    }

    const supplyCount =
      this.getSingleValue(`
        SELECT COUNT(*)
        FROM supplies;
      `);

    if (supplyCount === 0) {
      this.db.run(`
        INSERT INTO supplies
        (
          item_name,
          quantity,
          location
        )
        VALUES
        (
          'Food Pack',
          200,
          'Storage A'
        ),
        (
          'Water',
          500,
          'Storage B'
        ),
        (
          'Medical Kit',
          50,
          'Medical'
        ),
        (
          'Protein Gel',
          150,
          'Storage C'
        );
      `);
    }
  }

  // =========================================================
  // Query
  // =========================================================

  query(sql) {
    this.ensureInitialized();

    if (
      typeof sql !== "string" ||
      sql.trim() === ""
    ) {
      throw new Error(
        "SQL query cannot be empty."
      );
    }

    const results =
      this.db.exec(sql);

    if (
      results.length === 0
    ) {
      return [];
    }

    return this.convertResultToObjects(
      results[0]
    );
  }

  // =========================================================
  // Internal / General Execute
  // =========================================================

  execute(sql) {
    this.ensureInitialized();

    if (
      typeof sql !== "string" ||
      sql.trim() === ""
    ) {
      return {
        success: false,
        error:
          "SQL statement cannot be empty.",
        rowsModified: 0,
      };
    }

    try {
      this.db.run(sql);

      return {
        success: true,

        rowsModified:
          this.db.getRowsModified(),
      };
    } catch (error) {
      return {
        success: false,

        error:
          error.message,

        rowsModified: 0,
      };
    }
  }

  // =========================================================
  // PLAYER SQL
  // =========================================================

  /**
   * Used ONLY by the player's SQL terminal.
   *
   * This distinction matters later for:
   *
   * - learning analytics
   * - history
   * - scoring
   * - debugging
   * - achievements
   */
  executePlayerSQL(sql) {
    this.ensureInitialized();

    if (
      typeof sql !== "string" ||
      sql.trim() === ""
    ) {
      return {
        success: false,

        source:
          "player",

        type:
          "error",

        error:
          "SQL statement cannot be empty.",

        rows: [],

        rowsModified: 0,
      };
    }

    try {
      const results =
        this.db.exec(sql);

      const rowsModified =
        this.db.getRowsModified();

      if (
        results.length > 0
      ) {
        return {
          success: true,

          source:
            "player",

          type:
            "query",

          rows:
            this.convertResultToObjects(
              results[0]
            ),

          rowsModified,
        };
      }

      return {
        success: true,

        source:
          "player",

        type:
          "command",

        rows: [],

        rowsModified,
      };
    } catch (error) {
      return {
        success: false,

        source:
          "player",

        type:
          "error",

        error:
          error.message,

        rows: [],

        rowsModified: 0,
      };
    }
  }

  // =========================================================
  // SYSTEM SQL
  // =========================================================

  /**
   * Used by the running station simulation.
   *
   * System changes are deliberately separated
   * from player SQL.
   */
  executeSystemSQL(sql) {
    this.ensureInitialized();

    if (
      typeof sql !== "string" ||
      sql.trim() === ""
    ) {
      return {
        success: false,

        source:
          "system",

        error:
          "System SQL statement cannot be empty.",

        rowsModified: 0,
      };
    }

    try {
      this.db.run(sql);

      return {
        success: true,

        source:
          "system",

        rowsModified:
          this.db.getRowsModified(),
      };
    } catch (error) {
      console.error(
        "System SQL failed:",
        error
      );

      return {
        success: false,

        source:
          "system",

        error:
          error.message,

        rowsModified: 0,
      };
    }
  }

  // =========================================================
  // Result Conversion
  // =========================================================

  convertResultToObjects(
    result
  ) {
    const {
      columns,
      values,
    } = result;

    return values.map(
      (row) => {
        const object = {};

        columns.forEach(
          (
            column,
            index
          ) => {
            object[column] =
              row[index];
          }
        );

        return object;
      }
    );
  }

  // =========================================================
  // Internal Value Helper
  // =========================================================

  getSingleValue(sql) {
    this.ensureDatabaseObject();

    const results =
      this.db.exec(sql);

    if (
      results.length === 0 ||
      results[0]
        .values
        .length === 0
    ) {
      return null;
    }

    return results[0]
      .values[0][0];
  }

  // =========================================================
  // Schema Helpers
  // =========================================================

  getTables() {
    return this.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `);
  }

  getTableNames() {
    return this
      .getTables()
      .map(
        (table) =>
          table.name
      );
  }

  tableExists(
    tableName
  ) {
    this.ensureInitialized();

    return this
      .getTableNames()
      .includes(
        tableName
      );
  }

  getTableColumns(
    tableName
  ) {
    this.ensureInitialized();

    if (
      !this.tableExists(
        tableName
      )
    ) {
      throw new Error(
        `Table does not exist: ${tableName}`
      );
    }

    const safeTableName =
      tableName.replaceAll(
        '"',
        '""'
      );

    return this.query(`
      PRAGMA table_info(
        "${safeTableName}"
      );
    `);
  }

  getTableData(
    tableName
  ) {
    this.ensureInitialized();

    if (
      !this.tableExists(
        tableName
      )
    ) {
      throw new Error(
        `Table does not exist: ${tableName}`
      );
    }

    const safeTableName =
      tableName.replaceAll(
        '"',
        '""'
      );

    return this.query(`
      SELECT *
      FROM "${safeTableName}";
    `);
  }

  // =========================================================
  // Export / Load
  // =========================================================

  exportDatabase() {
    this.ensureInitialized();

    return this.db.export();
  }

  loadDatabase(data) {
    if (!this.SQL) {
      throw new Error(
        "sql.js has not been initialized."
      );
    }

    if (
      !(
        data instanceof
        Uint8Array
      )
    ) {
      throw new Error(
        "Database data must be Uint8Array."
      );
    }

    if (this.db) {
      this.db.close();
    }

    this.db =
      new this.SQL.Database(
        data
      );

    this.initialized =
      true;
  }

  // =========================================================
  // Reset
  // =========================================================

  resetDatabase() {
    this.ensureInitialized();

    this.db.close();

    this.db =
      new this.SQL.Database();

    /*
     * createTables() and seedDatabase()
     * only require the database object,
     * so initialized may remain true.
     */
    this.createTables();

    this.seedDatabase();

    console.log(
      "Database reset successfully."
    );
  }

  // =========================================================
  // Close
  // =========================================================

  close() {
    if (this.db) {
      this.db.close();

      this.db =
        null;
    }

    this.initialized =
      false;
  }
}

const databaseManager =
  new DatabaseManager();

export default databaseManager;