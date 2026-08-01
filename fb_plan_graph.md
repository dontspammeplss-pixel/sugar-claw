# Claw Machine 3D — Graph-of-Loops Execution Plan

> Implements the verified research in `/home/eli/.obsidian/EehnSWE/permanent-notes/`. Supersedes the linear phase structure of `fb_plan.md`. The human is the router and the promotion gate; every unit of agent work is a bounded node with an explicit loop type, verifier, evidence, and routing rule.

## 0. Why this plan is structured as a graph, not phases

`fb_plan.md` was written as Phase 0 → Phase 7 with a gate at the end of each phase. That is a **linear schedule**. The research your notes distilled converges on a different structure:

- **"Most tasks never need a graph: a well-scoped loop with a clear verifier usually suffices. This is the strongest-evidenced practical rule"** (graph-engineering-agent-orchestration-practice.md).
- The four loop types (trigger × stop) must be **matched to task nature**, and you escalate only when simpler forms fail (four-types-of-agent-loops.md, trigger-x-stop-agent-loop-taxonomy.md).
- Promotion is decided by **deterministic routing**, not by narrative; a review document is not a pass (charter §10.4, deterministic-routing pattern).
- Independent work **fans out and merges** (diamond topology); verifier nodes run on **fresh contexts** to avoid self-agreement bias (parallel-agent-graph-workflows.md).
- Every change runs the **ratchet**: keep only if the total result improves, else revert (agent-loop-engineering-karpathy-autoresearch.md).
- Failures are **findings that get deduplicated and routed**, not plot points in a linear story (convergent-cycles pattern).

So the plan below is a **directed graph**: named nodes (units of work), explicit edges (dependencies), a routing table (what happens on pass / fail / regression / escalation), and a loop type per node. The claw machine's gameplay phases still appear — but as **node payloads**, not as the skeleton.

## 1. The graph

Layered topology (exact edges in the table below — this is a dependency layout, not a visual graph):

```text
  ┌─ L0 ───────────────────────────────────────────────────────┐
  │  N0 Baseline (done, Gate 0, tag gate-0-baseline)           │
  └───────┬────────────────────────────────────────────────────┘
          ▼
  ┌─ L1 ───────────────────────────────────────────────────────┐
  │  N1 Contracts ────────────────► N1a Gate script            │
  └───────┬────────────────────────────────────────────────────┘
          ▼
  ┌─ L2 ───────────────────────────────────────────────────────┐
  │  N2 Design      N3 Scene+Assets      N5 State              │
  └─┬─────────┬───────────────┬──────────┘
    ▼         ▼               ▼
  ┌─ L3 ─────┴────────────────┴───────────────────────────────┐
  │  N4 Rigs ◄── N2, N3         N6 Physics ◄── N5             │
  │       (also ◄ N1 contracts)        (also ◄ N4, ◄ N1)      │
  └───────┬────────────────────────────┬──────────────────────┘
          ▼                            ▼
  ┌─ L4 ─┴────────────────────────────┴───────────────────────┐
  │  N7 Integration ◄── N3 · N4 · N5 · N6                      │
  └───────┬────────────────────────────────────────────────────┘
          ▼
  ┌─ L5 ─┴────────────────────────────────────────────────────┐
  │  N8 Verification diamond (visual · state · assets ·       │
  │     physics · regression · performance) — fresh-context   │
  │     verifier nodes, findings merged + deduplicated        │
  └───────┬────────────────────────────────────────────────────┘
          ▼
  ┌─ L6 ─┴────────────────────────────────────────────────────┐
  │  N9 Human Gate ──► promote / return / escalate             │
  └────────────────────────────────────────────────────────────┘
```

**Edges and why they exist:**

| Edge                | Reason                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| N0 → N1             | Baseline and evidence records exist before any contract.                                             |
| N1 → N1a            | Deterministic gate enforcement must exist before any later node can be promoted.                     |
| N1 → N2, N3, N5, N6 | Contracts (authority map, state machine, boundaries) are prerequisites for all implementation nodes. |
| N1 → N4             | The rig contract (pivots, hierarchy, poses) is part of the contracts.                                |
| N2 → N3, N4         | The approved visual design feeds both the scene and the claw rig.                                    |
| N3 → N4             | The claw lives in the scene hierarchy; scene stability precedes articulation.                        |
| N4 → N6             | Rig poses are inputs to physics interaction scenarios.                                               |
| N5 → N6             | The state controller issues the commands the Rapier adapter executes.                                |
| N3, N4, N5, N6 → N7 | Integration happens only after each subsystem passes its gate.                                       |
| N7 → N8 → N9        | Verified result fans out for adversarial review, then the human decides.                             |

**Safe parallel work** (per parallel-agent-graph-workflows.md — non-overlapping file ownership): N2 (design docs) ∥ N5 (state controller tests); N3 (scene) ∥ N5. **Unsafe**: N3 and N4 and N6 touching the same claw hierarchy or Rapier representation simultaneously.

## 2. Loop type per node (trigger × stop, matched to task nature)

From trigger-x-stop-agent-loop-taxonomy.md: _turn-based_ (human trigger, human stop), _goal-based_ (prompt trigger, evaluator stop), _time-based_ (clock trigger, human/cancel stop), _proactive_ (event trigger, autonomous stop). Match the loop to the task, not to how "advanced" it sounds.

| Node            | Loop type                            | Why (task nature)                                                                                                                                   |
| --------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| N0 Baseline     | goal-based                           | Deterministic checks (build, typecheck, test, render smoke) define "done".                                                                          |
| N1 Contracts    | **turn-based**                       | "Done" is human judgment: authority decisions, boundary choices. Bad fit for autonomy (agent-loop-engineering note: architecture = bad first loop). |
| N2 Design       | **turn-based**                       | Aesthetics and proportions require human approval.                                                                                                  |
| N3 Scene+Assets | goal-based                           | Verifier is deterministic (refresh/remount/transform report) + one human visual gate.                                                               |
| N4 Claw rig     | goal-based                           | Verifier is deterministic (pose replay, drift detection, reset).                                                                                    |
| N5 State        | **goal-based — best loop candidate** | Fully deterministic transition tests; ideal first loop (matches the "good first loops have deterministic verification" rule).                       |
| N6 Physics      | goal-based                           | Scenario set is deterministic (idle, travel, contact, carry, fail, reset, repeat).                                                                  |
| N7 Integration  | goal-based                           | Full suite + bootstrap checks define "done".                                                                                                        |
| N8 Verification | fan-out of goal-based nodes          | Independent verifiers on fresh contexts; diamond topology.                                                                                          |
| N9 Human        | turn-based (by definition)           | Promotion gate.                                                                                                                                     |

**Loop-justification heuristic** (agent-loop-engineering-karpathy-autoresearch.md): an _autonomous iteration loop_ earns its overhead only when all four conditions hold — the task repeats weekly, verification is automated, the token budget tolerates waste, and the agent has senior-level tools. Applied here: **N5 (state controller) is the only node that plausibly meets all four** once its transition tests exist (deterministic, re-run on every change — the research's "good first loop"). N3, N4, N6 are one-shot build nodes that fail the "repeats weekly" condition, so they are goal-based in trigger × stop semantics only (a prompt triggers them, an evaluator stops them) — they must **not** autonomously iterate. Each runs one bounded pass per dispatch; a new finding routes back through the human, who re-dispatches. If any node appears to need many iterations, stop and ask the human rather than looping autonomously.

**Escalation rule:** no node may silently escalate its own loop type. A node that needs proactive/time-based autonomy must be proposed to the human first (charter §20 change policy).

## 3. Node contracts

Every node is dispatched with this contract. This is the **task packet** (fb_plan.md §11 + charter §12):

```text
You are node N<n> in the Claw Machine 3D engineering graph.

Task:            <one observable behavior>
Objective:       <the result that counts as done>
Current baseline:<git tag or revision>
Allowed files:   <exact paths>
Protected files: <exact paths — do not touch>
Loop type:       <turn-based | goal-based> + your verifier
Hypothesis:      <why this node exists now>
Required proof:  <exact commands, tests, recordings, evidence>
Stop conditions: <budget, conflicts, protected-file need, unclear contract>
Required output: diagnosis, minimal implementation, files changed,
                 proof run + results, known limitations,
                 keep / revert / blocked / escalate recommendation
```

Example — the next real node:

> You are node N1 (Contracts) in the Claw Machine 3D engineering graph. Task: produce the implementation contracts (authority map, state-machine spec, scene + claw hierarchy, transform layers, physics layers, asset contract, acceptance criteria). Objective: one reviewable `docs/contracts/` set that the human can approve. Current baseline: `gate-0-baseline`. Allowed files: `docs/contracts/**`. Protected files: `src/**`, `package.json`, `fb_plan*.md`, any gameplay. Loop type: turn-based — you stop and report; the human decides "done". Required proof: the contract documents plus a list of every unresolved decision requiring human approval. Stop if you need to touch `src/`, add a dependency, or change the authority model. Required output: contracts, open-decision list, keep/revert/escalate recommendation.

N1a (the gate script) is a node like any other and gets its own contract: allowed files `scripts/gate*.mjs` and the `package.json` scripts block; protected everything else; proof is a dry run that blocks on a synthetic protected-file violation.

## 4. Routing table (deterministic routing)

On every node exit, route by rule — not by how the report reads:

| Exit condition                                         | Route                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Pass (required proof exists and checks ran)            | Promote → advance along outgoing edges                                  |
| New finding (proof fails)                              | Return to same node with the finding recorded; one hypothesis per retry |
| Regression (breaks a protected system or earlier gate) | **Revert to baseline**, record the failed hypothesis                    |
| Repeated same-hypothesis failure                       | Escalate to human (stop retrying)                                       |
| Scope / authority conflict                             | Stop, escalate to human — never work around                             |
| Budget exceeded                                        | Stop and report, regardless of promise                                  |
| Human-owned decision required                          | Block at the gate until human approves                                  |

**Convergent regression loop** (convergent-cycles pattern, agent-graph-patterns note): when a node returns multiple failures, route them through the convergent loop rather than one-at-a-time ad hoc:

1. Run the relevant scenario set.
2. Record each failure as a distinct finding.
3. **Deduplicate against everything seen in prior rounds — not just confirmed results.** The loop-until-dry lesson: deduping only against confirmations re-explores known territory.
4. Fix, reject, or escalate **one** finding.
5. Re-run the relevant checks.
6. Stop after N clean rounds (default 2) or when the budget is exhausted.

A clean round counts only when the required checks actually execute and their evidence is preserved. The routing table above is the control flow for each individual finding.

Code-controlled decisions (build success, typecheck, test success, protected-file modification, evidence presence, transition legality) are **never overridden by narrative**. Model-controlled decisions (hypothesis generation, visual interpretation, failure classification) inform but cannot promote.

## 5. Verification diamond (N8)

Per diamond-topology and verifier-pattern research, promotion requires independent adversarial review on **fresh contexts** (parallel-agent-graph-workflows.md: "dedicated verifier nodes on independent contexts prevent self-agreement bias"):

```text
Approved integration (N7)
          │
   +──────┼──────+──────+──────+──────+
   │      │      │      │      │      │
Visual State Assets Physics Regress Perf   ← separate fresh-context nodes
   │      │      │      │      │      │
   +──────┼──────+──────+──────+──────+
          │  merge + dedupe findings
          ▼
    N9 Human gate: pass / return / escalate
```

Verifier prompts are adversarial, e.g.:

- "Try to produce a false-positive grip where visual overlap occurs without valid contact."
- "Try to reproduce transform drift after reload, remount, reset, and repeated animation."
- "Try to break the system through interruption at every state boundary."
- "Try to find a regression outside the changed subsystem."

A verifier that finds nothing is not proof; the attempt must be recorded.

## 6. Ratchet rule (keep or revert)

Applied to every node, per Karpathy's autoresearch pattern:

```text
inspect → form one hypothesis → apply one change
→ run the scenario set → compare against baseline
→ keep only if the TOTAL result improves → else revert (or leave unpromoted)
```

**Total-result rule:** a change is not an improvement if it fixes the claw but breaks asset loading, improves grabbing but causes jitter, passes one scenario while failing reset, or violates a protected boundary. Reverting code does not delete the failure record — the failed hypothesis stays documented so no future node rediscovers it.

## 7. Deterministic gate enforcement (the missing piece from Phase 0/1)

Per charter §10.4, promotion must be enforced by a **deterministic gate**, not by the presence of a review document. Until this exists, gates stay **pending**. Implement it as node **N1a** (a mandatory, separately contracted node — see §3):

- `npm run gate:<node>` — a script that:
  1. Runs the node's required checks (typecheck, lint, test, build, scenario set).
  2. Verifies required evidence fields/artifacts exist (task packet, proof logs, screenshots).
  3. Detects protected-file modification vs. the current baseline (git diff filtered to allowed files).
  4. Records the routing input, rule evaluation, selected outcome, and checkpoint in `records/`.
  5. **Blocks promotion on failure** and routes to return/revert/escalate/human.

A reviewer may recommend, but cannot promote by writing an approval note.

**Gate ↔ node binding** (charter Gate 0–7): Gate 0 = N0 · Gate 1 = N1 + N1a · Gate 2 = N2 + N3 · Gate 3 = N4 · Gate 4 = N5 · Gate 5 = N6 · Gate 6 = N7 · Gate 7 = N8 + N9. §12's "bound to a node/gate" criteria are keyed to this table.

## 8. Records and shared state

Per shared-state research and fb_plan.md §12, maintain in `records/`:

- `task-packets/<node>-NN.md` — every dispatched node contract
- `decision-log.md` — human approvals and architecture decisions
- `gate-log.md` — deterministic gate evaluations
- `evidence/<node>/` — screenshots, logs, recordings, traces
- `failed-hypotheses.md` — kept even after code is reverted
- `known-limitations.md` — what remains unproven

Checkpoint after: baseline, contract approval, every node gate, integration, verification, and any failed experiment that changes the next hypothesis.

## 9. Human operating procedure (how you drive this)

1. **Open this file.** Pick the next ready node from the graph (a node whose upstream edges are all promoted).
2. **Fill the node contract** (template in §3) — you choose allowed/protected files, proof, and stop conditions. If you can't name the files and the proof, the node is too big; split it.
3. **Dispatch one node per message** — never "do Phase 2", always "execute node N3 with this contract".
4. **Inspect the diff and the proof yourself** before deciding. Run `npm run gate:<node>` or the verifier diamond.
5. **Decide keep / revert / escalate**, tag a new baseline (`git tag node-N3-approved`), record it in the decision log.
6. **Repeat.** Never let one agent run two graph hops in a single turn.

## 10. When the graph is NOT needed (honesty guardrail)

Per the strongest-evidenced rule — most tasks are a **single loop with a clear verifier**, not a graph. In this project:

- A graph is required at **N8 (verification diamond)** because it is parallel independent work.
- A graph is useful at the **routing level** (this document) because it prevents scope creep and collisions.
- A graph is **not** required inside N3/N4/N5/N6 — each is one loop, one agent, one verifier. Do not build a swarm for work that a loop handles more reliably and cheaply.

Escalate from loop → graph only when a single loop demonstrably fails.

## 11. Session map (from fb_plan.md §13, re-expressed as nodes)

| Session   | Node(s)                                                                                     | Human action                                        |
| --------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| S1 (done) | N0 Baseline                                                                                 | Gate 0 approved, tag `gate-0-baseline`              |
| S2        | N1 Contracts + N1a gate script                                                              | Approve contracts + gate enforcement → Gate 1       |
| S3–4      | N2 Design → N3 Scene _(N5 State may run in parallel — safe, non-overlapping files, per §1)_ | Approve design; scene stability checks → Gate 2     |
| S5–6      | N4 Claw rig                                                                                 | Pose replay + drift evidence → Gate 3               |
| S7–8      | N5 State controller                                                                         | Transition replay tests → Gate 4                    |
| S9–12     | N6 Physics                                                                                  | Minimal scenario set → Gate 5                       |
| S13–14    | N7 Integration                                                                              | Full suite still green → Gate 6                     |
| S15+      | N8 Verification diamond → N9                                                                | Adversarial review, merge, human promotion → Gate 7 |

Parallelizable by the human: N2 (design docs) with N5 (state tests) — non-overlapping files.

## 12. Definition of V1 complete

Same criteria as fb_plan.md §14, now with each criterion bound to a node/gate and requiring its deterministic evidence file to exist in `records/evidence/`. No criterion passes on narrative alone.

## Immediate next action

Execute node N1 with the contract in §3 (example provided). Do not proceed to N2/N3/N4/N5/N6 until N1 is approved and the gate-enforcement script (N1a, §7) exists and runs.
