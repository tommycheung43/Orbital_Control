import OperationHistoryManager
  from "../game/OperationHistoryManager.js";

export default class OperationHistoryView {
  constructor() {
    this.recentContainer =
      document.getElementById(
        "recent-activity-list"
      );

    this.fullHistoryContainer =
      document.getElementById(
        "history-list"
      );

    this.unsubscribe =
      null;
  }

  // =========================================================
  // Init
  // =========================================================

  init() {
    if (
      !this.recentContainer ||
      !this.fullHistoryContainer
    ) {
      throw new Error(
        "OperationHistoryView could not find required HTML elements."
      );
    }

    this.unsubscribe =
      OperationHistoryManager
        .subscribe(
          () => {
            this.render();
          }
        );

    this.render();
  }

  // =========================================================
  // Main render
  // =========================================================

  render() {
    this.renderRecent();

    this.renderFullHistory();
  }

  // =========================================================
  // Recent Activity
  // =========================================================

  renderRecent() {
    this.recentContainer
      .innerHTML =
      "";

    const entries =
      OperationHistoryManager
        .getRecentEntries(
          5
        );

    if (
      entries.length === 0
    ) {
      const empty =
        document.createElement(
          "div"
        );

      empty.className =
        "activity-empty";

      empty.textContent =
        "Station activity will appear here.";

      this.recentContainer
        .appendChild(
          empty
        );

      return;
    }

    entries.forEach(
      (entry) => {
        const row =
          document.createElement(
            "div"
          );

        row.className =
          `activity-row activity-${entry.severity}`;

        // ---------------------------------------------
        // Time
        // ---------------------------------------------

        const time =
          document.createElement(
            "span"
          );

        time.className =
          "activity-time";

        time.textContent =
          entry.timeLabel;

        // ---------------------------------------------
        // Source
        // ---------------------------------------------

        const source =
          document.createElement(
            "span"
          );

        source.className =
          `activity-source source-${entry.source.toLowerCase()}`;

        source.textContent =
          entry.source;

        // ---------------------------------------------
        // Operation
        // ---------------------------------------------

        const operation =
          document.createElement(
            "span"
          );

        operation.className =
          "activity-operation";

        operation.textContent =
          entry.operation;

        // ---------------------------------------------
        // Target
        // ---------------------------------------------

        const target =
          document.createElement(
            "span"
          );

        target.className =
          "activity-target";

        target.textContent =
          entry.target ??
          "—";

        // ---------------------------------------------
        // Message
        // ---------------------------------------------

        const message =
          document.createElement(
            "span"
          );

        message.className =
          "activity-message";

        message.textContent =
          entry.message;

        row.append(
          time,
          source,
          operation,
          target,
          message
        );

        this.recentContainer
          .appendChild(
            row
          );
      }
    );
  }

  // =========================================================
  // Full History
  // =========================================================

  renderFullHistory() {
    this.fullHistoryContainer
      .innerHTML =
      "";

    const entries =
      OperationHistoryManager
        .getEntries();

    if (
      entries.length === 0
    ) {
      const empty =
        document.createElement(
          "div"
        );

      empty.className =
        "history-empty";

      empty.textContent =
        "No station activity has been recorded yet.";

      this.fullHistoryContainer
        .appendChild(
          empty
        );

      return;
    }

    entries.forEach(
      (entry) => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          `history-entry history-${entry.severity}`;

        // ---------------------------------------------
        // Header
        // ---------------------------------------------

        const header =
          document.createElement(
            "div"
          );

        header.className =
          "history-entry-header";

        const titleGroup =
          document.createElement(
            "div"
          );

        titleGroup.className =
          "history-title-group";

        const source =
          document.createElement(
            "span"
          );

        source.className =
          `history-source-badge source-${entry.source.toLowerCase()}`;

        source.textContent =
          entry.source;

        const operation =
          document.createElement(
            "span"
          );

        operation.className =
          "history-operation-badge";

        operation.textContent =
          entry.operation;

        const target =
          document.createElement(
            "span"
          );

        target.className =
          "history-target";

        target.textContent =
          entry.target ??
          "—";

        titleGroup.append(
          source,
          operation,
          target
        );

        const time =
          document.createElement(
            "time"
          );

        time.className =
          "history-time";

        time.textContent =
          entry.timeLabel;

        header.append(
          titleGroup,
          time
        );

        // ---------------------------------------------
        // Message
        // ---------------------------------------------

        const message =
          document.createElement(
            "div"
          );

        message.className =
          "history-message";

        message.textContent =
          entry.message;

        card.append(
          header,
          message
        );

        // ---------------------------------------------
        // Only PLAYER entries normally
        // contain raw SQL.
        // ---------------------------------------------

        if (
          entry.sql
        ) {
          const sql =
            document.createElement(
              "pre"
            );

          sql.className =
            "history-sql";

          sql.textContent =
            entry.sql;

          card.appendChild(
            sql
          );
        }

        this.fullHistoryContainer
          .appendChild(
            card
          );
      }
    );
  }

  // =========================================================
  // Cleanup
  // =========================================================

  destroy() {
    this.unsubscribe?.();

    this.unsubscribe =
      null;
  }
}