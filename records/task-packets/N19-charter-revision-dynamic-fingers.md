# Task Packet — N19: Decision — Dynamic Fingers / Cable Realism (charter-revision request, deferred)

> Node N19 in the Claw Machine 3D engineering graph (human-owned decision node).
> **Status:** decision recorded 2026-08-02; **nothing implemented** — this cycle keeps
> the approved visual-only fingers (A-02/A-23). The charter-revision request is
> recorded as **A-43** in `docs/contracts/open-decisions.md` (see §3 for the A-41
> renumbering note).
> Baseline: c54c616 + working tree (N10–N17, N20 applied, uncommitted); 52/52 tests green.

---

## 1. The contract

```text
You are node N19 in the Claw Machine 3D engineering graph.

Task:            Record a charter-revision request to evaluate dynamic prongs with
                 revolute joints + joint motors, and/or a cable chain, against the
                 approved A-01/A-02 strategy. NOT implemented in this cycle.
Objective:       A recorded decision in docs/contracts/open-decisions.md with the
                 decision, migration impact, and new verification requirements —
                 or an explicit "keep visual-only fingers". No source change.
Current baseline: c54c616 + working tree (N10–N17, N20 applied, uncommitted);
                 52/52 tests green.
Allowed files:   docs/contracts/open-decisions.md, PLAN-node-contracts.md,
                 records/task-packets/**, records/evidence/**
Protected files: src/**, package.json, docs/contracts/** other than
                 open-decisions.md, ARCHITECTURE_CONTRACTS.md, fb_plan*.md
Loop type:       turn-based (human-owned decision) — record the decision; the human
                 decides whether to open the charter revision later.
Hypothesis:      Dynamic prongs + revolute joints + joint motors contradict
                 approved A-02/A-23 (fingers visual-only, sensor proxies); a cable
                 chain changes the physics strategy. Both are gated behind a
                 charter revision decision node, never implemented silently
                 (PLAN-node-contracts.md §0 conversion rule).
Required proof:  Decision row in open-decisions.md (new ID, see §3), this task
                 packet, PLAN-node-contracts.md status note, git diff showing no
                 protected-file change.
Stop conditions: the decision requires source changes; budget exceeded.
Required output: decision + migration impact + new verification requirements,
                 keep / revert / escalate recommendation.
```

## 2. Desired outcome (the observable contract)

| Item                    | Expected                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| Decision                | **Keep visual-only fingers in this cycle**; record the charter-revision request (A-43) for a future evaluation of dynamic prongs + revolute joints + joint motors and/or a cable chain. |
| Migration impact        | Documented in `docs/contracts/open-decisions.md` A-43 (which contracts/evidence change if the charter is revised). |
| New verification reqs   | Documented in A-43 (what gates/evidence a future charter-revision node must meet). |
| Code                    | **None.** `src/**`, `package.json`, versioned contracts untouched.         |

## 3. A-41 renumbering note (ledger integrity)

The plan's N19 draft says "record charter-revision request (A-41)". By execution
time, **A-41 and A-42 were already consumed** by node N16's executed decisions
(hollow scene nodes, asset pipeline) in `docs/contracts/open-decisions.md`.
Reusing A-41 would silently collide with the recorded N16 decision. Therefore the
N19 charter-revision request is recorded under the next free ID, **A-43**, and the
plan is amended to match. No other deviation from the plan.

## 4. Decision recorded (summary)

**Keep visual-only fingers (A-02/A-23) for this cycle — no dynamic prongs, no cable
chain.** The requested evaluation is recorded as charter-revision request **A-43**,
binding on nothing today; a future human-approved charter-revision node may open it.
Rationale (unchanged from plan): dynamic prongs contradict approved A-02/A-23 and
the single-kinematic-body claw (A-01); a cable chain is a new physics strategy
(Section 20 gate). Both would change the physics strategy and the evidence suite.

## 5. Required proof (results)

| Check                      | Command / artifact                          | Result               |
| -------------------------- | ------------------------------------------- | -------------------- |
| Decision ledger            | `docs/contracts/open-decisions.md` A-43     | recorded             |
| Task packet                | this file                                   | written              |
| Plan status                | `PLAN-node-contracts.md` §N19 + §3 open question | updated        |
| Protected-file check       | `git status --porcelain` diff scope         | **verified 2026-08-02:** this node's changes are only `PLAN-node-contracts.md`, `docs/contracts/open-decisions.md`, `records/task-packets/` (packet). All `src/**` modifications in the working tree pre-date N19 (N10–N17/N20 work, present at session start); `package.json` and `records/contracts/**` have no diff. |
| Typecheck / tests / build  | not required (no source change)             | n/a                  |

## 6. Recommendation

**KEEP.** The decision is recorded and deferred; visual-only fingers remain the
approved representation. Escalation path: the human may dispatch a future
charter-revision node (which would amend A-01/A-02/A-23 + evidence suite) or leave
this deferred indefinitely.
