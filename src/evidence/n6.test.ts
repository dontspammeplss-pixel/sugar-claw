import { describe, expect, it } from 'vitest'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'
import { createN6Evidence } from './n6-evidence'

/**
 * Grip park position (N26): the descent target where the prize top sits at
 * the fingertip level — contact-free for the centered fixture, so the raw
 * adapter can park directly and the sensor approves the grip.
 */
const PARK_POSITION = N6_PHYSICS_CONFIG.gripPosition

/**
 * Moves the claw to a target the way real travel does — a smooth glide over
 * many small steps — so the dynamic head (N26) never swings violently. A
 * teleport whips the pendulum head and can sweep the grip sensor across the
 * prize; glide travel matches the coordinator and keeps the head calm.
 */
function glideTo(adapter: N6PhysicsAdapter, target: Vec3, steps = 90): void {
  const start = adapter.transform('claw').position
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps
    const position = start.map(
      (value, axis) => value + (target[axis] - value) * progress,
    ) as unknown as Vec3
    expect(adapter.moveClaw(position)).toBe(true)
    adapter.step()
  }
}

describe('N6 minimal Rapier physics scenario', () => {
  it('keeps the prize stable at rest under the fixed-step policy', async () => {
    const adapter = await N6PhysicsAdapter.create()
    const records = adapter.stepMany(180)
    const tail = records.slice(-60)
    const maxJitter = Math.max(
      ...tail
        .slice(1)
        .map((record, index) =>
          Math.max(
            ...record.prize.position.map((value, axis) =>
              Math.abs(value - tail[index].prize.position[axis]),
            ),
          ),
        ),
    )
    expect(adapter.config.dt).toBe(1 / 60)
    expect(maxJitter).toBeLessThanOrEqual(
      N6_PHYSICS_CONFIG.tolerances.idlePosition,
    )
    expect(
      Math.max(...adapter.velocity('prize').map(Math.abs)),
    ).toBeLessThanOrEqual(N6_PHYSICS_CONFIG.tolerances.idleVelocity)
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
    // Glide in (real travel) instead of teleporting so the head stays calm
    // and the sensor position is deterministic.
    glideTo(adapter, N6_PHYSICS_CONFIG.overlapPosition)
    adapter.stepMany(15)
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

  it('starts a hold only after physical contact and keeps the prize within hold tolerance', async () => {
    const adapter = await N6PhysicsAdapter.create()
    expect(adapter.moveClaw(PARK_POSITION)).toBe(true)
    adapter.stepMany(3)
    expect(adapter.observeGrip()).toMatchObject({
      physicalContact: true,
      gripApproved: true,
    })
    expect(adapter.attemptGrip()).toMatchObject({
      accepted: true,
      jointCreated: false,
      holdStarted: true,
      reason: 'contact-approved',
    })
    expect(adapter.state).toBe('carrying')
    // The N27 carry anchor is adaptive (the prize's head-local offset at grip
    // creation); record it so the lift deviation is measured against the real
    // constraint frame instead of the classic sensor offset.
    const gripClaw = adapter.transform('claw')
    const gripPrize = adapter.transform('prize')
    const gripOffset = gripPrize.position.map(
      (value, axis) => value - gripClaw.position[axis],
    )
    adapter.step()
    adapter.stepMany(N6_PHYSICS_CONFIG.carrySettleSteps)
    const records = []
    for (let step = 1; step <= N6_PHYSICS_CONFIG.carryLiftSteps; step += 1) {
      const progress = step / N6_PHYSICS_CONFIG.carryLiftSteps
      const target = PARK_POSITION.map(
        (value, axis) =>
          value + (N6_PHYSICS_CONFIG.liftPosition[axis] - value) * progress,
      ) as [number, number, number]
      expect(adapter.moveClaw(target)).toBe(true)
      records.push(adapter.step())
    }
    expect(records.every((record) => record.holdActive)).toBe(true)
    expect(records.every((record) => record.retention.status === 'holding')).toBe(true)
    const maxAnchorDeviation = Math.max(
      ...records.map((record) => {
        const expectedPrize = [
          record.claw.position[0] + gripOffset[0],
          record.claw.position[1] + gripOffset[1],
          record.claw.position[2] + gripOffset[2],
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
    expect(adapter.step().holdActive).toBe(false)
    adapter.dispose()
  })

  it('restores bodies, logs, joint state, and run epoch on reset', async () => {
    const adapter = await N6PhysicsAdapter.create()
    const baseline = {
      claw: adapter.baselineTransform('claw'),
      head: adapter.baselineTransform('head'),
      prize: adapter.baselineTransform('prize'),
      environment: adapter.baselineTransform('environment'),
    }
    adapter.moveClaw(PARK_POSITION)
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
    expect(adapter.transform('head')).toEqual(baseline.head)
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
      fixture:
        'one carriage + dynamic head + 3 finger colliders, one prize, floor + chamber walls',
      physics: { revision: 'fixed-step-rev3', dt: 1 / 60 },
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
    expect(evidence.carry.grip.jointCreated).toBe(false)
    expect(evidence.carry.grip.holdStarted).toBe(true)
    expect(evidence.carry.constraintCreatedAtRunId).toBeNull()
    expect(evidence.carry.constraintRemovedAtRunId).toBe(0)
    expect(evidence.carry.measuredCarrySteps).toBe(
      N6_PHYSICS_CONFIG.carryLiftSteps,
    )
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
    glideTo(adapter, N6_PHYSICS_CONFIG.overlapPosition)
    adapter.stepMany(15)
    expect(adapter.attemptGrip().accepted).toBe(false)
    expect(adapter.state).toBe('failed')
    expect(adapter.releaseGrip()).toBeNull()
    expect(adapter.state).toBe('failed')
    expect(adapter.carryConstraintActive).toBe(false)
    adapter.dispose()
  })

  it('reports hold onset only for the creating call', async () => {
    const adapter = await N6PhysicsAdapter.create()
    adapter.moveClaw(PARK_POSITION)
    adapter.stepMany(3)
    const created = adapter.attemptGrip()
    expect(created).toMatchObject({ accepted: true, jointCreated: false, holdStarted: true })
    expect(created.constraintCreatedAtRunId).toBeNull()

    const repeated = adapter.attemptGrip()
    expect(repeated).toMatchObject({
      accepted: true,
      jointCreated: false,
      holdStarted: true,
      constraintCreatedAtRunId: null,
    })

    expect(adapter.releaseGrip()).toBe(0)
    adapter.moveClaw(PARK_POSITION)
    adapter.stepMany(3)
    const recreated = adapter.attemptGrip()
    expect(recreated).toMatchObject({ accepted: true, jointCreated: false, holdStarted: true })
    expect(recreated.constraintCreatedAtRunId).toBeNull()
    adapter.dispose()
  })

  it('clears hold state on reset', async () => {
    const adapter = await N6PhysicsAdapter.create()
    adapter.moveClaw(PARK_POSITION)
    adapter.stepMany(3)
    expect(adapter.attemptGrip().holdStartedAtRunId).toBe(0)
    adapter.reset()
    adapter.moveClaw(PARK_POSITION)
    adapter.stepMany(3)
    const afterReset = adapter.attemptGrip()
    expect(afterReset).toMatchObject({ accepted: true, jointCreated: false, holdStarted: true })
    expect(afterReset.holdStartedAtRunId).toBe(1)
    adapter.dispose()
  })

  it('releases deterministically when voltage capacity is insufficient', async () => {
    const adapter = await N6PhysicsAdapter.create({
      retention: { gripVoltage: 12, prizeWeight: 40 },
    })
    adapter.moveClaw(PARK_POSITION)
    adapter.stepMany(3)
    expect(adapter.attemptGrip().holdStarted).toBe(true)
    const records = adapter.stepMany(5)
    expect(records.some((record) => record.retentionRelease !== null)).toBe(true)
    expect(adapter.state).toBe('released')
    expect(adapter.retentionRelease).toMatchObject({
      state: 'released',
      reason: 'hold-margin-negative',
      step: expect.any(Number),
      margin: expect.any(Number),
    })
    expect(adapter.retention.margin).toBeLessThan(0)
    adapter.dispose()
  })

  it('holds centered CoM and releases an off-center heavy prize under torque', async () => {
    const centered = await N6PhysicsAdapter.create({
      retention: { gripVoltage: 36, prizeWeight: 40, centerOfMass: [0, 0, 0] },
    })
    centered.moveClaw(PARK_POSITION)
    centered.stepMany(3)
    centered.attemptGrip()
    centered.stepMany(5)
    expect(centered.state).toBe('carrying')
    expect(centered.retention.torque).toBe(0)

    const offCenter = await N6PhysicsAdapter.create({
      retention: { gripVoltage: 36, prizeWeight: 40, centerOfMass: [0.5, 0, 0] },
    })
    offCenter.moveClaw(PARK_POSITION)
    offCenter.stepMany(3)
    offCenter.attemptGrip()
    offCenter.stepMany(5)
    expect(offCenter.state).toBe('released')
    expect(offCenter.retention.torque).toBeGreaterThan(0)
    expect(offCenter.retentionRelease?.reason).toBe('hold-margin-negative')
    const releasedOrientation = offCenter.transform('prize').quaternion
    offCenter.stepMany(10)
    const settledOrientation = offCenter.transform('prize').quaternion
    expect(
      Math.max(
        ...settledOrientation.map((value, axis) =>
          Math.abs(value - releasedOrientation[axis]),
        ),
      ),
    ).toBeGreaterThan(0.000001)
    centered.dispose()
    offCenter.dispose()
  })

  it('publishes deterministic voltage sweep margins at fixed steps', async () => {
    async function trace(): Promise<readonly { voltage: number; values: readonly number[] }[]> {
      const margins: { voltage: number; values: readonly number[] }[] = []
      for (const gripVoltage of [12, 24, 36]) {
        const adapter = await N6PhysicsAdapter.create({ retention: { gripVoltage } })
        adapter.moveClaw(PARK_POSITION)
        adapter.stepMany(3)
        adapter.attemptGrip()
        const records = adapter.stepMany(3)
        margins.push({
          voltage: gripVoltage,
          values: records.map((record) => record.retention.margin),
        })
        adapter.dispose()
      }
      return margins
    }

    const first = await trace()
    const second = await trace()
    expect(second).toEqual(first)
    expect(first[0].values[0]).toBeLessThan(first[1].values[0])
    expect(first[1].values[0]).toBeLessThan(first[2].values[0])
  })

  it('rejects retention voltage outside the declared 12-36V band', async () => {
    await expect(
      N6PhysicsAdapter.create({ retention: { gripVoltage: 11 } }),
    ).rejects.toThrow('hold-undefined-capacity')
    await expect(
      N6PhysicsAdapter.create({ retention: { gripVoltage: 37 } }),
    ).rejects.toThrow('hold-undefined-capacity')
  })

  it('retains only the newest bounded step records', async () => {
    const adapter = await N6PhysicsAdapter.create()
    const total = N6_PHYSICS_CONFIG.maxRetainedStepRecords + 25
    adapter.stepMany(total)
    expect(adapter.retainedStepRecords).toBe(
      N6_PHYSICS_CONFIG.maxRetainedStepRecords,
    )
    expect(adapter.logs.length).toBe(N6_PHYSICS_CONFIG.maxRetainedStepRecords)
    expect(adapter.logs[0].step).toBe(
      total - N6_PHYSICS_CONFIG.maxRetainedStepRecords + 1,
    )
    expect(adapter.logs.at(-1)!.step).toBe(total)
    expect(adapter.steps).toBe(total)
    adapter.dispose()
  })
})
