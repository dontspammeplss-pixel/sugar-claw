# N-21 — Drop button front-edge dead zone

**Bottom line:** N-21 is fixed by clamping the X/Z values read from the kinematic claw transform before deriving the lowering target; without that clamp, the deterministic four-corner regression reaches `error` at a travel edge, while the patched path accepts Drop and begins descent.

## Retain

- Claw descent itself works correctly—speed, collision, and sequencing—when the drop fires.
- The controller transition `{ aiming → confirmDrop → lowering }` is always legal; no state-based rejection is implicated by the current analysis.
- Travel bounds, including `z: [-0.35, 0.55]`, and the `moveClaw()` bounds check appear correct on static analysis.
- `beginLowering()` now derives a target from clamped current X/Z values and the configured interaction Y; the static derivation is in bounds before `moveClaw()` is called.

## Caveats

- **Root cause is verified deterministically:** at nominal travel-bound corners, Rapier's f32 kinematic read-back can produce an edge coordinate that fails the adapter's strict bounds comparison; `beginLowering()` then rejects the derived target and the accepted command enters invariant failure. Reversing the clamp reproduces the N-21 test failure; restoring it passes.
- Live-app confirmation remains pending: the browser automation attempts failed inside the tool before interaction, although the local Vite server returned HTTP 200.
- The task packet permits `src/effects/n7-coordinator.ts` and, only if evidence requires it, `src/physics/adapter.ts`. Any broader file scope requires a C-11 revision.
- The authoritative contract is `records/task-packets/C-11-post-n43-playfield-regression-fixes.md`; no stale todo copy is used.

## Do not infer

- Do not infer that descent physics, collision handling, or claw close/open behavior is broken; only the drop trigger is affected.
- Do not infer that the state machine rejects `confirmDrop` from `aiming`.
- Do not infer that this is related to the carry-to-delivery path (R3); manual free-positioning descent is separate from post-grip return.
- Do not infer that the browser-visible rendering path has been independently confirmed; the deterministic evidence verifies the transform/bounds failure mechanism, while live UI confirmation remains pending.

## Sources

- User bug report: “claw moved too close to the front of the machine and the drop action is pressed, it does not move” (2026-08-04)
- Idea Flush session: Seed D — manual drop button during free positioning
- Source analysis and fix: target repo `src/effects/n7-coordinator.ts` — `beginLowering()` clamps current X/Z to `travelBounds`; `src/physics/adapter.ts` — strict `moveClaw()` bounds check (2026-08-04)
- Deterministic regression evidence: `src/evidence/n7.test.ts` test `accepts Drop at all four travel-bound corners and mid-field (N-21)` drives front-left, back-left, front-right, back-right, and mid-field positions, then verifies accepted Drop, `lowering`, an in-bounds X/Z target, and a descent step (2026-08-04)
- Deterministic diagnosis: before the clamp was added, the edge path was reproduced as an invariant failure; the test now guards the corrected behavior.
- Focused verification: `npx vitest run src/evidence/n7.test.ts` — 1 file passed, 11 tests passed (2026-08-04)
- Project verification: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` passed; full suite 16 files / 89 tests passed (2026-08-04)
- Live-app verification: not completed; browser automation failed before interaction after local Vite returned HTTP 200 (2026-08-04)
- Contract: [[C-11-post-n43-playfield-regression-fixes]] R2
- Task packet: authoritative reference `records/task-packets/C-11-post-n43-playfield-regression-fixes.md` §2 R2, §3 Phase 2, §4 item 2, §5, §6 item 2, §8 R2, §10 question 1, and §11 Phase 2
- Outline: [[claw-app-node-contract-outline]] — N-21 and C-11 entries

**Status:** Implemented — deterministic verification passed; live-app confirmation pending
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
