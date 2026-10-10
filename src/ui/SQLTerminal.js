import DatabaseManager
  from "../database/DatabaseManager.js";

import PresentationResolver
  from "./PresentationResolver.js";

export default class SQLTerminal {
  constructor() {
    this.input =
      null;

    this.executeButton =
      null;

    this.submitButton =
      null;

    this.messageContainer =
      null;

    this.errorContainer =
      null;

    this.resultContainer =
      null;

    this.lastSQL =
      null;

    this.lastExecution =
      null;

    this.onExecuted =
      null;

    this.onSubmitted =
      null;

    this.submissionLocked =
      false;

    this.handleExecuteClick =
      this.handleExecuteClick
        .bind(
          this
        );

    this.handleSubmitClick =
      this.handleSubmitClick
        .bind(
          this
        );
  }

  // =========================================================
  // Init
  // =========================================================

  init() {
    this.input =
      document.getElementById(
        "sql-input"
      );

    this.executeButton =
      document.getElementById(
        "execute-sql"
      );

    this.submitButton =
      document.getElementById(
        "submit-mission"
      );

    this.messageContainer =
      document.getElementById(
        "sql-message"
      );

    this.errorContainer =
      document.getElementById(
        "sql-error"
      );

    this.resultContainer =
      document.getElementById(
        "sql-result"
      );

    this.validateElements();

    this.executeButton
      .addEventListener(
        "click",
        this.handleExecuteClick
      );

    this.submitButton
      .addEventListener(
        "click",
        this.handleSubmitClick
      );

    this.setSubmitEnabled(
      false
    );
  }

  // =========================================================
  // Validate HTML
  // =========================================================

  validateElements() {
    const required = [
      [
        "sql-input",
        this.input,
      ],

      [
        "execute-sql",
        this.executeButton,
      ],

      [
        "submit-mission",
        this.submitButton,
      ],

      [
        "sql-message",
        this.messageContainer,
      ],

      [
        "sql-error",
        this.errorContainer,
      ],

      [
        "sql-result",
        this.resultContainer,
      ],
    ];

    const missing =
      required
        .filter(
          ([, element]) =>
            !element
        )
        .map(
          ([id]) =>
            id
        );

    if (
      missing.length >
      0
    ) {
      throw new Error(
        `SQLTerminal could not find required HTML element(s): ${missing.join(", ")}`
      );
    }
  }

  // =========================================================
  // Execute SQL
  // =========================================================

  handleExecuteClick() {
    const sql =
      this.input
        .value
        .trim();

    this.clearMessages();

    // -------------------------------------------------------
    // Empty SQL
    // -------------------------------------------------------

    if (
      sql === ""
    ) {
      const execution = {
        success:
          false,

        source:
          "player",

        type:
          "error",

        error:
          "Enter a SQL statement before executing.",

        rows:
          [],

        rowsModified:
          0,
      };

      this.lastSQL =
        null;

      this.lastExecution =
        null;

      this.renderError(
        execution.error
      );

      if (
        this.submissionLocked
      ) {
        this.setSubmitEnabled(
          false
        );
      }

      this.onExecuted?.({
        success:
          false,

        sql,

        execution,
      });

      return;
    }

    const execution =
      DatabaseManager
        .executePlayerSQL(
          sql
        );

    // -------------------------------------------------------
    // SQL Failed
    // -------------------------------------------------------

    if (
      !execution.success
    ) {
      this.lastSQL =
        sql;

      this.lastExecution =
        execution;

      this.renderError(
        execution.error
      );

      /*
       * Do not permanently disable Incident
       * submission just because one query had
       * a syntax error.
       */
      if (
        this.submissionLocked
      ) {
        this.setSubmitEnabled(
          false
        );
      }

      this.onExecuted?.({
        success:
          false,

        sql,

        execution,
      });

      return;
    }

    // -------------------------------------------------------
    // SQL Successful
    // -------------------------------------------------------

    this.lastSQL =
      sql;

    this.lastExecution =
      execution;

    this.renderExecution(
      execution
    );

    if (
      this.submissionLocked
    ) {
      this.setSubmitEnabled(
        false
      );
    } else {
      this.setSubmitEnabled(
        true
      );
    }

    this.onExecuted?.({
      success:
        true,

      sql,

      execution,
    });
  }

  // =========================================================
  // Submit Incident Resolution
  // =========================================================

  handleSubmitClick() {
    if (
      this.submissionLocked
    ) {
      return;
    }

    /*
     * database-state Incidents are validated
     * against the actual current DB state.
     *
     * A previous SELECT is therefore not
     * required.
     */
    const execution =
      this.lastExecution ?? {
        success:
          true,

        source:
          "player",

        type:
          "none",

        rows:
          [],

        rowsModified:
          0,
      };

    this.onSubmitted?.({
      sql:
        this.lastSQL,

      execution,
    });
  }

  // =========================================================
  // Render Execution
  // =========================================================

  renderExecution(
    execution
  ) {
    this.resultContainer
      .innerHTML =
      "";

    if (
      execution.type ===
      "query"
    ) {
      this.renderQueryResult(
        execution.rows
      );

      this.messageContainer
        .textContent =
        `${execution.rows.length} row(s) returned.`;

      return;
    }

    this.messageContainer
      .textContent =
      `Command executed successfully. ${execution.rowsModified} row(s) modified.`;
  }

  // =========================================================
  // Render Query Results
  // =========================================================

  renderQueryResult(
    rows
  ) {
    this.resultContainer
      .innerHTML =
      "";

    if (
      !Array.isArray(
        rows
      ) ||
      rows.length === 0
    ) {
      const empty =
        document.createElement(
          "div"
        );

      empty.style.padding =
        "16px";

      empty.style.color =
        "var(--color-text-muted)";

      empty.textContent =
        "Query completed successfully. No rows returned.";

      this.resultContainer
        .appendChild(
          empty
        );

      return;
    }

    const table =
      document.createElement(
        "table"
      );

    const columns =
      Object.keys(
        rows[0]
      );

    // -------------------------------------------------------
    // Header
    // -------------------------------------------------------

    const thead =
      document.createElement(
        "thead"
      );

    const headerRow =
      document.createElement(
        "tr"
      );

    columns.forEach(
      (column) => {
        const th =
          document.createElement(
            "th"
          );

        th.textContent =
          column;

        headerRow.appendChild(
          th
        );
      }
    );

    thead.appendChild(
      headerRow
    );

    table.appendChild(
      thead
    );

    // -------------------------------------------------------
    // Body
    // -------------------------------------------------------

    const tbody =
      document.createElement(
        "tbody"
      );

    rows.forEach(
      (row) => {
        const tr =
          document.createElement(
            "tr"
          );

        columns.forEach(
          (column) => {
            const td =
              document.createElement(
                "td"
              );

            const value =
              row[
                column
              ];

            /*
             * Query Result usually cannot safely
             * determine the originating table,
             * especially for JOINs.
             *
             * Therefore we provide column + row
             * context only.
             */
            td.appendChild(
              PresentationResolver
                .createElement(
                  value,
                  {
                    columnName:
                      column,

                    row,
                  }
                )
            );

            tr.appendChild(
              td
            );
          }
        );

        tbody.appendChild(
          tr
        );
      }
    );

    table.appendChild(
      tbody
    );

    this.resultContainer
      .appendChild(
        table
      );
  }

  // =========================================================
  // Error
  // =========================================================

  renderError(
    message
  ) {
    this.errorContainer
      .textContent =
      message;

    this.resultContainer
      .innerHTML =
      "";
  }

  clearMessages() {
    this.messageContainer
      .textContent =
      "";

    this.errorContainer
      .textContent =
      "";
  }

  // =========================================================
  // Incident Submission State
  // =========================================================

  setSubmissionLocked(
    locked
  ) {
    this.submissionLocked =
      Boolean(
        locked
      );

    if (
      this.submissionLocked
    ) {
      this.setSubmitEnabled(
        false
      );
    }
  }

  isSubmissionLocked() {
    return this.submissionLocked;
  }

  // =========================================================
  // Public API
  // =========================================================

  setSubmitEnabled(
    enabled
  ) {
    if (
      !this.submitButton
    ) {
      return;
    }

    this.submitButton.disabled =
      !enabled;
  }

  setOnExecuted(
    callback
  ) {
    this.onExecuted =
      callback;
  }

  setOnSubmitted(
    callback
  ) {
    this.onSubmitted =
      callback;
  }

  // =========================================================
  // Reset
  // =========================================================

  resetForNextMission() {
    this.lastSQL =
      null;

    this.lastExecution =
      null;

    this.input.value =
      "";

    this.clearMessages();

    this.resultContainer
      .innerHTML =
      "";

    this.setSubmitEnabled(
      false
    );
  }

  // =========================================================
  // Cleanup
  // =========================================================

  destroy() {
    this.executeButton
      ?.removeEventListener(
        "click",
        this.handleExecuteClick
      );

    this.submitButton
      ?.removeEventListener(
        "click",
        this.handleSubmitClick
      );

    this.onExecuted =
      null;

    this.onSubmitted =
      null;

    this.input =
      null;

    this.executeButton =
      null;

    this.submitButton =
      null;

    this.messageContainer =
      null;

    this.errorContainer =
      null;

    this.resultContainer =
      null;
  }
}