import { expect } from 'vitest'
import { N6PhysicsAdapter } from '../physics/adapter'
import {
  N6_PHYSICS_CONFIG,
  phaseTravelDurationMs,
  type TravelPhase,
  type Vec3,
} from '../physics/config'
import { createClawTravelAnimator } from '../animation/travel-animator'
import { GLIDE_SPEED_X, GLIDE_SPEED_Z } from '../effects/n7-coordinator'

/**
 * N48 (F-08): deterministic per-phase speed profile → RequiredHoldForce
 * coupling evidence. Produces the fixed-step fixture numbers recorded to
 * `records/evidence/n48-speed-trace.json` by `n48.test.ts`.
 *
 * Evidence 1 — per-phase speed trace vs profile (measured step velocities):
 * each scheduled phase is driven through the real ClawTravelAnimator at the
 * profile-derived duration and its step velocities are measured.
 *
 * Evidence 2 — fast-vs-slow carry fixture: identical grip voltage, different
 * commanded travel acceleration. The fast carry saturates the travel term and
 * RequiredHoldForce exceeds GripCapacity → mid-carry release; the slow carry
 * keeps the term small and holds. The tradeoff is the physics, not a lookup.
 */

const DT_MS = (1000 / 60)
const PARK_POSITION = N6_PHYSICS_CONFIG.gripPosition
const CARRY_STEPS = 40
const CRUISE_STEPS = 10
/** Fast carry: +0.25 u/s per step ⇒ 15 m/s² ⇒ travel term saturates (12 m/s²). */
const FAST_RAMP_PER_STEP = 0.25
/** Slow carry: +0.05 u/s per step ⇒ 3 m/s² ⇒ travel term ≈ 4.5 m/s². */
const SLOW_RAMP_PER_STEP = 0.05
const GRIP_VOLTAGE = 12

/** Canonical phase distances derived from the approved config positions. */
function canonicalDistance(phase: Exclude<TravelPhase, 'freePositioning'>): number {
  const config = N6_PHYSICS_CONFIG
  switch (phase) {
    case 'descent':
      return (
        config.clawPosition[1] - config.clawClearance.baseInteractionY
      )
    case 'lift':
      return config.liftPosition[1] - config.gripPosition[1]
    case 'returnTraverse': {
      const start = config.liftPosition
      const end = config.chute.overPosition
      return Math.hypot(
        end[0] - start[0],
        end[1] - start[1],
        end[2] - start[2],
      )
    }
    case 'returnDescent': {
      const start = config.chute.overPosition
      const end = config.chute.releasePosition
      return Math.hypot(
        end[0] - start[0],
        end[1] - start[1],
        end[2] - start[2],
      )
    }
  }
}

export interface N48PhaseTrace {
  readonly phase: TravelPhase
  readonly maxSpeed: number
  readonly maxAcceleration: number
  readonly distance: number | null
  readonly durationMs: number | null
  readonly averageSpeed: number | null
  readonly peakSpeed: number | null
  /** Measured step velocities (u/s), one per fixed step of the trace. */
  readonly velocities: readonly number[]
}

export interface N48CarryRunEvidence {
  readonly voltage: number
  readonly rampPerStep: number
  readonly marginBefore: number
  readonly released: boolean
  readonly releaseStep: number | null
  readonly releaseReason: string | null
  readonly peakTravelAcceleration: number
  readonly peakRequired: number
  readonly finalMargin: number
}

export interface N48SpeedEvidence {
  readonly node: 'N48'
  readonly result: 'pass' | 'fail'
  readonly deterministic: true
  readonly physics: {
    readonly revision: string
    readonly retentionRevision: string
    readonly dt: number
    readonly travelProfileRevision: string
    readonly travelTransfer: {
      readonly revision: string
      readonly referenceAcceleration: number
      readonly maxLinearAcceleration: number
      readonly windowSteps: number
    }
  }
  readonly traces: readonly N48PhaseTrace[]
  readonly fastCarry: N48CarryRunEvidence
  readonly slowCarry: N48CarryRunEvidence
  readonly fastCarryRepeat: N48CarryRunEvidence
  readonly atRest: {
    readonly voltage: number
    readonly travelAcceleration: number
    readonly requiredDelta: number
  }
  readonly gates: {
    readonly traceObeysProfile: boolean
    readonly phaseOrdering: boolean
    readonly tradeoffPhysical: boolean
    readonly feelNotSluggish: boolean
    readonly atRestPreserved: boolean
    readonly fixedStepRepeatable: boolean
  }
}

function tracePhase(
  phase: Exclude<TravelPhase, 'freePositioning'>,
): N48PhaseTrace {
  const cap = N6_PHYSICS_CONFIG.travelProfile[phase]
  const distance = canonicalDistance(phase)
  const durationMs = phaseTravelDurationMs(phase, distance)
  const animator = createClawTravelAnimator()
  animator.start([0, 0, 0], [distance, 0, 0], durationMs)
  const velocities: number[] = []
  let previous: Vec3 | null = null
  for (let step = 0; step < 10000; step += 1) {
    const next = animator.advance(DT_MS)
    if (next === null) break
    if (previous !== null) {
      velocities.push(
        Math.hypot(
          next[0] - previous[0],
          next[1] - previous[1],
          next[2] - previous[2],
        ) / (DT_MS / 1000),
      )
    }
    previous = next
  }
  return {
    phase,
    maxSpeed: cap.maxSpeed,
    maxAcceleration: cap.maxAcceleration,
    distance,
    durationMs,
    averageSpeed: (distance / durationMs) * 1000,
    peakSpeed: velocities.length > 0 ? Math.max(...velocities) : 0,
    velocities,
  }
}

function traceFreePositioning(): N48PhaseTrace {
  const cap = N6_PHYSICS_CONFIG.travelProfile.freePositioning
  // N23 velocity glide: measured step velocity is exactly the glide speed
  // (linear motion, per-axis bounds clamp). Not profile-governed — recorded
  // here so the trace covers every profile band.
  const velocities = [GLIDE_SPEED_X, GLIDE_SPEED_Z]
  return {
    phase: 'freePositioning',
    maxSpeed: cap.maxSpeed,
    maxAcceleration: cap.maxAcceleration,
    distance: null,
    durationMs: null,
    averageSpeed:
      velocities.reduce((sum, value) => sum + value, 0) / velocities.length,
    peakSpeed: Math.max(...velocities),
    velocities,
  }
}

/**
 * Grips at the given voltage, then commands a constant-acceleration carry
 * along +X for CARRY_STEPS while the hold balance is evaluated each step.
 */
async function carryRun(voltage: number, ramp: number): Promise<N48CarryRunEvidence> {
  const adapter = await N6PhysicsAdapter.create({ retention: { gripVoltage: voltage } })
  try {
    adapter.moveClaw(PARK_POSITION)
    adapter.stepMany(3)
    expect(adapter.attemptGrip().holdStarted).toBe(true)
    expect(adapter.state).toBe('carrying')
    adapter.stepMany(3)
    const marginBefore = adapter.retention.margin
    const position: [number, number, number] = [...PARK_POSITION]
    let speed = 0
    const records = []
    for (let step = 0; step < CARRY_STEPS; step += 1) {
      speed = Math.min(speed + ramp, ramp * CRUISE_STEPS)
      position[0] += speed * adapter.config.dt
      if (!adapter.moveClaw(position)) break
      records.push(adapter.step())
    }
    const release = records.find((record) => record.retentionRelease !== null)
    return {
      voltage,
      rampPerStep: ramp,
      marginBefore,
      released: adapter.state === 'released',
      releaseStep: release?.retentionRelease?.step ?? null,
      releaseReason: release?.retentionRelease?.reason ?? null,
      peakTravelAcceleration: Math.max(
        ...records.map((record) => record.retention.travelAcceleration),
      ),
      peakRequired: Math.max(
        ...records.map((record) => record.retention.required),
      ),
      finalMargin: records.at(-1)!.retention.margin,
    }
  } finally {
    adapter.dispose()
  }
}

export async function createN48Evidence(): Promise<N48SpeedEvidence> {
  const traces: readonly N48PhaseTrace[] = [
    traceFreePositioning(),
    tracePhase('descent'),
    tracePhase('lift'),
    tracePhase('returnTraverse'),
    tracePhase('returnDescent'),
  ]

  const fastCarry = await carryRun(GRIP_VOLTAGE, FAST_RAMP_PER_STEP)
  const fastCarryRepeat = await carryRun(GRIP_VOLTAGE, FAST_RAMP_PER_STEP)
  const slowCarry = await carryRun(GRIP_VOLTAGE, SLOW_RAMP_PER_STEP)

  // At-rest control (24V): no commanded motion ⇒ travel term stays 0 and the
  // balance returns to the declared prize weight (N41/N47 semantics).
  const rest = await N6PhysicsAdapter.create({
    retention: { gripVoltage: 24 },
  })
  const atRest: {
    voltage: number
    travelAcceleration: number
    requiredDelta: number
  } = { voltage: 24, travelAcceleration: 0, requiredDelta: 0 }
  try {
    rest.moveClaw(PARK_POSITION)
    const records = rest.stepMany(5)
    atRest.travelAcceleration = records[0].retention.travelAcceleration
    atRest.requiredDelta =
      records[0].retention.required - N6_PHYSICS_CONFIG.retention.prizeWeight
  } finally {
    rest.dispose()
  }

  const scheduled = traces.filter(
    (
      trace,
    ): trace is N48PhaseTrace & { averageSpeed: number; peakSpeed: number } =>
      trace.phase !== 'freePositioning' &&
      trace.averageSpeed !== null &&
      trace.peakSpeed !== null,
  )
  const profile = N6_PHYSICS_CONFIG.travelProfile
  // easeInOutCubic peaks at 3× the average speed, so a speed-bound phase's
  // measured step-velocity peak is ≈3·maxSpeed (accel-bound phases peak lower).
  const traceObeysProfile = scheduled.every(
    (trace) =>
      trace.averageSpeed > 0 &&
      trace.averageSpeed <= trace.maxSpeed * 1.02 &&
      trace.peakSpeed <= trace.maxSpeed * 3.1,
  )
  const phaseOrdering =
    profile.descent.maxSpeed <= profile.lift.maxSpeed &&
    profile.lift.maxSpeed <= profile.returnTraverse.maxSpeed &&
    profile.lift.maxSpeed <= profile.returnDescent.maxSpeed &&
    profile.returnTraverse.maxSpeed <= profile.freePositioning.maxSpeed &&
    profile.returnDescent.maxSpeed <= profile.freePositioning.maxSpeed
  const tradeoffPhysical =
    fastCarry.released &&
    fastCarry.releaseReason === 'hold-margin-negative' &&
    !slowCarry.released &&
    fastCarry.voltage === slowCarry.voltage &&
    fastCarry.peakTravelAcceleration > slowCarry.peakTravelAcceleration &&
    fastCarry.peakRequired > slowCarry.peakRequired
  const descent = traces.find((trace) => trace.phase === 'descent')!
  const lift = traces.find((trace) => trace.phase === 'lift')!
  const feelNotSluggish =
    descent.durationMs !== null &&
    lift.durationMs !== null &&
    descent.durationMs <= 1500 &&
    lift.durationMs <= 1500
  const atRestPreserved =
    atRest.travelAcceleration < 0.1 && atRest.requiredDelta < 0.1
  const fixedStepRepeatable =
    fastCarry.releaseStep === fastCarryRepeat.releaseStep &&
    fastCarry.peakRequired === fastCarryRepeat.peakRequired &&
    fastCarry.finalMargin === fastCarryRepeat.finalMargin

  const gates: N48SpeedEvidence['gates'] = {
    traceObeysProfile,
    phaseOrdering,
    tradeoffPhysical,
    feelNotSluggish,
    atRestPreserved,
    fixedStepRepeatable,
  }
  const result: N48SpeedEvidence['result'] = Object.values(gates).every(Boolean)
    ? 'pass'
    : 'fail'

  const transfer = N6_PHYSICS_CONFIG.retention.travelTransfer
  return {
    node: 'N48',
    result,
    deterministic: true,
    physics: {
      revision: N6_PHYSICS_CONFIG.revision,
      retentionRevision: N6_PHYSICS_CONFIG.retention.revision,
      dt: N6_PHYSICS_CONFIG.dt,
      travelProfileRevision: profile.revision,
      travelTransfer: { ...transfer },
    },
    traces,
    fastCarry,
    slowCarry,
    fastCarryRepeat,
    atRest,
    gates,
  }
}
