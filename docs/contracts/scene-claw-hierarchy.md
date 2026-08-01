# Scene and Claw Hierarchy

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Baseline:** `gate-1-baseline-rev1`

## Logical scene graph

```text
AppShell
├── Canvas
│   └── SceneRoot                         # sole world-origin anchor
│       ├── LightingRoot                  # static environment presentation
│       ├── CameraRig                      # review-camera presets
│       ├── MachineRoot                    # static machine placement
│       │   ├── MachineVisuals             # frame, panels, glass, trim, chute
│       │   ├── MachineCollisionProxies    # later Rapier environment colliders
│       │   └── ClawMount                  # legal travel space and home transform
│       │       └── ClawSystem             # one logical claw instance
│       ├── PrizeRoot                      # prize visual grouping/registration
│       ├── PlayfieldRoot                  # floor, walls, chute, catch area
│       └── DebugRoot                      # opt-in, read-only diagnostics
└── OverlayRoot                            # later DOM HUD/debug UI
```

Names are contract names; they need not be implemented in one component. `SceneRoot` is the sole world-origin anchor. No child subsystem applies a second global scale or rotation.

## Scene rules

- `MachineRoot` owns static authored placement and does not become per-frame gameplay state.
- `ClawMount` defines legal travel bounds and local coordinates; it does not own logical state.
- Visual meshes and collision proxies are separate so their geometry can be inspected independently.
- `PrizeRoot` groups and registers prize instances; Rapier owns dynamic prize transforms after physics is active.
- `DebugRoot` can display state, contacts, colliders, axes, and transforms but cannot write gameplay truth.
- React remount creates exactly one scene instance and one registration per logical entity; no module-level mutable Three.js singleton is allowed.
- R3F owns visual object creation, parenting, visibility, and disposal. It cannot decide a grip or overwrite a Rapier-owned dynamic root every frame.

## Claw rig

```text
ClawSystem                              # logical instance boundary
├── ClawPhysicsRoot                     # physics-adapter handle; no required visual mesh
└── ClawVisualRoot                      # rendered representation
    ├── Carriage                         # gantry attachment
    ├── Cable                             # visual cable
    ├── HeadRoot                          # rigid head assembly
    │   ├── HeadMesh                      # shell/housing
    │   ├── GripCenter                    # logical grip reference marker
    │   └── FingerRig                     # local articulation space
    │       ├── FingerPivot_0
    │       │   └── FingerMesh_0
    │       ├── FingerPivot_1
    │       │   └── FingerMesh_1
    │       └── ...                        # count is an approved design/asset choice
    └── ClawDebugRoot                     # optional axes/contact markers
```

`ClawPhysicsRoot` is a logical adapter boundary, not an additional Three.js parent contributing a second transform. The Rapier body is registered in world space. Visual synchronization converts that pose to `ClawMount`-local space exactly once before assigning `ClawVisualRoot`; neither tree writes directly into the other.

## Rig rules and conceptual interface

- Imported nodes are mapped to these stable contract names; gameplay cannot depend on exporter-generated names.
- A-01 (approved): **hybrid** — the claw root is kinematic via `ClawMount` and receives targets through the physics adapter; the prize/environment remain dynamic Rapier bodies.
- A-02/A-23 (approved): fingers are **visual-only with dedicated sensor proxies**; no physical finger colliders in v1.
- A-03 (approved): a successful grip is an **explicit Rapier-supported carry constraint** (`records/contracts/attachment-primitive.md`); never visual parenting.
- `HeadRoot` remains rigid during finger articulation.
- Every controlled pivot has a named baseline and absolute targets for `home`, `raised`, `lowered`, `open`, `closed`, and `reset`.
- Reset restores targets from baseline data; it never negates current rotations.
- `GripCenter` is a logical marker for the evaluator, not automatically a collider or win condition.
- The first interaction contains one claw only; multi-claw support requires a contract extension.

```text
ClawRigDefinition
  controlledPivots: named pivot -> baseline + pose targets
  gripReference: local transform
  legalTravelVolume: mount-local bounds

ClawPoseAdapter
  applyPoseTarget(pose)
  cancelPresentation()
  restoreBaseline()

ClawPhysicsAdapter
  readAuthoritativePose()
  setKinematicTarget(target)       # A-01 approved: kinematic claw root via ClawMount
  resetBody(snapshot)
```

These are conceptual interfaces, not implementation authorization.
