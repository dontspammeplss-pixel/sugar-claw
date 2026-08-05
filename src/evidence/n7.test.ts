import { describe, expect, it } from 'vitest'
import { Group } from 'three'
import { DEFAULT_CLAW_RIG, PIVOT_NAMES } from '../claw/rig'
import {
  N7EffectCoordinator,
  reportSignature,
  resolveN7SceneBindings,
} from '../effects/n7-coordinator'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import {
  DEFAULT_PRIZE_MANIFEST,
  loadPrizeManifest,
  type PrizeManifest,
} from '../playfield/prize-manifest'
import {
  clearPrizePersistence,
  createPrizePersistenceStore,
} from '../playfield/prize-persistence'
import { createN7Evidence } from './n7-evidence'

function cloneManifest(): PrizeManifest {
  return JSON.parse(JSON.stringify(DEFAULT_PRIZE_MANIFEST)) as PrizeManifest
}

function createEmptySpaceManifest(): PrizeManifest {
  const manifest = cloneManifest()
  return loadPrizeManifest({
    ...manifest,
    revision: 'n22-no-hold-cycle-rev1',
    prizes: manifest.prizes.map((prize, index) => ({
      ...prize,
      position: [index === 1 ? -0.95 : 0.95, 1.2, index === 2 ? -0.3 : 0.3],
    })),
  })
}

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
      expect(coordinator.dispatch({ type: 'confirmDrop' }).snapshot.state).toBe(
        'lowering',
      )
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
        jointCreated: false,
        holdStarted: true,
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

  it('completes a no-hold cycle without descending into the chute (N-22)', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture(), {
      prizeManifest: createEmptySpaceManifest(),
      persistPrizeState: false,
    })
    try {
      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'confirmDrop' })
      const returnY: number[] = []
      for (let tick = 0; tick < 220; tick += 1) {
        const wasReturning = coordinator.snapshot.state === 'returning'
        coordinator.tick(1000 / 60)
        const isReturning = coordinator.snapshot.state === 'returning'
        if (wasReturning || isReturning) {
          returnY.push(coordinator.physics.transform('claw').position[1])
        }
        if (coordinator.snapshot.state === 'result') break
      }
      expect(coordinator.snapshot.state).toBe('result')
      expect(coordinator.snapshot.transitions.map(({ to }) => to)).toEqual(
        expect.arrayContaining(['lifting', 'returning', 'releasing']),
      )
      expect(coordinator.runtimeReport.grip?.attempt).toMatchObject({
        accepted: false,
        holdStarted: false,
        reason: 'no-physical-contact',
      })
      expect(returnY.length).toBeGreaterThan(0)
      expect(Math.min(...returnY)).toBeGreaterThanOrEqual(2.0)
      expect(coordinator.physics.transform('claw').position[1]).toBeCloseTo(
        N6_PHYSICS_CONFIG.clawPosition[1],
        2,
      )
    } finally {
      coordinator.dispose()
    }
  })

  it('keeps the N42.1 return path L-shaped under fixed-step sampling', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.2 })
      coordinator.dispatch({ type: 'confirmDrop' })
      const returnPositions: Array<readonly [number, number, number]> = []
      for (let tick = 0; tick < 220; tick += 1) {
        const wasReturning = coordinator.snapshot.state === 'returning'
        coordinator.tick(1000 / 60)
        const isReturning = coordinator.snapshot.state === 'returning'
        if (wasReturning || isReturning)
          returnPositions.push([
            ...coordinator.physics.transform('claw').position,
          ])
        if (coordinator.snapshot.state === 'result') break
      }
      const tolerance = N6_PHYSICS_CONFIG.tolerances.travel
      const topY = N6_PHYSICS_CONFIG.liftPosition[1]
      const overPosition = N6_PHYSICS_CONFIG.chute.overPosition
      const releasePosition = N6_PHYSICS_CONFIG.chute.releasePosition
      const firstDescent = returnPositions.findIndex(
        ([, y]) => Math.abs(y - topY) > tolerance,
      )
      expect(returnPositions.length).toBeGreaterThan(2)
      expect(firstDescent).toBeGreaterThan(0)
      expect(
        returnPositions
          .slice(0, firstDescent)
          .every(([, y]) => Math.abs(y - topY) <= tolerance),
      ).toBe(true)
      expect(
        returnPositions[firstDescent - 1].every(
          (value, axis) => Math.abs(value - overPosition[axis]) <= tolerance,
        ),
      ).toBe(true)
      expect(
        returnPositions
          .slice(firstDescent)
          .every(
            ([x, , z]) =>
              Math.abs(x - overPosition[0]) <= tolerance &&
              Math.abs(z - overPosition[2]) <= tolerance,
          ),
      ).toBe(true)
      expect(
        returnPositions
          .at(-1)!
          .every(
            (value, axis) =>
              Math.abs(value - releasePosition[axis]) <= tolerance,
          ),
      ).toBe(true)
      expect(coordinator.snapshot.state).toBe('result')
    } finally {
      coordinator.dispose()
    }
  })

  it('clears persisted prize positions and flags on coordinator reset (N-23)', async () => {
    const manifest = loadPrizeManifest({
      ...cloneManifest(),
      revision: 'n23-reset-prizes-rev1',
    })
    const persistence = createPrizePersistenceStore()
    clearPrizePersistence(manifest.revision)
    const coordinator = await N7EffectCoordinator.create(createFixture(), {
      prizeManifest: manifest,
      persistence,
      persistPrizeState: true,
    })
    try {
      const nudgedPosition: [number, number, number] = [-0.42, 1.24, 0.16]
      expect(coordinator.physics.movePrize('tag-prize', nudgedPosition)).toBe(
        true,
      )
      coordinator.physics.stepMany(3)
      expect(
        coordinator.physics.playfield.prizes.find(
          (prize) => prize.id === 'tag-prize',
        )?.position,
      ).not.toEqual(
        manifest.prizes.find((prize) => prize.id === 'tag-prize')?.position,
      )
      persistence.save({
        manifestRevision: manifest.revision,
        prizes: coordinator.physics.playfield.prizes.map((prize) => ({
          id: prize.id,
          position: [...prize.position],
          orientation: { quaternion: [...prize.orientation.quaternion] },
          won: true,
          removed: prize.id === 'pouch-prize',
        })),
      })
      const resumed = await N6PhysicsAdapter.create({
        prizeManifest: manifest,
        persistence,
        persistPrizeState: true,
      })
      try {
        const resumedPosition = resumed.playfield.prizes.find(
          (prize) => prize.id === 'tag-prize',
        )?.position
        expect(resumedPosition).toEqual(
          expect.arrayContaining([
            expect.closeTo(nudgedPosition[0], 0.02),
            expect.closeTo(nudgedPosition[1], 0.02),
            expect.closeTo(nudgedPosition[2], 0.02),
          ]),
        )
      } finally {
        resumed.dispose()
      }
      expect(coordinator.dispatch({ type: 'requestReset' }).accepted).toBe(true)
      for (const prize of manifest.prizes) {
        const restored = coordinator.physics.playfield.prizes.find(
          (entry) => entry.id === prize.id,
        )
        expect(restored?.position).toEqual([
          expect.closeTo(prize.position[0], 0.02),
          expect.closeTo(prize.position[1], 0.02),
          expect.closeTo(prize.position[2], 0.02),
        ])
        expect(restored?.won).toBe(false)
        expect(restored?.removed).toBe(false)
      }
      const fresh = await N6PhysicsAdapter.create({
        prizeManifest: manifest,
        persistence,
        persistPrizeState: true,
      })
      try {
        for (const prize of manifest.prizes) {
          const reloaded = fresh.playfield.prizes.find(
            (entry) => entry.id === prize.id,
          )
          expect(reloaded?.position).toEqual([
            expect.closeTo(prize.position[0], 0.02),
            expect.closeTo(prize.position[1], 0.02),
            expect.closeTo(prize.position[2], 0.02),
          ])
          expect(reloaded?.won).toBe(false)
          expect(reloaded?.removed).toBe(false)
        }
      } finally {
        fresh.dispose()
      }
    } finally {
      coordinator.dispose()
      clearPrizePersistence(manifest.revision)
    }
  })

  it('presents the classic arcade cycle and opens at release', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      expect(coordinator.pose.currentPose).toBe('open')
      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.2 })
      coordinator.dispatch({ type: 'confirmDrop' })
      coordinator.tick(1000 / 60)
      let sawLifting = false,
        sawReturning = false,
        sawReleasing = false
      for (let tick = 0; tick < 220; tick += 1) {
        coordinator.tick(1000 / 60)
        const state = coordinator.snapshot.state
        if (state === 'lifting') {
          sawLifting = true
          expect(coordinator.pose.currentPose).toBe('closed')
        } else if (state === 'returning') {
          sawReturning = true
          expect(coordinator.pose.currentPose).toBe('closed')
        } else if (state === 'releasing') sawReleasing = true
        if (state === 'result') break
      }
      expect(sawLifting).toBe(true)
      expect(sawReturning).toBe(true)
      expect(sawReleasing).toBe(true)
      expect(coordinator.snapshot.state).toBe('result')
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
        loweredSync: { clawSynchronized: true, prizeSynchronized: true },
      },
      synchronization: { clawSynchronized: true, prizeSynchronized: true },
      grip: {
        attempt: { accepted: true, jointCreated: false, holdStarted: true },
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
      const before = coordinator.physics.steps
      const report = coordinator.tick(10000)
      expect(coordinator.physics.steps - before).toBeLessThanOrEqual(
        Math.floor(250 / (N6_PHYSICS_CONFIG.dt * 1000)),
      )
      expect(report.physicsRunId).toBe(coordinator.physics.currentRunId)
      coordinator.tick(-1)
      expect(coordinator.snapshot.state).toBe('error')
      expect(coordinator.snapshot.errorKind).toBe('invariant')
    } finally {
      coordinator.dispose()
    }
  })

  it('accepts Drop at all four travel-bound corners and mid-field (N-21)', async () => {
    const positions = [
      [
        'front-left',
        N6_PHYSICS_CONFIG.travelBounds.min.x,
        N6_PHYSICS_CONFIG.travelBounds.max.z,
      ],
      [
        'back-left',
        N6_PHYSICS_CONFIG.travelBounds.min.x,
        N6_PHYSICS_CONFIG.travelBounds.min.z,
      ],
      [
        'front-right',
        N6_PHYSICS_CONFIG.travelBounds.max.x,
        N6_PHYSICS_CONFIG.travelBounds.max.z,
      ],
      [
        'back-right',
        N6_PHYSICS_CONFIG.travelBounds.max.x,
        N6_PHYSICS_CONFIG.travelBounds.min.z,
      ],
      ['mid-field', 0, 0],
    ] as const
    for (const [label, x, z] of positions) {
      const coordinator = await N7EffectCoordinator.create(createFixture())
      try {
        coordinator.dispatch({ type: 'beginAim' })
        expect(
          coordinator.physics.moveClaw([
            x,
            N6_PHYSICS_CONFIG.liftPosition[1],
            z,
          ]),
        ).toBe(true)
        coordinator.physics.stepMany(3)
        const drop = coordinator.dispatch({ type: 'confirmDrop' })
        expect(drop.accepted, label).toBe(true)
        expect(drop.snapshot.state, label).toBe('lowering')
        const loweringTarget = (
          coordinator as unknown as {
            target: readonly [number, number, number] | null
          }
        ).target
        expect(loweringTarget, label).not.toBeNull()
        expect(loweringTarget![0]).toBeGreaterThanOrEqual(
          N6_PHYSICS_CONFIG.travelBounds.min.x,
        )
        expect(loweringTarget![0]).toBeLessThanOrEqual(
          N6_PHYSICS_CONFIG.travelBounds.max.x,
        )
        expect(loweringTarget![2]).toBeGreaterThanOrEqual(
          N6_PHYSICS_CONFIG.travelBounds.min.z,
        )
        expect(loweringTarget![2]).toBeLessThanOrEqual(
          N6_PHYSICS_CONFIG.travelBounds.max.z,
        )
        const loweringY: number[] = []
        let loweringTicks = 0
        for (let tick = 0; tick < 180; tick += 1) {
          const wasLowering = coordinator.snapshot.state === 'lowering'
          coordinator.tick(1000 / 60)
          const y = coordinator.physics.transform('claw').position[1]
          if (wasLowering) {
            loweringTicks += 1
            loweringY.push(y)
          }
          if (tick < 2) {
            expect(y, label).toBeGreaterThan(
              N6_PHYSICS_CONFIG.clawClearance.baseInteractionY +
                N6_PHYSICS_CONFIG.clawClearance.tolerance,
            )
          }
          if (coordinator.snapshot.state === 'result') break
        }
        expect(coordinator.snapshot.state, label).toBe('result')
        expect(coordinator.snapshot.errorKind, label).toBeNull()
        expect(loweringTicks, label).toBeGreaterThanOrEqual(10)
        expect(loweringY.length, label).toBeGreaterThan(10)
      } finally {
        coordinator.dispose()
      }
    }
  })

  it('glides the claw on joystick deflection and clamps at travel bounds (N23)', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      coordinator.dispatch({ type: 'beginAim' })
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 1 })
      coordinator.dispatch({ type: 'moveAim', axis: 'z', value: -1 })
      const start = coordinator.physics.transform('claw').position
      const { min, max } = N6_PHYSICS_CONFIG.travelBounds
      for (let tick = 0; tick < 120; tick += 1) coordinator.tick(1000 / 60)
      const glided = coordinator.physics.transform('claw').position
      expect(glided[0]).toBeGreaterThan(start[0] + 0.5)
      expect(glided[2]).toBeLessThan(start[2] - 0.2)
      expect(glided[0]).toBeLessThanOrEqual(max.x + 1e-9)
      expect(glided[2]).toBeGreaterThanOrEqual(min.z - 1e-9)
      expect(glided[0]).toBeCloseTo(max.x, 3)
      expect(glided[2]).toBeCloseTo(min.z, 3)
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0 })
      coordinator.dispatch({ type: 'moveAim', axis: 'z', value: 0 })
      const parked = coordinator.physics.transform('claw').position
      coordinator.tick(1000 / 60)
      coordinator.tick(1000 / 60)
      const after = coordinator.physics.transform('claw').position
      expect(after[0]).toBeCloseTo(parked[0], 4)
      expect(after[2]).toBeCloseTo(parked[2], 4)
      expect(coordinator.dispatch({ type: 'confirmDrop' }).accepted).toBe(true)
      expect(coordinator.snapshot.aim).toEqual({ x: 0, z: 0 })
    } finally {
      coordinator.dispose()
    }
  })

  it('publishes unchanged reports only once via a stable signature', async () => {
    const coordinator = await N7EffectCoordinator.create(createFixture())
    try {
      const first = coordinator.runtimeReport
      expect(reportSignature(first)).toBe(
        reportSignature(coordinator.runtimeReport),
      )
      coordinator.dispatch({ type: 'beginAim' })
      const aiming = coordinator.runtimeReport
      expect(reportSignature(aiming)).not.toBe(reportSignature(first))
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.35 })
      expect(reportSignature(coordinator.runtimeReport)).not.toBe(
        reportSignature(aiming),
      )
    } finally {
      coordinator.dispose()
    }
  })
})
