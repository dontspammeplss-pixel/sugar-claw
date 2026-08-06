import { expect } from 'vitest'
import { N6PhysicsAdapter } from '../physics/adapter'
import {
  N6_PHYSICS_CONFIG,
  swingAccelerationToLinearAcceleration,
  type Vec3,
} from '../physics/config'

/**
 * N47 (F-07): deterministic pendulum-swing → RequiredHoldForce coupling
 * evidence. Produces the fixed-step fixture numbers recorded to
 * `records/evidence/n47-swing-coupling.json` by `n47.test.ts`.
 */

const PARK_POSITION = N6_PHYSICS_CONFIG.gripPosition
/** Sharp swing: one world-space angular impulse about Z (N33 fixture style). */
const SWING_IMPULSE: Vec3 = [0, 0, 0.2]
const POST_IMPULSE_STEPS = 8
const SWEEP_IMPULSES = [0.05, 0.1, 0.2, 0.4]

export interface N47SwingRunEvidence {
  readonly voltage: number
  readonly marginBefore: number
  readonly released: boolean
  readonly releaseStep: number | null
  readonly releaseReason: string | null
  readonly peakSwingAcceleration: number
  readonly peakRequired: number
  readonly finalMargin: number
}

export interface N47SwingEvidence {
  readonly node: 'N47'
  readonly result: 'pass' | 'fail'
  readonly deterministic: true
  readonly physics: {
    readonly revision: string
    readonly retentionRevision: string
    readonly dt: number
    readonly swingTransfer: {
      readonly revision: string
      readonly referenceAngularAcceleration: number
      readonly maxLinearAcceleration: number
      readonly windowSteps: number
    }
  }
  readonly fixture: {
    readonly parkPosition: Vec3
    readonly swingImpulse: Vec3
    readonly postImpulseSteps: number
  }
  readonly weakGrip: N47SwingRunEvidence
  readonly strongGrip: N47SwingRunEvidence
  readonly sweep: readonly {
    readonly impulse: number
    readonly peakRequired: number
    readonly peakSwingAcceleration: number
  }[]
  readonly atRest: {
    readonly voltage: number
    readonly swingAcceleration: number
    readonly requiredDelta: number
    readonly repeatable: boolean
  }
  readonly gates: {
    readonly swingFeedsBalance: boolean
    readonly weakReleasesOnSwing: boolean
    readonly strongHoldsThroughSwing: boolean
    readonly couplingMonotone: boolean
    readonly couplingBounded: boolean
    readonly atRestPreserved: boolean
    readonly fixedStepRepeatable: boolean
  }
}

/** Parks, grips, and settles a hold at the given voltage; weight default 10. */
async function gripAtVoltage(
  voltage: number,
  weight = N6_PHYSICS_CONFIG.retention.prizeWeight,
): Promise<N6PhysicsAdapter> {
  const adapter = await N6PhysicsAdapter.create({
    retention: { gripVoltage: voltage, prizeWeight: weight },
  })
  adapter.moveClaw(PARK_POSITION)
  adapter.stepMany(3)
  // Grip onset must succeed before a swing is meaningful — otherwise the
  // evidence would silently record a non-hold instead of failing loudly.
  expect(adapter.attemptGrip().holdStarted).toBe(true)
  expect(adapter.state).toBe('carrying')
  adapter.stepMany(3)
  return adapter
}

/** Applies the swing impulse and records the post-impulse run evidence. */
async function swingRun(voltage: number): Promise<N47SwingRunEvidence> {
  const adapter = await gripAtVoltage(voltage)
  const marginBefore = adapter.retention.margin
  adapter.applyAngularImpulse(SWING_IMPULSE)
  const records = adapter.stepMany(POST_IMPULSE_STEPS)
  const release = records.find((record) => record.retentionRelease !== null)
  const evidence: N47SwingRunEvidence = {
    voltage,
    marginBefore,
    released: adapter.state === 'released',
    releaseStep: release?.retentionRelease?.step ?? null,
    releaseReason: release?.retentionRelease?.reason ?? null,
    peakSwingAcceleration: Math.max(
      ...records.map((record) => record.retention.swingAcceleration),
    ),
    peakRequired: Math.max(
      ...records.map((record) => record.retention.required),
    ),
    finalMargin: records.at(-1)!.retention.margin,
  }
  adapter.dispose()
  return evidence
}

export async function createN47Evidence(): Promise<N47SwingEvidence> {
  const weakGrip = await swingRun(12)
  const strongGrip = await swingRun(36)

  const sweep: {
    readonly impulse: number
    readonly peakRequired: number
    readonly peakSwingAcceleration: number
  }[] = []
  for (const impulse of SWEEP_IMPULSES) {
    const adapter = await gripAtVoltage(12)
    adapter.applyAngularImpulse([0, 0, impulse] as Vec3)
    const records = adapter.stepMany(POST_IMPULSE_STEPS)
    sweep.push({
      impulse,
      peakRequired: Math.max(
        ...records.map((record) => record.retention.required),
      ),
      peakSwingAcceleration: Math.max(
        ...records.map((record) => record.retention.swingAcceleration),
      ),
    })
    adapter.dispose()
  }

  // At-rest control (24V): required must stay at the declared prize weight,
  // and two independent runs must produce identical margins.
  const first = await gripAtVoltage(24)
  const controlA = first.stepMany(5)
  const atRest = {
    voltage: 24,
    swingAcceleration: controlA[0].retention.swingAcceleration,
    requiredDelta:
      controlA[0].retention.required - N6_PHYSICS_CONFIG.retention.prizeWeight,
  }
  const second = await gripAtVoltage(24)
  const controlB = second.stepMany(5)
  const repeatable = controlB
    .map((record) => record.retention.margin)
    .every((margin, index) => margin === controlA[index].retention.margin)
  first.dispose()
  second.dispose()

  const transfer = N6_PHYSICS_CONFIG.retention.swingTransfer
  const monotone = sweep.every((point, index) => {
    if (index === 0) return true
    return (
      point.peakSwingAcceleration >= sweep[index - 1].peakSwingAcceleration &&
      point.peakRequired >= sweep[index - 1].peakRequired
    )
  })
  const bounded = sweep.every(
    (point) => point.peakSwingAcceleration <= transfer.maxLinearAcceleration,
  )
  const pureTransferBounded =
    swingAccelerationToLinearAcceleration(1000) <=
    transfer.maxLinearAcceleration

  const gates: N47SwingEvidence['gates'] = {
    swingFeedsBalance:
      weakGrip.peakSwingAcceleration > 0 &&
      strongGrip.peakSwingAcceleration > 0,
    weakReleasesOnSwing:
      weakGrip.marginBefore > 0 &&
      weakGrip.released &&
      weakGrip.releaseReason === 'hold-margin-negative',
    strongHoldsThroughSwing: !strongGrip.released,
    couplingMonotone: monotone,
    couplingBounded: bounded && pureTransferBounded,
    atRestPreserved:
      atRest.requiredDelta < 0.1 && atRest.swingAcceleration < 0.1,
    fixedStepRepeatable: repeatable,
  }
  const result: N47SwingEvidence['result'] = Object.values(gates).every(Boolean)
    ? 'pass'
    : 'fail'

  return {
    node: 'N47',
    result,
    deterministic: true,
    physics: {
      revision: N6_PHYSICS_CONFIG.revision,
      retentionRevision: N6_PHYSICS_CONFIG.retention.revision,
      dt: N6_PHYSICS_CONFIG.dt,
      swingTransfer: { ...transfer },
    },
    fixture: {
      parkPosition: [...PARK_POSITION] as Vec3,
      swingImpulse: [...SWING_IMPULSE] as Vec3,
      postImpulseSteps: POST_IMPULSE_STEPS,
    },
    weakGrip,
    strongGrip,
    sweep,
    atRest: { ...atRest, repeatable },
    gates,
  }
}
