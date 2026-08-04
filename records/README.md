# Records

Per the execution plan (§12) and the project charter (§9), this directory maintains durable records across the graph-of-loops lifecycle. Every record carries a baseline revision and is human-owned once approved.

## Structure

| Directory       | Contents                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approvals/`    | Human approval records and baseline revisions (e.g. Gate 1 baseline revision 1)                                                                            |
| `contracts/`    | Versioned contracts mandated _before_ their implementation nodes begin (attachment primitive, collision matrix, fixed-step policy, performance thresholds) |
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
- `task-packets/N31-N33-input-and-head-feel-fixes.md` (contract-only) — keyboard mapping, pointer drag continuity, and dynamic-head feel contracts.
- `task-packets/N36-N40-descent-grip-collision-contracts.md` (contract-only) — descent-to-base, complete-contact grip, collision observability, mesh-to-collider derivation, and integrated verification contracts.
- `task-packets/N41-N42-retention-core-force-hold-chute-win.md` (contract-only, 2026-08-04) — Phase A: force-based hold model (F-01 → C-06) and chute-based win detection (F-02 → C-07).
- `task-packets/N43-N46-playfield-prize-manifest-geometry-rigs.md` (contract-only, 2026-08-04) — Phase B: multi-prize manifest/persistence, geometry variety, bone-rigged prizes, obstacles (F-03–F-06 → C-08).
- `task-packets/N47-N51-feel-rigging-pendulum-speed-ops.md` (contract-only, 2026-08-04) — Phase C: pendulum coupling, speed profiles, braking, force-source decision, ops-only grip strength (F-07–F-11 → C-06 ext / C-10).
- `task-packets/N52-economy-coin-prize-layer.md` (contract-only, 2026-08-04) — Phase D: economy / coin / prize-cost layer (F-12 → C-09).
- `task-packets/N53-display-room-winnings.md` (contract-only, 2026-08-04) — Phase E: prize display room (F-14 → C-09 ext).

## Rules

- A versioned contract changes only by an approved revision; an implementation node never silently renegotiates one.
- A record is authoritative once it names a baseline revision and a human approval date.
- Records are evidence for gates; they are not implementation code and never change `src/**`, dependencies, or the authority model.
