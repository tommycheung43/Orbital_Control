import DatabaseManager
  from "../database/DatabaseManager.js";

import PresentationResolver
  from "./PresentationResolver.js";

export default class DatabaseExplorer {
  constructor() {
    this.tableListContainer =
      null;

    this.tableTitle =
      null;

    this.tableInfoContainer =
      null;

    this.selectedTable =
      null;
  }

  // =========================================================
  // Init
  // =========================================================

  init() {
    this.tableListContainer =
      document.getElementById(
        "database-table-list"
      );

    this.tableTitle =
      document.getElementById(
        "database-table-title"
      );

    this.tableInfoContainer =
      document.getElementById(
        "database-table-info"
      );

    this.validateElements();

    this.refresh();
  }

  // =========================================================
  // HTML Validation
  // =========================================================

  validateElements() {
    const required = [
      [
        "database-table-list",
        this.tableListContainer,
      ],

      [
        "database-table-title",
        this.tableTitle,
      ],

      [
        "database-table-info",
        this.tableInfoContainer,
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
      missing.length > 0
    ) {
      throw new Error(
        `DatabaseExplorer could not find required HTML element(s): ${missing.join(", ")}`
      );
    }
  }

  // =========================================================
  // Refresh
  // =========================================================

  refresh() {
    const tableNames =
      DatabaseManager
        .getTableNames();

    // -------------------------------------------------------
    // Selected table may have been deleted.
    // -------------------------------------------------------

    if (
      this.selectedTable &&
      !tableNames.includes(
        this.selectedTable
      )
    ) {
      const deletedTable =
        this.selectedTable;

      this.selectedTable =
        null;

      this.renderTableList(
        tableNames
      );

      this.renderDeletedTableMessage(
        deletedTable
      );

      return;
    }

    this.renderTableList(
      tableNames
    );

    // -------------------------------------------------------
    // Refresh currently selected table.
    // -------------------------------------------------------

    if (
      this.selectedTable
    ) {
      this.renderTable(
        this.selectedTable
      );

      return;
    }

    // -------------------------------------------------------
    // No tables.
    // -------------------------------------------------------

    if (
      tableNames.length === 0
    ) {
      this.tableTitle
        .textContent =
        "No tables available";

      this.tableInfoContainer
        .innerHTML =
        "";

      this.appendMessage(
        "The current database contains no user tables.",
        "var(--color-text-muted)"
      );

      return;
    }

    // -------------------------------------------------------
    // Default state.
    // -------------------------------------------------------

    this.tableTitle
      .textContent =
      "Select a table";

    this.tableInfoContainer
      .innerHTML =
      "";

    this.appendMessage(
      "Select a table from the list to inspect its current live data.",
      "var(--color-text-muted)"
    );
  }

  // =========================================================
  // Deleted Table Message
  // =========================================================

  renderDeletedTableMessage(
    tableName
  ) {
    this.tableTitle
      .textContent =
      "Table no longer exists";

    this.tableInfoContainer
      .innerHTML =
      "";

    this.appendMessage(
      `The previously selected table "${tableName}" no longer exists in the current database. Historical operations may still be reviewed in the Activity Log.`,
      "var(--color-warning)"
    );
  }

  // =========================================================
  // Table List
  // =========================================================

  renderTableList(
    tableNames
  ) {
    this.tableListContainer
      .innerHTML =
      "";

    if (
      tableNames.length === 0
    ) {
      const empty =
        document.createElement(
          "div"
        );

      empty.style.color =
        "var(--color-text-soft)";

      empty.style.fontSize =
        "12px";

      empty.textContent =
        "No tables found.";

      this.tableListContainer
        .appendChild(
          empty
        );

      return;
    }

    tableNames.forEach(
      (tableName) => {
        const entry =
          document.createElement(
            "div"
          );

        entry.className =
          "database-table-entry";

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "database-table-button";

        button.textContent =
          tableName;

        if (
          tableName ===
          this.selectedTable
        ) {
          button.classList
            .add(
              "selected"
            );
        }

        button.addEventListener(
          "click",
          () => {
            this.selectTable(
              tableName
            );
          }
        );

        entry.appendChild(
          button
        );

        // ---------------------------------------------------
        // Column Preview
        // ---------------------------------------------------

        try {
          const columns =
            DatabaseManager
              .getTableColumns(
                tableName
              );

          if (
            columns.length >
            0
          ) {
            const columnList =
              document.createElement(
                "div"
              );

            columnList.className =
              "database-column-list";

            columnList.textContent =
              columns
                .map(
                  (column) =>
                    column.name
                )
                .join(
                  ", "
                );

            entry.appendChild(
              columnList
            );
          }
        } catch (error) {
          console.warn(
            `Unable to inspect columns for table "${tableName}":`,
            error
          );
        }

        this.tableListContainer
          .appendChild(
            entry
          );
      }
    );
  }

  // =========================================================
  // Select Table
  // =========================================================

  selectTable(
    tableName
  ) {
    if (
      !DatabaseManager
        .tableExists(
          tableName
        )
    ) {
      this.refresh();

      return;
    }

    this.selectedTable =
      tableName;

    this.renderTableList(
      DatabaseManager
        .getTableNames()
    );

    this.renderTable(
      tableName
    );
  }

  // =========================================================
  // Render Table
  // =========================================================

  renderTable(
    tableName
  ) {
    if (
      !DatabaseManager
        .tableExists(
          tableName
        )
    ) {
      this.refresh();

      return;
    }

    this.tableTitle
      .textContent =
      tableName;

    this.tableInfoContainer
      .innerHTML =
      "";

    try {
      const columns =
        DatabaseManager
          .getTableColumns(
            tableName
          );

      const rows =
        DatabaseManager
          .getTableData(
            tableName
          );

      this.renderSchemaSummary(
        columns
      );

      this.renderDataTable(
        tableName,
        columns,
        rows
      );
    } catch (error) {
      console.error(
        `Failed to render table "${tableName}":`,
        error
      );

      this.appendMessage(
        `Unable to load table: ${error.message}`,
        "var(--color-danger)"
      );
    }
  }

  // =========================================================
  // Schema Summary
  // =========================================================

  renderSchemaSummary(
    columns
  ) {
    const summary =
      document.createElement(
        "div"
      );

    summary.style.padding =
      "12px";

    summary.style.background =
      "var(--color-surface-2)";

    summary.style.borderBottom =
      "1px solid var(--color-border)";

    summary.style.fontFamily =
      "var(--font-code)";

    summary.style.fontSize =
      "12px";

    const heading =
      document.createElement(
        "div"
      );

    heading.style.marginBottom =
      "8px";

    heading.style.color =
      "var(--color-text-muted)";

    heading.style.fontWeight =
      "700";

    heading.textContent =
      "Schema";

    summary.appendChild(
      heading
    );

    const list =
      document.createElement(
        "div"
      );

    list.style.display =
      "flex";

    list.style.flexWrap =
      "wrap";

    list.style.gap =
      "8px";

    columns.forEach(
      (column) => {
        const item =
          document.createElement(
            "span"
          );

        item.style.padding =
          "3px 7px";

        item.style.border =
          "1px solid var(--color-border)";

        item.style.borderRadius =
          "4px";

        item.style.color =
          "var(--color-text-muted)";

        let label =
          column.name;

        if (
          column.type
        ) {
          label +=
            ` : ${column.type}`;
        }

        if (
          column.pk === 1
        ) {
          label +=
            " [PK]";
        }

        if (
          column.notnull ===
          1
        ) {
          label +=
            " [NOT NULL]";
        }

        item.textContent =
          label;

        list.appendChild(
          item
        );
      }
    );

    summary.appendChild(
      list
    );

    this.tableInfoContainer
      .appendChild(
        summary
      );
  }

  // =========================================================
  // Data Table
  // =========================================================

  renderDataTable(
    tableName,
    columns,
    rows
  ) {
    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.style.overflow =
      "auto";

    if (
      rows.length === 0
    ) {
      const empty =
        document.createElement(
          "div"
        );

      empty.style.padding =
        "18px";

      empty.style.color =
        "var(--color-text-soft)";

      empty.textContent =
        "This table currently contains no rows.";

      wrapper.appendChild(
        empty
      );

      this.tableInfoContainer
        .appendChild(
          wrapper
        );

      return;
    }

    const table =
      document.createElement(
        "table"
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
          column.name;

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
                column.name
              ];

            td.appendChild(
              PresentationResolver
                .createElement(
                  value,
                  {
                    tableName,
                    columnName:
                      column.name,
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

    wrapper.appendChild(
      table
    );

    this.tableInfoContainer
      .appendChild(
        wrapper
      );
  }

  // =========================================================
  // Generic Message
  // =========================================================

  appendMessage(
    message,
    color =
      "var(--color-text-muted)"
  ) {
    const element =
      document.createElement(
        "div"
      );

    element.style.padding =
      "16px";

    element.style.color =
      color;

    element.style.lineHeight =
      "1.6";

    element.textContent =
      message;

    this.tableInfoContainer
      .appendChild(
        element
      );
  }

  // =========================================================
  // Cleanup
  // =========================================================

  destroy() {
    this.selectedTable =
      null;

    this.tableListContainer =
      null;

    this.tableTitle =
      null;

    this.tableInfoContainer =
      null;
  }
}