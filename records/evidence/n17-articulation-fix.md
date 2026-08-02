# N17 Runtime Evidence — Claw Finger Articulation Hinge Fix

**Node:** N17 — Diagnose and fix asymmetric finger articulation
**Baseline:** `c54c616` — 51 tests green, typecheck clean
**Fixed:** 2026-08-01
**Status:** Fix applied — **KEEP** (pending human visual approval of open/closed symmetry)

---

## Diagnosis

In `src/claw/rig.ts`, `poseTarget` composed finger articulation as

```ts
const localArticulation = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0), // local X
  articulation,
)
```

The baseline pivot quaternion is `Euler(0, -angle, 0)`, which orients each pivot so that:

- **local X = radial axis** (points outward from the claw's central axis), and
- **local Z = tangential axis** (runs along the claw's circle).

Articulating about the **radial** axis therefore swept the hanging blade (local −Y) **tangentially** — around the claw's circumference — instead of radially toward/away from a prize. The result is the "twisted-prong" appearance: opening/closing rotates each blade around its spoke so the three tips never converge on the claw axis, so no valid multi-point enclosure around a prize is possible.

The correct hinge for a hanging claw finger is the **tangential** axis (local Z): the blade then swings in the radial plane, flaring outward on `open` and converging on the claw axis on `closed`.

This is a **visual-only** rig change; fingers stay visual-only per A-02, and no physics change was made.

## Fix (minimal, one semantic change)

```diff
  const localArticulation = new Quaternion().setFromAxisAngle(
-   new Vector3(1, 0, 0),  // local X (radial) — swept tips tangentially
+   new Vector3(0, 0, 1),  // local Z (tangential) — blade swings in radial plane
    articulation,
  )
```

`POSE_ARTICULATION_RADIANS` (single symmetric scalar: open `0.36`, closed `-0.22`) is unchanged. `base.multiply(localArticulation)` composition order is retained, so articulation stays in each pivot's own frame. The persisted `src/evidence/n4-runtime-report.json` `poseCaptures` for `open`/`closed` were regenerated to match the new rig targets (the n4 test asserts persisted captures ≡ `DEFAULT_CLAW_RIG.poses`).

## Required proof

| Proof | Result |
| --- | --- |
| Baseline before fix | 51/51 tests green at `c54c616` |
| Reproduction (quantitative) | `records/evidence/n17-repro-before.json` — all three tips sweep **purely tangentially** (radial component ≈ 0); closed tips sit at radial distance `0.187` from the claw axis (farther than the `0.16` home radius) — no enclosure |
| Reproduction (visual) | `records/evidence/n17-before-fix.png` — blades rotate around their spokes |
| Fix evidence (quantitative) | `records/evidence/n17-repro-after.json` — sweep is **purely radial** (tangential component ≈ 0); open tips flare to radial `0.315`, closed tips converge to `0.064` (well inside the `0.31` prize radius) |
| Fix evidence (visual) | `records/evidence/n17-after-fix.png` — open flares symmetrically outward, closed converges around the grip-center sphere |
| detectDrift pose evidence | n4 tests pass: every pose target applies with zero drift; 8-cycle open/close replay identical; reset restores baseline exactly |
| Gates | typecheck ✓ · lint ✓ · 51/51 tests ✓ · build ✓ |

## Keep-or-revert decision

**KEEP.** The tangential-axis hinge is the geometrically correct hinge for a hanging claw finger, and the evidence confirms the intended behavior change: blades now sweep radially (open flares outward, closed converges around the prize). No test regressions; the only persisted-value change (`n4-runtime-report.json`) was regenerated from the rig.

**Human visual gate:** pending — review `records/evidence/n17-visual-review.html` (before vs after, home/open/closed) or the two PNGs above. Revert = restore `Vector3(1, 0, 0)` in `poseTarget` and the prior `poseCaptures`.
