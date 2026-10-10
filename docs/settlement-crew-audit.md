# Settlement and crew audit — 2026-09-19

This review uses the active `Testing` source path, not legacy UI classes. Baseline: 24/24 tests pass. The existing checkout has uncommitted prior work; this pass preserves it.

## Current state and feasibility

| Decision | Finding |
| --- | --- |
| Keep | Deterministic five-second ticks, power/oxygen/maintenance coupling, safe SQL snapshots, four-level curriculum, local teacher scenario builder, the new one-action onboarding. |
| Refactor | The Reactor repair path chooses a specialist automatically; the UI has no task-first assignment. Keep old actions for compatibility but guide players through a visible crew task. |
| Expand | Crew have only code, fatigue, certification and module. Add a role, one task-relevant skill, health, availability and current task. Add task/event history to SQLite. |
| Defer | Mood, social relationships, pathfinding, medical/cargo incident families, broad autonomous AI, permissioned teacher accounts. These would dilute a four-person FYP vertical slice. |

The appropriate colony-sim principle is **routine autonomy with intervention at a specialist bottleneck**. A small work queue and a few legible crew differences create the decision; continuous pathfinding and many personal needs do not. This is a design inference from the project's constraints, informed by [Klei's description of colony resource management](https://support.klei.com/hc/en-us/articles/360029554592-What-is-Oxygen-Not-Included) and the [Against the Storm official wiki's worker assignment model](https://wiki.hoodedhorse.com/Against_the_Storm/Buildings). It is not an attempt to reproduce either game.

## Problems, ranked

1. **High — no meaningful crew choice.** `assign-engineer` selects the least-fatigued certified worker automatically, so the player never compares skill, fatigue or history.
2. **High — SQL cannot explain crew outcomes.** `crew_roster` shows only current placement; there is no task or assignment history.
3. **High — every major UI area has the same cyan panel language.** Alerts, decisions, SQL and crew do not have distinct semantic identities.
4. **Medium — 48 crew are too many to display as cards.** Keep the population for query depth, but show only candidates for the selected task and a searchable roster.
5. **Medium — current first-run is intentionally simple.** Crew must appear after the initial Habitat repair and SQL lesson, or complexity will return to the first minute.

## Minimum useful design

Keep 48 deterministic crew records for investigation depth. Four roles: Engineer (repair), Technician (inspection), Medic (readiness), Operator (routine support). Store name, role, engineering skill 0–3, one certification, fatigue, health, module and current task; derive status from these facts. Health and fatigue matter; morale, traits and shifts are deferred. The first emergency task requires Reactor certification and engineering skill 2. A skilled but tired engineer and a rested medium-skill engineer should both be viable. Exhaustion slows work and costs health deterministically. A routine inspection is assigned automatically; the emergency task requires the player's choice. Priority changes affect speed and fatigue.

Information tiers: dashboard shows available crew count and active emergency; task detail shows eligibility, current fatigue/health and skill; SQL exposes complete roster, task/assignment history and cross-system queries. SQL remains read-only for crew assignment. Level-4 `work_orders` edits remain a separate maintenance-planning mechanic.

## Risks and limits

- Two repair paths can conflict if the legacy buttons and new task both advance. The new task must be cancelled/completed when the legacy repair path runs, and the UI should guide to only one path.
- Reprojecting large history on every tick can slow the browser. Store compact task events, not a full 48-person snapshot each tick.
- A task assigned to an unavailable worker must stop cleanly. Eligibility and status changes require tests.
- Skill/certification variation must leave at least two viable Reactor candidates across seeds.

Recommended loop: **station event → task appears → compare eligible crew → optionally investigate their history in SQL → assign and set priority → watch completion and consequences**. The first Habitat tutorial still precedes this loop.
