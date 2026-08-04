# N-22 — Claw body descends into chute unconditionally

**Bottom line:** N-42.1's carry-to-delivery motion path (ascend → top traverse → chute-lane descent → release) fires on every grip cycle regardless of hold state, because `beginLift()` in the coordinator's gripping handler is called unconditionally after grip evaluation — the claw body descends into the chute even when no prize is held.

## Retain

- N-42.1's motion path geometry (ascend to Y=2.8, traverse, descent to release at [1.05, 1.87, 0.55]) is correct when a prize is held.
- The state machine transition `{ gripping → gripEvaluated → lifting }` is by design — the claw always retracts after grip evaluation. The bug is that the physical claw follows the full chute-descent path regardless of outcome.
- N-42 delivery semantics and chute sensor are unaffected.

## Caveats

- Root cause is verified from source (`src/effects/n7-coordinator.ts`): `beginLift()` is called on the line immediately after `this.emit({ type: 'gripEvaluated', ... })` with no guard on `attempt.accepted` or `attempt.holdStarted`.
- `beginReturn()` also has no hold guard — the full lift→return→descent cycle executes for every run.
- **Implemented:** `src/effects/n7-coordinator.ts` keeps `beginLift()` and the top traverse on every run for cosmetic arcade behavior, then gates only the chute-descent leg on `physics.carryConstraintActive`. A failed grip emits `returnReached` at the traverse endpoint, avoiding both the chute descent and a lifting/returning stall.
- **Verified:** `src/evidence/n7.test.ts` adds `completes a no-hold cycle without descending into the chute (N-22)` and keeps `keeps the N42.1 return path L-shaped under fixed-step sampling` green. The no-hold fixture records the return phase, requires `lifting`/`returning`/`releasing`, asserts Y ≥ 2.0, and confirms the final claw Y is home height.

## Do not infer

- Do not infer that N-42.1 is wrong; the L-shaped path is correct for delivery. Only its trigger condition is wrong.
- Do not infer that N-42 delivery semantics or chute sensor are affected.
- Do not infer that the state machine needs a new state — the fix is a guard in the coordinator, not a state-machine change.

## Sources

- User bug report: "drops the entire claw even if it doesn't grab anything" / "claw should stay at the top" (2026-08-04)
- Idea Flush session: Seed C — unconditional carry-to-delivery trigger
- Source analysis: `src/effects/n7-coordinator.ts` `advanceEffects()` gripping/returning cases (verified 2026-08-04)
- Related: [[N-42.1-carry-to-delivery-motion-path]], [[N-42-chute-based-win-detection-and-delivery-semantics]]
- Contract: C-11
- Task packet: `records/task-packets/C-11-post-n43-playfield-regression-fixes.md` §2 R3, §3 Phase 3

**Status:** Implemented — verified
**Implementation note:** Q2 resolved by retaining cosmetic lift + top traverse for failed grips and gating only chute descent; no adapter change was needed. Focused N7 suite: 13 tests passed. Focused C-11 gate (`n7.test.ts` + `n43.test.ts`): 14 tests passed; full suite: 16 files / 91 tests passed. `typecheck`, `lint`, focused tests, full tests, and build passed on 2026-08-04.
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
