# Settlement crew review — 2026-09-19

This review checks the active game against the [pre-implementation audit](settlement-crew-audit.md) and [plan](settlement-crew-plan.md). It is a Reactor emergency vertical slice, not a complete settlement simulator.

## Result

| Design question | Before | Now | Assessment |
| --- | --- | --- | --- |
| Is there a crew decision? | Repair auto-selected an engineer. | A Reactor task lists eligible engineers with skill, fatigue and health; the player assigns one and sets priority. | Meaningful, bounded choice. |
| Does the colony act on its own? | Crew were mostly rows in a database. | A Habitat inspection is assigned and completed automatically; an emergency waits for the player. | Establishes a useful autonomy/intervention rhythm. |
| Do choices have consequences? | Crew choice was not visible. | Skill, fatigue and P5 urgency affect work pace; work raises fatigue and can lower health; repair restores generation and affects Reactor wear. | Consequences are deterministic and inspectable. |
| Is SQL still important? | SQL described modules and telemetry. | `crew_roster`, `tasks` and `crew_task_history` expose crew decisions and progress, including joins and history. GUI gives short summaries; SQL provides detail. | Preserves the learning goal. |
| Can players find the next action? | Repair controls were buried in recovery. | The incident links to Crew & tasks; the mission button changes to Resume repair once a worker is assigned. Crew management pauses the clock. | Clearer path, confirmed in browser. |
| Does the UI distinguish urgency? | Most surfaces shared one cyan treatment. | Alert severity, orange action/task, purple crew, and cyan SQL each have distinct treatment plus text labels. | Clearer visual semantics without color alone. |

## Validation

- 29 automated tests pass, including deterministic crew outcomes, eligibility, interruptions, SQL task history, and legacy repair compatibility.
- Browser walkthrough confirmed the opening Habitat action, first SQL query, Reactor alert, containment, paused crew panel, candidate comparison and assignment. Full repair completion and SQL history are covered by the automated integration test; they were not repeated end-to-end in this browser walkthrough.
- Production build and whitespace validation pass.

## Complete playable sequence

1. Restore Habitat power and use a short `SELECT ... WHERE` query to inspect it.
2. Resume time. A Reactor regulator fault reduces generation and creates a repair task. An unrelated Habitat inspection completes automatically.
3. Choose a containment action, such as suspending Industry. The station shows the immediate production trade-off.
4. Open Crew & tasks. Compare certified engineers; a rested medium-skill worker and a tired high-skill worker take different amounts of time. An uncertified worker cannot take the task.
5. Optionally open Investigation and query `crew_roster`; later, use `crew_task_history` and `tasks` to compare assignments and outcomes.
6. Assign an engineer, set priority, then resume time. Progress raises fatigue, and high fatigue can reduce health or interrupt work. Repair restores generation and reduces Reactor wear. The SQL task history records assignment, progress and completion.

The architecture keeps simulation consequences in `SimulationEngine` and `CrewTaskService`, SQL projection in `GameplayRepository`, and presentation in `OperationsApp`. Existing legacy repair actions remain for compatibility but are not the guided route. Legacy UI classes remain unimported; this pass deprecates their use rather than deleting them from a dirty checkout.

## Remaining limits

The prototype has one autonomous routine task and one specialist emergency. There are no schedules, morale, relationships, pathfinding, medical incident, cargo incident, save/resume or teacher accounts. The 48-person roster is deliberately large for SQL filtering, but only eight Reactor-qualified engineers are shown as candidates. Next user test should measure whether players understand the assignment/priority trade-off, can reach task history using the SQL Toolkit, and recognize that returning to Station resumes time. The next content increment should add another task type only after that test.
