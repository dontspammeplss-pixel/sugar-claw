# Records

Per the execution plan (§12) and the project charter (§9), this directory maintains durable records across the graph-of-loops lifecycle. Every record carries a baseline revision and is human-owned once approved.

## Structure

| Directory       | Contents                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approvals/`    | Human approval records and baseline revisions (e.g. Gate 1 baseline revision 1)                                                                            |
| `contracts/`    | Versioned contracts mandated _before_ their implementation nodes begin (attachment primitive, collision matrix, fixed-step policy, performance thresholds) |
| `decisions/`    | (future) Recorded architecture decisions and amendments                                                                                                    |
| `task-packets/` | (future) Dispatched node packets per the plan's task-contract format                                                                                       |
| `scenarios/`    | (future) Approved scenario/fixture definitions                                                                                                             |
| `evidence/`     | (future) Verification evidence artifacts, logs, screenshots, traces                                                                                        |
| `verification/` | (future) Verification and regression results, failed hypotheses                                                                                            |

## Current contents

- `approvals/gate-1-baseline-rev1.md` — the human approval of A-01…A-40 as Gate 1 baseline revision 1, with binding refinements.
- `contracts/attachment-primitive.md` (rev 1) — explicit Rapier-supported carry constraint for a successful grip.
- `contracts/collision-matrix.md` (rev 1) — resolved collision group bits and interaction matrix.
- `contracts/fixed-step-policy.md` (rev 1) — centralized fixed-step physics configuration and tolerance evidence.
- `contracts/performance-thresholds.md` (rev 1) — desktop performance/frame/physics/memory thresholds.

## Rules

- A versioned contract changes only by an approved revision; an implementation node never silently renegotiates one.
- A record is authoritative once it names a baseline revision and a human approval date.
- Records are evidence for gates; they are not implementation code and never change `src/**`, dependencies, or the authority model.
