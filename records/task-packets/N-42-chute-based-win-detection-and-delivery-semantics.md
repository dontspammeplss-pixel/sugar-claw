# N-42 — Chute-based win detection and delivery semantics

**Bottom line:** Success must be awarded only when the prize’s tracked physical volume intersects the canonical chute/release-point sensor; grip approval is grip onset, not a win.

## Retain

- The chute becomes a physical delivery authority: a sensor plane/volume is authored at the release point in canonical meters and evaluated inside the existing fixed-step physics loop.
- Delivery is path-independent. A prize carried into the chute, dropped into it, nudged into it, or sliding/falling into it after a failed grip wins when the tracked volume intersects the sensor.
- A grip approved by the existing evaluator is not itself a success outcome. Carrying a gripped prize away without delivery produces no win and leaves the countdown intact.
- The existing C-02 state path is revised only at the win path: the delivery observation supplies the win outcome/result, while stale or cancelled run epochs are rejected.
- A win removes the delivered prize through the Phase-A playfield hook, emits the F-12 payout/inventory hook as an observable event with no-op consumer, and resets the play/win countdown.
- The evidence bus, rather than a screenshot or render overlap, records the delivery state, prize ID, run epoch, fixed-step index, and sensor-relative geometry for each fixture.
- The implementation boundary preserves the existing physics, transform, collision, and evidence authority model: `src/physics/adapter.ts` observes delivery; `src/state/**` owns transition/outcome; `src/effects/n7-coordinator.ts` coordinates UI/evidence/countdown; `src/scene/**` only visualizes the physical sensor.

## Caveats

- The N42 implementation is now landed on the approved `main` baseline. The target repository already contained unrelated N41/source and generated-record modifications; those were preserved and are not attributed to N42.
- C-07 is drafted at `records/contracts/win-delivery-semantics.md` because the target repository’s existing versioned contract artifacts are under `records/contracts/`; the vault outline’s generic convention says `docs/contracts/`. This path difference is recorded rather than silently treated as equivalent.
- The target task packet names historical baseline `3b8bb05`, while this request names `main`; the request’s `main` baseline governs this draft. No source baseline was rewritten.
- The sensor is an authored Rapier ball volume at `[1.05, 1.1, 0.55]` with radius `0.3`, in `world/ClawMount` canonical meters. Its release lane is `[1.05, 1.87, 0.55]`; scene chute geometry references the same X/Z lane.
- The inventory/payout consumer remains intentionally deferred to F-12/F-03. N42 emits the observable hook point only; the delivered prize is disabled/hidden through the Phase-A removal hook.

## Do not infer

- Do not infer that a prize wins merely because it was gripped, attached, released, visually overlapping the chute, or shown near it in a screenshot.
- Do not infer that every failed grip is a win; a failed grip wins only if the prize later intersects the physical sensor.
- Do not infer that N42 adds a new broad state-machine phase, changes the world convention, changes collision groups, changes the fixed-step policy, or requires DOM/render polling.
- Do not infer that N42 implements the economy, persistent multi-prize playfield, or a non-no-op payout consumer.
- Do not infer that N41’s passing retention gates prove delivery semantics; N42 requires its own fixtures and evidence-bus captures.

## Sources

- Authoritative user contract pasted for N42 — chute sensor, delivery predicate, C-02 win path, countdown reset, payout/inventory hook, evidence requirements, failure results, and stop conditions.
- Repository task packet: `~/Documents/coding_proj/claw_app/records/task-packets/N41-N42-retention-core-force-hold-chute-win.md`, §5 N42 — Chute-based win detection: delivery semantics.
- Vault outline: [[claw-app-node-contract-outline]] → N-18 / C-07 / N-42.
- Vault feature specification: `claw-app-feature-spec.md`, F-02, §4 win pipeline, §5 Phase A, §8 contract impacts.
- Target repository contract conventions: `~/Documents/coding_proj/claw_app/records/contracts/fixed-step-policy.md`, `collision-matrix.md`, and `attachment-primitive.md`.
- Verification artifact: `~/Documents/coding_proj/claw_app/src/evidence/n42-evidence.ts` and `src/evidence/n42.test.ts`.
- Verification on 2026-08-04: N42 focused test passed; typecheck, lint, full tests (14 files / 84 tests), and build passed.

**Status:** Implemented — verified
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
