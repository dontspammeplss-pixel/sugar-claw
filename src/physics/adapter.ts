import RAPIER from '@dimforge/rapier3d-compat'
import {
  interactionGroups,
  N6_COLLISION_GROUPS,
  N6_PHYSICS_CONFIG,
  type Vec3,
} from './config'

export type PhysicsBodyId = 'claw' | 'prize' | 'environment'
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
  const direct = a.every((value, index) => Math.abs(value - b[index]) <= tolerance)
  const negated = a.every((value, index) => Math.abs(value + b[index]) <= tolerance)
  return direct || negated
}

/**
 * The N6 physics authority. It is deliberately headless: a scene adapter may
 * read `transform()` but must not write Rapier bodies or call `world.step()`.
 */
export class N6PhysicsAdapter {
  readonly config = N6_PHYSICS_CONFIG

  private readonly world: RAPIER.World

  private readonly clawBody: RAPIER.RigidBody
  private readonly prizeBody: RAPIER.RigidBody
  private readonly environmentBody: RAPIER.RigidBody
  private readonly clawCollider: RAPIER.Collider
  private readonly prizeCollider: RAPIER.Collider
  private readonly sensorCollider: RAPIER.Collider
  private readonly baseline: Readonly<Record<PhysicsBodyId, BodyBaseline>>
  private readonly stepRecords: PhysicsStepRecord[] = []
  private carryJoint: RAPIER.ImpulseJoint | null = null
  private stepNumber = 0
  private runId = 0
  private logicalState: PhysicsRunState = 'ready'

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

    const prizeBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...prizePosition)
      .setLinearDamping(this.config.linearDamping)
      .setAngularDamping(this.config.angularDamping)
      .setCanSleep(this.config.sleeping)
      .setCcdEnabled(this.config.ccd)
    this.prizeBody = this.world.createRigidBody(prizeBodyDesc)
    this.prizeBody.userData = { id: 'prize', authority: 'N6PhysicsAdapter' }

    this.environmentBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    this.environmentBody.userData = {
      id: 'environment',
      authority: 'N6PhysicsAdapter',
    }

    this.clawCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(...this.config.clawHalfExtents)
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
      this.clawBody,
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
      this.clawBody,
    )

    this.prizeCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(this.config.prizeRadius)
        .setCollisionGroups(
          interactionGroups(
            N6_COLLISION_GROUPS.prize,
            N6_COLLISION_GROUPS.environment |
              N6_COLLISION_GROUPS.clawBody |
              N6_COLLISION_GROUPS.sensor,
          ),
        )
        .setFriction(this.config.friction)
        .setRestitution(this.config.restitution),
      this.prizeBody,
    )

    const floorCollider = RAPIER.ColliderDesc.cuboid(...this.config.floorHalfExtents)
      .setTranslation(...this.config.floorPosition)
      .setCollisionGroups(
        interactionGroups(
          N6_COLLISION_GROUPS.environment,
          N6_COLLISION_GROUPS.prize | N6_COLLISION_GROUPS.clawBody,
        ),
      )
      .setFriction(this.config.friction)
      .setRestitution(this.config.restitution)
    this.world.createCollider(floorCollider, this.environmentBody)

    this.baseline = Object.freeze({
      claw: this.captureBody(this.clawBody),
      prize: this.captureBody(this.prizeBody),
      environment: this.captureBody(this.environmentBody),
    })
  }

  /** Rapier WASM must be initialized once before an adapter can be created. */
  static async create(options: N6PhysicsAdapterOptions = {}): Promise<N6PhysicsAdapter> {
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

  /** Sets a kinematic target; all bounds and body writes remain adapter-owned. */
  moveClaw(position: Vec3): boolean {
    const { min, max } = this.config.travelBounds
    const inBounds = position.every(
      (value, index) => value >= min[['x', 'y', 'z'][index] as keyof typeof min] &&
        value <= max[['x', 'y', 'z'][index] as keyof typeof max],
    )
    if (!inBounds) return false
    this.clawBody.setNextKinematicTranslation(vector(position))
    return true
  }

  /** Advances exactly one configured fixed step and records the resulting pose. */
  step(): PhysicsStepRecord {
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
    return record
  }

  stepMany(count: number): readonly PhysicsStepRecord[] {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('N6PhysicsAdapter.stepMany: count must be a non-negative integer')
    }
    return Array.from({ length: count }, () => this.step())
  }

  /** Reports Rapier sensor/solver observations separately from the visual envelope. */
  observeGrip(): GripObservation {
    const physicalContact = this.world.intersectionPair(
      this.sensorCollider,
      this.prizeCollider,
    )
    let solverContact = false
    this.world.contactPairsWith(this.clawCollider, (collider) => {
      if (collider.handle === this.prizeCollider.handle) solverContact = true
    })
    const claw = this.transform('claw')
    const prize = this.transform('prize')
    const visualOverlap = this.visualEnvelopeOverlaps(claw.position, prize.position)
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
    if (this.carryJoint === null) {
      this.carryJoint = this.world.createImpulseJoint(
        RAPIER.JointData.fixed(
          rapierVector(this.config.sensorOffset),
          IDENTITY,
          ZERO,
          IDENTITY,
        ),
        this.clawBody,
        this.prizeBody,
        true,
      )
    }
    this.logicalState = 'carrying'
    return {
      accepted: true,
      reason: 'contact-approved',
      jointCreated: true,
      runId: this.runId,
      constraintCreatedAtRunId: this.runId,
    }
  }

  releaseGrip(): number | null {
    const removedAtRunId = this.carryJoint ? this.runId : null
    if (this.carryJoint) {
      this.world.removeImpulseJoint(this.carryJoint, true)
      this.carryJoint = null
    }
    this.logicalState = 'released'
    return removedAtRunId
  }

  velocity(body: Exclude<PhysicsBodyId, 'environment'>): PhysicsVelocity {
    const source = body === 'claw' ? this.clawBody : this.prizeBody
    return tuple(source.linvel())
  }

  transform(body: PhysicsBodyId): PhysicsTransform {
    const source =
      body === 'claw'
        ? this.clawBody
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
      quaternion: [...this.baseline[body].quaternion] as [number, number, number, number],
    }
  }

  /** Removes the carry joint and restores body, velocity, contact, and logical state. */
  reset(): void {
    if (this.carryJoint) {
      this.world.removeImpulseJoint(this.carryJoint, true)
      this.carryJoint = null
    }
    this.restoreBody(this.clawBody, this.baseline.claw)
    this.restoreBody(this.prizeBody, this.baseline.prize)
    this.restoreBody(this.environmentBody, this.baseline.environment)
    this.clawBody.setNextKinematicTranslation(vector(this.baseline.claw.position))
    this.clawBody.setNextKinematicRotation(rotation(this.baseline.claw.quaternion))
    this.stepNumber = 0
    this.runId += 1
    this.logicalState = 'ready'
    this.stepRecords.length = 0
    this.world.propagateModifiedBodyPositionsToColliders()
    this.world.updateSceneQueries()
    // Rapier's narrow phase is refreshed by a world step; this step is part of
    // reset bookkeeping and is intentionally not exposed as a gameplay step.
    this.world.step()
    this.restoreBody(this.clawBody, this.baseline.claw)
    this.restoreBody(this.prizeBody, this.baseline.prize)
    this.restoreBody(this.environmentBody, this.baseline.environment)
    this.clawBody.setNextKinematicTranslation(vector(this.baseline.claw.position))
    this.clawBody.setNextKinematicRotation(rotation(this.baseline.claw.quaternion))
    this.world.propagateModifiedBodyPositionsToColliders()
    this.world.updateSceneQueries()
  }

  dispose(): void {
    this.world.free()
  }

  private captureBody(body: RAPIER.RigidBody): BodyBaseline {
    return {
      position: tuple(body.translation()),
      quaternion: quaternionTuple(body.rotation()),
      sleeping: body.isSleeping(),
    }
  }

  private restoreBody(body: RAPIER.RigidBody, baseline: BodyBaseline): void {
    body.setTranslation(vector(baseline.position), true)
    if (body.isKinematic()) body.setNextKinematicRotation(rotation(baseline.quaternion))
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
