# Fixed-Step Policy (rev 1)

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| **Status**      | Approved — Gate 1 baseline revision 1 (2026-08-01) |
| **Baseline**    | `gate-1-baseline-rev1`                             |
| **Resolves**    | A-25, A-27                                         |
| **Consumed by** | Physics implementation nodes (N6 and later)        |

## Policy

1. **One centralized configuration.** A single physics-configuration module/constant set owns gravity, fixed timestep, solver iterations, CCD, sleeping, damping, friction, and restitution. No component may carry ad-hoc physics parameters.
2. **Fixed timestep.** Rapier is stepped at a fixed `dt = 1/60 s` (16.666… ms). No variable/varying timestep. If render timing differs, presentation-layer interpolation is allowed; it never feeds back into the physics step.
3. **Deterministic fixtures.** Repeated runs of an identical input/fixture under the fixed-step policy must produce comparable results within recorded tolerances. Cross-browser bit-exactness is **not** claimed; **tolerance-based repeatability evidence** is the claim (A-27).
4. **Tolerance recording.** Every physics scenario record includes: the fixed-step configuration revision, per-claim tolerances (position, rotation, jitter, carry deviation), and the observed values.
5. **Change control.** Changing the fixed-step configuration is a versioned-contract revision. An implementation node that needs a different step must stop and escalate; it may not silently restep.

## Configuration record template

```text
step: 1/60 s (fixed)
gravity: [recorded vector]
solver iterations: [recorded]
CCD: [on/off for which bodies]
sleeping: [enabled/disabled, thresholds]
damping / friction / restitution: [recorded values]
```

The resolved numbers are recorded with the first physics scenario evidence; the policy structure above is binding now.

## Repeatability claim format

> "Scenario X repeated N times: outcome identical; max deviation within [tolerance] for [position/rotation/carry] under fixed-step rev 1."

A claim without the configuration revision and tolerances is not repeatability evidence.
