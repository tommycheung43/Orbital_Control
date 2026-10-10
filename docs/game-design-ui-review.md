# Orbital Control — game design and UI review

Date: 2026-09-18  
Reviewed build: `Testing` branch, configurable station controls and progressive SQL curriculum.

## Product goal

The learner should feel responsible for a live orbital station: make a change, investigate its consequences with SQL, respond to an incident, recover the station, and explain the outcome. Teachers should be able to vary the scenario without changing code.

## Findings

### High priority — the game has mechanics but no visible objective chain

The control panel, SQL console, incident actions and repair flow work, but the interface does not tell a learner which part of the loop they are currently in. A player can open any workspace and change values without knowing what a successful shift looks like.

**Impact:** experimentation feels like operating a database demo rather than completing a game scenario.

**Recommendation:** add a persistent mission rail with phases: **Control → Investigate → Stabilize → Recover → Review**. Derive the current objective from actual state and provide one contextual Continue button.

### High priority — actions and SQL learning are weakly connected

SQL levels unlock by syntax use, while operational progress is tracked separately. The player is not explicitly prompted to investigate the change they just made or compare before/after state.

**Impact:** learners may run example queries only to unlock syntax and miss the reasoning loop.

**Recommendation:** make the mission objective point to an appropriate query after a control action. Keep SQL optional for action permissions, but treat successful investigation as visible learning progress.

### High priority — shift review lists events but does not interpret performance

The timeline is auditable, but it does not answer: Did the station recover? Did the learner investigate? What should they practise next?

**Impact:** the loop has a weak ending and limited teaching value.

**Recommendation:** add a compact debrief with system outcome, investigation progress, operational outcome and one next-practice recommendation. Avoid an arbitrary numeric score.

### Medium priority — navigation exposes system structure instead of player intent

Station, System control, Investigate, Shift review and Teacher appear as equal destinations. Teacher tools are visually mixed into the learner flow.

**Impact:** new users must understand the application architecture before understanding the task.

**Recommendation:** keep the existing views, but let the mission rail drive the primary journey. Visually separate Teacher as an authoring route.

### Medium priority — the visual identity is functional but generic

The black-and-green industrial treatment is readable, but resembles a common terminal theme. Most panels use the same weight, so the active objective does not dominate.

**Impact:** the interface lacks a memorable orbital-station identity and clear hierarchy.

**Recommendation:** use a deep orbital-blue base, cyan telemetry signal, amber decision warning and a five-node mission rail as the signature element. Reserve green for confirmed healthy state.

### Medium priority — consequences are either hidden or overly raw

The control panel correctly names affected systems without revealing exact outcomes. However, after an action, feedback is mostly a generic status sentence or raw timeline delta.

**Impact:** the design preserves discovery but does not clearly direct the player to investigate the right domain.

**Recommendation:** show affected-system tags and a contextual investigation prompt, while keeping exact numerical consequences in SQL.

### Low priority — responsive behavior is serviceable but dense

The layout collapses correctly, but the investigation sidebar becomes long and separates the query editor from the current learning goal on small screens.

**Recommendation:** keep the mission rail and current goal above the workspace; collapse reference material below the query editor on narrow screens.

## Proposed playable loop

1. **Control:** change power, oxygen, mode or crew assignment.
2. **Investigate:** run a short query that uses the current SQL level.
3. **Stabilize:** when the Reactor alert appears, choose a containment response.
4. **Recover:** assign an engineer, optionally prioritize a work order with SQL, repair, then restore loads.
5. **Review:** read the interpreted debrief and replay with a different strategy.

SQL remains a reasoning tool rather than an action key. Exact consequences stay discoverable. The mission rail supplies direction without giving away answers.

## Implementation scope

Implement now:

- Derived mission phase and objective service.
- Persistent five-stage mission rail with contextual Continue action.
- Context-aware SQL starter query.
- Debrief cards with qualitative results and next practice.
- Visual hierarchy and palette revision.
- Responsive and keyboard checks.

Defer:

- New incident types.
- Authentication or online teacher publishing.
- Badges, leaderboards or arbitrary scoring.
- Narrative characters and dialogue systems.

## Acceptance criteria

- A first-time learner always sees one clear next objective.
- The primary path can be completed without guessing which workspace to open.
- SQL remains optional for operational permissions but visible in learning progress.
- Review explains outcome and recommends a next attempt.
- Teacher authoring remains available but visually separate.
- Existing simulation, SQL safety and scenario tests remain green.

