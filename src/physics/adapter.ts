import { Quaternion, Vector3 } from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  FINGER_COLLIDERS,
  N6_PHYSICS_CONFIG,
  N37_CANDIDATE_GRIP_PROFILE,
  N38_COLLISION_MATRIX,
  n38CollisionGroups,
  n38SolverGroups,
  type N38CollisionRole,
  type N38PairExpectation,
  type Vec3,
} from './config'
import {
  evaluateGrip,
  type GripCandidateObservation,
  type GripEvaluation,
  type GripProfile,
} from './grip-evaluator'

export type PhysicsBodyId = 'claw' | 'head' | 'prize' | 'environment'
export type PhysicsRunState = 'ready' | 'carrying' | 'released' | 'failed'

export interface PhysicsTransform {
  readonly position: Vec3
  readonly quaternion: readonly [number, number, number, number]
}

export type PhysicsVelocity = Vec3

export interface PhysicsContactFact {
  readonly pair: readonly [PhysicsBodyId, PhysicsBodyId]
  readonly colliderRole: 'head' | 'finger'
  readonly colliderHandle: number
  readonly otherColliderHandle: number
  readonly otherColliderRole: 'prize' | 'floor' | 'wall'
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
}

export interface GripAttempt {
  readonly accepted: boolean
  readonly reason: 'contact-approved' | 'no-physical-contact'
  readonly jointCreated: boolean
  readonly runId: number
  readonly constraintCreatedAtRunId: number | null
}

export interface CandidateGripAttempt {
  readonly evaluation: GripEvaluation
  readonly attempt: GripAttempt
}

export interface N6PhysicsAdapterOptions {
  readonly prizePosition?: Vec3
}

interface BodyBaseline {
  readonly position: Vec3
  readonly quaternion: readonly [number, number, number, number]
  readonly sleeping: boolean
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }
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
  private readonly environmentBody: RAPIER.RigidBody
  private readonly headCollider: RAPIER.Collider
  private readonly fingerColliders: readonly RAPIER.Collider[]
  private readonly prizeCollider: RAPIER.Collider
  private readonly sensorCollider: RAPIER.Collider
  private readonly floorCollider: RAPIER.Collider
  private readonly wallColliders: readonly RAPIER.Collider[]
  private readonly wallColliderHandles: ReadonlySet<number>
  private readonly headJoint: RAPIER.ImpulseJoint
  private readonly baseline: Readonly<Record<PhysicsBodyId, BodyBaseline>>
  private readonly stepRecords: PhysicsStepRecord[] = []
  private carryJoint: RAPIER.ImpulseJoint | null = null
  private constraintRunId: number | null = null
  private stepNumber = 0
  private runId = 0
  private logicalState: PhysicsRunState = 'ready'
  private disposed = false

  private constructor(options: N6PhysicsAdapterOptions = {}) {
    const prizePosition = options.prizePosition ?? this.config.prizePosition
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

    const prizeBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...prizePosition)
      .setLinearDamping(this.config.linearDamping)
      .setAngularDamping(this.config.angularDamping)
      .setCanSleep(this.config.sleeping)
      .setCcdEnabled(this.config.ccd)
    this.prizeBody = this.world.createRigidBody(prizeBodyDesc)
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

    // N25: one physical capsule per finger at the open-pose pivot transform.
    this.fingerColliders = Object.freeze(
      FINGER_COLLIDERS.map((finger) =>
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
        setColliderUserData(collider, {
          logicalBodyId: 'head',
          colliderId: `claw-finger-${index}`,
          role: 'clawFinger',
          sourceRevision: this.config.revision,
          profileRevision: 'n38-authored-finger-rev1',
          colliderProfileId: `claw-finger-${index}`,
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

    this.prizeCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(this.config.prizeRadius)
        .setCollisionGroups(n38CollisionGroups('prize'))
        .setSolverGroups(n38SolverGroups('prize'))
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution),
      this.prizeBody,
    )
    setColliderUserData(this.prizeCollider, {
      logicalBodyId: 'prize',
      colliderId: 'prize-collider',
      role: 'prize',
      sourceRevision: this.config.revision,
      profileRevision: 'n38-authored-prize-rev1',
      colliderProfileId: 'prize-collider',
      derivationRevision: 'authored-profile-rev1',
    })

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

  get carryConstraintActive(): boolean {
    return this.carryJoint !== null
  }

  get logs(): readonly PhysicsStepRecord[] {
    return this.stepRecords.map((record) => ({
      ...record,
      claw: cloneTransform(record.claw),
      prize: cloneTransform(record.prize),
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
          'claw-finger-0',
          'claw-finger-1',
          'claw-finger-2',
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
          'claw-finger-0',
          'claw-finger-1',
          'claw-finger-2',
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

  /** Sets a kinematic target; all bounds and body writes remain adapter-owned. */
  moveClaw(position: Vec3): boolean {
    this.assertNotDisposed()
    const { min, max } = this.config.travelBounds
    const inBounds = position.every(
      (value, index) =>
        value >= min[['x', 'y', 'z'][index] as keyof typeof min] &&
        value <= max[['x', 'y', 'z'][index] as keyof typeof max],
    )
    if (!inBounds) return false
    this.clawBody.setNextKinematicTranslation(vector(position))
    return true
  }

  /** Advances exactly one configured fixed step and records the resulting pose. */
  step(): PhysicsStepRecord {
    this.assertNotDisposed()
    // N26: no self-righting controller is needed — the head is a physical
    // pendulum (its center of mass hangs below the joint pivot, on the sensor
    // and finger colliders), so gravity rights it and angular damping settles
    // it. A torque spring here destabilizes the tiny head body (per-step
    // torque overshoots the upright), so none is applied.
    this.world.step()
    this.stepNumber += 1
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
      jointActive: this.carryJoint !== null,
    }
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
        runId: this.runId,
        constraintCreatedAtRunId: null,
      },
    }
  }

  /** Reports Rapier contact facts separately from visual overlap. */
  observeGrip(): GripObservation {
    this.assertNotDisposed()
    const physicalContact = this.world.intersectionPair(
      this.sensorCollider,
      this.prizeCollider,
    )
    const clawColliders = [this.headCollider, ...this.fingerColliders]
    let solverContact = false
    let floorContact = false
    let barrierContact = false
    const contacts: PhysicsContactFact[] = []
    for (const collider of clawColliders) {
      this.world.contactPairsWith(collider, (other) => {
        const isPrize = other.handle === this.prizeCollider.handle
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
          contacts.push({
            pair: ['claw', pairBody],
            colliderRole:
              collider.handle === this.headCollider.handle ? 'head' : 'finger',
            colliderHandle: collider.handle,
            otherColliderHandle: other.handle,
            otherColliderRole: isPrize ? 'prize' : isFloor ? 'floor' : 'wall',
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
    const visualOverlap = this.visualEnvelopeOverlaps(
      claw.position,
      prize.position,
    )
    return {
      physicalContact,
      solverContact,
      floorContact,
      barrierContact,
      visualOverlap,
      gripApproved: physicalContact,
      claw,
      prize,
      contacts,
    }
  }

  /** Reports the approved physical envelope against the explicit base plane. */
  observeDescent(): DescentObservation {
    this.assertNotDisposed()
    const grip = this.observeGrip()
    const lowestClawPointY = this.lowestPhysicalPointY()
    const basePlaneDistance = lowestClawPointY - this.config.basePlane.y
    const completionReason: DescentCompletionReason = grip.barrierContact
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
    const fingerBottoms = this.fingerColliders.map((collider) => {
      const position = collider.translation()
      const colliderRotation = collider.rotation()
      const quaternion = new Quaternion(
        colliderRotation.x,
        colliderRotation.y,
        colliderRotation.z,
        colliderRotation.w,
      )
      const axis = new Vector3(0, 1, 0).applyQuaternion(quaternion)
      return (
        position.y -
        this.config.fingerCapsuleHalfHeight * Math.abs(axis.y) -
        this.config.fingerCapsuleRadius
      )
    })
    return Math.min(headBottom, ...fingerBottoms)
  }

  /** Creates the approved explicit carry constraint only after contact approval. */
  attemptGrip(): GripAttempt {
    this.assertNotDisposed()
    const observation = this.observeGrip()
    if (!observation.gripApproved) {
      this.logicalState = 'failed'
      return {
        accepted: false,
        reason: 'no-physical-contact',
        jointCreated: false,
        runId: this.runId,
        constraintCreatedAtRunId: null,
      }
    }
    return this.createCarryConstraint()
  }

  private createCarryConstraint(): GripAttempt {
    const createdNow = this.carryJoint === null
    if (createdNow) {
      // N27: the prize is carried from the dynamic head. The anchor is the
      // prize's CURRENT head-local offset (adaptive), so creating the fixed
      // constraint never snaps the prize — the claw may park slightly above
      // the classic grip height after the N26 contact stop.
      const head = this.transform('head')
      const prize = this.transform('prize')
      const headQuat = new Quaternion().fromArray([...head.quaternion])
      const localOffset = new Vector3()
        .fromArray([...prize.position])
        .sub(new Vector3().fromArray([...head.position]))
        .applyQuaternion(headQuat.clone().invert())
      this.carryJoint = this.world.createImpulseJoint(
        RAPIER.JointData.fixed(
          rapierVector(localOffset),
          IDENTITY,
          ZERO,
          IDENTITY,
        ),
        this.headBody,
        this.prizeBody,
        true,
      )
      this.constraintRunId = this.runId
    }
    this.logicalState = 'carrying'
    return {
      accepted: true,
      reason: 'contact-approved',
      jointCreated: createdNow,
      runId: this.runId,
      constraintCreatedAtRunId: createdNow ? this.runId : this.constraintRunId,
    }
  }

  releaseGrip(): number | null {
    this.assertNotDisposed()
    const removedAtRunId = this.carryJoint ? this.runId : null
    if (this.carryJoint) {
      this.world.removeImpulseJoint(this.carryJoint, true)
      this.carryJoint = null
      this.constraintRunId = null
      this.logicalState = 'released'
    }
    return removedAtRunId
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
            ? this.prizeBody
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

  /** Removes the carry joint and restores body, velocity, contact, and logical state. */
  reset(): void {
    this.assertNotDisposed()
    if (this.carryJoint) {
      this.world.removeImpulseJoint(this.carryJoint, true)
      this.carryJoint = null
    }
    this.restoreBaselinePose()
    this.stepNumber = 0
    this.runId += 1
    this.logicalState = 'ready'
    this.stepRecords.length = 0
    this.constraintRunId = null
    this.world.propagateModifiedBodyPositionsToColliders()
    this.world.updateSceneQueries()
    // Rapier's narrow phase is refreshed by a world step; this step is part of
    // reset bookkeeping and is intentionally not exposed as a gameplay step.
    this.world.step()
    this.restoreBaselinePose()
    this.world.propagateModifiedBodyPositionsToColliders()
    this.world.updateSceneQueries()
  }

  /** Idempotent: frees the Rapier world at most once. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.world.free()
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
    this.restoreBody(this.clawBody, this.baseline.claw)
    this.restoreBody(this.headBody, this.baseline.head)
    this.restoreBody(this.prizeBody, this.baseline.prize)
    this.restoreBody(this.environmentBody, this.baseline.environment)
    this.clawBody.setNextKinematicTranslation(
      vector(this.baseline.claw.position),
    )
    this.clawBody.setNextKinematicRotation(
      rotation(this.baseline.claw.quaternion),
    )
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

  private visualEnvelopeOverlaps(claw: Vec3, prize: Vec3): boolean {
    const extents = this.config.visualEnvelopeHalfExtents
    return (
      Math.abs(claw[0] - prize[0]) <= extents.x + this.config.prizeRadius &&
      Math.abs(claw[1] - prize[1]) <= extents.y + this.config.prizeRadius &&
      Math.abs(claw[2] - prize[2]) <= extents.z + this.config.prizeRadius
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
