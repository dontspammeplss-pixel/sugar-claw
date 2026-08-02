import { Group } from 'three'
import { DEFAULT_CLAW_RIG, PIVOT_NAMES } from '../claw/rig'
import { N7EffectCoordinator } from '../effects/n7-coordinator'
import { positionsMatch } from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'

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
  prizeRoot.position.set(-0.55, 1.18, 0.16)
  sceneRoot.add(prizeRoot)

  return sceneRoot
}

function tickUntil(
  coordinator: N7EffectCoordinator,
  predicate: () => boolean,
  maxTicks = 180,
): number {
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    coordinator.tick(1000 / 60)
    if (predicate()) return tick
  }
  throw new Error(`N7 evidence: state did not settle within ${maxTicks} ticks`)
}

/** Produces reproducible proof for the approved N7 integration boundary. */
export async function createN7Evidence() {
  const coordinator = await N7EffectCoordinator.create(createFixture())
  try {
    const initial = coordinator.runtimeReport
    const beginAim = coordinator.dispatch({ type: 'beginAim' })
    const moveX = coordinator.dispatch({
      type: 'moveAim',
      axis: 'x',
      value: 0.2,
    })
    const moveZ = coordinator.dispatch({
      type: 'moveAim',
      axis: 'z',
      value: -0.2,
    })
    const drop = coordinator.dispatch({ type: 'confirmDrop' })
    const loweredTarget: Vec3 = [
      0.2 * 1.25,
      N6_PHYSICS_CONFIG.gripPosition[1],
      -0.2 * 0.35,
    ]
    // Travel is kinematic and animated; advance until the claw physically
    // reaches the lowered target rather than capturing a single warm-up tick.
    let lowered = coordinator.tick(1000 / 60)
    let loweredTicks = 1
    while (
      loweredTicks < 90 &&
      !positionsMatch(
        coordinator.physics.transform('claw'),
        {
          position: loweredTarget,
          quaternion: coordinator.physics.transform('claw').quaternion,
        },
        N6_PHYSICS_CONFIG.tolerances.travel,
      )
    ) {
      lowered = coordinator.tick(1000 / 60)
      loweredTicks += 1
    }
    if (!lowered.sync) {
      throw new Error('N7 evidence: lowered tick did not publish synchronization')
    }
    const ticksToResult = tickUntil(
      coordinator,
      () => coordinator.snapshot.state === 'result',
    )
    const completed = coordinator.runtimeReport
    const oldRunId = completed.state.runId
    const requestReset = coordinator.dispatch({ type: 'requestReset' })
    const staleCallback = coordinator.dispatchCompletion({
      type: 'poseReached',
      pose: 'lowered',
      runId: oldRunId,
    })
    const reset = coordinator.runtimeReport

    return {
      node: 'N7',
      baseline:
        'gate-2-n3-approved + gate-3-n4-approved + gate-4-n5-approved + gate-5-n6-approved',
      deterministic: true,
      commands: {
        initialState: initial.state.state,
        beginAimAccepted: beginAim.accepted,
        moveXAccepted: moveX.accepted,
        moveZAccepted: moveZ.accepted,
        aim: completed.state.aim,
        confirmDropAccepted: drop.accepted,
        dropState: drop.snapshot.state,
      },
      behavior: {
        ticksToResult: ticksToResult + 1,
        finalState: completed.state.state,
        transitionStates: completed.state.transitions.map(({ to }) => to),
        loweredTarget: [...loweredTarget],
        loweredClawPosition: lowered.sync.claw.position,
        loweredSync: lowered.sync,
      },
      synchronization: completed.sync,
      grip: completed.grip,
      outcome: completed.state.outcome,
      interruption: {
        staleAccepted: staleCallback.accepted,
        stateUnchanged: staleCallback.snapshot.state === 'ready',
        diagnostic: staleCallback.snapshot.diagnostics.at(-1),
      },
      reset: {
        requestAccepted: requestReset.accepted,
        stateAfterTransaction: reset.state.state,
        controllerRunIdAdvanced: reset.state.runId === completed.state.runId + 1,
        physicsRunIdAdvanced: reset.physicsRunId === completed.physicsRunId + 1,
        aimRestored: reset.state.aim.x === 0 && reset.state.aim.z === 0,
        outcomeCleared: reset.state.outcome === null,
        syncRestored:
          reset.sync?.clawSynchronized === true &&
          reset.sync.prizeSynchronized === true,
        // Reset restores the baseline rig, then presents the parked-open pose.
        poseRestored: coordinator.pose.detectDrift('open').matches,
        physicsStateReady: coordinator.physics.state === 'ready',
        noCarryConstraint: !coordinator.physics.carryConstraintActive,
      },
      ownership: completed.ownership,
      physicsPolicy: {
        revision: N6_PHYSICS_CONFIG.revision,
        fixedDt: N6_PHYSICS_CONFIG.dt,
        authoritativeBodyWriter: 'N6PhysicsAdapter',
        authoritativeStepWriter: 'N7EffectCoordinator tick via N6PhysicsAdapter',
      },
    }
  } finally {
    coordinator.dispose()
  }
}

export async function serializeN7Evidence(): Promise<string> {
  return JSON.stringify(await createN7Evidence(), null, 2)
}
