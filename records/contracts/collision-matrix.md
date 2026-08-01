# Collision Matrix (rev 1)

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| **Status**      | Approved — Gate 1 baseline revision 1 (2026-08-01) |
| **Baseline**    | `gate-1-baseline-rev1`                             |
| **Resolves**    | A-22, A-23                                         |
| **Consumed by** | Physics implementation nodes (N6 and later)        |

## Group bits

| Group         |      Bit | Contents                                                    |
| ------------- | -------: | ----------------------------------------------------------- |
| `environment` | `1 << 0` | floor, walls, chute, static machine bounds                  |
| `prize`       | `1 << 1` | dynamic prize colliders (single prize in v1, A-08)          |
| `clawBody`    | `1 << 2` | carriage/head kinematic proxy (hybrid claw, A-01)           |
| `clawFinger`  | `1 << 3` | **reserved, unused in v1** — fingers are visual-only (A-02) |
| `sensor`      | `1 << 4` | grip/contact sensor proxies; sensor-type, observation only  |
| `debug`       | `1 << 5` | diagnostics; normally non-colliding                         |

## Interaction matrix (resolved — no optional cells)

`✓` = eligible pair. `—` = excluded pair. Sensors are sensor-type colliders: they report contacts but take no solver response (A-23).

| A \\ B      | Environment | Prize | Claw body | Claw finger | Sensor |
| ----------- | ----------- | ----- | --------- | ----------- | ------ |
| Environment | —           | ✓     | ✓         | —           | —      |
| Prize       | ✓           | —     | ✓         | —           | ✓      |
| Claw body   | ✓           | ✓     | —         | —           | ✓      |
| Claw finger | —           | —     | —         | —           | —      |
| Sensor      | —           | ✓     | ✓         | —           | —      |

## Rationale for the resolved cells

- **Prize × Prize —** one prize in v1; no prize self-collision needed.
- **Environment × Sensor —** sensors observe the prize only; they do not sense static env geometry in v1.
- **Claw finger rows —** no physical finger collider exists in v1; the group is reserved for a later contract revision.
- **Claw body × Claw finger —** rigid claw assembly; no internal collision.
- **Sensor × Claw body ✓** keeps the sensor carried by the claw body without solver response.

## Binding rules

- Eligibility is separate from sensor vs. solver response; sensor configuration must be visible in diagnostics.
- No component may contain ad-hoc collision masks; the matrix above is the single source of truth.
- Changing any cell or bit is a versioned-contract revision, not an implementation choice.
