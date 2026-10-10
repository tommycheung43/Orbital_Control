# First-time experience audit — 2026-09-19

Scope: active Vite/Phaser entry path, `StationSession`, simulation/actions, mission guide, SQL workspace, teacher builder, `index.html`, and `operations.css`. This is a source review, not a claim of human usability testing. Baseline: 22/22 automated tests pass.

## A. Gameplay problems, ranked

| Severity | Finding | Evidence and player effect |
| --- | --- | --- |
| High | No concrete opening problem | `createInitialState` starts every module at nominal power; `deriveMission` asks for any change. A beginner cannot tell why a change matters. |
| High | Five systems compete in the first 30 seconds | Five navigation destinations, six telemetry cards, a network, operations, a five-step rail and time settings are visible before any event. The player must decode the application before acting. |
| High | Learning order is reversed | Control offers power, oxygen, mode and crew before the game demonstrates one consequence; SQL appears immediately. The intended control → query relationship is explained, not experienced. |
| Medium | Reactor response is buried in a dashboard | Live map receives more visual area than the current task; action choices are in a secondary column. |
| Medium | First action feedback is easy to miss | Generic status message and history compete with metrics; no focused before/after acknowledgement. |
| Medium | SQL workspace opens with advanced reference material | Level track, quick views, write guide, evidence rules, schema and questions appear together. Level 1 itself is appropriately short. |

Current loop: choose a control → query its result → resume → handle Reactor fault → repair → review. Without explanation, the initial arbitrary control has no motivation. Recommended loop: **see one station problem → make one repair → see the consequence → query the details → respond to the next incident**.

## B. UI problems, ranked

| UI element | Current problem | Why it confuses | Change | Priority |
| --- | --- | --- | --- | --- |
| Top navigation | Five equal destinations | No obvious starting place | Show Station first; reveal Investigation after first repair; move controls/teacher into Advanced | High |
| Station screen | Map, six metrics, activity and actions all prominent | Current task has no visual owner | Lead with problem/action; put station overview and history in expandable secondary sections | High |
| Mission rail | Five steps shown before step one | Suggests knowledge of the whole workflow is required | Keep compact current-step cue; hide full route behind a disclosure | High |
| Control screen | Four forms and all modules at once | Encourages arbitrary changes | Point to one introductory power correction; retain full controls as advanced tools | High |
| SQL sidebar | All help categories expanded or in view | The beginner scans rules before trying a query | Put current SQL goal and example beside editor; collapse reference, writes and schema | Medium |
| Time/run controls | Seed and speed visible at launch | Looks like configuration is required | Keep pause after the first action; move speed and seed into run settings | Medium |
| Typography | Monospace everywhere, several 10–12px labels | Long prose and small actions are harder to scan | Use readable sans for body, monospace for SQL/data, larger task text | Medium |
| Feedback | Success text in general status region | Hard to connect change to consequence | Add a dedicated consequence card after the first repair | Medium |

## C–F. Feature decisions

- **Keep visible:** current problem, one recommended action, current objective, time state, short status feedback.
- **Simplify:** station overview, phase guide, incident choices, SQL level guidance and query results.
- **Hide until needed:** full metrics, network, history, evidence questions, all table relationships, full system controls, teacher builder and run settings.
- **Move later:** maintenance `INSERT`/`UPDATE`/`DELETE` remain SQL level 4; multi-table joins remain level 3.
- **Remove:** no working gameplay feature. Remove only duplicated first-screen presentation and low-value decorative emphasis.

## G–J. Design direction

The student is a station operator. The first task is an actual Habitat power shortfall, resolved with one named GUI action. The consequence appears immediately as a qualitative change; SQL then reveals exact values. The Reactor alert remains the first larger trade-off. The main screen has a primary task card and optional overview/history. SQL and advanced controls remain available later. Teachers retain local scenario editing. Risks: initial shortfall changes starting telemetry and must not break deterministic simulation; students might bypass guided actions via advanced tools; extra DOM visibility conditions must stay derived from authoritative state. Verify these with tests and browser flows.

Information tiers: **1** current problem/action/result; **2** station summary, current SQL objective; **3** incident decision and evidence when active; **4** full telemetry, raw tables, histories, controls and teacher authoring. Visual direction: a restrained station shift card with warm fault amber and cool operating blue, readable typography, no flashing. The one aesthetic signature is the task card's vertical status strip, which changes with the actual station state.
