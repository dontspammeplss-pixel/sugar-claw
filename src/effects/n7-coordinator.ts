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
import { ClawPoseAdapter } from '../claw/pose-adapter'
import {
  N6PhysicsAdapter,
  positionsMatch,
  type GripObservation,
  type GripAttempt,
  type PhysicsTransform,
} from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'

export interface N7SceneBindings {
  readonly sceneRoot: Object3D
  readonly clawSystem: Object3D
  readonly clawVisualRoot: Object3D
  readonly prizeRoot: Object3D
}

export interface N7SyncReport {
  readonly claw: PhysicsTransform
  readonly prize: PhysicsTransform
  readonly clawVisualWorldPosition: readonly [number, number, number]
  readonly prizeVisualWorldPosition: readonly [number, number, number]
  readonly clawSynchronized: boolean
  readonly prizeSynchronized: boolean
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
    prizeRoot: findRequired(scene, 'PrizeRoot'),
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
  private alignmentSteps = 0
  private physicsAccumulatorMs = 0
  private gripAttempted = false
  private lastGrip: N7RuntimeReport['grip'] = null
  private lastSync: N7SyncReport | null = null
  private disposed = false
  /** Active kinematic claw travel between two absolute positions. */
  private travel: {
    readonly start: Vec3
    readonly target: Vec3
    readonly durationMs: number
    elapsedMs: number
  } | null = null

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
    this.syncVisuals()
    const assetsReady = this.controller.dispatch({ type: 'assetsReady' })
    if (!assetsReady.accepted) {
      throw new Error(
        `N7 integration: bootstrap assetsReady was rejected from ${assetsReady.snapshot.state}`,
      )
    }
  }

  static async create(scene: Object3D): Promise<N7EffectCoordinator> {
    const bindings = resolveN7SceneBindings(scene)
    const physics = await N6PhysicsAdapter.create()
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
          this.beginLowering(result.snapshot.aim)
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
      if (this.travel) this.advanceTravel(fixedStepMs)
      this.physics.step()
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

  private previewAim(aim: StateSnapshot['aim']): void {
    const target: Vec3 = [
      aim.x * 1.25,
      N6_PHYSICS_CONFIG.clawPosition[1],
      aim.z * 0.35,
    ]
    if (!this.physics.moveClaw(target)) {
      throw new Error(`N7 integration: aim preview target is out of bounds`)
    }
    this.target = target
    this.startTravel(target, TRAVEL_AIM_MS)
  }

  private beginLowering(aim: StateSnapshot['aim']): void {
    const target: Vec3 = [aim.x * 1.25, N6_PHYSICS_CONFIG.gripPosition[1], aim.z * 0.35]
    if (!this.physics.moveClaw(target)) {
      throw new Error(`N7 integration: derived lowering target is out of bounds`)
    }
    this.target = target
    this.alignmentSteps = 0
    this.gripAttempted = false
    this.animator.start('lowered', 0)
    this.startTravel(target, TRAVEL_LOWERING_MS)
  }

  private beginLift(): void {
    const aim = this.snapshot.aim
    const target: Vec3 = [aim.x * 1.25, N6_PHYSICS_CONFIG.liftPosition[1], aim.z * 0.35]
    if (!this.physics.moveClaw(target)) {
      throw new Error(`N7 integration: derived lifting target is out of bounds`)
    }
    this.target = target
    this.startTravel(target, TRAVEL_LIFT_MS)
  }

  private beginReturn(): void {
    const target = N6_PHYSICS_CONFIG.clawPosition
    if (!this.physics.moveClaw(target)) {
      throw new Error(`N7 integration: return target is out of bounds`)
    }
    this.target = target
    this.animator.start('open', 120)
    this.startTravel(target, TRAVEL_RETURN_MS)
  }

  /** Starts kinematic claw travel from the current pose to an absolute target. */
  private startTravel(target: Vec3, durationMs: number): void {
    const start = this.physics.transform('claw').position
    this.travel = { start: [...start] as Vec3, target, durationMs, elapsedMs: 0 }
  }

  /** Advances the active travel by a fixed step; snaps exactly on completion. */
  private advanceTravel(deltaMs: number): void {
    if (!this.travel) return
    if (this.travel.durationMs <= 0) {
      // Degenerate duration: snap to the target exactly instead of dividing.
      this.physics.moveClaw(this.travel.target)
      this.travel = null
      return
    }
    this.travel.elapsedMs += deltaMs
    const t = Math.min(1, this.travel.elapsedMs / this.travel.durationMs)
    const eased = easeInOutCubic(t)
    const position: Vec3 = [
      this.travel.start[0] + (this.travel.target[0] - this.travel.start[0]) * eased,
      this.travel.start[1] + (this.travel.target[1] - this.travel.start[1]) * eased,
      this.travel.start[2] + (this.travel.target[2] - this.travel.start[2]) * eased,
    ]
    const reached = t >= 1
    const next = reached ? this.travel.target : position
    // Interpolation of two in-bounds points stays in-bounds, but snap to the
    // validated target if a degenerate position were ever rejected so travel
    // can never stall silently.
    if (!this.physics.moveClaw(next)) {
      this.physics.moveClaw(this.travel.target)
    }
    if (reached) this.travel = null
  }

  private advanceEffects(): void {
    const state = this.snapshot
    const runId = state.runId

    switch (state.state) {
      case 'lowering':
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
          this.gripAttempted = true
          const outcome: Outcome = {
            accepted: attempt.accepted,
            reason: attempt.reason,
            jointCreated: attempt.jointCreated,
            physicalContact: observation.physicalContact,
            solverContact: observation.solverContact,
            visualOverlap: observation.visualOverlap,
            physicsRunId: attempt.runId,
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
          this.emit({ type: 'returnReached', runId })
        }
        break
      case 'releasing':
        if (!this.animator.state.active) {
          const removedAtRunId = this.physics.releaseGrip()
          const outcome: Outcome = {
            ...(this.snapshot.outcome && typeof this.snapshot.outcome !== 'string'
              ? this.snapshot.outcome
              : {}),
            released: true,
            constraintRemovedAtPhysicsRunId: removedAtRunId,
          }
          this.emit({ type: 'releaseComplete', outcome, runId })
        }
        break
      default:
        break
    }
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
    this.target = null
    this.travel = null
    this.alignmentSteps = 0
    this.physicsAccumulatorMs = 0
    this.gripAttempted = false
    this.lastGrip = null
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
    const prize = this.physics.transform('prize')
    syncObjectToWorldTransform(this.bindings.clawVisualRoot, claw)
    syncObjectToWorldTransform(this.bindings.prizeRoot, prize)
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
    }
  }
}

export interface N7RuntimeProps {
  readonly onReady?: (coordinator: N7EffectCoordinator) => void
  readonly onSnapshot?: (report: N7RuntimeReport) => void
}

const MAX_CATCH_UP_MS = 250
const INITIAL_SIGNATURE = ''
const TRAVEL_AIM_MS = 350
const TRAVEL_LOWERING_MS = 800
const TRAVEL_LIFT_MS = 700
const TRAVEL_RETURN_MS = 700

/** Smoothstep ease so kinematic travel accelerates and decelerates. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

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
        publishRuntimeReport(coordinator.runtimeReport)
        lastSignatureRef.current = reportSignature(coordinator.runtimeReport)
        callbacks.current.onSnapshot?.(coordinator.runtimeReport)
      })
      .catch((error: unknown) => {
        publishRuntimeError(error)
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
    publishRuntimeReport(report)
    callbacks.current.onSnapshot?.(report)
  })

  return null
}

let cachedShell: HTMLElement | null = null

function appShell(): HTMLElement | null {
  if (cachedShell?.isConnected) return cachedShell
  cachedShell = document.querySelector<HTMLElement>('.app-shell')
  return cachedShell
}

function publishRuntimeReport(report: N7RuntimeReport): void {
  const windowWithReport = window as Window & {
    __N7_RUNTIME_REPORT__?: N7RuntimeReport
  }
  windowWithReport.__N7_RUNTIME_REPORT__ = report
  const shell = appShell()
  if (!shell) return
  const sync = report.sync && report.sync.clawSynchronized && report.sync.prizeSynchronized
    ? 'pass'
    : 'pending'
  if (shell.getAttribute('data-n7-state') !== report.state.state) {
    shell.setAttribute('data-n7-state', report.state.state)
  }
  if (shell.getAttribute('data-n7-sync') !== sync) {
    shell.setAttribute('data-n7-sync', sync)
  }
}

function publishRuntimeError(error: unknown): void {
  const shell = document.querySelector<HTMLElement>('.app-shell')
  shell?.setAttribute('data-n7-state', 'error')
  shell?.setAttribute('data-n7-error', errorMessage(error))
}
