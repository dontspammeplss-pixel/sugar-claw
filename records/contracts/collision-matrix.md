# Collision Matrix (rev 2)

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| **Status**      | Revised 2026-08-02 — N25/N26/N28 (fingers physical, head dynamic, walls) |
| **Baseline**    | `gate-1-baseline-rev1` → rev 2                    |
| **Resolves**    | A-22, A-23 (revised), A-01, A-26 (see decision ledger) |
| **Consumed by** | Physics implementation nodes (N6 and later)        |

## What changed from rev 1

- **`clawFinger` is no longer reserved.** Fingers now carry physical capsule
  colliders (N25) derived from the rig's open-pose pivot transforms. They take
  solver response against the prize and the environment (walls/floor).
- **The claw is hybrid (N26).** A kinematic carriage owns travel; a dynamic
  **head** body carries the head cuboid (`clawBody`), the finger capsules
  (`clawFinger`), and the grip sensor, joined to the carriage by a spherical
  joint (translation pinned, rotation free). The head hangs with its center
  of mass below the pivot, so gravity self-rights it like a pendulum;
  collisions tilt it. Rapier's spherical impulse joint has no angular-limit
  support, so the swing is bounded by the pendulum plus the head's own
  collider contacts with the prize, floor, and chamber walls — there is no
  joint-level hard cap.
- **Chamber walls exist (N28).** `environment` now includes four wall
  colliders sized to the visual cabinet; they contain the prize and stop the
  claw head at the glass instead of passing through it.
- **Sensor enlarged 0.24 → 0.30.** The prize shrank 0.31 → 0.22 (so it enters
  the finger cage), which thinned the sensor's reach margin at off-center
  drops to ~0.07 — the head's residual wobble could flip the contact. Radius
  0.30 restores a ~0.19 margin that stays deterministic. Sensor behavior
  unchanged: observation only, no solver response.

## Group bits

| Group         |      Bit | Contents                                                    |
| ------------- | -------: | ----------------------------------------------------------- |
| `environment` | `1 << 0` | floor + four chamber wall colliders (N28)                   |
| `prize`       | `1 << 1` | dynamic prize collider (single prize in v1, A-08)           |
| `clawBody`    | `1 << 2` | dynamic head cuboid proxy on the hybrid claw (N26)          |
| `clawFinger`  | `1 << 3` | physical finger capsule colliders, one per pivot (N25)      |
| `sensor`      | `1 << 4` | grip/contact sensor proxy; sensor-type, observation only    |
| `debug`       | `1 << 5` | diagnostics; normally non-colliding                         |

## Interaction matrix (resolved — no optional cells)

`✓` = eligible pair. `—` = excluded pair. Sensors are sensor-type colliders: they report contacts but take no solver response (A-23).

| A \ B      | Environment | Prize | Claw body | Claw finger | Sensor |
| ---------- | ----------- | ----- | --------- | ----------- | ------ |
| Environment | —          | ✓     | ✓         | ✓           | —      |
| Prize       | ✓           | —     | ✓         | ✓           | ✓      |
| Claw body   | ✓           | ✓     | —         | —           | ✓      |
| Claw finger | ✓           | ✓     | —         | —           | —      |
| Sensor      | —           | ✓     | ✓         | —           | —      |

## Rationale for the resolved cells

- **Prize × Prize —** one prize in v1; no prize self-collision needed.
- **Environment × Sensor —** sensors observe the prize only; they do not sense static env geometry in v1.
- **Claw finger × Prize ✓ and Claw finger × Environment ✓ —** physical finger
  capsules take full solver response: they push the prize during descent
  (driving the N26 contact stop) and bump the chamber walls/floor instead of
  passing through them.
- **Claw body × Claw finger —** rigid assembly on the same head body; no
  internal collision.
- **Claw finger × Claw finger —** fingers are all attached to the same head
  body; no finger self-collision.
- **Claw finger × Sensor —** the sensor's filter includes only `prize` and
  `clawBody`; a finger-capable sensor would double-count the same geometry.
- **Sensor × Claw body ✓** keeps the sensor carried by the head body without
  solver response.

## Binding rules

- Eligibility is separate from sensor vs. solver response; sensor configuration must be visible in diagnostics.
- No component may contain ad-hoc collision masks; the matrix above is the single source of truth.
- Changing any cell or bit is a versioned-contract revision, not an implementation choice.
- The finger capsules' geometry (half-height/radius) is derived from the rig's
  open pose in `src/physics/config.ts`; visual blades deliberately extend
  beyond the colliders (N25) so a kinematic descent parks on first contact
  instead of dragging rigid fingers into the prize volume.
