# Claw Machine 3D — N1 Implementation Contract Set

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Baseline:** `gate-1-baseline-rev1`  
**Scope:** Architecture and verification contracts only.  
**Implementation authority:** No gameplay, physics, asset, animation, UI, or dependency implementation is authorized by this set.

## Purpose

This directory is the reviewable N1 deliverable. It turns the Gate 0 bootstrap into explicit contracts for the next nodes while preserving the project's one-authority-per-truth rule. The contracts are deliberately implementation-neutral where the decision has not been approved.

## Contract index

| Document                                             | Contract                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| [authority-map.md](./authority-map.md)               | Runtime truth owners, consumers, forbidden writers, and event direction     |
| [state-machine.md](./state-machine.md)               | States, commands, events, legal transitions, run epochs, and invariants     |
| [scene-claw-hierarchy.md](./scene-claw-hierarchy.md) | Logical scene graph, claw rig, pivots, and composition rules                |
| [transform-layers.md](./transform-layers.md)         | Authored, rig, pose, placement, physics, sync, and presentation layers      |
| [physics-layers.md](./physics-layers.md)             | Rapier ownership, proposed groups/matrix, contact evidence, and reset rules |
| [asset-contract.md](./asset-contract.md)             | Manifest, lifecycle, validation, cloning, ownership, and disposal           |
| [acceptance-criteria.md](./acceptance-criteria.md)   | Gate evidence and deterministic acceptance scenarios                        |
| [open-decisions.md](./open-decisions.md)             | Complete human-approval ledger A-01 through A-40                            |

## Approval rule

The human approved A-01 through A-40 on 2026-08-01 as **Gate 1 baseline revision 1**, subject to binding refinements recorded in `records/approvals/gate-1-baseline-rev1.md` and resolved in `open-decisions.md`. The four mandated versioned contracts (attachment primitive, collision matrix, fixed-step policy, performance thresholds) live in `records/contracts/`. N1a (gate enforcement) must still be built before Gate 1 is fully promoted.

## Cross-cutting rules

1. Every runtime truth has one authoritative writer.
2. Consumers use snapshots, commands, or observations; they do not silently mutate another subsystem's truth.
3. Rendered overlap is never proof of physical contact or a grip.
4. Reset is a first-class, serialized transaction, not inverse animation.
5. Moving parts expose named pivots and explicit baseline transforms.
6. A late callback from a cancelled run cannot advance the current run.
7. A contract violation stops the implementing node and escalates; it is not worked around.
8. These documents do not change `src/**`, dependencies, the authority model, or gameplay behavior.

## Baseline and ownership

The current application is the intentionally minimal Gate 0 R3F bootstrap described by `BOOTSTRAP.md`. `ARCHITECTURE_CONTRACTS.md` is the source draft used to produce this reviewable set; these files are the approved N1 deliverable (Gate 1 baseline revision 1, 2026-08-01). Protected files remain untouched.
