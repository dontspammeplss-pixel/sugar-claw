import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  evaluateGrip,
  type GripCandidateObservation,
  type GripProfile,
} from '../physics/grip-evaluator'
import { N37_CANDIDATE_GRIP_PROFILE } from '../physics/config'
import { createN37Evidence } from './n37-evidence'

const PROFILE: GripProfile = {
  ...N37_CANDIDATE_GRIP_PROFILE,
  revision: 'test-profile-rev1',
}

function observation(
  fixedStep: number,
  overrides: Partial<GripCandidateObservation> = {},
): GripCandidateObservation {
  return {
    runId: 1,
    expectedRunId: 1,
    fixedStep,
    objectBodyId: 'prize',
    objectPositionWorld: [0, 0, 0],
    captureEnvelopeOriginWorld: [0, 0, 0],
    sensorIntersection: true,
    sensorObjectBodyId: 'prize',
    collisionGroupEligible: true,
    colliderMappingValid: true,
    solverContacts: PROFILE.requiredContacts.map((contact) => ({
      objectBodyId: 'prize',
      contactRegionId: contact.id,
      approachDirection: contact.approachDirection,
      solverContact: true,
      collisionGroupEligible: true,
    })),
    ...overrides,
  }
}

const stable = (overrides: Partial<GripCandidateObservation> = {}) => [
  observation(1, overrides),
  observation(2, overrides),
  observation(3, overrides),
]

describe('N37 opt-in valid-capture evaluator', () => {
  it('approves only contained, sensor-confirmed, distinct multi-region contact', () => {
    const result = evaluateGrip(PROFILE, stable())
    expect(result).toMatchObject({ approved: true, reason: 'approved' })
    expect(result.diagnostics).toMatchObject({
      profileRevision: 'test-profile-rev1',
      contactRegionIds: ['finger-right', 'finger-left', 'finger-back'],
      fixedStepWindow: 3,
      fixedSteps: [1, 2, 3],
    })
  })

  it('rejects visual overlap, sensor-only, partial, duplicate-side, wrong-body, and ineligible observations', () => {
    const completeContacts = observation(1).solverContacts
    const cases = [
      [
        'visual overlap only',
        { sensorIntersection: false, solverContacts: [] },
        'grip-incomplete-contact',
      ],
      ['sensor only', { solverContacts: [] }, 'grip-sensor-only'],
      [
        'partial contact',
        { solverContacts: [completeContacts[0]] },
        'grip-incomplete-contact',
      ],
      [
        'duplicate side',
        {
          solverContacts: [
            completeContacts[0],
            {
              ...completeContacts[0],
              contactRegionId: 'finger-left',
              approachDirection: 'right',
            },
          ],
        },
        'grip-incomplete-contact',
      ],
      ['wrong body', { objectBodyId: 'prize-1' }, 'grip-wrong-body'],
      [
        'ineligible group',
        { collisionGroupEligible: false },
        'collision-group-ineligible',
      ],
    ] as const

    for (const [, overrides, reason] of cases) {
      const result = evaluateGrip(PROFILE, stable(overrides))
      expect(result.approved).toBe(false)
      expect(result.reason).toBe(reason)
    }
  })

  it('rejects edge containment, stale identity, insufficient settling, gaps, and invalid profile', () => {
    expect(
      evaluateGrip(PROFILE, stable({ objectPositionWorld: [0.13, 0, 0] }))
        .reason,
    ).toBe('grip-outside-envelope')
    expect(
      evaluateGrip(PROFILE, stable({ runId: 0, expectedRunId: 1 })).reason,
    ).toBe('grip-stale-observation')
    expect(
      evaluateGrip(PROFILE, [observation(1), observation(3), observation(4)])
        .reason,
    ).toBe('grip-unstable-contact')
    expect(evaluateGrip(PROFILE, [observation(1), observation(2)]).reason).toBe(
      'grip-unstable-contact',
    )
    expect(evaluateGrip(null, stable()).reason).toBe('grip-collider-ambiguous')
  })

  it('keeps the candidate path opt-in and never creates a constraint', async () => {
    const adapter = await (
      await import('../physics/adapter')
    ).N6PhysicsAdapter.create()
    try {
      const observation = adapter.observeCandidateGrip()
      const candidate = adapter.attemptCandidateGrip([observation])
      expect(candidate.evaluation.approved).toBe(false)
      expect(candidate.attempt.jointCreated).toBe(false)
      expect(candidate.attempt.accepted).toBe(false)
      expect(adapter.carryConstraintActive).toBe(false)
    } finally {
      adapter.dispose()
    }
  })

  it('publishes N37 evidence and proves side-grab cannot create carry', async () => {
    const evidence = createN37Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n37-grip-validity.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence).toMatchObject({
      node: 'N37',
      status: 'pass',
      deterministic: true,
      mode: 'opt-in-candidate-predicate-fixtures',
      evidenceScope:
        'pure evaluator fixtures; Rapier adapter-backed N40 integration remains pending',
      activeGripRule: 'A-24 sensor intersection remains the runtime baseline',
    })
    expect(evidence.criticalProof).toMatchObject({
      rejected: true,
      carryConstraintCreated: false,
    })
    expect(
      evidence.fixtures.find(
        ({ fixture }) => fixture === 'properly-contained-multi-contact',
      )?.evaluation,
    ).toMatchObject({ approved: true, reason: 'approved' })
  })
})
