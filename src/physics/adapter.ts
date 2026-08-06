import { Quaternion, Vector3 } from 'three'
import {
  DEFAULT_PRIZE_MANIFEST,
  initialPrizeStates,
  loadPrizeManifest,
  prizeSubGeometries,
  type PrizeDefinition,
  type PrizeManifest,
  type PrizeState,
  type PrizeSubGeometry,
} from '../playfield/prize-manifest'
import {
  createPrizePersistenceStore,
  type PrizePersistenceStore,
} from '../playfield/prize-persistence'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  N6_PHYSICS_CONFIG,
  N37_CANDIDATE_GRIP_PROFILE,
  N38_COLLISION_MATRIX,
  n38CollisionGroups,
  n38SolverGroups,
  swingAccelerationToLinearAcceleration,
  travelAccelerationToLinearAcceleration,
  type N38CollisionRole,
  type N38PairExpectation,
  type SwingTransferConfig,
  type TravelTransferConfig,
  type Vec3,
} from './config'
import {
  FINGER_SEGMENT_COLLIDERS,
  fingerSegmentTransform,
} from '../claw/rig'
import {
  evaluateGrip,
  type GripCandidateObservation,
  type GripContactRegionObservation,
  type GripEvaluation,
  type GripProfile,
} from './grip-evaluator'
import {
  buildRetentionState,
  calculateHoldCapacity,
} from './retention'
import type {
  RetentionReleaseEvent,
  RetentionState,
  RetentionStatus,
} from './retention-types'

export type PhysicsBodyId = 'claw' | 'head' | 'prize' | 'environment'
export type PhysicsRunState = 'ready' | 'carrying' | 'released' | 'failed'

export interface PhysicsTransform {
  readonly position: Vec3
  readonly quaternion: readonly [number, number, number, number]
}

export interface PrizePlayfieldState extends PrizeState {
  readonly geometry: PrizeDefinition['geometry']
  readonly mass: number
  readonly weight: number
  readonly centerOfMass: Vec3
}

export interface PrizePlayfieldSnapshot {
  readonly manifestRevision: string
  readonly freshLayout: boolean
  readonly winningsCount: number
  readonly prizes: readonly PrizePlayfieldState[]
}

export type PhysicsVelocity = Vec3

export interface PhysicsContactFact {
  readonly pair: readonly [PhysicsBodyId, PhysicsBodyId]
  readonly colliderRole: 'head' | 'finger'
  readonly colliderHandle: number
  readonly otherColliderHandle: number
  readonly otherColliderRole: 'prize' | 'floor' | 'wall'
  readonly otherColliderRegion?: PrizeSubGeometry['region']
  readonly otherColliderPrimitiveId?: string
  readonly normal: Vec3
  readonly point: Vec3
  readonly distance: number
}

export type N38ColliderRole = N38CollisionRole | 'floor' | 'wall'
export type N38ShapeType = 'ball' | 'capsule' | 'cuboid'
export type N38InteractionMode = 'solver' | 'sensor'

export interface N38DiagnosticIdentity {
  readonly entity: 'body' | 'collider'
  readonly logicalBodyId: PhysicsBodyId
  readonly bodyHandle: number
  readonly colliderId: string
  readonly colliderHandle: number | null
  readonly role: N38ColliderRole | 'body'
  readonly shapeType: N38ShapeType | 'rigid-body'
  readonly transform: PhysicsTransform
  readonly sensor: boolean
  readonly mode: N38InteractionMode
  readonly collisionGroup: number
  readonly filterMask: number
  readonly solverMask: number
  readonly ccdEnabled: boolean
  readonly sourceRevision: string
  readonly profileRevision: string
  readonly colliderProfileId: string
  readonly derivationRevision: string
  readonly runId: number
}

export interface N38VisualProxyBinding {
  readonly visualId: string
  readonly logicalBodyId: PhysicsBodyId
  readonly requiredColliderIds: readonly string[]
  readonly registeredColliderIds: readonly string[]
  readonly missingColliderIds: readonly string[]
}

export interface N38RegistrationInventory {
  readonly runId: number
  readonly sourceRevision: string
  readonly identities: readonly N38DiagnosticIdentity[]
  readonly visualProxyBindings: readonly N38VisualProxyBinding[]
  readonly missingRegistrations: readonly string[]
}

export interface N38PairDiagnostic {
  readonly a: N38CollisionRole
  readonly b: N38CollisionRole
  readonly expected: N38PairExpectation
  readonly eligible: boolean
  readonly observedContact: boolean
  readonly sensorIntersection: boolean
  readonly solverContact: boolean
  readonly visualOverlap: boolean
  readonly result:
    | 'eligible-solver-contact'
    | 'eligible-no-contact'
    | 'sensor-intersection'
    | 'ineligible-pair'
}

export interface N38ContactTrace {
  readonly a: N38ColliderRole
  readonly b: N38ColliderRole
  readonly aColliderId: string
  readonly bColliderId: string
  readonly eligible: boolean
  readonly sensorIntersection: boolean
  readonly solverContact: boolean
  readonly contactPoint: Vec3 | null
  readonly contactNormal: Vec3 | null
  readonly contactDistance: number | null
}

export interface N38BarrierTrace {
  readonly barrier: 'floor' | 'wall'
  readonly colliderId: string
  readonly contactObserved: boolean
  readonly contact: PhysicsContactFact | null
  readonly before: PhysicsTransform
  readonly target: Vec3
  readonly after: PhysicsTransform
  readonly responseObserved: boolean
}

export interface N38Diagnostics {
  readonly inventory: N38RegistrationInventory
  readonly pairMatrix: readonly N38PairDiagnostic[]
  readonly barrierTraces: readonly N38BarrierTrace[]
  readonly missingRegistrations: readonly string[]
}

export type DescentCompletionReason =
  'in-progress' | 'base-clearance' | 'barrier-contact'

export interface DescentObservation {
  readonly claw: PhysicsTransform
  readonly lowestClawPointY: number
  readonly basePlaneDistance: number
  readonly floorContact: boolean
  readonly barrierContact: boolean
  readonly contacts: readonly PhysicsContactFact[]
  readonly completionReason: DescentCompletionReason
}

export interface GripObservation {
  readonly physicalContact: boolean
  readonly solverContact: boolean
  readonly floorContact: boolean
  readonly barrierContact: boolean
  readonly visualOverlap: boolean
  readonly gripApproved: boolean
  readonly claw: PhysicsTransform
  readonly prize: PhysicsTransform
  readonly contacts: readonly PhysicsContactFact[]
  readonly caughtRegion: PrizeSubGeometry['region'] | null
  readonly caughtPrimitiveIds: readonly string[]
  readonly retentionFactor: number
}

export interface DeliveryObservation {
  readonly delivered: boolean
  readonly removed: boolean
  readonly prizeId: string
  readonly runId: number
  readonly step: number
  readonly prize: PhysicsTransform
  readonly sensor: PhysicsTransform
  readonly relativePosition: Vec3
}

export interface PayoutHookEvent {
  readonly type: 'payout/inventory-hook'
  readonly prizeId: string
  readonly runId: number
  readonly step: number
}

export interface PhysicsStepRecord {
  readonly step: number
  readonly runId: number
  readonly claw: PhysicsTransform
  readonly prize: PhysicsTransform
  readonly physicalContact: boolean
  readonly solverContact: boolean
  readonly floorContact: boolean
  readonly visualOverlap: boolean
  readonly contacts: readonly PhysicsContactFact[]
  readonly jointActive: boolean
  readonly holdActive: boolean
  readonly retention: RetentionState
  readonly retentionRelease: RetentionReleaseEvent | null
  readonly delivery: DeliveryObservation | null
}

export interface GripAttempt {
  readonly accepted: boolean
  readonly reason: 'contact-approved' | 'no-physical-contact'
  /** Retained for evidence compatibility; N41 never creates a Rapier carry joint. */
  readonly jointCreated: false
  readonly holdStarted: boolean
  readonly runId: number
  readonly constraintCreatedAtRunId: null
  readonly holdStartedAtRunId: number | null
}

export interface CandidateGripAttempt {
  readonly evaluation: GripEvaluation
  readonly attempt: GripAttempt
}

export interface N6PhysicsAdapterOptions {
  readonly prizePosition?: Vec3
  readonly prizeManifest?: PrizeManifest
  readonly selectedPrizeId?: string
  readonly persistence?: PrizePersistenceStore
  readonly persistPrizeState?: boolean
  readonly retention?: Partial<{
    readonly gripVoltage: number
    readonly padFriction: number
    readonly maxHoldForceAtMinVoltage: number
    readonly maxHoldForceAtMaxVoltage: number
    readonly holdFailureThreshold: number
    readonly gripLeverArm: number
    readonly prizeWeight: number
    readonly centerOfMass: Vec3
    readonly gripPoint: Vec3
    readonly pendulumSwingAcceleration: number
    readonly travelAcceleration: number
    readonly packingForce: number
  }>
}

interface BodyBaseline {
  readonly position: Vec3
  readonly quaternion: readonly [number, number, number, number]
  readonly sleeping: boolean
}

const ZERO = { x: 0, y: 0, z: 0 }


function vector([x, y, z]: Vec3): { x: number; y: number; z: number } {
  return { x, y, z }
}

function rapierVector(value: { x: number; y: number; z: number }): {
  x: number
  y: number
  z: number
} {
  return { x: value.x, y: value.y, z: value.z }
}

function rotation(value: readonly [number, number, number, number]): {
  x: number
  y: number
  z: number
  w: number
} {
  return { x: value[0], y: value[1], z: value[2], w: value[3] }
}

function tuple(value: { x: number; y: number; z: number }): Vec3 {
  return [value.x, value.y, value.z]
}

type ColliderWithUserData = RAPIER.Collider & { userData?: unknown }

type PrizeColliderMetadata = {
  readonly prizeId: string
  readonly primitiveId: string
  readonly region: PrizeSubGeometry['region']
  readonly retentionFactor: number
}

function prizeColliderDescriptor(
  primitive: PrizeSubGeometry,
): RAPIER.ColliderDesc {
  const descriptor =
    primitive.shape === 'sphere'
      ? RAPIER.ColliderDesc.ball(primitive.radius!)
      : primitive.shape === 'capsule'
        ? RAPIER.ColliderDesc.capsule(primitive.halfHeight!, primitive.radius!)
        : RAPIER.ColliderDesc.cuboid(...primitive.halfExtents!)
  return descriptor
    .setTranslation(...primitive.position)
    .setRotation(rotation(primitive.quaternion as [number, number, number, number]))
    .setCollisionGroups(n38CollisionGroups('prize'))
    .setSolverGroups(n38SolverGroups('prize'))
}

function colliderUserData(collider: RAPIER.Collider): unknown {
  return (collider as ColliderWithUserData).userData
}

function setColliderUserData(
  collider: RAPIER.Collider,
  userData: Record<string, unknown>,
): void {
  ;(collider as ColliderWithUserData).userData = userData
}

function shapeType(value: RAPIER.Collider): N38ShapeType {
  switch (value.shapeType()) {
    case RAPIER.ShapeType.Ball:
      return 'ball'
    case RAPIER.ShapeType.Capsule:
      return 'capsule'
    case RAPIER.ShapeType.Cuboid:
      return 'cuboid'
    default:
      throw new Error(`N38 unsupported collider shape type: ${value.shapeType()}`)
  }
}

function unpackGroups(groups: number): { group: number; mask: number } {
  return { group: groups >>> 16, mask: groups & 0xffff }
}

function quaternionTuple(value: {
  x: number
  y: number
  z: number
  w: number
}): readonly [number, number, number, number] {
  return [value.x, value.y, value.z, value.w]
}

function cloneTransform(transform: PhysicsTransform): PhysicsTransform {
  return {
    position: [...transform.position] as Vec3,
    quaternion: [...transform.quaternion] as [number, number, number, number],
  }
}

function sameVector(a: Vec3, b: Vec3, tolerance: number): boolean {
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance)
}

function sameQuaternion(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
  tolerance: number,
): boolean {
  const direct = a.every(
    (value, index) => Math.abs(value - b[index]) <= tolerance,
  )
  const negated = a.every(
    (value, index) => Math.abs(value + b[index]) <= tolerance,
  )
  return direct || negated
}

/**
 * The N6 physics authority. It is deliberately headless: a scene adapter may
 * read `transform()` but must not write Rapier bodies or call `world.step()`.
 *
 * N26: the claw is hybrid — `clawBody` is the kinematic carriage (travel
 * authority) and `headBody` is dynamic, joined by a spherical joint at the
 * head center (free rotation, translation pinned). The head carries the head
 * cuboid, the three finger capsule colliders (N25), and the grip sensor. The
 * head hangs with its center of mass below the pivot, so gravity self-rights
 * it like a pendulum (settled by angular damping); collisions tilt it, and
 * the head's own collider contacts (prize, floor, chamber walls) bound the
 * swing. The prize is carried from the head (N27). Note: Rapier's spherical
 * impulse joint does not support angular limits, so there is no joint-level
 * hard cap; the pendulum + contacts are the physical bounds.
 */
export class N6PhysicsAdapter {
  readonly config = N6_PHYSICS_CONFIG

  private readonly world: RAPIER.World

  private readonly clawBody: RAPIER.RigidBody
  private readonly headBody: RAPIER.RigidBody
  private readonly prizeBody: RAPIER.RigidBody
  private readonly prizeBodies = new Map<string, RAPIER.RigidBody>()
  private readonly prizeColliders = new Map<string, RAPIER.Collider>()
  private readonly prizeSubGeometryColliders = new Map<string, readonly RAPIER.Collider[]>()
  private readonly prizeColliderMetadata = new Map<number, PrizeColliderMetadata>()
  private readonly prizeDefinitions = new Map<string, PrizeDefinition>()
  private readonly prizeBaselines = new Map<string, BodyBaseline>()
  private readonly prizeState: Map<string, PrizeState>
  private readonly prizeManifest: PrizeManifest
  private readonly primaryPrizeId: string
  private readonly prizePersistence: PrizePersistenceStore
  private readonly persistPrizeState: boolean
  private readonly useManifestPhysics: boolean
  private selectedPrizeId: string
  private readonly restoredPersistedState: boolean
  private readonly environmentBody: RAPIER.RigidBody
  private readonly headCollider: RAPIER.Collider
  private readonly fingerColliders: readonly RAPIER.Collider[]
  private readonly prizeCollider: RAPIER.Collider
  private releaseFrozen = false

  private readonly sensorCollider: RAPIER.Collider
  private readonly chuteSensorCollider: RAPIER.Collider
  private readonly floorCollider: RAPIER.Collider
  private readonly wallColliders: readonly RAPIER.Collider[]
  private readonly wallColliderHandles: ReadonlySet<number>
  private readonly headJoint: RAPIER.ImpulseJoint
  private readonly baseline: Readonly<Record<PhysicsBodyId, BodyBaseline>>
  private readonly stepRecords: PhysicsStepRecord[] = []
  private readonly retentionConfig: N6PhysicsAdapterOptions['retention'] & {
    // N51 (F-11): gripVoltage is the single live-tunable retention knob
    // (ops panel writes through coordinator.setGripVoltage with clamping).
    gripVoltage: number
    readonly padFriction: number
    readonly maxHoldForceAtMinVoltage: number
    readonly maxHoldForceAtMaxVoltage: number
    readonly holdFailureThreshold: number
    readonly gripLeverArm: number
    readonly prizeWeight: number
    readonly centerOfMass: Vec3
    readonly gripPoint: Vec3
    readonly pendulumSwingAcceleration: number
    readonly travelAcceleration: number
    readonly packingForce: number
    readonly swingTransfer: SwingTransferConfig
    readonly travelTransfer: TravelTransferConfig
  }
  private holdActive = false
  private holdOffset: Vec3 = [0, 0, 0]
  private holdContactCount = 0
  private holdRetentionFactor = 1
  /** N47 (F-07): measured pendulum swing term (linear m/s²) feeding the balance. */
  private sampledSwingAcceleration: number =
    this.config.retention.pendulumSwingAcceleration
  /** N47: rolling window of |head angular acceleration| samples (rad/s²). */
  private swingAccelSamples: number[] = []
  private previousHeadAngVel: Vec3 | null = null
  /** N48 (F-08): measured carriage travel term (linear m/s²) feeding the balance. */
  private sampledTravelAcceleration: number =
    this.config.retention.travelAcceleration
  /** N48: rolling window of |carriage acceleration| samples (m/s²). */
  private travelAccelSamples: number[] = []
  private previousClawPosition: Vec3 | null = null
  private previousClawSpeed: number | null = null
  private retentionState: RetentionState
  private retentionReleaseEvent: RetentionReleaseEvent | null = null
  private deliveryObservation: DeliveryObservation | null = null
  private payoutHookEventValue: PayoutHookEvent | null = null
  private deliveredPrizeIds = new Set<string>()
  private stepNumber = 0
  private runId = 0
  private logicalState: PhysicsRunState = 'ready'
  private disposed = false

  private constructor(options: N6PhysicsAdapterOptions = {}) {
    const legacyManifest: PrizeManifest = {
      revision: 'legacy-single-prize-rev1',
      spawnLayout: { density: 1, angle: 0, preset: 'legacy-single-prize' },
      prizes: [{
        ...DEFAULT_PRIZE_MANIFEST.prizes[0],
        position: options.prizePosition ?? this.config.prizePosition,
      }],
    }
    this.prizeManifest = loadPrizeManifest(options.prizeManifest ?? legacyManifest)
    this.primaryPrizeId = this.prizeManifest.prizes[0].id
    this.selectedPrizeId = options.selectedPrizeId ?? this.primaryPrizeId
    if (!this.prizeManifest.prizes.some((prize) => prize.id === this.selectedPrizeId)) {
      throw new Error(`manifest-invalid: selected prize is not declared: ${this.selectedPrizeId}`)
    }
    this.prizePersistence = options.persistence ?? createPrizePersistenceStore()
    this.persistPrizeState = options.persistPrizeState ?? options.prizeManifest !== undefined
    this.useManifestPhysics = options.prizeManifest !== undefined
    const persisted = this.persistPrizeState
      ? this.prizePersistence.load(this.prizeManifest.revision)
      : null
    this.restoredPersistedState = persisted !== null
    this.prizeState = new Map(
      (persisted?.prizes ?? initialPrizeStates(this.prizeManifest)).map((state) => [state.id, state]),
    )
    for (const definition of this.prizeManifest.prizes) {
      this.prizeDefinitions.set(definition.id, definition)
    }
    const prizePosition = this.prizeState.get(this.primaryPrizeId)?.position ?? this.config.prizePosition
    const defaults = this.config.retention
    this.retentionConfig = {
      ...defaults,
      ...options.retention,
      centerOfMass: options.retention?.centerOfMass ?? [...defaults.centerOfMass] as Vec3,
      gripPoint: options.retention?.gripPoint ?? [...defaults.gripPoint] as Vec3,
    }
    this.validateRetentionConfig()
    this.retentionState = this.createRetentionState('idle', null)
    this.world = new RAPIER.World(rapierVector(this.config.gravity))
    this.world.timestep = this.config.dt
    this.world.numSolverIterations = this.config.solverIterations
    this.world.numAdditionalFrictionIterations =
      this.config.additionalFrictionIterations

    const clawBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(...this.config.clawPosition)
      .setCanSleep(false)
    this.clawBody = this.world.createRigidBody(clawBodyDesc)
    this.clawBody.userData = { id: 'claw', authority: 'N6PhysicsAdapter' }

    // N26: dynamic head. It hangs from the carriage through the spherical
    // joint (anchor at the head center, so the head center tracks the carriage
    // anchor exactly) and rotates freely — gravity self-rights it (pendulum),
    // angular damping settles it, and its collider contacts bound the swing.
    const headBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...this.config.clawPosition)
      .setLinearDamping(this.config.linearDamping)
      .setAngularDamping(this.config.head.angularDamping)
      .setCanSleep(false)
      .setCcdEnabled(this.config.ccd)
    this.headBody = this.world.createRigidBody(headBodyDesc)
    this.headBody.userData = { id: 'head', authority: 'N6PhysicsAdapter' }

    const primaryDefinition = this.prizeManifest.prizes[0]
    const prizeBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...prizePosition)
      .setLinearDamping(this.config.linearDamping)
      .setAngularDamping(this.config.angularDamping)
      .setCanSleep(this.config.sleeping)
      .setCcdEnabled(this.config.ccd)
    this.prizeBody = this.world.createRigidBody(prizeBodyDesc)
    this.prizeBodies.set(this.primaryPrizeId, this.prizeBody)
    this.prizeBody.userData = { id: 'prize', authority: 'N6PhysicsAdapter' }

    this.environmentBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed(),
    )
    this.environmentBody.userData = {
      id: 'environment',
      authority: 'N6PhysicsAdapter',
    }

    // Head proxy collider (was the single claw-body cuboid).
    this.headCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(...this.config.headHalfExtents)
        .setCollisionGroups(n38CollisionGroups('clawBody'))
        .setSolverGroups(n38SolverGroups('clawBody'))
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution),
      this.headBody,
    )
    setColliderUserData(this.headCollider, {
      logicalBodyId: 'head',
      colliderId: 'claw-head',
      role: 'clawBody',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-head-rev1',
      colliderProfileId: 'claw-head',
      derivationRevision: 'authored-profile-rev1',
    })

    // N25/N55: one fitted solver capsule per visual finger segment. The
    // dynamic head owns the segments, so its CCD setting covers every finger
    // collider while preserving one collision identity per segment.
    this.fingerColliders = Object.freeze(
      FINGER_SEGMENT_COLLIDERS.map((finger) =>
        this.world.createCollider(
          RAPIER.ColliderDesc.capsule(finger.halfHeight, finger.radius)
            .setTranslation(...finger.position)
            .setRotation(
              rotation(finger.rotation as [number, number, number, number]),
            )
            .setCollisionGroups(n38CollisionGroups('clawFinger'))
            .setSolverGroups(n38SolverGroups('clawFinger'))
            .setFriction(this.config.friction)
            .setRestitution(this.config.restitution),
          this.headBody,
        ),
      ).map((collider, index) => {
        const finger = FINGER_SEGMENT_COLLIDERS[index]
        setColliderUserData(collider, {
          logicalBodyId: 'head',
          colliderId: `claw-finger-${finger.fingerIndex}-${finger.segment}`,
          role: 'clawFinger',
          segment: finger.segment,
          fingerIndex: finger.fingerIndex,
          sourceRevision: this.config.revision,
          profileRevision: 'n55-authored-finger-segment-rev1',
          colliderProfileId: `claw-finger-${finger.fingerIndex}-${finger.segment}`,
          derivationRevision: 'authored-profile-rev1',
        })
        return collider
      }),
    )

    this.sensorCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(this.config.sensorRadius)
        .setTranslation(
          this.config.sensorOffset.x,
          this.config.sensorOffset.y,
          this.config.sensorOffset.z,
        )
        .setSensor(true)
        .setCollisionGroups(n38CollisionGroups('sensor'))
        .setSolverGroups(n38SolverGroups('sensor')),
      this.headBody,
    )
    setColliderUserData(this.sensorCollider, {
      logicalBodyId: 'head',
      colliderId: 'grip-sensor',
      role: 'sensor',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-sensor-rev1',
      colliderProfileId: 'grip-sensor',
      derivationRevision: 'authored-profile-rev1',
    })

    this.chuteSensorCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(this.config.chute.sensorRadius)
        .setTranslation(...this.config.chute.sensorPosition)
        .setSensor(true)
        .setCollisionGroups(n38CollisionGroups('sensor'))
        .setSolverGroups(n38SolverGroups('sensor')),
      this.environmentBody,
    )
    setColliderUserData(this.chuteSensorCollider, {
      logicalBodyId: 'environment',
      colliderId: 'chute-delivery-sensor',
      role: 'sensor',
      sourceRevision: this.config.revision,
      profileRevision: 'n42-authored-chute-sensor-rev1',
      colliderProfileId: 'chute-delivery-sensor',
      derivationRevision: 'canonical-release-point-rev1',
    })

    const primaryPrimitives = prizeSubGeometries(primaryDefinition)
    const primaryColliders = primaryPrimitives.map((primitive) => {
      const collider = this.world.createCollider(
        prizeColliderDescriptor(primitive)
          .setFriction(this.config.friction)
          .setRestitution(this.config.restitution),
        this.prizeBody,
      )
      const metadata: PrizeColliderMetadata = {
        prizeId: this.primaryPrizeId,
        primitiveId: primitive.id,
        region: primitive.region,
        retentionFactor: primitive.retentionFactor,
      }
      this.prizeColliderMetadata.set(collider.handle, metadata)
      setColliderUserData(collider, {
        logicalBodyId: 'prize',
        prizeId: this.primaryPrizeId,
        primitiveId: primitive.id,
        region: primitive.region,
        retentionFactor: primitive.retentionFactor,
        colliderId: primitive.id === 'body'
          ? 'prize-collider'
          : `prize-${this.primaryPrizeId}-${primitive.id}`,
        role: 'prize',
        sourceRevision: this.config.revision,
        profileRevision: 'n44-prize-subgeometry-rev1',
        colliderProfileId: primitive.id === 'body'
          ? 'prize-collider'
          : `prize-${this.primaryPrizeId}-${primitive.id}`,
        derivationRevision: 'authored-convex-primitive-rev1',
      })
      return collider
    })
    this.prizeCollider = primaryColliders[0]
    if (this.useManifestPhysics) this.applyDeclaredMass(this.prizeBody, primaryDefinition)
    this.prizeSubGeometryColliders.set(this.primaryPrizeId, primaryColliders)
    this.prizeColliders.set(this.primaryPrizeId, this.prizeCollider)
    if (this.prizeState.get(this.primaryPrizeId)?.removed) {
      this.prizeBody.setEnabled(false)
      this.prizeCollider.setEnabled(false)
    }

    for (const definition of this.prizeManifest.prizes) {
      if (definition.id === this.primaryPrizeId) continue
      const state = this.prizeState.get(definition.id)
      if (!state || state.removed) continue
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(...state.position)
          .setRotation(rotation(state.orientation.quaternion))
          .setLinearDamping(this.config.linearDamping)
          .setAngularDamping(this.config.angularDamping)
          .setCanSleep(this.config.sleeping)
          .setCcdEnabled(this.config.ccd),
      )
      body.userData = { id: 'prize', prizeId: definition.id, authority: 'N6PhysicsAdapter' }
      const colliders = prizeSubGeometries(definition).map((primitive) => {
        const collider = this.world.createCollider(
          prizeColliderDescriptor(primitive)
            .setFriction(this.config.friction)
            .setRestitution(this.config.restitution),
          body,
        )
        const metadata: PrizeColliderMetadata = {
          prizeId: definition.id,
          primitiveId: primitive.id,
          region: primitive.region,
          retentionFactor: primitive.retentionFactor,
        }
        this.prizeColliderMetadata.set(collider.handle, metadata)
        setColliderUserData(collider, {
          logicalBodyId: 'prize', prizeId: definition.id,
          primitiveId: primitive.id, region: primitive.region,
          retentionFactor: primitive.retentionFactor,
          colliderId: definition.id === this.primaryPrizeId && primitive.id === 'body'
          ? 'prize-collider'
          : `prize-${definition.id}-${primitive.id}`, role: 'prize',
          sourceRevision: this.config.revision,
          profileRevision: 'n44-prize-subgeometry-rev1',
          colliderProfileId: definition.id === this.primaryPrizeId && primitive.id === 'body'
          ? 'prize-collider'
          : `prize-${definition.id}-${primitive.id}`,
          derivationRevision: 'authored-convex-primitive-rev1',
        })
        return collider
      })
      if (this.useManifestPhysics) this.applyDeclaredMass(body, definition)
      this.prizeBodies.set(definition.id, body)
      this.prizeSubGeometryColliders.set(definition.id, colliders)
      this.prizeColliders.set(definition.id, colliders[0])
    }

    const floorCollider = RAPIER.ColliderDesc.cuboid(
      ...this.config.floorHalfExtents,
    )
      .setTranslation(...this.config.floorPosition)
      .setCollisionGroups(n38CollisionGroups('environment'))
      .setSolverGroups(n38SolverGroups('environment'))
      .setFriction(this.config.friction)
      .setRestitution(this.config.restitution)
    this.floorCollider = this.world.createCollider(
      floorCollider,
      this.environmentBody,
    )
    setColliderUserData(this.floorCollider, {
      logicalBodyId: 'environment',
      colliderId: 'environment-floor',
      role: 'floor',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-environment-rev2',
      colliderProfileId: 'environment-floor',
      derivationRevision: 'authored-profile-rev1',
    })

    // N28: chamber walls contain the prize and stop the claw head at the glass.
    const wallColliders: RAPIER.Collider[] = []
    for (const wall of this.config.chamberWalls) {
      const wallCollider = RAPIER.ColliderDesc.cuboid(...wall.halfExtents)
        .setTranslation(...wall.position)
        .setCollisionGroups(n38CollisionGroups('environment'))
        .setSolverGroups(n38SolverGroups('environment'))
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution)
      const collider = this.world.createCollider(
        wallCollider,
        this.environmentBody,
      )
      setColliderUserData(collider, {
        logicalBodyId: 'environment',
        colliderId: `environment-wall-${wallColliders.length}`,
        role: 'wall',
        sourceRevision: this.config.revision,
        profileRevision: 'n38-authored-environment-rev2',
        colliderProfileId: `environment-wall-${wallColliders.length}`,
        derivationRevision: 'authored-profile-rev1',
      })
      wallColliders.push(collider)
    }
    this.wallColliders = Object.freeze(wallColliders)
    this.wallColliderHandles = new Set(wallColliders.map((wall) => wall.handle))

    // N26: spherical joint at the head center — pins translation, leaves the
    // head free to rotate. Rapier's spherical impulse joint has no angular
    // limit support (verified empirically: limits fields are ignored), so the
    // head's swing is bounded by pendulum self-righting and its own collider
    // contacts with the prize, floor, and chamber walls.
    this.clawBody.userData = {
      id: 'claw',
      authority: 'N6PhysicsAdapter',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-carriage-rev1',
      colliderProfileId: 'claw-carriage',
      derivationRevision: 'authored-profile-rev1',
    }
    this.headBody.userData = {
      id: 'head',
      authority: 'N6PhysicsAdapter',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-head-rev1',
      colliderProfileId: 'claw-head-body',
      derivationRevision: 'authored-profile-rev1',
    }
    this.prizeBody.userData = {
      id: 'prize',
      authority: 'N6PhysicsAdapter',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-prize-rev1',
      colliderProfileId: 'prize-body',
      derivationRevision: 'authored-profile-rev1',
    }
    this.environmentBody.userData = {
      id: 'environment',
      authority: 'N6PhysicsAdapter',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-environment-rev2',
      colliderProfileId: 'environment-body',
      derivationRevision: 'authored-profile-rev1',
    }

    this.headJoint = this.world.createImpulseJoint(
      RAPIER.JointData.spherical(ZERO, ZERO),
      this.clawBody,
      this.headBody,
      true,
    )

    this.baseline = Object.freeze({
      claw: this.captureBody(this.clawBody),
      head: this.captureBody(this.headBody),
      prize: this.captureBody(this.prizeBody),
      environment: this.captureBody(this.environmentBody),
    })
    for (const [id, body] of this.prizeBodies) {
      this.prizeBaselines.set(id, this.captureBody(body))
    }
    this.savePrizeState()
  }

  /** Rapier WASM must be initialized once before an adapter can be created. */
  static async create(
    options: N6PhysicsAdapterOptions = {},
  ): Promise<N6PhysicsAdapter> {
    await RAPIER.init()
    return new N6PhysicsAdapter(options)
  }

  get state(): PhysicsRunState {
    return this.logicalState
  }

  get currentRunId(): number {
    return this.runId
  }

  get steps(): number {
    return this.stepNumber
  }

  /** Compatibility name: N41 exposes active hold state, never a Rapier joint. */
  get carryConstraintActive(): boolean {
    return this.holdActive
  }

  get retention(): RetentionState {
    return this.cloneRetentionState(this.retentionState)
  }

  get retentionRelease(): RetentionReleaseEvent | null {
    return this.retentionReleaseEvent ? { ...this.retentionReleaseEvent } : null
  }

  /**
   * N51 (F-11): live operator tuning of grip voltage (12–36V, default 24V).
   * Clamps to the approved retention range; deterministic — the next balance
   * evaluation reads the applied value. Returns the applied (clamped) value.
   * Motion scheduling only: no state transition, no fixed-step change (C-02).
   */
  setGripVoltage(value: number): number {
    if (!Number.isFinite(value)) {
      throw new Error('N51 ops: grip voltage must be finite')
    }
    const { minGripVoltage, maxGripVoltage } = this.config.retention
    const clamped = Math.min(maxGripVoltage, Math.max(minGripVoltage, value))
    this.retentionConfig.gripVoltage = clamped
    return clamped
  }

  get delivery(): DeliveryObservation | null {
    return this.deliveryObservation
      ? {
          ...this.deliveryObservation,
          prize: cloneTransform(this.deliveryObservation.prize),
          sensor: cloneTransform(this.deliveryObservation.sensor),
          relativePosition: [...this.deliveryObservation.relativePosition] as Vec3,
        }
      : null
  }

  get payoutHookEvent(): PayoutHookEvent | null {
    return this.payoutHookEventValue ? { ...this.payoutHookEventValue } : null
  }

  get playfield(): PrizePlayfieldSnapshot {
    const freshLayout = !this.restoredPersistedState
    const prizes = [...this.prizeState].flatMap(([id, state]) => {
        const definition = this.prizeDefinitions.get(id)
        return definition ? [{ ...state, position: [...state.position] as Vec3, geometry: definition.geometry, mass: definition.mass, weight: definition.weight, centerOfMass: [...definition.centerOfMass] as Vec3 }] : []
      })
    return {
      manifestRevision: this.prizeManifest.revision,
      freshLayout,
      winningsCount: prizes.filter((prize) => prize.won).length,
      prizes,
    }
  }

  get logs(): readonly PhysicsStepRecord[] {
    return this.stepRecords.map((record) => ({
      ...record,
      claw: cloneTransform(record.claw),
      prize: cloneTransform(record.prize),
      retention: this.cloneRetentionState(record.retention),
      ...(record.retentionRelease
        ? { retentionRelease: { ...record.retentionRelease } }
        : { retentionRelease: null }),
      ...(record.delivery
        ? {
            delivery: {
              ...record.delivery,
              prize: cloneTransform(record.delivery.prize),
              sensor: cloneTransform(record.delivery.sensor),
              relativePosition: [...record.delivery.relativePosition] as Vec3,
            },
          }
        : { delivery: null }),
    }))
  }

  /** Cheap count of retained records, independent of the cloned `logs` view. */
  get retainedStepRecords(): number {
    return this.stepRecords.length
  }

  /**
   * N38 registration inventory. This is a read-only projection of the Rapier
   * world; no scene object or debug proxy participates in collision truth.
   */
  diagnosticInventory(): N38RegistrationInventory {
    this.assertNotDisposed()
    const identities: N38DiagnosticIdentity[] = []
    const missingRegistrations: string[] = []
    this.world.forEachRigidBody((body) => {
      const data = body.userData as Record<string, unknown> | undefined
      const logicalBodyId = data?.id
      if (!this.isPhysicsBodyId(logicalBodyId)) {
        missingRegistrations.push(`body:${body.handle}`)
        return
      }
      identities.push({
        entity: 'body',
        logicalBodyId,
        bodyHandle: body.handle,
        colliderId: `body-${logicalBodyId}`,
        colliderHandle: null,
        role: 'body',
        shapeType: 'rigid-body',
        transform: this.transform(logicalBodyId),
        sensor: false,
        mode: 'solver',
        collisionGroup: 0,
        filterMask: 0,
        solverMask: 0,
        ccdEnabled: body.isCcdEnabled(),
        sourceRevision: this.stringData(data, 'sourceRevision'),
        profileRevision: this.stringData(data, 'profileRevision'),
        colliderProfileId: this.stringData(data, 'colliderProfileId'),
        derivationRevision: this.stringData(data, 'derivationRevision'),
        runId: this.runId,
      })
    })
    this.world.forEachCollider((collider) => {
      const data = colliderUserData(collider) as
        | Record<string, unknown>
        | undefined
      const parent = collider.parent()
      const parentData = parent?.userData as
        | Record<string, unknown>
        | undefined
      const logicalBodyId = parentData?.id
      const colliderId = data?.colliderId
      const role = data?.role
      if (
        !this.isPhysicsBodyId(logicalBodyId) ||
        typeof colliderId !== 'string' ||
        !this.isN38ColliderRole(role)
      ) {
        missingRegistrations.push(`collider:${collider.handle}`)
        return
      }
      const collision = unpackGroups(collider.collisionGroups())
      const solver = unpackGroups(collider.solverGroups())
      identities.push({
        entity: 'collider',
        logicalBodyId,
        bodyHandle: parent?.handle ?? -1,
        colliderId,
        colliderHandle: collider.handle,
        role,
        shapeType: shapeType(collider),
        transform: {
          position: tuple(collider.translation()),
          quaternion: quaternionTuple(collider.rotation()),
        },
        sensor: collider.isSensor(),
        mode: collider.isSensor() ? 'sensor' : 'solver',
        collisionGroup: collision.group,
        filterMask: collision.mask,
        solverMask: solver.mask,
        ccdEnabled: parent?.isCcdEnabled() ?? false,
        sourceRevision: this.stringData(data, 'sourceRevision'),
        profileRevision: this.stringData(data, 'profileRevision'),
        colliderProfileId: this.stringData(data, 'colliderProfileId'),
        derivationRevision: this.stringData(data, 'derivationRevision'),
        runId: this.runId,
      })
    })
    const registeredColliderIds = identities
      .filter((identity) => identity.entity === 'collider')
      .map((identity) => identity.colliderId)
    const visualProxyBindings: readonly N38VisualProxyBinding[] = [
      {
        visualId: 'ClawVisualRoot',
        logicalBodyId: 'head',
        requiredColliderIds: [
          'claw-head',
          ...FINGER_SEGMENT_COLLIDERS.map(
            (finger) => `claw-finger-${finger.fingerIndex}-${finger.segment}`,
          ),
          'grip-sensor',
        ],
        registeredColliderIds: registeredColliderIds.filter(
          (id) =>
            id === 'claw-head' ||
            id.startsWith('claw-finger-') ||
            id === 'grip-sensor',
        ),
        missingColliderIds: [
          'claw-head',
          ...FINGER_SEGMENT_COLLIDERS.map(
            (finger) => `claw-finger-${finger.fingerIndex}-${finger.segment}`,
          ),
          'grip-sensor',
        ].filter((id) => !registeredColliderIds.includes(id)),
      },
      {
        visualId: 'PrizeBody',
        logicalBodyId: 'prize',
        requiredColliderIds: ['prize-collider'],
        registeredColliderIds: registeredColliderIds.filter(
          (id) => id === 'prize-collider',
        ),
        missingColliderIds: registeredColliderIds.includes('prize-collider')
          ? []
          : ['prize-collider'],
      },
      {
        visualId: 'MachineCollisionProxies/PlayfieldFloor',
        logicalBodyId: 'environment',
        requiredColliderIds: ['environment-floor'],
        registeredColliderIds: registeredColliderIds.filter(
          (id) => id === 'environment-floor',
        ),
        missingColliderIds: registeredColliderIds.includes('environment-floor')
          ? []
          : ['environment-floor'],
      },
      {
        visualId: 'MachineCollisionProxies/ChamberWalls',
        logicalBodyId: 'environment',
        requiredColliderIds: [
          'environment-wall-0',
          'environment-wall-1',
          'environment-wall-2',
          'environment-wall-3',
        ],
        registeredColliderIds: registeredColliderIds.filter((id) =>
          id.startsWith('environment-wall-'),
        ),
        missingColliderIds: [
          'environment-wall-0',
          'environment-wall-1',
          'environment-wall-2',
          'environment-wall-3',
        ].filter((id) => !registeredColliderIds.includes(id)),
      },
    ]
    const missingVisualProxies = visualProxyBindings.flatMap((binding) =>
      binding.missingColliderIds.map(
        (id) => `${binding.visualId}->${id}`,
      ),
    )
    return {
      runId: this.runId,
      sourceRevision: this.config.revision,
      identities,
      visualProxyBindings,
      missingRegistrations: [...missingRegistrations, ...missingVisualProxies],
    }
  }

  /**
   * N38 controlled matrix and current Rapier observation. Eligibility is
   * calculated from both colliders' masks; proximity/contact is never inferred
   * from a rendered mesh or from a carry joint.
   */
  observeN38Diagnostics(): N38Diagnostics {
    this.assertNotDisposed()
    const inventory = this.diagnosticInventory()
    const pairMatrix = N38_COLLISION_MATRIX.map((cell) => {
      const a = this.n38RoleColliders(cell.a)
      const b = this.n38RoleColliders(cell.b)
      const pairs = a.flatMap((left) =>
        b
          .filter((right) => left.handle !== right.handle)
          .map((right) => this.n38PairState(left, right)),
      )
      const eligible = pairs.some((pair) => pair.eligible)
      const solverContact = pairs.some((pair) => pair.solverContact)
      const sensorIntersection = pairs.some((pair) => pair.sensorIntersection)
      const observedContact = solverContact || sensorIntersection
      const visualOverlap =
        cell.b === 'prize' || cell.a === 'prize'
          ? this.visualEnvelopeOverlaps(
              this.transform('head').position,
              this.transform('prize').position,
            )
          : false
      return {
        a: cell.a,
        b: cell.b,
        expected: cell.expectation,
        eligible,
        observedContact,
        sensorIntersection,
        solverContact,        visualOverlap,
        result: (

          cell.expectation === 'forbidden'
            ? 'ineligible-pair'
            : solverContact
              ? 'eligible-solver-contact'
              : sensorIntersection
                ? 'sensor-intersection'
                : 'eligible-no-contact'
        ) as N38PairDiagnostic['result'],

      }
    })
    return {
      inventory,
      pairMatrix,
      barrierTraces: [],
      missingRegistrations: inventory.missingRegistrations,
    }
  }

  /** Returns all observed Rapier contacts/intersections between registered roles. */
  observeN38ContactTraces(): readonly N38ContactTrace[] {
    this.assertNotDisposed()
    const colliders: RAPIER.Collider[] = []
    this.world.forEachCollider((collider) => colliders.push(collider))
    const traces: N38ContactTrace[] = []
    for (let leftIndex = 0; leftIndex < colliders.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < colliders.length; rightIndex += 1) {
        const left = colliders[leftIndex]
        const right = colliders[rightIndex]
        const leftRole = this.n38Role(left)
        const rightRole = this.n38Role(right)
        if (!leftRole || !rightRole || left.parent()?.handle === right.parent()?.handle) {
          continue
        }
        const state = this.n38PairState(left, right)
        if (!state.sensorIntersection && !state.solverContact) continue
        const contact = this.n38Contact(left, right)
        traces.push({
          a: leftRole,
          b: rightRole,
          aColliderId: this.n38ColliderId(left),
          bColliderId: this.n38ColliderId(right),
          eligible: state.eligible,
          sensorIntersection: state.sensorIntersection,
          solverContact: state.solverContact,
          contactPoint: contact?.point ?? null,
          contactNormal: contact?.normal ?? null,
          contactDistance: contact?.distance ?? null,
        })
      }
    }
    return traces
  }

  /** Returns one manifest prize transform without exposing Rapier bodies. */
  transformPrize(id: string): PhysicsTransform {
    const body = this.prizeBodies.get(id)
    if (!body) throw new Error(`N43 unknown or removed prize: ${id}`)
    return {
      position: tuple(body.translation()),
      quaternion: quaternionTuple(body.rotation()),
    }
  }

  get prizeIds(): readonly string[] {
    return [...this.prizeDefinitions.keys()]
  }

  get selectedPrize(): string {
    return this.selectedPrizeId
  }

  selectPrize(id: string): boolean {
    const state = this.prizeState.get(id)
    if (!state || state.removed || !this.prizeBodies.get(id)?.isEnabled()) return false
    this.selectedPrizeId = id
    return true
  }

  /** Updates the Rapier segment colliders to match the authored finger pose. */
  setFingerArticulation(
    blade: number,
    hook: number,
    pivotArticulation = 0,
  ): void {
    this.assertNotDisposed()
    if (
      !Number.isFinite(blade) ||
      !Number.isFinite(hook) ||
      !Number.isFinite(pivotArticulation)
    ) {
      throw new Error('N55 finger articulation must be finite')
    }
    this.fingerColliders.forEach((collider, index) => {
      const segment = FINGER_SEGMENT_COLLIDERS[index]!
      const articulation = segment.segment === 'blade' ? blade : hook
      const transform = fingerSegmentTransform(
        segment.fingerIndex,
        segment.segment,
        articulation,
        pivotArticulation,
      )
      collider.setTranslationWrtParent(vector(transform.position))
      collider.setRotationWrtParent(rotation(transform.rotation))
    })
    this.world.propagateModifiedBodyPositionsToColliders()
  }

  /** Adapter-owned nudge fixture/operator operation; persistence occurs on the next fixed step. */
  movePrize(id: string, position: Vec3, orientation?: PrizeState['orientation']): boolean {
    const body = this.prizeBodies.get(id)
    const state = this.prizeState.get(id)
    if (!body || !state || state.removed) return false
    body.setTranslation(vector(position), true)
    if (orientation) body.setRotation(rotation(orientation.quaternion), true)
    body.setLinvel(ZERO, true)
    body.setAngvel(ZERO, true)
    body.wakeUp()
    return true
  }

  /** Sets a kinematic target; all bounds and body writes remain adapter-owned. */
  moveClaw(position: Vec3): boolean {
    this.assertNotDisposed()
    if (this.releaseFrozen) return false
    const { min, max } = this.config.travelBounds
    const epsilon = this.config.tolerances.travel
    const axes = ['x', 'y', 'z'] as const
    const clampedPosition = position.map((value, index) => {
      const axis = axes[index]
      const lower = min[axis]
      const upper = max[axis]
      if (value < lower && lower - value <= epsilon) return lower
      if (value > upper && value - upper <= epsilon) return upper
      return value
    }) as unknown as Vec3
    const inBounds = clampedPosition.every(
      (value, index) => {
        const axis = axes[index]
        return value >= min[axis] && value <= max[axis]
      },
    )
    if (!inBounds) return false
    this.clawBody.setNextKinematicTranslation(vector(clampedPosition))
    return true
  }

  /** Advances exactly one configured fixed step and records the resulting pose. */
  step(): PhysicsStepRecord {
    this.assertNotDisposed()
    // N41: holding is an adapter-owned force correction, not a Rapier joint.
    if (this.holdActive) this.applyHoldImpulse()
    this.world.step()
    this.stepNumber += 1
    // N47: sample the real pendulum swing before the hold balance is evaluated.
    this.sampleSwingAcceleration()
    // N48: sample the carriage's travel acceleration into the same balance.
    this.sampleTravelAcceleration()
    // Release/drop paths are allowed to carry a composed prize down to the
    // chute; retain the same fixed-step sensor authority for delivery.
    this.observeDelivery()
    if (this.holdActive) {
      const retention = this.createRetentionState('holding', null)
      this.retentionState = retention
      if (retention.margin < this.retentionConfig.holdFailureThreshold) {
        this.breakHold(retention.margin)
      }
    }
    const observation = this.observeGrip()
    const record: PhysicsStepRecord = {
      step: this.stepNumber,
      runId: this.runId,
      claw: observation.claw,
      prize: observation.prize,
      physicalContact: observation.physicalContact,
      solverContact: observation.solverContact,
      floorContact: observation.floorContact,
      visualOverlap: observation.visualOverlap,
      contacts: observation.contacts,
      jointActive: false,
      holdActive: this.holdActive,
      retention: this.cloneRetentionState(this.retentionState),
      retentionRelease: this.retentionReleaseEvent
        ? { ...this.retentionReleaseEvent }
        : null,
      delivery: this.deliveryObservation
        ? {
            ...this.deliveryObservation,
            prize: cloneTransform(this.deliveryObservation.prize),
            sensor: cloneTransform(this.deliveryObservation.sensor),
            relativePosition: [...this.deliveryObservation.relativePosition] as Vec3,
          }
        : null,
    }
    this.updatePrizeStateFromBodies()
    this.savePrizeState()
    this.stepRecords.push(record)
    const maxRetained = this.config.maxRetainedStepRecords
    if (this.stepRecords.length > maxRetained) {
      this.stepRecords.splice(0, this.stepRecords.length - maxRetained)
    }
    return record
  }

  stepMany(count: number): readonly PhysicsStepRecord[] {
    this.assertNotDisposed()
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        'N6PhysicsAdapter.stepMany: count must be a non-negative integer',
      )
    }
    return Array.from({ length: count }, () => this.step())
  }

  /**
   * Converts one adapter-owned Rapier observation into the opt-in N37 profile
   * vocabulary. The active A-24 rule does not call this bridge.
   */
  observeCandidateGrip(
    profile: GripProfile = N37_CANDIDATE_GRIP_PROFILE,
  ): GripCandidateObservation {
    const observation = this.observeGrip()
    const head = this.transform('head')
    const prize = this.transform('prize')
    const knownFingerHandles = new Set(
      this.fingerColliders.map((collider) => collider.handle),
    )
    const unknownFingerContact = observation.contacts.some(
      (contact) =>
        contact.colliderRole === 'finger' &&
        !knownFingerHandles.has(contact.colliderHandle),
    )
    return {
      runId: this.runId,
      expectedRunId: this.runId,
      fixedStep: this.stepNumber,
      objectBodyId: profile.objectBodyId,
      objectPositionWorld: prize.position,
      captureEnvelopeOriginWorld: head.position,
      sensorIntersection: observation.physicalContact,
      sensorObjectBodyId: observation.physicalContact
        ? profile.objectBodyId
        : null,
      contactRegions: observation.contacts
        .filter((contact) => contact.otherColliderRole === 'prize' && contact.otherColliderPrimitiveId && contact.otherColliderRegion)
        .map((contact) => ({
          prizeId: profile.objectBodyId,
          primitiveId: contact.otherColliderPrimitiveId!,
          region: contact.otherColliderRegion!,
          retentionFactor: this.prizeColliderMetadata.get(contact.otherColliderHandle)?.retentionFactor ?? 1,
        } satisfies GripContactRegionObservation)),
      collisionGroupEligible:
        observation.physicalContact || observation.solverContact,
      colliderMappingValid:
        !unknownFingerContact &&
        observation.contacts.every(
          (contact) =>
            contact.otherColliderRole === 'prize' ||
            contact.otherColliderRole === 'floor' ||
            contact.otherColliderRole === 'wall',
        ),
      solverContacts: observation.contacts
        .filter(
          (contact) =>
            contact.otherColliderRole === 'prize' &&
            contact.colliderRole === 'finger',
        )
        .map((contact) => {
          const fingerIndex = this.fingerColliders.findIndex(
            (finger) => finger.handle === contact.colliderHandle,
          )
          if (fingerIndex < 0) {
            return {
              objectBodyId: profile.objectBodyId,
              contactRegionId: 'finger-back',
              approachDirection: 'back',
              solverContact: false,
              collisionGroupEligible: false,
            }
          }
          const contactRegionId =
            fingerIndex === 0
              ? 'finger-right'
              : fingerIndex === 1
                ? 'finger-left'
                : 'finger-back'
          return {
            objectBodyId: profile.objectBodyId,
            contactRegionId,
            approachDirection:
              contactRegionId === 'finger-right'
                ? 'right'
                : contactRegionId === 'finger-left'
                  ? 'left'
                  : 'back',
            solverContact: true,
            collisionGroupEligible: true,
            primitiveId: contact.otherColliderPrimitiveId,
          }
        }),
    }
  }

  /** Evaluates the opt-in N37 predicate without changing active A-24 behavior. */
  evaluateCandidateGrip(
    observations: readonly GripCandidateObservation[],
    profile: GripProfile = N37_CANDIDATE_GRIP_PROFILE,
  ): GripEvaluation {
    return evaluateGrip(profile, observations)
  }

  /**
   * Candidate-only evaluation. It deliberately never creates a carry joint:
   * promotion to the active A-24 path requires a separate contract revision.
   */
  attemptCandidateGrip(
    observations: readonly GripCandidateObservation[],
    profile: GripProfile = N37_CANDIDATE_GRIP_PROFILE,
  ): CandidateGripAttempt {
    const evaluation = this.evaluateCandidateGrip(observations, profile)
    return {
      evaluation,
      attempt: {
        accepted: evaluation.approved,
        reason: evaluation.approved
          ? 'contact-approved'
          : 'no-physical-contact',
        jointCreated: false,
        holdStarted: false,
        runId: this.runId,
        constraintCreatedAtRunId: null,
        holdStartedAtRunId: null,
      },
    }
  }

  /** Reports delivery from the adapter-owned chute sensor, never render overlap. */
  private observeDelivery(): DeliveryObservation | null {
    const selectedId = this.selectedPrizeId
    const selectedBody = this.prizeBodies.get(selectedId)
    const selectedCollider = this.prizeColliders.get(selectedId)
    if (!selectedBody || !selectedCollider || this.deliveredPrizeIds.has(selectedId)) {
      return this.deliveryObservation
    }
    // A sensor overlap while the hold is active is not a win. Re-evaluate on
    // the next fixed step after release so a delivered prize can never produce
    // a win-ghost while still attached to the claw.
    if (this.holdActive) return null
    const intersects = this.world.intersectionPair(
      this.chuteSensorCollider,
      selectedCollider,
    )
    if (!intersects) return null
    const prize = this.transform('prize')
    const sensor = {
      position: [...this.config.chute.sensorPosition] as Vec3,
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
    }
    const relativePosition: Vec3 = [
      prize.position[0] - sensor.position[0],
      prize.position[1] - sensor.position[1],
      prize.position[2] - sensor.position[2],
    ]
    this.deliveredPrizeIds.add(selectedId)
    const deliveredState = this.prizeState.get(selectedId)
    if (deliveredState) {
      this.prizeState.set(selectedId, {
        ...deliveredState,
        position: [...prize.position] as Vec3,
        orientation: { quaternion: [...prize.quaternion] as PrizeState['orientation']['quaternion'] },
        won: true,
        removed: true,
      })
    }
    this.deliveryObservation = {
      delivered: true,
      removed: true,
      prizeId: selectedId,
      runId: this.runId,
      step: this.stepNumber,
      prize,
      sensor,
      relativePosition,
    }
    this.payoutHookEventValue = {
      type: 'payout/inventory-hook',
      prizeId: selectedId,
      runId: this.runId,
      step: this.stepNumber,
    }
    selectedBody.setEnabled(false)
    selectedCollider.setEnabled(false)
    this.savePrizeState()
    return this.deliveryObservation
  }

  /** Reports Rapier contact facts separately from visual overlap. */
  observeGrip(): GripObservation {
    this.assertNotDisposed()
    let physicalContact = false
    let activePrizeColliders: readonly RAPIER.Collider[] = []
    for (const [id, colliders] of this.prizeSubGeometryColliders) {
      const state = this.prizeState.get(id)
      if (!state || state.removed) continue
      if (colliders.some((collider) => this.world.intersectionPair(this.sensorCollider, collider))) {
        physicalContact = true
        this.selectedPrizeId = id
        activePrizeColliders = colliders
        break
      }
    }
    activePrizeColliders = activePrizeColliders.length > 0
      ? activePrizeColliders
      : (this.prizeSubGeometryColliders.get(this.selectedPrizeId) ?? [])
    const clawColliders = [this.headCollider, ...this.fingerColliders]
    let solverContact = false
    let floorContact = false
    let barrierContact = false
    const contacts: PhysicsContactFact[] = []
    for (const collider of clawColliders) {
      this.world.contactPairsWith(collider, (other) => {
        const isPrize = activePrizeColliders.some((candidate) => other.handle === candidate.handle)
        const isFloor = other.handle === this.floorCollider.handle
        const isWall = this.wallColliderHandles.has(other.handle)
        if (!isPrize && !isFloor && !isWall) return
        const pairBody = isPrize ? ('prize' as const) : ('environment' as const)
        this.world.contactPair(collider, other, (manifold, flipped) => {
          const rawNormal = manifold.localNormal1()
          const colliderRotation = new Quaternion().fromArray([
            collider.rotation().x,
            collider.rotation().y,
            collider.rotation().z,
            collider.rotation().w,
          ])
          const worldNormal = new Vector3(
            rawNormal.x,
            rawNormal.y,
            rawNormal.z,
          ).applyQuaternion(colliderRotation)
          const normal = flipped
            ? { x: -worldNormal.x, y: -worldNormal.y, z: -worldNormal.z }
            : worldNormal
          const count = manifold.numSolverContacts()
          if (count === 0) return
          const point = manifold.solverContactPoint(0)
          const metadata = isPrize ? this.prizeColliderMetadata.get(other.handle) : undefined
          contacts.push({
            pair: ['claw', pairBody],
            colliderRole:
              collider.handle === this.headCollider.handle ? 'head' : 'finger',
            colliderHandle: collider.handle,
            otherColliderHandle: other.handle,
            otherColliderRole: isPrize ? 'prize' : isFloor ? 'floor' : 'wall',
            ...(metadata ? { otherColliderRegion: metadata.region, otherColliderPrimitiveId: metadata.primitiveId } : {}),
            normal: [normal.x, normal.y, normal.z],
            point: [point.x, point.y, point.z],
            distance: manifold.solverContactDist(0),
          })
          if (pairBody === 'prize') solverContact = true
          if (isFloor) floorContact = true
          if (isWall) barrierContact = true
        })
      })
    }
    const claw = this.transform('claw')
    const prize = this.transform('prize')
    const activeDefinition = this.prizeDefinitions.get(this.selectedPrizeId)
    const visualRadius = activeDefinition?.geometry === 'soft-pouch' ? 0.26 : this.config.prizeRadius
    const visualOverlap = this.visualEnvelopeOverlaps(
      claw.position,
      prize.position,
      visualRadius,
    )
    const prizeContacts = contacts.filter((contact) => contact.otherColliderRole === 'prize' && contact.otherColliderPrimitiveId)
    const caughtRegions = [...new Set(prizeContacts.map((contact) => contact.otherColliderRegion).filter((region): region is PrizeSubGeometry['region'] => region !== undefined))]
    const caughtPrimitiveIds = [...new Set(prizeContacts.map((contact) => contact.otherColliderPrimitiveId!))]
    const retentionFactor = prizeContacts.reduce((minimum, contact) => {
      const metadata = this.prizeColliderMetadata.get(contact.otherColliderHandle)
      return Math.min(minimum, metadata?.retentionFactor ?? 1)
    }, caughtRegions.length > 0 ? 1 : 0)
    return {
      physicalContact,
      solverContact,
      floorContact,
      barrierContact,
      visualOverlap,
      // A-24 remains the active runtime onset rule. N44's stricter
      // sub-geometry predicate is exposed through observeCandidateGrip().
      gripApproved: physicalContact,
      claw,
      prize,
      contacts,
      caughtRegion: caughtRegions.length === 1 ? caughtRegions[0] : null,
      caughtPrimitiveIds,
      retentionFactor,
    }
  }

  /** Reports the approved physical envelope against the explicit base plane. */
  observeDescent(): DescentObservation {
    this.assertNotDisposed()
    const grip = this.observeGrip()
    const lowestClawPointY = this.lowestPhysicalPointY()
    const basePlaneDistance = lowestClawPointY - this.config.basePlane.y
    const completionReason: DescentCompletionReason =
      grip.barrierContact || grip.floorContact
      ? 'barrier-contact'
      : basePlaneDistance <= this.config.clawClearance.tolerance
        ? 'base-clearance'
        : 'in-progress'
    return {
      claw: grip.claw,
      lowestClawPointY,
      basePlaneDistance,
      floorContact: grip.floorContact,
      barrierContact: grip.barrierContact,
      contacts: grip.contacts,
      completionReason,
    }
  }

  /** Computes the actual world-space bottom of the approved physical envelope. */
  private lowestPhysicalPointY(): number {
    const headPosition = this.headCollider.translation()
    const headRotation = this.headCollider.rotation()
    const headQuaternion = new Quaternion(
      headRotation.x,
      headRotation.y,
      headRotation.z,
      headRotation.w,
    )
    const headAxes = [
      new Vector3(1, 0, 0).applyQuaternion(headQuaternion),
      new Vector3(0, 1, 0).applyQuaternion(headQuaternion),
      new Vector3(0, 0, 1).applyQuaternion(headQuaternion),
    ]
    const headExtents = this.config.headHalfExtents
    const headBottom =
      headPosition.y -
      Math.abs(headAxes[0].y) * headExtents[0] -
      Math.abs(headAxes[1].y) * headExtents[1] -
      Math.abs(headAxes[2].y) * headExtents[2]
    const fingerBottoms = this.fingerColliders.map((collider, index) => {
      const segment = FINGER_SEGMENT_COLLIDERS[index]!
      const position = collider.translation()
      const colliderRotation = collider.rotation()
      const axis = new Vector3(0, 1, 0).applyQuaternion(
        new Quaternion(
          colliderRotation.x,
          colliderRotation.y,
          colliderRotation.z,
          colliderRotation.w,
        ),
      )
      return position.y - segment.halfHeight * Math.abs(axis.y) - segment.radius
    })
    return Math.min(headBottom, ...fingerBottoms)
  }

  /** Starts the approved hold after grip-onset contact approval. */
  attemptGrip(): GripAttempt {
    this.assertNotDisposed()
    const observation = this.observeGrip()
    if (
      this.useManifestPhysics &&
      this.prizeManifest.prizes.some((prize) => prize.subGeometries !== undefined) &&
      (!observation.physicalContact ||
        !observation.solverContact ||
        observation.caughtRegion === null)
    ) {
      this.logicalState = 'failed'
      return {
        accepted: false,
        reason: 'no-physical-contact',
        jointCreated: false,
        holdStarted: false,
        runId: this.runId,
        constraintCreatedAtRunId: null,
        holdStartedAtRunId: null,
      }
    }
    if (!observation.gripApproved) {
      this.logicalState = 'failed'
      return {
        accepted: false,
        reason: 'no-physical-contact',
        jointCreated: false,
        holdStarted: false,
        runId: this.runId,
        constraintCreatedAtRunId: null,
        holdStartedAtRunId: null,
      }
    }
    const head = this.transform('head')
    const prize = this.transform('prize')
    const activePrizeBody = this.prizeBodies.get(this.selectedPrizeId)
    if (!activePrizeBody) throw new Error(`N43 selected prize is unavailable: ${this.selectedPrizeId}`)
    const headQuaternion = new Quaternion().fromArray([...head.quaternion])
    this.holdOffset = new Vector3()
      .fromArray([...prize.position])
      .sub(new Vector3().fromArray([...head.position]))
      .applyQuaternion(headQuaternion.clone().invert())
      .toArray() as Vec3
    this.holdActive = true
    this.holdContactCount = Math.max(
      1,
      observation.contacts.filter((contact) => contact.otherColliderRole === 'prize').length,
    )
    this.holdRetentionFactor = observation.retentionFactor || 1
    this.logicalState = 'carrying'
    this.retentionReleaseEvent = null
    this.retentionState = this.createRetentionState('holding', null)
    return {
      accepted: true,
      reason: 'contact-approved',
      jointCreated: false,
      holdStarted: true,
      runId: this.runId,
      constraintCreatedAtRunId: null,
      holdStartedAtRunId: this.runId,
    }
  }

  /** Ends a manual release; balance-triggered releases use breakHold(). */
  releaseGrip(): number | null {
    this.assertNotDisposed()
    const releasedAtRunId = this.holdActive ? this.runId : null
    if (this.holdActive) {
      this.holdActive = false
      this.releaseFrozen = true
      this.freezeClawForRelease()
      this.resetReleasedPrizeMotion()
      this.logicalState = 'released'
      this.retentionState = this.createRetentionState('released', this.stepNumber)
    }
    return releasedAtRunId
  }

  /** Applies one world-space angular impulse through the physics authority. */
  applyAngularImpulse(impulse: Vec3): void {
    this.assertNotDisposed()
    this.headBody.applyTorqueImpulse(vector(impulse), true)
  }

  /** Reads the dynamic head's world angular velocity in rad/s. */
  angularVelocity(): PhysicsVelocity {
    this.assertNotDisposed()
    return tuple(this.headBody.angvel())
  }

  velocity(body: Exclude<PhysicsBodyId, 'environment'>): PhysicsVelocity {
    const source =
      body === 'claw'
        ? this.clawBody
        : body === 'head'
          ? this.headBody
          : this.prizeBody
    return tuple(source.linvel())
  }

  transform(body: PhysicsBodyId): PhysicsTransform {
    const source =
      body === 'claw'
        ? this.clawBody
        : body === 'head'
          ? this.headBody
          : body === 'prize'
            ? this.prizeBodies.get(this.selectedPrizeId) ?? this.prizeBody
            : this.environmentBody
    return {
      position: tuple(source.translation()),
      quaternion: quaternionTuple(source.rotation()),
    }
  }

  baselineTransform(body: PhysicsBodyId): PhysicsTransform {
    return {
      position: [...this.baseline[body].position] as Vec3,
      quaternion: [...this.baseline[body].quaternion] as [
        number,
        number,
        number,
        number,
      ],
    }
  }

  /** Restores bodies, hold state, logs, and run epoch from baseline snapshots. */
  reset(): void {
    this.assertNotDisposed()
    this.holdActive = false
    this.releaseFrozen = false
    this.retentionReleaseEvent = null
    this.deliveryObservation = null
    this.payoutHookEventValue = null
    this.deliveredPrizeIds.clear()
    const persisted = this.persistPrizeState
      ? this.prizePersistence.load(this.prizeManifest.revision)
      : null
    for (const [id, body] of this.prizeBodies) {
      const state = persisted?.prizes.find((entry) => entry.id === id)
      const baseline = this.prizeBaselines.get(id)
      body.setEnabled(!state?.removed)
      this.prizeColliders.get(id)?.setEnabled(!state?.removed)
      if (state) {
        this.restoreBody(body, { position: state.position, quaternion: state.orientation.quaternion, sleeping: false })
        this.prizeState.set(id, state)
      } else if (baseline) {
        this.restoreBody(body, baseline)
        this.prizeState.set(id, {
          id,
          position: [...baseline.position] as Vec3,
          orientation: { quaternion: [...baseline.quaternion] as PrizeState['orientation']['quaternion'] },
          won: false,
          removed: false,
        })
      }
    }
    this.retentionState = this.createRetentionState('idle', null)
    this.holdContactCount = 0
    this.holdRetentionFactor = 1
    // N47: the new run starts with a calm head; clear the swing window so no
    // pre-reset Δω leaks into the fresh run.
    this.sampledSwingAcceleration =
      this.config.retention.pendulumSwingAcceleration
    this.swingAccelSamples = []
    this.previousHeadAngVel = null
    // N48: the new run starts from a calm carriage; clear the travel window so
    // no pre-reset motion leaks into the fresh run.
    this.sampledTravelAcceleration = this.config.retention.travelAcceleration
    this.travelAccelSamples = []
    this.previousClawPosition = null
    this.previousClawSpeed = null
    this.restoreBaselinePose()
    this.setFingerArticulation(0, 0)
    this.stepNumber = 0
    this.runId += 1
    this.logicalState = 'ready'
    this.stepRecords.length = 0
    this.world.propagateModifiedBodyPositionsToColliders()
    this.world.updateSceneQueries()
    // Rapier's narrow phase is refreshed by a world step; this step is part of
    // reset bookkeeping and is intentionally not exposed as a gameplay step.
    this.world.step()
    this.restoreBaselinePose()
    this.world.propagateModifiedBodyPositionsToColliders()
    this.world.updateSceneQueries()
    for (const [id, body] of this.prizeBodies) {
      const state = this.prizeState.get(id)
      if (!state) continue
      this.restoreBody(body, { position: state.position, quaternion: state.orientation.quaternion, sleeping: false })
      body.setEnabled(!state.removed)
      this.prizeColliders.get(id)?.setEnabled(!state.removed)
    }
    this.world.propagateModifiedBodyPositionsToColliders()
    this.world.updateSceneQueries()
    this.savePrizeState()
  }

  /** Idempotent: frees the Rapier world at most once. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.world.free()
  }

  private updatePrizeStateFromBodies(): void {
    for (const [id, body] of this.prizeBodies) {
      const previous = this.prizeState.get(id)
      if (!previous || !body.isEnabled()) continue
      this.prizeState.set(id, {
        ...previous,
        position: tuple(body.translation()),
        orientation: { quaternion: quaternionTuple(body.rotation()) },
      })
    }
  }

  private savePrizeState(): void {
    if (!this.persistPrizeState) return
    this.prizePersistence.save({
      manifestRevision: this.prizeManifest.revision,
      prizes: [...this.prizeState.values()],
    })
  }

  private captureBody(body: RAPIER.RigidBody): BodyBaseline {
    return {
      position: tuple(body.translation()),
      quaternion: quaternionTuple(body.rotation()),
      sleeping: body.isSleeping(),
    }
  }

  /** Restores bodies and the kinematic claw pose from the recorded baseline. */
  private restoreBaselinePose(): void {
    this.headBody.lockTranslations(false, true)
    this.headBody.lockRotations(false, true)
    this.restoreBody(this.clawBody, this.baseline.claw)
    this.restoreBody(this.headBody, this.baseline.head)
    this.restoreBody(this.environmentBody, this.baseline.environment)
    this.clawBody.setNextKinematicTranslation(
      vector(this.baseline.claw.position),
    )
    this.clawBody.setNextKinematicRotation(
      rotation(this.baseline.claw.quaternion),
    )
  }

  private applyDeclaredMass(body: RAPIER.RigidBody, definition: PrizeDefinition): void {
    const additionalMass = definition.mass - body.mass()
    body.setAdditionalMassProperties(
      additionalMass,
      vector(definition.centerOfMass),
      ZERO,
      rotation([0, 0, 0, 1]),
      false,
    )
  }

  private validateRetentionConfig(): void {
    const config = this.retentionConfig
    if (
      !Number.isFinite(config.gripVoltage) ||
      config.gripVoltage < this.config.retention.minGripVoltage ||
      config.gripVoltage > this.config.retention.maxGripVoltage ||
      !Number.isFinite(config.padFriction) ||
      config.padFriction < 0 ||
      !Number.isFinite(config.prizeWeight) ||
      config.prizeWeight <= 0 ||
      !Number.isFinite(config.gripLeverArm) ||
      config.gripLeverArm <= 0 ||
      config.centerOfMass.some((value) => !Number.isFinite(value)) ||
      config.gripPoint.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('N41 hold-undefined-capacity: invalid voltage, friction, weight, CoM, or grip geometry')
    }
  }

  private activePrizeDefinition(): PrizeDefinition {
    const definition = this.prizeDefinitions.get(this.selectedPrizeId)
    if (!definition) {
      throw new Error(`N43 selected prize is unavailable: ${this.selectedPrizeId}`)
    }
    return definition
  }

  private activePrizeWeight(): number {
    return this.useManifestPhysics
      ? this.activePrizeDefinition().weight
      : this.retentionConfig.prizeWeight
  }

  private activePrizeCenterOfMass(): Vec3 {
    return this.useManifestPhysics
      ? ([...this.activePrizeDefinition().centerOfMass] as Vec3)
      : ([...this.retentionConfig.centerOfMass] as Vec3)
  }


  /**
   * N47 (F-07): samples the dynamic head's angular acceleration in the fixed
   * step and maps it through the versioned swing transfer. Read-only with
   * respect to the head — no torque, no per-frame angular corrections (N26
   * lesson). The first sample only records a baseline; Δω is measured from the
   * following step.
   */
  private sampleSwingAcceleration(): void {
    const angVel = tuple(this.headBody.angvel())
    const previous = this.previousHeadAngVel
    this.previousHeadAngVel = [...angVel] as Vec3
    if (previous === null) return
    const deltaMagnitude = Math.hypot(
      angVel[0] - previous[0],
      angVel[1] - previous[1],
      angVel[2] - previous[2],
    )
    const windowSteps = this.retentionConfig.swingTransfer.windowSteps
    this.swingAccelSamples.push(deltaMagnitude / this.config.dt)
    if (this.swingAccelSamples.length > windowSteps) {
      this.swingAccelSamples.shift()
    }
    const mean =
      this.swingAccelSamples.reduce((sum, value) => sum + value, 0) /
      this.swingAccelSamples.length
    this.sampledSwingAcceleration = swingAccelerationToLinearAcceleration(
      mean,
      this.retentionConfig.swingTransfer,
    )
  }

  /**
   * N48 (F-08): samples the carriage's travel acceleration in the fixed step
   * and maps it through the versioned travel transfer into RequiredHoldForce.
   * Only consecutive in-motion steps count (previous AND current step speed
   * above the idle threshold), so a single moveClaw jump — a reset or a
   * fixture park — never registers as travel acceleration. Read-only with
   * respect to the bodies; bounded and monotone like the swing term. The first
   * sample only records a baseline; Δv is measured from the following step.
   */
  private sampleTravelAcceleration(): void {
    const position = this.transform('claw').position
    const previousPosition = this.previousClawPosition
    this.previousClawPosition = [...position] as Vec3
    if (previousPosition === null) return
    const speed =
      Math.hypot(
        position[0] - previousPosition[0],
        position[1] - previousPosition[1],
        position[2] - previousPosition[2],
      ) / this.config.dt
    const previousSpeed = this.previousClawSpeed
    this.previousClawSpeed = speed
    if (previousSpeed === null) return
    const idle = this.config.tolerances.idleVelocity
    const sample =
      speed > idle && previousSpeed > idle
        ? Math.abs(speed - previousSpeed) / this.config.dt
        : 0
    const windowSteps = this.retentionConfig.travelTransfer.windowSteps
    this.travelAccelSamples.push(sample)
    if (this.travelAccelSamples.length > windowSteps) {
      this.travelAccelSamples.shift()
    }
    const mean =
      this.travelAccelSamples.reduce((sum, value) => sum + value, 0) /
      this.travelAccelSamples.length
    this.sampledTravelAcceleration = travelAccelerationToLinearAcceleration(
      mean,
      this.retentionConfig.travelTransfer,
    )
  }



  private createRetentionState(
    status: RetentionStatus,
    releasedAt: number | null,
  ): RetentionState {
    const capacity = calculateHoldCapacity(
      {
        ...this.retentionConfig,
        minGripVoltage: this.config.retention.minGripVoltage,
        maxGripVoltage: this.config.retention.maxGripVoltage,
      },
      this.holdContactCount,
      this.holdRetentionFactor,
    )
    return buildRetentionState({
      status,
      releasedAt,
      voltage: this.retentionConfig.gripVoltage,
      capacity,
      prizeWeight: this.activePrizeWeight(),
      centerOfMass: this.activePrizeCenterOfMass(),
      gripPoint: this.retentionConfig.gripPoint,
      gripLeverArm: this.retentionConfig.gripLeverArm,
      gravityY: this.config.gravity.y,
      swingAcceleration: this.sampledSwingAcceleration,
      travelAcceleration: this.sampledTravelAcceleration,
      packingForce: this.retentionConfig.packingForce,
      contactCount: this.holdContactCount,
      gripRetentionFactor: this.holdRetentionFactor,
    })
  }

  private cloneRetentionState(state: RetentionState): RetentionState {
    return {
      ...state,
      centerOfMass: [...state.centerOfMass] as Vec3,
      gripPoint: [...state.gripPoint] as Vec3,
      contactCount: state.contactCount,
    }
  }

  private applyHoldImpulse(): void {
    const head = this.transform('head')
    const desired = new Vector3()
      .fromArray([...this.holdOffset])
      .applyQuaternion(new Quaternion().fromArray([...head.quaternion]))
      .add(new Vector3(...head.position))
    const current = new Vector3(...this.transform('prize').position)
    const delta = desired.sub(current)
    const activePrizeBody = this.prizeBodies.get(this.selectedPrizeId)
    if (!activePrizeBody) return
    const mass = activePrizeBody.mass()
    const velocity = activePrizeBody.linvel()
    activePrizeBody.applyImpulse(
      {
        x: (delta.x / this.config.dt - velocity.x) * mass,
        y: (delta.y / this.config.dt - velocity.y) * mass,
        z: (delta.z / this.config.dt - velocity.z) * mass,
      },
      true,
    )
  }

  private breakHold(margin: number): void {
    // A balance-triggered weak-grip release happens during carry. The object
    // detaches and drops, but the carriage must remain free to finish its
    // return path; only the explicit chute release freezes the assembly.
    this.holdActive = false
    this.resetReleasedPrizeMotion()
    this.logicalState = 'released'
    this.retentionState = this.createRetentionState('released', this.stepNumber)
    this.retentionReleaseEvent = {
      state: 'released',
      step: this.stepNumber,
      runId: this.runId,
      margin,
      reason: 'hold-margin-negative',
    }
  }

  /**
   * Release is a mechanical stop: freeze the carriage/head at their current
   * transforms so opening the fingers cannot make the claw tumble with the
   * prize. The next reset explicitly unlocks the dynamic head again.
   */
  private freezeClawForRelease(): void {
    const claw = this.clawBody.translation()
    const clawRotation = this.clawBody.rotation()
    this.clawBody.setNextKinematicTranslation(claw)
    this.clawBody.setNextKinematicRotation(clawRotation)
    this.headBody.lockTranslations(true, true)
    this.headBody.lockRotations(true, true)
    // Keep the locked head's current pose authoritative for the next solver
    // step; lock calls alone do not remove the spherical joint's positional
    // correction from an already-displaced dynamic body.
    this.headBody.setTranslation(this.headBody.translation(), true)
    this.headBody.setRotation(this.headBody.rotation(), true)
    this.headBody.setLinvel(ZERO, true)
    this.headBody.setAngvel(ZERO, true)
    this.headBody.resetForces(true)
    this.headBody.resetTorques(true)
  }

  /**
   * Detachment never copies claw motion into the prize. Clearing both velocity
   * channels and accumulated impulses leaves gravity as the only immediate
   * post-release acceleration (plus the prize's own contacts).
   */
  private resetReleasedPrizeMotion(): void {
    const prize = this.prizeBodies.get(this.selectedPrizeId)
    if (!prize) return
    prize.setLinvel(ZERO, true)
    prize.setAngvel(ZERO, true)
    prize.resetForces(true)
    prize.resetTorques(true)
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('N6PhysicsAdapter: operation rejected after disposal')
    }
  }

  private restoreBody(body: RAPIER.RigidBody, baseline: BodyBaseline): void {
    body.setTranslation(vector(baseline.position), true)
    if (body.isKinematic())
      body.setNextKinematicRotation(rotation(baseline.quaternion))
    body.setRotation(rotation(baseline.quaternion), true)
    body.setLinvel(ZERO, true)
    body.setAngvel(ZERO, true)
    body.resetForces(true)
    body.resetTorques(true)
    if (baseline.sleeping) body.sleep()
    else body.wakeUp()
  }

  private n38RoleColliders(role: N38CollisionRole): readonly RAPIER.Collider[] {
    const colliders: RAPIER.Collider[] = []
    this.world.forEachCollider((collider) => {
      const actualRole = this.n38Role(collider)
      if (
        actualRole === role ||
        (role === 'environment' && (actualRole === 'floor' || actualRole === 'wall'))
      ) {
        colliders.push(collider)
      }
    })
    return colliders
  }

  private n38Role(collider: RAPIER.Collider): N38ColliderRole | null {
    const data = colliderUserData(collider) as
      | Record<string, unknown>
      | undefined
    const role = data?.role
    return this.isN38ColliderRole(role) ? role : null
  }

  private n38ColliderId(collider: RAPIER.Collider): string {
    const data = colliderUserData(collider) as
      | Record<string, unknown>
      | undefined
    return typeof data?.colliderId === 'string'
      ? data.colliderId
      : `unregistered-${collider.handle}`
  }

  private n38PairState(
    left: RAPIER.Collider,
    right: RAPIER.Collider,
  ): {
    readonly eligible: boolean
    readonly sensorIntersection: boolean
    readonly solverContact: boolean
  } {
    const leftGroups = left.collisionGroups()
    const rightGroups = right.collisionGroups()
    const leftSolver = left.solverGroups()
    const rightSolver = right.solverGroups()
    const leftMembership = leftGroups >>> 16
    const rightMembership = rightGroups >>> 16
    const eligible =
      (leftGroups & rightMembership) !== 0 &&
      (rightGroups & leftMembership) !== 0
    const solverEligible =
      (leftSolver & rightMembership) !== 0 &&
      (rightSolver & leftMembership) !== 0
    return {
      eligible,
      sensorIntersection: eligible && this.world.intersectionPair(left, right),
      solverContact: solverEligible && this.hasSolverContact(left, right),
    }
  }

  private hasSolverContact(
    left: RAPIER.Collider,
    right: RAPIER.Collider,
  ): boolean {
    let observed = false
    this.world.contactPair(left, right, (manifold) => {
      observed ||= manifold.numSolverContacts() > 0
    })
    return observed
  }

  private n38Contact(
    left: RAPIER.Collider,
    right: RAPIER.Collider,
  ): { point: Vec3; normal: Vec3; distance: number } | null {
    let result: { point: Vec3; normal: Vec3; distance: number } | null = null
    this.world.contactPair(left, right, (manifold, flipped) => {
      if (manifold.numSolverContacts() === 0) return
      const point = manifold.solverContactPoint(0)
      const normalValue = manifold.localNormal1()
      const rotationValue = left.rotation()
      const worldNormal = new Vector3(
        normalValue.x,
        normalValue.y,
        normalValue.z,
      ).applyQuaternion(
        new Quaternion(
          rotationValue.x,
          rotationValue.y,
          rotationValue.z,
          rotationValue.w,
        ),
      )
      result = {
        point: [point.x, point.y, point.z],
        normal: flipped
          ? [-worldNormal.x, -worldNormal.y, -worldNormal.z]
          : [worldNormal.x, worldNormal.y, worldNormal.z],
        distance: manifold.solverContactDist(0),
      }
    })
    return result
  }

  private isPhysicsBodyId(value: unknown): value is PhysicsBodyId {
    return value === 'claw' || value === 'head' || value === 'prize' || value === 'environment'
  }

  private isN38ColliderRole(value: unknown): value is N38ColliderRole {
    return (
      value === 'environment' ||
      value === 'prize' ||
      value === 'clawBody' ||
      value === 'clawFinger' ||
      value === 'sensor' ||
      value === 'floor' ||
      value === 'wall'
    )
  }

  private stringData(data: Record<string, unknown> | undefined, key: string): string {
    return typeof data?.[key] === 'string' ? data[key] : 'missing'
  }

  private visualEnvelopeOverlaps(claw: Vec3, prize: Vec3, radius: number = this.config.prizeRadius): boolean {
    const extents = this.config.visualEnvelopeHalfExtents
    return (
      Math.abs(claw[0] - prize[0]) <= extents.x + radius &&
      Math.abs(claw[1] - prize[1]) <= extents.y + radius &&
      Math.abs(claw[2] - prize[2]) <= extents.z + radius
    )
  }
}

export function positionsMatch(
  actual: PhysicsTransform,
  expected: PhysicsTransform,
  tolerance: number = N6_PHYSICS_CONFIG.tolerances.repeatPosition,
): boolean {
  return (
    sameVector(actual.position, expected.position, tolerance) &&
    sameQuaternion(actual.quaternion, expected.quaternion, tolerance)
  )
}
