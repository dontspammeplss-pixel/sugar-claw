# Gate 1 Approval — Baseline Revision 1

| Field                 | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| **Decision**          | Approve Gate 1 contract baseline revision 1 for A-01 through A-40 |
| **Approved by**       | Human (routing node)                                              |
| **Date**              | 2026-08-01                                                        |
| **Prior baseline**    | `gate-0-baseline`                                                 |
| **Recorded baseline** | `gate-1-baseline-rev1` (pending git tag)                          |
| **Ledger**            | `docs/contracts/open-decisions.md`                                |
| **Contract set**      | `docs/contracts/` (8 documents)                                   |

## Outcome

The human approved A-01 through A-40 **subject to the binding refinements below**. These refinements amend the recommended provisional choices where they differ and bind every subsequent implementation node. Approved decisions are recorded in the open-decision ledger; the four mandated versioned contracts are recorded in `records/contracts/`.

## Binding refinements (verbatim)

1. The claw is **hybrid** with a **kinematic `ClawMount`** (A-01).
2. The first fingers are **visual** with dedicated **sensor proxies** (A-02, A-23).
3. Grip is **evaluator-approved** and represented by an **explicit Rapier-supported carry constraint** (A-03, A-24, A-26).
4. Aim is **continuous and bounded in `ClawMount`-local meters** (A-09, A-36, A-37).
5. Assets use **typed GLB/glTF manifests** (A-16).
6. Physics uses **centralized fixed-step configuration** and **tolerance-based repeatability evidence** (A-25, A-27).
7. **GSAP is presentation-only** (A-28).
8. **Deferred:** ScrollTrigger, scoring, sound, lives, randomness, compression tooling, and nonessential dependencies (A-07, A-20, A-29, A-31, A-33).

## Mandated versioned contracts

The following must exist as versioned contracts _before their corresponding implementation nodes begin_:

| Contract                                | Record (rev 1)                                | Bound decisions |
| --------------------------------------- | --------------------------------------------- | --------------- |
| Attachment primitive (carry constraint) | `records/contracts/attachment-primitive.md`   | A-03, A-26      |
| Collision matrix                        | `records/contracts/collision-matrix.md`       | A-22, A-23      |
| Fixed-step policy                       | `records/contracts/fixed-step-policy.md`      | A-25, A-27      |
| Performance thresholds                  | `records/contracts/performance-thresholds.md` | A-32            |

## Resulting decisions (summary)

- **A-01** Hybrid: kinematic claw root driven via the physics adapter within `ClawMount`'s legal volume; dynamic Rapier prize/environment.
- **A-02 / A-23** Fingers are visual-only in v1; contact evidence comes from dedicated sensor proxies, separate from any solver-response collider.
- **A-03 / A-26** A successful grip is an evaluator-approved, explicit Rapier-supported carry constraint created by the physics adapter at `GripCenter`; never visual parenting, never a hidden teleport.
- **A-09 / A-36 / A-37** Continuous, bounded aim stored in `ClawMount`-local meters; world conversion happens exactly once at the adapter boundary.
- **A-16** Typed manifest with GLB/glTF models loaded through a Three.js-compatible loader.
- **A-25 / A-27** One centralized fixed-step configuration; repeatability proven by tolerance-based evidence, not claimed bit-exactness.
- **A-28** GSAP interpolates presentation/pose only; it never moves authoritative bodies or promotes state.
- **Deferred (explicit scope):** randomness (A-07), compression/streaming tooling (A-20), ScrollTrigger (A-29), scoring/lives/sound/UI (A-31), nonessential loader/helper dependencies (A-33).

## Remaining Gate 1 item

Per `fb_plan_graph.md`, Gate 1 = N1 (contracts) + **N1a (deterministic gate-enforcement script)**. This approval covers N1. N1a must still be built to enforce gate evidence and protected-file boundaries before Gate 1 is fully promoted. The repository tag remains `gate-0-baseline` until `gate-1-baseline-rev1` is tagged.
