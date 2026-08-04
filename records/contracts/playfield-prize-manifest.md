# Playfield and Prize Manifest (C-08, N43 scope)

**Status:** Implemented — N43 verified 2026-08-04
**Authority:** `src/physics/adapter.ts` for prize-body registration, fixed-step snapshot/restore, and physical state; `src/physics/config.ts` for physical configuration and collision groups; manifest loader/data schema for prize definitions; local player persistence store for saved prize state; N42 delivery/removal hook for won-prize removal; `src/scene/**` is presentation-only
**Baseline:** `main` (historical packet baseline: `3b8bb05` + approved Phase-A packets)

## Rule

A prize playfield is the deterministic projection of one versioned JSON manifest plus, for an ongoing machine, the validated persisted state for that same manifest revision: a fresh revision uses the authored layout, while a matching revision resumes positions and won/removed state without resetting delivered prizes.

## Body

### Scope in — N43

1. **Manifest as single source of truth.** Define a versioned JSON manifest containing a unique manifest revision and a list of prize definitions. Each prize definition must include:
   - unique prize ID;
   - initial position and orientation;
   - spawn-layout data and/or a reference to the authored layout preset;
   - physical weight and center-of-mass data required by N41/F-01;
   - a declared geometry type with one of the concrete N44/F-04 values `sphere`, `box`, `soft-pouch`, `tag`, `strap`, or `loop`. N43 validates the declaration; N44 owns the behavior of those geometries.
2. **Manifest validation.** Reject `manifest-invalid` when the manifest violates the schema, contains duplicate IDs, or omits required physics fields. Validation must be deterministic and must not silently repair invalid prize data.
3. **Multiple-prize registration.** Every valid prize entry produces one registered prize body through the existing fixed-step physics authority. The adapter remains the sole Rapier body, collider, contact, and physical snapshot/restore authority.
4. **Data-driven placement.** Density, angle, and layout presets are represented as manifest/config data. N43 defines the data shape that the Phase-C dev/ops panel edits; it does not implement or expose the panel to players.
5. **Player persistence.** Save physical prize state locally under a player-save namespace keyed by the manifest revision. Persist at minimum the state required to resume each prize’s position and won/removed flag. Dev-only operator settings must use a separate namespace and must never overwrite player save data.
6. **Reset versus resume.** If no valid save exists for the current manifest revision, instantiate the deterministic authored spawn layout. If a valid save exists for the current revision, restore it inside the fixed-step world. A save from another revision must be ignored/rejected as `reset-vs-resume-conflict`, never merged into the new layout.
7. **Cross-play carryover.** A physics nudge on play 1 must be reflected in the position available to play 2, and a reload within the same manifest revision must restore that nudged state.
8. **Won-prize removal.** Preserve N42’s delivery authority. A delivered/won prize is removed or disabled from the playfield and recorded through the F-12 winnings hook; it must not be respawned by a subsequent play reset for the same machine revision.
9. **Collision distinction.** Revise the collision contract so prize-vs-prize is an explicit, observable interaction distinct from prize-vs-claw and prize-vs-environment. No component may embed ad-hoc masks; collision groups remain configuration-owned and versioned.
10. **Deterministic execution.** Identical manifest, save, input, and fixed-step configuration produce repeatable fixture outcomes within the existing tolerance-based policy.

### Binding invariants

- **Data over code:** adding a prize requires only manifest/config data; no prize-specific source change is allowed.
- **Physics authority:** `src/physics/adapter.ts` is the sole writer of physical prize registration, stepping, collision/contact truth, and persistence snapshot/restore within the world.
- **Configuration authority:** `src/physics/config.ts` owns fixed-step, physical parameters, collision groups, and spawn-layout defaults; render components may not define physics values.
- **Namespace separation:** player save data and dev-only ops data are distinct; ops settings cannot leak into player state or alter manifest revision identity.
- **Revision safety:** persisted state is applicable only when its manifest revision matches the active machine; otherwise the machine takes deterministic fresh-layout behavior and emits the appropriate diagnostic. Any additional compatibility key must not change the contract’s manifest-revision keying without a revision.
- **Win/removal continuity:** N42’s chute intersection remains the sole delivery predicate; N43 consumes its removal/hook event and does not redefine win semantics.
- **State-machine continuity:** no new `src/state/**` state is introduced. Any requirement for a new state is a stop-and-revise condition.
- **Fixed-step continuity:** the existing fixed `dt = 1/60 s` policy and tolerance-based repeatability claim remain binding. Any required step-policy change is a stop-and-revise condition.
- **No hidden dependency:** persistence is local and must not require a new dependency without an approved contract revision.

### Failure results

- `manifest-invalid` — schema violation, duplicate prize IDs, or missing physics fields.
- `persistence-loss` — position or won/removed state is not restored after reload within the active manifest revision.
- `prize-collision-ambiguity` — prize-vs-prize and prize-vs-claw/environment groups cannot be distinguished in configuration or evidence.
- `reset-vs-resume-conflict` — stale or incompatible save is applied to a fresh manifest revision, or fresh-layout and resume semantics collide.
- `playfield-perf-regression` — the multi-prize scene exceeds the approved performance thresholds.

### Explicit non-goals

- No N44 strap/tag/loop/body/corner geometry implementation, collider derivation, contact-region identity, grip evaluator change, or pseudo-capture policy.
- No N45 bone-rig, articulated-body, joint, limb, or per-part physics implementation.
- No N46 obstacle/shelf/divider implementation or blocked-descent state-machine decision.
- No player-facing ops panel; Phase-C F-11 owns that surface.
- No economy implementation or non-no-op winnings consumer; N43 emits/consumes the established F-12 hook only.
- No new persistence library, physics engine, broad state-machine redesign, world-convention change, or fixed-step-policy change.
- No render/UI/screenshot overlap as a physics or persistence authority.

## Workstream

- **Phase:** B — Playfield; N43 / F-03 only, under C-08. N44–N46 are separate implementation nodes in the shared Phase-B packet.
- **Implemented source surface:** `src/playfield/default-prize-manifest.json` is the single authored manifest; `src/playfield/prize-manifest.ts` validates/loads it using unified geometry types; `src/playfield/prize-persistence.ts` provides dependency-free revision-keyed player persistence with an in-memory test fallback; `src/physics/config.ts` owns rev3 collision groups; `src/physics/adapter.ts` registers and snapshots manifest prizes, supports selected-prize interaction, and consumes N42 removal/winnings; `src/scene/StaticScene.tsx` and `src/effects/n7-coordinator.ts` render/sync manifest prizes; `src/evidence/n43-evidence.ts` / `n43.test.ts` record acceptance evidence.
- **Protected contracts:** `records/contracts/fixed-step-policy.md`, `records/contracts/attachment-primitive.md`, `records/contracts/performance-thresholds.md`, the transform/world convention, and the existing C-02 state contract. `records/contracts/collision-matrix.md` requires a versioned revision for multi-prize groups; it is not silently altered by this draft.
- **Related nodes:** [[N-43-multi-prize-manifest-and-persistent-playfield]], [[N-41-force-based-retention-and-mid-carry-release]], [[N-42-chute-based-win-detection-and-delivery-semantics]], and [[N-42.1-carry-to-delivery-motion-path]]. Finding N-19 is the motivating predecessor.
- **Target repository path note:** existing contracts are stored under `records/contracts/`; this is the actual C-08 path despite the vault outline’s generic `docs/contracts/` convention.
- **Definition of done:** three mixed-geometry prizes validate from JSON; multiple bodies spawn and render; nudge/play carryover and same-revision reload restore positions; an arbitrary selected prize (`tag-prize`) leaves the field and increments/observes winnings; new revision uses deterministic layout and rejects stale saves; actual prize-vs-prize solver contact and prize-vs-claw distinction are evidenced; fixed-step repeatability and average physics-step performance pass; no prize addition requires source edits.
- **Verification result (2026-08-04):** `records/evidence/n43-playfield-manifest.json` status `pass`; invalid manifest rejected; same-revision nudge/reload restored; selected `tag-prize` delivery persisted `won/removed` with winnings count 1 and declared weight/CoM applied; three prize colliders and actual distinct-collider prize-prize trace observed; 120-step average physics cost `0.3008 ms` versus `2 ms` budget. Browser FPS, p95 frame time, and reference-device memory remain pending and are not claimed as passed.

## Verification

1. **Manifest fixture:** load a valid manifest with at least three prizes and mixed geometry references; assert schema validation, unique IDs, positions/orientations, spawn layout, weight, and center-of-mass fields.
2. **Invalid-manifest fixtures:** duplicate ID, missing physics field, and malformed schema each produce `manifest-invalid` without partial registration.
3. **Persistence trace:** run play 1, nudge a selected prize, snapshot/save, start play 2, assert the grab target uses the nudged position; reload under the same revision and assert positions and won/removed flags remain.
4. **Revision trace:** save revision A, load revision B, assert A’s state is not applied and B receives its deterministic authored layout; repeat loading B with a matching save and assert resume.
5. **Win-removal trace:** deliver one prize through N42, assert it is absent/disabled on the next play and the F-12 winnings counter/hook increments exactly once.
6. **Collision evidence:** exercise prize-prize contact and prize-claw contact and record distinct configured groups; fail if either pair is indistinguishable.
7. **Fixed-step repeatability:** repeat every fixture under the existing fixed-step revision and record position/rotation/outcome deviations against the policy tolerances.
8. **Performance evidence:** use N21 methodology and `records/contracts/performance-thresholds.md`: reference desktop sustained ≥50 fps, p95 frame ≤20 ms, no sustained ≥1 s frames above 33 ms, average physics step ≤2 ms, and no unbounded reset/reload memory growth.
9. **Full gate:** passed 2026-08-04 — `npm run typecheck`, `npm run lint`, `npm test` (15 files / 86 tests), and `npm run build` (75 modules transformed; 4.38 s; existing large Rapier/Three chunk warning only). N21 browser/reference-device performance remains a separate pending measurement.

## Revision gate

Stop and open a revision before implementation if any requirement needs a new persistence dependency, a new state-machine state, a changed world/transform convention, a changed fixed-step policy, or code changes to add an individual prize.
