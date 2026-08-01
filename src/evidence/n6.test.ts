import { describe, expect, it } from 'vitest'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createN6Evidence } from './n6-evidence'

describe('N6 minimal Rapier physics scenario', () => {
  it('keeps the prize stable at rest under the fixed-step policy', async () => {
    const adapter = await N6PhysicsAdapter.create()
    const records = adapter.stepMany(180)
    const tail = records.slice(-60)
    const maxJitter = Math.max(
      ...tail.slice(1).map((record, index) =>
        Math.max(
          ...record.prize.position.map((value, axis) =>
            Math.abs(value - tail[index].prize.position[axis]),
          ),
        ),
      ),
    )
    expect(adapter.config.dt).toBe(1 / 60)
    expect(maxJitter).toBeLessThanOrEqual(N6_PHYSICS_CONFIG.tolerances.idlePosition)
    expect(Math.max(...adapter.velocity('prize').map(Math.abs))).toBeLessThanOrEqual(
      N6_PHYSICS_CONFIG.tolerances.idleVelocity,
    )
    expect(records.every((record) => record.runId === 0)).toBe(true)
    adapter.dispose()
  })

  it('accepts only legal claw travel targets', async () => {
    const adapter = await N6PhysicsAdapter.create()
    const { min, max } = N6_PHYSICS_CONFIG.travelBounds
    expect(adapter.moveClaw([min.x, min.y, min.z])).toBe(true)
    expect(adapter.moveClaw([max.x, max.y, max.z])).toBe(true)
    expect(adapter.moveClaw([min.x - 0.01, min.y, min.z])).toBe(false)
    expect(adapter.moveClaw([max.x + 0.01, max.y, max.z])).toBe(false)
    adapter.dispose()
  })

  it('rejects visual overlap without sensor contact and never creates a carry joint', async () => {
    const adapter = await N6PhysicsAdapter.create()
    expect(adapter.moveClaw(N6_PHYSICS_CONFIG.overlapPosition)).toBe(true)
    adapter.stepMany(3)
    const observation = adapter.observeGrip()
    const attempt = adapter.attemptGrip()
    expect(observation.visualOverlap).toBe(true)
    expect(observation.physicalContact).toBe(false)
    expect(attempt).toMatchObject({
      accepted: false,
      reason: 'no-physical-contact',
      jointCreated: false,
    })
    expect(adapter.state).toBe('failed')
    adapter.dispose()
  })

  it('creates an explicit carry constraint only after physical contact', async () => {
    const adapter = await N6PhysicsAdapter.create()
    expect(adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)).toBe(true)
    adapter.stepMany(3)
    expect(adapter.observeGrip()).toMatchObject({
      physicalContact: true,
      gripApproved: true,
    })
    expect(adapter.attemptGrip()).toMatchObject({
      accepted: true,
      jointCreated: true,
      reason: 'contact-approved',
    })
    expect(adapter.state).toBe('carrying')
    adapter.step()
    adapter.stepMany(N6_PHYSICS_CONFIG.carrySettleSteps)
    const records = []
    for (let step = 1; step <= N6_PHYSICS_CONFIG.carryLiftSteps; step += 1) {
      const progress = step / N6_PHYSICS_CONFIG.carryLiftSteps
      const target = N6_PHYSICS_CONFIG.gripPosition.map(
        (value, axis) =>
          value +
          (N6_PHYSICS_CONFIG.liftPosition[axis] - value) * progress,
      ) as [number, number, number]
      expect(adapter.moveClaw(target)).toBe(true)
      records.push(adapter.step())
    }
    expect(records.every((record) => record.jointActive)).toBe(true)
    const maxAnchorDeviation = Math.max(
      ...records.map((record) => {
        const expectedPrize = [
          record.claw.position[0] + N6_PHYSICS_CONFIG.sensorOffset.x,
          record.claw.position[1] + N6_PHYSICS_CONFIG.sensorOffset.y,
          record.claw.position[2] + N6_PHYSICS_CONFIG.sensorOffset.z,
        ]
        return Math.sqrt(
          expectedPrize.reduce(
            (sum, value, axis) =>
              sum + (value - record.prize.position[axis]) ** 2,
            0,
          ),
        )
      }),
    )
    expect(maxAnchorDeviation).toBeLessThanOrEqual(
      N6_PHYSICS_CONFIG.tolerances.carryPosition,
    )
    adapter.releaseGrip()
    expect(adapter.state).toBe('released')
    expect(adapter.step().jointActive).toBe(false)
    adapter.dispose()
  })

  it('restores bodies, logs, joint state, and run epoch on reset', async () => {
    const adapter = await N6PhysicsAdapter.create()
    const baseline = {
      claw: adapter.baselineTransform('claw'),
      prize: adapter.baselineTransform('prize'),
      environment: adapter.baselineTransform('environment'),
    }
    adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
    adapter.stepMany(3)
    adapter.attemptGrip()
    adapter.moveClaw(N6_PHYSICS_CONFIG.resetTravelPosition)
    adapter.stepMany(20)
    const oldRunId = adapter.currentRunId
    adapter.reset()
    expect(adapter.state).toBe('ready')
    expect(adapter.currentRunId).toBe(oldRunId + 1)
    expect(adapter.steps).toBe(0)
    expect(adapter.logs).toEqual([])
    expect(adapter.transform('claw')).toEqual(baseline.claw)
    expect(adapter.transform('prize')).toEqual(baseline.prize)
    expect(adapter.transform('environment')).toEqual(baseline.environment)
    expect(adapter.carryConstraintActive).toBe(false)
    expect(adapter.observeGrip().physicalContact).toBe(false)
    expect(adapter.velocity('prize')).toEqual([0, 0, 0])
    adapter.dispose()
  })

  it('publishes complete deterministic evidence for idle, travel, contact, carry, fail, reset, and repeat', async () => {
    const evidence = await createN6Evidence()
    expect(evidence).toMatchObject({
      node: 'N6',
      deterministic: true,
      fixture: 'one claw, one prize, one floor environment',
      physics: { revision: 'fixed-step-rev1', dt: 1 / 60 },
    })
    expect(evidence.idle.stable).toBe(true)
    expect(evidence.travel.boundsMatch).toBe(true)
    expect(evidence.contactVsVisualOverlap).toMatchObject({
      visualOverlap: true,
      physicalContact: false,
      gripRejected: true,
      falsePositivePrevented: true,
    })
    expect(evidence.carry.grip.accepted).toBe(true)
    expect(evidence.carry.grip.jointCreated).toBe(true)
    expect(evidence.carry.constraintCreatedAtRunId).toBe(0)
    expect(evidence.carry.constraintRemovedAtRunId).toBe(0)
    expect(evidence.carry.measuredCarrySteps).toBe(N6_PHYSICS_CONFIG.carryLiftSteps)
    expect(evidence.carry.carryDeviation).toBeLessThanOrEqual(
      N6_PHYSICS_CONFIG.tolerances.carryPosition,
    )
    expect(evidence.failedCarry).toMatchObject({
      grip: { accepted: false, jointCreated: false },
      jointNeverCreated: true,
      prizeRemainsRapierOwned: true,
    })
    expect(evidence.reset).toMatchObject({
      state: 'ready',
      runIdAdvanced: true,
      stepsAfterReset: 0,
      logsAfterReset: 0,
      clawRestored: true,
      prizeRestored: true,
      environmentRestored: true,
      noLiveJoint: true,
      noContactAfterReset: true,
      zeroPrizeVelocity: true,
    })
    expect(evidence.repeatedRun).toMatchObject({
      runs: 2,
      sameOutcome: true,
      finalPrizePositionMatch: true,
      withinTolerance: true,
    })
    expect(evidence.carry.logs.length).toBeGreaterThan(0)
    expect(evidence.failedCarry.logs.length).toBeGreaterThan(0)
    expect(evidence.idle.logs.length).toBeGreaterThan(0)
  })

  it('is idempotent and rejects every operation after disposal', async () => {
    const adapter = await N6PhysicsAdapter.create()
    adapter.dispose()
    expect(() => adapter.dispose()).not.toThrow()
    expect(() => adapter.step()).toThrow(/dispos/)
    expect(() => adapter.stepMany(1)).toThrow(/dispos/)
    expect(() => adapter.moveClaw([0, 2, 0])).toThrow(/dispos/)
    expect(() => adapter.attemptGrip()).toThrow(/dispos/)
    expect(() => adapter.releaseGrip()).toThrow(/dispos/)
    expect(() => adapter.reset()).toThrow(/dispos/)
    expect(() => adapter.observeGrip()).toThrow(/dispos/)
  })

  it('keeps the failed state when releaseGrip finds no active joint', async () => {
    const adapter = await N6PhysicsAdapter.create()
    adapter.moveClaw(N6_PHYSICS_CONFIG.overlapPosition)
    adapter.stepMany(3)
    expect(adapter.attemptGrip().accepted).toBe(false)
    expect(adapter.state).toBe('failed')
    expect(adapter.releaseGrip()).toBeNull()
    expect(adapter.state).toBe('failed')
    expect(adapter.carryConstraintActive).toBe(false)
    adapter.dispose()
  })

  it('reports constraint creation only for the creating call', async () => {
    const adapter = await N6PhysicsAdapter.create()
    adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
    adapter.stepMany(3)
    const created = adapter.attemptGrip()
    expect(created).toMatchObject({ accepted: true, jointCreated: true })
    expect(created.constraintCreatedAtRunId).toBe(0)

    const repeated = adapter.attemptGrip()
    expect(repeated).toMatchObject({
      accepted: true,
      jointCreated: false,
      constraintCreatedAtRunId: 0,
    })

    expect(adapter.releaseGrip()).toBe(0)
    adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
    adapter.stepMany(3)
    const recreated = adapter.attemptGrip()
    expect(recreated).toMatchObject({ accepted: true, jointCreated: true })
    expect(recreated.constraintCreatedAtRunId).toBe(0)
    adapter.dispose()
  })

  it('clears constraint creation state on reset', async () => {
    const adapter = await N6PhysicsAdapter.create()
    adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
    adapter.stepMany(3)
    expect(adapter.attemptGrip().constraintCreatedAtRunId).toBe(0)
    adapter.reset()
    adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
    adapter.stepMany(3)
    const afterReset = adapter.attemptGrip()
    expect(afterReset).toMatchObject({ accepted: true, jointCreated: true })
    expect(afterReset.constraintCreatedAtRunId).toBe(1)
    adapter.dispose()
  })

  it('retains only the newest bounded step records', async () => {
    const adapter = await N6PhysicsAdapter.create()
    const total = N6_PHYSICS_CONFIG.maxRetainedStepRecords + 25
    adapter.stepMany(total)
    expect(adapter.retainedStepRecords).toBe(
      N6_PHYSICS_CONFIG.maxRetainedStepRecords,
    )
    expect(adapter.logs.length).toBe(N6_PHYSICS_CONFIG.maxRetainedStepRecords)
    expect(adapter.logs[0].step).toBe(total - N6_PHYSICS_CONFIG.maxRetainedStepRecords + 1)
    expect(adapter.logs.at(-1)!.step).toBe(total)
    expect(adapter.steps).toBe(total)
    adapter.dispose()
  })
})
