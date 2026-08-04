# Win and Delivery Semantics (C-07, rev 1)

**Status:** Approved — N42 implemented and verified 2026-08-04
**Authority:** `src/physics/adapter.ts` for physical delivery observation; `src/state/**` for outcome and transition; `src/effects/n7-coordinator.ts` for coordination, UI, evidence, and countdown reset; `src/scene/**` is presentation-only
**Baseline:** `main`

## Rule

A play is a win if and only if the prize's tracked physical volume intersects the canonical chute/release-point sensor during the active run epoch. Grip approval establishes grip onset only; it never establishes delivery or success.

## Body

### Scope in

1. Author one chute plane/sensor volume at the release point in canonical meters under the existing transform and physics configuration authority.
2. Evaluate prize-volume intersection with that sensor inside the existing fixed-step physics loop. Rapier contact or an adapter-owned spatial test is permitted; per-frame DOM/render work is forbidden.
3. Treat delivery as path-independent: carried, released, dropped, nudged, or sliding/falling prizes win when they intersect the sensor.
4. Reject the negative case: a gripped prize carried away without sensor intersection is not a win, and its countdown remains intact.
5. On a true delivery, use the existing C-02 state/result path with a delivery-win outcome; do not add a broad new state-machine phase. Reject observations from cancelled or old run epochs.
6. On win, remove the delivered prize through the Phase-A playfield-removal hook, emit the F-12 payout/inventory hook as an observable event with a no-op consumer until F-12/F-03 land, and reset the play/win countdown.
7. Publish delivery evidence on the evidence bus, including state/outcome, prize ID, active run epoch, fixed-step index, and sensor-relative geometry. The payout/inventory hook must also be observable there.
8. Keep chute visuals subordinate to the physical sensor. `src/scene/**` may reference the authored sensor/configuration but may not define or infer delivery.

### Binding invariants

- **Physical authority:** the adapter is the sole writer of sensor intersection truth; the coordinator never decides win from render overlap.
- **Epoch safety:** a delivery from a cancelled, reset, or stale run epoch cannot produce a win, remove a prize, fire payout, or reset the countdown.
- **Attachment safety:** a win cannot fire while the prize remains attached to the claw; release/ detachment must precede accepted delivery evidence.
- **Evidence safety:** a win without sensor-relative geometry and fixed-step identity is invalid evidence, even if the UI displays a win.
- **Determinism:** identical fixtures under the existing fixed-step policy must produce repeatable outcomes within the policy’s recorded tolerances.
- **No random outcome:** no probability table or grip-approval shortcut may create a win.

### C-02 impact

The existing state machine remains otherwise unchanged. The approved grip predicate is re-meant as `gripped`; the delivery observation supplies the success outcome/result through the existing win path. The contract does not prescribe new state names or a broader transition redesign.

### Failure results

- `chute-sensor-undefined`: no physical sensor volume or authored plane exists at the release point.
- `win-not-delivered`: a win fired without prize-volume intersection with the sensor.
- `delivery-denied`: a true sensor intersection was not recognized.
- `win-stale-epoch`: an observation from a cancelled, reset, or old run epoch was accepted.
- `win-ghost`: a win was accepted while the prize remained attached to the claw.

### Explicit non-goals

- No change to the world convention, canonical transform convention, fixed-step policy, or collision matrix.
- No per-frame DOM, screenshot, render-overlap, or browser-global polling decision.
- No new dependency or physics engine.
- No economy, coin accounting, prize valuation, persistent multi-prize playfield, display room, or non-no-op inventory consumer.
- No general state-machine rewrite beyond the delivery win path and its outcome/result semantics.

## Workstream

- **Phase:** A — retention core; N42 / F-02 only, following N41.
- **Approved source surface:** `src/physics/adapter.ts`; `src/state/**` (existing C-02 path, no new state); `src/effects/n7-coordinator.ts`; the Phase-A inventory/payout hook; `src/scene/**` for sensor-referenced visuals; and `src/evidence/n42-evidence.ts` / `src/evidence/n42.test.ts`.
- **Protected contracts:** `records/contracts/fixed-step-policy.md`, `records/contracts/collision-matrix.md`, and the existing transform/world convention. No protected contract was revised.
- **Cross-link:** vault node `[[N-42-chute-based-win-detection-and-delivery-semantics]]`; finding N-18; feature F-02.
- **N42.1 follow-up:** the approved carry-path fix is recorded at `records/task-packets/N42.1-carry-delivery-motion-path.md` and `[[N-42.1-carry-to-delivery-motion-path]]`; it adds only top-height traverse/descent motion before the unchanged release point and does not alter this contract’s delivery authority.
- **Implemented sensor:** Rapier ball sensor `chute-delivery-sensor`, center `[1.05, 1.1, 0.55]`, radius `0.3`, authored in `world/ClawMount` meters; the return/release lane is `[1.05, 1.87, 0.55]` and scene chute X/Z references the same lane.
- **Definition of done:** delivery sensor is physically authored and fixed-step evaluated; grip-only carry does not win; carried and failed-grip delivery wins; delivered prize is disabled/hidden; payout hook and delivery geometry are observable; countdown resets only on delivery; stale/attached safety holds; no render-overlap decision exists.
- **Verification result:** `src/evidence/n42.test.ts` passed (1 test); `npm run typecheck` passed; `npm run lint` passed; `npm test` passed (14 files / 84 tests); `npm run build` passed (72 modules transformed).

## Verification

1. **No-win carry fixture:** approve grip, carry the prize away, never intersect the sensor; assert no win, no removal/hook, and unchanged countdown.
2. **Win fixture:** release a carried prize over the chute; assert sensor intersection, delivery win/result evidence, prize removal hook, payout/inventory hook event, and countdown reset.
3. **Emergent fixture:** fail grip, allow the prize to slide/fall into the chute; assert the same delivery win path despite grip failure.
4. **Evidence-bus capture:** for every fixture, record state path, prize ID, active run epoch, fixed-step index, sensor-relative geometry, and hook observation.
5. **Negative safety checks:** stale/cancelled epoch does not win; attached prize cannot win; a win without sensor intersection fails the gate.
6. **Full gate:** `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; preserve existing reset and repeatability tests.

## Resolution notes

- Sensor geometry is resolved and implemented in `N6_PHYSICS_CONFIG.chute`; scene chute visuals reference the same X/Z release lane.
- Delivery and payout hook events are implemented as adapter-owned evidence fields and are published through the existing N7 runtime report/evidence bus.
- The repository’s existing contract path is `records/contracts/`; the vault outline’s generic `docs/contracts/` wording remains a documented convention discrepancy, not an implementation blocker.
