# PLAN — Turning Three Implementations into Contract Nodes

> Status: **proposal, not yet approved.** Prep outline for converting three pasted
> implementations (dead-weight cleanup, claw joint orientation fix, physics tuning)
> into bounded contract nodes for this repo's node/gate machinery.
> Baseline verified 2026-08-01: typecheck ✓, 50/50 tests ✓, git clean at `c54c616`.

---

## 0. Stack conversion verdict (read first)

Each pasted implementation was checked against the **actual** repo stack
(Three.js 0.168 + R3F 8.17.10 + `@dimforge/rapier3d-compat` via `@react-three/rapier` 1.5.0 + Zustand + Vite/Vitest). **No stack change is needed anywhere.**

| Pasted proposal | Verdict against this repo | Action |
| --- | --- | --- |
| Physics guide Option A (Rapier3D) | **Already the engine** (`N6PhysicsAdapter`) | Keep — no change |
| Physics guide Option B (Havok) | Babylon.js-only; different stack | **Reject** — violates "don't change stacks" |
| Physics guide: kinematic gantry | **Already kinematic** claw (A-01) | Keep |
| Physics guide: dynamic prongs + revolute joints + joint motors | Contradicts **A-02/A-23** (fingers visual-only, sensor proxies) | **Defer** — requires charter revision (Section 20) |
| Physics guide: cable chain / sway | Claw is a single kinematic body today | **Defer** — new physics strategy, needs charter revision |
| Physics guide: high-friction claw tips | Global `friction: 0.7`, `restitution: 0` in `src/physics/config.ts` | Tune in config (Node N18) |
| Physics guide: CCD | **Already on** (`ccd: true`) | Verify + add evidence |
| Physics guide: convex-hull/primitive colliders | **Already primitives** (cuboids, balls) | Keep |
| Physics guide: solver substepping 60/120 Hz | **Already fixed-step 1/60**, `solverIterations: 8` | Tune iterations, ratchet |
| Physics guide: joint angle limits 0–45° | `POSE_ARTICULATION_RADIANS` open `0.36` / closed `-0.22` rad | Keep kinematic; fix hinge axis (Node N17) |
| Bug report §A (Blender/Maya rigging) | **N/A** — scene is 100% procedural (`StaticScene.tsx`) | Drop |
| Bug report §B (physics joint constraint) | **N/A** — fingers have no colliders in v1 (A-02) | Drop |
| Bug report §C (quaternion/euler mismatch) | **Applies** — see Node N17 hypothesis | Adopt |
| Cleanup analysis (gsap, asset pipeline, `bootRequested`, `LEGAL_TRANSITIONS`, travel anim, evidence bus, `Vec3`/`Quat`) | **All confirmed** by code search (`Vec3` duplication 2×, `Quat` 1×) | Adopt as nodes N11–N16 |

**Conversion rule:** every adopted item must run inside the existing Three.js/R3F/Rapier/Zustand/Vitest stack. Anything that would require swapping a library or changing the approved physics strategy is gated behind a charter revision decision node, never implemented silently.

---

## 1. Verified baseline facts

- **State machine** (`src/state/controller.ts`, 601 lines): 12 states; `LEGAL_TRANSITIONS` table exists **but `dispatch()` re-implements legality inline** via `transitionFrom([...])` — duplicated truth confirmed.
- **`bootRequested`** appears in the action union, controller switch, and **only** `n5.test.ts`; runtime never emits it — runtime-dead diagnostic confirmed.
- **gsap** (3.12.5) never imported; only the ownership literal `gsapMovesAuthoritativeBodies: false` — unused dependency confirmed.
- **Asset pipeline** (`src/assets/registry.ts`, `manifest.ts`) imported **only** by `n3-evidence.ts` / `n3.test.ts`; the scene is fully procedural and `assetsReady` fires unconditionally — dead outside the evidence harness confirmed.
- **Hollow scene nodes** (`ClawPhysicsRoot`, `MachineCollisionProxies`, `ClawDebugRoot`, `DebugRoot`) are all `visible={false}` / empty; `ClawPhysicsRoot` carries `userData={{ adapterBoundary: true }}` and `REQUIRED_HIERARCHY` in `src/scene/report.ts` — they are contract markers for N3 evidence.
- **Travel interpolation**: `easeInOutCubic`/`startTravel`/`advanceTravel` live inside the 678-line `n7-coordinator.ts`, separate from `src/animation/pose-animation.ts` — a second animation system confirmed.
- **Evidence bus**: `window.__N3_RUNTIME_REPORT__` + `data-n3-runtime*` (N3Canvas), `window.__N7_RUNTIME_REPORT__` + `data-n7-*` on `.app-shell` (n7-coordinator, App.tsx reads them) — runtime carries the test harness confirmed.
- **Type duplication**: `Vec3` defined in `physics/config.ts` **and** `claw/rig.ts`; `Quat` defined in `claw/rig.ts`; `pose-adapter.ts`/`pose-animation.ts` re-import from `rig` — duplication confirmed (2× `Vec3`, 1× `Quat`).
- **Gate machinery** (`scripts/gate.mjs`): enforced against baseline `gate-1-baseline-rev1`; allowed diffs are **restricted to** `package.json` scripts block, `records/gate-log.md`, `scripts/gate*.mjs`. Source changes are blocked until a **new baseline revision** is recorded.
- **Approved decisions**: A-01 hybrid claw (kinematic root + dynamic prizes), A-02/A-23 visual-only fingers + sensor proxies, A-03 carry = explicit Rapier constraint, fixed-step policy rev1, performance thresholds recorded.

---

## 2. Implementation A — Dead-weight cleanup → nodes N11–N16

> Sequencing note: **N10 (re-baseline) must land first** because `gate.mjs` is frozen
> to `gate-1-baseline-rev1` and will block every source change below.

### N10 — Re-baseline maintenance branch (gate precondition)
- **Task:** Record a new baseline revision that permits maintenance diffs, without changing gate semantics.
- **Objective:** `gate.mjs` accepts diffs under `src/**`, `docs/**`, `records/**`, `package.json`, `scripts/**` against the new baseline; gate log records the decision.
- **Allowed files:** `records/gate-log.md`, `records/approvals/`, `scripts/gate*.mjs`, `META_PROMPT.md`, `fb_plan_graph.md`.
- **Protected:** nothing else.
- **Loop:** turn-based. **Proof:** `npm run gate:<n10> --dry-run`, git diff against new tag.
- **Stop:** gate semantics weakened, evidence fields missing.

### N11 — Remove gsap + `bootRequested`
- **Task:** Delete unused `gsap` dependency and the runtime-dead `bootRequested` action.
- **Objective:** no `import ... from 'gsap'` / no `gsap.` usage remains (the `gsapMovesAuthoritativeBodies` ownership literal is retained unchanged — it is a string, not a gsap usage); `bootRequested` absent from controller + tests; typecheck + 50 tests green.
- **Allowed:** `package.json`, `package-lock.json`, `src/state/controller.ts`, `src/evidence/n5.test.ts`.
- **Protected:** `src/physics/**`, `src/effects/n7-coordinator.ts`, `src/scene/**`.
- **Hypothesis:** dead code carries drift risk and false contract claims.
- **Proof:** `npm run typecheck && npm test && npm run lint && npm run build`; grep evidence.

### N12 — Make `LEGAL_TRANSITIONS` authoritative
- **Task:** Refactor `dispatch()` to consult the table; add one drift test asserting switch ≡ table.
- **Objective:** single source of truth; all 50 tests green + 1 new drift test.
- **Allowed:** `src/state/controller.ts`, `src/evidence/n5.test.ts`.
- **Protected:** `src/physics/**`, `src/effects/**`, `src/claw/**`, `src/scene/**`.
- **Hypothesis:** the duplicated legality switch can drift from the approved table (the analysis's highest-correctness-payoff item).
- **Proof:** existing transition tests + drift test + gate.

### N13 — Unify `Vec3`/`Quat`
- **Task:** Move geometry tuple types into `src/types/geometry.ts`; update `physics/config.ts`, `claw/rig.ts`, `pose-adapter.ts`, `pose-animation.ts`.
- **Allowed:** `src/types/**`, `src/physics/config.ts`, `src/claw/**`, `src/animation/**`.
- **Protected:** `src/state/**`, `src/scene/**`, `src/effects/**`.
- **Proof:** typecheck + full tests.

### N14 — Extract travel interpolation into animation layer
- **Task:** Move `easeInOutCubic`/`startTravel`/`advanceTravel` out of `n7-coordinator.ts` into a `travel-animator` beside `pose-animation.ts`; coordinator consumes it.
- **Objective:** one animation pattern; coordinator shrinks; behavior byte-identical (fixed-step travel unchanged).
- **Allowed:** `src/animation/**`, `src/effects/n7-coordinator.ts`.
- **Protected:** `src/state/**`, `src/physics/**`, `src/scene/**`.
- **Proof:** `n7.test.ts` (7 tests) + `n6.test.ts` (11 tests) unchanged and green.

### N15 — Extract evidence publisher
- **Task:** Centralize DOM/window writes (`window.__N7_RUNTIME_REPORT__`, `data-n7-*`, `data-n3-*`) into `src/evidence/publish.ts`; coordinator stops touching `document`.
- **Allowed:** `src/evidence/publish.ts`, `src/effects/n7-coordinator.ts`, `src/scene/N3Canvas.tsx`.
- **Protected:** `src/state/**`, `src/physics/**`.
- **Proof:** evidence tests + App.tsx attribute contract still satisfied.

### N16 — Decision: asset pipeline + hollow nodes (human-owned)
- **Task:** Choose (a) keep as contract markers, or (b) delete as one coherent system (report.ts validation + `RuntimeEvidenceProbe` + `data-*` attrs together). Decide asset pipeline fate (delete vs. re-point n3 evidence).
- **Required because:** `asset-contract.md` and `REQUIRED_HIERARCHY` are **approved Gate 1 contracts**; deletion without an explicit decision would be a silent contract change.
- **Output:** recorded decision in `docs/contracts/open-decisions.md` (new A-41…).

---

## 3. Implementation B — Claw joint orientation fix → Node N17

### N17 — Diagnose and fix asymmetric finger articulation
- **Task:** Reproduce the twisted-prong defect, confirm root cause, apply the minimal symmetrical-actuation fix.
- **Baseline:** `c54c616`; 50 tests green; static scene approved (gate-2).
- **Hypothesis (verified at code level):** in `src/claw/rig.ts` `poseTarget`, articulation is composed as `base.multiply(localArticulation)` with `setFromAxisAngle(new Vector3(1, 0, 0), articulation)`. The pivot's local X axis is the **radial** axis (Euler `(0, -angle, 0)` baseline), so rotating around local X sweeps the finger tip **tangentially**, not radially — the claw cannot flare around a prize ("twisted" appearance, no valid multi-point enclosure). Correct hinge for a hanging finger is the **tangential** axis (local Z) so the blade swings in the radial plane.
- **Fix candidate:** articulate around the tangential local axis (`Vector3(0, 0, 1)`) and/or correct the finger baseline orientation; keep the single scalar `POSE_ARTICULATION_RADIANS` (already symmetrical by design). Verify against `StaticScene.tsx` finger mesh (`FingerMesh` rotation `[0.25, 0, 0]`, blade along −Y, hook at +Z) so visual and rig agree.
- **Allowed:** `src/claw/rig.ts`, `src/claw/pose-adapter.ts`, `src/scene/StaticScene.tsx`, `src/scene/config.ts`, `src/evidence/n4.*`.
- **Protected:** `src/state/**`, `src/physics/**` (no physics change; fingers stay visual-only per A-02), `src/effects/**`.
- **Required proof:** reproduce first (screenshot + `detectDrift` pose evidence); apply one change; rerun all gates; visual approval for open/closed symmetry; keep-or-revert per [[Ratchet Loop]].
- **Stop:** defect depends on another subsystem; fix would require changing A-02.
- **Required output:** diagnosis, minimal diff, pose-drift evidence, screenshots, keep/revert decision.

> If the reproduced defect instead matches §B of the report (contact/grip failure), that is an **N6 physics node**, not N17 — grip evaluation stays physics-owned.

---

## 4. Implementation C — Physics realism tuning → nodes N18–N19

### N18 — Tune Rapier parameters within existing config (ratchet)
- **Task:** Raise solver iterations / friction / restitution per the guide, **only** inside `N6_PHYSICS_CONFIG`; run the full N6 scenario set each change; keep-or-revert.
- **Objective:** measurable improvement in carry stability and jitter without violating fixed-step policy or performance thresholds.
- **Allowed:** `src/physics/config.ts`, `src/evidence/n6.*`, `records/contracts/performance-thresholds.md`.
- **Protected:** `src/state/**`, `src/scene/**`, `src/effects/**`.
- **Proof:** `n6.test.ts` scenarios 1–8 (idle, travel, open/close, single-prize contact, carry, failed carry, reset, repeated run) + performance evidence.
- **Stop:** any scenario regresses; per-frame budget exceeded.

### N19 — Decision: dynamic fingers / cable realism (human-owned, deferred)
- **Task:** Record charter-revision request to evaluate dynamic prongs with revolute joints + joint motors, and/or a cable chain, against the approved A-01/A-02 strategy. *(Drafted as "A-41"; executed 2026-08-02 as **A-43** because A-41/A-42 were consumed by N16 — see §7 and `records/task-packets/N19-charter-revision-dynamic-fingers.md` §3.)*
- **Not implemented in this cycle.** Rationale: contradicts approved decisions; would change the physics strategy (Section 20) and the evidence suite.
- **Output:** decision + migration impact + new verification requirements, or explicit "keep visual-only fingers".

---

## 5. Sequencing and gate binding

```text
N10 re-baseline ──► N11 gsap/bootRequested ──► N12 transitions ──► N13 types
                          │                       └──────────► N14 travel animator
                          │                                   └──► N15 evidence publisher
                          └──────────► N16 decision (asset pipeline + hollow nodes) [HUMAN]
N17 claw joint fix (depends on N10; independent of N11–N16)   [needs visual approval]
N18 physics tuning (depends on N10; runs in parallel with N17)
N19 charter-revision decision (deferred; any time)             [HUMAN]
```

- Each node follows the META_PROMPT task-packet template (Task / Objective / Baseline / Allowed / Protected / Loop / Hypothesis / Required proof / Stop conditions / Required output).
- Every promotion runs the deterministic gate; a review document is never a pass (Gate rule 10.3).
- N17 and N18 are ratchet loops: one change, full scenario set, keep-or-revert.

## 6. What NOT to touch

- The authority model (ownership map, controller/physics/coordinator separation)
- The typed state machine with `runId` epochs and diagnostics
- The deterministic fixed-step physics with capped catch-up accumulator
- The approved contracts under `docs/contracts/` (unless a node's contract says so)
- `records/`, `gate.mjs`, `fb_plan*`, `META_PROMPT.md` are **process**, not product — keep, optionally move gate infra to `tools/` later (N16-style decision)

## Open questions for approval

- [ ] Adopt N10–N19 numbering and scope as proposed?
- [ ] N11: also delete `src/assets/` now, or fold into N16 decision?
- [ ] N17: authorize the tangential-axis fix hypothesis as the working hypothesis?
- [x] N19: **resolved 2026-08-02** — charter-revision request recorded as **A-43** (A-41/A-42 already consumed by N16), deferred; visual-only fingers kept.

---

## 7. Node N18 — Rapier parameter ratchet (executed 2026-08-02)

Ratchet loop per §4 contract: one parameter change at a time inside `N6_PHYSICS_CONFIG`,
full n6 scenario set after each change, keep-or-revert. **Verdict: all five probes
reverted — the approved `fixed-step-rev1` parameters are the local optimum.**

- **Task packet:** `records/task-packets/N18-physics-ratchet.md` (full probe table §2, evidence §3–§4).
- **Probes (11/11 scenarios green each):** solverIterations 8→16 (deviation +7.1% → revert);
  8→12 (+4.8% → revert); friction 0.7→0.9 (byte-identical → revert); restitution 0→0.1
  (byte-identical → revert); additionalFrictionIterations 2→4 (byte-identical, ~1.7× step
  cost → revert). Carry deviation baseline 0.00693; idle jitter 0 throughout.
- **Why:** the approved carry is an explicit fixed impulse joint (A-03) — solver/friction
  knobs cannot improve it; friction/restitution are inert in this fixture (fingers are
  visual-only per A-02/A-23, so tip friction is N19/A-43 territory).
- **Performance:** worst probe step cost ~0.22 ms vs ≤ 2 ms threshold — no threshold
  revision required. `src/physics/config.ts` left byte-identical to the approved baseline
  (only the pre-existing N13 type-import diff remains).
- **Evidence:** `src/evidence/n6-ratchet-report.json` refreshed 2026-08-02.
- **Status:** KEEP-REVERTED — configuration unchanged; ratchet closed with no keep.

---

## 8. Node N19 — Charter-revision decision: dynamic fingers / cable realism (executed 2026-08-02)

Human-owned decision node, executed per §4 contract: **record the charter-revision
request, do not implement.**

- **Task packet:** `records/task-packets/N19-charter-revision-dynamic-fingers.md`.
- **Decision:** **Keep visual-only fingers (A-02/A-23) this cycle.** Dynamic prongs + revolute joints + joint motors, and/or a cable chain, are **not implemented**; the evaluation is recorded as charter-revision request **A-43** in `docs/contracts/open-decisions.md`.
- **ID note:** the plan drafted this as "A-41", but A-41/A-42 were already consumed by N16's executed decisions; recorded under the next free ID **A-43** to keep the ledger collision-free (see §3 of the packet).
- **Migration impact + new verification requirements:** recorded in the A-43 row (rig/`poseTarget` role, physics adapter joints + colliders, `collision-matrix.md`/`fixed-step-policy.md` contract changes, n6/n7 evidence extension, carry-constraint equivalence, joint-angle determinism + performance re-check + visual gate).
- **No source change.** Typecheck/tests not re-run (nothing under `src/**` changed); `git status` confirms no protected-file modification.
- **Status:** KEEP — decision recorded and deferred; the human may open A-43 via a future charter-revision node.

---

## 9. Node N20 — Classic arcade claw cycle (added 2026-08-01, dispatched same day)

Follow-on to N17 (hinge fix) per human request: **resolve the claw** so the cycle is the
classic arcade sequence — parked OPEN, descend OPEN, fully CLOSE at the bottom, stay CLOSED
through lift and return, OPEN at the top to release — with the tangential-axis hinge kept
so the fingers are no longer twisted.

- **Task packet:** `records/task-packets/N20-claw-cycle-classic-arcade.md` (full contract, cycle table, evidence, stop conditions).
- **Runtime change (one file):** `src/effects/n7-coordinator.ts` — parked-open presentation at boot/reset; descend-open; no open during return; releasing opens fingers (`RELEASE_OPEN_MS = 250`) before `releaseGrip` removes the carry constraint.
- **Tests/evidence:** new n7 pose-label cycle test + parked-open reset assertions; `n7-evidence.ts` `poseRestored` verifies the parked-open pose. **52/52 tests green**, typecheck/lint/build clean.
- **No state-machine, physics, or rig change.** N17 hinge evidence (`records/evidence/n17-*`) remains valid.
- **Status:** implementation KEEP (pending human visual gate — see packet §5/§7).

Sequencing note: N20 is presentation-owned and independent of N11–N16 cleanup and N18
physics tuning; it depends only on N17's hinge state being present in the working tree.
