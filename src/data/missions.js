const missions = [
  {
    id:
      "incident_001",

    title:
      "Oxygen Pressure Anomaly",

    description:
      `Habitation has suffered a critical oxygen pressure failure.

Station environmental monitoring reports that oxygen has fallen below safe operating limits.

Investigate the live database and restore Habitation oxygen to its required operating level.

Required condition:

• Habitation oxygen_level = 80

The station monitoring system will automatically update the module's operational status when conditions change.`,

    hint:
      "Inspect the modules table. UPDATE and WHERE may be useful. You do not need to manually change the status column.",

    type:
      "database-state",

    validationQuery:
      `
        SELECT
          oxygen_level,
          status
        FROM modules
        WHERE module_name = 'Habitation';
      `,

    expectedRows: [
      {
        oxygen_level:
          80,

        status:
          "Normal",
      },
    ],

    reward:
      100,
  },
];

export default missions;