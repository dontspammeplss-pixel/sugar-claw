# N-41 — Force-based retention and mid-carry release

**Bottom line:** N41 replaces binary post-grip retention with a deterministic fixed-step hold balance: voltage/friction determine capacity, declared weight/CoM/grip geometry determine required force and torque, and negative margin produces an observable mid-carry release.

## Retain

- The existing sensor/contact approval remains the pure predicate for **grip onset**; `GripAttempt` now reports `holdStarted`, while no Rapier carry joint is created.
- `GripCapacity` is versioned in `N6_PHYSICS_CONFIG.retention` from the 12–36V voltage curve and pad friction `μ`.
- `RequiredHoldForce` includes declared prize weight, CoM-to-grip-point torque, packing-force and acceleration slots; Phase A pendulum and travel acceleration inputs remain explicitly zero.
- The adapter evaluates retention in its existing fixed `dt = 1/60` step and records voltage, capacity, required force, margin, torque, state, and release step/run ID.
- Negative hold margin produces the deterministic `hold-margin-negative` release event; no random release path exists.
- Centered heavy-prize fixtures hold at 36V; off-center heavy-prize fixtures release and show post-release orientation change.
- The N7 report carries retention state and release evidence; the existing result-copy path receives the distinct reason `it slipped!` and renders “Missed — it slipped! Try again.”
- Verification passed on 2026-08-04: `npm run typecheck`, `npm run lint`, `npm test` (13 files / 83 tests), and `npm run build`.

## Caveats

- N41 does not implement N42 chute-based win detection; result/win semantics remain the next node’s scope.
- `carryConstraintActive`, `jointActive`, and legacy `jointCreated` evidence names remain compatibility projections of active hold/onset state; they no longer indicate a Rapier carry joint.
- The hold keeps the prize aligned with a deterministic adapter-owned impulse correction while the balance decides retention. Pendulum and travel acceleration are reserved slots, not wired inputs, until Phase C.
- The repository has unrelated pre-existing untracked Phase B–E task packets and a modified records README; they were preserved.

## Do not infer

- Do not infer that grip onset is a win; N41 only establishes and retains a hold.
- Do not infer that a negative margin is a random failure; every automatic release carries the negative margin, fixed-step index, and run ID.
- Do not infer that N41 changes the fixed-step policy, collision matrix, state machine, dependencies, or prize persistence.
- Do not infer that a passing full suite means N42 delivery semantics are implemented.

## Sources

- Authoritative user contract: N41 — force-based hold/voltage retention, torque, and distinct release event.
- Repository implementation: `~/Documents/coding_proj/claw_app/src/physics/config.ts`, `src/physics/adapter.ts`, `src/effects/n7-coordinator.ts`, `src/App.tsx`, and `src/evidence/**`.
- Repository contract packet: `~/Documents/coding_proj/claw_app/records/task-packets/N41-N42-retention-core-force-hold-chute-win.md`.
- Cross-link: [[claw-app-node-contract-outline]] → N-17 / C-06 / N-41.

**Status:** Implemented — verified
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
