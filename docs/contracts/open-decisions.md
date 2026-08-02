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

## Maintenance and cleanup decisions (recorded by node N16, 2026-08-01)

These decisions were executed through node N16 (dead-weight cleanup analysis, `PLAN-node-contracts.md` §2). They are binding on the maintenance nodes that follow (N11–N16); a deviation is a contract violation. They amend nothing in the Gate 1 set above — they scope how the approved contracts are represented in the current code.

| ID   | Decision                                     | Approved outcome (recorded by node N16, 2026-08-01)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-41 | Hollow scene nodes + runtime hierarchy evidence fate | **Keep as contract markers (option a).** `ClawPhysicsRoot`, `MachineCollisionProxies`, and `DebugRoot` stay empty (they render nothing) and remain in `REQUIRED_HIERARCHY`; `ClawDebugRoot` stays as a scene-only debug seam; `report.ts` validation, `RuntimeEvidenceProbe`, and the `data-n3-*`/`data-n7-*` attributes (centralized in `src/evidence/publish.ts`) remain the runtime evidence channel for gate verification. Rationale: the nodes document approved Gate 1 boundaries (`scene-claw-hierarchy.md`, `physics-layers.md`) — `ClawPhysicsRoot` = adapter boundary, `MachineCollisionProxies` = reserved physics proxies, `DebugRoot`/`ClawDebugRoot` = read-only debug seams; `REQUIRED_HIERARCHY` is the only **comprehensive** automated guard that the full hierarchy and rig pivots stay present and un-drifted (N7's `resolveN7SceneBindings` additionally guards `SceneRoot`/`ClawSystem`/`ClawVisualRoot`/`PrizeRoot` at coordinator creation); deletion would be a silent change to an approved contract (exactly what N16 forbids); runtime cost is zero. Binding refinements: (1) no runtime system may read transforms from these marker nodes — they carry contract metadata only; (2) removing them requires **one** charter-revision node that amends `scene-claw-hierarchy.md`, `REQUIRED_HIERARCHY`, and the N3 evidence together. |
| A-42 | Asset pipeline fate (`src/assets` manifest + registry) | **Keep as the approved contract skeleton, not wired to runtime in v1.** The typed manifest and registry stay as the implementation and evidence fixture for approved `asset-contract.md` (A-16/A-18/A-19); n3 evidence keeps `manifestValidation`. Rationale: `asset-contract.md` is approved Gate 1 and the registry is its only implementation and the assets verifier's evidence (`n3.test.ts`); the v1 scene is fully procedural and no GLB loader is wired (A-20 deferred), so the pipeline is dormant rather than harmful. Binding refinements: (1) no runtime module imports `src/assets` in v1 — the coordinator boots procedurally and `assetsReady` fires unconditionally; (2) `assetLoadFailed`/`retryLoad`/`errorKind='asset-load'` remain approved controller paths (A-14) covered by n5 tests even though runtime never emits a real load failure in v1; (3) when real GLB assets land (A-20 un-deferred), the registry becomes the loader and A-19's "required assets block ready" re-engages — this decision waives no asset contract. |

## Charter-revision requests (recorded by node N19, 2026-08-02)

These requests are recorded but **not opened**. Opening one requires a **charter-revision node** (a human-approved contract amendment) — never silent implementation. The N19 request below was drafted in `PLAN-node-contracts.md` as "A-41", but A-41/A-42 were already consumed by N16; it is recorded under the next free ID, **A-43**, so the ledger stays collision-free.

| ID   | Decision                                     | Approved outcome (recorded by node N19, 2026-08-02)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-43 | Dynamic fingers / cable realism (charter-revision request) | **Deferred — not implemented in this cycle; keep visual-only fingers (A-02/A-23).** Recorded charter-revision request to evaluate dynamic prongs with revolute joints + joint motors, and/or a cable chain, against the approved hybrid kinematic-claw / visual-only-finger strategy (A-01, A-02, A-23). Rationale: dynamic finger colliders contradict A-02/A-23 (fingers visual-only, sensor proxies only) and A-01 (single kinematic claw body); a cable chain/sway is a new physics strategy; both would change the physics strategy and the evidence suite, so both are gated behind a charter-revision decision node (never implemented silently). **Migration impact if opened:** (1) `src/claw/rig.ts` poseTarget becomes pose-motion only or is replaced by joint-motor targets; (2) `N6PhysicsAdapter` gains joint bodies/constraints and finger sensor proxies gain colliders — changes `collision-matrix.md` and `fixed-step-policy.md` contracts; (3) `n6.test.ts` scenario set (idle/travel/open-close/contact/carry/reset) must be extended for joint-driven behavior and determinism; (4) `n7` pose/cycle evidence and `records/evidence/n17-*` hinge evidence need a joint-angle equivalent; (5) `records/contracts/attachment-primitive.md` carry semantics may need a joint-motor-based carry variant. **New verification requirements when opened:** joint-angle limits, motor force/torque bounds, carry-constraint equivalence proof (motor pinch vs A-03 constraint), determinism evidence under fixed-step rev 1, performance thresholds (`performance-thresholds.md`) re-checked for added solver load, and a human visual gate for finger flaring symmetry. This decision waives no approved contract. |

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
