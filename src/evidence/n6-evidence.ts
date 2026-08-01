import {
  N6PhysicsAdapter,
  positionsMatch,
  type PhysicsStepRecord,
  type PhysicsTransform,
} from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'

function maxPositionDelta(
  records: readonly PhysicsStepRecord[],
  body: 'claw' | 'prize',
): number {
  if (records.length < 2) return 0
  return records.slice(1).reduce((maximum, record, index) => {
    const previous = records[index][body].position
    const current = record[body].position
    const delta = Math.max(
      Math.abs(current[0] - previous[0]),
      Math.abs(current[1] - previous[1]),
      Math.abs(current[2] - previous[2]),
    )
    return Math.max(maximum, delta)
  }, 0)
}

function anchorDistance(
  claw: PhysicsTransform,
  prize: PhysicsTransform,
): number {
  const expectedPrize = [
    claw.position[0] + N6_PHYSICS_CONFIG.sensorOffset.x,
    claw.position[1] + N6_PHYSICS_CONFIG.sensorOffset.y,
    claw.position[2] + N6_PHYSICS_CONFIG.sensorOffset.z,
  ]
  return Math.sqrt(
    expectedPrize.reduce(
      (sum, value, index) => sum + (value - prize.position[index]) ** 2,
      0,
    ),
  )
}

function trimLogs(records: readonly PhysicsStepRecord[]): readonly PhysicsStepRecord[] {
  return records.slice(0, 3).concat(records.slice(-3))
}

async function runSuccessfulCarry() {
  const adapter = await N6PhysicsAdapter.create()
  adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
  adapter.stepMany(3)
  const contact = adapter.observeGrip()
  const grip = adapter.attemptGrip()
  adapter.step()
  const settleRecords = adapter.stepMany(N6_PHYSICS_CONFIG.carrySettleSteps)
  const carryRecords: PhysicsStepRecord[] = [...settleRecords]
  for (let step = 1; step <= N6_PHYSICS_CONFIG.carryLiftSteps; step += 1) {
    const progress = step / N6_PHYSICS_CONFIG.carryLiftSteps
    const target = N6_PHYSICS_CONFIG.gripPosition.map(
      (value, axis) =>
        value +
        (N6_PHYSICS_CONFIG.liftPosition[axis] - value) * progress,
    ) as [number, number, number]
    adapter.moveClaw(target)
    carryRecords.push(adapter.step())
  }
  const measuredCarryRecords = carryRecords.slice(N6_PHYSICS_CONFIG.carrySettleSteps)
  const carryDeviation = Math.max(
    ...measuredCarryRecords.map((record) => anchorDistance(record.claw, record.prize)),
  )
  const beforeRelease = adapter.transform('prize')
  const removedAtRunId = adapter.releaseGrip()
  const afterRelease = adapter.step()
  const result = {
    contact,
    grip,
    constraintCreatedAtRunId: grip.constraintCreatedAtRunId,
    settleSteps: N6_PHYSICS_CONFIG.carrySettleSteps,
    measuredCarrySteps: measuredCarryRecords.length,
    carryDeviation,
    beforeRelease,
    afterReleasePrize: afterRelease.prize,
    stateAfterRelease: adapter.state,
    constraintRemovedAtRunId: removedAtRunId,
    jointRemoved: !afterRelease.jointActive,
    totalSteps: adapter.retainedStepRecords,
    logs: trimLogs(adapter.logs),
  }
  adapter.dispose()
  return result
}

/**
 * Generates the complete N6 proof from fresh Rapier worlds. The fixture is
 * intentionally one claw, one prize, and one floor environment.
 */
export async function createN6Evidence() {
  const idleAdapter = await N6PhysicsAdapter.create()
  const idleRecords = idleAdapter.stepMany(180)
  const idleTail = idleRecords.slice(-60)
  const idle = {
    steps: idleRecords.length,
    prizeFinal: idleAdapter.transform('prize'),
    prizeTailPositionJitter: maxPositionDelta(idleTail, 'prize'),
    prizeFinalSpeed: Math.max(...idleAdapter.velocity('prize').map(Math.abs)),
    clawFinal: idleAdapter.transform('claw'),
    stable:
      maxPositionDelta(idleTail, 'prize') <= N6_PHYSICS_CONFIG.tolerances.idlePosition &&
      Math.max(...idleAdapter.velocity('prize').map(Math.abs)) <=
        N6_PHYSICS_CONFIG.tolerances.idleVelocity,
    totalSteps: idleAdapter.retainedStepRecords,
    logs: trimLogs(idleAdapter.logs),
  }
  idleAdapter.dispose()

  const travelAdapter = await N6PhysicsAdapter.create()
  const acceptedTargets = [
    [
      N6_PHYSICS_CONFIG.travelBounds.min.x,
      N6_PHYSICS_CONFIG.travelBounds.min.y,
      N6_PHYSICS_CONFIG.travelBounds.min.z,
    ] as const,
    [
      N6_PHYSICS_CONFIG.travelBounds.max.x,
      N6_PHYSICS_CONFIG.travelBounds.max.y,
      N6_PHYSICS_CONFIG.travelBounds.max.z,
    ] as const,
  ] as const
  const accepted = acceptedTargets.map((target) => ({
    target,
    accepted: travelAdapter.moveClaw(target),
    record: travelAdapter.step(),
  }))
  const rejected = {
    below: travelAdapter.moveClaw([
      N6_PHYSICS_CONFIG.travelBounds.min.x - 0.001,
      N6_PHYSICS_CONFIG.travelBounds.min.y,
      N6_PHYSICS_CONFIG.travelBounds.min.z,
    ]),
    above: travelAdapter.moveClaw([
      N6_PHYSICS_CONFIG.travelBounds.max.x + 0.001,
      N6_PHYSICS_CONFIG.travelBounds.max.y,
      N6_PHYSICS_CONFIG.travelBounds.max.z,
    ]),
  }
  const travel = {
    accepted,
    rejected,
    boundsMatch: accepted.every(({ record, target }) =>
      positionsMatch(
        record.claw,
        { position: target, quaternion: record.claw.quaternion },
        N6_PHYSICS_CONFIG.tolerances.travel,
      ),
    ),
  }
  travelAdapter.dispose()

  const overlapAdapter = await N6PhysicsAdapter.create()
  const failedCarryBaseline = overlapAdapter.baselineTransform('prize')
  overlapAdapter.moveClaw(N6_PHYSICS_CONFIG.overlapPosition)
  overlapAdapter.stepMany(3)
  const overlapObservation = overlapAdapter.observeGrip()
  const failedGrip = overlapAdapter.attemptGrip()
  overlapAdapter.moveClaw(N6_PHYSICS_CONFIG.failedLiftPosition)
  const failedCarryRecords = overlapAdapter.stepMany(60)
  const failedCarryFinal = failedCarryRecords.at(-1)!.prize
  // Independent of the floor check: the prize must never track the claw's
  // lift height, so its highest recorded position stays below the claw's
  // failedLiftPosition by at least the carry tolerance.
  const prizeMaxHeight = Math.max(
    ...failedCarryRecords.map((record) => record.prize.position[1]),
  )
  const failedCarry = {
    observation: overlapObservation,
    grip: failedGrip,
    state: overlapAdapter.state,
    jointNeverCreated: failedCarryRecords.every((record) => !record.jointActive),
    prizeRemainsRapierOwned:
      prizeMaxHeight <=
      N6_PHYSICS_CONFIG.failedLiftPosition[1] -
        N6_PHYSICS_CONFIG.tolerances.carryPosition,
    prizeSettledNearFloor: failedCarryFinal.position[1] <=
      failedCarryBaseline.position[1] + N6_PHYSICS_CONFIG.tolerances.idlePosition,
    totalSteps: overlapAdapter.retainedStepRecords,
    logs: trimLogs(overlapAdapter.logs),
  }
  overlapAdapter.dispose()

  const carry = await runSuccessfulCarry()

  const resetAdapter = await N6PhysicsAdapter.create()
  const resetBaseline = {
    claw: resetAdapter.baselineTransform('claw'),
    prize: resetAdapter.baselineTransform('prize'),
    environment: resetAdapter.baselineTransform('environment'),
  }
  resetAdapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
  resetAdapter.stepMany(3)
  resetAdapter.attemptGrip()
  resetAdapter.moveClaw(N6_PHYSICS_CONFIG.resetTravelPosition)
  resetAdapter.stepMany(30)
  const runBeforeReset = resetAdapter.currentRunId
  resetAdapter.reset()
  const reset = {
    state: resetAdapter.state,
    runIdAdvanced: resetAdapter.currentRunId === runBeforeReset + 1,
    stepsAfterReset: resetAdapter.steps,
    logsAfterReset: resetAdapter.logs.length,
    clawRestored: positionsMatch(
      resetAdapter.transform('claw'),
      resetBaseline.claw,
      N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ),
    prizeRestored: positionsMatch(
      resetAdapter.transform('prize'),
      resetBaseline.prize,
      N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ),
    environmentRestored: positionsMatch(
      resetAdapter.transform('environment'),
      resetBaseline.environment,
      N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ),
    noLiveJoint: !resetAdapter.carryConstraintActive,
    noContactAfterReset: !resetAdapter.observeGrip().physicalContact,
    zeroPrizeVelocity: resetAdapter.velocity('prize').every((value) => value === 0),
    contactRefresh: 'adapter-owned narrow-phase bookkeeping step',
  }
  resetAdapter.dispose()

  const repeatOne = await runSuccessfulCarry()
  const repeatTwo = await runSuccessfulCarry()
  const repeatedRun = {
    runs: 2,
    sameOutcome:
      repeatOne.grip.accepted === repeatTwo.grip.accepted &&
      repeatOne.jointRemoved === repeatTwo.jointRemoved,
    carryDeviationDelta: Math.abs(
      repeatOne.carryDeviation - repeatTwo.carryDeviation,
    ),
    finalPrizePositionMatch: positionsMatch(
      repeatOne.afterReleasePrize,
      repeatTwo.afterReleasePrize,
      N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ),
    withinTolerance:
      Math.abs(repeatOne.carryDeviation - repeatTwo.carryDeviation) <=
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
  }

  return {
    node: 'N6',
    baseline: 'gate-4-state-approved + gate-3-rig-approved',
    deterministic: true,
    fixture: 'one claw, one prize, one floor environment',
    physics: {
      revision: N6_PHYSICS_CONFIG.revision,
      dt: N6_PHYSICS_CONFIG.dt,
      gravity: N6_PHYSICS_CONFIG.gravity,
      solverIterations: N6_PHYSICS_CONFIG.solverIterations,
      additionalFrictionIterations: N6_PHYSICS_CONFIG.additionalFrictionIterations,
      ccd: N6_PHYSICS_CONFIG.ccd,
      sleeping: N6_PHYSICS_CONFIG.sleeping,
      damping: {
        linear: N6_PHYSICS_CONFIG.linearDamping,
        angular: N6_PHYSICS_CONFIG.angularDamping,
      },
      friction: N6_PHYSICS_CONFIG.friction,
      restitution: N6_PHYSICS_CONFIG.restitution,
    },
    tolerances: N6_PHYSICS_CONFIG.tolerances,
    idle,
    travel,
    contactVsVisualOverlap: {
      visualOverlap: overlapObservation.visualOverlap,
      physicalContact: overlapObservation.physicalContact,
      solverContact: overlapObservation.solverContact,
      gripRejected: !failedGrip.accepted,
      falsePositivePrevented:
        overlapObservation.visualOverlap && !overlapObservation.physicalContact,
    },
    carry,
    failedCarry,
    reset,
    repeatedRun,
  }
}

export async function serializeN6Evidence(): Promise<string> {
  return JSON.stringify(await createN6Evidence(), null, 2)
}
