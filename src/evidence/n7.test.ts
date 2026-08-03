import { describe, expect, it } from 'vitest'
import { Group } from 'three'
import { DEFAULT_CLAW_RIG, PIVOT_NAMES } from '../claw/rig'
import {
  N7EffectCoordinator,
  reportSignature,
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
  // N26: mirror the real hierarchy — the head hangs below the carriage and
  // owns the finger rig (the pose adapter still resolves pivots by name).
  const headRoot = new Group()
  headRoot.name = 'HeadRoot'
  clawVisualRoot.add(headRoot)
  const fingerRig = new Group()
  fingerRig.name = 'FingerRig'
  headRoot.add(fingerRig)
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
    expect(bindings.headVisualRoot.name).toBe('HeadRoot')
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
      // Reset restores the baseline rig, then presents the parked-open pose.
      expect(coordinator.pose.detectDrift('open').matches).toBe(true)
      expect(coordinator.pose.currentPose).toBe('open')
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

  it('presents the classic arcade cycle: parked open, descend open, close at the bottom, stay closed through lift/return, open at release', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      // Parked open at boot.
      expect(coordinator.pose.currentPose).toBe('open')

      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.2 })
      coordinator.dispatch({ type: 'confirmDrop' })
      expect(coordinator.snapshot.state).toBe('lowering')
      coordinator.tick(1000 / 60)
      // Descend phase: fingers stay open.
      expect(coordinator.pose.currentPose).toBe('open')

      let sawLifting = false
      let sawReturning = false
      let sawReleasing = false
      for (let tick = 0; tick < 220; tick += 1) {
        coordinator.tick(1000 / 60)
        const state = coordinator.snapshot.state
        if (state === 'lifting') {
          sawLifting = true
          // Fingers must stay closed while carrying the prize upward.
          expect(coordinator.pose.currentPose).toBe('closed')
        } else if (state === 'returning') {
          sawReturning = true
          // Fingers stay closed during the return leg too.
          expect(coordinator.pose.currentPose).toBe('closed')
        } else if (state === 'releasing') {
          sawReleasing = true
        }
        if (state === 'result') break
      }
      expect(sawLifting).toBe(true)
      expect(sawReturning).toBe(true)
      expect(sawReleasing).toBe(true)
      expect(coordinator.snapshot.state).toBe('result')
      // Released at the top: fingers back to open.
      expect(coordinator.pose.currentPose).toBe('open')
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
    // N36: the lowering target is derived from the explicit base clearance,
    // but Rapier may stop earlier only for a reported physical barrier.
    expect(evidence.behavior.loweredTarget).toEqual([
      0,
      N6_PHYSICS_CONFIG.clawClearance.baseInteractionY,
      0,
    ])
    expect(evidence.behavior.loweredClawPosition[1]).toBeGreaterThanOrEqual(
      N6_PHYSICS_CONFIG.clawClearance.baseInteractionY -
        N6_PHYSICS_CONFIG.clawClearance.tolerance,
    )
  })

  it('returns the post-failure snapshot when a command side effect fails', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.2 })
      ;(coordinator as unknown as { beginLowering: () => void }).beginLowering =
        () => {
          throw new Error('boom')
        }
      const result = coordinator.dispatch({ type: 'confirmDrop' })
      expect(result.accepted).toBe(true)
      expect(result.snapshot.state).toBe('error')
      expect(result.snapshot.errorKind).toBe('invariant')
      expect(coordinator.snapshot.state).toBe('error')
      expect(coordinator.snapshot.transitions.at(-1)?.to).toBe('error')
    } finally {
      coordinator.dispose()
    }
  })

  it('bounds catch-up work per tick and rejects invalid deltas', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.2 })
      coordinator.dispatch({ type: 'confirmDrop' })
      const stepsBefore = coordinator.physics.steps
      const report = coordinator.tick(10000)
      const stepsAfter = coordinator.physics.steps
      const maxStepsPerTick = Math.floor(
        250 / (N6_PHYSICS_CONFIG.dt * 1000),
      )
      expect(stepsAfter - stepsBefore).toBeLessThanOrEqual(maxStepsPerTick)
      expect(report.physicsRunId).toBe(coordinator.physics.currentRunId)

      coordinator.tick(-1)
      expect(coordinator.snapshot.state).toBe('error')
      expect(coordinator.snapshot.errorKind).toBe('invariant')
    } finally {
      coordinator.dispose()
    }
  })

  it('glides the claw on joystick deflection and clamps at travel bounds (N23)', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      // First deflection enters aim space automatically.
      expect(coordinator.dispatch({ type: 'beginAim' }).accepted).toBe(true)
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 1 })
      coordinator.dispatch({ type: 'moveAim', axis: 'z', value: -1 })
      const start = coordinator.physics.transform('claw').position
      const { min, max } = N6_PHYSICS_CONFIG.travelBounds

      // 120 ticks at full deflection: the claw must glide toward +X/-Z and be
      // clamped by the travel bounds, never exceeding them.
      for (let tick = 0; tick < 120; tick += 1) {
        coordinator.tick(1000 / 60)
      }
      const glided = coordinator.physics.transform('claw').position
      expect(glided[0]).toBeGreaterThan(start[0] + 0.5)
      // The Z travel bound clamps at min.z = -0.35, so the claw cannot pass
      // -0.5; assert it moved meaningfully toward the bound and parked there.
      expect(glided[2]).toBeLessThan(start[2] - 0.2)
      expect(glided[0]).toBeLessThanOrEqual(max.x + 1e-9)
      expect(glided[2]).toBeGreaterThanOrEqual(min.z - 1e-9)
      // Full deflection glides until the travel bounds clamp the claw.
      expect(glided[0]).toBeCloseTo(max.x, 3)
      expect(glided[2]).toBeCloseTo(min.z, 3)

      // Releasing the stick (zero deflection) must stop the glide — no idle
      // drift once the claw is parked.
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0 })
      coordinator.dispatch({ type: 'moveAim', axis: 'z', value: 0 })
      const parked = coordinator.physics.transform('claw').position
      coordinator.tick(1000 / 60)
      coordinator.tick(1000 / 60)
      const after = coordinator.physics.transform('claw').position
      expect(after[0]).toBeCloseTo(parked[0], 4)
      expect(after[2]).toBeCloseTo(parked[2], 4)

      // Drop from the glided position still runs a full physical cycle. The
      // stick was released, so aim is back at rest — but the claw drops from
      // where it is, not from an aim-derived position (N23).
      const drop = coordinator.dispatch({ type: 'confirmDrop' })
      expect(drop.accepted).toBe(true)
      expect(drop.snapshot.state).toBe('lowering')
      expect(coordinator.snapshot.aim).toEqual({ x: 0, z: 0 })
    } finally {
      coordinator.dispose()
    }
  })

  it('publishes unchanged reports only once via a stable signature', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      const first = coordinator.runtimeReport
      const identical = coordinator.runtimeReport
      expect(reportSignature(first)).toBe(reportSignature(identical))

      coordinator.dispatch({ type: 'beginAim' })
      const aiming = coordinator.runtimeReport
      expect(reportSignature(aiming)).not.toBe(reportSignature(first))

      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.35 })
      const reAimed = coordinator.runtimeReport
      expect(reportSignature(reAimed)).not.toBe(reportSignature(aiming))
    } finally {
      coordinator.dispose()
    }
  })
})
