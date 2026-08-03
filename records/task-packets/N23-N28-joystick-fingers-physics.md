# Task Packet — N23–N28: Joystick control, physical fingers, dynamic collision head, chamber walls

> Nodes N23–N28 in the Claw Machine 3D engineering graph (follow the N22 baseline
> commit `d034ab1`; Eli approved the N22 visual review).
> **Status:** implemented 2026-08-02; typecheck/lint/60 tests/build green.
> Promotion requires Eli's visual gates: head-tilt feel, finger layout, and the
> live drop cycle.
> Baseline: `d034ab1` (N22 checkpoint) + working-tree changes below.

---

## 1. The contract (Eli's directives, resolved)

```text
Overall goal:     Make the app extremely fluid, high-performing, and optimized.
Input:            Replace the Aim button + X/Z sliders with ONE joystick that
                  moves the claw on X and Z (no pressing aim first).
Fingers:          Re-arranged to Left · Right · Back (one finger on each side
                  and one at the back), and opened ~40% wider at rest.
Collision:        Fingers must have real collision detection — they must not
                  pass through the object — and the entire claw head must
                  rotate based on how the object is collided with.
Also:             Add chamber wall colliders so the claw/prize hit the glass
                  instead of passing through it (Eli approved).
```

Four user answers locked the contracts: **velocity glide** joystick movement,
**Left·Right·Back** finger arrangement, **real rigid-body head** (collisions
tilt it), and **yes to wall colliders**.

## 2. Node graph executed

```text
N22-GATE (Eli approved) ──► commit d034ab1 (baseline)
  ├──► N23 Joystick control ────────────────┐ (parallel)
  └──► N24 Finger layout + open width ──────┘
          │
        N25 Finger colliders ──► N26 Dynamic head + collision tilt
          │                            │
        N27 Grip/carry rework ──► N28 Chamber walls ──► N29/N30 verify
```

## 3. Implementation summary

### N23 — Joystick (velocity glide)
- New `src/ui/joystick-math.ts` (pure math: pointer deflection, key
  deflection, per-axis clamp) + `src/ui/Joystick.tsx` (pointer-capture drag,
  WASD/arrows mirror, live readout) + styles in `global.css`.
- `App.tsx`: joystick replaces Aim + sliders; first deflection auto-enters
  aim space; Drop + Reset remain.
- Coordinator: `previewAim` sets a glide velocity; `applyGlide` moves the claw
  at that speed, **clamped per axis** to the travel bounds (hitting one bound
  keeps sliding along the free axis — diagonal full deflection reaches the
  corner).
- **Drop/lift go straight down/up from the claw's current position** — the
  stick deflection is velocity, not position; releasing it must not recenter
  the drop (real arcade behavior).

### N24 — Finger layout + wider open
- `src/claw/rig.ts` is now the single source of truth: explicit
  `FINGER_ANGLES` = Right 0° / Left 180° / Back 270°; open flare 0.10 → 0.14
  rad (~40% wider). Scene consumes the rig constants; n4 runtime report
  regenerated from the rig.

### N25 — Physical finger colliders
- One capsule collider per pivot at the rig's **open-pose** transform,
  attached to the head body. Capsules are deliberately SHORTER than the
  visual blades so a descent parks on first contact at the fingertip level.

### N26 — Dynamic head + collision tilt (the hard part)
- **Hybrid two-body claw:** kinematic carriage (travel authority) + dynamic
  head body joined by a spherical joint (translation pinned, rotation free).
  The head carries the head cuboid, the three finger capsules, and the sensor.
- **Self-righting is a pendulum, not a spring.** The head's CoM hangs below
  the pivot, so gravity rights it; angular damping settles it. This replaced
  an over-tuned PD spring that went unstable — see §4.
- Coordinator syncs the visual `HeadRoot` from the head body and implements a
  **contact-stop**: when a claw collider touches the prize during descent, the
  carriage parks and the head keeps momentum for the tilt.

### N27 — Grip/carry on the head
- Grip approval is unchanged (sensor overlap = `physicalContact`), but the
  carry joint is a **fixed impulse joint from the dynamic head** with an
  **adaptive anchor** (the prize's head-local offset at creation), so creating
  the constraint never snaps the prize.

### N28 — Chamber walls
- Four wall colliders sized to the visual cabinet (front/back/sides) contain
  the prize and stop the claw head at the glass.

## 4. Physics debugging journey (kept for the record)

1. **Spring explosion.** A deterministic PD self-righting torque (stiffness 40)
   on the tiny head body (inertia ~0.01) went exponentially unstable — the
   head reached y=1.6M with angular velocity in the millions. Traced it with
   instrumented fixed-step runs: with the spring, the head blew up by step 300;
   **without the spring, it stayed perfectly stable** (speed < 0.011 over 180
   steps). The head is a pendulum; the spring was the bug. Removed it.
2. **Overlap false positive.** After a teleport the pendulum head swings 30–44°
   for 2+ seconds, sweeping the grip sensor across the prize — making
   "visual overlap without sensor contact" non-deterministic. Traced settle
   curves at multiple damping values: settling alone can't robustly fix a
   teleport. Real gameplay **glides** (never teleports), where the head stays
   calm (qw≈0.999). Fixed the tests/evidence to glide in like real travel.
3. **Off-center grip margin.** The prize shrink (0.31→0.22, to fit the finger
   cage) cut the sensor's contact margin at off-center drops to ~0.07, which
   the head's residual wobble could flip. Enlarged the sensor 0.24→0.30 to
   restore a ~0.19 deterministic margin.
4. **Glide freeze at bounds.** `moveClaw` rejected the whole next position when
   one axis hit its travel bound, freezing the diagonal glide. Fixed to clamp
   per axis so the free axis keeps gliding (slide along the edge).
5. **Joint limits are a no-op.** Rapier's spherical impulse joint ignores
   `limitsEnabled`/`limits` (verified empirically — the head rolled past 0.45
   rad under torque on every axis). Removed the misleading config: the head's
   swing is bounded by pendulum self-righting plus its collider contacts with
   the prize, floor, and chamber walls.

## 5. Verification

- `npm run typecheck` clean · `npm run lint` clean · `npm run build` passes
- **60/60 tests** (was 52 at baseline):
  - `src/ui/joystick-math.test.ts` (new): deflection math, key bindings, clamp
  - n6: two-body fixture — idle stability, travel bounds, overlap rejection,
    contact-approved carry with adaptive anchor, lift deviation ≤ 0.025, reset,
    repeatability, bounded logs
  - n7: full coordinated cycle with glide, bounds clamp, per-axis glide
    continuation, drop-from-position, arcade pose cycle, reset, evidence
- Evidence: n4 pose captures regenerated; n6/n7 evidence generators updated to
  the two-body fixture + glide-in semantics.

## 6. Known limitations / open feel calls (for Eli's visual gates)

- The claw's open/closed sweep is modest (chamber + glass geometry caps flare);
  the visual gate decides if the open width feels right in-game.
- Head damping (angularDamping 0.6) is deliberately fluid — the head wobbles
  for ~1–2s after a hard collision. If it feels too floppy in play, raising it
  (e.g., 2.0) makes the head settle snappier; the tests tolerate both.
- F-001 (gsap vs zustand) remains open for V1 close-out.
- Grip reach is bounded by the sensor (0.30 + prize 0.22): the claw must be
  roughly over the prize to grab it — realistic, but the live gate decides.

## 7. Recommendation

**Keep.** All deterministic gates green; the changes implement Eli's four
directives. Promote subject to Eli's visual review of the head tilt + finger
layout + live drop cycle (records/evidence + live run).
