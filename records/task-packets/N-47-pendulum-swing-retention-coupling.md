# N-47 — Functional pendulum: swing shakes marginal grips loose

**Bottom line:** N47 couples the head's real pendulum swing into `RequiredHoldForce`
(F-01) via a versioned, monotone-bounded transfer: the adapter samples head angular
acceleration each fixed step and feeds it into the hold balance (replacing the
stubbed `pendulumSwingAcceleration: 0` constant), so a sharp swing/sudden stop
releases a weak grip while a strong grip holds — deterministically, with no torque
springs and no visual corrections.

## Retain

- The head stays a real spherical-jointed dynamic body (`adapter.ts`,
  `JointData.spherical`, no angular limits) with angular damping `10.0`
  (`config.ts` head section) — the N26 lesson: no torque springs, no per-frame
  angular corrections.
- `RequiredHoldForce` keeps its declared structure (`adapter.ts`
  `holdRequiredForce()`): weight + acceleration slots + packing + `|τ|/leverArm`.
  The pendulum term is the declared slot `pendulumSwingAcceleration`
  (`config.ts` `retention`), now replaced per step by the measured swing input.
- The adapter remains the sole Rapier/step authority and evaluates retention
  every fixed step while holding (`adapter.ts` `step()`,
  `createRetentionState()`). `swingAcceleration` is published on the retention
  state so evidence can trace the term.
- Grip onset (sensor + solver + envelope, `grip-evaluator.ts`) is unchanged; the
  coupling affects retention only, never onset or state transitions.
- The transfer (`config.ts` `swingAccelerationToLinearAcceleration`) is monotone
  non-decreasing in swing magnitude and hard-clamped at
  `maxLinearAcceleration` — a sharp swing at 12V releases (margin −2.23 N),
  the same swing at 36V holds (final margin +46.26 N).
- Fixed-step repeatability holds: two independent weak-grip runs produce
  identical margins and outcomes (`records/evidence/n47-swing-coupling.json`).

## Caveats

- The coupling is bounded by design (`maxLinearAcceleration: 12` m/s², saturating
  at `referenceAngularAcceleration: 40` rad/s²); a swing above saturation cannot
  raise the required force further — this is the `pendulum-unstable` guard, not a
  feel defect.
- The coordinator (`n7-coordinator.ts`) may create the swing through its travel
  profiles (sudden stops at phase boundaries); it was verified to add no scripted
  release — the fixture's release is the physical balance (`hold-margin-negative`).
- N33's own head-feel gate remains recorded `head-feel-failed` (damping-10.0
  candidate); N47 preserves that candidate's envelope byte-for-byte
  (`records/evidence/n33-head-feel.json` unchanged) but does not itself promote N33.
- The swing window is continuous within a run (cleared only on reset): a re-grip
  right after a violent swing inherits the elevated samples for a few steps.
  This is deliberate — the head is genuinely still swinging — and matches the
  physical continuity rule; it was not observed to re-release a 24V default grip.

## Do not infer

- Do not infer the swing term was already live: it was a reserved zero slot; N47
  wired the measured input.
- Do not infer the coupling adds per-frame angular correction or torque feedback —
  it is a read-only feed-forward required-force term (N26 lesson).
- Do not infer any change to the head body strategy (A-01), the spherical joint
  contract, the fixed-step policy, the state machine, or dependencies.

## Sources

- Authoritative contract: N47 (approved 2026-08-05) — matches outline §5 verbatim.
- Outline row: `records/task-packets/todo/N47-N51-feel-rigging-pendulum-speed-ops.md` §5.
- Repo: `src/physics/config.ts`, `src/physics/adapter.ts`, `src/evidence/n47.test.ts`,
  `src/evidence/n47-evidence.ts`, `records/evidence/n47-swing-coupling.json`,
  `records/evidence/n33-head-feel.json`, `records/contracts/fixed-step-policy.md`.
- Contract: [[C-06-retention-physics|C-06 — Retention Physics]] (rev 2, F-07).
- Feature spec: F-07 (§3), §4 retention balance.

**Status:** Implemented — verified (2026-08-05)
**Last checked:** 2026-08-05
**Review by:** 2026-11-05
