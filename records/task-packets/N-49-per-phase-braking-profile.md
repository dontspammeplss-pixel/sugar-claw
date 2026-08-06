# N-49 — Per-phase braking profile (F-09): evidence of emergent braking

**Bottom line:** Per N50/A-44 (F-10 middle path, 2026-08-05), braking into
targets is **emergent** from the voltage-derived travel profile — N49 writes
**no braking-specific code**. Its deliverable is evidence: travel decelerates
into targets/endpoints, release does not snap, no overshoot, and the behavior is
fixed-step reproducible — across **all** duration-scheduled phases
(descent/close/lift/return; Eli's braking-scope selection, 2026-08-05), with the
N23 velocity glide untouched.

## Retain

- The voltage-derived profile (`config.ts`, `n50-voltage-rev1`) is the single
  source of braking: at default 24V it reproduces the current `travelProfile`
  byte-for-byte (N48 trace stays green); derived accel caps + `travelTransfer`
  bounds are the braking mechanism.
- `easeInOutCubic` base easing stays (`travel-animator.ts:9-11,71`); evidence
  measures the *effective* velocity profile into targets, not a new easing.
- N23 glide semantics preserved byte-for-byte (`GLIDE_SPEED_X = 1.8` /
  `GLIDE_SPEED_Z = 0.9`, `n7-coordinator.ts:870-871`); glide is excluded from
  the trace assertions.
- Completion stays position-based and epoch-safe (A-40): `positionsMatch` vs
  `tolerances.travel`; the evidence must not introduce duration-based
  completion.
- Determinism (A-27) / no-randomness (A-07): braking outcome fixed-step
  reproducible; two independent runs byte-identical (N48 precedent).
- No new state-machine transitions (C-02), no fixed-step policy change, no new
  dependency (A-33); adapter remains the sole Rapier authority.
- Evidence files: `src/evidence/n49.test.ts` + `n49-evidence.ts`,
  `records/evidence/n49-braking-trace.json` (target gates: deceleration
  visible, no snap, no overshoot, fixed-step repeatable, glide intact).

## Caveats

- N49's shape is fixed by A-44 (middle path). If F-10 had been deferred, N49
  would have been standalone braking code — that branch is closed; do not
  resurrect it without a new decision.
- As-cited line numbers (`n7-coordinator.ts:340-350`) reference a pre-N47
  revision; the easing claim re-verifies via `travel-animator.ts`, but
  coordinator call sites may have shifted (N-48 noted the same drift).
- Emergent braking must not re-open the N42 finger-collider wedge fragility
  (flagged in N-48) — the micro-settle is emergent from accel caps, not a
  scripted hold; release-time collider robustness stays out of N49 scope.
- The `snap-release` / `overshoot` failure results are Eli's visual gates plus
  the measured trace — the trace alone is not a pass.

## Do not infer

- Do not infer N49 adds braking code — A-44 makes braking emergent; N49
  verifies/evidences it (contract item 4).
- Do not infer F-10 is deferred — A-44 chose the middle path; the standalone
  branch is closed.
- Do not infer braking requires a state change, a dependency, or replaces
  easing or glide semantics — stop conditions.
- Do not infer config values are hardcoded — voltage-derived profile and
  clamps are versioned config, dev/ops namespace (C-10).

## Sources

- Authoritative contract: N49 (pasted, 2026-08-05) + A-44 (F-10 middle path).
- Outline row: `records/task-packets/todo/N47-N51-feel-rigging-pendulum-speed-ops.md` §7.
  (Flag: `claw-app-node-contract-outline.md` not found in the vault; packet §7 used as the
  row — same flag as N-48.)
- Decision: `docs/contracts/ADR-F-10-force-source-model.md` (A-44, Revision 5).
- Repo: `src/animation/travel-animator.ts`, `src/effects/n7-coordinator.ts`,
  `src/physics/config.ts`, `records/evidence/n48-speed-trace.json`.
- Contract: [[C-06-retention-physics|C-06 — Retention Physics]] (rev 4).
- Feature spec: F-09/F-10 (§3), §4, §7 #1, §8.

**Status:** Implemented + verified (evidence-only, 2026-08-05) — emergent-braking trace green; full gate green
**Last checked:** 2026-08-05
**Review by:** 2026-11-05

## Verification (2026-08-05)

- Emergent-braking trace GREEN, 6/6 gates:
  `records/evidence/n49-braking-trace.json` (result pass, deterministic).
- Measured braking into target (arrival ≤ 0.03% of peak velocity): descent
  0.0009/4.638 u/s, lift 0.0001/3.411, returnTraverse 0.0006/7.481,
  returnDescent 0.0001/10.345; peak interior, tail monotone, completion
  satisfies the coordinator positionsMatch gate (tolerances.travel) — no snap.
- No overshoot: positions stay within [start, target]; animator returns the
  exact target.
- Config-driven: descent accel sweep 5→10→20 lengthens braking
  1892→1338→946 ms (peak 2.34→3.28→4.64 u/s); no hardcoded durations.
- Fixed-step repeatable: two independent builds byte-identical.
- N23 glide intact: [X,Z] = [1.8, 0.9] recorded, excluded from braking gates.
- Voltage-derived transfer `n50-voltage-rev1` remains pending (ADR open
  question 2, N51) — per A-44 the default 24V profile equals the landed
  `travelProfile` (n48-speed-profile-rev1), so this trace evidences the 24V
  behavior.
- Full gate green: typecheck / lint / 21 files / 96 tests / build.
