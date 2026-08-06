import { Quaternion, Vector3 } from 'three'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'

const IMPULSE: Vec3 = [0, 0, 0.05]
const IMPACT_SETTLE_STEPS = 30
const TRACE_STEPS = 90
const PEAK_WINDOW_END = 30
const SETTLE_45 = 45
const SETTLE_60 = 60
const SIGN_THRESHOLD = (0.5 * Math.PI) / 180

export interface N33HeadSample {
  readonly relativeStep: number
  readonly fixedStep: number
  readonly headQuaternion: readonly [number, number, number, number]
  readonly theta: number
  readonly signedTheta: number
  readonly errorAxis: readonly [number, number, number]
  readonly angularVelocity: Vec3
  readonly omega: number
  readonly carriagePosition: Vec3
  readonly prizePosition: Vec3
  readonly physicalContact: boolean
  readonly solverContact: boolean
  readonly visualOverlap: boolean
  readonly jointActive: boolean
  readonly responseEnvelope: number
}

export interface N33Evidence {
  readonly node: 'N33'
  readonly result: 'pass' | 'head-feel-failed' | 'physics-authority-regressed'
  readonly deterministic: true
  readonly physics: {
    readonly revision: string
    readonly dt: number
    readonly headAngularDamping: number
    readonly headDensity: null
    readonly headMassPolicy: string
    readonly solverIterations: number
    readonly friction: number
  }
  readonly baseline: {
    readonly headQuaternion: readonly [number, number, number, number]
    readonly identityWithinTolerance: boolean
    readonly tolerance: number
  }
  readonly impulse: readonly [number, number, number]
  readonly preImpactSteps: number
  readonly samples: readonly N33HeadSample[]
  readonly metrics: {
    readonly thetaPeak: number
    readonly omegaPeak: number
    readonly rPeak: number
    readonly r45: number
    readonly r60: number
    readonly r45OverPeak: number
    readonly r60OverPeak: number
    readonly omegaAt60: number
    readonly thetaAt60: number
    readonly signReversals: number
    readonly dominantAxis: readonly [number, number, number]
    readonly gates: {
      readonly decay45: boolean
      readonly decay60: boolean
      readonly angularVelocity60: boolean
      readonly orientation60: boolean
      readonly signReversals: boolean
    }
  }
  readonly fixture: {
    readonly carriagePosition: Vec3
    readonly carriageFixed: boolean
    readonly headResponseObserved: boolean
  }
  readonly noImpactControl: {
    readonly steps: number
    readonly maxPositionJitter: number
    readonly maxPrizeSpeed: number
    readonly maxHeadTheta: number
    readonly maxHeadOmega: number
    readonly stable: boolean
    readonly repeatable: boolean
  }
  readonly carryRegression: {
    readonly gripAccepted: boolean
    readonly jointCreated: boolean
    readonly liftSteps: number
    readonly maxAnchorDeviation: number
    readonly released: boolean
    readonly passed: boolean
  }
  readonly failureResult:
    null | 'head-feel-failed' | 'physics-authority-regressed'
}

type QuaternionTuple = readonly [number, number, number, number]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function quaternionDot(a: QuaternionTuple, b: QuaternionTuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
}

function quaternionFor(value: QuaternionTuple): Quaternion {
  return new Quaternion(value[0], value[1], value[2], value[3]).normalize()
}

function alignedQuaternion(
  value: QuaternionTuple,
  reference: QuaternionTuple,
): Quaternion {
  const q = quaternionFor(value)
  if (quaternionDot([q.x, q.y, q.z, q.w], reference) < 0) {
    q.x *= -1
    q.y *= -1
    q.z *= -1
    q.w *= -1
  }
  return q
}

function identityWithinTolerance(
  value: QuaternionTuple,
  tolerance: number,
): boolean {
  return (
    Math.abs(value[0]) <= tolerance &&
    Math.abs(value[1]) <= tolerance &&
    Math.abs(value[2]) <= tolerance &&
    Math.abs(value[3] - 1) <= tolerance
  )
}

function positionJitter(values: readonly Vec3[]): number {
  return values.slice(1).reduce((maximum, value, index) => {
    const previous = values[index]
    return Math.max(
      maximum,
      Math.max(
        ...value.map((component, axis) => Math.abs(component - previous[axis])),
      ),
    )
  }, 0)
}

function orientationMetrics(
  headQuaternion: QuaternionTuple,
  q0: QuaternionTuple,
): { theta: number; axis: Vector3 } {
  const q = alignedQuaternion(headQuaternion, q0)
  const reference = quaternionFor(q0)
  const error = reference.clone().invert().multiply(q).normalize()
  if (error.w < 0) {
    error.x *= -1
    error.y *= -1
    error.z *= -1
    error.w *= -1
  }
  const theta = 2 * Math.acos(clamp(error.w, -1, 1))
  const sinHalf = Math.sqrt(Math.max(0, 1 - error.w * error.w))
  const axis =
    sinHalf > 1e-9
      ? new Vector3(error.x, error.y, error.z).multiplyScalar(1 / sinHalf)
      : new Vector3(0, 0, 0)
  return { theta, axis }
}

function signedAngle(
  theta: number,
  axis: Vector3,
  dominantAxis: Vector3,
): number {
  return theta * axis.dot(dominantAxis)
}

function responseEnvelope(
  sample: Pick<N33HeadSample, 'theta' | 'omega'>,
  thetaPeak: number,
  omegaPeak: number,
): number {
  return (
    0.5 * ((sample.theta / thetaPeak) ** 2 + (sample.omega / omegaPeak) ** 2)
  )
}

function countSignReversals(values: readonly number[]): number {
  let reversals = 0
  let previous = 0
  for (const value of values) {
    const sign = value > SIGN_THRESHOLD ? 1 : value < -SIGN_THRESHOLD ? -1 : 0
    if (sign === 0) continue
    if (previous !== 0 && sign !== previous) reversals += 1
    previous = sign
  }
  return reversals
}

async function runCarryRegression() {
  const adapter = await N6PhysicsAdapter.create()
  const park = N6_PHYSICS_CONFIG.gripPosition
  adapter.moveClaw(park)
  adapter.stepMany(3)
  const grip = adapter.attemptGrip()
  const gripClaw = adapter.transform('claw')
  const gripPrize = adapter.transform('prize')
  const offset = gripPrize.position.map(
    (value, axis) => value - gripClaw.position[axis],
  ) as unknown as Vec3
  const records = []
  for (let step = 1; step <= N6_PHYSICS_CONFIG.carryLiftSteps; step += 1) {
    const progress = step / N6_PHYSICS_CONFIG.carryLiftSteps
    const target = park.map(
      (value, axis) =>
        value + (N6_PHYSICS_CONFIG.liftPosition[axis] - value) * progress,
    ) as unknown as Vec3
    adapter.moveClaw(target)
    records.push(adapter.step())
  }
  const maxAnchorDeviation = Math.max(
    ...records.map((record) => {
      const expected = record.claw.position.map(
        (value, axis) => value + offset[axis],
      )
      return Math.hypot(
        ...expected.map((value, axis) => value - record.prize.position[axis]),
      )
    }),
  )
  const released = adapter.releaseGrip() !== null && !adapter.step().holdActive
  const result = {
    gripAccepted: grip.accepted,
    // N41: grip onset starts the hold model; no Rapier carry joint is created.
    jointCreated: grip.holdStarted,
    liftSteps: records.length,
    maxAnchorDeviation,
    released,
    passed:
      grip.accepted &&
      grip.holdStarted &&
      maxAnchorDeviation <= N6_PHYSICS_CONFIG.tolerances.carryPosition + 0.001 &&
      released,
  }
  adapter.dispose()
  return result
}

export async function createN33Evidence(): Promise<N33Evidence> {
  const control = await N6PhysicsAdapter.create()
  const controlQ0 = control.baselineTransform('head').quaternion
  const identityTolerance = N6_PHYSICS_CONFIG.tolerances.repeatPosition
  const controlHeadTheta: number[] = []
  const controlHeadOmega: number[] = []
  const controlPositions: Vec3[] = []
  for (let step = 0; step < 120; step += 1) {
    control.step()
    controlHeadTheta.push(
      orientationMetrics(control.transform('head').quaternion, controlQ0).theta,
    )
    controlHeadOmega.push(Math.hypot(...control.angularVelocity()))
    controlPositions.push(control.transform('prize').position)
  }
  const controlFinalPrize = control.transform('prize')
  const controlFinalHead = control.transform('head')
  const maxPrizeSpeed = Math.max(...control.velocity('prize').map(Math.abs))
  const maxPositionJitter = positionJitter(controlPositions.slice(-60))
  const stable =
    maxPositionJitter <= N6_PHYSICS_CONFIG.tolerances.idlePosition &&
    maxPrizeSpeed <= N6_PHYSICS_CONFIG.tolerances.idleVelocity
  control.dispose()
  const repeatControl = await N6PhysicsAdapter.create()
  repeatControl.stepMany(120)
  const repeatPrize = repeatControl.transform('prize')
  const repeatHead = repeatControl.transform('head')
  const repeatable =
    repeatPrize.position.every(
      (value, axis) =>
        Math.abs(value - controlFinalPrize.position[axis]) <=
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ) &&
    repeatHead.quaternion.every(
      (value, axis) =>
        Math.abs(value - controlFinalHead.quaternion[axis]) <=
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    )
  repeatControl.dispose()
  const noImpactControl = {
    steps: controlPositions.length,
    maxPositionJitter,
    maxPrizeSpeed,
    maxHeadTheta: Math.max(...controlHeadTheta),
    maxHeadOmega: Math.max(...controlHeadOmega),
    stable,
    repeatable,
  }
  const adapter = await N6PhysicsAdapter.create()
  const q0 = adapter.baselineTransform('head').quaternion
  const identityWithin = identityWithinTolerance(q0, identityTolerance)
  if (!identityWithin) {
    adapter.dispose()
    throw new Error(
      `N33 baseline head quaternion is not identity: ${q0.join(',')}`,
    )
  }
  adapter.stepMany(IMPACT_SETTLE_STEPS)
  adapter.applyAngularImpulse(IMPULSE)
  const rawSamples: Array<{
    fixedStep: number
    quaternion: QuaternionTuple
    theta: number
    axis: Vector3
    angularVelocity: Vec3
    omega: number
    carriagePosition: Vec3
    prizePosition: Vec3
    physicalContact: boolean
    solverContact: boolean
    visualOverlap: boolean
    jointActive: boolean
  }> = []
  for (let relativeStep = 1; relativeStep <= TRACE_STEPS; relativeStep += 1) {
    const record = adapter.step()
    const head = adapter.transform('head')
    const orientation = orientationMetrics(head.quaternion, q0)
    const angularVelocity = adapter.angularVelocity()
    rawSamples.push({
      fixedStep: record.step,
      quaternion: head.quaternion,
      theta: orientation.theta,
      axis: orientation.axis,
      angularVelocity,
      omega: Math.hypot(...angularVelocity),
      carriagePosition: record.claw.position,
      prizePosition: record.prize.position,
      physicalContact: record.physicalContact,
      solverContact: record.solverContact,
      visualOverlap: record.visualOverlap,
      jointActive: record.holdActive,
    })
  }
  adapter.dispose()

  const peakWindow = rawSamples.slice(0, PEAK_WINDOW_END)
  const thetaPeak = Math.max(...peakWindow.map((sample) => sample.theta))
  const omegaPeak = Math.max(...peakWindow.map((sample) => sample.omega))
  if (thetaPeak === 0 || omegaPeak === 0) {
    throw new Error(
      'N33 impact trace undefined: thetaPeak or omegaPeak is zero',
    )
  }
  const peakIndex = peakWindow.reduce(
    (best, sample, index) =>
      responseEnvelope(sample, thetaPeak, omegaPeak) >
      responseEnvelope(peakWindow[best], thetaPeak, omegaPeak)
        ? index
        : best,
    0,
  )
  const dominantAxis =
    peakWindow[peakIndex].axis.lengthSq() > 1e-12
      ? peakWindow[peakIndex].axis.clone().normalize()
      : new Vector3(0, 0, 1)
  const samples: N33HeadSample[] = rawSamples.map((sample, index) => ({
    relativeStep: index + 1,
    fixedStep: sample.fixedStep,
    headQuaternion: sample.quaternion,
    theta: sample.theta,
    signedTheta: signedAngle(sample.theta, sample.axis, dominantAxis),
    errorAxis: [sample.axis.x, sample.axis.y, sample.axis.z],
    angularVelocity: sample.angularVelocity,
    omega: sample.omega,
    carriagePosition: sample.carriagePosition,
    prizePosition: sample.prizePosition,
    physicalContact: sample.physicalContact,
    solverContact: sample.solverContact,
    visualOverlap: sample.visualOverlap,
    jointActive: sample.jointActive,
    responseEnvelope: 0,
  }))
  const withR = samples.map((sample) => ({
    ...sample,
    r: responseEnvelope(sample, thetaPeak, omegaPeak),
  }))
  const rPeak = Math.max(
    ...withR.slice(0, PEAK_WINDOW_END).map((sample) => sample.r),
  )
  const samplesWithResponse: N33HeadSample[] = withR.map(
    ({ r, ...sample }) => ({
      ...sample,
      responseEnvelope: r,
    }),
  )
  const r45 = withR[SETTLE_45 - 1].r
  const r60 = withR[SETTLE_60 - 1].r
  const sample60 = withR[SETTLE_60 - 1]
  const metrics = {
    thetaPeak,
    omegaPeak,
    rPeak,
    r45,
    r60,
    r45OverPeak: r45 / rPeak,
    r60OverPeak: r60 / rPeak,
    omegaAt60: sample60.omega,
    thetaAt60: sample60.theta,
    signReversals: countSignReversals(
      samples.slice(peakIndex).map((sample) => sample.signedTheta),
    ),
    dominantAxis: [dominantAxis.x, dominantAxis.y, dominantAxis.z] as [
      number,
      number,
      number,
    ],
    gates: {
      decay45: r45 / rPeak <= 0.1,
      decay60: r60 / rPeak <= 0.05,
      angularVelocity60: sample60.omega <= 0.05,
      orientation60: sample60.theta <= (2 * Math.PI) / 180,
      signReversals:
        countSignReversals(
          samples.slice(peakIndex).map((sample) => sample.signedTheta),
        ) <= 1,
    },
  }
  const carryRegression = await runCarryRegression()
  const headFeelPass = Object.values(metrics.gates).every(Boolean)
  const result =
    headFeelPass && noImpactControl.stable && carryRegression.passed
      ? 'pass'
      : carryRegression.passed && noImpactControl.stable
        ? 'head-feel-failed'
        : 'physics-authority-regressed'
  return {
    node: 'N33',
    result,
    deterministic: true,
    physics: {
      revision: N6_PHYSICS_CONFIG.revision,
      dt: N6_PHYSICS_CONFIG.dt,
      headAngularDamping: N6_PHYSICS_CONFIG.head.angularDamping,
      headDensity: null,
      headMassPolicy:
        'Rapier collider-derived mass/inertia; no additional mass override',
      solverIterations: N6_PHYSICS_CONFIG.solverIterations,
      friction: N6_PHYSICS_CONFIG.friction,
    },
    baseline: {
      headQuaternion: q0,
      identityWithinTolerance: identityWithin,
      tolerance: identityTolerance,
    },
    fixture: {
      carriagePosition: [...N6_PHYSICS_CONFIG.clawPosition] as Vec3,
      carriageFixed: samples.every((sample) =>
        sample.carriagePosition.every(
          (value, axis) =>
            Math.abs(value - N6_PHYSICS_CONFIG.clawPosition[axis]) <=
            N6_PHYSICS_CONFIG.tolerances.travel,
        ),
      ),
      headResponseObserved: thetaPeak > 0 && omegaPeak > 0,
    },
    impulse: IMPULSE,
    preImpactSteps: IMPACT_SETTLE_STEPS,
    samples: samplesWithResponse,
    metrics,
    noImpactControl,
    carryRegression,
    failureResult: result === 'pass' ? null : result,
  }
}

export async function serializeN33Evidence(): Promise<string> {
  return JSON.stringify(await createN33Evidence(), null, 2)
}
