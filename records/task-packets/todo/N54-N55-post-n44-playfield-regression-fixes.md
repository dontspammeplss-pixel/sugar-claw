# Contract Packet — N54–N55: Post-N44 playfield regression fixes — prize collider clipping + +Z glass-edge drop teleport

> Nodes N54–N55 in the Claw Machine 3D engineering graph (post-N44 playfield
> regression fixes; follows N53 and the C-11 regression packet).
> **Status:** contract-only / implementation not started (2026-08-05).
> This packet converts the reviewed bug-fix plan (bug report 2026-08-05) into
> bounded implementation nodes. It deliberately changes **no source code, tests,
> physics configuration, generated evidence, dependencies, or build artifacts**
> until Eli accepts it as the implementation plan.
> **Source:** bug report (2026-08-05) + independent code review of the current
> working tree. Every root-cause claim below is **verified by headless probes**
> run against the real adapter/coordinator (2026-08-05); evidence in §4/§5.
> **Baseline:** working tree on `main` at `1543e71` (C-11 post-N43 fixes
> landed) with the **N44 geometry-variety change uncommitted** (new tag/strap/
> loop/pouch prize visuals in `StaticScene.tsx` + `DEFAULT_BODY_BY_GEOMETRY`
> fallback).
> **Vault contract:** draft via `/c-contract-first` before implementation.
> **Authority:** physics + coordinator + playfield-manifest (C-06/C-07/C-08
> joint; prize-manifest data layer).

---

## 1. The wanted outcome

From buggy → fixed:

| Seed | Observed (verified) | Expected |
| ---- | ------------------- | -------- |
| **R1** | New tag/strap/loop/pouch prizes clip through the floor and glass. tag-prize settles with body center y≈0.70 (visual sphere bottom ≈0.48, ≈0.41 below floor top 0.89); pouch bottom ≈1.4 cm below the floor; packaging-only prizes can overlap the front glass when knocked | Every prize rests on the floor supported by colliders that match its visual; no prize envelope penetrates floor or chamber walls |
| **R2** | Pressing Drop at the +Z glass edge (z = `travelBounds.max.z` = 0.55) teleports the claw straight to y = `baseInteractionY` (1.31) in one tick, skips the descent animation, then dies in `error`/`invariant` with transitions `[ready, aiming, lowering, aligning, gripping, lifting, error]` (`derived lifting target is out of bounds`) | Animated ~800 ms descent along the glass; run completes normally from every travel-bound corner |
| **R3** | Even with R2 fixed, the descent is still skipped at +Z: the head collider is already embedded 0.02 into the front wall at drop time, so `barrier-contact` cancels the lowering on the first step | The claw slides down the glass when the wall contact pre-exists the drop; genuine wall barriers hit *during* a descent still stop it |

## 2. Node graph

```text
N54 Prize collider geometry fallback (R1)
   │   └─ src/playfield/prize-manifest.ts (DEFAULT_BODY_BY_GEOMETRY), n43.test.ts count
   ▼
N55 +Z glass-edge drop (R2 + R3)
   ├── R2 moveClaw f32-bound epsilon  ── src/physics/adapter.ts
   └── R3 pre-existing barrier-contact ── src/effects/n7-coordinator.ts
   (R3 is only observable after R2; implement both)
   ▼
Gate: live-app check — drop at +Z animates; prizes rest on the floor
```

N54 is independent. N55's two seeds share no files. Recommended order:
N54 → N55 (R2 then R3) → gate.

## 3. Shared invariants and protected boundaries

Until Eli accepts this packet, **only this packet, its contract references, and
the project decision ledger may be edited** for N54–N55.

The following remain protected unless a separate contract revision is opened:

- `src/physics/adapter.ts` remains the sole Rapier body/collider/contact
  authority. R2 changes **only** `moveClaw()`'s bounds comparison — no collider,
  contact, or step semantics.
- `src/physics/config.ts` stays untouched: `travelBounds` (max.z = 0.55),
  `baseInteractionY` (1.31), wall geometry, collision matrix, fixed-step policy
  all unchanged.
- `src/state/**` (C-02): no state-machine change. The `error` state becomes
  unreachable on this path without touching the controller.
- **N44 `attemptGrip` gate stays OFF** (adapter.ts:1664 requires
  `subGeometries !== undefined`; the default manifest declares none). Fix A is
  fallback-only — the manifest is not edited, so grip/win *approval* semantics
  are unchanged. (RetentionFactor on a body-caught tag/strap/loop does change;
  see §4/§6.)
- Determinism (A-27) and no-randomness (A-07) hold; all fixes are fixed-step
  reproducible.
- No new dependency (A-33); no persistence-format, manifest-schema, or
  collision-matrix change.
- `n43.test.ts`'s `prizeColliderCount` assertion is the **single intentional
  existing-test update** (3 → 4; see §6). Evidence JSONs regenerate via tests.

### Deliberate semantic changes this packet

- Prize fallback colliders become **arrays** (body + packaging) instead of a
  single primitive; `prizeSubGeometries()` returns them directly.
- A body-caught tag/strap/loop prize reports `retentionFactor: 1` (full body
  cage) instead of the packaging-only 0.42–0.55. Intended; needs a fixture.

---

## 4. N54 — Prize collider geometry fallback [R1]

### Job

Give every `DEFAULT_BODY_BY_GEOMETRY` geometry a body primitive that matches
its visual (sphere/box/pouch/tag/strap/loop), plus the existing packaging
primitive. The prize then rests on the floor with its visual body supported,
and can no longer overlap the glass when knocked.

### Why (verified)

N44 renders new prize meshes (`StaticScene.tsx` `PrizeRoot`, lines 393–430)
but the physics colliders come from `prizeSubGeometries()`
(`src/playfield/prize-manifest.ts:244`), which falls back to
`DEFAULT_BODY_BY_GEOMETRY` (`prize-manifest.ts:234`). That fallback defines
**no body primitive** for tag/strap/loop (only the packaging primitive at
`[0, 0.24, 0]`) and a pouch cuboid smaller than its visual box.

Probe (default manifest, 400 fixed steps): `prize` (sphere) rests y≈1.109;
**tag-prize rests y≈0.699** (its tiny tag box sits on the floor; the visual
sphere r=0.22 bottoms ≈0.41 below floor top 0.89); **pouch-prize rests
y≈1.126** (visual box bottom 0.876, ≈1.4 cm clip). All three reproduce the
report exactly.

### Ownership

- `src/playfield/prize-manifest.ts` — `DEFAULT_BODY_BY_GEOMETRY` per-geometry
  primitive arrays; `prizeSubGeometries()` returns them.
- `src/physics/adapter.ts` — unchanged; the multi-collider path (N44) and
  `applyDeclaredMass` (adapter.ts:1889, keeps declared total mass) already
  consume arrays.
- `src/evidence/n43.test.ts` — `prizeColliderCount` 3 → 4 (or `>= 3`).
- New settle fixture — see §6.

### Contract

Fallback colliders, body primitive **first** (keeps `prizeCollider =
primaryColliders[0]` and the `prize-collider` colliderId binding valid), body
`retentionFactor: 1`, packaging retains its factor, `captureTarget` on the
packaging (schema requires ≥ 1):

| Geometry | Body primitive | Packaging primitive |
| -------- | -------------- | ------------------- |
| sphere   | ball r 0.22 @ [0,0,0] (unchanged) | — |
| box      | cuboid half [0.22,0.22,0.22] (matches 0.44³ visual) | — |
| soft-pouch | cuboid half [0.21,0.25,0.14] (exactly the 0.42×0.5×0.28 visual) | — |
| tag      | ball r 0.22 @ [0,0,0] | box half [0.08,0.06,0.015] @ [0,0.24,0] (factor 0.42) |
| strap / loop | ball r 0.22 @ [0,0,0] | horizontal capsule halfHeight 0.12, radius 0.025 @ [0,0.24,0] (factors 0.5 / 0.55; convex-only approximation of the hollow torus) |

### Failure results

- `clip-through-floor`: a prize's visual envelope intersects the floor plane
  while at rest (tag bottom < 0.89 − tolerance; pouch < 0.89 − tolerance).
- `clip-through-glass`: a resting prize envelope intersects a chamber wall.
- `collider-count-drift`: inventory collider count diverges from the declared
  per-geometry primitive count (n43 gate).

### Evidence required

1. Settle fixture: adapter stepped with `DEFAULT_PRIZE_MANIFEST` to rest —
   sphere ≈1.109, tag center ≥ 1.10, pouch ≥ 1.13; no envelope intersects a
   chamber wall (|x| + extent < 1.65, |z| + extent < 0.83).
2. Repeatability: two runs settle to the same positions within tolerance.
3. Grip-onset fixture (n20 already covers): contact still fires for each
   contacted prize.
4. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop and open a revision if N54 needs a manifest schema change, a collider
profile change for the *authored* (non-fallback) path, or a state-machine or
collision-matrix change.

---

## 5. N55 — +Z glass-edge drop: f32 bound overshoot + pre-existing barrier contact [R2 + R3]

### Job

Pressing Drop at the +Z glass edge must produce a normal animated descent and
a completing run — no teleport, no skipped animation, no `error` state.

### Why (verified, two independent root causes)

**R2 — f32 boundary overshoot rejects animated positions → fallback snap.**
Rapier stores the kinematic translation as f32; `Math.fround(0.55) =
0.550000011920929 > 0.55`. C-11 R2 (N-21) already fixed the *confirmDrop*
invariant failure by clamping X/Z in `beginLowering()`
(`n7-coordinator.ts:447`) — but the clamp target (0.55) is **strictly below
the read-back** (0.550000011920929), so every interpolated position from
`ClawTravelAnimator` has z ≥ 0.55 + ε and `moveClaw` (adapter.ts:1236, strict
per-axis check) rejects it; the tick-loop fallback (n7-coordinator.ts:366–371)
then snaps straight to the full descent target `[x, 1.31, 0.55]`. `beginLift()`
(n7-coordinator.ts:486) then derives its target from the same stored z,
`moveClaw` rejects, and the run enters `error` (`derived lifting target is out
of bounds`). Probe-confirmed transitions:
`[ready, aiming, lowering, aligning, gripping, lifting, error]`.

Only `max.z = 0.55` is affected: `fround(1.25)` is exact, `fround(−0.35) =
−0.3499999940395355` reads back *inside* bounds (so −Z is immune), and `2.8`
reads back below `max.y`. Intermediate z values read back inside bounds, so
mid-field and z=0.54 drops are safe. Pre-existing and unreachable to tests:
the N-21 corner test (n7.test.ts:507–568) only asserts the first tick's y
*dropped* — which the teleport satisfies. Mid-field control probe completes
normally.

**R3 — pre-existing barrier contact cancels the descent instantly.** At
z = 0.55 the head collider's front face (0.55 + 0.3 = 0.85) is embedded 0.02
into the front wall (inner face 0.88 − 0.05 = 0.83). `observeGrip()` reports
`barrierContact` on wall contact only, so `observeDescent()`
(adapter.ts:1597) returns `completionReason === 'barrier-contact'` on the
first lowering step and the `lowering` branch (n7-coordinator.ts:520–545)
cancels the travel and completes at the still-high position — the descend
animation is skipped (probe: state advanced past `lowering` within one tick).
This only becomes visible once R2 is fixed.

### Ownership

- **R2** — `src/physics/adapter.ts` → `moveClaw()` (adapter.ts:1236): accept
  per-axis values within ε of a bound and clamp to the bound.
- **R3** — `src/effects/n7-coordinator.ts`: private
  `dropStartedInBarrierContact` flag set in `beginLowering()` from
  `observeDescent().barrierContact` (a pure read), reset in
  `resetTransaction()` (n7-coordinator.ts:726); the `lowering` branch treats
  `barrier-contact` as a terminator only when the flag is false.

### Contract

1. **R2:** ε = 1e-6 (84× the 1.19e-8 f32 noise; matches `tolerances.travel`;
   far below the existing test overshoots of 0.01 / 0.001). `moveClaw` clamps
   overshoots ≤ ε to the bound and returns `true`; overshoots > ε return
   `false` as today. This single chokepoint also fixes the `beginLift`
   invariant error and the latent snap on the +Z return traverse and chute
   descent (both target z = 0.55).
2. **R3:** a descent that starts in wall contact slides down the glass
   (head slides on the wall) and completes at `baseInteractionY`; wall
   barriers hit *during* a descent still stop it (flag false). The lowering
   `positionsMatch` completion path (n7-coordinator.ts:539–544) is unchanged
   and guarantees completion even if base-clearance jitters from head tilt.
3. **R2+R3 together:** +Z drop animates over the full ~800 ms lowering
   window and the run reaches `result` (or the normal failed-grip path).
4. No adapter behavior outside `moveClaw` changes; no coordinator behavior
   outside the lowering branch changes.

### Failure results

- `z-drop-teleport`: claw reaches y ≈ 1.31 within the first 2 fixed ticks of
  a +Z drop.
- `z-drop-error-state`: a +Z drop ends in `error`/`invariant`.
- `descent-skip-at-glass`: `lowering` completes in fewer than ~10 ticks at
  +Z (animation skipped).
- `genuine-barrier-masked`: a wall hit during a non-glass descent no longer
  stops the claw (regression of N36 barrier policy).

### Evidence required

1. `n7.test.ts`: for all four travel-bound corners + mid-field, run to a
   terminal state; assert `state === 'result'`, no `error`, and that y does
   **not** reach `baseInteractionY` within the first 1–2 ticks; assert the +Z
   lowering took multiple ticks.
2. `n6.test.ts`: `moveClaw([0, 2.8, max.z + 1e-7])` → `true` (and the
   stepped position is clamped to ≈0.55); `moveClaw([0, 2.8, max.z + 0.01])`
   → `false`; symmetric `min.x` checks.
3. N36 evidence stays green (adapter-level; corner fixture z = 0.5).
4. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop and open a revision if R2's epsilon is not a single chokepoint (e.g.,
other call sites need the same treatment), if R3 requires a collision-matrix
or state-machine change, or if the barrier flag proves nondeterministic in
the live app.

---

## 6. Cross-node regression risk + test plan

- **`n43.test.ts:39` must change** (`prizeColliderCount: 3` → `4` or
  `>= 3`): Fix A adds a second collider to tag/strap/loop prizes. This is the
  only existing assertion the packet knowingly updates; all other n43
  assertions (`>= 3`, prize-vs-prize, win-removal, repeatability) hold.
- **RetentionFactor:** a body-caught tag/strap/loop now reports factor 1.0
  (was packaging-only 0.42–0.55). Add a spot-check fixture asserting the
  body region yields 1.0 and the packaging box still yields 0.42.
- **n6/n6-evidence bounds tests** (`±0.01`, `±0.001`) remain valid under
  ε = 1e-6 — verified by inspection.
- **Settle thresholds:** tag ≥ 1.10 and pouch ≥ 1.13 (theoretical rest 1.11 /
  1.14) — tighter than the draft's 1.09 to avoid allowing residual
  penetration.
- **Collider ordering:** body primitive must stay index 0 per geometry
  (`prizeCollider = primaryColliders[0]`, `prize-collider` id, N38 PrizeBody
  binding all depend on it — n38.test.ts asserts `missingColliderIds: []`).
- **Test placement:** settle fixture in a new evidence test file (or extend
  n43), not n44.test.ts (which is a synthetic grip-evaluator test).

## 7. Promotion gate (live-app)

1. Drop from the +Z glass edge: animated descent, no teleport, no error
   state; run completes.
2. tag/pouch prizes rest on the floor with visuals fully supported; no
   glass/floor clipping when knocked.
3. Descent from all other corners unchanged; full suite green.

## 8. Open decisions (pending Eli)

1. **ε magnitude:** 1e-6 (proposed, matches `tolerances.travel`).
2. **RetentionFactor acceptance:** body-caught tag/strap/loop reporting 1.0
   is intended; confirm it should ship with N54.
3. **Settle-fixture placement:** new evidence file vs extending n43.
4. **N55 test depth:** also assert the +Z return traverse completes (R2
   fixes a latent snap there) or keep scope to the drop path.

## 9. Recommendation

**Implement N54 then N55 (R2 before R3) in one pass** — both are small,
file-disjoint, and fully verified. N54 is independent; N55's seeds are only
jointly observable. Draft the C-12 contract via `/c-contract-first`, update
`n43.test.ts`, add the §6 fixtures, and run the full gate
(`typecheck` / `lint` / `test` / `build`) before the live-app check.
