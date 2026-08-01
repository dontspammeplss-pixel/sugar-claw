# Attachment Primitive — Carry Constraint (rev 1)

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Status**      | Approved — Gate 1 baseline revision 1 (2026-08-01)                       |
| **Baseline**    | `gate-1-baseline-rev1`                                                   |
| **Resolves**    | A-03, A-26                                                               |
| **Consumed by** | Claw/physics implementation nodes (N6 and later, per `fb_plan_graph.md`) |

## Primitive

A successful grip is represented by an **explicit Rapier-supported carry constraint** between the claw body (kinematic, anchored at `GripCenter`) and the prize body. It is a real solver constraint, never visual parenting and never an identity swap.

- **Creator:** the physics adapter only, and only when the approved grip evaluator reports a successful grip for the active run epoch.
- **Anchor:** `GripCenter` on the claw side; a recorded local anchor point on the prize body.
- **Form:** a fixed/rigid joint supported by the Rapier build in use (exact joint API selected during physics-adapter implementation within these bounds: a constraint that couples the prize body to the kinematic claw target, produces stable carry, and is fully removable).
- **Removal:** by the physics adapter at release or at reset; the constraint never outlives its run epoch.
- **Lifetime recording:** creation and removal are recorded with the run epoch in physics evidence (`created@runId`, `removed@runId`).

## Binding rules

1. Visual overlap never creates the constraint; contact/solver observations plus the evaluator decide the grip (A-24).
2. The constraint is created in the physics world, not by parenting the prize mesh under the claw.
3. During carry, the prize follows the kinematic claw within the recorded carry tolerance (see `fixed-step-policy.md`).
4. On failure, no constraint is created and the prize remains under Rapier (A-04).
5. Reset removes any live constraint and restores both bodies from baseline snapshots (A-05).
6. A constraint that appears without evaluator approval is a contract violation: stop and escalate.

## Evidence

Repeated-run carry evidence must record constraint creation/removal, run epoch, carried-prize deviation within tolerance, and reset restoration.
