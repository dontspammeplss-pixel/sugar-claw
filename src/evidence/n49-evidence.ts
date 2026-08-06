import {
  N6_PHYSICS_CONFIG,
  phaseTravelDurationMs,
  type TravelProfileConfig,
  type TravelPhase,
  type Vec3,
} from '../physics/config'
import { createClawTravelAnimator } from '../animation/travel-animator'
import { positionsMatch } from '../physics/adapter'
import { GLIDE_SPEED_X, GLIDE_SPEED_Z } from '../effects/n7-coordinator'
import type { Quat } from '../types/geometry'

/**
 * N49 (F-09): evidence of EMERGENT braking — no braking code (A-44, F-10
 * middle path). Scheduled travel decelerates into targets because the base
 * easeInOutCubic curve has zero velocity at t = 1, the per-phase duration is
 * accel/speed-capped in config (phaseTravelDurationMs), and completion is
 * position-based (A-40: positionsMatch vs tolerances.travel). This harness
 * drives the real ClawTravelAnimator at the config-derived durations and
 * measures the effective velocity profile into the target for every
 * duration-scheduled phase (descent/lift/returnTraverse/returnDescent).
 *
 * The N23 velocity glide is NOT profile-governed and carries no braking; it is
 * recorded (constant velocity) and excluded from the braking gates.
 *
 * Voltage-derived profile note (A-44): the versioned n50-voltage-rev1 transfer
 * is scoped in but not yet landed (ADR open question 2, tied to N51's ops
 * namespace). Per A-44, at the default 24V the derived profile reproduces the
 * current travelProfile byte-for-byte, so the landed profile IS the 24V
 * behavior this trace evidences.
 */

const DT_MS = 1000 / 60
/** Arrival velocity must be <= this fraction of peak (strong braking into target). */
const ARRIVAL_RATIO_LIMIT = 0.1
/** Arrival velocity must be <= this absolute value (u/s) — release is restful. */
const ARRIVAL_VELOCITY_LIMIT = 0.5
/** N23 glide speeds as documented (n7-coordinator.ts:870-871) — regression tripwire. */
const DOCUMENTED_GLIDE_X: number = 1.8
const DOCUMENTED_GLIDE_Z: number = 0.9
/** Position may never exceed [start, target] beyond this float epsilon. */
const OVERSHOOT_EPSILON = 1e-9
/** Tail fraction over which the velocity must be monotonically non-increasing. */
const TAIL_FRACTION = 0.2

const IDENTITY_QUAT: Quat = [0, 0, 0, 1]

/** Canonical phase distances derived from the approved config positions. */
function canonicalDistance(phase: Exclude<TravelPhase, 'freePositioning'>): number {
  const config = N6_PHYSICS_CONFIG
  switch (phase) {
    case 'descent':
      return config.clawPosition[1] - config.clawClearance.baseInteractionY
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

export interface N49PhaseTrace {
  readonly phase: TravelPhase
  readonly maxSpeed: number
  readonly maxAcceleration: number
  readonly distance: number | null
  readonly durationMs: number | null
  readonly peakVelocity: number | null
  readonly peakStep: number | null
  readonly arrivalVelocity: number | null
  /** arrivalVelocity / peakVelocity — the braking-into-target ratio. */
  readonly arrivalRatio: number | null
  /** Last TAIL_FRACTION of velocities monotonically non-increasing. */
  readonly tailMonotone: boolean
  /** Positions never leave [start, target] and completion returns target exactly. */
  readonly noOvershoot: boolean
  /** After completion, positionsMatch vs tolerances.travel (the coordinator gate). */
  readonly completionMatch: boolean
  /** Measured step velocities (u/s), one per fixed step of the trace. */
  readonly velocities: readonly number[]
}

export interface N49TuningSweepEntry {
  readonly maxAcceleration: number
  readonly durationMs: number
  readonly peakVelocity: number
  readonly arrivalRatio: number
}

export interface N49BrakingEvidence {
  readonly node: 'N49'
  readonly result: 'pass' | 'fail'
  readonly deterministic: true
  readonly mechanism: string
  readonly voltageDerived: {
    readonly decision: string
    readonly transfer: string
    readonly defaultVoltage: number
    readonly baselineEquivalence: string
    readonly travelProfileRevision: string
  }
  readonly physics: {
    readonly revision: string
    readonly dt: number
    readonly travelTolerance: number
    readonly glideX: number
    readonly glideZ: number
  }
  readonly traces: readonly N49PhaseTrace[]
  readonly tuningSweep: readonly N49TuningSweepEntry[]
  readonly coverage: {
    readonly scheduledTravel: string
    readonly close: string
  }
  readonly repeat: {
    readonly byteIdentical: boolean
  }
  readonly gates: {
    readonly decelerationVisible: boolean
    readonly noSnapAtArrival: boolean
    readonly noOvershoot: boolean
    readonly configDriven: boolean
    readonly fixedStepRepeatable: boolean
    readonly glideIntact: boolean
  }
}

function indexOfMax(values: readonly number[]): number {
  let best = 0
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[best]) best = i
  }
  return best
}

function traceTravelPhase(
  phase: Exclude<TravelPhase, 'freePositioning'>,
  profile: TravelProfileConfig = N6_PHYSICS_CONFIG.travelProfile,
): N49PhaseTrace {
  const cap = profile[phase]
  const distance = canonicalDistance(phase)
  const durationMs = phaseTravelDurationMs(phase, distance, profile)
  const start: Vec3 = [0, 0, 0]
  const target: Vec3 = [distance, 0, 0]
  const animator = createClawTravelAnimator()
  animator.start(start, target, durationMs)
  const velocities: number[] = []
  const positions: Vec3[] = []
  let previous: Vec3 | null = null
  for (let step = 0; step < 100000; step += 1) {
    const next = animator.advance(DT_MS)
    if (next === null) break
    positions.push(next)
    if (previous !== null) {
      velocities.push(
        Math.hypot(
          next[0] - previous[0],
          next[1] - previous[1],
          next[2] - previous[2],
        ) /
          (DT_MS / 1000),
      )
    }
    previous = next
  }
  const peakStep = velocities.length > 0 ? indexOfMax(velocities) : null
  const peakVelocity = peakStep === null ? 0 : velocities[peakStep]
  const arrivalVelocity =
    velocities.length > 0 ? velocities[velocities.length - 1] : 0
  const arrivalRatio = peakVelocity > 0 ? arrivalVelocity / peakVelocity : 0
  const tailStart = Math.floor(velocities.length * (1 - TAIL_FRACTION))
  const tail = velocities.slice(tailStart)
  const tailMonotone = tail.every(
    (value, index) => index === 0 || value <= tail[index - 1] + 1e-9,
  )
  const withinBounds = positions.every((position) =>
    position.every(
      (value, axis) =>
        value >= start[axis] - OVERSHOOT_EPSILON &&
        value <= target[axis] + OVERSHOOT_EPSILON,
    ),
  )
  const finalPosition = positions[positions.length - 1]
  const exactArrival = finalPosition.every((value, axis) => value === target[axis])
  const noOvershoot = withinBounds && exactArrival
  // Contract guard: completion satisfies the coordinator positionsMatch gate
  // (near-tautological today — the animator returns the exact target — but it
  // catches any future easing that no longer lands on the target).
  const completionMatch = positionsMatch(
    { position: finalPosition, quaternion: IDENTITY_QUAT },
    { position: target, quaternion: IDENTITY_QUAT },
    N6_PHYSICS_CONFIG.tolerances.travel,
  )
  return {
    phase,
    maxSpeed: cap.maxSpeed,
    maxAcceleration: cap.maxAcceleration,
    distance,
    durationMs,
    peakVelocity,
    peakStep,
    arrivalVelocity,
    arrivalRatio,
    tailMonotone,
    noOvershoot,
    completionMatch,
    velocities,
  }
}

/** N23 velocity glide: constant velocity, never profile-governed. */
function traceGlide(): N49PhaseTrace {
  const cap = N6_PHYSICS_CONFIG.travelProfile.freePositioning
  const velocities = [GLIDE_SPEED_X, GLIDE_SPEED_Z]
  return {
    phase: 'freePositioning',
    maxSpeed: cap.maxSpeed,
    maxAcceleration: cap.maxAcceleration,
    distance: null,
    durationMs: null,
    peakVelocity: Math.max(...velocities),
    peakStep: 0,
    arrivalVelocity: velocities[velocities.length - 1],
    arrivalRatio: velocities[1] / velocities[0],
    // Placeholders — the glide is excluded from the braking gates by the
    // scheduled filter in createN49Evidence; recorded for JSON completeness.
    tailMonotone: true,
    noOvershoot: true,
    completionMatch: true,
    velocities,
  }
}

interface N49Build {
  readonly traces: readonly N49PhaseTrace[]
  readonly tuningSweep: readonly N49TuningSweepEntry[]
}

function build(): N49Build {
  const traces: readonly N49PhaseTrace[] = [
    traceGlide(),
    traceTravelPhase('descent'),
    traceTravelPhase('lift'),
    traceTravelPhase('returnTraverse'),
    traceTravelPhase('returnDescent'),
  ]

  // Contract 2 — braking distance/settle emerge from config caps: lowering the
  // descent accel cap lengthens the duration (braking starts earlier) and
  // lowers the peak, while arrival still brakes into the target. The sweep
  // uses only config-derived durations, never hardcoded numbers.
  const base = N6_PHYSICS_CONFIG.travelProfile
  const tuningSweep = [5, 10, 20].map((maxAcceleration) => {
    const profile: TravelProfileConfig = {
      ...base,
      descent: { ...base.descent, maxAcceleration },
    }
    const trace = traceTravelPhase('descent', profile)
    return {
      maxAcceleration,
      durationMs: trace.durationMs!,
      peakVelocity: trace.peakVelocity!,
      arrivalRatio: trace.arrivalRatio!,
    }
  })
  return { traces, tuningSweep }
}

export function createN49Evidence(): N49BrakingEvidence {
  const first = build()
  const second = build()
  const byteIdentical = JSON.stringify(first) === JSON.stringify(second)

  const scheduled = first.traces.filter(
    (trace): trace is N49PhaseTrace => trace.phase !== 'freePositioning',
  )
  const decelerationVisible = scheduled.every(
    (trace) =>
      trace.peakStep !== null &&
      trace.peakStep > 0 &&
      trace.peakStep < trace.velocities.length - 1 &&
      trace.arrivalRatio !== null &&
      trace.arrivalRatio <= ARRIVAL_RATIO_LIMIT &&
      trace.tailMonotone,
  )
  const noSnapAtArrival = scheduled.every(
    (trace) =>
      trace.arrivalRatio !== null &&
      trace.arrivalRatio <= ARRIVAL_RATIO_LIMIT &&
      trace.arrivalVelocity !== null &&
      trace.arrivalVelocity <= ARRIVAL_VELOCITY_LIMIT &&
      trace.completionMatch,
  )
  const noOvershoot = scheduled.every((trace) => trace.noOvershoot)
  const sweep = first.tuningSweep
  const configDriven =
    sweep.length === 3 &&
    sweep[0].durationMs > sweep[1].durationMs &&
    sweep[1].durationMs > sweep[2].durationMs &&
    sweep[0].peakVelocity < sweep[1].peakVelocity &&
    sweep[1].peakVelocity < sweep[2].peakVelocity &&
    sweep.every((entry) => entry.arrivalRatio <= ARRIVAL_RATIO_LIMIT)
  const fixedStepRepeatable = byteIdentical
  const glideTrace = first.traces[0]
  // N23 glide is the per-axis speed pair [X, Z] — each axis constant, no accel
  // profile (no braking by design); recorded values appear in physics.glideX/Z.
  // Asserted against the documented speeds (widened numbers avoid the literal
  // TS2367 comparison) so the gate is a real regression tripwire, not circular.
  const glideIntact =
    glideTrace.phase === 'freePositioning' &&
    GLIDE_SPEED_X === DOCUMENTED_GLIDE_X &&
    GLIDE_SPEED_Z === DOCUMENTED_GLIDE_Z &&
    glideTrace.velocities[0] === GLIDE_SPEED_X &&
    glideTrace.velocities[1] === GLIDE_SPEED_Z

  const gates: N49BrakingEvidence['gates'] = {
    decelerationVisible,
    noSnapAtArrival,
    noOvershoot,
    configDriven,
    fixedStepRepeatable,
    glideIntact,
  }
  const result: N49BrakingEvidence['result'] = Object.values(gates).every(
    Boolean,
  )
    ? 'pass'
    : 'fail'

  return {
    node: 'N49',
    result,
    deterministic: true,
    mechanism:
      'emergent — easeInOutCubic base easing (zero velocity at t=1) + ' +
      'config accel/speed caps via phaseTravelDurationMs + position-based ' +
      'completion (A-40, positionsMatch vs tolerances.travel); no braking ' +
      'code, no new state transitions (C-02)',
    voltageDerived: {
      decision: 'A-44 (F-10 middle path, 2026-08-05) — braking is emergent',
      transfer: 'n50-voltage-rev1 — scoped in, not yet landed (ADR open question 2, N51)',
      defaultVoltage: 24,
      baselineEquivalence:
        'at default 24V the derived profile reproduces the current travelProfile byte-for-byte — this trace evidences the landed 24V behavior',
      travelProfileRevision: N6_PHYSICS_CONFIG.travelProfile.revision,
    },
    physics: {
      revision: N6_PHYSICS_CONFIG.revision,
      dt: N6_PHYSICS_CONFIG.dt,
      travelTolerance: N6_PHYSICS_CONFIG.tolerances.travel,
      glideX: GLIDE_SPEED_X,
      glideZ: GLIDE_SPEED_Z,
    },
    traces: first.traces,
    tuningSweep: first.tuningSweep,
    coverage: {
      scheduledTravel:
        'descent, lift, returnTraverse, returnDescent (all phaseTravelDurationMs-scheduled legs)',
      close:
        'finger closure is the ClawPoseAnimator pose (open->closed, 120ms), not duration-scheduled travel; its endpoint approach is eased by the pose animator, not a travel motor — excluded from the travel braking gates by design (Eli braking-scope selection, 2026-08-05)',
    },
    repeat: { byteIdentical },
    gates,
  }
}
