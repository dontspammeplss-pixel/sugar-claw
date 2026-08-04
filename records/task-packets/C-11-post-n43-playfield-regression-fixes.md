# Contract Packet — C-11: Post-N43 playfield regression fixes

> Four user-visible regressions introduced by or uncaught after N-43
> (multi-prize manifest). Fixes grip onset (R1), drop dead zone (R2), chute
> dive (R3), and reset (R4) in dependency order.
> **Status:** Partially implemented — R1/R2/R3/R4 deterministic gates pass; live-app confirmation pending (2026-08-04).
> **Baseline:** `main` (post-N43; N-41/N-42/N-42.1/N-43 gates green).
> **Source:** Idea Flush session + live-app observation by Eli (2026-08-04).
> **Vault contract:** `C-11 — Post-N43 playfield regression fixes` (approved).
> **Vault nodes:** N-20 (R1), N-21 (R2), N-22 (R3), N-23 (R4).
> **Authority:** physics + coordinator (C-06, C-07, C-08 joint).

---

## 1. Observed vs. expected

| Seed   | Observed                                                                                         | Expected                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **R1** | Claw descends and passes through all three manifest-spawned prizes as if they aren't there       | Claw contacts any reachable prize → grip onset fires                                        |
| **R2** | Pressing drop near front of machine → claw doesn't move, appears stuck. Drop works near back     | Drop triggers descent from any XY within playfield chamber bounds                           |
| **R3** | Claw body descends into chute even when no prize is held                                         | Claw stays at home Y elevation (~2.8); carry-to-delivery path only fires when prize is held |
| **R4** | Reset re-homes claw but prizes stay in nudged positions. Positions survive `npm run dev` restart | Reset clears persisted prize state, reloads manifest-authored spawn layout for all prizes   |

## 2. Root cause analysis

### R1 — Grip onset failure on manifest prizes

- **[verified]** `observeGrip()` (`src/physics/adapter.ts`) only calls
  `this.prizeColliders.get(this.selectedPrizeId)` — a single-collider
  intersection check. When N-43 added multi-prize support, `observeGrip()` was
  not updated to iterate all prize colliders. The grip sensor only ever checks
  the selected prize; any other prize is invisible to the onset evaluator.
- **[verified]** `attemptGrip()` also only uses `this.selectedPrizeId` to
  identify the prize body for hold setup.
- **[verified]** All manifest-spawned prizes use `n38CollisionGroups('prize')`
  (group `1<<1`, mask includes `sensor 1<<4`) — the collision matrix is correct.
  The grip sensor CAN see prizes; `observeGrip()` just doesn't ask it to check
  all of them.
- **[verified]** `observeCandidateGrip()` has the same single-prize limitation
  for the N37 profile path.

### R2 — Drop button front-edge dead zone

- **[verified]** `moveClaw()` intentionally enforces inclusive strict bounds, but
  Rapier's f32 kinematic read-back can return an edge coordinate marginally
  outside the bound after a legal edge move (for example, `z = 0.55000001`).
- **[verified]** `beginLowering()` previously copied the read-back X/Z directly
  into its target. The legal `confirmDrop` transition then entered invariant
  failure when `moveClaw(target)` rejected that marginal coordinate.
- **[fixed]** `beginLowering()` now clamps current X and Z to
  `this.physics.config.travelBounds` before deriving the target. Y remains
  `N6_PHYSICS_CONFIG.clawClearance.baseInteractionY`; `moveClaw()` and all
  descent physics remain unchanged.
- **[verified]** The controller transition `{ from: 'aiming', event:
'confirmDrop', to: 'lowering' }` remains legal. `src/evidence/n7.test.ts`
  covers all four travel-bound X/Z corners plus a mid-field control.

### R3 — Claw body descends into chute unconditionally

- **[verified]** In `advanceEffects()` gripping case (`src/effects/n7-coordinator.ts`),
  `beginLift()` is called **unconditionally** after `attemptGrip()`. The grip
  outcome is stored (accepted/rejected) but does not gate the lift.
- **[verified]** The state machine (`src/state/controller.ts`) always transitions
  `gripping → gripEvaluated → lifting` regardless of grip outcome. The full
  lift → return → chute-descent → release cycle always executes.
- **[verified]** `beginReturn()` starts travel to `chute.overPosition` (Y=2.8
  top traverse) then `chute.releasePosition` (Y=1.87 descent) — the N-42.1
  L-shaped path is correct but fires for every run.
- **Root cause:** No hold-active guard on the carry-to-delivery path. When grip
  fails, the claw still executes the full lift/return/descent cycle, ending with
  the claw body at the chute release position (Y=1.87).

### R4 — Reset does not restore prize positions

- **[verified]** `reset()` in `src/physics/adapter.ts` loads from persistence:
  `this.prizePersistence.load(this.prizeManifest.revision)`. If a save exists,
  it restores prizes to persisted (nudged) positions.
- **[verified]** `reset()` calls `this.savePrizeState()` at the end, re-saving
  the loaded state — persistence is never cleared.
- **[verified]** `resetTransaction()` in `src/effects/n7-coordinator.ts` calls
  `this.physics.reset()` but does not clear the persistence store beforehand.
  The claw re-homes correctly (restoreBaselinePose), but prizes reload from
  whatever was last saved.
- **Root cause:** `reset()` is designed to resume state, not clear it. The
  reset handler must explicitly clear persistence before calling `reset()`, then
  `reset()` will fall through to the manifest-baseline path (since no persisted
  state will be found).

## 3. Minimal-change plan

### Phase 1 — R1 (Seed A)

**Files:** `src/physics/adapter.ts`

**Change:** In `observeGrip()`, iterate all `this.prizeColliders` entries
instead of only `this.selectedPrizeId`. When sensor intersection is found with
any prize collider, set `this.selectedPrizeId` to that prize's ID and proceed.

**Diff sketch:**

```text
observeGrip():
-  const activePrizeCollider = this.prizeColliders.get(this.selectedPrizeId)
-  if (!activePrizeCollider) throw ...
-  const physicalContact = this.world.intersectionPair(this.sensorCollider, activePrizeCollider)
+  let physicalContact = false
+  let contactedPrizeId: string | null = null
+  let activePrizeCollider: RAPIER.Collider | null = null
+  for (const [id, collider] of this.prizeColliders) {
+    if (!this.prizeState.get(id) || this.prizeState.get(id)!.removed) continue
+    if (this.world.intersectionPair(this.sensorCollider, collider)) {
+      physicalContact = true
+      contactedPrizeId = id
+      activePrizeCollider = collider
+      break
+    }
+  }
+  if (contactedPrizeId) this.selectedPrizeId = contactedPrizeId
+  if (!activePrizeCollider) activePrizeCollider = this.prizeColliders.get(this.selectedPrizeId)!
```

**What stays untouched:** Collision matrix, collision groups, sensor geometry,
retention model (N-41), delivery semantics (N-42), `attemptGrip()` hold setup
(already uses `this.selectedPrizeId` — which will now be the contacted prize).

### Phase 2 — R2 (Seed D)

**Files:** `src/effects/n7-coordinator.ts`, `src/evidence/n7.test.ts`

**Change:** In `beginLowering()`, clamp the current claw X/Z read-back into
`this.physics.config.travelBounds` before building the lowering target. Keep the
inclusive `moveClaw()` bounds check and the configured interaction Y unchanged.
The committed N-21 regression fixture exercises all four corners and a
mid-field control.

### Phase 3 — R3 + R4 (Seeds C + B)

**Files:** `src/effects/n7-coordinator.ts`, `src/physics/adapter.ts`,
`src/playfield/prize-persistence.ts`

**R3 change:** Keep the cosmetic lift and top traverse for every run, then gate
only chute descent on `physics.carryConstraintActive`. When grip fails, emit
`returnReached` at the traverse endpoint so the state machine completes without
entering the chute lane or stalling.

**Diff sketch (R3):**

```text
'gripping' case:
   this.emit({ type: 'gripEvaluated', outcome, runId })
-  this.beginLift()
+  if (attempt.accepted || attempt.holdStarted) {
+    this.beginLift()
+  }

'returning' case, returnLeg === 'traverse' reached:
+  if (this.physics.carryConstraintActive) {
     // N-42.1: descend to chute release position
     const descentTarget = N6_PHYSICS_CONFIG.chute.releasePosition
     ...
+  } else {
+    // No hold: skip chute descent; go straight to releaseComplete
+    this.emit({ type: 'returnReached', runId })
+  }
```

**R4 change:** In `resetTransaction()` in `n7-coordinator.ts`, call
`clearPrizePersistence(this.physics.playfield.manifestRevision)` before
`this.physics.reset()`. The adapter's existing no-persisted-state manifest
baseline branch restores authored positions; its existing reset bookkeeping
clears delivered IDs and restores won/removed flags. No adapter change was
needed.

**Diff sketch (R4):**

```text
resetTransaction():
+  this.physics.clearPersistence()    // new method or use existing clearPrizePersistence
   this.physics.reset()
```

And in adapter.ts:

```text
reset():
-  const persisted = this.persistPrizeState
-    ? this.prizePersistence.load(this.prizeManifest.revision)
-    : null
+  // Persistence must be cleared before reset by the coordinator.
+  // If a save still exists (e.g., direct adapter use), load it.
+  const persisted = this.persistPrizeState
+    ? this.prizePersistence.load(this.prizeManifest.revision)
+    : null
```

Then add a `clearPersistence()` method to the adapter:

```text
clearPersistence(): void {
  this.prizePersistence.clear(this.prizeManifest.revision)
}
```

**What stays untouched (R3+R4):** State machine (no new states), N-42.1 motion
path geometry, delivery semantics, chute sensor, win predicate, persistence
format, revision-keying logic, manifest schema, winnings tracking.

## 4. Contract

1. **R1:** `observeGrip()` checks all non-removed manifest-spawned prize
   colliders for sensor intersection. The first contacted prize becomes the
   selected prize. Grip onset works for any reachable prize.
2. **R2:** Drop button triggers descent from any XY position within
   `travelBounds`. No positional dead zone.
3. **R3:** The claw only executes the carry-to-delivery motion path (lift →
   chute traverse → descent → release) when a hold is active. Without a hold,
   the claw returns to home without descending into the chute. The finger-open
   animation still plays during `releasing` state (cosmetic).
4. **R4:** Reset clears the player persistence record, restores all prizes to
   manifest-authored spawn positions, re-homes the claw, and resets won/removed
   flags. Subsequent `npm run dev` restarts load the manifest layout (fresh
   state), not nudged positions.
5. **Regression:** All existing N-41/N-42/N-42.1/N-43 tests pass. No protected
   boundary is crossed.

## 5. Failure results

- **R1:** `grip-onset-single-prize-only`: `observeGrip()` only checks one prize
  when multiple are on the playfield.
- **R2:** `drop-front-dead-zone`: `confirmDrop` accepted but claw does not
  descend near front wall.
- **R3:** `chute-dive-no-hold`: claw Y descends below 2.0 during return with no
  active hold.
- **R4:** `reset-prizes-stuck`: after reset, any prize position differs from
  manifest-authored position beyond travel tolerance.

## 6. Evidence required

1. **R1 fixture:** Multiple prizes on playfield. Claw descends over each →
   grip onset fires for each (3 grips, 3 fixtures). No pass-through.
2. **R2 fixture:** `src/evidence/n7.test.ts` test
   `accepts Drop at all four travel-bound corners and mid-field (N-21)` moves
   the claw to all four travel-bound X/Z corners and a mid-field control,
   dispatches Drop, and verifies accepted `lowering` with an in-bounds target
   and descent step.
3. **R3 fixture:** Run a cycle without gripping any prize → claw returns to
   home Y (~2.8). Claw Y never drops below 2.0 during return.
4. **R4 fixture:** Nudge a prize. Press reset. All prizes at manifest-authored
   positions. Restart dev server → prizes at manifest positions.
5. **Regression gate:** Current implementation gate is green: 16 test files / 89 tests;
   `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass.
6. **Live-app check:** R1: claw contacts any prize → grip; R2: drop from all
   playfield corners; R3: claw never dives into chute without prize; R4: reset
   restores manifest positions; restart confirms.

## 7. Regression risk + test plan

- **R1 risk:** Changing `observeGrip()` to iterate all prize colliders adds a
  loop per call. `observeGrip()` is called once per `attemptGrip()` (infrequent)
  and once per `step()` (every fixed step — 60 Hz). For 3 prizes this is
  negligible. Mitigation: break on first contact.
- **R1 risk:** Setting `this.selectedPrizeId` inside `observeGrip()` could have
  side effects on downstream code that reads `selectedPrizeId`. Mitigation: only
  set when contact is found; preserve existing behavior when no contact.
- **R3 risk:** Gating only the descent avoids the stale-target stall risk. Failed
  grips still run `beginLift()` and `beginReturn()`; once the traverse reaches
  `chute.overPosition`, the coordinator emits `returnReached` directly when no
  hold is active.
- **R4 risk:** Clearing persistence on reset means nudged-play strategies can't
  survive a reset — this is intentional (the reset button should be a full
  reset). Mitigation: persistence still works across plays; only reset clears it.
- **Test plan:** Add focused fixtures for each seed; keep all N-41/N-42/N-42.1/N-43
  evidence tests unchanged; run the full suite.

## 8. Acceptance criteria (exact repro check)

### R1

**Repro:** Start app with 3 prizes on playfield. Aim claw over any prize. Press
drop. **Pass** = claw descends, contacts prize, grip onset fires, hold state
active. **Fail** = claw passes through prize, no grip.

### R2

**Repro:** Move claw to front-left corner of travel bounds (max Z, min X if
asymmetric). Press drop. **Pass** = claw descends. **Fail** = claw stays still,
no descent.

### R3

**Repro:** Start a run. Aim the claw away from all prizes (empty space). Press
drop. Let the full cycle complete. **Pass** = claw descends, closes on nothing
(no prize), returns to home position without descending into the chute area.
Claw Y stays at ~2.8 during return. **Fail** = claw body descends into chute
(Y < 2.0).

### R4

**Repro:** Play one run — nudge a prize off its manifest position. Press reset.
**Pass** = all prizes snap back to manifest-authored positions. Stop `npm run dev`,
restart — prizes at manifest positions. **Fail** = prizes remain nudged after
reset, or positions survive restart.

## 9. Stop conditions

Stop and open a contract revision if any fix requires:

- Changing the state machine (C-02) beyond adding an event guard
- Changing the collision matrix or collision groups
- Changing the fixed-step policy or world convention
- Changing the persistence format or manifest schema
- Adding a new dependency
- Modifying protected files outside the approved list (R1: `adapter.ts` only;
  R2: `n7-coordinator.ts` + possibly `adapter.ts`; R3: `n7-coordinator.ts` only;
  R4: `n7-coordinator.ts`, `adapter.ts`, `prize-persistence.ts`)

## 10. Open questions

1. **R2 root cause (resolved):** The dead zone is reproducible
   deterministically when a legal edge move is read back as a marginally
   out-of-bounds f32 coordinate. Clamping the derived lowering target fixes it;
   live-app confirmation remains a separate pending check.
2. **R3 fast-forward (resolved):** Retain cosmetic lift + top traverse and
   skip only chute descent on failed grips. This preserves the approved
   `lifting → returning` path while preventing a no-hold chute dive; the
   coordinator emits `returnReached` at the traverse endpoint.
3. **R4 persistence clear (resolved):** The coordinator calls the existing
   `clearPrizePersistence` export directly with the public
   `this.physics.playfield.manifestRevision`; no adapter API change is needed.
4. **Test count:** The current suite is 89 tests (16 files), including the
   committed N-20 multi-prize and N-21 corner regressions. R3/R4 may add further
   focused fixtures without marking unrelated fixes complete.

## 11. Workstream

| Phase | Seeds  | Files                                                                 | Dependency                                                                                                |
| ----- | ------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1     | R1 (A) | `src/physics/adapter.ts`                                              | None — implemented and verified 2026-08-04; `src/evidence/n20.test.ts` adds committed regression coverage |
| 2     | R2 (D) | `src/effects/n7-coordinator.ts`, `src/evidence/n7.test.ts`            | None — implemented and deterministically verified 2026-08-04; live-app confirmation pending               |
| 3     | R3 (C) | `src/effects/n7-coordinator.ts`, `src/evidence/n7.test.ts`            | R1 — implemented and verified 2026-08-04; 13 focused N7 tests pass; no-hold return Y stays ≥ 2.0 |
| 3     | R4 (B) | `src/effects/n7-coordinator.ts`, `src/evidence/n7.test.ts`            | None — implemented and verified 2026-08-04; reset + fresh-adapter persistence fixture passes; no adapter/persistence changes |

**Definition of done:** All four acceptance criteria pass; full gate green
(typecheck/lint/test/build); no protected boundary crossed; live-app check
confirmed.
