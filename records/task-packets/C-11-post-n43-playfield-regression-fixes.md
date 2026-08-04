# Contract Packet — C-11: Post-N43 playfield regression fixes

> Four user-visible regressions introduced by or uncaught after N-43
> (multi-prize manifest). Fixes grip onset (R1), drop dead zone (R2), chute
> dive (R3), and reset (R4) in dependency order.
> **Status:** Approved — pending implementation (2026-08-04).
> **Baseline:** `main` (post-N43; N-41/N-42/N-42.1/N-43 gates green).
> **Source:** Idea Flush session + live-app observation by Eli (2026-08-04).
> **Vault contract:** `C-11 — Post-N43 playfield regression fixes` (approved).
> **Vault nodes:** N-20 (R1), N-21 (R2), N-22 (R3), N-23 (R4).
> **Authority:** physics + coordinator (C-06, C-07, C-08 joint).

---

## 1. Observed vs. expected

| Seed | Observed | Expected |
|------|----------|----------|
| **R1** | Claw descends and passes through all three manifest-spawned prizes as if they aren't there | Claw contacts any reachable prize → grip onset fires |
| **R2** | Pressing drop near front of machine → claw doesn't move, appears stuck. Drop works near back | Drop triggers descent from any XY within playfield chamber bounds |
| **R3** | Claw body descends into chute even when no prize is held | Claw stays at home Y elevation (~2.8); carry-to-delivery path only fires when prize is held |
| **R4** | Reset re-homes claw but prizes stay in nudged positions. Positions survive `npm run dev` restart | Reset clears persisted prize state, reloads manifest-authored spawn layout for all prizes |

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

- **[hypothesis]** A positional gate on the drop action has incorrect bounds.
  Candidate locations: `moveClaw()` bounds check in `src/physics/adapter.ts`
  (travel bounds: Z `[-0.35, 0.55]`); `beginLowering()` target derivation in
  `src/effects/n7-coordinator.ts`; or the controller's `confirmDrop` transition
  guard.
- **[verified]** Travel bounds `min.z = -0.35`, `max.z = 0.55`. Front wall is at
  `z = 0.88`. The claw can reach `z = 0.55` at most. `beginLowering()` uses
  `current[2]` (current Z) and `baseInteractionY` (≈1.31) — both within bounds.
  The simple lowering-path does not obviously reject front-edge positions.
- **[verified]** Controller state machine: `{ from: 'aiming', event: 'confirmDrop',
  to: 'lowering' }` — always legal from `aiming`. No state-based rejection.
- **[hypothesis, needs live investigation]** The dead zone may be a
  rendering-sync issue (claw visual position doesn't match physics position at
  the front bound) or a joystick/glide-velocity stall where the claw hits
  travelBounds at max Z and the glide continues to push against the wall without
  a visible stall indication. The fix may need to clamp to travelBounds inside
  `applyGlide()` — already done — or add a stall indicator.

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

**Files:** `src/effects/n7-coordinator.ts` (likely), `src/physics/adapter.ts` (possible)

**Change:** TBD after live investigation. If root cause is a bounds issue in
`moveClaw()`, tighten the bounds check. If a rendering desync, fix the sync.
If a glide stall, add a stall indicator. **Requires live-app debugging first.**

### Phase 3 — R3 + R4 (Seeds C + B)

**Files:** `src/effects/n7-coordinator.ts`, `src/physics/adapter.ts`,
`src/playfield/prize-persistence.ts`

**R3 change:** In `advanceEffects()` gripping case, gate the carry-to-delivery
path on hold state. When grip fails, skip the chute descent in the `returning`
state handler.

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

**R4 change:** In `resetTransaction()` in n7-coordinator.ts, clear the
persistence store before calling `this.physics.reset()`. In `reset()` in
adapter.ts, when no persisted state is found, use manifest baseline (already
implemented — the `else if (baseline)` branch). Also clear `deliveredPrizeIds`
and won/removed flags.

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
2. **R2 fixture:** Move claw to front-edge XY, press drop → claw descends.
   Same for all four corners of travel bounds.
3. **R3 fixture:** Run a cycle without gripping any prize → claw returns to
   home Y (~2.8). Claw Y never drops below 2.0 during return.
4. **R4 fixture:** Nudge a prize. Press reset. All prizes at manifest-authored
   positions. Restart dev server → prizes at manifest positions.
5. **Regression gate:** All existing 84 tests green. `npm run typecheck`,
   `npm run lint`, `npm test`, `npm run build` — all green.
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
- **R3 risk:** Gating `beginLift()` creates a fast-path where `lifting` state
  has no active travel target. The `advanceEffects()` lifting handler checks
  `this.target && positionsMatch(...)` — if `this.target` is stale, no
  `liftReached` is emitted and the claw stalls. Mitigation: also gate the
  `beginReturn()` or emit a skip event when grip failed.
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

1. **R2 root cause (needs live investigation):** Is the front-edge dead zone
   reproducible in a deterministic test fixture, or is it only visible in the
   live app (pointing to a rendering-sync or input issue)?
2. **R3 fast-forward:** When grip fails, should the claw lift-and-return
   (cosmetic arcade behavior, no prize) or skip directly to result (fastest
   path)? The proposed fix skips the chute descent only — the claw still lifts
   and traverses. Confirm this is acceptable.
3. **R4 persistence clear:** Should the `clearPersistence()` call live on the
   adapter (adds a public method) or be done directly by the coordinator using
   the existing `clearPrizePersistence` export from `prize-persistence.ts`?
   Recommend: coordinator calls `clearPrizePersistence` directly (no adapter API
   change).
4. **Test count:** The existing suite is 84 tests (14 files). R1 may require
   updating existing grip tests that assume a single prize. Confirm approach:
   rework affected tests or add parallel multi-prize fixtures.

## 11. Workstream

| Phase | Seeds | Files | Dependency |
|-------|-------|-------|------------|
| 1 | R1 (A) | `src/physics/adapter.ts` | None |
| 2 | R2 (D) | `src/effects/n7-coordinator.ts` (+ `adapter.ts` possible) | None |
| 3 | R3 (C) | `src/effects/n7-coordinator.ts` | R1 (needs grip state to test) |
| 3 | R4 (B) | `src/effects/n7-coordinator.ts`, `src/playfield/prize-persistence.ts` | None |

**Definition of done:** All four acceptance criteria pass; full gate green
(typecheck/lint/test/build); no protected boundary crossed; live-app check
confirmed.
