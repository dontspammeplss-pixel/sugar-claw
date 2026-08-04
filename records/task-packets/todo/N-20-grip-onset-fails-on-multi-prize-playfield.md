# N-20 — Grip onset fails on multi-prize playfield

**Bottom line:** After N-43's multi-prize manifest introduced additional prize bodies, `observeGrip()` in the physics adapter only checks the selected prize's collider — all other prizes are invisible to the grip sensor, causing the claw to pass through them without triggering grip onset.

## Retain

- N-41's force-based hold model, N-42's delivery semantics, and N-43's manifest/persistence are not implicated — grip onset is a separate gate that predates all three.
- The collision matrix is correct (prize group includes sensor in its mask; sensor includes prize in its mask). The bug is in the application-layer check, not the Rapier collision configuration.
- All manifest-spawned prizes use `n38CollisionGroups('prize')` — the group membership is uniform and correct.

## Caveats

- Root cause is verified from source (`src/physics/adapter.ts`): `observeGrip()` calls `this.prizeColliders.get(this.selectedPrizeId)` — a single-entry Map lookup instead of iterating all entries.
- `observeCandidateGrip()` (N37 path) has the same single-prize limitation.
- Fix requires only `observeGrip()` — `attemptGrip()` already uses `this.selectedPrizeId`, which the fix will update to the contacted prize.

## Do not infer

- Do not infer that N-41 retention is broken; grip onset and hold force are separate systems.
- Do not infer that any manifest prize is inherently un-grabbable; this is a registration bug, not a physics limitation.
- Do not infer that the collision matrix needs changes.

## Sources

- User bug report: "passes through the item as if it weren't there" (2026-08-04)
- Idea Flush session: Seed A — grip onset failure
- Source analysis: `src/physics/adapter.ts` — `observeGrip()` single-collider check (verified 2026-08-04)
- Contract: C-11
- Task packet: `records/task-packets/C-11-post-n43-playfield-regression-fixes.md` §2 R1, §3 Phase 1

**Status:** Approved — pending implementation
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
