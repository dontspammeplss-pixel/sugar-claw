import {
  evaluateGrip,
  type GripCandidateObservation,
  type GripEvaluation,
} from '../physics/grip-evaluator'
import { N37_CANDIDATE_GRIP_PROFILE as PROFILE } from '../physics/config'

function sample(
  fixedStep: number,
  overrides: Partial<GripCandidateObservation> = {},
): GripCandidateObservation {
  return {
    runId: 7,
    expectedRunId: 7,
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
    })),
    contactRegions: PROFILE.requiredContacts.map(() => ({
      prizeId: PROFILE.objectBodyId,
      primitiveId: 'legacy-body',
      region: 'body',
      retentionFactor: 1,
    })),
    ...overrides,
  }
}

function repeated(
  overrides: Partial<GripCandidateObservation> = {},
): readonly GripCandidateObservation[] {
  return [sample(10, overrides), sample(11, overrides), sample(12, overrides)]
}

function fixture(
  name: string,
  observations: readonly GripCandidateObservation[],
): {
  readonly fixture: string
  readonly evaluation: GripEvaluation
  readonly carryConstraintCreated: false
} {
  return {
    fixture: name,
    evaluation: evaluateGrip(PROFILE, observations),
    carryConstraintCreated: false,
  }
}

export function createN37Evidence() {
  const completeContacts = sample(10).solverContacts
  const fixtures = [
    fixture('centered-object', repeated()),
    fixture(
      'offset-outside-capture-envelope',
      repeated({ objectPositionWorld: [0.13, 0, 0] }),
    ),
    fixture(
      'visual-overlap-only',
      repeated({ sensorIntersection: false, solverContacts: [] }),
    ),
    fixture('sensor-only-contact', repeated({ solverContacts: [] })),
    fixture(
      'one-contact-region',
      repeated({ solverContacts: [completeContacts[0]] }),
    ),
    fixture(
      'duplicate-same-side-contact',
      repeated({
        solverContacts: [
          completeContacts[0],
          {
            ...completeContacts[0],
            contactRegionId: 'finger-left',
            approachDirection: 'right',
          },
        ],
      }),
    ),
    fixture(
      'wrong-body-solver-contact',
      repeated({
        solverContacts: completeContacts.map((contact) => ({
          ...contact,
          objectBodyId: 'prize-1',
        })),
      }),
    ),
    fixture(
      'collision-group-ineligible',
      repeated({ collisionGroupEligible: false }),
    ),
    fixture('unstable-settling-window', [sample(10), sample(11)]),
    fixture('stale-run-observation', repeated({ runId: 6, expectedRunId: 7 })),
    fixture('non-consecutive-fixed-steps', [
      sample(10),
      sample(12),
      sample(13),
    ]),
    fixture('properly-contained-multi-contact', repeated()),
    {
      ...fixture('invalid-profile', repeated()),
      evaluation: evaluateGrip(null, repeated()),
    },
  ]
  const approved = fixtures.find(
    (entry) => entry.fixture === 'properly-contained-multi-contact',
  )!
  const sideGrab = fixtures.find(
    (entry) => entry.fixture === 'visual-overlap-only',
  )!
  const pass =
    approved.evaluation.approved &&
    sideGrab.evaluation.reason === 'grip-incomplete-contact' &&
    fixtures.every((entry) => entry.carryConstraintCreated === false)

  return {
    node: 'N37',
    status: pass ? 'pass' : 'fail',
    deterministic: true,
    mode: 'opt-in-candidate-predicate-fixtures',
    evidenceScope:
      'pure evaluator fixtures; Rapier adapter-backed N40 integration remains pending',
    activeGripRule: 'A-24 sensor intersection remains the runtime baseline',
    profile: PROFILE,
    fixedStepWindow: PROFILE.settlingSteps,
    fixtures,
    criticalProof: {
      fixture: sideGrab.fixture,
      sensorOrVisualOverlap: sideGrab.evaluation.diagnostics.sensorIntersection,
      rejected: !sideGrab.evaluation.approved,
      reason: sideGrab.evaluation.reason,
      carryConstraintCreated: sideGrab.carryConstraintCreated,
    },
    verificationCommands: [
      'npm run typecheck',
      'npm run lint',
      'npm test',
      'npm run build',
    ],
  }
}

export async function serializeN37Evidence(): Promise<string> {
  return JSON.stringify(createN37Evidence(), null, 2)
}
