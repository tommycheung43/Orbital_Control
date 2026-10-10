# Implementation prompt — gameplay and UI improvement

Improve the existing Orbital Control prototype using the accompanying game-design and UI review as the source of truth.

Build a coherent learner journey around the existing mechanics. Add a persistent five-phase mission rail: **Control, Investigate, Stabilize, Recover, Review**. Derive the current phase and one concise objective from authoritative session state; do not create a second gameplay state machine. Provide a contextual Continue button that opens the correct workspace and, when appropriate, loads a short SQL query relevant to the current objective.

Keep SQL as an investigation tool. Do not require evidence to unlock operational actions. Connect successful control actions, SQL queries, incident containment, repair and restoration to visible mission progress. The objective text may name affected systems but must not reveal hidden numerical consequences.

Improve Shift Review with qualitative debrief cards for system outcome, investigation progress and operational response, plus one specific recommendation for the next run. Do not add an arbitrary score, leaderboard or reward currency.

Refine the UI into an orbital flight-control identity: deep blue-black surfaces, cyan telemetry, amber warnings and green only for confirmed healthy states. The memorable visual element should be the mission rail. Preserve the compact monospace instrumentation style, visible focus, semantic controls, keyboard support and reduced-motion behavior. Visually separate Teacher authoring from the learner journey. Ensure the mission objective remains prominent on mobile while reference material moves below active work.

Reuse the current Phaser, DOM, SQL.js and session architecture. Add focused unit tests for mission derivation and debrief logic. Run all tests, production build and browser checks for the complete learner path. Update documentation to describe the final behavior and limits.
