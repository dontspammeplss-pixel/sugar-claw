# Authority Map

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Baseline:** `gate-1-baseline-rev1`

## Rule

Each category of runtime truth has one authoritative writer. Adapters may report observations, but only the state controller may promote logical game state.

## Authority table

| Concern                                                     | Sole authority                                                                                                       | Allowed consumers                         | Forbidden writers                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| Scene composition, visual objects, static transforms        | R3F/Three.js scene layer                                                                                             | Camera, debug, pose adapter               | State store, physics callbacks directly        |
| Player intent and logical state                             | Typed state controller, persisted through Zustand                                                                    | Input, effect coordinator, adapters, UI   | React components assigning state, GSAP, Rapier |
| Presentation interpolation and visual finger articulation   | Pose adapter / GSAP presentation layer                                                                               | State effects, rig                        | State promotion, Rapier body transforms        |
| Dynamic positions, velocities, contacts, collision response | Rapier adapter/world                                                                                                 | Visual sync, event adapter, debug         | GSAP, direct mesh animation, Zustand           |
| Asset identity, load status, cache, and disposal            | Asset registry/loader                                                                                                | Scene factory, bootstrap, state bootstrap | Meshes, gameplay logic                         |
| Grip decision                                               | Grip evaluator using approved physics observations; physics adapter creates/removes the carry constraint (A-03/A-26) | State controller                          | Visual overlap checks, render callbacks        |
| Win/failure result                                          | State controller using evaluator outcome                                                                             | Result UI/presentation                    | Prize mesh, animation callback                 |
| Reset transaction                                           | State controller serialized through reset coordinator                                                                | Scene, pose, physics, asset adapters      | Ad-hoc local reset buttons                     |
| Completion normalization                                    | Effect coordinator                                                                                                   | State controller, verification, debug     | Raw adapter callbacks, UI, GSAP, Rapier        |
| Camera and presentation framing                             | Camera/presentation layer                                                                                            | Scene snapshot, review tools              | Physics/state authority                        |
| Verification and promotion                                  | Human plus deterministic checks                                                                                      | All reports                               | Runtime systems                                |
| Operator/dev rigging settings (F-11/C-10 grip voltage)        | Operator/dev role via the ops store (`claw-app:ops:v1`), applied to retention through the coordinator → adapter clamped path | Ops panel, retention adapter | Player save data, player-facing UI, runtime systems |

## Event direction

```text
Input/UI ──commands──> State controller
State controller ──effect requests──> Pose / Physics / Asset adapters
Pose / Physics / Asset adapters ──observations──> Effect coordinator
Effect coordinator ──normalized events──> State controller
State controller ──read-only snapshot──> React UI and presentation
```

## Boundary rules

- Zustand is storage/dispatch infrastructure, not a second state authority.
- A GSAP completion callback reports to the effect coordinator; it never advances state.
- A Rapier callback reports contact or target observations; it never advances state.
- R3F can create, parent, show, hide, and dispose visual objects, but cannot decide a grip or overwrite a Rapier-owned dynamic root each frame.
- The physics adapter owns dynamic body transforms. A visual adapter may read them and synchronize a visual representation once.
- Debug visualization is read-only with respect to gameplay.
- A cross-boundary implementation request is a stop-and-escalate condition, not permission to add a workaround.

## Required observable records

Every accepted transition records `from`, `event`, `to`, `runId`, and monotonic sequence/timestamp data. Rejected commands, stale callbacks, out-of-state events, and invariant failures are diagnostic records and do not mutate another authority's truth.
