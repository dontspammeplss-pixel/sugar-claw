# Claw Machine 3D — Implementation Contracts

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01); refinements recorded in `docs/contracts/open-decisions.md` and `records/`  
**Scope:** Architecture only. This document defines boundaries and testable contracts; it does not implement gameplay, physics, assets, animation, input, scoring, or UI.

This contract is subordinate to the archived execution plan at `docs/archive/m1/fb_plan_graph.md` and to `BOOTSTRAP.md`. Gate 0 is approved. The Gate 1 contract baseline (A-01…A-40) was approved by the human on 2026-08-01 as baseline revision 1. No gameplay implementation is approved by this document.

> **Purpose:** The authoritative, human-approved architecture contract for the Claw Machine 3D app
> (A-01…A-40). It defines boundaries, authority, and testable invariants; it is the reference the
> gate machinery and every implementation node check against. Keep it as the single source of truth
> for architecture rules — do not fold operational procedure, node logs, or milestone summaries into it.
>
> **Formatting:** decisions use the numbered `A-##` table format; authority lives in the §4 matrix
> table; transitions use the fenced legal-transition table; protected files use the §10 ownership
> table. Status columns are historical once approved — the resolved ledger
> `docs/contracts/open-decisions.md` supersedes them. Changing a decided contract requires human
> approval and a new baseline revision record.

## Contract rules

1. Every category of runtime truth has one authoritative writer.
2. Other subsystems consume snapshots, commands, or events; they do not silently mutate another subsystem's truth.
3. Rendered overlap is not evidence of physical contact.
4. A reset is a first-class command, not a collection of inverse animations.
5. All moving parts have named pivots and explicit baseline transforms.
6. Any implementation that needs to change an unresolved decision stops and escalates to the human.

---

## 1. Scene hierarchy

The following is the intended logical scene graph. Names are contract names, not a requirement to create all nodes in one file.

```text
AppShell                                  # React/application lifecycle boundary
├── Canvas                                # R3F renderer and camera boundary
│   └── SceneRoot                         # stable world origin; no gameplay state
│       ├── LightingRoot                  # static lights/environment presentation
│       ├── CameraRig                      # camera and review-camera presets
│       ├── MachineRoot                    # machine placement in world space
│       │   ├── MachineVisuals             # frame, panels, glass, trim, chute
│       │   ├── MachineCollisionProxies    # Rapier environment colliders, later
│       │   └── ClawMount                  # legal travel volume and home transform
│       │       └── ClawSystem              # one logical claw instance
│       ├── PrizeRoot                      # prize visuals and prize body adapters
│       ├── PlayfieldRoot                  # floor, walls, chute, catch area
│       └── DebugRoot                      # opt-in diagnostics; never gameplay truth
└── OverlayRoot                            # DOM HUD/debug UI, if later approved
```

### Scene rules

- `SceneRoot` is the sole world-origin anchor. No subsystem may apply a second global scale or rotation below it.
- `MachineRoot` owns static machine placement. Its transform is authored/configuration data, not a per-frame gameplay value.
- `ClawMount` defines the legal coordinate space for claw travel. It does not own the claw's logical state.
- `MachineVisuals` contains visual meshes only. Collision proxies are separate nodes so collider dimensions and visual meshes can be inspected independently.
- `PrizeRoot` owns prize instance registration and visual grouping; Rapier owns dynamic body transforms once physics is active.
- `DebugRoot` may visualize contacts, colliders, state, and transforms but must be read-only with respect to gameplay.
- A React remount must produce one scene instance and one registration for each logical entity. No module-level mutable Three.js singleton is allowed.

### Scene composition contract

Scene composition is owned by R3F/Three.js. R3F may create, parent, show, hide, and dispose visual objects. It may not promote logical state, decide a grip, or overwrite a Rapier-owned dynamic transform every frame.

---

## 2. Claw hierarchy

The claw must be represented as an explicit rig with named pivots. Imported asset nodes may be mapped into this contract, but gameplay code must not depend on arbitrary exporter-generated names.

```text
ClawSystem                              # logical instance boundary
├── ClawPhysicsRoot                     # Rapier adapter anchor; no visual mesh required
└── ClawVisualRoot                      # rendered representation
    ├── Carriage                         # horizontal/gantry attachment
    ├── Cable                             # visual cable; follows approved vertical pose
    ├── HeadRoot                         # rigid head assembly
    │   ├── HeadMesh                      # shell/housing
    │   ├── GripCenter                    # documented grip reference point
    │   └── FingerRig                     # local articulation space
    │       ├── FingerPivot_0             # explicit pivot, not mesh origin assumption
    │       │   └── FingerMesh_0
    │       ├── FingerPivot_1
    │       │   └── FingerMesh_1
    │       └── ...                        # count is an asset/design decision
    └── ClawDebugRoot                     # optional axes/pivots/contact markers
```

### Claw rules

- `ClawVisualRoot` and `ClawPhysicsRoot` are separate authority boundaries. `ClawPhysicsRoot` is a logical physics-adapter handle, not a second Three.js parent that contributes another transform. The Rapier body is registered in world space; the visual root remains in the R3F scene hierarchy under `ClawMount`. The sync adapter converts the Rapier world pose back into `ClawMount`-local space exactly once before assigning `ClawVisualRoot`; it never assigns a world pose to that nested visual node. Neither tree may write into the other directly.
- `HeadRoot` is rigid during finger articulation. Fingers rotate around their named pivot nodes using absolute pose targets.
- The rig exposes named poses: `home`, `raised`, `lowered`, `open`, `closed`, and `reset`.
- Pose definitions contain explicit local position/quaternion targets for each controlled node. Reset applies the baseline targets; it does not negate current rotations.
- The grip reference is a logical marker used by the grip adapter. It is not automatically a collider or a win condition.
- The first interaction may contain one claw only. Multi-claw support is out of scope until the instance contract is extended.

### Required claw interface (conceptual)

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
  setKinematicTarget(target)       # only if the approved strategy is kinematic
  resetBody(snapshot)
```

These are contracts only; no implementation is authorized here.

---

## 3. State-machine states and transitions

The state controller is the only authority that promotes logical game state. Zustand may store the controller snapshot and dispatch commands, but React components, GSAP callbacks, Rapier callbacks, and input handlers may not assign the state directly.

### States

<!-- prettier-ignore -->
| State | Meaning | Entry condition | Exit condition |
| --- | --- | --- | --- |
| `booting` | App and required resources are being prepared. | Application mounted, the lifecycle emits `bootRequested`, or a retry begins. | Required scene/assets are ready (`ready`), or a load error occurs (`error`). |
| `ready` | A run can begin; baseline is stable. | Boot completed or reset completed while required assets are ready. | Valid aim input (`aiming`), reset (`resetting`), or invariant failure (`error`). |
| `aiming` | Player intent is selecting a legal horizontal target. | Aim command accepted in `ready`. | Drop/confirm (`lowering`), reset (`resetting`), or invariant failure (`error`). |
| `lowering` | Claw is traveling toward its lowered target. | Drop accepted and target pose committed. | Lowering motion reports complete (`aligning`), reset, or invariant failure. |
| `aligning` | The system settles/validates the interaction pose before grip evaluation. | Lowering completed. | Alignment complete (`gripping`), reset, or invariant failure. |
| `gripping` | Finger pose/contact observation is being evaluated. | Alignment completed. | Grip result committed (`lifting`), reset, or invariant failure. |
| `lifting` | Claw is moving to the lift height after grip evaluation. | Grip attempt committed. | Lift motion complete (`returning`), reset, or invariant failure. |
| `returning` | Claw is moving to the delivery/home return target. | Lift completed. | Return motion complete (`releasing`), reset, or invariant failure. |
| `releasing` | Release pose/action is being performed. | Return completed. | Release complete (`result`), reset, or invariant failure. |
| `result` | The outcome is stable and exposed for presentation. | Release completed with an approved success/failure outcome. | Reset, or an explicitly approved next-run command. |
| `resetting` | A reset transaction is restoring all layers. | Reset accepted from any state. | Baseline restored and assets ready (`ready`), assets unavailable (`booting`), or reset failure (`error`). |
| `error` | Recovery is required; no gameplay progression is allowed. | Load/physics/contract failure or unrecoverable invariant violation. | Recoverable load retry (`booting`), reset with assets ready (`ready` via `resetting`), or remains terminal. |

`paused` is intentionally not included. Adding pause semantics requires a separate approval because it affects timers, physics stepping, presentation, and input ownership.

### Commands and events

Commands are intent, not direct subsystem mutations:

```text
beginAim
moveAim(axis/value)             # axis/value is ClawMount-local intent
confirmDrop
requestReset
retryLoad
```

System events are observations or completion acknowledgements. `bootRequested` is a lifecycle event emitted by application bootstrap, not a player command. The controller is constructed in `booting`; `bootRequested` is therefore a bootstrap trigger/no-op rather than a gameplay transition, and it is ignored after boot has already begun.

Motion-completion ownership is explicit: pose, physics, and asset adapters report observations to an effect coordinator; the effect coordinator is the sole emitter of normalized completion events. `poseReached` is reserved for the lowered pose; `liftReached`, `returnReached`, and `alignmentSettled` cover their named completion points. A visual tween callback or Rapier callback may not advance state directly. For a physics-owned movement, completion requires the authoritative physics target plus any required presentation pose to be complete; for a visual-only movement, the pose adapter supplies the completion observation.

```text
bootRequested
assetsReady
assetLoadFailed(error)
poseReached(pose, runId)
alignmentSettled(runId)
gripEvaluated(outcome, runId)
liftReached(runId)
returnReached(runId)
releaseComplete(outcome, runId)
baselineRestored(status, runId)  # status: ready | needsLoad
resetFailed(error, runId)
invariantFailure(error, runId)
```

### Legal transition table

```text
booting   --assetsReady--------------------> ready
booting   --assetLoadFailed---------------> error
ready     --beginAim----------------------> aiming
ready     --requestReset------------------> resetting
booting   --requestReset------------------> resetting
lowering  --requestReset------------------> resetting
aligning  --requestReset------------------> resetting
gripping  --requestReset------------------> resetting
lifting   --requestReset------------------> resetting
returning --requestReset------------------> resetting
releasing --requestReset------------------> resetting
aiming    --moveAim-----------------------> aiming
aiming    --confirmDrop-------------------> lowering
aiming    --requestReset------------------> resetting
lowering  --poseReached(lowered)----------> aligning
aligning  --alignmentSettled--------------> gripping
gripping  --gripEvaluated(outcome)--------> lifting
lifting   --liftReached-------------------> returning
returning --returnReached-----------------> releasing
releasing --releaseComplete(outcome)------> result
result    --requestReset------------------> resetting
resetting --baselineRestored(ready)-------> ready
resetting --baselineRestored(needsLoad)--> booting
resetting --resetFailed-------------------> error
resetting --requestReset------------------> resetting (coalesced)
*         --invariantFailure--------------> error  # except during resetting; reset failures use resetFailed
error     --requestReset------------------> resetting
error     --retryLoad---------------------> booting (only for recoverable load errors)
```

`bootRequested` is accepted only during application bootstrap or treated as an idempotent no-op while already `booting`; it never starts gameplay. A completion event is accepted only when its `runId` matches the active run and the current state expects that event. Late callbacks from a cancelled run are ignored and logged as stale, not allowed to advance the machine. `assetsReady` and `assetLoadFailed` are actionable only during `booting`; `baselineRestored` and `resetFailed` are actionable only during `resetting`; all other out-of-state system events are rejected diagnostically. `gripEvaluated` always advances to `lifting` in the first interaction contract; the outcome is stored in the run snapshot and carried through `releaseComplete` into `result`, not used as an implicit early success decision. Any failure-specific movement, prize treatment, or early return requires approval under A-04, A-05, A-06, and A-26. A `requestReset` received while already `resetting` is coalesced into the active transaction and does not start a second reset epoch.

### State invariants

- At most one active run exists.
- `ready` and `result` are stable states; physics/presentation work cannot silently advance them.
- No command can skip `aligning`, `gripping`, or `releasing` without an approved transition change.
- Invalid commands are observable through a rejected-command diagnostic; they do not mutate transforms or physics.
- A state transition records `from`, `event`, `to`, `runId`, and timestamp/sequence data sufficient for deterministic tests.
- The state snapshot stores player aim intent in `ClawMount`-local coordinates. World-space targets are derived by the effect/physics adapter and are not duplicated as independently writable state.

---

## 4. Authority boundaries

<!-- prettier-ignore -->
| Concern | Sole authority | Allowed consumers | Forbidden writers |
| --- | --- | --- | --- |
| Scene composition, visual objects, static transforms | R3F/Three.js scene layer | Camera, debug, pose adapter | State store, physics callbacks directly |
| Player intent and logical state | Typed state controller stored through Zustand | Input, animation/physics event adapters, UI | Components assigning state, GSAP, Rapier |
| Presentation interpolation and visual finger articulation | Pose adapter / GSAP presentation layer | State transition effects, rig | State promotion, Rapier body transforms |
| Dynamic positions, velocities, contacts, collision response | Rapier adapter/world | State event adapter, visual sync, debug | GSAP, direct mesh animation, Zustand |
| Asset identity, load status, cache, disposal | Asset registry/loader | Scene factory, state bootstrap | Individual meshes or gameplay logic |
| Grip decision | Grip evaluator after approved physics observations | State controller | Visual overlap checks, render callbacks |
| Win/failure result | State controller using evaluator outcome | UI, result presentation | Prize mesh, animation callback |
| Reset transaction | State controller (which serializes reset effects through a reset coordinator adapter) | Scene, pose, physics, asset adapters | Ad-hoc local reset buttons |
| Effect completion normalization | Effect coordinator | State controller, verification, debug | Raw adapter callbacks, UI, GSAP, Rapier |
| Camera/presentation framing | Camera/presentation layer | Scene state, review tools | Physics/state authority |
| Verification/promotion | Human plus deterministic checks | All reports | Runtime systems |

### Event direction

```text
Input/UI ──commands──> State controller
State controller ──effect requests──> Pose / Physics / Asset adapters
Pose / Physics / Asset adapters ──observations──> State controller
State controller ──read-only snapshot──> React UI and presentation
```

Adapters may report facts. They may not reinterpret a fact into a new logical state outside the controller.

---

## 5. Asset-loading contract

### Manifest

All runtime assets must be declared in a typed manifest keyed by stable logical IDs, not scattered URL literals:

```text
AssetId -> {
  url,
  kind,                 # model, texture, audio, environment, etc.
  version or content key,
  authoredUnitScale,
  authoredUpAxis,
  authoredForwardAxis,
  expectedAnchors,
  preloadPolicy,
}
```

The manifest is the source of truth for required assets and their authored-coordinate metadata. Asset components consume resolved entries and do not invent compensating scale/rotation values.

### Lifecycle

```text
unrequested -> loading -> ready
                    └──> failed
ready -------> disposed  # only when registry ownership ends
```

- The application bootstrap requests the manifest's required assets before entering `ready`.
- A failed required asset blocks `ready` and enters `error`; silent fallback is not allowed.
- Optional/debug assets may fail without blocking gameplay only if explicitly marked optional.
- The registry deduplicates concurrent requests and returns the same canonical resource record.
- Render instances must clone scene graphs/materials according to an explicit clone policy; a caller must not mutate the cached source scene.
- The asset registry owns disposal of cached/shared resource records; R3F owns disposal of instance-owned scene objects it created. A component must not dispose a shared resource, and the registry must not dispose an instance object it does not own.
- Loading, remounting, and retrying must not duplicate registrations or leak listeners, bodies, or object references.

### Asset validation

On load, validate expected anchors, finite transforms, non-zero dimensions, supported orientation, and expected bounds. A validation failure is an actionable asset error, not a hidden transform correction.

### Excluded from this contract

Compression, Draco/KTX2, streaming, CDN policy, hot reload behavior, and progressive loading are not selected here. They are listed for human approval below.

---

## 6. Transform layers

Transforms are classified and composed as follows. The order is intentionally separated into local composition and world placement so no layer is mistaken for another writer:

```text
Local visual composition:
L0  Asset-local authored transform
L1  Rig/pivot local transform
L2  Named pose target (finger articulation / cable pose)

World placement and authority:
L3  Static MachineRoot / ClawMount placement
L4  Authoritative physics body world pose (for physics-owned roots)
L5  Read-only visual synchronization from the authoritative root
L6  Camera projection and presentation-only effects
```

For a static or visual-only claw, the world pose is `L3` plus the approved local pose from `L0–L2`. For a physics-owned claw root, the Rapier body is registered in world space, while the requested travel target is authored in `ClawMount`-local space and converted to world space exactly once before submission. Rapier produces the authoritative world pose at `L4`; the visual adapter reads it and applies only the approved local articulation from `L1–L2`. `L3` is never applied as a second per-frame correction after Rapier has produced a world pose.

The effective order may be represented differently in code, but the authority rules remain the same.

### Rules by layer

- **L0:** Imported data is immutable at runtime. Unit and axis conversion happens once at the asset boundary.
- **L1:** Pivot hierarchy defines local articulation. It must not contain world-space gameplay corrections.
- **L2:** Pose adapters interpolate toward explicit targets. They never use current rotation as the next baseline.
- **L3:** Machine and mount placement are static configuration. They are not recomputed from state.
- **L4:** Rapier owns dynamic body translation, rotation, velocity, and collision response. A kinematic body receives targets only through the physics adapter.
- **L5:** Visuals read the authoritative physics pose and combine it with approved local rig articulation. No second writer may update the same root transform.
- **L6:** Camera shake, UI motion, and marketing presentation may affect only their own presentation layer. Scroll-driven behavior cannot move gameplay objects unless separately approved.

Every controlled transform must be classifiable as one of: authored baseline, static placement, pose target, physics pose, or presentation-only offset. Unclassified per-frame mutations are contract violations.

---

## 7. Rapier physics layers

Physics configuration belongs in one adapter/configuration module. Components must not contain ad-hoc bitmasks.

### Proposed groups

Rapier uses membership/filter bitmasks. Two colliders interact only when each collider's membership matches the other collider's filter. The following group names and bit assignments are a proposed starting matrix. Until A-22 and A-23 are approved, no implementation may treat these values as the production collision contract:

<!-- prettier-ignore -->
| Group | Proposed bit | Intended contents |
| --- | ---: | --- |
| `environment` | `1 << 0` | floor, walls, chute, static machine bounds |
| `prize` | `1 << 1` | dynamic prize colliders |
| `clawBody` | `1 << 2` | claw carriage/head proxy, if physical |
| `clawFinger` | `1 << 3` | finger proxies, only if physics-enabled |
| `sensor` | `1 << 4` | contact/grip sensors; no physical response where configured |
| `debug` | `1 << 5` | diagnostics only; normally non-colliding |

### Proposed interaction matrix

`✓` means the collider pair is eligible for interaction under the membership/filter masks; `—` means it is excluded. This matrix does not by itself choose solver response versus sensor observation. `optional` and `✓/optional` are deliberately unresolved proposals, not runtime behavior. The exact matrix is pending human approval.

<!-- prettier-ignore -->
| A \ B | Environment | Prize | Claw body | Claw finger | Sensor |
| --- | ---: | ---: | ---: | ---: | ---: |
| Environment | — | ✓ | ✓ | ✓ | optional |
| Prize | ✓ | ✓/optional | ✓ | ✓ | ✓ |
| Claw body | ✓ | ✓ | — | —/optional | ✓ |
| Claw finger | ✓ | ✓ | —/optional | — | ✓ |
| Sensor | optional | ✓ | ✓ | ✓ | — |

### Physics rules

- Dynamic prize bodies must not be continuously overwritten by render or animation code.
- A kinematic claw must use the approved Rapier kinematic target API and remain within `ClawMount`'s legal volume.
- Contact events are the minimum evidence for interaction; visual intersection alone never produces a grip.
- Sensors and physical colliders must be distinguishable in configuration and diagnostics. Collision-group eligibility is separate from sensor behavior: a collider marked as a sensor may generate intersection/contact observations without participating in solver response, according to its explicit collider configuration.
- Physics parameters (gravity, timestep, solver settings, restitution, friction, damping, CCD, sleeping) must be centralized and recorded before the first physics implementation.
- A physics reset restores translation, rotation, linear/angular velocity, forces, sleeping state, and any adapter bookkeeping for every registered body.

This section does not select whether the first claw is kinematic, dynamic, or hybrid, nor whether fingers receive colliders.

---

## 8. Reset behavior

Reset is an idempotent, serialized transaction with a new `runId`/epoch. It is legal from every state, including `booting` and `error`, subject to the load-retry decision.

### Reset sequence

```text
1. Accept request through the state controller.
2. Increment run epoch; reject all late callbacks from the previous epoch.
3. Stop accepting gameplay input.
4. Cancel timers, subscriptions, pending pose effects, and presentation tweens.
5. Ask the physics adapter to restore every registered body from its baseline snapshot; when no physics registration exists yet (for example during `booting` or `error`), this is an explicit no-op acknowledged by the adapter.
6. Restore claw pose targets and all rig pivots from explicit baseline data.
7. Restore prize logical placement/visibility and clear transient outcome data. If visual, pose, physics, or asset registrations are absent during `booting`/`error`, each adapter performs an explicit no-op and reports registration-not-ready rather than mutating missing objects.
8. Clear contact/grip accumulators and diagnostics for the old run.
9. Verify scene, transform, physics, and state invariants.
10. Emit `baselineRestored(ready|needsLoad, runId)` when restoration completes, or `resetFailed(error, runId)` when it cannot complete; the state controller then transitions to `ready`, `booting`, or `error` according to the transition table.
```

### Reset invariants

- Calling reset twice produces the same baseline as calling it once.
- Reset never relies on reversing the last animation or physics impulse.
- No old animation callback, physics contact, or input event can advance the new run.
- The visual hierarchy, physics bodies, logical state, and prize registry agree after reset.
- A reset during an interrupted action is tested separately from a reset at a stable state.
- Remount/dispose is a lifecycle operation, not the normal gameplay reset path.

The exact prize treatment after a failed or successful run is unresolved and must be approved. Reset requests during `booting`/`error` still follow the same transaction, but the final `ready` versus `booting` result depends on required-asset availability; a load failure during reset emits `resetFailed` only when baseline restoration cannot complete.

The reset coordinator does not remount React nodes for an ordinary gameplay reset. It resets already-registered Rapier bodies through the physics adapter, restores explicit visual baselines through the pose adapter, and then emits `baselineRestored`. If a lifecycle remount/disposal is required, the coordinator first quiesces the state controller, disposes physics registrations before their visual owners disappear, waits for the new R3F commit and asset registration, then creates fresh physics registrations and restores the same baseline snapshot. No frame may be treated as playable until both registrations are ready.

---

## 9. Verification scenarios

These scenarios define evidence required at the relevant gates. They do not authorize implementing any subsystem now.

### Contract and state verification

1. **Legal sequence:** `booting → ready → aiming → lowering → aligning → gripping → lifting → returning → releasing → result → resetting → ready`.
2. **Illegal command rejection:** Send every command in every state; confirm no undocumented transition or mutation.
3. **Reset from every state:** Enter each state, request reset, and verify baseline plus correct post-reset state.
4. **Interrupted run:** Reset during lowering, grip evaluation, lifting, and release; verify stale callbacks are ignored.
5. **Completion normalization:** Verify pose, physics, and asset callbacks produce one normalized completion event through the effect coordinator and never promote state directly.
6. **Local aim contract:** Verify aim input is clamped and stored in `ClawMount`-local coordinates, with one world-space conversion at the adapter boundary.
7. **Replay:** Repeat the same command/event sequence and compare transition records.
8. **Error recovery:** Force asset and invariant errors; verify the documented error and retry/reset path.

### Scene, asset, and transform verification

9. **Static hierarchy report:** Assert required parent-child relationships and named pivots.
10. **Refresh/remount:** Refresh and remount repeatedly; confirm disposal-before-remount ordering, no playable frame during registration, no duplicates, leaked registrations, or drift.
11. **Asset failure:** Break a required URL; verify visible/actionable failure and no entry to `ready`.
12. **Pose cycle:** Repeat open/close/raised/lowered cycles; compare transforms to the same explicit targets.
13. **Transform ownership:** Instrument controlled nodes and verify one writer per transform category.
14. **Coordinate validation:** Verify finite transforms, expected anchors, dimensions, scale, and orientation.

### Physics verification (after physics approval)

15. **Idle stability:** Resting prize remains within agreed position/rotation/jitter tolerance.
16. **Travel bounds:** Kinematic/claw proxy never leaves its legal volume.
17. **Collision matrix:** Allowed pairs contact; forbidden pairs do not.
18. **Contact versus overlap:** A visual overlap without a Rapier contact does not produce a grip.
19. **Controlled success:** An approved favorable fixture produces the approved success representation.
20. **Controlled failure:** An approved unfavorable fixture produces the approved failure behavior.
21. **Physics reset:** Velocities, positions, contacts, and sleep state return to baseline.
22. **Repeated run:** Identical inputs and fixture produce deterministic results, or documented seeded variance.

### Verification evidence contract

Each scenario records baseline revision, scenario ID, inputs/fixture, expected invariant, actual result, command output/logs, and screenshots or traces where visual/physics behavior is claimed. A passing prose report without reproducible evidence is insufficient.

---

## 10. Protected files and subsystem ownership

The directories below are the implemented subsystem ownership boundaries; they were created and populated by their owning nodes (N3–N7, archived in `docs/archive/m1-summary.md`). A task may edit only its allowed paths; this ownership table still governs every change.

<!-- prettier-ignore -->
| Path | Subsystem owner | Allowed responsibility | Protected against |
| --- | --- | --- | --- |
| `src/App.tsx` | Integration owner | Compose approved scene and providers | Gameplay logic, direct physics mutation, unrelated redesign |
| `src/main.tsx` | Bootstrap owner | React mount and global stylesheet import | Scene/state/physics behavior |
| `src/styles/global.css` | Presentation owner | App shell and DOM presentation styles | 3D authority or gameplay logic |
| `src/types/**` | Contract/type owner | Shared types and IDs/interfaces | Runtime side effects and hidden state |
| `src/scene/**` | Scene owner | R3F hierarchy, static visuals, camera/lights | State transitions and physics ownership |
| `src/claw/**` | Claw-rig owner | Rig mapping, pivots, named pose definitions/adapter | Asset registry, state promotion, physics policy |
| `src/state/**` | State owner | Commands, reducer/controller, Zustand snapshot, transition tests | Geometry, asset loading, direct Rapier calls |
| `src/assets/**` | Asset owner | Manifest, registry, loaders, validation, lifecycle | Gameplay decisions and transform hacks |
| `src/animation/**` | Presentation/pose owner | Explicit pose interpolation and cancellation | Logical state promotion and dynamic body movement |
| `src/physics/**` | Physics owner | Rapier world, bodies, colliders, collision groups, reset adapter | Visual hierarchy redesign and scoring |
| `src/effects/**` | Effect-coordinator owner | Normalize adapter observations and emit completion events | Direct state promotion, geometry, physics policy |
| `src/evidence/**` | Verification owner | Scenario fixtures, logs, screenshots/traces, reports | Runtime authority changes |
| `ARCHITECTURE_CONTRACTS.md` | Human/architecture owner | Approved contract and decision ledger | Silent implementation changes |
| `BOOTSTRAP.md` | Human/bootstrap owner | Gate 0 record and foundation decisions | Dependency or scaffold changes without approval |
| `docs/archive/m1/` | Human/project owner | Archived phase plan, graph plan, and node-contract plan (immutable) | Agent-local reinterpretation |
| `package.json`, `package-lock.json` | Human/dependency owner | Explicitly approved dependency/script changes | Silent additions/upgrades |
| `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, Prettier files | Tooling owner | Build/test/lint/format configuration | Subsystem workarounds |

### Ownership protocol

- One task may edit only its allowed paths. If a cross-boundary change is needed, stop and request a new task contract.
- The integration owner may connect approved interfaces but may not redesign their internals.
- Human approval is required before changing a protected file outside the current task packet.
- Tests live with the owning subsystem unless they are cross-subsystem evidence under `src/evidence/**`.
- No implementation phase may introduce `@react-three/drei`, a new loader, a new physics strategy, or a new animation dependency without dependency-owner approval.

---

## 11. Architecture decisions (approved 2026-08-01)

These decisions were intentionally not silently chosen by this contract. **All A-01…A-40 decisions were approved by the human on 2026-08-01 as Gate 1 baseline revision 1**, subject to binding refinements. The status column below is historical; the resolved ledger in `docs/contracts/open-decisions.md` supersedes it. Each is still a gate: an implementation node stops if it depends on a decision that is not recorded as approved.

### Core gameplay/physics decisions

<!-- prettier-ignore -->
| ID | Decision | Recommended provisional choice | Status |
| --- | --- | --- | --- |
| A-01 | First claw body strategy: kinematic, dynamic, or hybrid | Kinematic claw root; Rapier dynamic prize/environment | **Approval required** |
| A-02 | Finger physics representation | Visual-only fingers plus a dedicated sensor/proxy for the first test | **Approval required** |
| A-03 | Successful grip representation | Explicit controlled attachment/constraint or approved carry proxy; never visual parenting by accident | **Approval required** |
| A-04 | Failed grip behavior | Prize remains/returns to the playfield under Rapier; no hidden teleport during the run | **Approval required** |
| A-05 | Prize reset after failure | Restore a deterministic fixture snapshot during reset | **Approval required** |
| A-06 | Win definition | Human-defined outcome based on approved result zone/placement, not contact alone | **Approval required** |
| A-07 | Randomness | Deterministic fixtures and no randomness for the first interaction test | **Approval required** |
| A-08 | Number and type of prizes in first interaction | One known prize and one known success/failure fixture | **Approval required** |

### State and interaction decisions

<!-- prettier-ignore -->
| ID | Decision | Contract default | Status |
| --- | --- | --- | --- |
| A-09 | Horizontal aim model and legal input range | Discrete or bounded continuous aim within `ClawMount`; choose one before input work | **Approval required** |
| A-10 | Whether `aligning` is a real settling state | Keep it as an explicit state for the first physics scenario | **Approval required** |
| A-11 | Invalid-command policy | Ignore/reject with diagnostics; reserve `error` for invariant failures | **Approval required** |
| A-12 | Whether `result` permits another run without reset | Require explicit reset for v1 | **Approval required** |
| A-13 | Pause semantics | Defer `paused`; no pause command in v1 | **Approval required** |
| A-14 | Error retry semantics | Required asset failure blocks `ready`; retry only for recoverable load errors | **Approval required** |
| A-15 | Input ownership during transitions | Lock gameplay input except reset and explicitly approved commands | **Approval required** |

### Asset and transform decisions

<!-- prettier-ignore -->
| ID | Decision | Contract default | Status |
| --- | --- | --- | --- |
| A-16 | Runtime model format and loader | Typed manifest with a Three.js-compatible loader; exact format/loader to be selected | **Approval required** |
| A-17 | Asset conversion pipeline | Validate authored units/axes at load; do not hide corrections in components | **Approval required** |
| A-18 | Clone/material policy | Clone per render instance; shared immutable source resources | **Approval required** |
| A-19 | Required versus optional preload policy | Required machine/claw/prize assets block `ready`; debug assets optional | **Approval required** |
| A-20 | Compression and texture pipeline | Defer Draco/KTX2/streaming until asset inventory exists | **Approval required** |
| A-21 | Exact authority for claw root during the pre-physics static phase | Pose adapter may own visual root until a physics strategy is approved | **Approval required** |

### Physics configuration decisions

<!-- prettier-ignore -->
| ID | Decision | Contract default | Status |
| --- | --- | --- | --- |
| A-22 | Collision group bit assignments and interaction matrix | Use the proposed six-group matrix in section 7 as a starting point | **Approval required** |
| A-23 | Sensor versus physical finger colliders | Separate sensor from response colliders | **Approval required** |
| A-24 | Grip evaluation rule and required contact evidence | Contact/solver observations plus explicit evaluator; no visual overlap | **Approval required** |
| A-25 | Gravity, timestep, CCD, sleeping, damping, friction, restitution | Centralize and document before physics implementation | **Approval required** |
| A-26 | Dynamic attachment mechanism for a successful carry | Select constraint, controlled kinematic relation, or other Rapier-supported representation | **Approval required** |
| A-27 | Physics determinism target and tolerance | Deterministic fixtures with recorded tolerances; exact cross-browser determinism needs confirmation | **Approval required** |

### Presentation and product-scope decisions

<!-- prettier-ignore -->
| ID | Decision | Contract default | Status |
| --- | --- | --- | --- |
| A-28 | GSAP role in gameplay | Presentation/pose interpolation only; never authoritative physics movement or state promotion | **Approval required** |
| A-29 | ScrollTrigger necessity | Deferred/not required for the gameplay scene | **Approval required** |
| A-30 | Camera/review-camera presets | One agreed review camera plus optional debug views | **Approval required** |
| A-31 | Scoring, lives, sound, and UI scope | Deferred until the first interaction contract passes | **Approval required** |
| A-32 | Desktop-only target and performance budget | Keep current modern desktop/WebGL2 assumption; define frame/physics budgets before polish | **Approval required** |

### Tooling and repository decisions

<!-- prettier-ignore -->
| ID   | Decision                                               | Contract default                                                                    | Status                |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------- |
| A-33 | Whether to add a loader/helper dependency such as Drei | Do not add one without a specific approved need                                     | **Approval required** |
| A-34 | Evidence storage and screenshot/trace tooling          | Use `src/evidence/**` plus human-approved local artifacts; define retention/format  | **Approval required** |
| A-35 | Whether this document becomes the Gate 1 baseline      | Human must approve this contract and record a baseline revision                    | **Approval required** |
| A-36 | Canonical world convention                             | Explicit project-wide units, up-axis, handedness, and `SceneRoot` origin convention | **Approval required** |
| A-37 | Drop completion rule                                   | Fixed ClawMount-local target with an explicit motion-completion tolerance           | **Approval required** |
| A-38 | Alignment completion rule                              | Explicit settling predicate using approved pose/physics observations                | **Approval required** |
| A-39 | R3F/Rapier visual synchronization strategy             | Sibling visual/physics roots with an explicit adapter; no competing declarative writer | **Approval required** |
| A-40 | Effect-coordinator lifecycle and cancellation         | One coordinator owns normalized completion events, cancels on reset, and reports adapter errors | **Approval required** |

## Approval gate

The human approved A-01 through A-40 on **2026-08-01** as **Gate 1 baseline revision 1**, subject to binding refinements: hybrid claw with kinematic `ClawMount` (A-01); visual fingers with dedicated sensor proxies (A-02/A-23); evaluator-approved grip as an explicit Rapier-supported carry constraint (A-03/A-26); continuous bounded aim in `ClawMount`-local meters (A-09/A-36/A-37); typed GLB/glTF manifests (A-16); centralized fixed-step configuration with tolerance-based repeatability evidence (A-25/A-27); GSAP presentation-only (A-28); deferral of ScrollTrigger, scoring, sound, lives, randomness, compression tooling, and nonessential dependencies (A-07/A-20/A-29/A-31/A-33).

The resolved ledger is `docs/contracts/open-decisions.md`; the approval record is `records/approvals/gate-1-baseline-rev1.md`; the mandated versioned contracts are in `records/contracts/` (attachment primitive, collision matrix, fixed-step policy, performance thresholds).

N1a (deterministic gate enforcement) was built and `gate-1-baseline-rev1` was tagged on 2026-08-01; gameplay nodes N2–N9 were executed and archived on 2026-08-02 (see `docs/archive/m1-summary.md`).
