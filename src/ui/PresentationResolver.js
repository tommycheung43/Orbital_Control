import presentationRules
  from "../data/presentationRules.js";

class PresentationResolver {
  // =========================================================
  // Main Resolver
  // =========================================================

  resolve(
    value,
    context = {}
  ) {
    const normalizedContext = {
      tableName:
        context.tableName ??
        null,

      columnName:
        context.columnName ??
        null,

      row:
        context.row ??
        null,
    };

    // -------------------------------------------------------
    // NULL / undefined
    // -------------------------------------------------------

    if (
      value === null ||
      value === undefined
    ) {
      return {
        isSpecial:
          true,

        rawValue:
          value,

        semantic:
          presentationRules
            .nullValue
            .semantic,

        label:
          presentationRules
            .nullValue
            .label,

        icon:
          presentationRules
            .nullValue
            .icon,

        description:
          "Null database value",
      };
    }

    // -------------------------------------------------------
    // 1. Exact table + column rules
    // -------------------------------------------------------

    const tableRuleResult =
      this.resolveTableRule(
        value,
        normalizedContext
      );

    if (
      tableRuleResult
    ) {
      return this.buildResolvedValue(
        value,
        tableRuleResult
      );
    }

    // -------------------------------------------------------
    // 2. Generic column rules
    // -------------------------------------------------------

    const columnRuleResult =
      this.resolveColumnRule(
        value,
        normalizedContext
      );

    if (
      columnRuleResult
    ) {
      return this.buildResolvedValue(
        value,
        columnRuleResult
      );
    }

    // -------------------------------------------------------
    // 3. Literal value rules
    // -------------------------------------------------------

    const valueRuleResult =
      this.resolveLiteralRule(
        value
      );

    if (
      valueRuleResult
    ) {
      return this.buildResolvedValue(
        value,
        valueRuleResult
      );
    }

    // -------------------------------------------------------
    // Normal value
    // -------------------------------------------------------

    return {
      isSpecial:
        false,

      rawValue:
        value,

      semantic:
        "neutral",

      label:
        String(value),

      icon:
        null,

      description:
        null,
    };
  }

  // =========================================================
  // Exact Table Rule
  // =========================================================

  resolveTableRule(
    value,
    context
  ) {
    const {
      tableName,
      columnName,
    } = context;

    if (
      !tableName ||
      !columnName
    ) {
      return null;
    }

    const tableRules =
      presentationRules
        .tables[
          tableName
        ];

    if (
      !tableRules
    ) {
      return null;
    }

    const columnRule =
      tableRules[
        columnName
      ];

    if (
      !columnRule ||
      typeof columnRule
        .resolve !==
        "function"
    ) {
      return null;
    }

    try {
      return columnRule
        .resolve(
          value,
          context
        );
    } catch (error) {
      console.warn(
        `Presentation rule failed for ${tableName}.${columnName}:`,
        error
      );

      return null;
    }
  }

  // =========================================================
  // Generic Column Rule
  // =========================================================

  resolveColumnRule(
    value,
    context
  ) {
    const {
      columnName,
    } = context;

    if (
      !columnName
    ) {
      return null;
    }

    const rule =
      presentationRules
        .columns[
          columnName
        ];

    if (
      !rule ||
      typeof rule.resolve !==
        "function"
    ) {
      return null;
    }

    try {
      return rule.resolve(
        value,
        context
      );
    } catch (error) {
      console.warn(
        `Presentation column rule failed for ${columnName}:`,
        error
      );

      return null;
    }
  }

  // =========================================================
  // Literal Value Rule
  // =========================================================

  resolveLiteralRule(
    value
  ) {
    const stringValue =
      String(value);

    return (
      presentationRules
        .values[
          stringValue
        ] ??
      null
    );
  }

  // =========================================================
  // Normalize Resolved Object
  // =========================================================

  buildResolvedValue(
    rawValue,
    rule
  ) {
    return {
      isSpecial:
        true,

      rawValue,

      semantic:
        rule.semantic ??
        "neutral",

      label:
        rule.label ??
        String(rawValue),

      icon:
        rule.icon ??
        null,

      description:
        rule.description ??
        null,
    };
  }

  // =========================================================
  // DOM Rendering
  // =========================================================

  createElement(
    value,
    context = {}
  ) {
    const resolved =
      this.resolve(
        value,
        context
      );

    const wrapper =
      document.createElement(
        "span"
      );

    wrapper.className =
      "data-value";

    if (
      resolved.isSpecial
    ) {
      wrapper.classList.add(
        "data-semantic",
        `data-${resolved.semantic}`
      );
    }

    if (
      resolved.description
    ) {
      wrapper.title =
        resolved.description;

      wrapper.setAttribute(
        "aria-label",
        `${resolved.label}. ${resolved.description}`
      );
    }

    // -------------------------------------------------------
    // Icon
    // -------------------------------------------------------

    if (
      resolved.icon
    ) {
      const icon =
        document.createElement(
          "span"
        );

      icon.className =
        "data-icon";

      icon.setAttribute(
        "aria-hidden",
        "true"
      );

      icon.textContent =
        resolved.icon;

      wrapper.appendChild(
        icon
      );
    }

    // -------------------------------------------------------
    // Label
    // -------------------------------------------------------

    const label =
      document.createElement(
        "span"
      );

    label.className =
      "data-label";

    label.textContent =
      resolved.label;

    wrapper.appendChild(
      label
    );

    return wrapper;
  }
}

const presentationResolver =
  new PresentationResolver();

export default presentationResolver;