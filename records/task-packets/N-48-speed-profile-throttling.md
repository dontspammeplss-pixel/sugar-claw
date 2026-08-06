# N-48 — Speed-profile throttling + speed/success tradeoff

**Bottom line:** N48 wires F-08's travel term: a config-tunable per-phase
speed/acceleration profile (free positioning fastest; descent/close/lift
slowest; conservative defaults) is applied by the phase scheduler, and the
carriage's measured travel acceleration feeds `RequiredHoldForce` (F-01) in the
adapter — replacing the reserved `travelAcceleration: 0` slot — so slower
movement retains better by physics, not by lookup table.

## Retain

- `holdRequiredForce()` keeps its declared structure (`adapter.ts`): the travel
  term is the declared slot `travelAcceleration` (`config.ts` `retention`),
  now fed per fixed step by the measured/scheduled carriage acceleration
  instead of the reserved zero constant.
- The adapter remains the sole Rapier/step authority; the profile is applied by
  the coordinator's phase scheduler (motion scheduling only) and consumed by
  the adapter — no new physics body, joint, or solver work (fixed-step policy
  untouched).
- N23 aim-glide semantics are preserved byte-for-byte: `GLIDE_SPEED_X = 1.8` /
  `GLIDE_SPEED_Z = 0.9` u/s velocity glide with per-axis bounds clamp
  (`n7-coordinator.ts:860-862`, `420-442`). Only duration-scheduled phases get
  the profile; glide stays velocity-based.
- Motion completion stays normalized and epoch-safe (A-40): completion remains
  position-based (`positionsMatch` vs `tolerances.travel`), never
  duration-based, so profile-driven durations cannot desync run epochs.
- Determinism (A-27) / no-randomness (A-07): the profile is fixed-step
  reproducible; the fast-vs-slow carry fixture is a deterministic outcome of the
  hold balance, not a probability.
- Grip onset (`grip-evaluator.ts`) is unchanged; the coupling affects retention
  only, never onset or state transitions. Profile keys live in a dev/ops
  namespace (F-11/C-10) — never player save data.
- The travel-accel term is bounded and monotone like the swing term (N47
  precedent): more travel acceleration ⇒ non-decreasing required force.
- The profile defaults keep the return legs at their baseline feel (fast)
  while descent/lift become the slowest band (measured trace: descent/lift
  avg ≈1.6–1.2 u/s vs return traverse/descent ≈2.6/3.7 u/s). Conservative
  and never sluggish.

## Caveats

- Travel acceleration is a kinematic/scheduled term — derived from the
  carriage's commanded motion and sampled in the fixed step (the swing-term
  pattern); it is not a torque spring, not a visual correction, and not a
  scripted release. If step-wise acceleration is noisy, the versioned
  smoothing-window approach from `swingTransfer` applies.
- Defaults are intentionally conservative (spec §7 #7) and config-tunable; the
  exact slow-phase values are open decision 3 (packet §9) pending Eli — the
  `feel-sluggish-default` failure result is Eli's visual gate, not a code test.
- The packet's as-cited line numbers (`n7-coordinator.ts:632-636`,
  `adapter.ts:1170-1202`) reference a pre-N47 revision; the claims they support
  were re-verified against the current tree (glide constants at `:860-862`;
  reserved travel slot at `adapter.ts:2023-2027`).
- The fast-vs-slow fixture uses identical grip voltage: the drop must come from
  the higher travel term pushing `RequiredHoldForce` above `GripCapacity` —
  otherwise it's `tradeoff-unphysical`.
- **Delivery fragility found (flagged, not fixed):** the open-pose finger-
  collider ring (radius 0.30) can wedge a 0.22-radius prize if the head is
  perfectly upright at release — baseline delivery depended on the head still
  tilting from the fast return. N48's defaults keep the return legs at
  baseline speeds, so delivery behavior is preserved byte-for-byte; the
  profile is config-tunable, and gentler return tuning may re-expose this.
  Recommended follow-up: N42/C-07 robustness (open the finger colliders at
  release) — out of N48 scope.

## Do not infer

- Do not infer the travel term predates N48: it was the reserved zero slot
  (`config.ts:64`, `adapter.ts:2023` comment); N48 wires the measured value.
- Do not infer the profile adds state-machine transitions or alters the
  fixed-step policy — if it cannot be applied without either, stop (contract
  stop condition).
- Do not infer any change to N23 glide semantics, the head body strategy
  (A-01), the spherical joint contract, dependencies, or the animator contract
  (W-06 extraction already landed).
- Do not infer the profile is a retention lookup table: "slower = more stable"
  is emergent from F-01 via the travel-accel term.

## Sources

- Authoritative contract: N48 (approved 2026-08-05) — matches outline row verbatim.
- Outline row: `records/task-packets/todo/N47-N51-feel-rigging-pendulum-speed-ops.md` §6.
  (Flag: `claw-app-node-contract-outline.md` not found in the vault; packet §6 used as the row.)
- Repo: `src/physics/config.ts`, `src/effects/n7-coordinator.ts`,
  `src/physics/adapter.ts`, `src/animation/travel-animator.ts`,
  `src/evidence/n48.test.ts`, `src/evidence/n48-evidence.ts`,
  `records/evidence/n48-speed-trace.json` (result: pass — 6/6 gates).
- Contract: [[C-06-retention-physics|C-06 — Retention Physics]] (rev 3, F-08).
- Feature spec: F-08 (§3), §4 retention balance, §7 #7.

**Status:** Implemented — verified (2026-08-05)
**Last checked:** 2026-08-05
**Review by:** 2026-11-05
