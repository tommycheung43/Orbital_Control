import stationRules
  from "./stationRules.js";

const presentationRules = {
  // =========================================================
  // Literal Values
  // =========================================================

  values: {
    Critical: {
      semantic: "danger",
      label: "CRITICAL",
      icon: "⚠",
    },

    Warning: {
      semantic: "warning",
      label: "WARNING",
      icon: "!",
    },

    Normal: {
      semantic: "success",
      label: "NORMAL",
      icon: "●",
    },

    Active: {
      semantic: "success",
      label: "ACTIVE",
      icon: "●",
    },

    Injured: {
      semantic: "warning",
      label: "INJURED",
      icon: "✚",
    },

    Restricted: {
      semantic: "restricted",
      label: "RESTRICTED",
      icon: "🔒",
    },

    Offline: {
      semantic: "danger",
      label: "OFFLINE",
      icon: "×",
    },

    Disabled: {
      semantic: "muted",
      label: "DISABLED",
      icon: "—",
    },
  },

  // =========================================================
  // NULL
  // =========================================================

  nullValue: {
    semantic: "muted",
    label: "NULL",
    icon: "∅",
  },

  // =========================================================
  // Table-aware rules
  // =========================================================

  tables: {
    modules: {
      oxygen_level: {
        resolve(value) {
          const number =
            Number(value);

          if (
            Number.isNaN(
              number
            )
          ) {
            return null;
          }

          const rules =
            stationRules
              .modules
              .oxygen_level;

          if (
            number <
            rules.criticalBelow
          ) {
            return {
              semantic:
                "danger",

              icon:
                "⚠",

              label:
                String(value),

              description:
                "Critical oxygen level",
            };
          }

          if (
            number <
            rules.warningBelow
          ) {
            return {
              semantic:
                "warning",

              icon:
                "!",

              label:
                String(value),

              description:
                "Low oxygen level",
            };
          }

          return null;
        },
      },

      power_level: {
        resolve(value) {
          const number =
            Number(value);

          if (
            Number.isNaN(
              number
            )
          ) {
            return null;
          }

          const rules =
            stationRules
              .modules
              .power_level;

          if (
            number <
            rules.criticalBelow
          ) {
            return {
              semantic:
                "danger",

              icon:
                "⚠",

              label:
                String(value),

              description:
                "Critical power level",
            };
          }

          if (
            number <
            rules.warningBelow
          ) {
            return {
              semantic:
                "warning",

              icon:
                "!",

              label:
                String(value),

              description:
                "Low power level",
            };
          }

          return null;
        },
      },
    },

    supplies: {
      quantity: {
        resolve(
          value,
          context
        ) {
          const number =
            Number(value);

          if (
            Number.isNaN(
              number
            )
          ) {
            return null;
          }

          const itemName =
            context
              ?.row
              ?.item_name;

          if (
            !itemName
          ) {
            return null;
          }

          const rules =
            stationRules
              .supplies[
                itemName
              ];

          if (
            !rules
          ) {
            return null;
          }

          if (
            number <=
            rules
              .criticalAtOrBelow
          ) {
            return {
              semantic:
                "danger",

              icon:
                "⚠",

              label:
                String(value),

              description:
                `Critical ${itemName} supply`,
            };
          }

          if (
            number <=
            rules
              .warningAtOrBelow
          ) {
            return {
              semantic:
                "warning",

              icon:
                "!",

              label:
                String(value),

              description:
                `Low ${itemName} supply`,
            };
          }

          return null;
        },
      },
    },
  },

  // =========================================================
  // Generic Query Result Rules
  // =========================================================

  columns: {
    oxygen_level: {
      resolve(value) {
        const number =
          Number(value);

        if (
          Number.isNaN(
            number
          )
        ) {
          return null;
        }

        const rules =
          stationRules
            .modules
            .oxygen_level;

        if (
          number <
          rules.criticalBelow
        ) {
          return {
            semantic:
              "danger",

            icon:
              "⚠",

            label:
              String(value),

            description:
              "Critical oxygen level",
          };
        }

        if (
          number <
          rules.warningBelow
        ) {
          return {
            semantic:
              "warning",

            icon:
              "!",

            label:
              String(value),

            description:
              "Low oxygen level",
          };
        }

        return null;
      },
    },

    power_level: {
      resolve(value) {
        const number =
          Number(value);

        if (
          Number.isNaN(
            number
          )
        ) {
          return null;
        }

        const rules =
          stationRules
            .modules
            .power_level;

        if (
          number <
          rules.criticalBelow
        ) {
          return {
            semantic:
              "danger",

            icon:
              "⚠",

            label:
              String(value),

            description:
              "Critical power level",
          };
        }

        if (
          number <
          rules.warningBelow
        ) {
          return {
            semantic:
              "warning",

            icon:
              "!",

            label:
              String(value),

            description:
              "Low power level",
          };
        }

        return null;
      },
    },
  },
};

export default presentationRules;