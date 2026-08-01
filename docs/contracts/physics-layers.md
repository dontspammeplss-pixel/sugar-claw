# Physics Layers

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Baseline:** `gate-1-baseline-rev1`  
**Important:** The resolved groups, matrix, and policy are the versioned contracts in `records/contracts/`; this document is the descriptive layer reference.

## Physics authority

The Rapier adapter/world owns stepping, dynamic body transforms, velocities, contacts, collision response, and body reset. Components must not contain ad-hoc collision masks. Dynamic prize bodies cannot be overwritten continuously by render or animation code.

A-01 (approved): **hybrid** — a kinematic claw root driven through the physics adapter within `ClawMount`'s legal travel volume; dynamic Rapier prize/environment. Fingers are visual-only with dedicated sensor proxies (A-02/A-23).

## Collision groups (resolved — versioned in `records/contracts/collision-matrix.md`)

| Group         |      Bit | Intended contents                              |
| ------------- | -------: | ---------------------------------------------- |
| `environment` | `1 << 0` | floor, walls, chute, static machine bounds     |
| `prize`       | `1 << 1` | dynamic prize colliders                        |
| `clawBody`    | `1 << 2` | carriage/head kinematic proxy (A-01)           |
| `clawFinger`  | `1 << 3` | reserved — unused in v1 (visual fingers, A-02) |
| `sensor`      | `1 << 4` | grip/contact sensor proxies                    |
| `debug`       | `1 << 5` | diagnostics; normally non-colliding            |

## Interaction matrix (resolved)

All `optional` cells are resolved in the versioned matrix (`records/contracts/collision-matrix.md`, rev 1); no runtime selection remains. The descriptive table below shows the approved shape.

| A \\ B      | Environment | Prize | Claw body | Claw finger | Sensor |
| ----------- | ----------: | ----: | --------: | ----------: | -----: |
| Environment |           — |     ✓ |         ✓ |           — |      — |
| Prize       |           ✓ |     — |         ✓ |           — |      ✓ |
| Claw body   |           ✓ |     ✓ |         — |           — |      ✓ |
| Claw finger |           — |     — |         — |           — |      — |
| Sensor      |           — |     ✓ |         ✓ |           — |      — |

Collision-group eligibility is separate from sensor versus solver response. Sensor configuration must be explicit and visible in diagnostics.

## Physics rules

- Contact/intersection observations are minimum evidence for a grip; visual overlap never decides a grip.
- Grip evaluation is performed by the approved evaluator using approved contact evidence and is reported to the state controller through the effect coordinator.
- Gravity, fixed timestep, solver settings, restitution, friction, damping, CCD, and sleeping are centralized in the versioned fixed-step policy (`records/contracts/fixed-step-policy.md`, rev 1).
- A physics reset restores translation, rotation, linear/angular velocity, forces, sleeping state, contacts/accumulators, and adapter bookkeeping for every registered body.
- A successful carry uses the versioned attachment primitive (`records/contracts/attachment-primitive.md`): an explicit Rapier-supported carry constraint created/removed by the physics adapter (A-03/A-26).
- A failed carry must follow the approved failure treatment; no hidden teleport or accidental visual parenting is allowed.
- The first scenario uses one claw, one prize, and one environment fixture unless A-08 changes that scope.

## Required physics evidence

A physics node must prove idle stability, legal travel bounds, allowed/forbidden collision pairs, contact versus visual-overlap behavior, an approved success fixture, an approved failure fixture, reset restoration, and repeated-run behavior with documented tolerances or seeded variance. Parameters and collision decisions must be recorded with the scenario evidence.
