class OperationHistoryManager {
  constructor() {
    this.entries = [];

    this.nextId = 1;

    this.listeners = [];
  }

  // =========================================================
  // Player SQL
  // =========================================================

  recordPlayerExecution(
    sql,
    execution
  ) {
    const parsed =
      this.parseSQL(sql);

    const entry = {
      id:
        this.nextId++,

      timestamp:
        new Date(),

      timeLabel:
        this.getTimeLabel(),

      source:
        "PLAYER",

      sql,

      operation:
        parsed.operation,

      target:
        parsed.target,

      category:
        this.determineCategory(
          parsed.operation,
          execution
        ),

      severity:
        this.determineSeverity(
          parsed.operation,
          execution
        ),

      success:
        execution?.success === true,

      rowCount:
        execution?.type === "query"
          ? execution.rows?.length ?? 0
          : null,

      rowsModified:
        execution?.rowsModified ?? 0,

      message:
        this.buildPlayerMessage(
          parsed,
          execution
        ),
    };

    this.addEntry(
      entry
    );

    return entry;
  }

  /**
   * Backwards-compatible alias.
   */
  recordExecution(
    sql,
    execution
  ) {
    return this.recordPlayerExecution(
      sql,
      execution
    );
  }

  // =========================================================
  // System Events
  // =========================================================

  recordSystemEvent({
    operation = "SYSTEM",
    target = null,
    message = "",
    severity = "neutral",
    sql = null,
  }) {
    const entry = {
      id:
        this.nextId++,

      timestamp:
        new Date(),

      timeLabel:
        this.getTimeLabel(),

      source:
        "SYSTEM",

      sql,

      operation,

      target,

      category:
        "system",

      severity,

      success:
        true,

      rowCount:
        null,

      rowsModified:
        null,

      message,
    };

    this.addEntry(
      entry
    );

    return entry;
  }

  // =========================================================
  // Incident Events
  // =========================================================

  recordIncidentEvent({
    operation = "INCIDENT",
    target = null,
    message = "",
    severity = "warning",
  }) {
    const entry = {
      id:
        this.nextId++,

      timestamp:
        new Date(),

      timeLabel:
        this.getTimeLabel(),

      source:
        "INCIDENT",

      sql:
        null,

      operation,

      target,

      category:
        "incident",

      severity,

      success:
        true,

      rowCount:
        null,

      rowsModified:
        null,

      message,
    };

    this.addEntry(
      entry
    );

    return entry;
  }

  // =========================================================
  // Entry Storage
  // =========================================================

  addEntry(
    entry
  ) {
    this.entries.unshift(
      entry
    );

    this.notifyListeners();
  }

  getEntries() {
    return [
      ...this.entries
    ];
  }

  getRecentEntries(
    limit = 5
  ) {
    return this.entries.slice(
      0,
      limit
    );
  }

  clear() {
    this.entries = [];

    this.nextId = 1;

    this.notifyListeners();
  }

  // =========================================================
  // Subscription
  // =========================================================

  subscribe(
    callback
  ) {
    if (
      typeof callback !==
      "function"
    ) {
      return () => {};
    }

    this.listeners.push(
      callback
    );

    return () => {
      this.listeners =
        this.listeners.filter(
          (listener) =>
            listener !== callback
        );
    };
  }

  notifyListeners() {
    const entries =
      this.getEntries();

    this.listeners.forEach(
      (listener) => {
        listener(
          entries
        );
      }
    );
  }

  // =========================================================
  // Time
  // =========================================================

  getTimeLabel() {
    return new Date()
      .toLocaleTimeString(
        [],
        {
          hour:
            "2-digit",

          minute:
            "2-digit",

          second:
            "2-digit",
        }
      );
  }

  // =========================================================
  // SQL Parsing
  // =========================================================

  parseSQL(
    sql
  ) {
    if (
      typeof sql !==
      "string"
    ) {
      return {
        operation:
          "UNKNOWN",

        target:
          null,
      };
    }

    const normalized =
      sql
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    const upper =
      normalized.toUpperCase();

    if (
      upper.startsWith(
        "CREATE TABLE"
      )
    ) {
      return {
        operation:
          "CREATE TABLE",

        target:
          this.extractTarget(
            normalized,
            /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?([A-Za-z_][A-Za-z0-9_]*)/i
          ),
      };
    }

    if (
      upper.startsWith(
        "ALTER TABLE"
      )
    ) {
      return {
        operation:
          "ALTER TABLE",

        target:
          this.extractTarget(
            normalized,
            /ALTER\s+TABLE\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/i
          ),
      };
    }

    if (
      upper.startsWith(
        "DROP TABLE"
      )
    ) {
      return {
        operation:
          "DROP TABLE",

        target:
          this.extractTarget(
            normalized,
            /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`[]?([A-Za-z_][A-Za-z0-9_]*)/i
          ),
      };
    }

    if (
      upper.startsWith(
        "INSERT"
      )
    ) {
      return {
        operation:
          "INSERT",

        target:
          this.extractTarget(
            normalized,
            /INSERT\s+INTO\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/i
          ),
      };
    }

    if (
      upper.startsWith(
        "UPDATE"
      )
    ) {
      return {
        operation:
          "UPDATE",

        target:
          this.extractTarget(
            normalized,
            /UPDATE\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/i
          ),
      };
    }

    if (
      upper.startsWith(
        "DELETE"
      )
    ) {
      return {
        operation:
          "DELETE",

        target:
          this.extractTarget(
            normalized,
            /DELETE\s+FROM\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/i
          ),
      };
    }

    if (
      upper.startsWith(
        "SELECT"
      )
    ) {
      return {
        operation:
          "SELECT",

        target:
          this.extractTarget(
            normalized,
            /FROM\s+["`[]?([A-Za-z_][A-Za-z0-9_]*)/i
          ),
      };
    }

    return {
      operation:
        upper
          .split(" ")[0] ||
        "UNKNOWN",

      target:
        null,
    };
  }

  extractTarget(
    sql,
    regex
  ) {
    const match =
      sql.match(
        regex
      );

    return (
      match?.[1] ??
      null
    );
  }

  // =========================================================
  // Category
  // =========================================================

  determineCategory(
    operation,
    execution
  ) {
    if (
      !execution?.success
    ) {
      return "error";
    }

    switch (
      operation
    ) {
      case "SELECT":
        return "query";

      case "INSERT":
      case "UPDATE":
      case "DELETE":
        return "data-change";

      case "CREATE TABLE":
      case "ALTER TABLE":
      case "DROP TABLE":
        return "schema-change";

      default:
        return "command";
    }
  }

  // =========================================================
  // Severity
  // =========================================================

  determineSeverity(
    operation,
    execution
  ) {
    if (
      !execution?.success
    ) {
      return "error";
    }

    switch (
      operation
    ) {
      case "DROP TABLE":
        return "danger";

      case "DELETE":
      case "ALTER TABLE":
        return "warning";

      case "CREATE TABLE":
      case "INSERT":
      case "UPDATE":
        return "info";

      default:
        return "neutral";
    }
  }

  // =========================================================
  // Player Message
  // =========================================================

  buildPlayerMessage(
    parsed,
    execution
  ) {
    if (
      !execution?.success
    ) {
      return (
        execution?.error ??
        "SQL execution failed."
      );
    }

    switch (
      parsed.operation
    ) {
      case "SELECT":
        return `${
          execution.rows?.length ??
          0
        } row(s) returned`;

      case "INSERT":
        return `${
          execution.rowsModified ??
          0
        } row(s) inserted`;

      case "UPDATE":
        return `${
          execution.rowsModified ??
          0
        } row(s) updated`;

      case "DELETE":
        return `${
          execution.rowsModified ??
          0
        } row(s) deleted`;

      case "CREATE TABLE":
        return parsed.target
          ? `Table "${parsed.target}" created`
          : "Table created";

      case "ALTER TABLE":
        return parsed.target
          ? `Table "${parsed.target}" changed`
          : "Table schema changed";

      case "DROP TABLE":
        return parsed.target
          ? `Table "${parsed.target}" deleted`
          : "Table deleted";

      default:
        return (
          "Command executed successfully"
        );
    }
  }
}

const operationHistoryManager =
  new OperationHistoryManager();

export default operationHistoryManager;