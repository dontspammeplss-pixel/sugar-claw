# N-23 — Reset does not restore prize positions

**Bottom line:** The reset button re-homes the claw but fails to restore prizes to their manifest-authored positions because `reset()` in the physics adapter reloads prize state from the persistence store instead of clearing it — nudged positions survive both reset and `npm run dev` restarts.

## Retain

- Claw re-home on reset works correctly (restoreBaselinePose).
- N-43's persistence mechanism (revision-keyed save/restore) is not itself broken; `reset()` is designed to resume state, but the reset handler never clears the save before calling `reset()`.
- The manifest-baseline fallback path (`else if (baseline)`) in `reset()` is correct — it restores prizes to authored positions when no persisted state exists. It's just never reached because persistence is never cleared.

## Caveats

- Root cause is verified from source: `reset()` calls `this.prizePersistence.load(this.prizeManifest.revision)` and then `this.savePrizeState()` at the end, creating a save→load→save cycle that preserves nudged positions.
- **Implemented:** `resetTransaction()` in `src/effects/n7-coordinator.ts` calls `clearPrizePersistence(this.physics.playfield.manifestRevision)` immediately before `this.physics.reset()`. The startup/create-time `this.physics.reset()` remains unchanged, so resume-on-startup behavior is preserved. No adapter or persistence-format change was needed; after the clear, the existing adapter manifest-baseline branch restores all prize positions and flags, and the existing reset bookkeeping clears delivered IDs.
- **Verified:** `src/evidence/n7.test.ts` adds `clears persisted prize positions and flags on coordinator reset (N-23)`. It nudges a multi-prize manifest, confirms a fresh adapter resumes the nudge, seeds persisted won/removed flags, dispatches `requestReset`, checks every prize against its authored baseline within tolerance, and confirms a fresh adapter reloads baselines with flags cleared.

## Do not infer

- Do not infer that persistence is generally broken; only the reset-triggered clear path is missing.
- Do not infer that the manifest or revision-keying logic needs to change; the clear+reload operation is the only gap.
- Do not infer that won/removed prize tracking is broken; delivery removal still works.

## Sources

- User bug report: "reset button does not reset the items... prizes stay stuck" / "claw goes back to its original position, but the prizes stay stuck" (2026-08-04)
- Idea Flush session: Seed B — reset partial (claw only)
- Source analysis: `src/physics/adapter.ts` `reset()`, `src/effects/n7-coordinator.ts` `resetTransaction()` (verified 2026-08-04)
- Related: [[N-43-multi-prize-manifest-and-persistent-playfield]]
- Contract: C-11
- Task packet: `records/task-packets/C-11-post-n43-playfield-regression-fixes.md` §2 R4, §3 Phase 3

**Status:** Implemented — verified
**Implementation note:** Q3 resolved with a direct coordinator call to the existing `clearPrizePersistence` export; no adapter change was needed. Focused N7 suite: 13 tests passed. Focused C-11 gate (`n7.test.ts` + `n43.test.ts`): 14 tests passed; full suite: 16 files / 91 tests passed. `typecheck`, `lint`, focused tests, full tests, and build passed on 2026-08-04.
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
