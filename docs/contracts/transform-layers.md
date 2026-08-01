# Transform Layers

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Baseline:** `gate-1-baseline-rev1`

## Layer model

```text
Local visual composition:
L0  Asset-local authored transform
L1  Rig/pivot local transform
L2  Named pose target

World placement and authority:
L3  Static MachineRoot / ClawMount placement
L4  Authoritative physics-body world pose
L5  Read-only visual synchronization
L6  Camera/presentation-only effects
```

For a static or visual-only claw, the world pose is L3 plus approved L0–L2 local composition. For a physics-owned root, a `ClawMount`-local target is converted to world space once before submission to Rapier. Rapier owns the resulting world pose at L4; the visual adapter reads it and applies approved L1–L2 articulation in the visual hierarchy. L3 is not reapplied as a competing per-frame correction after Rapier output.

The code may compose these layers differently internally, but it must preserve their ownership and ordering.

## Rules by layer

- **L0 — authored asset:** immutable at runtime. Unit and axis conversion happens once at the asset boundary.
- **L1 — rig/pivot:** defines local articulation only; no world-space gameplay correction.
- **L2 — pose target:** uses explicit absolute targets and cancellable interpolation; never derives a new baseline by negating current rotation.
- **L3 — static placement:** machine/mount configuration; not recomputed from game state.
- **L4 — physics pose:** Rapier owns translation, rotation, velocity, and collision response. A kinematic body receives targets only through the physics adapter.
- **L5 — visual sync:** reads the authoritative physics pose and applies one approved local conversion. No second writer updates the same root.
- **L6 — presentation:** camera shake, UI motion, and marketing/scroll effects affect only presentation-owned objects. They cannot move gameplay objects without approval.

## Transform classification test

Every controlled transform must be exactly one of: authored baseline, static placement, pose target, physics pose, or presentation-only offset. Any unclassified per-frame mutation is a contract violation and must stop the node.

## Coordinate contract

A-36 (approved, rev 1): the canonical world convention is **meters, Y-up, right-handed, `SceneRoot` origin**. Implementations may not silently choose conversion constants. Aim and travel targets are authored in `ClawMount`-local **meters**, continuous and bounded (A-09), clamped to the legal volume, and converted at the physics/presentation adapter boundary exactly once.
