import { Quaternion, Vector3 } from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  FINGER_COLLIDERS,
  interactionGroups,
  N6_COLLISION_GROUPS,
  N6_PHYSICS_CONFIG,
  type Vec3,
} from './config'

export type PhysicsBodyId = 'claw' | 'head' | 'prize' | 'environment'
export type PhysicsRunState = 'ready' | 'carrying' | 'released' | 'failed'

export interface PhysicsTransform {
  readonly position: Vec3
  readonly quaternion: readonly [number, number, number, number]
}

export type PhysicsVelocity = Vec3

export interface GripObservation {
  readonly physicalContact: boolean
  readonly solverContact: boolean
  readonly visualOverlap: boolean
  readonly gripApproved: boolean
  readonly claw: PhysicsTransform
  readonly prize: PhysicsTransform
}

export interface PhysicsStepRecord {
  readonly step: number
  readonly runId: number
  readonly claw: PhysicsTransform
  readonly prize: PhysicsTransform
  readonly physicalContact: boolean
  readonly solverContact: boolean
  readonly visualOverlap: boolean
  readonly jointActive: boolean
}

export interface GripAttempt {
  readonly accepted: boolean
  readonly reason: 'contact-approved' | 'no-physical-contact'
  readonly jointCreated: boolean
  readonly runId: number
  readonly constraintCreatedAtRunId: number | null
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
        .setCollisionGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.clawBody,
            N6_COLLISION_GROUPS.environment |
              N6_COLLISION_GROUPS.prize |
              N6_COLLISION_GROUPS.sensor,
          ),
        )
        .setSolverGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.clawBody,
            N6_COLLISION_GROUPS.environment | N6_COLLISION_GROUPS.prize,
          ),
        )
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution),
      this.headBody,
    )

    // N25: one physical capsule per finger at the open-pose pivot transform.
    this.fingerColliders = Object.freeze(
      FINGER_COLLIDERS.map((finger) =>
        this.world.createCollider(
          RAPIER.ColliderDesc.capsule(finger.halfHeight, finger.radius)
            .setTranslation(...finger.position)
            .setRotation(
              rotation(finger.rotation as [number, number, number, number]),
            )
            .setCollisionGroups(
              interactionGroups(
                N6_COLLISION_GROUPS.clawFinger,
                N6_COLLISION_GROUPS.environment | N6_COLLISION_GROUPS.prize,
              ),
            )
            .setSolverGroups(
              interactionGroups(
                N6_COLLISION_GROUPS.clawFinger,
                N6_COLLISION_GROUPS.environment | N6_COLLISION_GROUPS.prize,
              ),
            )
            .setFriction(this.config.friction)
            .setRestitution(this.config.restitution),
          this.headBody,
        ),
      ),
    )

    this.sensorCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(this.config.sensorRadius)
        .setTranslation(
          this.config.sensorOffset.x,
          this.config.sensorOffset.y,
          this.config.sensorOffset.z,
        )
        .setSensor(true)
        .setCollisionGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.sensor,
            N6_COLLISION_GROUPS.prize | N6_COLLISION_GROUPS.clawBody,
          ),
        ),
      this.headBody,
    )

    this.prizeCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(this.config.prizeRadius)
        .setCollisionGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.prize,
            N6_COLLISION_GROUPS.environment |
              N6_COLLISION_GROUPS.clawBody |
              N6_COLLISION_GROUPS.clawFinger |
              N6_COLLISION_GROUPS.sensor,
          ),
        )
        .setSolverGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.prize,
            N6_COLLISION_GROUPS.environment |
              N6_COLLISION_GROUPS.clawBody |
              N6_COLLISION_GROUPS.clawFinger,
          ),
        )
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution),
      this.prizeBody,
    )

    const floorCollider = RAPIER.ColliderDesc.cuboid(
      ...this.config.floorHalfExtents,
    )
      .setTranslation(...this.config.floorPosition)
      .setCollisionGroups(
        interactionGroups(
          N6_COLLISION_GROUPS.environment,
          N6_COLLISION_GROUPS.prize |
            N6_COLLISION_GROUPS.clawBody |
            N6_COLLISION_GROUPS.clawFinger,
        ),
      )
      .setSolverGroups(
        interactionGroups(
          N6_COLLISION_GROUPS.environment,
          N6_COLLISION_GROUPS.prize |
            N6_COLLISION_GROUPS.clawBody |
            N6_COLLISION_GROUPS.clawFinger,
        ),
      )
      .setFriction(this.config.friction)
      .setRestitution(this.config.restitution)
    this.world.createCollider(floorCollider, this.environmentBody)

    // N28: chamber walls contain the prize and stop the claw head at the glass.
    for (const wall of this.config.chamberWalls) {
      const wallCollider = RAPIER.ColliderDesc.cuboid(...wall.halfExtents)
        .setTranslation(...wall.position)
        .setCollisionGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.environment,
            N6_COLLISION_GROUPS.prize |
              N6_COLLISION_GROUPS.clawBody |
              N6_COLLISION_GROUPS.clawFinger,
          ),
        )
        .setSolverGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.environment,
            N6_COLLISION_GROUPS.prize |
              N6_COLLISION_GROUPS.clawBody |
              N6_COLLISION_GROUPS.clawFinger,
          ),
        )
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution)
      this.world.createCollider(wallCollider, this.environmentBody)
    }

    // N26: spherical joint at the head center — pins translation, leaves the
    // head free to rotate. Rapier's spherical impulse joint has no angular
    // limit support (verified empirically: limits fields are ignored), so the
    // head's swing is bounded by pendulum self-righting and its own collider
    // contacts with the prize, floor, and chamber walls.
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
      visualOverlap: observation.visualOverlap,
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

  /** Reports Rapier sensor/solver observations separately from the visual envelope. */
  observeGrip(): GripObservation {
    this.assertNotDisposed()
    const physicalContact = this.world.intersectionPair(
      this.sensorCollider,
      this.prizeCollider,
    )
    // N25: "solver contact" now means any physical claw collider (head proxy
    // or a finger capsule) is touching the prize.
    const clawColliders = [this.headCollider, ...this.fingerColliders]
    let solverContact = false
    for (const collider of clawColliders) {
      this.world.contactPairsWith(collider, (other) => {
        if (other.handle === this.prizeCollider.handle) solverContact = true
      })
      if (solverContact) break
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
      visualOverlap,
      gripApproved: physicalContact,
      claw,
      prize,
    }
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
