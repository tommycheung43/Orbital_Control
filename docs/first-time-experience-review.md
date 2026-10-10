# First-time experience review — implementation result

This review compares the pre-change `Testing` checkout with the implemented first-time flow. The [audit](first-time-experience-audit.md) and [plan](first-time-experience-plan.md) were written before code changes. The checkout already contained uncommitted work from earlier iterations; this pass did not reset it.

| Area | Before | After | Improvement |
| --- | --- | --- | --- |
| First-time clarity | Asked for any control change on a healthy station | Starts paused with a real Habitat power shortfall and one named repair | Player can identify a reason and first action immediately |
| Core gameplay | Control → SQL → alert, mostly explained in text | Repair → observe consequence → query → resume → Reactor decision | First loop is experienced before the full simulation |
| Simultaneous systems | Five navigation choices and six metrics at launch | Station and one repair CTA; SQL appears after repair | Fewer competing choices |
| Main screen | Network, telemetry, actions and activity equally prominent | Current task first; overview and history expandable | Clear task hierarchy |
| Navigation | Control, investigation, review and teacher all top level | Station first; Investigation revealed after repair; other tools in More tools | Advanced functions retained without first-screen clutter |
| SQL UX | Full toolkit and evidence questions present from the start | Level 1 query is prefilled; reference collapsed; evidence appears with an incident | Shorter initial learning path |
| Feedback | Generic status and activity log | Dedicated qualitative consequence after repair, query table with exact reading | Action and result are easier to connect |
| Accessibility | Focus outline existed; small data text and crowded mobile nav | Larger task text, readable body type, semantic status copy, keyboard focus preserved, narrow layout checked | Better scanning and input clarity |
| Maintainability | Active state and UI already separated | Intro objective derives from simulation state; style tokens cover primary surfaces/type/spacing | No separate tutorial state machine |
| Future expansion | Teacher tools, controls and level-4 work orders | Preserved under progressive access | Depth remains available |

## Validation

- Automated: `npm test` passes 24/24, including a real initial shortfall and a teacher scenario without a suitable introductory threshold.
- Production: `npm run build-nolog` passes. Vite reports an existing large-chunk advisory; the build is usable.
- Browser: inspected the initial screen at a narrow viewport, performed the repair, ran the prefilled `SELECT`/`WHERE` query, resumed time, saw the Reactor alert and its three choices, and opened Teacher tools. The browser run is an agent walkthrough, not a human usability study.
- No lint script exists in `package.json`.

## Remaining work

- Run a timed novice usability study with learners and measure time to first correct action and first valid query. The current clarity judgment is an expert review plus browser walkthrough.
- The Phaser/network and legacy CSS still carry dense technical presentation inside optional details. They can be polished after the first-run flow is validated with people.
- Teacher authoring remains local and lacks accounts or permission enforcement. Treat it as a prototype tool.
- The large bundled game/SQL chunk merits a later loading-performance pass, after interaction design stabilizes.

Next development step: observe 3–5 first-time learners completing the repair and SQL handoff, then adjust only the points where they hesitate or misread the next action.
