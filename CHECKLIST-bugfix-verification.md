# Claw Machine Bug-Fix Verification Checklist

Purpose: verify the fixes for the five reported bugs (ball disappears on launch, aim sliders do nothing, drop teleports instead of animating, camera off to the side) were implemented correctly.

How to use: each item is a pass/fail concern. Static items can be checked by grepping the file for the expected value. Runtime items require running the app (`npm run dev`) and driving the UI. A centered drop (X slider at 0) should always grab the ball; off-center drops may miss — that is intended claw-machine behavior.

---

## 1. Physics ↔ visual alignment (ball no longer disappears)

The ball was spawning inside the cabinet; physics and visuals must agree.

- [ ] P1. `src/physics/config.ts` — `floorPosition` = `[0, 0.79, 0]` (floor top = 0.79 + half-extent 0.1 = **0.89**)
- [ ] P2. `prizePosition` = `[0, 1.2, 0]` and `prizeRadius` = `0.31` — rest height = floor top 0.89 + radius 0.31 = **1.2** ✓
- [ ] P3. `gripPosition` = `[0, 1.85, 0]` and `sensorOffset` = `{x: 0, y: -0.65, z: 0}` — sensor lands at 1.85 − 0.65 = **1.2 = prize center**
- [ ] P4. `overlapPosition` = `[0.5, 1.5, 0]`
- [ ] P5. `src/scene/StaticScene.tsx` — PrizeRoot positioned at `[0, 1.2, 0]`, ball geometry radius **0.31** (matches physics)
- [ ] P6. Runtime: on launch the ball is visibly sitting on the playfield (not sunk into the cabinet/plinth); claw at home `[0, 2.8, 0]`

## 2. Aim sliders update the claw (preview)

- [ ] A1. `src/effects/n7-coordinator.ts` — `moveAim` calls `previewAim(...)` (line ~212) only while state is `aiming`
- [ ] A2. Preview target = `[aim.x * 1.25, raisedY, aim.z * 0.35]`; glide duration `TRAVEL_AIM_MS` = **350** (line ~310)
- [ ] A3. Runtime: dragging the X/Z sliders while aiming glides the claw horizontally at raised height (no lowering)

## 3. No teleport — kinematic travel animation

- [ ] T1. `startTravel` / `advanceTravel` methods exist with `easeInOutCubic` easing (lines 346, 352, 581)
- [ ] T2. Durations: lowering **800** (`TRAVEL_LOWERING_MS`), lift **700** (`TRAVEL_LIFT_MS`), return **700** (`TRAVEL_RETURN_MS`), aim **350** (`TRAVEL_AIM_MS`) — lines 575–578
- [ ] T3. In the tick loop, `advanceTravel` runs **before** `physics.step()` (line ~278) so the kinematic target is set then applied
- [ ] T4. Travel cleared on `reset()` — `this.travel = null` (line ~485)
- [ ] T5. Degenerate-duration guard: duration ≤ 0 falls back to instant snap (no NaN from division)
- [ ] T6. `advanceTravel` snaps to the validated `travel.target` if `moveClaw` rejects an eased position (line ~376) — travel cannot stall silently
- [ ] T7. `beginLowering` / lift / return validate targets (via `moveClaw` return) before starting travel
- [ ] T8. Runtime: pressing Drop lowers the claw smoothly (~0.8s), lift ~0.7s, return ~0.7s — **no teleporting, no instant completion**

## 4. Camera — straight-on front view

- [ ] C1. `src/scene/config.ts` — `REVIEW_CAMERA`: position `[0, 2.3, 7]`, target `[0, 2.05, 0]`, `fovVerticalDeg` = **38**
- [ ] C2. `src/scene/N3Canvas.tsx` applies `REVIEW_CAMERA` (camera x = 0 → machine centered, straight-on)
- [ ] C3. `src/evidence/n3.test.ts` matches the same camera values (position `[0, 2.3, 7]`, `lookAt(0, 2.05, 0)`, fov 38)
- [ ] C4. Runtime: machine is seen from the front, centered in frame, both side frames symmetric

## 5. Grip physics (realistic catch)

- [ ] G1. Centered drop always grips: sensor radius 0.24 + prize radius 0.31 ≈ **0.55** contact threshold, centered at prize center
- [ ] G2. Off-center aim (X slider near ±1 → claw x ≈ ±1.25) intentionally misses and returns empty — **intended behavior, not a bug**
- [ ] G3. Runtime: prize is carried up, released, falls back and settles at `[0, 1.2, 0]` — does **not** fall through the floor

## 6. Full run state sequence

- [ ] S1. Runtime: a drop run progresses `ready → aiming → lowering → aligning → gripping → lifting → returning → releasing → result` with visible motion between every state
- [ ] S2. After the run / on reset, the claw returns to home `[0, 2.8, 0]` and sliders clear

## 7. Evidence + tests

- [ ] E1. `src/evidence/n7-evidence.ts` — `loweredTarget = [0.2 * 1.25, gripPosition[1], -0.2 * 0.35]` = `[0.25, 1.85, -0.07]` (line 68)
- [ ] E2. n7-evidence advances ticks (up to 90) until the claw physically **reaches** the lowered target — not a single warm-up tick (lines 76–90)
- [ ] E3. `src/evidence/n7.test.ts` — expects `loweredTarget` toEqual `[0.25, gripPosition[1], 0.2 * -0.35]` and `loweredClawPosition` within 1e-5 of it (lines 211–217)
- [ ] E4. `npm run typecheck` (tsc -b) exits clean
- [ ] E5. `npm test` — **all 50 tests pass** (n3: 9, n4: 8, n5: 13, n6: 11, n7: 7 + bootstrap)

## 8. Build / deploy note

- [ ] B1. `dist/` may still contain the **old build** — if the app is served from `dist`, run `npm run build` so the fixes ship
