import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Quaternion, Vector3, type Object3D } from 'three'
import type {
  Command,
  ControllerAction,
  DispatchResult,
  Outcome,
  StateSnapshot,
} from '../state/controller'
import { createStateController, type StateController } from '../state/controller'
import { createClawPoseAnimator, type ClawPoseAnimator } from '../animation/pose-animation'
import {
  createClawTravelAnimator,
  type ClawTravelAnimator,
} from '../animation/travel-animator'
import { ClawPoseAdapter } from '../claw/pose-adapter'
import {
  N6PhysicsAdapter,
  positionsMatch,
  type GripObservation,
  type GripAttempt,
  type PhysicsTransform,
  type DescentObservation,
  type RetentionState,
  type RetentionReleaseEvent,
  type DeliveryObservation,
  type PayoutHookEvent,
  type N6PhysicsAdapterOptions,
  type PrizePlayfieldSnapshot,
} from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'
import { DEFAULT_PRIZE_MANIFEST } from '../playfield/prize-manifest'
import {
  errorMessage,
  publishN7RuntimeError,
  publishN7RuntimeReport,
} from '../evidence/publish'

export interface N7SceneBindings {
  readonly sceneRoot: Object3D
  readonly clawSystem: Object3D
  readonly clawVisualRoot: Object3D
  readonly headVisualRoot: Object3D
  readonly prizeRoot: Object3D
  readonly prizeRoots: ReadonlyMap<string, Object3D>
}

export interface N7SyncReport {
  readonly claw: PhysicsTransform
  readonly prize: PhysicsTransform
  readonly clawVisualWorldPosition: readonly [number, number, number]
  readonly prizeVisualWorldPosition: readonly [number, number, number]
  readonly clawSynchronized: boolean
  readonly prizeSynchronized: boolean
  readonly playfield: PrizePlayfieldSnapshot
}

export type N7Completion = Extract<
  ControllerAction,
  {
    readonly type:
      | 'poseReached'
      | 'alignmentSettled'
      | 'gripEvaluated'
      | 'liftReached'
      | 'returnReached'
      | 'releaseComplete'
  }
>

export interface N7Countdown {
  readonly durationSteps: number
  readonly remainingSteps: number
  readonly resetCount: number
  readonly lastResetRunId: number | null
}

export interface N7RuntimeReport {
  readonly node: 'N7'
  readonly baseline: 'gate-2-n3-approved + gate-3-n4-approved + gate-4-n5-approved + gate-5-n6-approved'
  readonly deterministic: true
  readonly state: StateSnapshot
  readonly physicsRunId: number
  readonly sync: N7SyncReport | null
  readonly grip: {
    readonly observation: GripObservation
    readonly attempt: GripAttempt
  } | null
  readonly retention: RetentionState
  readonly retentionRelease: RetentionReleaseEvent | null
  readonly delivery: DeliveryObservation | null
  readonly payoutHook: PayoutHookEvent | null
  readonly countdown: N7Countdown
  readonly descent: DescentObservation | null
  readonly ownership: {
    readonly controllerOwnsState: true
    readonly physicsOwnsBodies: true
    readonly poseOwnsFingerPresentation: true
    readonly coordinatorOwnsCompletionEvents: true
    readonly gsapMovesAuthoritativeBodies: false
  }
}

function tuple(vector: Vector3): readonly [number, number, number] {
  return vector.toArray() as readonly [number, number, number]
}

function quaternionTuple(
  quaternion: Quaternion,
): readonly [number, number, number, number] {
  return quaternion.toArray() as readonly [number, number, number, number]
}

function findRequired(root: Object3D, name: string): Object3D {
  const object = root.getObjectByName(name)
  if (!object) throw new Error(`N7 integration: missing scene object ${name}`)
  return object
}

export function resolveN7SceneBindings(scene: Object3D): N7SceneBindings {
  return {
    sceneRoot: findRequired(scene, 'SceneRoot'),
    clawSystem: findRequired(scene, 'ClawSystem'),
    clawVisualRoot: findRequired(scene, 'ClawVisualRoot'),
    headVisualRoot: findRequired(scene, 'HeadRoot'),
    prizeRoot: findRequired(scene, 'PrizeRoot'),
    prizeRoots: new Map(
      DEFAULT_PRIZE_MANIFEST.prizes.flatMap((prize) => {
        const object = scene.getObjectByName(
          prize.id === 'prize' ? 'PrizeRoot' : `PrizeRoot-${prize.id}`,
        )
        return object ? [[prize.id, object] as const] : []
      }),
    ),
  }
}

function syncObjectToWorldTransform(
  object: Object3D,
  worldTransform: PhysicsTransform,
): void {
  const parent = object.parent
  if (!parent) throw new Error(`N7 integration: ${object.name} has no parent`)

  parent.updateWorldMatrix(true, false)
  const worldPosition = new Vector3().fromArray([...worldTransform.position])
  object.position.copy(parent.worldToLocal(worldPosition))
  const parentWorldQuaternion = parent.getWorldQuaternion(new Quaternion())
  const worldQuaternion = new Quaternion().fromArray([
    ...worldTransform.quaternion,
  ])
  object.quaternion.copy(parentWorldQuaternion.invert().multiply(worldQuaternion))
}

export class N7EffectCoordinator {
  readonly controller: StateController
  readonly bindings: N7SceneBindings
  readonly physics: N6PhysicsAdapter
  readonly pose: ClawPoseAdapter
  readonly animator: ClawPoseAnimator

  private target: Vec3 | null = null
  private returnLeg: 'traverse' | 'descent' | null = null
  /** N23: velocity glide while aiming (joystick). Null when not gliding. */
  private glideVelocity: { readonly x: number; readonly z: number } | null = null
  private alignmentSteps = 0
  private physicsAccumulatorMs = 0
  private gripAttempted = false
  /** Whether the releasing-state open animation has started this run. */
  private releaseOpened = false
  private releaseCompleted = false
  private deliveryWaitSteps = 0
  private lastGrip: N7RuntimeReport['grip'] = null
  private lastDelivery: DeliveryObservation | null = null
  private pendingReleaseOutcome: Outcome | null = null
  private lastRetentionRelease: RetentionReleaseEvent | null = null
  private lastDescent: DescentObservation | null = null
  private lastSync: N7SyncReport | null = null
  private countdownRemainingSteps = PLAY_COUNTDOWN_STEPS
  private countdownResetCount = 0
  private countdownLastResetRunId: number | null = null
  private disposed = false
  /** Kinematic claw travel between two absolute positions (see travel-animator). */
  private readonly travel: ClawTravelAnimator = createClawTravelAnimator()

  private constructor(
    bindings: N7SceneBindings,
    physics: N6PhysicsAdapter,
    controller = createStateController(),
  ) {
    this.bindings = bindings
    this.physics = physics
    // The controller starts at epoch 1; establish the same epoch in Rapier
    // before any gameplay event can be emitted. Reset is the adapter's
    // explicit baseline operation, not a visual inverse animation.
    this.physics.reset()
    this.controller = controller
    this.pose = new ClawPoseAdapter(bindings.clawVisualRoot)
    this.animator = createClawPoseAnimator(this.pose)

    this.pose.restoreBaseline()
    // Parked-open presentation (classic arcade rest pose) layered on the
    // restored baseline rig transforms.
    this.pose.applyPoseTarget('open')
    this.syncVisuals()
    const assetsReady = this.controller.dispatch({ type: 'assetsReady' })
    if (!assetsReady.accepted) {
      throw new Error(
        `N7 integration: bootstrap assetsReady was rejected from ${assetsReady.snapshot.state}`,
      )
    }
  }

  static async create(
    scene: Object3D,
    physicsOptions: N6PhysicsAdapterOptions = {},
  ): Promise<N7EffectCoordinator> {
    const bindings = resolveN7SceneBindings(scene)
    const physics = await N6PhysicsAdapter.create({
      ...physicsOptions,
      prizeManifest:
        physicsOptions.prizeManifest ??
        (typeof window === 'undefined' ? undefined : DEFAULT_PRIZE_MANIFEST),
      persistPrizeState:
        physicsOptions.persistPrizeState ?? typeof window !== 'undefined',
    })
    try {
      return new N7EffectCoordinator(bindings, physics)
    } catch (error) {
      physics.dispose()
      throw error
    }
  }

  get snapshot(): StateSnapshot {
    return this.controller.snapshot()
  }

  get runtimeReport(): N7RuntimeReport {
    return {
      node: 'N7',
      baseline:
        'gate-2-n3-approved + gate-3-n4-approved + gate-4-n5-approved + gate-5-n6-approved',
      deterministic: true,
      state: this.snapshot,
      physicsRunId: this.physics.currentRunId,
      sync: this.lastSync,
      grip: this.lastGrip,
      retention: this.physics.retention,
      retentionRelease: this.lastRetentionRelease ?? this.physics.retentionRelease,
      delivery: this.lastDelivery ?? this.physics.delivery,
      payoutHook: this.physics.payoutHookEvent,
      countdown: {
        durationSteps: PLAY_COUNTDOWN_STEPS,
        remainingSteps: this.countdownRemainingSteps,
        resetCount: this.countdownResetCount,
        lastResetRunId: this.countdownLastResetRunId,
      },
      descent: this.lastDescent,
      ownership: {
        controllerOwnsState: true,
        physicsOwnsBodies: true,
        poseOwnsFingerPresentation: true,
        coordinatorOwnsCompletionEvents: true,
        gsapMovesAuthoritativeBodies: false,
      },
    }
  }

  dispatch(command: Command): DispatchResult {
    if (this.disposed) {
      throw new Error('N7 integration: coordinator is disposed')
    }

    const result = this.controller.dispatch(command)
    if (!result.accepted) return result

    try {
      switch (command.type) {
        case 'moveAim':
          if (result.snapshot.state === 'aiming') {
            this.previewAim(result.snapshot.aim)
          }
          break
        case 'confirmDrop':
          this.beginLowering()
          break
        case 'requestReset':
          this.resetTransaction()
          break
        default:
          break
      }
    } catch (error) {
      // Side effects failed after the command was accepted; return the
      // controller's post-failure snapshot instead of the stale pre-failure one.
      return this.emitInvariantFailure(error)
    }
    return result
  }

  /** Routes a coordinator callback through the controller, including stale epochs. */
  dispatchCompletion(action: N7Completion): DispatchResult {
    if (this.disposed) {
      throw new Error('N7 integration: coordinator is disposed')
    }
    return this.controller.dispatch(action)
  }

  /** Advances Rapier through an accumulator; every world step uses N6's fixed dt. */
  tick(deltaMs = 1000 / 60): N7RuntimeReport {
    if (this.disposed) return this.runtimeReport
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      this.emitInvariantFailure(new Error('N7 integration: deltaMs must be finite and non-negative'))
      return this.runtimeReport
    }
    if (!this.epochsMatch()) {
      this.emitInvariantFailure(
        new Error(
          `N7 integration: controller run ${this.snapshot.runId} disagrees with physics run ${this.physics.currentRunId}`,
        ),
      )
      return this.runtimeReport
    }

    const fixedStepMs = this.physics.config.dt * 1000
    if (!Number.isFinite(fixedStepMs) || fixedStepMs <= 0) {
      this.emitInvariantFailure(
        new Error('N7 integration: configured fixed step must be positive and finite'),
      )
      return this.runtimeReport
    }
    // Bound the catch-up window so a long frame (tab switch, hiccup) cannot
    // spiral into unbounded stepping. Excess time is discarded while every
    // executed step still uses the deterministic fixed dt.
    this.physicsAccumulatorMs = Math.min(
      this.physicsAccumulatorMs + deltaMs,
      MAX_CATCH_UP_MS,
    )
    const maxStepsPerTick = Math.floor(MAX_CATCH_UP_MS / fixedStepMs)
    let stepsThisTick = 0
    while (
      this.physicsAccumulatorMs >= fixedStepMs &&
      stepsThisTick < maxStepsPerTick
    ) {
      this.physicsAccumulatorMs -= fixedStepMs
      stepsThisTick += 1
      if (this.travel.state.active) {
        const next = this.travel.advance(fixedStepMs)
        if (next && !this.physics.moveClaw(next)) {
          // Interpolation of two in-bounds points stays in-bounds, but snap
          // to the validated target if a degenerate position were ever
          // rejected so travel can never stall silently.
          this.physics.moveClaw(this.target!)
        }
      } else if (this.glideVelocity) {
        if (this.snapshot.state === 'aiming') {
          this.applyGlide(fixedStepMs)
        } else {
          // The sequence left aim space (e.g. Drop landed); stop the glide.
          this.glideVelocity = null
        }
      }
      this.physics.step()
      if (this.physics.delivery) {
        this.lastDelivery = this.physics.delivery
      }
      if (this.snapshot.state !== 'result') {
        this.countdownRemainingSteps = Math.max(0, this.countdownRemainingSteps - 1)
      }
      if (this.physics.retentionRelease) {
        this.lastRetentionRelease = this.physics.retentionRelease
      }
      if (this.animator.state.active) this.animator.advance(fixedStepMs)
      this.syncVisuals()

      try {
        this.advanceEffects()
      } catch (error) {
        this.emitInvariantFailure(error)
        break
      }
    }
    return this.runtimeReport
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.animator.cancel()
    this.physics.dispose()
  }

  /**
   * N23: velocity glide. Deflection maps to a glide speed along X/Z; the claw
   * keeps moving at that speed (clamped to travel bounds) while aiming. This
   * replaces the fixed-duration aim tween so the joystick feels continuous.
   */
  private previewAim(aim: StateSnapshot['aim']): void {
    this.glideVelocity = {
      x: aim.x * GLIDE_SPEED_X,
      z: aim.z * GLIDE_SPEED_Z,
    }
    this.travel.cancel()
  }

  private applyGlide(deltaMs: number): void {
    if (!this.glideVelocity) return
    const current = this.physics.transform('claw').position
    const dtSeconds = deltaMs / 1000
    const { min, max } = this.physics.config.travelBounds
    // Clamp per axis so hitting one travel bound does not freeze the free
    // axis: a diagonal full-deflection keeps sliding along the edge.
    const next: Vec3 = [
      Math.min(max.x, Math.max(min.x, current[0] + this.glideVelocity.x * dtSeconds)),
      current[1],
      Math.min(max.z, Math.max(min.z, current[2] + this.glideVelocity.z * dtSeconds)),
    ]
    if (this.physics.moveClaw(next)) this.target = next
  }

  private beginLowering(): void {
    // N23: the joystick moves the claw directly (velocity glide), so the claw
    // drops straight down from its current position — never toward an
    // aim-derived position. The stick deflection is velocity, not position;
    // releasing it must not recenter the drop target.
    const current = this.physics.transform('claw').position
    const target: Vec3 = [
      current[0],
      N6_PHYSICS_CONFIG.clawClearance.baseInteractionY,
      current[2],
    ]
    if (!this.physics.moveClaw(target)) {
      throw new Error(`N7 integration: derived lowering target is out of bounds`)
    }
    this.target = target
    this.glideVelocity = null
    this.alignmentSteps = 0
    this.gripAttempted = false
    this.releaseOpened = false
    // Classic arcade: descend with fingers open.
    this.animator.start('open', 0)
    this.travel.start(this.physics.transform('claw').position, target, TRAVEL_LOWERING_MS)
  }

  private beginLift(): void {
    // N23: lift straight up from wherever the grip happened.
    const current = this.physics.transform('claw').position
    const target: Vec3 = [current[0], N6_PHYSICS_CONFIG.liftPosition[1], current[2]]
    if (!this.physics.moveClaw(target)) {
      throw new Error(`N7 integration: derived lifting target is out of bounds`)
    }
    this.target = target
    this.travel.start(this.physics.transform('claw').position, target, TRAVEL_LIFT_MS)
  }

  private beginReturn(): void {
    const target = N6_PHYSICS_CONFIG.chute.overPosition
    if (!this.physics.moveClaw(target)) {
      throw new Error(`N7 integration: return traverse target is out of bounds`)
    }
    this.target = target
    this.returnLeg = 'traverse'
    // Classic arcade: keep fingers closed while carrying the prize home; the
    // open (release) pose happens in the releasing state, not during return.
    this.travel.start(
      this.physics.transform('claw').position,
      target,
      TRAVEL_RETURN_TRAVERSE_MS,
    )
  }

  private advanceEffects(): void {
    const state = this.snapshot
    const runId = state.runId

    switch (state.state) {
      case 'lowering': {
        const descent = this.physics.observeDescent()
        this.lastDescent = descent
        // N36: object contact is observed but does not terminate a base-first
        // descent. Only a physical floor/wall barrier or approved base
        // clearance can normalize lowering completion.
        if (descent.completionReason === 'barrier-contact') {
          this.travel.cancel()
          this.target = this.physics.transform('claw').position
        } else if (
          descent.completionReason === 'base-clearance' &&
          Math.abs(descent.basePlaneDistance) <=
            N6_PHYSICS_CONFIG.clawClearance.tolerance
        ) {
          this.travel.cancel()
          this.target = this.physics.transform('claw').position
        }
        if (
          this.target &&
          positionsMatch(
            this.physics.transform('claw'),
            { position: this.target, quaternion: this.physics.transform('claw').quaternion },
            N6_PHYSICS_CONFIG.tolerances.travel,
          ) &&
          !this.animator.state.active
        ) {
          this.emit({ type: 'poseReached', pose: 'lowered', runId })
        }
        break
      }
      case 'aligning':
        this.alignmentSteps += 1
        if (this.alignmentSteps >= 3) {
          this.animator.start('closed', 120)
          this.emit({ type: 'alignmentSettled', runId })
        }
        break
      case 'gripping':
        if (!this.gripAttempted && !this.animator.state.active) {
          const observation = this.physics.observeGrip()
          const attempt = this.physics.attemptGrip()
          this.lastGrip = { observation, attempt }
          this.lastRetentionRelease = null
          this.gripAttempted = true
          const outcome: Outcome = {
            accepted: attempt.accepted,
            reason: attempt.reason,
            jointCreated: attempt.jointCreated,
            holdStarted: attempt.holdStarted,
            physicalContact: observation.physicalContact,
            solverContact: observation.solverContact,
            visualOverlap: observation.visualOverlap,
            physicsRunId: attempt.runId,
            retention: this.physics.retention,
          }
          this.emit({ type: 'gripEvaluated', outcome, runId })
          this.beginLift()
        }
        break
      case 'lifting':
        if (
          this.target &&
          positionsMatch(
            this.physics.transform('claw'),
            { position: this.target, quaternion: this.physics.transform('claw').quaternion },
            N6_PHYSICS_CONFIG.tolerances.travel,
          )
        ) {
          this.emit({ type: 'liftReached', runId })
          this.beginReturn()
        }
        break
      case 'returning':
        if (
          this.target &&
          positionsMatch(
            this.physics.transform('claw'),
            { position: this.target, quaternion: this.physics.transform('claw').quaternion },
            N6_PHYSICS_CONFIG.tolerances.travel,
          )
        ) {
          if (this.returnLeg === 'traverse') {
            const descentTarget = N6_PHYSICS_CONFIG.chute.releasePosition
            if (!this.physics.moveClaw(descentTarget)) {
              throw new Error(`N7 integration: return descent target is out of bounds`)
            }
            this.target = descentTarget
            this.returnLeg = 'descent'
            this.travel.start(
              this.physics.transform('claw').position,
              descentTarget,
              TRAVEL_RETURN_DESCENT_MS,
            )
          } else if (this.returnLeg === 'descent') {
            this.emit({ type: 'returnReached', runId })
          }
        }
        break
      case 'releasing':
        // Delivery, not grip approval, decides the result. Open first, release
        // the hold, then allow a short fixed-step fall-through window for the
        // prize to cross the chute sensor.
        if (!this.releaseOpened) {
          this.releaseOpened = true
          this.animator.start('open', RELEASE_OPEN_MS)
        } else if (!this.releaseCompleted && !this.animator.state.active) {
          const removedAtRunId = this.physics.releaseGrip()
          this.releaseCompleted = true
          this.deliveryWaitSteps = 0
          const outcome: Outcome = {
            ...(this.snapshot.outcome && typeof this.snapshot.outcome !== 'string'
              ? this.snapshot.outcome
              : {}),
            released: true,
            constraintRemovedAtPhysicsRunId: removedAtRunId,
            reason:
              this.lastRetentionRelease?.state === 'released'
                ? 'it slipped!'
                : 'released',
            retention: this.physics.retention,
            retentionRelease: this.lastRetentionRelease ?? this.physics.retentionRelease,
          }
          if (this.lastDelivery?.runId === runId) {
            this.completeDelivery(outcome, runId)
          } else {
            this.pendingReleaseOutcome = outcome
          }
        } else if (this.releaseCompleted) {
          if (this.lastDelivery?.runId === runId) {
            this.completeDelivery(this.pendingReleaseOutcome ?? {}, runId)
          } else if (++this.deliveryWaitSteps >= DELIVERY_WAIT_STEPS) {
            this.emit({
              type: 'releaseComplete',
              outcome: {
                ...(this.pendingReleaseOutcome &&
                typeof this.pendingReleaseOutcome !== 'string'
                  ? this.pendingReleaseOutcome
                  : {}),
                accepted: false,
                reason: 'not-delivered',
              },
              runId,
            })
          }
        }
        break
      default:
        break
    }
  }

  private completeDelivery(outcome: Outcome, runId: number): void {
    if (!this.lastDelivery || this.lastDelivery.runId !== runId) {
      throw new Error('N42 win-not-delivered: delivery evidence missing for active run')
    }
    this.countdownRemainingSteps = PLAY_COUNTDOWN_STEPS
    this.countdownResetCount += 1
    this.countdownLastResetRunId = runId
    this.emit({
      type: 'releaseComplete',
      outcome: {
        ...(outcome && typeof outcome !== 'string' ? outcome : {}),
        accepted: true,
        reason: 'delivered',
        delivery: this.lastDelivery,
        payoutHook: this.physics.payoutHookEvent,
      },
      runId,
    })
  }

  private emit(action: N7Completion): void {
    if (!this.epochsMatch()) {
      throw new Error(
        `N7 integration: normalized event ${action.type} has no synchronized run epoch`,
      )
    }
    const result = this.dispatchCompletion(action)
    if (!result.accepted) {
      throw new Error(
        `N7 integration: normalized event ${action.type} was rejected from ${result.snapshot.state}`,
      )
    }
  }

  private resetTransaction(): void {
    this.animator.cancel()
    this.physics.reset()
    this.pose.restoreBaseline()
    // Parked-open presentation after every reset.
    this.pose.applyPoseTarget('open')
    this.target = null
    this.returnLeg = null
    this.glideVelocity = null
    this.travel.cancel()
    this.alignmentSteps = 0
    this.physicsAccumulatorMs = 0
    this.gripAttempted = false
    this.releaseOpened = false
    this.releaseCompleted = false
    this.deliveryWaitSteps = 0
    this.pendingReleaseOutcome = null
    this.lastGrip = null
    this.lastDelivery = null
    this.lastRetentionRelease = null
    this.lastDescent = null
    this.countdownRemainingSteps = PLAY_COUNTDOWN_STEPS
    this.countdownResetCount = 0
    this.countdownLastResetRunId = null
    this.syncVisuals()
    const runId = this.snapshot.runId
    const baselineRestored = this.controller.dispatch({
      type: 'baselineRestored',
      status: 'ready',
      runId,
    })
    if (!baselineRestored.accepted) {
      throw new Error(
        `N7 integration: baselineRestored was rejected from ${baselineRestored.snapshot.state}`,
      )
    }
  }

  private epochsMatch(): boolean {
    return this.physics.currentRunId === this.snapshot.runId
  }

  private emitInvariantFailure(error: unknown): DispatchResult {
    const state = this.snapshot
    if (state.state === 'resetting') {
      return this.controller.dispatch({
        type: 'resetFailed',
        error: errorMessage(error),
        runId: state.runId,
      })
    }
    return this.controller.dispatch({
      type: 'invariantFailure',
      error: errorMessage(error),
      runId: state.runId,
    })
  }

  private syncVisuals(): void {
    const claw = this.physics.transform('claw')
    const head = this.physics.transform('head')
    const prize = this.physics.transform('prize')
    syncObjectToWorldTransform(this.bindings.clawVisualRoot, claw)
    // N26: the head hangs and tilts on its own dynamic body; drive the visual
    // HeadRoot from the head transform relative to the synced carriage root.
    syncObjectToWorldTransform(this.bindings.headVisualRoot, head)
    syncObjectToWorldTransform(this.bindings.prizeRoot, prize)
    this.bindings.prizeRoot.visible = !this.physics.playfield.prizes.find(
      (entry) => entry.id === 'prize',
    )?.removed
    for (const entry of this.physics.playfield.prizes) {
      const root = this.bindings.prizeRoots.get(entry.id)
      if (!root) continue
      syncObjectToWorldTransform(root, this.physics.transformPrize(entry.id))
      root.visible = !entry.removed
    }
    this.bindings.sceneRoot.updateWorldMatrix(true, true)

    const clawVisualPosition = tuple(
      this.bindings.clawVisualRoot.getWorldPosition(new Vector3()),
    )
    const prizeVisualPosition = tuple(
      this.bindings.prizeRoot.getWorldPosition(new Vector3()),
    )
    const clawVisualTransform: PhysicsTransform = {
      position: clawVisualPosition,
      quaternion: quaternionTuple(
        this.bindings.clawVisualRoot.getWorldQuaternion(new Quaternion()),
      ),
    }
    const prizeVisualTransform: PhysicsTransform = {
      position: prizeVisualPosition,
      quaternion: quaternionTuple(
        this.bindings.prizeRoot.getWorldQuaternion(new Quaternion()),
      ),
    }
    this.lastSync = {
      claw,
      prize,
      clawVisualWorldPosition: clawVisualPosition,
      prizeVisualWorldPosition: prizeVisualPosition,
      clawSynchronized: positionsMatch(
        clawVisualTransform,
        claw,
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
      ),
      prizeSynchronized: positionsMatch(
        prizeVisualTransform,
        prize,
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
      ),
      playfield: this.physics.playfield,
    }
  }
}

export interface N7RuntimeProps {
  readonly onReady?: (coordinator: N7EffectCoordinator) => void
  readonly onSnapshot?: (report: N7RuntimeReport) => void
}

const MAX_CATCH_UP_MS = 250
/** How long the releasing-state finger-open animation runs before release. */
const RELEASE_OPEN_MS = 250
const DELIVERY_WAIT_STEPS = 30
const PLAY_COUNTDOWN_STEPS = 1800
const INITIAL_SIGNATURE = ''
/** N23: full-deflection glide speeds (units/second) in aim space. */
const GLIDE_SPEED_X = 1.8
const GLIDE_SPEED_Z = 0.9
const TRAVEL_LOWERING_MS = 800
const TRAVEL_LIFT_MS = 700
/** N42.1: preserve the 700ms return budget across top traverse + descent. */
const TRAVEL_RETURN_TRAVERSE_MS = 450
const TRAVEL_RETURN_DESCENT_MS = 250

export function reportSignature(report: N7RuntimeReport): string {
  return [
    report.state.state,
    report.state.runId,
    report.state.aim.x,
    report.state.aim.z,
    report.physicsRunId,
    report.sync?.clawSynchronized === true,
    report.sync?.prizeSynchronized === true,
    JSON.stringify(report.state.outcome ?? null),
    report.retention.status,
    report.retention.margin,
    JSON.stringify(report.retentionRelease),
    JSON.stringify(report.delivery),
    JSON.stringify(report.payoutHook),
    JSON.stringify(report.countdown),
  ].join('|')
}

export function N7Runtime({ onReady, onSnapshot }: N7RuntimeProps) {
  const coordinatorRef = useRef<N7EffectCoordinator | null>(null)
  const callbacks = useRef({ onReady, onSnapshot })
  const lastSignatureRef = useRef(INITIAL_SIGNATURE)
  callbacks.current = { onReady, onSnapshot }
  const { scene } = useThree()

  useEffect(() => {
    let cancelled = false
    let pending: N7EffectCoordinator | null = null

    void N7EffectCoordinator.create(scene)
      .then((coordinator) => {
        if (cancelled) {
          coordinator.dispose()
          return
        }
        pending = coordinator
        coordinatorRef.current = coordinator
        callbacks.current.onReady?.(coordinator)
        publishN7RuntimeReport(coordinator.runtimeReport)
        lastSignatureRef.current = reportSignature(coordinator.runtimeReport)
        callbacks.current.onSnapshot?.(coordinator.runtimeReport)
      })
      .catch((error: unknown) => {
        publishN7RuntimeError(error)
      })

    return () => {
      cancelled = true
      pending?.dispose()
      pending = null
      coordinatorRef.current = null
    }
  }, [scene])

  useFrame((_, delta) => {
    const coordinator = coordinatorRef.current
    if (!coordinator) return
    const report = coordinator.tick(delta * 1000)
    const signature = reportSignature(report)
    if (signature === lastSignatureRef.current) return
    lastSignatureRef.current = signature
    publishN7RuntimeReport(report)
    callbacks.current.onSnapshot?.(report)
  })

  return null
}
