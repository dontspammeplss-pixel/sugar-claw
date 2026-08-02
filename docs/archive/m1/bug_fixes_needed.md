  major [Stability & Availability]
  → src/physics/adapter.ts:429-431

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/physics/adapter.ts around lines 429 - 431, Update the adapter’s
  dispose() to track a disposed flag, return safely when called again, and
  set the flag before freeing world resources. Add disposal checks to
  step(), moveClaw(), attemptGrip(), releaseGrip(), and reset() so each
  rejects use after disposal before accessing freed state.


────────────────────────────────────────────────────────────────────────
  minor [Data Integrity & Integration]
  → src/effects/n7-coordinator.ts:201-215

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/effects/n7-coordinator.ts around lines 201 - 215, Update the
  command dispatch catch path around beginLowering and resetTransaction so
  that after emitInvariantFailure transitions the controller to failure, the
  method returns a DispatchResult with accepted set appropriately and the
  controller’s current post-failure snapshot, rather than the stale result
  snapshot. Preserve the existing result for successful side effects and
  match the exact DispatchResult shape defined by the controller state
  types.


────────────────────────────────────────────────────────────────────────
  major [Performance & Scalability]
  → src/effects/n7-coordinator.ts:242-256

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/effects/n7-coordinator.ts around lines 242 - 256, Update the tick
  loop around physicsAccumulatorMs, fixedStepMs, and physics.step() to guard
  against a non-positive this.physics.config.dt before entering the loop.
  Clamp the accumulated delta to a bounded maximum and limit the while-loop
  iterations per tick, discarding excess catch-up time while preserving
  deterministic fixed-step processing and existing
  syncVisuals/advanceEffects behavior.


────────────────────────────────────────────────────────────────────────
  major [Performance & Scalability]
  → src/effects/n7-coordinator.ts:524-530

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/effects/n7-coordinator.ts around lines 524 - 530, Update the
  useFrame reporting flow to avoid publishing unchanged snapshots: cache the
  app-shell element, track the last report signature with a ref alongside
  the existing refs, and invoke callbacks only when reported values change.
  Apply the same signature check inside publishRuntimeReport so redundant
  DOM setAttribute writes are skipped while preserving updates when values
  differ.


────────────────────────────────────────────────────────────────────────
  major [Maintainability & Code Quality]
  → src/physics/adapter.ts:401-427

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/physics/adapter.ts around lines 401 - 427, Extract the duplicated
  baseline restoration and claw kinematic reset sequence from reset() into a
  private helper, then call that helper before and after world.step(). Keep
  the existing ordering and subsequent collider/scene-query updates
  unchanged.


────────────────────────────────────────────────────────────────────────
  minor [Functional Correctness]
  → src/physics/adapter.ts:365-373

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/physics/adapter.ts around lines 365 - 373, Update releaseGrip() so
  logicalState is set to 'released' only when carryJoint existed and was
  removed; preserve the existing 'failed' state when no joint was present.
  Keep the removedAtRunId return behavior unchanged.


────────────────────────────────────────────────────────────────────────
  minor [Functional Correctness]
  → src/physics/adapter.ts:342-362

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/physics/adapter.ts around lines 342 - 362, Update attemptGrip() to
  track whether createImpulseJoint() was actually called during the current
  invocation, returning jointCreated and constraintCreatedAtRunId only for
  that creation rather than for an already-active carry joint. Add the
  proposed constraintRunId state, set it when the joint is created, and
  clear it in releaseGrip() and reset().


────────────────────────────────────────────────────────────────────────
  major [Performance & Scalability]
  → src/physics/adapter.ts:260-297

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/physics/adapter.ts around lines 260 - 297, Bound retained history
  in the adapter by adding the configurable maxRetainedStepRecords setting
  to N6_PHYSICS_CONFIG and enforcing it when step() appends to stepRecords,
  retaining only the newest records. Add a cheap count accessor for retained
  records and update callers such as n6-evidence.ts to use it for length
  checks instead of reading logs.length; keep logs as the cloned snapshot
  API.


────────────────────────────────────────────────────────────────────────
  major [Data Integrity & Integration]
  → src/evidence/n6-evidence.ts:167-178

  ▶ Prompt for AI agent
  Verify each finding against current code. Fix only still-valid issues,
  skip the rest with a brief reason, keep changes minimal, and validate.

  In @src/evidence/n6-evidence.ts around lines 167 - 178, Update the
  failedCarry.prizeRemainsRapierOwned predicate independently of
  prizeSettledNearFloor: compare the failed carry prize’s recorded positions
  against the claw’s failedLiftPosition to verify it never tracked the claw
  height, while preserving prizeSettledNearFloor’s existing floor-position
  check and updating affected evidence expectations if needed.
