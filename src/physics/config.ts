import type { GripProfile } from './grip-evaluator'
import type { Vec3 } from '../types/geometry'
export type { Vec3 } from '../types/geometry'
export type { GripProfile } from './grip-evaluator'

/** N37: opt-in candidate profile; A-24 remains the active runtime rule. */
export const N37_CANDIDATE_GRIP_PROFILE: GripProfile = Object.freeze({
  revision: 'n37-candidate-profile-rev1',
  objectBodyId: 'prize',
  captureEnvelopeOffset: Object.freeze([0, 0, 0]) as Vec3,
  captureEnvelopeHalfExtents: Object.freeze([0.34, 0.34, 0.34]) as Vec3,
  referencePoint: Object.freeze([0, 0, 0]) as Vec3,
  requiredVolumeHalfExtents: Object.freeze([0.22, 0.22, 0.22]) as Vec3,
  margin: 0.02,
  requiredContacts: Object.freeze([
    Object.freeze({ id: 'finger-right', approachDirection: 'right' }),
    Object.freeze({ id: 'finger-left', approachDirection: 'left' }),
    Object.freeze({ id: 'finger-back', approachDirection: 'back' }),
  ]),
  settlingSteps: 3,
})

const AUTHORED_FLOOR_TOP_Y = 0.89
// The clearance target is intentionally a gameplay-safe descent floor, not a
// static geometric minimum: dynamic head tilt and prize contact can move the
// fitted segment envelope during the final fixed steps. Keep a small margin
// above the authored floor while the runtime observes every solver segment.
const APPROVED_CLAW_LOWEST_POINT_OFFSET_Y = -0.325
const APPROVED_BASE_CLEARANCE = 0.01
const APPROVED_BASE_DESCENT_Y =
  AUTHORED_FLOOR_TOP_Y -
  APPROVED_CLAW_LOWEST_POINT_OFFSET_Y +
  APPROVED_BASE_CLEARANCE

/**
 * N6 physics policy: one fixed-step configuration is shared by every adapter
 * and evidence fixture. Render timing never enters this simulation.
 * N25-N28: the claw is now a hybrid — a kinematic carriage (travel authority)
 * plus a dynamic head body (collision tilt) joined by a limited spherical
 * joint; the fingers carry physical capsule colliders; the chamber has walls.
 */
export const N6_PHYSICS_CONFIG = Object.freeze({
  revision: 'fixed-step-rev3',
  dt: 1 / 60,
  /** N41/N47: deterministic voltage/friction retention candidates. */
  retention: Object.freeze({
    revision: 'n48-speed-rev1',
    minGripVoltage: 12,
    maxGripVoltage: 36,
    gripVoltage: 24,
    maxHoldForceAtMinVoltage: 30,
    maxHoldForceAtMaxVoltage: 90,
    padFriction: 0.8,
    holdFailureThreshold: 0,
    gripLeverArm: 0.5,
    prizeWeight: 10,
    centerOfMass: Object.freeze([0, 0, 0]) as Vec3,
    gripPoint: Object.freeze([0, 0, 0]) as Vec3,
    // F-07 declared swing term; the adapter replaces this reserved constant
    // with the measured head swing each fixed step (N47). Zero = uncoupled.
    pendulumSwingAcceleration: 0,
    // F-08 declared travel term; the adapter feeds the measured carriage
    // acceleration each fixed step (N48). Zero baseline = uncoupled.
    travelAcceleration: 0,
    packingForce: 0,
    /** N47 (F-07): versioned swing-accel → required-hold-force transfer. */
    swingTransfer: Object.freeze({
      revision: 'n47-swing-transfer-rev1',
      referenceAngularAcceleration: 40,
      maxLinearAcceleration: 12,
      windowSteps: 4,
    }),
    /** N48 (F-08): versioned travel-accel → required-hold-force transfer. */
    travelTransfer: Object.freeze({
      revision: 'n48-travel-transfer-rev1',
      referenceAcceleration: 8,
      maxLinearAcceleration: 12,
      windowSteps: 4,
    }),
  }),
  /**
   * N48 (F-08): per-phase speed/acceleration profile for scheduled travel.
   * Free positioning fastest; descent/close/lift slowest; conservative,
   * config-tunable defaults (spec §7 #7) so the game never feels sluggish.
   * The N23 velocity glide is NOT profile-governed — it keeps its own speeds.
   */
  travelProfile: Object.freeze({
    revision: 'n48-speed-profile-rev1',
    freePositioning: Object.freeze({ maxSpeed: 3.8, maxAcceleration: 60 }),
    descent: Object.freeze({ maxSpeed: 1.6, maxAcceleration: 20 }),
    lift: Object.freeze({ maxSpeed: 1.6, maxAcceleration: 20 }),
    returnTraverse: Object.freeze({ maxSpeed: 2.6, maxAcceleration: 80 }),
    returnDescent: Object.freeze({ maxSpeed: 3.7, maxAcceleration: 180 }),
  }),
  gravity: Object.freeze({ x: 0, y: -9.81, z: 0 }),
  solverIterations: 8,
  additionalFrictionIterations: 2,
  sleeping: true,
  linearDamping: 0.05,
  angularDamping: 0.05,
  friction: 0.7,
  restitution: 0,
  ccd: true,
  tolerances: Object.freeze({
    idlePosition: 0.002,
    idleVelocity: 0.02,
    travel: 0.000001,
    carryPosition: 0.025,
    repeatPosition: 0.0005,
  }),
  travelBounds: Object.freeze({
    min: Object.freeze({ x: -1.25, y: 0.83, z: -0.35 }),
    max: Object.freeze({ x: 1.25, y: 2.8, z: 0.55 }),
  }),
  /** N36: explicit finite physical base in canonical world/ClawMount meters. */
  basePlane: Object.freeze({
    y: AUTHORED_FLOOR_TOP_Y,
    normal: Object.freeze([0, 1, 0]) as Vec3,
    halfExtents: Object.freeze([3, 2]) as readonly [number, number],
    coordinateLayer: 'world/ClawMount',
    source: 'N6PhysicsAdapter floor collider top surface',
  }),
  /** N36: approved physical claw envelope and derived lowest legal carriage Y. */
  clawClearance: Object.freeze({
    lowestPhysicalPointOffsetY: APPROVED_CLAW_LOWEST_POINT_OFFSET_Y,
    approvedMargin: APPROVED_BASE_CLEARANCE,
    baseInteractionY: APPROVED_BASE_DESCENT_Y,
    tolerance: 0.02,
    envelope: 'head cuboid + three finger capsules; sensors excluded',
  }),
  /** N36: continue through prize contact; only physical environment contact may stop early. */
  descent: Object.freeze({
    policy: 'base-first',
    objectContact: 'observe-and-continue',
    barrierContact: 'stop-and-report',
    completion: 'base-clearance',
  }),
  clawPosition: Object.freeze([0, 2.8, 0]) as Vec3,
  /** N42: canonical delivery lane shared by physics and chute visuals. */
  chute: Object.freeze({
    sensorPosition: Object.freeze([1.05, 1.1, 0.55]) as Vec3,
    sensorRadius: 0.3,
    releasePosition: Object.freeze([1.05, 1.87, 0.55]) as Vec3,
    /** N42.1: top-height waypoint for the return traverse. */
    overPosition: Object.freeze([1.05, 2.8, 0.55]) as Vec3,
    coordinateLayer: 'world/ClawMount',
    source: 'N42 authored release-point sensor',
  }),
  // N26: retained grip candidate for low-level contact/carry fixtures. N36
  // descent no longer uses this fixed value as its completion endpoint.
  // N26: the descent parks the claw at 1.97, where the sensor (at head-local
  // -0.65, radius 0.30) reaches the resting prize (center ~1.109, radius
  // 0.22) for contact approval with a ~0.19 margin at centered drops, while
  // the finger-capsule bottoms (~1.57) stay clear of the carried prize top
  // (~1.33) so the lift is contact-free by construction.
  gripPosition: Object.freeze([0, 1.97, 0]) as Vec3,
  // N25/N26: visual-overlap probe — inside the visual envelope and clear of
  // every physical claw collider (head cuboid, finger capsules, sensor), so
  // "overlap without sensor contact" stays a deterministic rejection.
  overlapPosition: Object.freeze([0.6, 1.55, 0]) as Vec3,
  liftPosition: Object.freeze([0, 2.8, 0]) as Vec3,
  failedLiftPosition: Object.freeze([0.5, 2.8, 0]) as Vec3,
  resetTravelPosition: Object.freeze([0.8, 2.4, 0.4]) as Vec3,
  carrySettleSteps: 10,
  carryLiftSteps: 120,
  maxRetainedStepRecords: 1024,
  // Aligned with the visual playfield: floor top at 0.89 and the prize resting
  // on it at y = 1.2 (floor top + prize radius), visible through the glass.
  prizePosition: Object.freeze([0, 1.2, 0]) as Vec3,
  // Head proxy half extents (was the single claw-body cuboid; N26 moves it to
  // the dynamic head body so collisions tilt the head).
  headHalfExtents: Object.freeze([0.3, 0.12, 0.3]) as Vec3,
  /** N26: dynamic head. The head hangs from the carriage through a spherical
   * joint (translation pinned, rotation free) with its center of mass below
   * the pivot (on the sensor and finger colliders), so gravity self-rights it
   * like a pendulum; angular damping settles it. No torque spring (a spring's
   * per-step torque overshoots upright and goes unstable on this tiny body)
   * and no joint angular limits (Rapier's spherical impulse joint does not
   * support them): the head's swing is bounded by the pendulum plus its own
   * collider contacts with the prize, floor, and chamber walls. */
  head: Object.freeze({
    angularDamping: 10.0,
  }),
  /** N25: finger capsule colliders, one per pivot, derived from the rig's open
   * pose (ring radius, Right·Left·Back angles, open flare). The capsule axis
   * is local Y of each pivot. Deliberately SHORTER than the visual blade: the
   * colliders reach the prize just where the visual blades graze it, so a
   * kinematic descent parks on first contact instead of dragging the rigid
   * fingers into the prize volume (the N22 soft-wrap geometry cannot host
   * non-penetrating colliders). */
  floorHalfExtents: Object.freeze([3, 0.1, 2]) as Vec3,
  floorPosition: Object.freeze([0, 0.79, 0]) as Vec3,
  /** N28: chamber wall colliders (front glass plane + back + sides), sized to
   * the visual cabinet so the prize stays contained and the claw head bumps
   * the glass instead of passing through it. */
  chamberWalls: Object.freeze([
    {
      position: Object.freeze([0, 1.9, 0.88]) as Vec3,
      halfExtents: Object.freeze([1.7, 1.05, 0.05]) as Vec3,
    },
    {
      position: Object.freeze([0, 1.9, -0.88]) as Vec3,
      halfExtents: Object.freeze([1.7, 1.05, 0.05]) as Vec3,
    },
    {
      position: Object.freeze([-1.7, 1.9, 0]) as Vec3,
      halfExtents: Object.freeze([0.05, 1.05, 0.83]) as Vec3,
    },
    {
      position: Object.freeze([1.7, 1.9, 0]) as Vec3,
      halfExtents: Object.freeze([0.05, 1.05, 0.83]) as Vec3,
    },
  ]),
  visualEnvelopeHalfExtents: Object.freeze({ x: 0.55, y: 0.75, z: 0.55 }),
  // N26: prize sized to enter the finger cage (ring inner face 0.24 > prize
  // 0.22) so the fingers can physically close around it without pass-through
  // and the carried prize hangs clear of the finger colliders. The sensor is
  // enlarged to match: the smaller prize shrank the sensor's reach margin at
  // off-center drops to ~0.07, which the head's residual wobble could flip;
  // radius 0.30 restores a ~0.19 margin that stays deterministic.
  prizeRadius: 0.22,
  sensorRadius: 0.3,
  sensorOffset: Object.freeze({ x: 0, y: -0.65, z: 0 }),
})

/** Collision groups are the single source of truth for the N6 fixture. */
export const N6_COLLISION_GROUPS = Object.freeze({
  environment: 1 << 0,
  prize: 1 << 1,
  clawBody: 1 << 2,
  clawFinger: 1 << 3,
  sensor: 1 << 4,
  debug: 1 << 5,
})

export type N38CollisionRole =
  | 'environment'
  | 'prize'
  | 'clawBody'
  | 'clawFinger'
  | 'sensor'

/** Rapier packs a 16-bit membership group and a 16-bit interaction mask. */
export function interactionGroups(group: number, mask: number): number {
  return (group << 16) | mask
}

/**
 * N38: collision membership and solver policy live in config so diagnostics can
 * compare runtime colliders against the versioned matrix without re-encoding
 * masks in the evidence or scene layers.
 */
export const N38_COLLISION_POLICY: Readonly<
  Record<
    N38CollisionRole,
    Readonly<{
      readonly group: number
      readonly collisionMask: number
      readonly solverMask: number
    }>
  >
> = Object.freeze({
  environment: Object.freeze({
    group: N6_COLLISION_GROUPS.environment,
    collisionMask:
      N6_COLLISION_GROUPS.prize |
      N6_COLLISION_GROUPS.clawBody |
      N6_COLLISION_GROUPS.clawFinger,
    solverMask:
      N6_COLLISION_GROUPS.prize |
      N6_COLLISION_GROUPS.clawBody |
      N6_COLLISION_GROUPS.clawFinger,
  }),
  prize: Object.freeze({
    group: N6_COLLISION_GROUPS.prize,
    collisionMask:
      N6_COLLISION_GROUPS.environment |
      N6_COLLISION_GROUPS.prize |
      N6_COLLISION_GROUPS.clawBody |
      N6_COLLISION_GROUPS.clawFinger |
      N6_COLLISION_GROUPS.sensor,
    solverMask:
      N6_COLLISION_GROUPS.environment |
      N6_COLLISION_GROUPS.prize |
      N6_COLLISION_GROUPS.clawBody |
      N6_COLLISION_GROUPS.clawFinger,
  }),
  clawBody: Object.freeze({
    group: N6_COLLISION_GROUPS.clawBody,
    collisionMask:
      N6_COLLISION_GROUPS.environment |
      N6_COLLISION_GROUPS.prize |
      N6_COLLISION_GROUPS.sensor,
    solverMask: N6_COLLISION_GROUPS.environment | N6_COLLISION_GROUPS.prize,
  }),
  clawFinger: Object.freeze({
    group: N6_COLLISION_GROUPS.clawFinger,
    collisionMask: N6_COLLISION_GROUPS.environment | N6_COLLISION_GROUPS.prize,
    solverMask: N6_COLLISION_GROUPS.environment | N6_COLLISION_GROUPS.prize,
  }),
  sensor: Object.freeze({
    group: N6_COLLISION_GROUPS.sensor,
    collisionMask: N6_COLLISION_GROUPS.prize | N6_COLLISION_GROUPS.clawBody,
    solverMask: 0,
  }),
})

export type N38PairExpectation = 'solver' | 'sensor' | 'forbidden'

/** All unordered cells from records/contracts/collision-matrix.md rev 3. */
export const N38_COLLISION_MATRIX: readonly {
  readonly a: N38CollisionRole
  readonly b: N38CollisionRole
  readonly expectation: N38PairExpectation
}[] = Object.freeze([
  { a: 'environment', b: 'environment', expectation: 'forbidden' },
  { a: 'environment', b: 'prize', expectation: 'solver' },
  { a: 'environment', b: 'clawBody', expectation: 'solver' },
  { a: 'environment', b: 'clawFinger', expectation: 'solver' },
  { a: 'environment', b: 'sensor', expectation: 'forbidden' },
  { a: 'prize', b: 'prize', expectation: 'solver' },
  { a: 'prize', b: 'clawBody', expectation: 'solver' },
  { a: 'prize', b: 'clawFinger', expectation: 'solver' },
  { a: 'prize', b: 'sensor', expectation: 'sensor' },
  { a: 'clawBody', b: 'clawBody', expectation: 'forbidden' },
  { a: 'clawBody', b: 'clawFinger', expectation: 'forbidden' },
  { a: 'clawBody', b: 'sensor', expectation: 'sensor' },
  { a: 'clawFinger', b: 'clawFinger', expectation: 'forbidden' },
  { a: 'clawFinger', b: 'sensor', expectation: 'forbidden' },
  { a: 'sensor', b: 'sensor', expectation: 'forbidden' },
])

export function n38CollisionGroups(role: N38CollisionRole): number {
  const policy = N38_COLLISION_POLICY[role]
  return interactionGroups(policy.group, policy.collisionMask)
}

export function n38SolverGroups(role: N38CollisionRole): number {
  const policy = N38_COLLISION_POLICY[role]
  return interactionGroups(policy.group, policy.solverMask)
}

/** N47 (F-07): versioned transfer parameters for the pendulum coupling. */
export interface SwingTransferConfig {
  readonly revision: string
  /** Smoothed |head angular acceleration| at which the term saturates (rad/s²). */
  readonly referenceAngularAcceleration: number
  /** Hard upper bound on the linear-equivalent swing contribution (m/s²). */
  readonly maxLinearAcceleration: number
  /** Fixed-step smoothing window for angular-acceleration samples. */
  readonly windowSteps: number
}

/**
 * N47 (F-07): swing-accel → required-hold-force transfer. Monotone
 * non-decreasing in the smoothed head angular acceleration magnitude and
 * bounded by `maxLinearAcceleration` (clamped), so the coupling can never
 * destabilize the balance. Pure and feed-forward — no torque feedback.
 */
export function swingAccelerationToLinearAcceleration(
  angularAcceleration: number,
  transfer: SwingTransferConfig = N6_PHYSICS_CONFIG.retention.swingTransfer,
): number {
  if (!Number.isFinite(angularAcceleration) || angularAcceleration <= 0) {
    return 0
  }
  const ratio = Math.min(
    1,
    angularAcceleration / transfer.referenceAngularAcceleration,
  )
  return transfer.maxLinearAcceleration * ratio
}

/** N48 (F-08): versioned transfer parameters for the travel coupling. */
export interface TravelTransferConfig {
  readonly revision: string
  /** Carriage acceleration (m/s²) at which the term saturates. */
  readonly referenceAcceleration: number
  /** Hard upper bound on the linear-equivalent travel contribution (m/s²). */
  readonly maxLinearAcceleration: number
  /** Fixed-step smoothing window for carriage-acceleration samples. */
  readonly windowSteps: number
}

export type TravelPhase =
  | 'freePositioning'
  | 'descent'
  | 'lift'
  | 'returnTraverse'
  | 'returnDescent'

export interface PhaseSpeedCap {
  readonly maxSpeed: number
  readonly maxAcceleration: number
}

export interface TravelProfileConfig {
  readonly revision: string
  readonly freePositioning: PhaseSpeedCap
  readonly descent: PhaseSpeedCap
  readonly lift: PhaseSpeedCap
  readonly returnTraverse: PhaseSpeedCap
  readonly returnDescent: PhaseSpeedCap
}

/**
 * N48 (F-08): travel-accel → required-hold-force transfer. Monotone
 * non-decreasing in the smoothed carriage acceleration magnitude and bounded
 * by `maxLinearAcceleration` (clamped) — the same shape as the swing transfer.
 * Pure and feed-forward — no torque feedback.
 */
export function travelAccelerationToLinearAcceleration(
  acceleration: number,
  transfer: TravelTransferConfig = N6_PHYSICS_CONFIG.retention.travelTransfer,
): number {
  if (!Number.isFinite(acceleration) || acceleration <= 0) {
    return 0
  }
  const ratio = Math.min(1, acceleration / transfer.referenceAcceleration)
  return transfer.maxLinearAcceleration * ratio
}

const MIN_TRAVEL_DURATION_MS = 100

/**
 * N48 (F-08): scheduled phase duration that obeys the phase's maxSpeed and
 * maxAcceleration caps. easeInOutCubic's peak acceleration is 12·D/T², so the
 * duration is the larger of the speed-bound and acceleration-bound estimates.
 * Position-based completion (A-40) makes durations safe to change.
 */
export function phaseTravelDurationMs(
  phase: Exclude<TravelPhase, 'freePositioning'>,
  distance: number,
  profile: TravelProfileConfig = N6_PHYSICS_CONFIG.travelProfile,
): number {
  if (!Number.isFinite(distance) || distance <= 0) {
    return MIN_TRAVEL_DURATION_MS
  }
  const cap = profile[phase]
  const bySpeed = (distance / cap.maxSpeed) * 1000
  const byAcceleration =
    Math.sqrt((12 * distance) / cap.maxAcceleration) * 1000
  return Math.max(
    MIN_TRAVEL_DURATION_MS,
    Math.ceil(Math.max(bySpeed, byAcceleration)),
  )
}
