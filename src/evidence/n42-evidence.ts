import { Group } from 'three'
import { DEFAULT_CLAW_RIG, PIVOT_NAMES } from '../claw/rig'
import { N7EffectCoordinator } from '../effects/n7-coordinator'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import type { DeliveryObservation } from '../physics/adapter'

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

function tickUntilResult(coordinator: N7EffectCoordinator, maxTicks = 240): void {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    coordinator.tick(1000 / 60)
    if (coordinator.snapshot.state === 'result') return
  }
  throw new Error('N42 fixture did not reach result')
}

function beginPlay(coordinator: N7EffectCoordinator): void {
  coordinator.dispatch({ type: 'beginAim' })
  coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.8 })
  coordinator.dispatch({ type: 'moveAim', axis: 'z', value: 0.8 })
  coordinator.dispatch({ type: 'confirmDrop' })
}

export async function createN42Evidence() {
  const noWin = await N7EffectCoordinator.create(createFixture())
  let noWinFixture
  try {
    beginPlay(noWin)
    for (let tick = 0; tick < 120; tick += 1) {
      noWin.tick(1000 / 60)
      if (noWin.snapshot.state === 'returning') break
    }
    const beforeRelease = noWin.runtimeReport.countdown
    noWinFixture = {
      state: noWin.snapshot.state,
      gripApproved: noWin.runtimeReport.grip?.attempt.accepted === true,
      delivered: noWin.runtimeReport.delivery,
      payoutHook: noWin.runtimeReport.payoutHook,
      countdownBefore: beforeRelease,
      countdownAfter: noWin.runtimeReport.countdown,
    }
  } finally {
    noWin.dispose()
  }

  const carried = await N7EffectCoordinator.create(createFixture())
  let carriedFixture
  try {
    beginPlay(carried)
    tickUntilResult(carried)
    const report = carried.runtimeReport
    carriedFixture = {
      state: report.state.state,
      statePath: report.state.transitions.map(({ to }) => to),
      gripApproved: report.grip?.attempt.accepted === true,
      delivery: report.delivery,
      payoutHook: report.payoutHook,
      countdown: report.countdown,
      prizeRemoved: report.delivery?.removed === true,
    }
  } finally {
    carried.dispose()
  }

  const emergent = await N7EffectCoordinator.create(
    createFixture(),
    { prizePosition: [1.05, 1.8, 0.55] },
  )
  let emergentFixture
  try {
    // The prize starts above the chute and falls under Rapier gravity. The
    // centered claw cannot reach it, so the grip attempt fails before the
    // prize later crosses the physical delivery sensor.
    beginPlay(emergent)
    tickUntilResult(emergent)
    emergentFixture = {
      state: emergent.snapshot.state,
      gripApproved: emergent.runtimeReport.grip?.attempt.accepted === true,
      delivery: emergent.runtimeReport.delivery,
      payoutHook: emergent.runtimeReport.payoutHook,
    }
  } finally {
    emergent.dispose()
  }

  const attached = await N7EffectCoordinator.create(createFixture())
  let attachedFixture
  try {
    attached.physics.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
    attached.physics.stepMany(3)
    const grip = attached.physics.attemptGrip()
    attached.physics.step()
    attachedFixture = {
      gripApproved: grip.accepted,
      holdActive: attached.physics.carryConstraintActive,
      delivery: attached.physics.delivery,
    }
  } finally {
    attached.dispose()
  }

  const stale = await N7EffectCoordinator.create(
    createFixture(),
    { prizePosition: [1.05, 1.1, 0.55] },
  )
  let staleFixture
  try {
    stale.tick(1000 / 60)
    const oldDelivery = stale.runtimeReport.delivery as DeliveryObservation
    const oldRunId = stale.snapshot.runId
    stale.dispatch({ type: 'requestReset' })
    const staleCompletion = stale.controller.dispatch({
      type: 'releaseComplete',
      outcome: { accepted: true, delivery: oldDelivery },
      runId: oldRunId,
    })
    staleFixture = {
      oldRunId,
      activeRunId: stale.snapshot.runId,
      staleAccepted: staleCompletion.accepted,
      staleDiagnostic: staleCompletion.snapshot.diagnostics.at(-1)?.kind,
    }
  } finally {
    stale.dispose()
  }

  const noWinPass =
    noWinFixture.gripApproved &&
    noWinFixture.delivered === null &&
    noWinFixture.payoutHook === null &&
    noWinFixture.countdownAfter.remainingSteps === noWinFixture.countdownBefore.remainingSteps &&
    noWinFixture.countdownAfter.resetCount === 0
  const carriedPass =
    carriedFixture.state === 'result' &&
    carriedFixture.gripApproved &&
    carriedFixture.prizeRemoved &&
    carriedFixture.delivery?.runId === carriedFixture.countdown.lastResetRunId &&
    carriedFixture.payoutHook?.runId === carriedFixture.delivery?.runId &&
    carriedFixture.countdown.resetCount === 1 &&
    carriedFixture.countdown.remainingSteps === carriedFixture.countdown.durationSteps
  const emergentPass =
    !emergentFixture.gripApproved && emergentFixture.delivery?.delivered === true
  const attachedPass =
    attachedFixture.gripApproved &&
    attachedFixture.holdActive &&
    attachedFixture.delivery === null
  const stalePass =
    !staleFixture.staleAccepted &&
    staleFixture.activeRunId !== staleFixture.oldRunId &&
    staleFixture.staleDiagnostic === 'stale-callback'

  return {
    node: 'N42',
    status: noWinPass && carriedPass && emergentPass && attachedPass && stalePass ? 'pass' : 'fail',
    checks: { noWinPass, carriedPass, emergentPass, attachedPass, stalePass },
    deterministic: true,
    physics: {
      revision: N6_PHYSICS_CONFIG.revision,
      fixedDt: N6_PHYSICS_CONFIG.dt,
      chute: N6_PHYSICS_CONFIG.chute,
    },
    fixtures: {
      noWinCarry: noWinFixture,
      carriedDelivery: carriedFixture,
      emergentDelivery: emergentFixture,
      attachedSafety: attachedFixture,
      staleEpoch: staleFixture,
    },
    failureResults: noWinPass && carriedPass && emergentPass && attachedPass && stalePass
      ? []
      : ['delivery-fixture-failed'],
    verificationCommands: ['npm run typecheck', 'npm run lint', 'npm test', 'npm run build'],
  }
}
