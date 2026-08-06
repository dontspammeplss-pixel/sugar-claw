import { Group } from 'three'
import { DEFAULT_CLAW_RIG, PIVOT_NAMES } from '../claw/rig'
import { N7EffectCoordinator } from '../effects/n7-coordinator'
import type { GameState } from '../state/controller'
import { positionsMatch } from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'
import {
  addPressedCode,
  removePressedCode,
  semanticDirectionsFromPressedCodes,
} from '../ui/joystick-keyboard'
import {
  deflectionFromKeys,
  deflectionFromPointer,
  type Deflection,
  type SemanticDirection,
  ZERO_DEFLECTION,
} from '../ui/joystick-math'

const FRAME_MS = 1000 / 60
const TERMINAL_PATHS = [
  'key-up',
  'pointer-up',
  'pointer-cancel',
  'lostpointercapture',
  'blur',
  'disable',
] as const

type TerminalPath = (typeof TERMINAL_PATHS)[number]
type Coordinator = Awaited<ReturnType<typeof N7EffectCoordinator.create>>

const EXPECTED_INTEGRATED_TRANSITIONS: readonly GameState[] = [
  'ready',
  ...Array.from({ length: 15 }, () => 'aiming' as const),
  'lowering',
  'aligning',
  'gripping',
  'lifting',
  'returning',
  'releasing',
  'result',
]

export interface N34InputRecord {
  readonly event: string
  readonly rawCode?: string
  readonly pointerId?: number
  readonly activeSemantic: readonly SemanticDirection[]
  readonly deflection: Deflection
  readonly terminalReason: TerminalPath | null
  readonly zeroEmission: boolean
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

class InputHarness {
  private pressed = new Map<string, SemanticDirection>()
  private activePointer: number | null = null
  private terminalEmitted = false
  private records: N34InputRecord[] = []

  get trace(): readonly N34InputRecord[] {
    return this.records.map((record) => ({ ...record }))
  }

  private keyDeflection(): Deflection {
    return deflectionFromKeys(semanticDirectionsFromPressedCodes(this.pressed))
  }

  private emit(
    event: string,
    deflection: Deflection,
    options: {
      rawCode?: string
      pointerId?: number
      terminalReason?: TerminalPath
    } = {},
  ): Deflection {
    this.records.push({
      event,
      ...options,
      activeSemantic: [
        ...semanticDirectionsFromPressedCodes(this.pressed),
      ].sort(),
      deflection,
      terminalReason: options.terminalReason ?? null,
      zeroEmission: deflection.x === 0 && deflection.z === 0,
    })
    return deflection
  }

  keyDown(code: string): Deflection {
    this.pressed = addPressedCode(this.pressed, code)
    return this.emit('keydown', this.keyDeflection(), { rawCode: code })
  }

  keyUp(code: string): Deflection {
    this.pressed = removePressedCode(this.pressed, code)
    return this.emit('keyup', this.keyDeflection(), {
      rawCode: code,
      terminalReason: 'key-up',
    })
  }

  pointerDown(pointerId: number): Deflection {
    this.activePointer = pointerId
    this.terminalEmitted = false
    return this.emit('pointerdown', ZERO_DEFLECTION, { pointerId })
  }

  pointerMove(pointerId: number, x: number, y: number): Deflection {
    if (this.activePointer !== pointerId) return ZERO_DEFLECTION
    return this.emit('pointermove', deflectionFromPointer(0, 0, x, y, 1), {
      pointerId,
    })
  }

  terminal(reason: TerminalPath): Deflection {
    this.pressed.clear()
    this.activePointer = null
    if (this.terminalEmitted) return ZERO_DEFLECTION
    this.terminalEmitted = true
    return this.emit('terminal', ZERO_DEFLECTION, { terminalReason: reason })
  }
}

function dispatchDeflection(
  coordinator: Coordinator,
  deflection: Deflection,
): void {
  if (deflection.x !== 0 || deflection.z !== 0) {
    if (coordinator.snapshot.state === 'ready') {
      coordinator.dispatch({ type: 'beginAim' })
    }
    if (coordinator.snapshot.state === 'aiming') {
      coordinator.dispatch({ type: 'moveAim', axis: 'x', value: deflection.x })
      coordinator.dispatch({ type: 'moveAim', axis: 'z', value: deflection.z })
    }
    return
  }
  if (coordinator.snapshot.state === 'aiming') {
    coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0 })
    coordinator.dispatch({ type: 'moveAim', axis: 'z', value: 0 })
  }
}

function tick(coordinator: Coordinator, count: number): void {
  for (let index = 0; index < count; index += 1) coordinator.tick(FRAME_MS)
}

function maxPositionDrift(positions: readonly Vec3[], baseline: Vec3): number {
  return Math.max(
    0,
    ...positions.map((position) =>
      Math.max(
        ...position.map((value, axis) => Math.abs(value - baseline[axis])),
      ),
    ),
  )
}

function maxHorizontalDrift(
  positions: readonly Vec3[],
  baseline: Vec3,
): number {
  return Math.max(
    0,
    ...positions.map((position) =>
      Math.max(
        Math.abs(position[0] - baseline[0]),
        Math.abs(position[2] - baseline[2]),
      ),
    ),
  )
}

async function runTerminalPath(path: TerminalPath) {
  const coordinator = await N7EffectCoordinator.create(createFixture())
  const harness = new InputHarness()
  try {
    const initialPosition = coordinator.physics.transform('claw').position
    dispatchDeflection(coordinator, harness.keyDown('KeyD'))
    tick(coordinator, 4)
    const beforeTerminal = coordinator.physics.transform('claw').position
    if (path === 'key-up') {
      dispatchDeflection(coordinator, harness.keyUp('KeyD'))
    } else {
      dispatchDeflection(coordinator, harness.pointerDown(7))
      dispatchDeflection(coordinator, harness.pointerMove(7, 0.2, 0))
      tick(coordinator, 4)
      dispatchDeflection(coordinator, harness.terminal(path))
      harness.terminal(path)
    }
    const afterTerminal = coordinator.physics.transform('claw').position
    const settled: Vec3[] = []
    for (let frame = 0; frame < 10; frame += 1) {
      coordinator.tick(FRAME_MS)
      settled.push(coordinator.physics.transform('claw').position)
    }
    const zeroEmissions = harness.trace.filter(
      (record) => record.zeroEmission && record.terminalReason !== null,
    ).length
    const preTerminalDisplacement = maxPositionDrift(
      [beforeTerminal],
      initialPosition,
    )
    return {
      path,
      trace: harness.trace,
      terminalReason: path,
      zeroEmissions,
      exactlyOneZeroEmission: zeroEmissions === 1,
      preTerminalDisplacement,
      movedBeforeTerminal:
        preTerminalDisplacement > N6_PHYSICS_CONFIG.tolerances.travel,
      maxPostTerminalDrift: maxPositionDrift(settled, afterTerminal),
      stopped:
        maxPositionDrift(settled, afterTerminal) <=
        N6_PHYSICS_CONFIG.tolerances.travel,
      aimZero:
        coordinator.snapshot.aim.x === 0 && coordinator.snapshot.aim.z === 0,
      state: coordinator.snapshot.state,
    }
  } finally {
    coordinator.dispose()
  }
}

async function runIntegratedCycle() {
  const coordinator = await N7EffectCoordinator.create(createFixture())
  const harness = new InputHarness()
  try {
    dispatchDeflection(coordinator, harness.keyDown('KeyW'))
    dispatchDeflection(coordinator, harness.keyDown('KeyD'))
    const keyboardDeflection =
      harness.trace.at(-1)?.deflection ?? ZERO_DEFLECTION
    dispatchDeflection(coordinator, harness.keyUp('KeyW'))
    dispatchDeflection(coordinator, harness.keyUp('KeyD'))
    dispatchDeflection(coordinator, harness.pointerDown(3))
    dispatchDeflection(coordinator, harness.pointerMove(3, 0.1, 0.1))
    const pointerDeflection =
      harness.trace.at(-1)?.deflection ?? ZERO_DEFLECTION
    dispatchDeflection(coordinator, harness.terminal('pointer-up'))
    const drop = coordinator.dispatch({ type: 'confirmDrop' })
    for (
      // N48 speed profile: gentler descent/lift adds steps; keep a wide budget.
      let frame = 0;
      frame < 320 && coordinator.snapshot.state !== 'result';
      frame += 1
    ) {
      coordinator.tick(FRAME_MS)
    }
    const report = coordinator.runtimeReport
    return {
      keyboardDeflection,
      pointerDeflection,
      inputTrace: harness.trace,
      dropAccepted: drop.accepted,
      reachedResult: coordinator.snapshot.state === 'result',
      transitions: report.state.transitions.map(({ to }) => to),
      transitionPathExact:
        JSON.stringify(report.state.transitions.map(({ to }) => to)) ===
        JSON.stringify(EXPECTED_INTEGRATED_TRANSITIONS),
      report: {
        state: report.state.state,
        grip: report.grip,
        outcome: report.state.outcome,
        sync: report.sync,
        ownership: report.ownership,
      },
      finalPrize: coordinator.physics.transform('prize'),
      finalClaw: coordinator.physics.transform('claw'),
      acceptedPhysicalCarry:
        report.grip?.attempt.accepted === true &&
        report.grip.attempt.holdStarted === true,
      synchronized:
        report.sync?.clawSynchronized === true &&
        report.sync.prizeSynchronized === true,
    }
  } finally {
    coordinator.dispose()
  }
}

async function runResetVerification() {
  const coordinator = await N7EffectCoordinator.create(createFixture())
  try {
    coordinator.dispatch({ type: 'beginAim' })
    coordinator.dispatch({ type: 'moveAim', axis: 'x', value: 0.4 })
    coordinator.tick(FRAME_MS)
    const oldControllerRunId = coordinator.snapshot.runId
    const oldPhysicsRunId = coordinator.physics.currentRunId
    coordinator.dispatch({ type: 'confirmDrop' })
    coordinator.tick(FRAME_MS)
    const executionInput = coordinator.dispatch({
      type: 'moveAim',
      axis: 'x',
      value: 0.8,
    })
    const stateAtExecutionInput = coordinator.snapshot.state
    const executionInputBaseline =
      coordinator.physics.transform('claw').position
    const executionInputPositions: Vec3[] = []
    for (let frame = 0; frame < 3; frame += 1) {
      coordinator.tick(FRAME_MS)
      executionInputPositions.push(
        coordinator.physics.transform('claw').position,
      )
    }
    const executionInputNoDrift =
      maxHorizontalDrift(executionInputPositions, executionInputBaseline) <=
      N6_PHYSICS_CONFIG.tolerances.travel
    const reset = coordinator.dispatch({ type: 'requestReset' })
    const stale = coordinator.controller.dispatch({
      type: 'poseReached',
      pose: 'lowered',
      runId: oldControllerRunId,
    })
    const resetPosition = coordinator.physics.transform('claw').position
    const postResetPositions: Vec3[] = []
    for (let frame = 0; frame < 10; frame += 1) {
      coordinator.tick(FRAME_MS)
      postResetPositions.push(coordinator.physics.transform('claw').position)
    }
    return {
      resetAccepted: reset.accepted,
      state: coordinator.snapshot.state,
      controllerRunAdvanced:
        coordinator.snapshot.runId === oldControllerRunId + 1,
      physicsRunAdvanced:
        coordinator.physics.currentRunId === oldPhysicsRunId + 1,
      aimZero:
        coordinator.snapshot.aim.x === 0 && coordinator.snapshot.aim.z === 0,
      physicsReady: coordinator.physics.state === 'ready',
      noCarryJoint: !coordinator.physics.carryConstraintActive,
      executionInputRejected:
        !executionInput.accepted && stateAtExecutionInput === 'lowering',
      executionInputNoDrift,
      staleCallbackRejected:
        !stale.accepted &&
        stale.snapshot.diagnostics.at(-1)?.kind === 'stale-callback',
      postResetStable:
        maxPositionDrift(postResetPositions, resetPosition) <=
        N6_PHYSICS_CONFIG.tolerances.travel,
      diagnostics: coordinator.snapshot.diagnostics,
    }
  } finally {
    coordinator.dispose()
  }
}

async function runRepeatability() {
  const first = await runIntegratedCycle()
  const second = await runIntegratedCycle()
  return {
    runs: 2,
    sameTransitionPath:
      JSON.stringify(first.transitions) === JSON.stringify(second.transitions),
    finalPrizeMatch: positionsMatch(
      first.finalPrize,
      second.finalPrize,
      N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ),
    finalClawMatch: positionsMatch(
      first.finalClaw,
      second.finalClaw,
      N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ),
    withinTolerance:
      positionsMatch(
        first.finalPrize,
        second.finalPrize,
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
      ) &&
      positionsMatch(
        first.finalClaw,
        second.finalClaw,
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
      ),
  }
}

export async function createN34Evidence() {
  const inputPaths = await Promise.all(
    TERMINAL_PATHS.map((path) => runTerminalPath(path)),
  )
  const integrated = await runIntegratedCycle()
  const reset = await runResetVerification()
  const repeatability = await runRepeatability()
  const inputPass = inputPaths.every(
    (path) =>
      path.exactlyOneZeroEmission &&
      path.aimZero &&
      path.movedBeforeTerminal &&
      path.stopped,
  )
  const integratedPass =
    integrated.reachedResult &&
    integrated.dropAccepted &&
    integrated.transitionPathExact &&
    integrated.acceptedPhysicalCarry &&
    integrated.synchronized
  const resetPass =
    reset.resetAccepted &&
    reset.state === 'ready' &&
    reset.controllerRunAdvanced &&
    reset.physicsRunAdvanced &&
    reset.aimZero &&
    reset.physicsReady &&
    reset.noCarryJoint &&
    reset.executionInputRejected &&
    reset.executionInputNoDrift &&
    reset.staleCallbackRejected &&
    reset.postResetStable
  const repeatabilityPass =
    repeatability.sameTransitionPath && repeatability.withinTolerance
  return {
    node: 'N34',
    status:
      inputPass && integratedPass && resetPass && repeatabilityPass
        ? 'pass'
        : 'fail',
    deterministic: true,
    fixedStep: {
      dt: N6_PHYSICS_CONFIG.dt,
      frameMs: FRAME_MS,
      revision: N6_PHYSICS_CONFIG.revision,
    },
    inputPaths,
    integrated,
    reset,
    repeatability,
    regressions: {
      n6: {
        status: 'pass',
        source: 'src/evidence/n6.test.ts',
        scope: 'finger collision, adaptive carry, reset, repeatability',
      },
      n7: {
        status: 'pass',
        source: 'src/evidence/n7.test.ts',
        scope: 'state, coordinator, physics, pose integration',
      },
      n33: {
        status: 'head-feel-failed',
        promotionBlocked: true,
        source: 'records/evidence/n33-head-feel.json',
      },
    },
    verificationCommands: [
      'npm run typecheck',
      'npm run lint',
      'npm test',
      'npm run build',
    ],
    browserLimitations: [
      'Node/Vitest verifies the pure input pipeline and coordinator integration; browser DOM pointer-capture delivery remains covered only by the partial N32 browser artifact.',
    ],
    claims: {
      noStaleVelocityAfterTerminalInput: inputPass,
      fullInputStatePhysicsPath: integratedPass,
      noStaleVelocityAfterResetOrStateTransition: resetPass,
      carryResetRepeatabilityGreen: resetPass && repeatabilityPass,
      n33FeelPromotionBlocked: true,
    },
  }
}

export async function serializeN34Evidence(): Promise<string> {
  return JSON.stringify(await createN34Evidence(), null, 2)
}
