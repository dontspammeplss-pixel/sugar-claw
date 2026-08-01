import { describe, expect, it } from 'vitest'
import { Group } from 'three'
import { DEFAULT_CLAW_RIG, PIVOT_NAMES } from '../claw/rig'
import {
  N7EffectCoordinator,
  resolveN7SceneBindings,
} from '../effects/n7-coordinator'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createN7Evidence } from './n7-evidence'

function createFixture(): Group {
  const sceneRoot = new Group()
  sceneRoot.name = 'SceneRoot'

  const clawSystem = new Group()
  clawSystem.name = 'ClawSystem'
  clawSystem.position.set(0, 2.85, 0.1)
  sceneRoot.add(clawSystem)

  const clawVisualRoot = new Group()
  clawVisualRoot.name = 'ClawVisualRoot'
  clawSystem.add(clawVisualRoot)
  const fingerRig = new Group()
  fingerRig.name = 'FingerRig'
  clawVisualRoot.add(fingerRig)
  for (const name of PIVOT_NAMES) {
    const pivot = new Group()
    pivot.name = name
    pivot.position.fromArray([...DEFAULT_CLAW_RIG.baseline[name].position])
    pivot.quaternion.fromArray([...DEFAULT_CLAW_RIG.baseline[name].quaternion])
    fingerRig.add(pivot)
  }

  const prizeRoot = new Group()
  prizeRoot.name = 'PrizeRoot'
  sceneRoot.add(prizeRoot)
  return sceneRoot
}

function tickUntilResult(coordinator: N7EffectCoordinator): void {
  for (let tick = 0; tick < 180; tick += 1) {
    coordinator.tick(1000 / 60)
    if (coordinator.snapshot.state === 'result') return
  }
  throw new Error('N7 test: coordinator did not reach result')
}

describe('N7 integrated effect coordinator', () => {
  it('resolves only the approved scene bindings', () => {
    const scene = createFixture()
    const bindings = resolveN7SceneBindings(scene)
    expect(bindings.sceneRoot).toBe(scene)
    expect(bindings.clawSystem.name).toBe('ClawSystem')
    expect(bindings.clawVisualRoot.name).toBe('ClawVisualRoot')
    expect(bindings.prizeRoot.name).toBe('PrizeRoot')
  })

  it('drives commands through the controller and completes the physical run', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      expect(coordinator.snapshot.state).toBe('ready')
      expect(coordinator.dispatch({ type: 'beginAim' }).accepted).toBe(true)
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.2 })
      coordinator.dispatch({ type: 'moveAim', axis: 'z', value: -0.2 })
      const drop = coordinator.dispatch({ type: 'confirmDrop' })
      expect(drop.snapshot.state).toBe('lowering')

      tickUntilResult(coordinator)
      const report = coordinator.runtimeReport
      expect(report.state.state).toBe('result')
      expect(report.state.transitions.map(({ to }) => to)).toEqual([
        'ready',
        'aiming',
        'aiming',
        'aiming',
        'lowering',
        'aligning',
        'gripping',
        'lifting',
        'returning',
        'releasing',
        'result',
      ])
      expect(report.grip?.observation).toMatchObject({
        physicalContact: true,
        gripApproved: true,
      })
      expect(report.grip?.attempt).toMatchObject({
        accepted: true,
        jointCreated: true,
      })
      expect(report.state.outcome).toMatchObject({
        accepted: true,
        physicalContact: true,
      })
      expect(report.sync).toMatchObject({
        clawSynchronized: true,
        prizeSynchronized: true,
      })
      expect(report.ownership).toEqual({
        controllerOwnsState: true,
        physicsOwnsBodies: true,
        poseOwnsFingerPresentation: true,
        coordinatorOwnsCompletionEvents: true,
        gsapMovesAuthoritativeBodies: false,
      })
    } finally {
      coordinator.dispose()
    }
  })

  it('restores controller, pose, Rapier, and visual sync baselines on reset', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.4 })
      coordinator.dispatch({ type: 'confirmDrop' })
      coordinator.tick(1000 / 60)
      const oldControllerRunId = coordinator.snapshot.runId
      const oldPhysicsRunId = coordinator.physics.currentRunId

      const reset = coordinator.dispatch({ type: 'requestReset' })
      expect(reset.accepted).toBe(true)
      expect(coordinator.snapshot.state).toBe('ready')
      expect(coordinator.snapshot.runId).toBe(oldControllerRunId + 1)
      expect(coordinator.physics.currentRunId).toBe(oldPhysicsRunId + 1)
      expect(coordinator.snapshot.aim).toEqual({ x: 0, z: 0 })
      expect(coordinator.snapshot.outcome).toBeNull()
      expect(coordinator.physics.state).toBe('ready')
      expect(coordinator.physics.carryConstraintActive).toBe(false)
      expect(coordinator.pose.detectDrift('reset').matches).toBe(true)
      expect(coordinator.runtimeReport.sync).toMatchObject({
        clawSynchronized: true,
        prizeSynchronized: true,
      })

      const stale = coordinator.controller.dispatch({
        type: 'poseReached',
        pose: 'lowered',
        runId: oldControllerRunId,
      })
      expect(stale.accepted).toBe(false)
      expect(stale.snapshot.state).toBe('ready')
      expect(stale.snapshot.diagnostics.at(-1)).toMatchObject({
        kind: 'stale-callback',
        callbackRunId: oldControllerRunId,
      })
    } finally {
      coordinator.dispose()
    }
  })

  it('publishes deterministic N7 evidence with fixed-step ownership', async () => {
    const evidence = await createN7Evidence()
    expect(evidence).toMatchObject({
      node: 'N7',
      deterministic: true,
      commands: {
        initialState: 'ready',
        beginAimAccepted: true,
        moveXAccepted: true,
        moveZAccepted: true,
        aim: { x: 0.2, z: -0.2 },
        confirmDropAccepted: true,
        dropState: 'lowering',
      },
      behavior: {
        finalState: 'result',
        transitionStates: [
          'ready',
          'aiming',
          'aiming',
          'aiming',
          'lowering',
          'aligning',
          'gripping',
          'lifting',
          'returning',
          'releasing',
          'result',
        ],
        loweredSync: {
          clawSynchronized: true,
          prizeSynchronized: true,
        },
      },
      synchronization: {
        clawSynchronized: true,
        prizeSynchronized: true,
      },
      grip: {
        attempt: { accepted: true, jointCreated: true },
      },
      reset: {
        stateAfterTransaction: 'ready',
        controllerRunIdAdvanced: true,
        physicsRunIdAdvanced: true,
        aimRestored: true,
        outcomeCleared: true,
        syncRestored: true,
        poseRestored: true,
        physicsStateReady: true,
        noCarryConstraint: true,
      },
      physicsPolicy: {
        revision: N6_PHYSICS_CONFIG.revision,
        fixedDt: N6_PHYSICS_CONFIG.dt,
      },
    })
    expect(evidence.behavior.loweredTarget).toEqual([
      0.25,
      N6_PHYSICS_CONFIG.gripPosition[1],
      0.2 * -0.35,
    ])
    evidence.behavior.loweredClawPosition.forEach((value, axis) => {
      expect(value).toBeCloseTo(evidence.behavior.loweredTarget[axis], 5)
    })
  })
})
