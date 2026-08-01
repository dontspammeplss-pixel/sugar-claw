# State-Machine Specification

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Authority:** Typed state controller, optionally stored through Zustand  
**Baseline:** `gate-1-baseline-rev1`

## States

| State       | Meaning                                       | Entry                                    | Exit                                                                            |
| ----------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `booting`   | Required application resources are preparing. | Mount/bootstrap or recoverable retry     | `assetsReady` → `ready`; load failure → `error`                                 |
| `ready`     | Stable baseline; a run may begin.             | Boot/reset complete with required assets | `beginAim` → `aiming`; reset; invariant failure                                 |
| `aiming`    | Player selects a legal horizontal target.     | Accepted aim start                       | `confirmDrop` → `lowering`; reset                                               |
| `lowering`  | Claw travels to the lower target.             | Drop accepted and target committed       | `poseReached(lowered)` → `aligning`; reset                                      |
| `aligning`  | Pose/physics settles before grip evaluation.  | Lowering complete                        | `alignmentSettled` → `gripping`; reset                                          |
| `gripping`  | Approved contact observations are evaluated.  | Alignment settled                        | `gripEvaluated` → `lifting`; reset                                              |
| `lifting`   | Claw travels to lift height after evaluation. | Grip attempt committed                   | `liftReached` → `returning`; reset                                              |
| `returning` | Claw travels to delivery/home target.         | Lift complete                            | `returnReached` → `releasing`; reset                                            |
| `releasing` | Approved release action is performed.         | Return complete                          | `releaseComplete` → `result`; reset                                             |
| `result`    | Outcome is stable and presented.              | Release complete                         | reset or approved next-run command                                              |
| `resetting` | All registered layers restore baseline.       | Reset accepted from any state            | `baselineRestored(ready)` → `ready`; `needsLoad` → `booting`; failure → `error` |
| `error`     | Recovery is required; progression is blocked. | Load/physics/invariant failure           | recoverable retry → `booting`; reset → `resetting`                              |

`paused` is excluded. Pause semantics require a separate approval because they affect timers, physics stepping, presentation, and input ownership.

## Commands

```text
beginAim
moveAim(axis/value)       # continuous, bounded; ClawMount-local meters (A-09)
confirmDrop
requestReset
retryLoad
```

Commands express intent. They do not directly set transforms, bodies, grip results, or state.

## System events

```text
bootRequested
assetsReady
assetLoadFailed(error)
poseReached(pose, runId)
alignmentSettled(runId)
gripEvaluated(outcome, runId)
liftReached(runId)
returnReached(runId)
releaseComplete(outcome, runId)
baselineRestored(status, runId) # status: ready | needsLoad
resetFailed(error, runId)
invariantFailure(error, runId)
```

`bootRequested` is a bootstrap lifecycle event and is idempotent/no-op once boot has begun; it never starts gameplay. The effect coordinator is the only emitter of normalized completion events.

## Legal transitions

```text
booting   --assetsReady--------------------> ready
booting   --assetLoadFailed---------------> error
booting   --requestReset------------------> resetting
ready     --beginAim----------------------> aiming
ready     --requestReset------------------> resetting
aiming    --moveAim-----------------------> aiming
aiming    --confirmDrop-------------------> lowering
aiming    --requestReset------------------> resetting
lowering  --poseReached(lowered)----------> aligning
aligning  --alignmentSettled--------------> gripping
gripping  --gripEvaluated(outcome)--------> lifting
lifting   --liftReached-------------------> returning
returning --returnReached-----------------> releasing
releasing --releaseComplete(outcome)------> result
result    --requestReset------------------> resetting
resetting --baselineRestored(ready)-------> ready
resetting --baselineRestored(needsLoad)--> booting
resetting --resetFailed-------------------> error
resetting --requestReset------------------> resetting (coalesced)
error     --requestReset------------------> resetting
error     --retryLoad---------------------> booting
* (except `resetting`) --invariantFailure--> error
```

During `resetting`, reset failures use `resetFailed`; they do not route through the generic invariant-failure rule. This exception is intentional: the reset transaction owns its own failure event and completion path. Events that are out of state are rejected diagnostically. A completion event is accepted only if its `runId` matches the active epoch and the current state expects it. Late callbacks are logged as stale and ignored.

`gripEvaluated` always advances to `lifting` in this first interaction contract. The outcome is carried in the run snapshot and finalized by `releaseComplete`; failure-specific movement, prize treatment, or early return remains subject to A-04, A-05, A-06, and A-26.

## Invariants

- At most one active run exists.
- `ready` and `result` are stable; presentation/physics work cannot silently advance them.
- No command skips `aligning`, `gripping`, or `releasing` without an approved contract revision.
- Invalid commands never mutate transforms or physics.
- Aim intent is stored in `ClawMount`-local **meters**, continuous and bounded (A-09); world targets are derived once at the adapter boundary.
- Reset creates a new run epoch, cancels old effects, and makes late callbacks harmless.
- Repeating the same command/event sequence produces the same transition records, subject to approved deterministic-variance policy.

## Serialized reset transaction

1. Accept `requestReset` through the controller; coalesce if already resetting.
2. Increment the run epoch and reject callbacks from the old epoch.
3. Stop gameplay input.
4. Cancel timers, subscriptions, pending pose effects, and presentation tweens.
5. Restore all registered physics bodies from baseline snapshots; absent registrations are explicit no-ops.
6. Restore claw pivots and pose targets from explicit baselines.
7. Restore prize logical placement/visibility and clear transient outcome/contact data.
8. Clear old-run diagnostics and accumulators.
9. Verify state, scene, transform, and physics invariants.
10. Emit `baselineRestored(ready|needsLoad)` or `resetFailed` through the effect coordinator.

Reset must not remount React nodes as its ordinary path, reverse the last animation, or apply an inverse impulse. Lifecycle remount/disposal is separate and must quiesce state, dispose physics before visual owners vanish, wait for fresh registration, then restore the same baseline before play becomes available.
