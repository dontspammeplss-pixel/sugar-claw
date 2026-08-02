# Task Packet — N20: Classic Arcade Claw Cycle (resolve claw, untwist fingers)

> Node N20 in the Claw Machine 3D engineering graph (supersedes none; follows N10–N17).
> **Status:** contract written and dispatched 2026-08-01; implementation executed in the same
> session per human scope decision. Promotion still requires the human visual gate (see §5).

---

## 1. The contract

```text
You are node N20 in the Claw Machine 3D engineering graph.

Task:            Revise the claw presentation cycle to the classic arcade sequence and keep
                 the tangential-axis finger hinge so the fingers are no longer twisted.
Objective:       The claw presents OPEN when parked (boot + reset), descends OPEN, fully
                 CLOSES around the prize at the bottom, stays CLOSED through lift and
                 return, and OPENS only at the top when releasing. The finger hinge stays
                 on the tangential (local Z) axis from N17 — blades swing radially (open
                 flares outward, closed converges on the claw axis), never tangentially.
Current baseline: c54c616 + working tree (N10–N17 applied, uncommitted); 51/51 tests green,
                 typecheck clean.
Allowed files:   src/effects/n7-coordinator.ts, src/evidence/n7.test.ts,
                 src/evidence/n7-evidence.ts, records/task-packets/**,
                 records/evidence/**, PLAN-node-contracts.md
Protected files: src/state/**, src/physics/**, src/scene/**, src/claw/rig.ts (N17 hinge
                 verified only — not re-authored), package.json,
                 ARCHITECTURE_CONTRACTS.md, docs/contracts/**
Loop type:       goal-based — deterministic pose/transition replay + one human visual gate.
Hypothesis:      The claw cycle is a presentation decision owned by the effect coordinator
                 (A-28 presentation-only; A-21 pose adapter owns the visual root). The
                 approved state machine (12 states, LEGAL_TRANSITIONS) and the rig poses
                 (open/closed/reset) already support the classic sequence; only the
                 coordinator's pose scheduling and the parked pose need revision. The N17
                 tangential-axis hinge (already in the working tree) resolves the
                 twisted-prong appearance; the human confirmed the twist is to be "made
                 right", i.e. kept and visually verified.
Required proof:  npm run typecheck && npm test && npm run lint && npm run build;
                 new n7 cycle test asserting pose labels per phase (parked open → descend
                 open → closed through lift/return → open at release); reset restores the
                 parked-open pose; n7 evidence poseRestored=true; visual screenshots
                 (parked open, closed at bottom, open at release) for the human visual gate.
Stop conditions: the fix requires a state-machine change, a physics change, editing the
                 approved rig hinge contract, or adding a dependency; budget exceeded;
                 protected-file need.
Required output: this packet, minimal coordinator diff, test/evidence updates, proof run
                 + results, known limitations, keep / revert / escalate recommendation.
```

## 2. Desired cycle (the observable contract)

| Phase        | State(s)      | Finger pose  | Notes                                                        |
| ------------ | ------------- | ------------ | ------------------------------------------------------------ |
| Parked       | `ready`       | **open**     | Boot and every reset; layered on the restored baseline rig.  |
| Aim          | `aiming`      | **open**     | Horizontal travel only; no pose change.                      |
| Descend      | `lowering`    | **open**     | Claw lowers toward the grip position with fingers open.      |
| Close        | `aligning`    | open→**closed** | Fingers fully close around the prize at the bottom.        |
| Grip         | `gripping`    | **closed**   | Sensor contact evaluated; carry constraint created.          |
| Lift         | `lifting`     | **closed**   | Carries the prize upward.                                    |
| Return       | `returning`   | **closed**   | Travels home; fingers stay closed (changed from N7 v1).      |
| Release      | `releasing`   | **open**     | Fingers open at the top, then the carry constraint is removed (changed from N7 v1). |
| Result       | `result`      | **open**     | Outcome presented; reset returns to parked open.             |

The release point moves from the *start of the return leg* to the *releasing state at home*:
this is the "open only at the top to drop the prize" classic behavior. No state-machine
transition changes; no physics change.

## 3. Why the twist is gone (N17 evidence, kept verbatim)

- Hinge axis in `src/claw/rig.ts` `poseTarget`: **local Z (tangential)** — `setFromAxisAngle(new Vector3(0, 0, 1), articulation)`.
- `records/evidence/n17-repro-after.json`: open sweep is **purely radial** (tangential
  component ≈ 0); open tips flare to radial distance `0.315`, closed tips converge to `0.064`
  (well inside the `0.31` prize radius) — a valid multi-point enclosure.
- `records/evidence/n17-before-fix.png` vs `n17-after-fix.png` + `n17-visual-review.html`.
- N17 evidence doc: `records/evidence/n17-articulation-fix.md` (KEEP, pending human visual gate).

## 4. Implementation executed (diff summary)

`src/effects/n7-coordinator.ts` (the only runtime change):

1. **Parked open** — constructor and `resetTransaction` call `pose.restoreBaseline()` then
   `pose.applyPoseTarget('open')`. Reset still restores the exact baseline rig; the open
   pose is the approved presentation layer on top (L2 named pose target, A-28).
2. **Descend open** — `beginLowering` starts the animator toward `open` (0 ms snap) instead
   of `lowered`; `releaseOpened` is reset for the new run.
3. **Stay closed on return** — `beginReturn` no longer starts the `open` animation (removed
   the previous `animator.start('open', 120)`).
4. **Open at release** — the `releasing` handler now starts the `open` animation
   (`RELEASE_OPEN_MS = 250`) once via the `releaseOpened` flag, and only removes the physics
   carry constraint (`releaseGrip`) after the open pose completes.

`src/evidence/n7.test.ts`: reset drift check now asserts the parked-open pose
(`detectDrift('open')` + `currentPose === 'open'`); new cycle test asserts pose labels per
phase. `src/evidence/n7-evidence.ts`: `poseRestored` verifies the parked-open pose.

## 5. Required proof (results)

| Check          | Command                     | Result |
| -------------- | --------------------------- | ------ |
| Typecheck      | `npm run typecheck`         | pending gate run |
| Tests          | `npm test`                  | pending gate run |
| Lint           | `npm run lint`              | pending gate run |
| Build          | `npm run build`             | pending gate run |
| Cycle evidence | new n7 pose-label test      | added |
| Visual gate    | screenshots + human review  | **human-owned** |

## 6. Known limitations

- The visual fingers open ~250 ms before the physics constraint is removed (release pose
  completes first, then `releaseGrip`). This is intentional (drop looks physical) but the
  prize is still attached to the claw during that window.
- The parked-open presentation is a coordinator decision; `reset` still restores the
  baseline rig transforms first (contract rule 5 / A-21).
- Browser screenshots for the visual gate are best captured by the human from the running
  app (interactive capture was unreliable in this session).

## 7. Recommendation

**KEEP** (pending human visual gate). Allowed-file boundary respected; no protected files
touched; deterministic tests cover the new cycle; N17 hinge evidence unchanged.
