# Settlement crew vertical-slice plan

Derived from [the crew audit](settlement-crew-audit.md). The scope is one complete Reactor emergency plus autonomous routine inspection, not a full colony simulator.

| Order | Problem | Change and files | Acceptance |
| --- | --- | --- | --- |
| 0 | Preserve baseline | Keep existing dirty checkout; run tests before and after. | Existing incident, SQL and teacher tests remain green. |
| 1 | Crew are interchangeable | Add deterministic names/roles, engineering skill, health and task status. `SimulationEngine`, new `CrewTaskService` | Multiple eligible candidates with different speed/fatigue trade-offs. |
| 2 | No task-based agency | Generate routine inspection at start and emergency Reactor repair at the incident; allow assign, remove and priority change; progress by tick. `SimulationEngine`, `CrewTaskService`, `StationSession`, `ActionService` | Routine work proceeds automatically; chosen crew repairs Reactor; fatigue/health and station state change. |
| 3 | No crew history in SQL | Extend current `crew` and `crew_roster`; add `tasks` and `crew_task_history` and short examples. `GameplayRepository`, SQL toolkit copy | Current and historical information match authoritative state; SQL cannot assign crew. |
| 4 | No management UI | Add Crew & tasks workspace with task-first candidate list and searchable roster; direct incident CTA. `index.html`, `OperationsApp`, `MissionGuide` | Select task → compare eligible crew → assign in one view. |
| 5 | Same visual language everywhere | Add semantic alert, action, crew and SQL tokens; distinguish task priorities with text and borders; polish narrow layout. `operations.css` | Critical/warning/information and workspace identity visible without color alone. |
| 6 | Regression risk | Tests for eligibility, interruption, deterministic progress, SQL joins/history, legacy repair and UI walkthrough. `tests/station.test.js` | Test suite/build pass; browser confirms complete flow. |

Architectural boundary: `SimulationEngine` owns ticks and consequences; `CrewTaskService` validates player task commands; `StationSession` commits and projects; `GameplayRepository` mirrors state for read-only investigation; `OperationsApp` renders and dispatches. Avoid a framework migration or new dependency.
