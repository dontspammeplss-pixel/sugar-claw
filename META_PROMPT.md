# META-PROMPT — Claw Machine 3D Graph-of-Loops Execution Driver

> **What this is:** A reusable meta-prompt (operating directive) for driving the Claw Machine 3D
> project to V1 completion. It encodes the graph-of-loops execution model from `fb_plan_graph.md`
> into a single repeatable prompt. Use it as the system directive for every agent dispatch in this
> project — or paste it into a fresh session to resume work.
>
> **The human is the router and the promotion gate.** No agent promotes itself. Every gate decision
> belongs to the human; this prompt is the machinery the human uses to dispatch, verify, and route.
>
> **Resume procedure (fresh session):** (1) run `git tag` and read `records/approvals/` +
> `records/contracts/` to find the current frontier; (2) pick the next ready node whose
> upstream edges are all promoted; (3) continue from §9 Immediate next action onward. Never assume
> progress that the tags and records do not show.

---

## 0. Core operating rules (read first, obey always)

1. **One node per message.** Never run two graph hops in a single turn. "Do Phase 2" is forbidden;
   "execute node N3 with this contract" is the only valid dispatch shape.
2. **Every unit of work is a bounded node** with: task, objective, baseline, allowed files,
   protected files, loop type, verifier, hypothesis, required proof, stop conditions, required
   output. If you cannot name the files and the proof, the node is too big — split it.
3. **Deterministic routing, not narrative.** Code-controlled decisions (build, typecheck, test
   success, protected-file modification, evidence presence, transition legality) are never
   overridden by a report that "looks good." A review document is not a pass.
4. **The ratchet:** inspect → one hypothesis → one change → run the scenario set → compare to
   baseline → keep only if the TOTAL result improves, else revert (failed hypothesis stays
   recorded).
5. **Fresh-context verification (N8 diamond).** Promotion requires independent adversarial
   verifiers on fresh contexts — never the implementing agent reviewing its own work.
6. **Loop type is matched to task nature.** N5 (state) is the only true autonomous-loop candidate.
   N3, N4, N6 are one-shot build nodes: one bounded pass per dispatch; a new finding routes back
   through the human, who re-dispatches. Never escalate a node's loop type silently.
7. **Stop conditions are hard.** Budget, conflicts, protected-file need, or unclear contract ⇒ stop
   and report. Repeated same-hypothesis failure ⇒ escalate to human, stop retrying.
8. **Records are the project's memory.** `records/` is maintained every dispatch; failed
   hypotheses survive reverted code.

---

## 1. Project state (source of truth: git tags + `records/` + `BOOTSTRAP.md`)

- **Repository:** `/home/eli/Documents/coding_proj/claw_app` (Vite + React 18 + TS + R3F + Zustand
  - GSAP + Rapier, exact-pinned per `BOOTSTRAP.md`).
- **Gate 0: APPROVED** (tag `gate-0-baseline`). Bootstrap scene renders; baseline contracts in
  `src/bootstrap.test.ts`.
- **Gate 1 contracts (N1): APPROVED** on 2026-08-01 as baseline revision 1 (A-01…A-40 subject
  to binding refinements). Records: `records/approvals/gate-1-baseline-rev1.md`; versioned
  contracts in `records/contracts/`; ledger `docs/contracts/open-decisions.md`. Tag
  `gate-1-baseline-rev1` pending.
- **N1a Gate script: NOT STARTED.** Deterministic gate enforcement does not exist yet.
- **Missing dirs to create as nodes approve them:** `scripts/`, `src/scene/`, `src/claw/`,
  `src/assets/`, `src/animation/`, `src/physics/`, `src/effects/`, `src/evidence/`.
- **Commands:** `npm run dev|build|typecheck|lint|format|format:check|test|preview`.

### Gate ↔ node binding (charter Gate 0–7)

| Gate   | Bound nodes                  |
| ------ | ---------------------------- |
| Gate 0 | N0 (done, `gate-0-baseline`) |
| Gate 1 | N1 + N1a                     |
| Gate 2 | N2 + N3                      |
| Gate 3 | N4                           |
| Gate 4 | N5                           |
| Gate 5 | N6                           |
| Gate 6 | N7                           |
| Gate 7 | N8 + N9                      |

---

## 2. The graph (remaining work, in dependency order)

```text
N1 Contracts ──► N1a Gate script          (L1 — current frontier)
N2 Design     N3 Scene+Assets   N5 State  (L2 — N2 ∥ N5 safe, N3 ∥ N5 safe)
N4 Claw rig ◄─ N2, N3                    (L3)
N6 Physics ◄─ N5, N4                      (L3)
N7 Integration ◄─ N3·N4·N5·N6             (L4)
N8 Verification diamond (fresh contexts)  (L5)
N9 Human Gate                             (L6)
```

**Safe parallel:** N2 (design docs) ∥ N5 (state controller tests); N3 (scene) ∥ N5.
**Unsafe:** any two of N3/N4/N6 touching the claw hierarchy or Rapier representation at once.

---

## 3. The node contract template (fill for every dispatch)

```text
You are node N<n> in the Claw Machine 3D engineering graph.

Task:            <one observable behavior>
Objective:       <the result that counts as done>
Current baseline:<git tag or revision>
Allowed files:   <exact paths>
Protected files: <exact paths — do not touch>
Loop type:       <turn-based | goal-based> + verifier
Hypothesis:      <why this node exists now>
Required proof:  <exact commands, tests, recordings, evidence>
Stop conditions: <budget, conflicts, protected-file need, unclear contract>
Required output: diagnosis, minimal implementation, files changed,
                 proof run + results, known limitations,
                 keep / revert / blocked / escalate recommendation
```

### Node contracts (pre-filled)

> Baselines below are the **expected post-approval tags** (e.g. `gate-2-design-approved`). Before
> each dispatch, confirm the actual current tag from `git tag` + `records/approvals/`.

#### N1 — Implementation contracts (turn-based)

```text
Task:            Produce the implementation contracts: authority map, state-machine spec,
                 scene + claw hierarchy, transform layers, physics layers, asset contract,
                 acceptance criteria, and the open-decision ledger.
Objective:       One reviewable `docs/contracts/` set the human can approve, plus a list of
                 every unresolved decision requiring human approval (A-01…A-40).
Current baseline: gate-0-baseline
Allowed files:   docs/contracts/**
Protected files: src/**, package.json, fb_plan*.md, any gameplay
Loop type:       turn-based — stop and report; the human decides "done".
Required proof:  The contract documents + the open-decision list.
Stop if:         you need to touch src/, add a dependency, or change the authority model.
Required output: contracts, open-decision list, keep/revert/escalate recommendation.
```

> **Status:** DONE — approved by the human on 2026-08-01 as Gate 1 baseline revision 1
> (A-01…A-40 subject to binding refinements; see `records/approvals/gate-1-baseline-rev1.md`
> and `docs/contracts/open-decisions.md`). **N1a remains before Gate 1 fully promotes.**

#### N1a — Deterministic gate script (goal-based)

```text
Task:            Implement `npm run gate:<node>` — deterministic gate enforcement.
Objective:       A script that (1) runs the node's required checks (typecheck, lint, test,
                 build, scenario set), (2) verifies required evidence fields/artifacts exist,
                 (3) detects protected-file modification vs baseline (git diff filtered to
                 allowed files), (4) records routing input/rule/outcome/checkpoint in
                 records/, (5) BLOCKS promotion on failure.
Current baseline: gate-1-baseline-rev1 (after N1 approved)
Allowed files:   scripts/gate*.mjs and the package.json scripts block
Protected files: everything else
Required proof:  Dry run that blocks on a synthetic protected-file violation; green run that
                 records a pass in records/gate-log.md.
Stop if:         you need to touch src/ or change the authority model.
```

> **This is the missing piece from Phase 0/1.** No node may be promoted by prose until this
> exists. Gate 1 = N1 approved + N1a running.

#### N2 — Visual design (turn-based)

```text
Task:            Produce the approved visual design: machine proportions, claw look, camera
                 presets, lighting, materials, and the review-camera definition.
Objective:       A design doc the human approves before any scene/asset build.
Current baseline: gate-1-approved
Allowed files:   docs/design/**
Protected files: src/**, package.json, fb_plan*.md
Loop type:       turn-based — aesthetics require human approval.
Required proof:  Design document + review-camera description + proportion/hierarchy sketches
                 mapped to contract names (ClawSystem, MachineRoot, etc.).
Stop if:         you need gameplay code or a new dependency.
```

#### N3 — Static scene + assets (goal-based)

```text
Task:            Build the machine frame, scene hierarchy, camera, lighting, and claw visual
                 hierarchy per the approved design — completely static, no physics, no state.
Objective:       Machine and claw render in the correct hierarchy, scale, orientation, and
                 home position after refresh and remount. Asset manifest/registry per §5 of
                 the contracts (typed, validated, deduped, clone policy).
Current baseline: gate-1-approved + gate-2-design-approved
Allowed files:   src/scene/**, src/assets/**, src/evidence/**, docs/scene/**
Protected files: src/claw/** rig logic, src/state/**, src/physics/**, gameplay animation
Loop type:       goal-based — verifier is deterministic (refresh/remount/transform report)
                 + one human visual gate.
Required proof:  dev server, production build, typecheck, refresh test, remount test,
                 screenshot from the review camera, transform and hierarchy report,
                 asset validation + failure-path evidence.
Stop if:         the result requires physics, state, or a new authority.
```

#### N4 — Claw rig articulation (goal-based)

```text
Task:            Implement deterministic claw articulation: named pivots, poses
                 (home, raised, lowered, open, closed, reset), and the pose adapter.
Objective:       Fingers rotate around their named pivots; repeated cycles produce identical
                 results; reset restores the exact baseline; no cumulative transform drift.
Current baseline: gate-2-design-approved
Allowed files:   src/claw/**, src/animation/**, src/evidence/**
Protected files: src/state/**, src/physics/**, prize objects, asset-loader architecture,
                 scoring, package.json
Loop type:       goal-based — pose replay + drift detection.
Required proof:  Each pose captured; repeated open/close cycles; interrupted cycle; refresh
                 and remount; evidence of no cumulative drift. No inverse-transform resets.
Stop if:         you need physics, state promotion, or new dependencies.
```

#### N5 — Logical state machine (goal-based — best loop candidate)

```text
Task:            Implement the typed state controller: commands, transitions, Zustand
                 snapshot, and deterministic transition tests for the full legal table.
Objective:       Valid commands produce legal transitions; invalid commands are rejected with
                 diagnostics; reset works from every state; stale runId callbacks are ignored;
                 the controller is the ONLY authority that promotes logical state.
Current baseline: gate-1-approved
Allowed files:   src/state/**, src/evidence/**
Protected files: claw geometry, asset loading, Rapier config, visual design, GSAP
Loop type:       goal-based — fully deterministic transition tests; the one node that
                 plausibly earns a true autonomous iteration loop.
Required proof:  Legal transition tests, illegal command tests, reset-from-every-state,
                 interrupted-action tests, repeated identical input, error-state test, full
                 transition-sequence evidence.
Stop if:         you need to touch scene/physics/animation files.
```

#### N6 — Minimal Rapier physics (goal-based)

```text
Task:            One claw, one prize, one environment: implement the minimal Rapier scenario
                 — idle stability, claw travel, contact vs visual-overlap, successful carry
                 or documented controlled attachment, failed carry, reset, repeated run.
Objective:       Physics adapter owns stepping and body transforms; contact is distinguishable
                 from visual overlap; reset restores bodies + logical state; parameters
                 centralized and documented.
Current baseline: gate-4-state-approved + gate-3-rig-approved
Allowed files:   src/physics/**, src/evidence/**, one evaluation scene fixture
Protected files: claw visual hierarchy, state-machine definitions, asset-loader architecture,
                 scoring, presentation logic, package.json
Loop type:       goal-based — scenario set is deterministic.
Required proof:  Idle stability, travel bounds, contact without false positives, carry/fail,
                 reset, repeated run, physics logs/evidence.
Stop if:         the physics strategy must change (escalate to human first).
```

#### N7 — Integration (goal-based)

```text
Task:            Integrate the approved scene, claw rig, state controller, and Rapier adapter.
                 Do NOT redesign any subsystem.
Objective:       State commands drive the claw; physics body and rendered claw stay
                 synchronized; grip outcomes return to the controller; reset restores visual,
                 logical, and physical state; GSAP never moves authoritative bodies; bootstrap
                 and subsystem checks still pass.
Current baseline: gates 2–5 approved
Allowed files:   src/App.tsx, src/effects/**, src/evidence/**
Protected files: all subsystem internals, package.json
Loop type:       goal-based — full suite + bootstrap checks define "done".
Required proof:  Full test suite green, typecheck, lint, build, bootstrap smoke, integration
                 scenario evidence (commands → claw behavior, sync, grip → state, reset).
Stop if:         two subsystems disagree about ownership — report the conflict, never
                 workaround.
```

#### N8 — Verification diamond (fan-out of goal-based nodes)

```text
Task:            Run independent adversarial verifiers on FRESH contexts: visual, state,
                 assets, physics, regression, performance. Merge + dedupe findings.
Objective:       Attempt to disprove the integration. A verifier that finds nothing is not
                 proof — the attempt must be recorded.
Current baseline: gate-6-integration
Loop type:       fan-out of goal-based nodes (parallel, independent).
Verifier prompts: try false-positive grips; transform drift after reload/remount/reset;
                 break the system by interrupting every state boundary; find regressions
                 outside the changed subsystem.
Required proof:  Per-verifier evidence artifacts in records/evidence/, deduplicated finding
                 list, per-finding routing (fix/reject/escalate via convergent loop, 2 clean
                 rounds default).
```

#### N9 — Human gate (turn-based, by definition)

```text
Task:            The human decides promote / return / escalate on the merged verification
                 result. Only deterministic checks + preserved evidence can justify promotion.
Objective:       Gate 7 approved; V1 complete criteria all bound to deterministic evidence
                 files in records/evidence/.
```

---

## 4. Routing table (on every node exit)

| Exit condition                                       | Route                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Pass (proof exists and checks ran)                   | Promote → advance along outgoing edges, tag baseline `gate-<n>-<name>-approved`, record in decision log |
| New finding (proof fails)                            | Return to same node with the finding; one hypothesis per retry                                          |
| Regression (breaks protected system or earlier gate) | **Revert to baseline**, record the failed hypothesis                                                    |
| Repeated same-hypothesis failure                     | Escalate to human — stop retrying                                                                       |
| Scope / authority conflict                           | Stop, escalate — never work around                                                                      |
| Budget exceeded                                      | Stop and report, regardless of promise                                                                  |
| Human-owned decision required                        | Block at the gate until human approves                                                                  |

**Convergent regression loop** (when a node returns multiple failures):

1. Run the relevant scenario set.
2. Record each failure as a distinct finding.
3. **Deduplicate against everything seen in prior rounds — not just confirmed results.**
4. Fix, reject, or escalate **one** finding.
5. Re-run the relevant checks.
6. Stop after N clean rounds (default 2) or when budget is exhausted.

---

## 5. Records and shared state (maintain in `records/`)

- `task-packets/<node>-NN.md` — every dispatched node contract
- `approvals/gate-<n>-baseline-rev<m>.md` — human approvals and baseline revisions
- `contracts/` — versioned contracts (attachment primitive, collision matrix, fixed-step
  policy, performance thresholds)
- `gate-log.md` — deterministic gate evaluations (written by N1a, future)
- `evidence/<node>/` — screenshots, logs, recordings, traces
- `verification/` — verification and regression results, failed hypotheses (kept even after code is reverted), known limitations

Checkpoint after: baseline, contract approval, every node gate, integration, verification, and
any failed experiment that changes the next hypothesis.

---

## 6. Human operating procedure (how you drive this prompt)

1. **Open this file.** Pick the next ready node (all upstream edges promoted).
2. **Fill the node contract** (template in §3) — you choose allowed/protected files, proof,
   stop conditions. If you can't name the files and the proof, split the node.
3. **Dispatch one node per message** — always "execute node N<n> with this contract".
4. **Inspect the diff and the proof yourself** before deciding. Run `npm run gate:<node>` or the
   verifier diamond.
5. **Decide keep / revert / escalate**, tag a new baseline (`git tag gate-<n>-<name>-approved`,
   e.g. `gate-2-design-approved`), record it in `records/approvals/gate-<n>-baseline-rev<m>.md`.
6. **Repeat.** Never let one agent run two graph hops in a single turn.

---

## 7. Definition of V1 complete

V1 is complete only when every criterion below is bound to a node/gate AND its deterministic
evidence file exists in `records/evidence/`:

- [ ] Gate 0: baseline, commands, package versions, browsers/devices recorded (`BOOTSTRAP.md`)
- [ ] Gate 1: contracts approved (A-01…A-40 decided or explicitly deferred) + gate script enforces them
- [ ] Gate 2: static scene passes visual + asset-loading review; claw hierarchy and pivots documented
- [ ] Gate 3: open/closed/raised/lowered/reset poses stable with no drift
- [ ] Gate 4: state machine has legal transitions and recovery behavior; controller is sole state authority
- [ ] Gate 5: minimal Rapier scenarios pass defined invariants; contact ≠ visual overlap
- [ ] Gate 6: integration green — no competing writers, reset restores scene/prizes/logical state across all layers, full app builds/runs
- [ ] Gate 7: independent verification attempted to disprove the result; no critical/high-severity failure remains unclassified
- [ ] Known limitations and unproven behaviors recorded; failed hypotheses kept

**No criterion passes on narrative alone.**

---

## 8. Honesty guardrail (when the graph is NOT needed)

Most tasks are a single loop with a clear verifier, not a graph:

- A graph is required at **N8** (parallel independent verification).
- A graph is useful at the **routing level** (this prompt) to prevent scope creep and collisions.
- A graph is **not** required inside N3/N4/N5/N6 — each is one loop, one agent, one verifier.

Escalate from loop → graph only when a single loop demonstrably fails.

---

## 9. Immediate next action

1. [DONE] Contracts extracted to `docs/contracts/` and approved 2026-08-01 as Gate 1 baseline
   revision 1 (A-01…A-40 subject to binding refinements).
2. [DONE] Approval recorded in `records/approvals/gate-1-baseline-rev1.md`; versioned
   contracts in `records/contracts/`. Next: tag `gate-1-baseline-rev1`.
3. Dispatch N1a (gate script) with the §3 contract; verify it blocks on a synthetic
   protected-file violation; tag `gate-1-approved`.
4. Then N2 (design, turn-based) ∥ N5 (state, parallel-safe) before any scene/claw/physics build.

**Do not build the claw or add gameplay until Gate 1 (N1 + N1a) is approved and enforced.**
