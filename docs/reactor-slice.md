# Reactor slice: architecture decision

Date: 2026-09-11. Basis: *Orbital Control Colony-Sim SQL Investigation Feasibility Report*, pp. 28–30 and 35–36. This records implementation choices, not a claim that the full proposed game is complete.

## Scope and state ownership

Keep Phaser/Vite/sql.js. Implement one complete Reactor incident before expanding content. Three modules share four systems; the scenario has three containment choices plus assignment, repair and allocation recovery.

`SimulationEngine` is the authority. `advanceTick` and `executeAction` clone their inputs. UI dispatches through `StationSession`; it does not change a database or simulation object. Session subscription is the small in-process notification boundary. The repository builds a complete replacement database before publishing new state, so a projection failure leaves the current state/database pair intact.

Simulation state, investigation state, UI navigation/time controls, and learning activity records remain separate. `SystemControlService` applies learner commands without SQL prerequisites. Seed, content metadata and commands are included in the exported run.

## Simulation and decisions

- One tick is 5 seconds; the Reactor loses 25% of 100 MW generation at tick 3.
- Baseline load is 90 MW. Industry suspension removes 30 MW; Habitat reduction removes 25 MW. Backup covers the deficit within its output/energy constraints.
- Habitat oxygen falls when underpowered or station supply is insufficient. Crew fatigue and module wear update each tick. Values are clamped and rounded.
- An uncontained incident escalates after 48 ticks. It remains repairable. A contained incident still needs repair; exhausted battery or low Habitat allocation can continue to reduce oxygen.
- Reassignment reserves a rested certified engineer and delays routine work. Repair costs two spares, progresses over the seeded duration and restores generation. Recovery returns curtailed allocations to baseline.
- Each action validates current preconditions, then applies all changes to a new state. Invalid commands leave state untouched. The control panel reveals impacted systems while the database exposes exact results.
- The compressed run ends at 90 ticks or zero oxygen. At least two containment choices are tested across multiple seeds. No unseeded randomness is used by the active runtime.

These numerical values are prototype balancing assumptions, not experimentally validated design conclusions.

## Investigation contract

The repository exposes a per-query byte snapshot to a disposable worker. The worker uses SQL.js, level-aware token validation and single-statement execution. It is terminated after five seconds. Results cap at 300 rows; expensive calculations cannot block the UI thread.

Four learning levels introduce filtering, sorting/aggregation, raw-table joins, then data modification. Beginner views (`current_modules`, `current_backups`, `crew_roster`, `maintenance_history`) keep early queries short while the underlying history remains large. `INSERT`, `UPDATE` and `DELETE` are restricted to validated `work_orders`; all telemetry and configuration tables stay read-only. Active high-priority Reactor work orders shorten repair by one tick, giving DML a visible gameplay result.

An evidence result must include the requested column names and the complete expected record multiset. Additional columns, row ordering and equivalent JOIN/CTE forms are accepted. Missing, duplicate or truncated facts do not qualify. The same query is replayed against modified source facts to reject simple hard-coded answer rows. This is a teaching validator, not an adversarial examination anti-cheat boundary; exact required column aliases remain a documented limitation. Aggregation is supported for exploration, but the initial evidence slots require factual row projections.

Pinning records query ID, question ID, incident and snapshot version for review. Evidence does not gate actions. This keeps SQL as the learner's investigation tool instead of a form to complete before playing.

Investigation automatically pauses. Returning keeps the simulation paused until Resume, preserving a usable decision window. Speed choices are 0.25×, 1× and 2×. Time pressure is controllable.

## Presentation and review

`GameScene` only owns Phaser visuals, lifecycle and frame delivery. `OperationsApp` renders DOM views and dispatches commands. Main-screen copy is deliberately brief; recovery controls, schema and column rules use progressive disclosure following user feedback. Query results use text nodes, native tables and scroll containers. Keyboard operation, visible focus, Escape return and Ctrl+Enter execution are supported.

`MissionGuide` derives the five-stage learner journey from authoritative simulation and investigation state. It does not maintain a second progression state. New runs start paused so the introductory Control and Investigate steps cannot be pre-empted by the incident timer. A query only satisfies the current investigation objective when its snapshot version is at least the latest control version. The session timeline appends queries, evidence and domain events in actual order. Shift Review interprets station, investigation and operational outcomes without an arbitrary numeric score. No research data is transmitted.

## Teacher scenarios and data scale

The local Scenario Builder supports adding, changing and deleting modules, within 3–12 modules and one required Reactor, Habitat and Industry core. It validates ranges, saves locally, and imports/exports JSON. Authentication, roles and shared publishing are deferred behind this configuration boundary because they would add server and account scope without improving the core learning loop.

Default database projection generates 500 historical power and oxygen samples per module, 48 crew records and maintenance history. The default three-module run therefore exceeds 3,000 telemetry rows and rewards filtered SQL instead of visual scanning.

## Migration and deferred work

Old mission and SQL-write modules remain unreferenced for comparison. Do not run the old simulation manager alongside the new session. No dependency or framework migration was added. The accidental `.` ignore rule was removed so new source files appear in Git.

Deferred: secured teacher accounts, shared publishing, multi-event director/cooldowns, Oxygen/Cargo incidents, profile persistence, save import, richer variants and a 15–20 minute run. The usability study and educational effectiveness evaluation require actual participants.

## Verification

`npm test` runs real SQL.js tests for seeded replay, controls without SQL, teacher configuration, large history, state invariants, evidence checks, read-only enforcement and atomic projection failure. Build with `npm run build-nolog`.

Browser checks cover the complete containment→assignment→repair→restore path, worker timeout/recovery, and responsive layout. These checks establish implementation behavior, not learning effectiveness.
