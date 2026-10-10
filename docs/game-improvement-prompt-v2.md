# Second implementation prompt

Apply the second review to the current Orbital Control build.

Protect the onboarding sequence by starting every new run paused at tick 0. Preserve manual pause, investigation pause and speed behavior. The mission guide should tell the learner when to resume.

Make investigation progress contextual. Record the authoritative state version on successful system-control commands. Consider the Investigate objective complete only when a successful query was executed at or after the latest control version. A query from before the change must not count.

Improve incident decision readability. For every containment option, show affected-system tags, response timing and one qualitative trade-off. Do not expose exact numerical consequences. Preserve existing action validation and mechanics.

Correct live debrief language so a run before its incident reads Awaiting incident and Response pending. Keep Recovered, At risk and next-practice guidance for meaningful states.

Add restrained urgency styling to the mission guide: amber for an active incident and red for an escalated incident. Do not flash or animate. Maintain keyboard support, contrast and the existing responsive layout.

Derive each rail step's completed state from real player actions. If a player bypasses Control or Investigate by resuming early, display the skipped step as missed instead of complete.

Add focused regression tests for paused starts, version-aware investigation, decision metadata and pre-incident debrief language. Run the full test suite, production build and browser verification.
