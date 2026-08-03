# Contract Packet — N31–N33: Input reliability and head-weight feel fixes

> **Status:** contract-only / implementation not started (2026-08-02).
> This packet deliberately changes no source code. It defines the bounded nodes,
> ownership, failure results, and evidence required before implementation.
> Baseline: N23–N28 working tree, with the existing N22 baseline commit
> `d034ab1` beneath it. The repository may contain uncommitted N23–N28 source
> changes from the prior implementation turn; this packet does not attribute
> those changes to N31–N35. A future implementation checkpoint must capture a
> scoped pre-change diff before claiming the no-code boundary was preserved.

---

## 1. Reported defects

Eli reports three user-visible failures:

1. **WASD has no reaction.** Pressing W/A/S/D does not move the claw.
2. **Pointer drag is not continuous.** Dragging the joystick appears to move it
   roughly one pixel and then remain stuck, leaving the claw travelling in one
   direction instead of following the pointer.
3. **The dynamic head wobbles too much.** It does not feel heavy or realistic;
   it oscillates rather than settling with believable mass.

The requested outcome is not a rewrite: preserve the current joystick/XZ glide,
physical finger collisions, dynamic head, fixed-step physics, and explicit carry
contract while making these three behaviors reliable and weighty.

## 2. Node graph

```text
N31 Keyboard semantic mapping ───────┐
                                     ├──► N34 integrated input verification
N32 Pointer drag continuity ─────────┤
                                     │
N33 Head weight / wobble tuning ─────┘
                                              │
                                   N35 visual feel + performance gate
```

N31 and N32 own disjoint input surfaces and may be implemented in parallel.
N33 is independent at the file level but must be verified with N34 because
input movement and head response interact in the live scene. N35 is the final
human visual/performance gate, not an implementation node.

---

## 3. Shared invariants and protected boundaries

### Contract-only gate

Until Eli explicitly accepts this packet as the implementation plan, **no source,
test, physics-config, generated-evidence, runtime, package, or build-artifact
file may be changed for N31–N35**. This packet, the decision ledger, the charter
revision record, and vault memory are the only allowed writes in this contract
setup step.

### Must remain true

- The joystick remains a **velocity glide** on X/Z, not a position slider.
- First non-zero joystick input from `ready` enters `aiming`; zero input stops
  glide without recentering the claw.
- Drop and lift continue straight down/up from the claw's current position.
- Input is ignored during lowering, aligning, gripping, lifting, returning,
  releasing, and resetting, except for the already-approved reset command.
- Physics remains fixed-step at `1/60 s`; render timing never feeds the physics
  step.
- The dynamic head remains a real Rapier rigid body. Do not replace it with a
  visual rotation, a kinematic pose write, or a hard rotation lock.
- Do not reintroduce the removed torque spring. The prior PD spring destabilized
  the small head body and is explicitly rejected.
- Finger colliders, chamber walls, sensor-only grip evidence, adaptive carry,
  reset semantics, and collision-group ownership remain unchanged unless a
  separate contract revision is opened.

### Protected scope

- `src/state/**` state-machine semantics are protected except for tests that
  prove existing command acceptance/rejection.
- `src/physics/adapter.ts` remains the sole Rapier body/step authority.
- `src/physics/config.ts` remains the sole owner of damping, mass/inertia,
  timestep, solver, and collision parameters.
- `src/ui/joystick-math.ts` remains DOM-free and deterministic.
- No new dependency, input library, physics engine, or browser-global polling
  loop is permitted.
- No source code is changed under this packet until the contracts are accepted
  as the implementation plan.

---

## 4. N31 — Keyboard semantic mapping

### Job
Make WASD and arrow input produce the same semantic deflection as pointer
input, with correct simultaneous-key and release behavior.

### Current diagnosis
`Joystick.tsx` stores raw `KeyboardEvent.code` values (`KeyW`, `KeyA`,
`KeyS`, `KeyD`, `ArrowUp`, etc.) in `pressedKeysRef`, while
`deflectionFromKeys()` expects semantic directions (`back`, `left`, `front`,
`right`). The current path therefore feeds the math layer the wrong vocabulary
and can produce zero deflection.

### Ownership

- `src/ui/Joystick.tsx` owns DOM keyboard event binding, the active semantic-key
  set, and terminal keyboard cleanup. It translates raw browser codes before
  inserting them into that set.
- `src/ui/joystick-math.ts` owns semantic direction combination and unit-vector
  normalization; it never sees raw DOM codes.
- `src/App.tsx` remains the command/state boundary and must not interpret raw
  key codes or own the pressed-key set.
- The joystick is the **only owner of keyboard cleanup and the single terminal
  zero-deflection emission**. The coordinator remains the owner of stopping
  glide when controller state leaves aiming; it must not duplicate DOM-key
  bookkeeping.

### Contract

- `KeyW`/`ArrowUp` → `back` → `z = -1`.
- `KeyS`/`ArrowDown` → `front` → `z = +1`.
- `KeyA`/`ArrowLeft` → `left` → `x = -1`.
- `KeyD`/`ArrowRight` → `right` → `x = +1`.
- Opposing keys cancel on that axis.
- Diagonal input is normalized to magnitude 1, preserving direction.
- Key repeat does not create repeated or amplified state.
- Releasing one key preserves any still-held orthogonal key.
- Blur, unmount, disable, and transition out of aiming clear the active-key
  state and emit zero deflection at most once.
- Arrow keys prevent browser scroll while the joystick is active; unrelated
  keys remain untouched.

### Failure result

If a raw code is unmapped, the event is ignored and does not mutate the active
semantic set. If a mapping or release invariant fails, the node returns a
failed input diagnostic and the claw must not drift.

### Evidence required

1. Pure unit tests for every cardinal mapping, opposing-key cancellation,
   diagonal normalization, repeat idempotence, and release-preserves-other-key.
2. A DOM/browser interaction trace proving:
   - W moves toward back, S toward front, A left, D right.
   - W+D moves diagonally.
   - Releasing W while D remains down continues rightward movement.
   - Releasing the last key stops the claw within one fixed-step command.
   - No movement occurs in locked execution states.
3. Evidence must record the raw event code, semantic active set, emitted
   deflection, controller state, and claw position over at least 30 fixed steps.

### Stop conditions

Stop and escalate to a new contract if the fix requires changing controller
state transitions, adding continuous `keydown` polling, or changing the
world-axis convention.

---

## 5. N32 — Pointer drag continuity

### Job
Make one pointer/touch drag produce a continuous, bidirectional joystick
stream until release or cancellation, with no one-pixel stall and no accidental
one-direction latch.

### Current diagnosis boundary
The current component already calls `setPointerCapture()` and the stylesheet
already declares `touch-action: none`. Therefore the implementation must not
assume either alone explains the report. N32 must first prove the event stream
and the controlled-state feedback loop in a browser, then fix the smallest
broken boundary found.

### Ownership

- `Joystick.tsx` owns pointer identity, capture, move, release, cancel, and lost
  capture handling.
- `global.css` owns the browser gesture boundary and must preserve
  `touch-action: none` on the actual interactive pad.
- `joystick-math.ts` owns pointer coordinate-to-deflection conversion.
- `App.tsx` owns the controlled deflection state and command dispatch; it must
  not calculate pointer coordinates.

### Contract

- Pointer down establishes exactly one active `pointerId`, captures it on the
  pad, and emits an immediate deflection from the fixed pad center.
- Pointer move for the active id emits a new deflection for every delivered
  coordinate update; pointer moves from other ids are ignored.
- The pad center is measured from the stable pad rectangle, not from the moving
  knob and not from a stale initial coordinate.
- The knob is presentation-only: its transform must not change the pad's hit
  rectangle or the coordinate origin.
- Dragging to right, left, front, and back must all move the deflection
  bidirectionally; a reverse drag must reverse the emitted X/Z sign.
- Pointer up, pointer cancel, `lostpointercapture`, blur, disable, and unmount
  terminate the active drag and emit exactly one zero deflection.
- A cancelled/lost drag must never leave the glide velocity latched in one
  direction.
- Touch/pointer browser gestures must not scroll, pan, or steal the drag while
  the pad is active. `touch-action: none` is required on the interactive pad,
  not merely on an ancestor.
- The pad must remain usable at its existing desktop and narrow-screen sizes;
  enlarging the hit target is allowed, changing the control model is not.

### Failure result

If capture is not established, the pointer id changes unexpectedly, or the
active drag loses its release/cancel terminal event, the node returns a failed
input diagnostic, clears the command deflection, and leaves the claw stationary
rather than continuing with stale velocity.

### Evidence required

1. Deterministic math tests for center, cardinal, diagonal, overshoot, reverse
   direction, and a non-square/changed-rectangle coordinate sample.
2. Browser trace on the actual app:
   - press center, drag 100+ CSS pixels right, hold, reverse 100+ pixels left,
     drag front/back, release;
   - record the actual number of delivered move samples. Pass requires at
     least **three non-identical delivered samples** per 100-pixel drag,
     monotonic sign/direction change within each segment, and a clean sign
     reversal on the reverse segment. Ten samples is a useful target, not an
     uncontrollable browser requirement;
   - prove the emitted deflection changes continuously and signs reverse;
   - prove the claw moves in both directions and stops after release;
   - prove no `pointercancel`/scroll steals a normal mouse drag;
   - repeat with touch emulation if available.
3. The trace must capture `pointerId`, event type, pad rect, pointer coordinate,
   emitted deflection, sample count, terminal event, and `data-n7-state`/claw
   position. A screenshot alone is insufficient.

### Stop conditions

Stop and escalate if the browser reveals an environment-specific pointer
capture bug requiring a polyfill, pointer-lock API, or third-party gesture
library. Do not silently replace pointer events with a polling loop.

---

## 6. N33 — Head weight and wobble tuning

### Job
Tune the dynamic head so collision response reads as weighted and damped,
without removing real rigid-body response or making the head visually locked.

### Ownership

- `src/physics/config.ts` owns the versioned candidate values for head density,
  mass/inertia policy, angular damping, and any allowed solver/friction tuning.
- `src/physics/adapter.ts` owns application of those centralized values when
  constructing the body. No per-frame damping hack or visual quaternion clamp.
- N34 owns deterministic trace assertions; N35 owns the human feel verdict.

### Contract

- The head remains dynamic and collision-driven; contacts can still tilt the
  entire head and its attached finger colliders.
- No torque spring, angular teleport, visual-only tilt, hard rotation lock, or
  direct per-frame quaternion correction is allowed.
- Prefer physical mass/inertia and angular damping changes over arbitrary
  velocity zeroing. If density/mass changes, record the value and rationale in
  the fixed-step policy revision.
- The chosen feel must be **heavy but responsive**:
  - after a standardized collision impulse, the head may have one clear impact
    response but no repeated multi-cycle wobble;
  - the dimensionless response envelope must decay to ≤10% of its post-impact
    peak by 45 fixed steps (750 ms) and ≤5% by 60 steps (1 s);
  - angular velocity must be ≤0.05 rad/s and orientation deviation ≤2° from
    settled upright by step 60;
  - there must be no more than one sign reversal in the dominant oscillation
    axis after the impact peak;
  - during a full-speed joystick glide, the carriage must remain responsive and
    the head must not visibly lag or oscillate independently without a
    collision.
- If the exact numerical target conflicts with the visual gate, the node fails
  and proposes a measured contract revision; it does not weaken the threshold
  silently.

### Standardized physics trace

The evidence fixture must use the existing fixed-step `dt = 1/60 s`, the
adapter's captured baseline head pose, the carriage fixed at `[0, 2.8, 0]`, and
a no-impact control run. The reference upright quaternion `q0` is the exact
`adapter.baselineTransform('head').quaternion` captured before any fixture
steps; the fixture must record all four `[x, y, z, w]` components and assert that
this baseline is the identity upright pose within the existing repeat-position
quaternion tolerance before applying the impact. The impact run settles for 30
steps, then applies exactly one recorded world-space angular impulse
`J = [0, 0, 0.05]` in Rapier angular-impulse units; the test records the applied
vector and must use the engine's supported impulse API or an equivalent
single-step deterministic fixture, never an ongoing force/spring. It then
records at least 90 steps.

Each sample records:

- head quaternion and shortest-angle orientation error `theta_t` in radians
  from `q0`;
- the signed angle `signedTheta_t` in radians around the dominant axis, with
  quaternion sign chosen consistently against `q0`;
- world angular velocity vector and `omega_t = |angularVelocity|` in rad/s;
- carriage position, prize/contact state, and fixed-step index.

Because radians and rad/s are different units, the wobble score is explicitly a
**dimensionless response envelope**, not physical energy:
`R_t = 0.5 * ((theta_t / theta_peak)^2 + (omega_t / omega_peak)^2)`.
`theta_peak` and `omega_peak` are the respective non-zero maxima from impact
through step 30; the fixture fails as undefined if either peak is zero. The
reported `R_peak` is the maximum `R_t` over that same impact window, and the
settling gates require `R_45 / R_peak ≤ 0.10` and `R_60 / R_peak ≤ 0.05`, while
also enforcing the absolute angular-velocity and orientation limits above.

The dominant oscillation axis is the normalized quaternion-error axis at the
sample where `R_peak` occurs. A sign reversal counts only when that axis's
`signedTheta_t` crosses zero by more than 0.5°; this makes the wobble count
deterministic instead of visual guesswork. The no-impact control must remain
within the existing idle-position, idle-velocity, and repeatability tolerances
recorded in `N6_PHYSICS_CONFIG.tolerances`.

### Failure result

- If the head still exhibits repeated wobble or fails the 60-step decay gate,
  return `head-feel-failed` with the trace and candidate values.
- If the head becomes rotation-locked, loses collision response, or makes the
  prize/carry evidence fail, return `physics-authority-regressed`.
- If the fix passes deterministic metrics but fails Eli's visual weight gate,
  return `visual-feel-failed` and preserve the trace for the next bounded
  tuning iteration.

Failure artifacts are written only during implementation/verification, not in
this contract-only step, using these schemas:

- `records/evidence/n31-keyboard-trace.json`: raw code, semantic set,
  deflection, state, claw samples, terminal reason, pass/fail.
- `records/evidence/n32-pointer-trace.json`: pointer id, event sequence,
  pad rectangles, coordinates, deflections, sample counts, terminal event,
  scroll/cancel observations, pass/fail.
- `records/evidence/n33-head-feel.json`: fixed-step policy revision, candidate
  physics values, impulse vector, 90-step samples, decay/sign-reversal metrics,
  no-impact control, carry regression result, pass/fail.
- `records/evidence/n34-integration.json`: combined input/state/physics results
  plus commands and full-suite verification output.

The node that owns each artifact is the node that produces it: N31, N32, N33,
and N34 respectively.

### Evidence required

- Deterministic n6 test for no-impact rest stability and standardized impact
  decay.
- N7 integrated trace proving joystick travel remains responsive before and
  after impact, and the carry/release cycle still completes.
- Human visual gate: the head should read as weighted, settle decisively, and
  retain believable collision tilt rather than wobbling like a loose spring.
- Performance evidence against the existing desktop/WebGL2 budget; no added
  per-frame polling or unbounded solver work.

---

## 7. N34/N35 integration and promotion gates

### N34 — Integrated deterministic verification

- Run the full input/state/physics path with keyboard and pointer controls.
- Confirm no stale velocity after key release, pointer release, pointer cancel,
  lost capture, blur, reset, or state transition.
- Confirm the existing finger collision, adaptive carry, reset, and repeatability
  contracts remain green.
- Required commands after implementation: `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run build`.

### N35 — Human visual and performance gate

Eli's gate checks three things in the live app:

1. WASD gives immediate, correctly oriented movement and stops on release.
2. Pointer drag follows the cursor continuously in all four directions and
   reverses cleanly.
3. The head has visible weight: one believable impact response, fast decisive
   settling, and no loose repeated wobble.

N35 is not passed by a green test suite alone. The browser trace and deterministic
reports are evidence; the visual feel decision remains Eli's product gate.

---

## 8. Candidate-tuning discipline

N33 must start with the smallest candidate set: existing `angularDamping`,
then (only if damping alone cannot meet both the deterministic and visual gates)
head density/mass/inertia. Friction and solver changes are last-resort candidates
because they affect prize contact and carry behavior. Each candidate is one
ratchet iteration: change one parameter family, run the N33 trace and existing
N6/N7 tests, keep only an improvement, and revert regressions. No silent
threshold weakening or multi-parameter bundle is allowed.

## 9. Recommendation

**Implement N31 and N32 first, in parallel, then N33.** The WASD diagnosis is
already proven from the current code. Pointer drag needs event-stream evidence
before choosing the exact fix because `setPointerCapture` and `touch-action: none`
already exist. Tune head weight only after input reliability is restored so the
visual gate measures a usable control, not a broken one.
