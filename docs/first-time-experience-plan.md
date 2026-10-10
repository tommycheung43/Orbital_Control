# First-time experience implementation plan

Derived from [the audit](first-time-experience-audit.md). Execute in order; preserve the deterministic simulation, SQL sandbox and local teacher tool.

| Priority | Audit problem | Change and likely files | Risk | User benefit |
| --- | --- | --- | --- | --- |
| 0 | Working baseline | Record 22 passing tests; use the existing `Testing` checkout and keep current uncommitted work. `tests/station.test.js` | Low | Existing features remain reviewable. |
| 1 | No opening problem | Start default/eligible scenarios with a small Habitat power shortfall; derive a specific restoration objective and one GUI action. `SimulationEngine`, `MissionGuide`, `OperationsApp` | Medium: starting metrics change | First click has a reason and a visible result. |
| 2 | Five equal destinations | Keep Station primary, reveal Investigation after the first repair, place system control/teacher/review in an Advanced disclosure. `index.html`, `OperationsApp` | Low: navigation wiring | Less to scan at launch, deeper features retained. |
| 3 | Dashboard owns attention | Put the live task before the network, collapse secondary overview/history and show a focused consequence. `index.html`, `OperationsApp`, `operations.css` | Medium: responsive layout | Problem → action → result becomes legible. |
| 4 | Learning order reversed | Make introductory action lead to investigation; show one SQL objective/example, then reveal incident evidence when applicable. `MissionGuide`, `OperationsApp`, `index.html` | Medium: bypass paths | Teach, try, feedback, next concept. |
| 5 | Repeated style/UI logic | Add a small component helper only where it reduces repeated DOM creation; centralize spacing, type, surface, button and semantic colors. `OperationsApp`, `operations.css` | Low | Easier maintenance and consistent controls. |
| 6 | Small text and responsive clutter | Improve contrast, focus, labels, mobile stacking and reduced-motion support; verify at desktop and narrow viewport. `index.html`, `operations.css` | Low | More readable and keyboard-friendly. |

Acceptance: a fresh run shows one specific Habitat issue and action; clicking it resolves the shortfall and gives immediate feedback; Investigation then becomes prominent; SQL still starts at `SELECT`/`WHERE`; the Reactor incident, repair, teacher editor and advanced controls remain reachable; tests and production build pass. Browser QA should check initial, post-action, SQL, incident and narrow layout states.
