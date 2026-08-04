# N-21 — Drop button front-edge dead zone

**Bottom line:** The drop button fails to trigger claw descent when the claw is positioned near the front wall of the chamber — a positional gate or rendering-sync issue that blocks the `confirmDrop` lowering path at front-edge XY values.

## Retain

- Claw descent itself works correctly (speed, collision, sequencing) when the drop fires.
- The controller state machine transition `{ aiming → confirmDrop → lowering }` is always legal — no state-based rejection.
- Travel bounds (`z: [-0.35, 0.55]`) and the `moveClaw()` bounds check appear correct on static analysis.

## Caveats

- Root cause remains hypothesis. The lowering target derivation and bounds check pass static analysis — the dead zone may be a rendering-sync or glide-stall issue only visible in the live app.
- Requires live-app debugging to confirm root cause before implementation.

## Do not infer

- Do not infer that descent physics or claw close/open are broken; only the drop trigger is affected.
- Do not infer that this is related to the carry-to-delivery path (R3); the drop button is free-positioning descent, not post-grip return.

## Sources

- User bug report: "claw moved too close to the front of the machine and the drop action is pressed, it does not move" (2026-08-04)
- Idea Flush session: Seed D — manual drop button during free positioning
- Source analysis: `src/effects/n7-coordinator.ts` `beginLowering()`, `src/physics/adapter.ts` `moveClaw()` (verified 2026-08-04)
- Contract: C-11
- Task packet: `records/task-packets/C-11-post-n43-playfield-regression-fixes.md` §2 R2, §3 Phase 2

**Status:** Approved — pending investigation + implementation
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
