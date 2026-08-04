# N-20 — Grip onset fails on multi-prize playfield

**Bottom line:** N-20 was fixed in `observeGrip()` by scanning active manifest prize colliders and selecting the contacted prize; a three-prize secondary-target probe now reaches grip onset and starts the existing hold path. This finding is tracked by [[C-11-post-n43-playfield-regression-fixes]] R1.

## Retain

- N-41's force-based hold model, N-42's delivery semantics, and N-43's manifest/persistence are not implicated; grip onset is a separate gate that predates all three.
- The collision matrix is correct: the prize group includes the sensor in its mask, and the sensor includes the prize in its mask.
- All manifest-spawned prizes use `n38CollisionGroups('prize')`; group membership is uniform and correct.
- `attemptGrip()` already uses `this.selectedPrizeId`; once grip observation updates the contacted prize, the existing attempt path can operate on that prize.

## Caveats

- Root cause is verified from `src/physics/adapter.ts`: `observeGrip()` calls `this.prizeColliders.get(this.selectedPrizeId)`, a single-entry `Map` lookup rather than checking all registered prize colliders.
- `observeCandidateGrip()` on the N37 path has the same single-prize limitation, but it is outside this node's approved R1 scope and must not be changed here.
- The implemented fix is limited to `observeGrip()` in `src/physics/adapter.ts`; the C-11 task packet defines no other R1 source-file changes.
- The scan returns normal no-contact behavior when all prizes have been removed, preserving N-42/N-7 post-delivery fixed-step behavior.

## Do not infer

- Do not infer that N-41 retention is broken; grip onset and hold force are separate systems.
- Do not infer that any manifest prize is inherently un-grabbable; this is a registration/application-layer bug, not a physics limitation.
- Do not infer that the collision matrix needs changes.
- Do not infer that `observeCandidateGrip()` is fixed by this node; its limitation remains a separate follow-up.

## Sources

- User bug report: “passes through the item as if it weren't there” (2026-08-04)
- Idea Flush session: Seed A — grip onset failure
- Source analysis and implementation: `src/physics/adapter.ts` — `observeGrip()` multi-collider scan and active-prize selection (verified 2026-08-04)
- Committed deterministic acceptance fixture: `src/evidence/n20.test.ts` covers all three manifest prizes as contacted targets while a different prize is initially selected; physical contact, grip approval, contacted selection, and hold activation pass for 3/3 fixtures, plus an all-removed no-contact case (2026-08-04)
- Evidence artifact: `records/evidence/n20-grip-onset-multi-prize.json` records 3/3 successful grips
- Regression verification: focused N6/N43/N7 tests 26/26; N-20 tests 2/2; full suite 88/88 across 16 files; `npm run typecheck`, `npm run lint`, and `npm run build` passed (2026-08-04)
- Contract: [[C-11-post-n43-playfield-regression-fixes]] R1
- Task packet: `records/task-packets/C-11-post-n43-playfield-regression-fixes.md` §2 R1, §3 Phase 1
- Outline: [[claw-app-node-contract-outline]] — N-20 and C-11 entries

**Status:** Implemented — verified
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
