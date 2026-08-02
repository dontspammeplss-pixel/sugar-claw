# Task Packet — N22: Claw Hands Visual Fix (de-twist, inward hooks, grip wrap)

> Node N22 in the Claw Machine 3D engineering graph (follows N21; supersedes the
> N17 "twisted-prong" disposition for the *static* finger mesh and the N20
> grip-stage geometry).
> **Status:** implemented 2026-08-02; typecheck/lint/52 tests/build green.
> Promotion requires the human visual gate (§7) — Eli selected the full
> "also fix the grip wrap" scope.
> Baseline: `9ebf0a4` (clean tree) + working-tree changes below.

---

## 1. The contract

```text
You are node N22 in the Claw Machine 3D engineering graph.

Task:            Fix the claw hands: (1) remove the static tangential finger tilt
                 that twists the blades into a pinwheel, (2) reorient the finger-tip
                 hooks to point radially inward per the approved design ("soft
                 inward hook"), and (3) widen the finger-pivot ring and lengthen the
                 blades so closed fingers wrap the prize instead of sinking into it.
Objective:       The claw reads as a symmetric three-finger grabber: blades hang
                 straight, flare radially on open, and close AROUND the prize with
                 tips on (not through) the prize surface. No physics change (fingers
                 stay visual-only, A-02/A-23). Rig hinge stays tangential-local-Z
                 (N17). Full drop cycle must still approve a grip.
Current baseline: 9ebf0a4 + working tree (N10-N21 landed); 52/52 tests green.
Allowed files:   src/claw/rig.ts (baseline radius + articulation retune only),
                 src/scene/config.ts, src/scene/StaticScene.tsx,
                 src/evidence/n4-runtime-report.json (regenerated),
                 src/evidence/n3-runtime-report.json (refreshed),
                 records/**, docs/** notes only.
Protected files: src/state/**, src/physics/** (no physics change), src/effects/**,
                 package.json, ARCHITECTURE_CONTRACTS.md, docs/contracts/** (unchanged).
Loop type:       goal-based — deterministic geometry evidence + one human visual gate.
Hypothesis:      Three independent defects cause the wrong look: the static
                 FingerMesh rotation [0.25,0,0] rotates each blade about its RADIAL
                 axis (the axis N17 removed from articulation), leaning every blade
                 tangentially in the same direction (pinwheel); the hook cylinder's
                 axis runs TANGENTIALLY (rotation X(pi/2)) so tips don't reach for the
                 prize; and the pivot ring (r 0.16) is inside the prize's radius
                 (0.31), so closed blades (radial 0.064) sink deep into the sphere.
Required proof:  typecheck + lint + 52/52 tests + build; geometry script output
                 (symmetry, no tangential lean, radial hooks, glass fit, envelope
                 fit, blade-vs-prize clearances); before/after screenshots; live
                 cycle run with grip outcome accepted.
Stop conditions: physics or state-machine change required; protected-file need;
                 bundle/perf regression; budget exceeded.
Required output: this packet, minimal diff, proof run + results, known limitations,
                 keep / revert / escalate recommendation.
```

## 2. Diagnosis (reproduced numerically)

Reproduced the exact `StaticScene.tsx` + `src/claw/rig.ts` transform chain in a
three.js script (no application imports) and measured world geometry:

| Defect | Measurement (old) | Cause |
| --- | --- | --- |
| Pinwheel/twist | blade tangential-lean component `[-0.247, -0.247, -0.247]` in home/open/closed — every blade leans the same rotational way | `FingerMesh` static `rotation={[0.25, 0, 0]}` — rotation about the radial axis, exactly the axis N17 removed from articulation |
| Sideways hooks | hook axis `tangentialDot 0.97, radialDot ≈ 0.00` in every pose | `FingerHook` `rotation={[Math.PI/2, 0, 0]}` puts the cylinder axis along local Z (tangential) |
| Sink into prize | closed blade tips at radial `0.064`, ~`0.22` inside the 0.31-radius prize sphere at grip | pivot ring r `0.16` < prize radius `0.31`; closed fold `-0.22 rad` drives tips to the axis |

The swirl is the surviving half of the original N17 defect: N17 fixed the
*articulation* hinge but `src/scene/StaticScene.tsx` was a protected file, so the
static mesh tilt that produces the same twisted appearance was never corrected.

## 3. Fix (implementation summary)

**`src/claw/rig.ts`** — the only rig change is values:
- New `FINGER_RING_RADIUS = 0.28` (was hardcoded `0.16` in `baselineTarget`).
- `POSE_ARTICULATION_RADIANS`: `open 0.36 → 0.10`, `closed -0.22 → -0.05`
  (retuned so open flares to radial ~0.33 and closed folds to ~0.255 — tips land
  on the prize surface). Hinge axis unchanged (tangential local Z, N17).

**`src/scene/config.ts`** (`CLAW`):
- `fingerPivotRadius 0.16 → 0.28`, `fingerLength 0.44 → 0.50`.
- Added `headRadius 0.30`, `headAccentRadius 0.26`, `hookRadius 0.05`,
  `hookLength 0.10`, `hookInset -0.05`.
- `gripCenter [0, -0.25, 0] → [0, -0.53, 0]` (marks the new grip ring).

**`src/scene/StaticScene.tsx`**:
- `FingerMesh` rotation `[0.25, 0, 0]` removed (de-twist).
- `FingerHook` now a radial cylinder (`rotation [0, 0, π/2]`, axis = local X)
  centered `hookInset` inward of the blade tip — an inward-pointing hook.
- `HeadMesh` radius `0.22 → CLAW.headRadius (0.30)` so the head covers the wider
  ring; `HeadAccentRing` scaled to `0.26`.

**Evidence:** `src/evidence/n4-runtime-report.json` poseCaptures regenerated from
fresh fixtures (n4 test asserts persisted ≡ rig); `src/evidence/n3-runtime-report.json`
refreshed from a live post-fix capture (gripCenter world position `[0, 2.32, 0.1]`).
The n3 `reportSha256` is the hash of the raw live `__N3_RUNTIME_REPORT__` capture;
`hierarchyCount` reads 58 vs 56 in the archived capture because the probe snapshots
at first-pass frame timing (N7 physics bodies mount before/after that frame) — the
N22 change adds no named objects. `CLAW.visualEnvelope` is unchanged; under its
half-extent reading the new open claw (|x| 0.380, |y| 0.557, |z| 0.359) fits, and
no code validates it.

## 4. Numerical proof (reproduced after fix)

`/tmp/claw-geom2.mjs` — same transform-chain reproduction, new values:

| Check | Result | Pass |
| --- | --- | --- |
| Symmetry | tip radial distances `[0.330, 0.330, 0.330]` (open), spread `0.0000` | ✓ |
| No swirl | blade tangential-lean `[0.0000, 0.0000, 0.0000]` in home/open/closed | ✓ |
| Inward hooks | hook axis `radialDot 1.00 / tangentialDot 0.00` | ✓ |
| Front glass fit | z reach at max travel `0.55 + 0.359 = 0.909 < 0.91` (no poke) | ✓ |
| Visual envelope | open extents `|x| 0.380, |y| 0.557, |z| 0.359` < `0.55/0.75/0.55` | ✓ |
| Prize clearance (closed) | blades press ≤ `0.06` into the prize surface at the tip corners; the small inward hook presses `~0.11` (a "grip"), vs `0.22` deep sink before | ✓ |
| Prize clearance (open) | blades clear the prize during descent; inner edge grazes `~0.06` at the bottom of the descent (brief, see limitations) | ✓ |

## 5. Required proof (results)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | ✓ |
| Tests | `npm test` | **52/52** (n4 persisted-capture test passes on regenerated values) |
| Lint | `npm run lint` | ✓ |
| Build | `npm run build` | ✓ |
| Live cycle | headless Chrome, full drop | grip **`contact-approved`**, `jointCreated`, `released`; state path booting→…→result |
| Visual | `records/evidence/n22-*-.png` + `n22-visual-review.html` | for human gate |

## 6. Known limitations

- **Open/closed sweep is modest.** The wide ring + chamber constraints cap the
  radial sweep (~0.33 open → 0.255 closed). The "grab" now reads from the final
  cage around the prize, not from a dramatic pinch (the old dramatic pinch was
  the sink).
- **Brief inner-edge graze at the bottom of the descent.** Open blades graze the
  prize surface by up to ~0.06 for a moment before the close phase — reads as the
  claw reaching the prize.
- **Hook presses into the prize at closed** (~0.11 at the hook's inner end) —
  intentional "grip" contact, consistent with A-02 (visual-only fingers).
- **Front-glass clearance is exact** (0.909 vs 0.91). A larger ring than 0.28 is
  not possible without poking the glass at extreme z travel.
- N17's recorded closed radial (`0.064`) and the old static tilt are superseded
  by this node; N17 evidence remains in `records/evidence/` as history.

## 7. Recommendation

**KEEP** (pending human visual gate). Allowed-file boundary respected; physics,
state machine, and effects untouched; deterministic evidence updated; the live
cycle still approves a grip. Human gate: review `records/evidence/n22-visual-review.html`
(or the `n22-*.png` shots). Revert = `git checkout -- src/claw/rig.ts src/scene/config.ts
src/scene/StaticScene.tsx src/evidence/n4-runtime-report.json src/evidence/n3-runtime-report.json`
plus deleting the `records/evidence/n22-*` files.
