# Performance Thresholds (rev 1)

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Status**      | Approved — Gate 1 baseline revision 1 (2026-08-01)                                                 |
| **Baseline**    | `gate-1-baseline-rev1`                                                                             |
| **Resolves**    | A-32                                                                                               |
| **Consumed by** | Scene, physics, integration, and verification nodes; polish is **not** authorized by these numbers |

## Target

Modern desktop WebGL2 (the Gate 0 bootstrap assumption). First interaction scenario (one claw, one prize, one environment fixture, A-08).

## Thresholds (rev 1)

| Metric               | Threshold                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Sustained frame rate | ≥ 50 fps on the reference desktop target; 60 fps is the target                                                   |
| Frame budget         | p95 frame ≤ 20 ms; no sustained (≥ 1 s) frames above 33 ms during gameplay                                       |
| Physics step budget  | fixed 1/60 s step; physics step cost ≤ 2 ms average within the frame budget                                      |
| Memory               | no unbounded growth across repeated runs/resets; reset returns allocations to baseline within recorded tolerance |
| Network              | no required runtime network requests beyond the approved typed manifest assets                                   |

## Binding rules

- Thresholds are measured with the versioned fixed-step policy (`fixed-step-policy.md`) active.
- Profiling traces are recorded with scenario evidence (`records/evidence/`).
- Adjusting a threshold is a versioned-contract revision, approved by the human; a failing measurement is evidence, not a reason to silently move the bar.
- These thresholds do not authorize performance-optimization or polish work; they define the measurable bar integration (N7) and verification (N8) evaluate against.
