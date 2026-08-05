import { evaluateGrip, type GripCandidateObservation, type GripProfile } from '../physics/grip-evaluator'

const PROFILE: GripProfile = {
  revision: 'n44-fixture-profile-rev1',
  objectBodyId: 'fixture-prize',
  captureEnvelopeOffset: [0, 0, 0],
  captureEnvelopeHalfExtents: [0.34, 0.34, 0.34],
  referencePoint: [0, 0, 0],
  requiredVolumeHalfExtents: [0.22, 0.22, 0.22],
  margin: 0.02,
  requiredContacts: [
    { id: 'finger-right', approachDirection: 'right' },
    { id: 'finger-left', approachDirection: 'left' },
    { id: 'finger-back', approachDirection: 'back' },
  ],
  settlingSteps: 3,
}

function observation(
  fixedStep: number,
  region: 'body' | 'corner' | 'tag' | 'strap' | 'loop' | null,
): GripCandidateObservation {
  const primitiveId = region ? `${region}-primitive` : null
  return {
    runId: 44,
    expectedRunId: 44,
    fixedStep,
    objectBodyId: PROFILE.objectBodyId,
    objectPositionWorld: [0, 0, 0],
    captureEnvelopeOriginWorld: [0, 0, 0],
    sensorIntersection: true,
    sensorObjectBodyId: PROFILE.objectBodyId,
    collisionGroupEligible: true,
    colliderMappingValid: true,
    solverContacts: PROFILE.requiredContacts.map((contact) => ({
      objectBodyId: PROFILE.objectBodyId,
      contactRegionId: contact.id,
      approachDirection: contact.approachDirection,
      solverContact: true,
      collisionGroupEligible: true,
      primitiveId: primitiveId ?? undefined,
    })),
    contactRegions: region
      ? [{
          prizeId: PROFILE.objectBodyId,
          primitiveId: primitiveId!,
          region,
          retentionFactor: region === 'body' ? 1 : region === 'corner' ? 0.7 : 0.45,
        }]
      : [],
  }
}

function repeated(region: Parameters<typeof observation>[1]): readonly GripCandidateObservation[] {
  return [observation(10, region), observation(11, region), observation(12, region)]
}

export function createN44Evidence() {
  const names: readonly [string, Parameters<typeof observation>[1]][] = [
    ['body-cage', 'body'],
    ['corner-catch', 'corner'],
    ['tag-catch', 'tag'],
    ['strap-catch', 'strap'],
  ]
  const fixtures = names.map(([fixture, region]) => {
    const evaluation = evaluateGrip(PROFILE, repeated(region))
    return {
      fixture,
      caughtRegion: evaluation.diagnostics.caughtGeometry?.regions[0] ?? null,
      retentionFactor: evaluation.quality.retentionFactor,
      evaluation,
      fixedStepRepeatable: JSON.stringify(evaluation) === JSON.stringify(evaluateGrip(PROFILE, repeated(region))),
    }
  })
  const pseudoCapture = evaluateGrip(PROFILE, repeated(null))
  const status = fixtures.every((fixture) =>
    fixture.evaluation.approved && fixture.caughtRegion !== null && fixture.fixedStepRepeatable,
  ) && pseudoCapture.reason === 'pseudo-capture' && !pseudoCapture.approved
  return {
    node: 'N44',
    status: status ? 'pass' : 'fail',
    deterministic: true,
    colliderPolicy: 'authored convex sphere/box/capsule primitives; no cloth or concave mesh physics',
    fixtures,
    negativeFixture: {
      fixture: 'overlap-without-valid-sub-geometry-capture',
      rejected: !pseudoCapture.approved,
      reason: pseudoCapture.reason,
      caughtRegion: pseudoCapture.diagnostics.caughtGeometry,
    },
    verificationCommands: ['npm run typecheck', 'npm run lint', 'npm test', 'npm run build'],
  }
}
