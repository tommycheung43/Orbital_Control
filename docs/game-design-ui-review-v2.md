# Orbital Control — second game design and UI review

Date: 2026-09-18  
Baseline: five-stage mission rail, progressive SQL, work-order DML and qualitative debrief.

## Confirmed improvements

- The mission rail gives the prototype a readable beginning, middle and end.
- Contextual navigation reduces uncertainty about which workspace to open.
- The orbital-blue visual system creates clearer hierarchy and separates Teacher tools.
- The debrief gives learning feedback without an arbitrary score.
- Desktop and mobile layouts expose the current objective successfully.

## Remaining findings

### High priority — onboarding competes with the live incident timer

New runs start immediately, while the first alert occurs at tick 3. A learner reading the controls can be interrupted before completing the intended Control → Investigate introduction.

**Fix:** begin every new run paused. Let the mission explicitly tell the player when to resume. This makes the first alert a deliberate transition rather than an accidental timeout.

### High priority — an old query can satisfy a new investigation objective

Mission derivation currently checks whether any successful query exists. A learner can query first, make a later control change, and skip investigation of that change.

**Fix:** record the state version on each control command and require a successful query from that version or later.

### Medium priority — containment choices are difficult to compare

The buttons name affected systems, but the choice cards do not consistently communicate response speed and qualitative risk.

**Fix:** add compact impact tags plus a trade-off line such as immediate relief, production cost or reserve risk. Keep exact values hidden for SQL discovery.

### Medium priority — live debrief language overstates success

Before the incident, a healthy station is labelled Stable and operations say No containment choice. Both are technically true but imply an evaluation before the challenge has happened.

**Fix:** distinguish Awaiting incident, Response pending, Recovered and At risk.

### Medium priority — urgent states do not change visual priority

The objective rail remains cyan during an active or escalated incident, so urgency depends entirely on copy.

**Fix:** switch the mission rail edge and current phase to amber during an active incident and red after escalation. Do not add flashing animation.

### Medium priority — skipped phases can look completed

If the player manually resumes before completing onboarding, phase position alone can make Control and Investigate look finished.

**Fix:** calculate completion from actual controls, contextual queries, containment and recovery. Show bypassed phases as missed.

## Second-pass acceptance criteria

- A fresh or restarted run is paused at tick 0.
- A query made before a control change does not complete the Investigate phase.
- Containment cards show affected systems and qualitative trade-offs without exact outcomes.
- Pre-incident review says Awaiting incident and Response pending.
- Active and escalated incidents have distinct, accessible visual signals.
- Bypassed phases are never displayed as completed.
- Existing SQL safety, scenario authoring and simulation behavior remain intact.
