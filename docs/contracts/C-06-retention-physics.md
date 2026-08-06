# C-06 — Retention Physics (rev 4: F-07 pendulum + F-08 speed profile + F-10 middle path / F-09 emergent braking)

**Status:** Draft rev 1 → Approved rev 2 for N41/N47 (2026-08-05) → Approved rev 3 for N48/F-08 (2026-08-05) → Rev 4: F-10 decided (A-44, middle path) + F-09 emergent braking (N49, evidence-only, implemented + verified 2026-08-05)
**Authority:** physics system (fixed-step solver; extends C-03 physics policy)
**Baseline:** `claw_app` @ main (N47 implemented on `f97da6f`)

## Rule

A gripped prize is held by a **continuous force model**, not a rigid joint.
Retention fails only when the force required to hold the prize exceeds grip
capacity — every failure is physically motivated, never a random drop. Rev 2
adds one live input to that model: the head's real pendulum swing (angular
acceleration), sampled in the fixed step and mapped through a versioned,
monotone, bounded transfer into `RequiredHoldForce`. Swing is feed-forward only —
no torque feedback. Rev 3 (N48, F-08) adds a second live input: the carriage's
measured travel acceleration, driven by the per-phase speed/accel profile
(free positioning fastest; descent/close/lift slowest; conservative,
config-tunable defaults), sampled in the fixed step and fed into
`RequiredHoldForce` — so slower movement retains better by physics (the travel
term replaces the reserved zero slot). Rev 4 (N50/A-44, F-10) gives travel and
grip **one voltage meaning**: per-phase max speed/acceleration derive from the
same 12–36V voltage parameter (default 24V) via a versioned, clamped transfer;
braking into targets (F-09) is **emergent** from that profile — N49 evidences
it, with no braking-specific code.

## Body

### Scope — in

1. **Replace the rigid carry joint** with a hold model evaluated each fixed
   physics step (N41, implemented).
2. **Keep the existing approval gate as grip *onset*** (sensor + solver contacts
   + capture envelope). It now means "gripped," not "won."
3. **Hold model** (per fixed step, N41 + N47):
   - `GripCapacity = f(gripVoltage 12–36V → maxHoldForce, padFriction μ, contact geometry, grip points on prize)`
   - `RequiredHoldForce = f(prizeWeight, pendulum swing accel [F-07, N47], travel accel [F-08, N48], CoM-offset torque τ = m·g·d, packing collisions [F-06, reserved 0])`
   - Failure when `RequiredHoldForce > GripCapacity` → slippage → **mid-carry release** (prize falls; may still win if it reaches the chute — see C-07).
4. **F-07 pendulum coupling (N47, implemented):**
   - `src/physics/config.ts` owns the versioned transfer
     `swingAccelerationToLinearAcceleration` and its parameters
     (`swingTransfer`: reference angular acceleration 40 rad/s², max linear
     contribution 12 m/s², 4-step window; `retention.revision` bumped to
     `n47-swing-rev1`). Damping stays in the fixed-step policy.
   - `src/physics/adapter.ts` samples the head's angular acceleration each fixed
     step and feeds the F-01 balance; no visual quaternion writes, no torque
     springs (N26 lesson). The measured term is published on the retention state.
   - `src/effects/n7-coordinator.ts` travel profiles may create the swing (sudden
     stops) but must not fake a release.
5. **F-08 travel speed profile (N48, implemented + verified):**
   - `src/physics/config.ts` owns the per-phase profile (max speed + max accel
     per phase: free positioning fastest; descent/close/lift slowest;
     conservative, dev/ops-namespace, config-tunable) and the versioned,
     bounded, monotone travel-accel transfer; `retention.revision` bumps to
     `n48-speed-rev1`. The declared `travelAcceleration` slot is fed per step
     instead of the reserved zero.
   - `src/effects/n7-coordinator.ts` applies the profile in the phase scheduler
     with position-based, epoch-safe completion (A-40); N23 velocity glide
     (`GLIDE_SPEED_X = 1.8` / `GLIDE_SPEED_Z = 0.9`, per-axis clamp) unchanged.
   - `src/physics/adapter.ts` consumes the scheduled travel accel in
     `holdRequiredForce()` (replaces the reserved zero).
6. **Expose retention state on the evidence bus** (capacity, required, margin,
   torque, swing acceleration, travel acceleration, release event).
7. **F-10 voltage-parameterized travel (N50/A-44, decided) + F-09 emergent
   braking (N49, evidence-only, done 2026-08-05):**
   - `src/physics/config.ts` owns the versioned `voltage → {maxSpeed, maxAccel}`
     per-phase transfer (12–36V, default 24V) with clamps; at 24V the derived
     profile reproduces the current `travelProfile` byte-for-byte; revision
     bumps (`n50-voltage-rev1`); `travelTransfer` bounds remain the cap.
   - `src/effects/n7-coordinator.ts` consumes the derived caps in the existing
     phase scheduler — motion scheduling only, no new transitions (C-02); N23
     glide untouched.
   - Braking/settle into targets (F-09) **emerges** from the voltage-derived
     accel profile; N49's deliverable is evidence (deceleration visible, no
     snap at release, no overshoot, fixed-step reproducible) — no
     braking-specific code.
   - Decision record: `docs/contracts/ADR-F-10-force-source-model.md`; ledger
     A-44 (Revision 5, 2026-08-05).

### Scope — out (explicit non-goals)

- **Full drive-train simulation (F-10):** out of scope — N50/A-44 chose the
  middle path (voltage-parameterized travel, in scope above). Full simulation
  requires a separate contract revision with its own risk plan.
- **Standalone braking code (F-09):** not needed — braking is emergent from the
  voltage-derived profile; N49 evidences it.
- **Economy / payout (F-12):** separate contract C-09; this contract only exposes
  a win hook.
- **Player-facing strength controls:** forbidden — ops-only per C-10.
- **Prize geometry / rigs (F-04, F-05):** separate contract C-08; this contract
  consumes `mass` / `centerOfMass` / `gripPoints` from the prize manifest.

### Interfaces & data flow

- Hold model lives in `src/physics/adapter.ts` (evaluated inside the fixed step);
  `src/physics/config.ts` owns all versioned parameters.
- Config keys: `gripVoltage` (12–36V), `padFriction` μ, per-prize `weight` /
  `centerOfMass` / `gripPoints` (prize manifest, C-08), `swingTransfer` (F-07),
  per-phase `travelProfile` (F-08, N48 — dev/ops namespace), `voltage → profile`
  transfer (F-10, N50 — dev/ops namespace).
- Evidence events: `grip-onset`, `hold-failure`/`mid-carry-release`
  (`hold-margin-negative`), plus the published retention state.

## Workstream (merged from W-09 — retired 2026-08-03; N41/N47)

- **Phase:** A (N41) and C (N47, F-07; N48, F-08; N50, F-10; N49, F-09)
- **Files:** `src/physics/config.ts`, `src/physics/adapter.ts`,
  `src/evidence/n47.test.ts`, `src/evidence/n47-evidence.ts`
- **Execution status:** N41 implemented + verified (2026-08-04); **N47 implemented
  + verified (2026-08-05)** — see node `N-47-pendulum-swing-retention-coupling.md`
  and `records/evidence/n47-swing-coupling.json`. **N48 implemented + verified
  (2026-08-05)** — see node `N-48-speed-profile-throttling.md` and
  `records/evidence/n48-speed-trace.json`. Full gate green at N48
  (typecheck / lint / 20 files / 95 tests / build); N23 glide/bounds tests
  intact. **N50 decided (2026-08-05): F-10 middle path (A-44)** — ADR
  `docs/contracts/ADR-F-10-force-source-model.md`, ledger Revision 5. **N49
  (F-09, evidence-only):** **implemented + verified (2026-08-05)** —
  emergent-braking trace GREEN, 6/6 gates
  (`records/evidence/n49-braking-trace.json`): deceleration into target
  (arrival ≤ 0.03% of peak), no snap at release (positionsMatch completion
  gate), no overshoot, config-driven (descent accel sweep), fixed-step
  repeatable, N23 glide intact; no braking code — emergent per A-44. Full gate
  green (typecheck / lint / 21 files / 96 tests / build).
- **Definition of done:** retention tests green; mid-carry release emitted on the
  evidence bus; N47 swing fixture releases a 12V grip and holds a 36V grip under
  the same sharp swing; sweep monotone + bounded; at-rest balance unchanged; N48
  profile trace + fast/slow tradeoff green; N49 emergent-braking trace green.

## Verification

- **Deterministic test (N41):** low voltage + heavy prize → mid-carry drop; high
  voltage + same prize → hold.
- **Torque test (N41):** off-center grip on heavy prize → rotates/frees under
  torque; centered grip → holds.
- **Pendulum test (F-07, N47):** sharp swing with low voltage → release; high
  voltage → hold. Weak grip margin −2.23 N at release; strong grip holds with
  +46.26 N final margin. Evidence: `records/evidence/n47-swing-coupling.json`.
- **Sweep test (N47):** required force non-decreasing in swing magnitude
  (4.24 → 8.48 → 12 → 12 m/s², saturating at the bound).
- **Speed test (F-08, N48):** identical 12V grip — fast carry releases at step
  9 (`hold-margin-negative`, peak travel accel 11.25 m/s², final margin
  −5.12 N) while the slow carry holds (+9.94 N final margin, peak travel accel
  4.5 m/s²). Two independent fast runs are byte-identical
  (`records/evidence/n48-speed-trace.json`, result pass, 6/6 gates).
- **Profile trace (N48):** measured per-phase step velocities obey the profile
  (descent/lift avg 1.575/1.176 ≤ 1.6 u/s cap; return 2.599/3.690 ≤ caps;
  free positioning declared fastest, descent/lift slowest).
- **Voltage tradeoff fixture (F-10, N50):** exists from N48 —
  `records/evidence/n48-speed-trace.json` (fast 12V drops / slow same-grip
  holds; byte-identical repeat) — the middle-path evidence requirement.
- **Emergent-braking trace (F-09, N49, done 2026-08-05):** every
  duration-scheduled phase (descent/lift/returnTraverse/returnDescent) shows
  deceleration into target (measured arrival ≤ 0.03% of peak velocity; peak
  interior, tail monotone), no snap at release (arrival ≈ 0 u/s +
  positionsMatch vs tolerances.travel completion gate), no overshoot (positions
  within [start, target]); fixed-step repeatable (byte-identical repeat); glide
  unchanged ([X,Z] = [1.8, 0.9], excluded from braking gates); braking is
  config-driven (descent accel sweep 5→10→20: 1892→1338→946 ms).
  Evidence: `records/evidence/n49-braking-trace.json`. Finger closure (“close”
  leg) is the ClawPoseAnimator pose (open→closed, 120ms), not scheduled
  travel; excluded from travel braking gates by design (see trace coverage).
- **Event test:** mid-carry release is a distinct evidence event (not "miss").
- Full gate at N48: `npm run typecheck`, `npm run lint`, `npm test`
  (19 files / 94 tests), `npm run build` — all green; N33 head-feel trace
  unchanged.

## Open questions

1. Exact `voltage → maxHoldForce` curve values (tuning; default: linear 12–36V).
2. Does grip strength also affect the grip-onset envelope, or only retention?
   (Recommend: onset unchanged, retention only.)
3. ~~Confirm F-08 speed→retention coupling~~ **Resolved (2026-08-05): physics-driven
   per spec §4 — N48 wires the measured travel accel into `RequiredHoldForce`.**
4. F-10 voltage namespace: does the shared `voltage` live in the F-11 dev/ops
   namespace (default 24V) with per-phase override knobs? (Recommend yes — C-10.)
