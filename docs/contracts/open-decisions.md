# Open-Decision Ledger — Approved

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)
**Baseline:** `gate-1-baseline-rev1`
**Rule:** An implementation node must stop rather than silently choose a decision it depends on. Approved outcomes below are binding; a deviation is a contract violation and escalates to the human.

Approval record: `records/approvals/gate-1-baseline-rev1.md`. The human approved A-01 through A-40 subject to the binding refinements recorded there; each outcome below incorporates them.

## Core gameplay and physics

| ID   | Decision                                                | Approved outcome (rev 1)                                                                                                                                                         |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | First claw body strategy: kinematic, dynamic, or hybrid | **Hybrid.** Kinematic `ClawMount`/claw root driven through the physics adapter; dynamic Rapier prize/environment. Fingers are visual-only (A-02).                                |
| A-02 | Finger physics representation                           | **Visual-only fingers plus dedicated sensor proxies** for the first test; no physical finger colliders in v1.                                                                    |
| A-03 | Successful grip representation                          | **Evaluator-approved, explicit Rapier-supported carry constraint** (attachment primitive, `records/contracts/attachment-primitive.md`); never visual parenting or identity swap. |
| A-04 | Failed grip behavior                                    | Prize remains/returns under Rapier; no hidden teleport during the run.                                                                                                           |
| A-05 | Prize reset after failure                               | Restore a deterministic fixture snapshot on reset.                                                                                                                               |
| A-06 | Win definition                                          | Human-defined result zone/placement, not contact alone.                                                                                                                          |
| A-07 | Randomness                                              | **Deferred.** No randomness for the first interaction; deterministic fixtures.                                                                                                   |
| A-08 | Number/type of prizes in first interaction              | One known prize and one known success/failure fixture.                                                                                                                           |

## State and interaction

| ID   | Decision                                           | Approved outcome (rev 1)                                                                                                                                               |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-09 | Horizontal aim model and legal range               | **Continuous and bounded** aim within `ClawMount`-local **meters**, clamped to the legal travel volume; converted to world space exactly once at the adapter boundary. |
| A-10 | Whether `aligning` is a real settling state        | Keep explicit for the first physics scenario.                                                                                                                          |
| A-11 | Invalid-command policy                             | Reject/ignore with diagnostics; reserve `error` for invariant failures.                                                                                                |
| A-12 | Whether `result` permits another run without reset | Require explicit reset for v1.                                                                                                                                         |
| A-13 | Pause semantics                                    | **Deferred.** No `paused` state/command in v1.                                                                                                                         |
| A-14 | Error retry semantics                              | Required asset failure blocks `ready`; retry only recoverable load errors.                                                                                             |
| A-15 | Input ownership during transitions                 | Lock gameplay input except reset and explicitly approved commands.                                                                                                     |

## Asset and transform

| ID   | Decision                                            | Approved outcome (rev 1)                                                                                                                                                         |
| ---- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-16 | Runtime model format and loader                     | **Typed GLB/glTF manifests** with a Three.js-compatible GLTF loader; manifest is the single source of asset truth.                                                               |
| A-17 | Asset conversion pipeline                           | Validate authored units/axes at load; no hidden component corrections.                                                                                                           |
| A-18 | Clone/material policy                               | Clone per render instance with shared immutable source resources.                                                                                                                |
| A-19 | Required versus optional preload                    | Machine, claw, and prize assets required; debug assets optional.                                                                                                                 |
| A-20 | Compression and texture pipeline                    | **Deferred.** Draco/KTX2/streaming until an asset inventory exists.                                                                                                              |
| A-21 | Claw-root authority during pre-physics static phase | Pose adapter owns visual root until physics is active; once active, the kinematic claw receives targets through the physics adapter and the visual root syncs read-only (L4/L5). |

## Physics configuration

| ID   | Decision                                                         | Approved outcome (rev 1)                                                                                                                  |
| ---- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A-22 | Collision group bits and interaction matrix                      | **Versioned contract:** `records/contracts/collision-matrix.md` (rev 1). No optional cells remain; no ad-hoc masks in components.         |
| A-23 | Sensor versus physical finger colliders                          | Separate sensor from response colliders; fingers visual-only with sensor proxies.                                                         |
| A-24 | Grip-evaluation rule and required contact evidence               | Approved contact/solver observations plus explicit evaluator; never visual overlap.                                                       |
| A-25 | Gravity, timestep, CCD, sleeping, damping, friction, restitution | **Versioned contract:** centralized fixed-step configuration in `records/contracts/fixed-step-policy.md` (rev 1).                         |
| A-26 | Dynamic attachment mechanism for successful carry                | **Versioned contract:** explicit Rapier-supported carry constraint (attachment primitive, rev 1), created/removed by the physics adapter. |
| A-27 | Physics determinism target and tolerance                         | **Tolerance-based repeatability evidence** under fixed-step rev 1; cross-browser bit-exactness is not claimed.                            |

## Presentation and product scope

| ID   | Decision                              | Approved outcome (rev 1)                                                                                |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A-28 | GSAP role in gameplay                 | **Presentation-only.** Pose/visual interpolation; never authoritative body movement or state promotion. |
| A-29 | ScrollTrigger necessity               | **Deferred.** Not required for the gameplay scene.                                                      |
| A-30 | Camera/review-camera presets          | One agreed review camera plus optional debug views.                                                     |
| A-31 | Scoring, lives, sound, and UI scope   | **Deferred** until the first interaction contract passes.                                               |
| A-32 | Desktop target and performance budget | Modern desktop/WebGL2; **versioned contract:** `records/contracts/performance-thresholds.md` (rev 1).   |

## Tooling and repository

| ID   | Decision                                      | Approved outcome (rev 1)                                                                                    |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A-33 | Add loader/helper dependency such as Drei     | **Deferred.** No new loader/helper dependency without a specific approved need.                             |
| A-34 | Evidence storage and screenshot/trace tooling | Human-approved local evidence artifacts (`records/evidence/`) with a defined retention/format policy.       |
| A-35 | Make this set the Gate 1 contract baseline    | **Approved.** This set is Gate 1 baseline revision 1; recorded 2026-08-01.                                  |
| A-36 | Canonical world convention                    | **Meters, Y-up, right-handed, `SceneRoot` origin.** Aim/travel authored in `ClawMount`-local meters (A-09). |
| A-37 | Drop completion rule                          | Fixed `ClawMount`-local target with explicit motion-completion tolerance.                                   |
| A-38 | Alignment completion rule                     | Explicit settling predicate using approved pose/physics observations.                                       |
| A-39 | R3F/Rapier visual synchronization strategy    | Sibling visual/physics roots with one explicit adapter; no competing declarative writer.                    |
| A-40 | Effect-coordinator lifecycle and cancellation | One coordinator owns normalized completion events, cancels on reset, and reports adapter errors.            |

## Approval record

The human approved this set on **2026-08-01** as **Gate 1 baseline revision 1**, subject to these binding refinements (recorded verbatim in `records/approvals/gate-1-baseline-rev1.md`):

1. Hybrid claw with kinematic `ClawMount` (A-01).
2. First fingers visual with dedicated sensor proxies (A-02, A-23).
3. Grip evaluator-approved, explicit Rapier-supported carry constraint (A-03, A-26).
4. Aim continuous and bounded in `ClawMount`-local meters (A-09, A-36, A-37).
5. Assets use typed GLB/glTF manifests (A-16).
6. Physics uses centralized fixed-step configuration and tolerance-based repeatability evidence (A-25, A-27).
7. GSAP is presentation-only (A-28).
8. Deferred: ScrollTrigger, scoring, sound, lives, randomness, compression tooling, nonessential dependencies (A-07, A-20, A-29, A-31, A-33).

The attachment primitive, collision matrix, fixed-step policy, and performance thresholds are recorded as versioned contracts in `records/contracts/` and must exist before their corresponding implementation nodes begin.

## Remaining before full Gate 1 promotion

N1 (this contract set) is approved. **N1a — the deterministic gate-enforcement script — must still be built** to enforce gate evidence and protected-file boundaries before Gate 1 is fully promoted.
