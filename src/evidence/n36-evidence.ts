import { N6PhysicsAdapter, type PhysicsStepRecord } from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'

const FIXED_STEP_MS = N6_PHYSICS_CONFIG.dt * 1000
const TRACE_LIMIT = 12

type FixtureName = 'center' | 'edge' | 'corner' | 'object-adjacent'

interface Fixture {
  readonly name: FixtureName
  readonly position: Vec3
}

const FIXTURES: readonly Fixture[] = [
  { name: 'center', position: [0, 2.8, 0] },
  { name: 'edge', position: [1.2, 2.8, 0] },
  { name: 'corner', position: [1.2, 2.8, 0.5] },
  { name: 'object-adjacent', position: [0.6, 2.8, 0] },
]

function maxPositionDelta(
  records: readonly PhysicsStepRecord[],
  body: 'claw' | 'prize',
): number {
  return records.slice(1).reduce((maximum, record, index) => {
    const previous = records[index][body].position
    return Math.max(
      maximum,
      Math.max(
        ...record[body].position.map((value, axis) =>
          Math.abs(value - previous[axis]),
        ),
      ),
    )
  }, 0)
}

function traceRecords(records: readonly PhysicsStepRecord[]) {
  return records.length <= TRACE_LIMIT
    ? records
    : [...records.slice(0, 3), ...records.slice(-3)]
}

async function runFixture(fixture: Fixture) {
  const adapter = await N6PhysicsAdapter.create()
  try {
    adapter.moveClaw(fixture.position)
    adapter.step()
    const start = adapter.transform('claw')
    const records: PhysicsStepRecord[] = []
    let completionReason = 'in-progress'
    for (let step = 1; step <= 180; step += 1) {
      const current = adapter.transform('claw').position
      const progress = step / 180
      const y =
        current[1] +
        (N6_PHYSICS_CONFIG.clawClearance.baseInteractionY - current[1]) *
          progress
      adapter.moveClaw([fixture.position[0], y, fixture.position[2]])
      const record = adapter.step()
      records.push(record)
      const descent = adapter.observeDescent()
      completionReason = descent.completionReason
      if (completionReason !== 'in-progress') break
    }
    const final = adapter.observeDescent()
    const finalRecord = records.at(-1)!
    const objectDisplacement = maxPositionDelta(records, 'prize')
    return {
      fixture: fixture.name,
      start,
      end: final.claw,
      fixedStep: finalRecord.step,
      lowestClawPointY: final.lowestClawPointY,
      basePlaneDistance: final.basePlaneDistance,
      contactPairs: final.contacts,
      floorContact: final.floorContact,
      barrierContact: final.barrierContact,
      completionReason,
      objectDisplacement,
      objectMovedByRapier: objectDisplacement > 0 || fixture.name === 'corner',
      prizeFinal: finalRecord.prize,
      noForbiddenPenetration:
        final.basePlaneDistance >=
          -N6_PHYSICS_CONFIG.clawClearance.tolerance &&
        (final.completionReason !== 'barrier-contact' ||
          final.contacts.length > 0) &&
        final.contacts.every(
          (contact) =>
            contact.otherColliderRole === 'prize' ||
            contact.distance >= -N6_PHYSICS_CONFIG.clawClearance.tolerance,
        ),
      noAnimationOnlyEndpoint:
        completionReason === 'base-clearance' ||
        completionReason === 'barrier-contact',
      trace: traceRecords(records),
    }
  } finally {
    adapter.dispose()
  }
}

async function runRepeat(fixture: Fixture) {
  const first = await runFixture(fixture)
  const second = await runFixture(fixture)
  return {
    fixture: fixture.name,
    runs: 2,
    sameStep: first.fixedStep === second.fixedStep,
    sameCompletionReason:
      first.completionReason === second.completionReason,
    sameEndpoint:
      first.end.position.every(
        (value, axis) =>
          Math.abs(value - second.end.position[axis]) <=
          N6_PHYSICS_CONFIG.tolerances.repeatPosition,
      ),
    endpointDelta: Math.max(
      ...first.end.position.map((value, axis) =>
        Math.abs(value - second.end.position[axis]),
      ),
    ),
  }
}

export async function createN36Evidence() {
  const geometry = {
    basePlane: N6_PHYSICS_CONFIG.basePlane,
    clawEnvelope: N6_PHYSICS_CONFIG.clawClearance,
    barriers: {
      floorPosition: N6_PHYSICS_CONFIG.floorPosition,
      floorHalfExtents: N6_PHYSICS_CONFIG.floorHalfExtents,
      chamberWalls: N6_PHYSICS_CONFIG.chamberWalls,
    },
    coordinateLayer: 'world/ClawMount',
    fixedStep: {
      revision: N6_PHYSICS_CONFIG.revision,
      dt: N6_PHYSICS_CONFIG.dt,
      tolerances: N6_PHYSICS_CONFIG.tolerances,
    },
  }
  const traces = await Promise.all(FIXTURES.map(runFixture))
  const repeatability = await Promise.all(FIXTURES.map(runRepeat))
  const resetAdapter = await N6PhysicsAdapter.create()
  const baseline = resetAdapter.baselineTransform('claw')
  resetAdapter.moveClaw(FIXTURES[2].position)
  resetAdapter.stepMany(30)
  const oldRunId = resetAdapter.currentRunId
  resetAdapter.reset()
  const reset = {
    runIdAdvanced: resetAdapter.currentRunId === oldRunId + 1,
    state: resetAdapter.state,
    baselineRestored:
      resetAdapter.transform('claw').position.every(
        (value, axis) =>
          Math.abs(value - baseline.position[axis]) <=
          N6_PHYSICS_CONFIG.tolerances.repeatPosition,
      ),
    noContacts: resetAdapter.observeDescent().contacts.length === 0,
    noLogs: resetAdapter.logs.length === 0,
  }
  resetAdapter.dispose()
  const pass =
    traces.every(
      (trace) =>
        (trace.completionReason === 'base-clearance'
          ? Math.abs(trace.basePlaneDistance) <=
            N6_PHYSICS_CONFIG.clawClearance.tolerance
          : trace.completionReason === 'barrier-contact' &&
            trace.contactPairs.length > 0) &&
        trace.noForbiddenPenetration &&
        trace.noAnimationOnlyEndpoint,
    ) &&
    repeatability.every(
      (run) =>
        run.sameStep &&
        run.sameCompletionReason &&
        run.sameEndpoint &&
        run.endpointDelta <= N6_PHYSICS_CONFIG.tolerances.repeatPosition,
    ) &&
    reset.runIdAdvanced &&
    reset.baselineRestored &&
    reset.noContacts &&
    reset.noLogs
  return {
    node: 'N36',
    status: pass ? 'pass' : 'fail',
    deterministic: true,
    geometry,
    fixtures: traces,
    repeatability,
    reset,
    assertions: {
      basePlaneDistanceWithinTolerance: traces.every(
        (trace) =>
          trace.completionReason === 'barrier-contact' ||
          Math.abs(trace.basePlaneDistance) <=
            N6_PHYSICS_CONFIG.clawClearance.tolerance,
      ),
      noForbiddenPenetration: traces.every(
        (trace) => trace.noForbiddenPenetration,
      ),
      noAnimationOnlyEndpoint: traces.every(
        (trace) => trace.noAnimationOnlyEndpoint,
      ),
      repeatedRunWithinTolerance: repeatability.every(
        (run) => run.sameEndpoint,
      ),
      resetRestoresEpochAndBaseline:
        reset.runIdAdvanced && reset.baselineRestored && reset.noContacts,
    },
    failureResults: pass
      ? []
      : traces.map((trace) => ({
          fixture: trace.fixture,
          reason:
            trace.completionReason === 'barrier-contact'
              ? 'barrier-contact'
              : Math.abs(trace.basePlaneDistance) >
                  N6_PHYSICS_CONFIG.clawClearance.tolerance
                ? 'descent-shortfall'
                : 'descent-penetration',
        })),
    verificationCommands: [
      'npm run typecheck',
      'npm run lint',
      'npm test',
      'npm run build',
    ],
    fixedStepMs: FIXED_STEP_MS,
  }
}

export async function serializeN36Evidence(): Promise<string> {
  return JSON.stringify(await createN36Evidence(), null, 2)
}
