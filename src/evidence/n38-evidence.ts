import {
  N6PhysicsAdapter,
  type N38BarrierTrace,
  type N38ContactTrace,
} from '../physics/adapter'
import { N6_PHYSICS_CONFIG, N38_COLLISION_MATRIX, type Vec3 } from '../physics/config'
import { DEFAULT_PRIZE_MANIFEST } from '../playfield/prize-manifest'
import { REQUIRED_HIERARCHY } from '../scene/report'

const TRACE_LIMIT = 12

function trim<T>(values: readonly T[]): readonly T[] {
  return values.length <= TRACE_LIMIT
    ? values
    : [...values.slice(0, 3), ...values.slice(-3)]
}

const SINGLE_PRIZE_MANIFEST = {
  ...DEFAULT_PRIZE_MANIFEST,
  revision: 'n38-single-prize-fixture-rev1',
  prizes: [DEFAULT_PRIZE_MANIFEST.prizes[0]],
}

function manifestWithPrizePosition(position?: Vec3) {
  if (!position) return SINGLE_PRIZE_MANIFEST
  return {
    ...SINGLE_PRIZE_MANIFEST,
    prizes: [{ ...SINGLE_PRIZE_MANIFEST.prizes[0], position }],
  }
}

function glideTo(adapter: N6PhysicsAdapter, target: Vec3, steps = 90): void {
  const start = adapter.transform('claw').position
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps
    const position = start.map(
      (value, axis) => value + (target[axis] - value) * progress,
    ) as unknown as Vec3
    adapter.moveClaw(position)
    adapter.step()
  }
}

async function captureBarrierTrace(
  barrier: 'floor' | 'wall',
  target: Vec3,
): Promise<N38BarrierTrace> {
  const adapter = await N6PhysicsAdapter.create({
    prizeManifest: SINGLE_PRIZE_MANIFEST,
    persistPrizeState: false,
  })
  try {
    const before = adapter.transform('head')
    glideTo(adapter, target)
    const records = adapter.stepMany(12)
    const after = adapter.transform('head')
    const contact = records
      .flatMap((record) => record.contacts)
      .find((entry) => entry.otherColliderRole === barrier) ?? null
    const colliderId =
      barrier === 'floor' ? 'environment-floor' : 'environment-wall-3'
    return {
      barrier,
      colliderId,
      contactObserved: contact !== null,
      contact,
      before,
      target,
      after,
      responseObserved:
        contact !== null &&
        (after.position.some(
          (value, axis) => Math.abs(value - target[axis]) > 0.000001,
        ) ||
          after.quaternion.some(
            (value, index) => Math.abs(value - before.quaternion[index]) > 0.000001,
          )),
    }
  } finally {
    adapter.dispose()
  }
}

async function runObjectWallFixture() {
  const adapter = await N6PhysicsAdapter.create({
    prizeManifest: manifestWithPrizePosition([1.55, 1.2, 0]),
    persistPrizeState: false,
  })
  try {
    adapter.step()
    const grip = adapter.observeGrip()
    const traces = adapter.observeN38ContactTraces().filter(
      (trace) =>
        (trace.a === 'prize' && trace.b === 'wall') ||
        (trace.a === 'wall' && trace.b === 'prize'),
    )
    return {
      fixture: 'object-to-wall-impact',
      target: [1.55, 1.2, 0] as Vec3,
      contactTraces: trim(traces),
      visualOverlap: grip.visualOverlap,
      sensorIntersection: grip.physicalContact,
      solverContact: traces.some((trace) => trace.solverContact),
      carryConstraintCreated: false,
      contactObserved: traces.length > 0,
      requiredPairObserved: traces.some((trace) => trace.solverContact),
    }
  } finally {
    adapter.dispose()
  }
}

async function runCollisionFixture(
  name: string,
  target: Vec3,
  prizePosition?: Vec3,
): Promise<{
  readonly fixture: string
  readonly target: Vec3
  readonly contactTraces: readonly N38ContactTrace[]
  readonly visualOverlap: boolean
  readonly sensorIntersection: boolean
  readonly solverContact: boolean
  readonly carryConstraintCreated: boolean
  readonly contactObserved: boolean
  readonly requiredPairObserved: boolean
}> {
  const adapter = await N6PhysicsAdapter.create({
    prizeManifest: manifestWithPrizePosition(prizePosition),
    persistPrizeState: false,
  })
  try {
    glideTo(adapter, target)
    const tracesByStep: N38ContactTrace[][] = []
    for (let step = 0; step < 12; step += 1) {
      adapter.step()
      tracesByStep.push([...adapter.observeN38ContactTraces()])
    }
    const grip = adapter.observeGrip()
    const traces = tracesByStep.flat()
    const exactPair =
      name === 'claw-to-object-impact'
        ? (trace: N38ContactTrace) =>
            (trace.a === 'clawBody' && trace.b === 'prize') ||
            (trace.a === 'prize' && trace.b === 'clawBody')
        : name === 'finger-to-object-impact'
          ? (trace: N38ContactTrace) =>
              (trace.a === 'clawFinger' && trace.b === 'prize') ||
              (trace.a === 'prize' && trace.b === 'clawFinger')
          : name === 'object-to-floor-rest'
            ? (trace: N38ContactTrace) =>
                (trace.a === 'prize' && trace.b === 'floor') ||
                (trace.a === 'floor' && trace.b === 'prize')
            : name === 'claw-to-wall-impact'
              ? (trace: N38ContactTrace) =>
                  (trace.a === 'clawBody' && trace.b === 'wall') ||
                  (trace.a === 'clawFinger' && trace.b === 'wall') ||
                  (trace.a === 'wall' &&
                    (trace.b === 'clawBody' || trace.b === 'clawFinger'))
              : () => false
    const attempt = name === 'visual-overlap-ineligible'
      ? adapter.attemptGrip()
      : null
    return {
      fixture: name,
      target,
      contactTraces: trim(traces),
      visualOverlap: grip.visualOverlap,
      sensorIntersection: grip.physicalContact,
      solverContact: traces.some((trace) => exactPair(trace) && trace.solverContact),
      carryConstraintCreated: attempt?.holdStarted ?? false,
      contactObserved: traces.length > 0,
      requiredPairObserved: traces.some(exactPair),
    }
  } finally {
    adapter.dispose()
  }
}

export async function createN38Evidence() {
  const inventoryAdapter = await N6PhysicsAdapter.create({
    prizeManifest: DEFAULT_PRIZE_MANIFEST,
    persistPrizeState: false,
  })
  const inventoryBefore = inventoryAdapter.diagnosticInventory()
  const baselineTransforms = {
    claw: inventoryAdapter.baselineTransform('claw'),
    head: inventoryAdapter.baselineTransform('head'),
    prize: inventoryAdapter.baselineTransform('prize'),
    environment: inventoryAdapter.baselineTransform('environment'),
  }
  const initialDiagnostics = inventoryAdapter.observeN38Diagnostics()
  const baselineIdentity = inventoryBefore.identities.map((identity) => ({
    entity: identity.entity,
    logicalBodyId: identity.logicalBodyId,
    colliderId: identity.colliderId,
    role: identity.role,
    shapeType: identity.shapeType,
    sensor: identity.sensor,
    mode: identity.mode,
    collisionGroup: identity.collisionGroup,
    filterMask: identity.filterMask,
    solverMask: identity.solverMask,
    sourceRevision: identity.sourceRevision,
    profileRevision: identity.profileRevision,
  }))
  inventoryAdapter.reset()
  const inventoryAfter = inventoryAdapter.diagnosticInventory()
  const reset = {
    runIdAdvanced: inventoryAfter.runId === inventoryBefore.runId + 1,
    noMissingBefore: inventoryBefore.missingRegistrations.length === 0,
    noMissingAfter: inventoryAfter.missingRegistrations.length === 0,
    sameRegistrationShape:
      JSON.stringify(baselineIdentity) ===
      JSON.stringify(
        inventoryAfter.identities.map((identity) => ({
          entity: identity.entity,
          logicalBodyId: identity.logicalBodyId,
          colliderId: identity.colliderId,
          role: identity.role,
          shapeType: identity.shapeType,
          sensor: identity.sensor,
          mode: identity.mode,
          collisionGroup: identity.collisionGroup,
          filterMask: identity.filterMask,
          solverMask: identity.solverMask,
          sourceRevision: identity.sourceRevision,
          profileRevision: identity.profileRevision,
        })),
      ),
    baselineClawRestored: inventoryAdapter.transform('claw').position.every(
      (value, axis) =>
        Math.abs(value - baselineTransforms.claw.position[axis]) <=
        N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ),
    baselineBodiesRestored: (['claw', 'head', 'prize', 'environment'] as const).every(
      (body) =>
        inventoryAdapter.transform(body).position.every(
          (value, axis) =>
            Math.abs(value - baselineTransforms[body].position[axis]) <=
            N6_PHYSICS_CONFIG.tolerances.repeatPosition,
        ) &&
        inventoryAdapter.transform(body).quaternion.every(
          (value, axis) =>
            Math.abs(value - baselineTransforms[body].quaternion[axis]) <=
            N6_PHYSICS_CONFIG.tolerances.repeatPosition,
        ),
    ),
    noContactsAfterReset: inventoryAdapter.observeGrip().contacts.length === 0,
    zeroVelocitiesAfterReset:
      inventoryAdapter.velocity('claw').every((value) => value === 0) &&
      inventoryAdapter.velocity('head').every((value) => value === 0) &&
      inventoryAdapter.velocity('prize').every((value) => value === 0),
    noCarryAfterReset: !inventoryAdapter.carryConstraintActive,
  }
  inventoryAdapter.dispose()

  const visualOverlap = await runCollisionFixture(
    'visual-overlap-ineligible',
    N6_PHYSICS_CONFIG.overlapPosition,
  )
  const clawObject = await runCollisionFixture(
    'claw-to-object-impact',
    [0, 1.2, 0],
    [0, 1.2, 0],
  )
  const fingerObject = await runCollisionFixture(
    'finger-to-object-impact',
    [0, 1.2, 0],
    [0.3, 1.2, 0],
  )
  const objectFloor = await runCollisionFixture(
    'object-to-floor-rest',
    [0, 1.2, 0],
  )
  const wall = await runCollisionFixture(
    'claw-to-wall-impact',
    [1.25, 2.4, 0],
  )
  const objectWall = await runObjectWallFixture()
  const barrierTraces = [
    await captureBarrierTrace('floor', [0, 0.83, 0]),
    await captureBarrierTrace('wall', [1.25, 2.4, 0]),
  ]

  const expectedMatrixCells = N38_COLLISION_MATRIX.length
  const matrix = initialDiagnostics.pairMatrix
  const matrixPass =
    matrix.length === expectedMatrixCells &&
    matrix.every((entry) =>
      entry.expected === 'forbidden'
        ? !entry.eligible && entry.result === 'ineligible-pair'
        : entry.eligible,
    )
  const visualManifestPass = inventoryBefore.visualProxyBindings.every(
    (binding) => {
      const manifestPath =
        binding.visualId === 'ClawVisualRoot'
          ? 'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot'
          : binding.visualId === 'PrizeBody'
            ? 'SceneRoot/PrizeRoot'
            : 'SceneRoot/MachineRoot/MachineCollisionProxies'
      return (
        REQUIRED_HIERARCHY.includes(manifestPath as (typeof REQUIRED_HIERARCHY)[number]) &&
        binding.missingColliderIds.length === 0
      )
    },
  )
  const pass =
    inventoryBefore.missingRegistrations.length === 0 &&
    initialDiagnostics.missingRegistrations.length === 0 &&
    visualManifestPass &&
    matrixPass &&
    visualOverlap.visualOverlap &&
    !visualOverlap.sensorIntersection &&
    !visualOverlap.carryConstraintCreated &&
    clawObject.contactObserved &&
    clawObject.sensorIntersection &&
    fingerObject.contactObserved &&
    objectFloor.contactObserved &&
    wall.contactObserved &&
    objectWall.contactObserved &&
    objectWall.solverContact &&
    clawObject.requiredPairObserved &&
    fingerObject.requiredPairObserved &&
    objectFloor.requiredPairObserved &&
    wall.requiredPairObserved &&
    wall.contactTraces.some(
      (trace) => trace.a === 'clawFinger' && trace.b === 'wall' && trace.solverContact,
    ) &&
    barrierTraces.every(
      (trace) => trace.contactObserved && trace.responseObserved,
    ) &&
    reset.runIdAdvanced &&
    reset.noMissingAfter &&
    reset.sameRegistrationShape &&
    reset.baselineClawRestored &&
    reset.baselineBodiesRestored &&
    reset.noContactsAfterReset &&
    reset.zeroVelocitiesAfterReset &&
    reset.noCarryAfterReset

  return {
    node: 'N38',
    status: pass ? 'pass' : 'fail',
    deterministic: true,
    authority: {
      physics: 'src/physics/adapter.ts',
      config: 'src/physics/config.ts',
      evidence: 'src/evidence/n38-evidence.ts',
      sceneManifest: 'src/scene/report.ts REQUIRED_HIERARCHY',
      sceneTruth: false,
    },
    inventory: {
      beforeStepping: inventoryBefore,
      afterReset: inventoryAfter,
    },
    pairMatrix: {
      contractCells: expectedMatrixCells,
      observed: matrix,
      pass: matrixPass,
    },
    fixtures: {
      clawToObject: clawObject,
      fingerToObject: fingerObject,
      objectToFloor: objectFloor,
      clawToWall: wall,
      objectToWall: objectWall,
      negativeVisualOverlap: visualOverlap,
    },
    barrierTraces,
    reset,
    failureResults: pass
      ? []
      : ['collision-trace-inconclusive'],
    claims: {
      visualOverlapNeverApprovesCarry:
        visualOverlap.visualOverlap &&
        !visualOverlap.sensorIntersection &&
        !visualOverlap.carryConstraintCreated,
      registrationComplete:
        inventoryBefore.missingRegistrations.length === 0 &&
        inventoryAfter.missingRegistrations.length === 0,
      barrierResponsePhysical: barrierTraces.every(
        (trace) => trace.contactObserved && trace.responseObserved,
      ),
      visualManifestPass,
      resetRepeatable:
        reset.sameRegistrationShape &&
        reset.baselineClawRestored &&
        reset.baselineBodiesRestored &&
        reset.noContactsAfterReset &&
        reset.zeroVelocitiesAfterReset &&
        reset.noCarryAfterReset,
    },
    verificationCommands: [
      'npm run typecheck',
      'npm run lint',
      'npm test',
      'npm run build',
    ],
  }
}

export async function serializeN38Evidence(): Promise<string> {
  return JSON.stringify(await createN38Evidence(), null, 2)
}
