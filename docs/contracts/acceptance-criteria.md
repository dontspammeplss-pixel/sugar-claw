# Acceptance Criteria

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Baseline:** `gate-1-baseline-rev1`

This document defines proof required at later gates. It does not authorize implementing any subsystem now. A prose claim without reproducible evidence is insufficient.

## Contract/state scenarios

1. **Legal sequence:** `booting → ready → aiming → lowering → aligning → gripping → lifting → returning → releasing → result → resetting → ready`.
2. **Illegal commands:** issue every command in every state; no undocumented transition or mutation occurs.
3. **Reset from every state:** baseline and correct post-reset state are restored from each state.
4. **Interrupted run:** reset during lowering, grip evaluation, lifting, and release; stale callbacks cannot advance the new epoch.
5. **Completion normalization:** pose, physics, and asset callbacks produce one normalized event through the effect coordinator; adapters do not promote state.
6. **Local aim:** aim is clamped/stored in `ClawMount`-local **meters**, continuous and bounded (A-09), and converted to world space once.
7. **Replay:** identical command/event sequences produce comparable transition records under the approved determinism policy.
8. **Error recovery:** forced asset and invariant errors follow the documented error/retry/reset paths.

## Scene, rig, and asset scenarios

9. **Hierarchy report:** required parent-child relationships and named pivots are present.
10. **Refresh/remount:** repeated lifecycle operations dispose in the correct order and produce no duplicate registrations, leaks, or transform drift.
11. **Required asset failure:** broken required URL is visible/actionable and cannot enter `ready`.
12. **Pose cycle:** home/raised/lowered/open/closed/reset repeated cycles converge to identical explicit targets without drift.
13. **Transform ownership:** instrumentation finds one writer per controlled transform category.
14. **Coordinate validation:** assets and controlled nodes have finite transforms, expected anchors, dimensions, scale, and orientation.

## Physics scenarios (only after physics decisions are approved)

15. **Idle stability:** resting prize remains within approved position/rotation/jitter tolerance.
16. **Travel bounds:** claw proxy never leaves its legal volume.
17. **Collision matrix:** allowed pairs contact; forbidden pairs do not.
18. **Contact versus overlap:** visual overlap without Rapier contact never produces a grip.
19. **Controlled success:** favorable approved fixture produces the approved success representation.
20. **Controlled failure:** unfavorable approved fixture produces the approved failure behavior.
21. **Physics reset:** positions, velocities, contacts, and sleep state return to baseline.
22. **Repeated run:** identical input/fixture is deterministic or its seeded variance is documented.

## Evidence record

Every scenario record includes baseline revision, scenario ID, input/fixture, expected invariant, actual result, command output/logs, and screenshots/traces when a visual or physics claim is made. Gate promotion requires the relevant evidence artifacts and deterministic checks; narrative review alone cannot pass a gate.

## Gate 1 N1 acceptance

N1 is complete only when:

- all eight contract documents in this directory exist and are internally consistent;
- the open-decision ledger contains every ID A-01 through A-40 exactly once;
- each unresolved choice has a recommendation, rationale/scope, and explicit human-approval status;
- no protected file, dependency, gameplay code, or authority model was changed;
- the human has enough information to approve, amend, or escalate each decision.

The human approved the contract set on 2026-08-01 as Gate 1 baseline revision 1 (`records/approvals/gate-1-baseline-rev1.md`). N1a must still be built to enforce gate evidence and protected-file boundaries before Gate 1 is fully promoted.
