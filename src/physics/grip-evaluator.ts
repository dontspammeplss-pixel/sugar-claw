export type GripContactRegionId = 'finger-right' | 'finger-left' | 'finger-back'
export type GripApproachDirection = 'right' | 'left' | 'back'
export type GripCaughtRegion = 'body' | 'corner' | 'tag' | 'strap' | 'loop'

export interface GripContactRegionObservation {
  readonly prizeId: string
  readonly primitiveId: string
  readonly region: GripCaughtRegion
  readonly retentionFactor: number
}

export interface GripContactRegionResult {
  readonly prizeId: string
  readonly primitiveIds: readonly string[]
  readonly regions: readonly GripCaughtRegion[]
  readonly retentionFactor: number
}

export interface GripQuality {
  readonly caughtRegion: GripCaughtRegion | null
  readonly retentionFactor: number
  readonly contactGeometry: 'body-cage' | 'packaging-catch' | 'none'
}

export type GripFailureReason =
  | 'grip-outside-envelope'
  | 'grip-sensor-only'
  | 'grip-incomplete-contact'
  | 'grip-wrong-body'
  | 'grip-unstable-contact'
  | 'grip-stale-observation'
  | 'grip-collider-ambiguous'
  | 'collision-group-ineligible'
  | 'geometry-undefined'
  | 'strap-vs-body-ambiguous'
  | 'pseudo-capture'

export type GripEvaluationReason = 'approved' | GripFailureReason

export interface GripProfile {
  readonly revision: string
  readonly objectBodyId: string
  readonly captureEnvelopeOffset: readonly [number, number, number]
  readonly captureEnvelopeHalfExtents: readonly [number, number, number]
  readonly referencePoint: readonly [number, number, number]
  readonly requiredVolumeHalfExtents: readonly [number, number, number]
  readonly margin: number
  readonly requiredContacts: readonly {
    readonly id: GripContactRegionId
    readonly approachDirection: GripApproachDirection
  }[]
  readonly settlingSteps: number
}

export interface GripSolverContact {
  readonly objectBodyId: string
  readonly contactRegionId: GripContactRegionId
  readonly approachDirection: GripApproachDirection
  readonly solverContact: boolean
  readonly collisionGroupEligible: boolean
  readonly primitiveId?: string
}

export interface GripCandidateObservation {
  readonly runId: number
  readonly expectedRunId: number
  readonly fixedStep: number
  readonly objectBodyId: string | null
  readonly objectPositionWorld: readonly [number, number, number]
  readonly captureEnvelopeOriginWorld: readonly [number, number, number]
  readonly sensorIntersection: boolean
  readonly sensorObjectBodyId: string | null
  readonly collisionGroupEligible: boolean
  /** Adapter-proven collider/profile mapping; false means no safe approval. */
  readonly colliderMappingValid: boolean
  readonly solverContacts: readonly GripSolverContact[]
  /** Adapter-proven sub-geometry identity; absent preserves pre-N44 fixtures. */
  readonly contactRegions?: readonly GripContactRegionObservation[]
}

export interface GripEvaluationDiagnostics {
  readonly profileRevision: string | null
  readonly captureEnvelope: {
    readonly center: readonly [number, number, number]
    readonly halfExtents: readonly [number, number, number]
    readonly margin: number
  } | null
  readonly objectReferencePoint: readonly [number, number, number] | null
  readonly contactRegionIds: readonly GripContactRegionId[]
  readonly caughtGeometry: GripContactRegionResult | null
  readonly sensorIntersection: boolean
  readonly sensorObjectBodyId: string | null
  readonly solverContacts: readonly GripSolverContact[]
  readonly objectBodyId: string | null
  readonly runId: number | null
  readonly expectedRunId: number | null
  readonly fixedStepWindow: number
  readonly fixedSteps: readonly number[]
}

export interface GripEvaluation {
  readonly approved: boolean
  readonly reason: 'approved' | GripFailureReason
  readonly diagnostics: GripEvaluationDiagnostics
  readonly quality: GripQuality
}

const EMPTY_CONTACTS: readonly GripSolverContact[] = []
const EMPTY_STEPS: readonly number[] = []

type SampleResult = {
  readonly reason: GripEvaluationReason
  readonly contacts: readonly GripSolverContact[]
  readonly caughtGeometry: GripContactRegionResult | null
}

const EMPTY_QUALITY: GripQuality = {
  caughtRegion: null,
  retentionFactor: 0,
  contactGeometry: 'none',
}

function caughtGeometry(
  observation: GripCandidateObservation,
  contacts: readonly GripSolverContact[],
): GripContactRegionResult | null {
  if (observation.contactRegions === undefined) {
    return {
      prizeId: observation.objectBodyId ?? 'unknown',
      primitiveIds: ['legacy-body'],
      regions: ['body'],
      retentionFactor: 1,
    }
  }
  if (observation.contactRegions.length === 0 || contacts.length === 0) return null
  if (contacts.every((contact) => !contact.primitiveId) && observation.contactRegions.every((region) => region.region === 'body')) {
    return {
      prizeId: observation.contactRegions[0].prizeId,
      primitiveIds: observation.contactRegions.map((region) => region.primitiveId),
      regions: ['body'],
      retentionFactor: 1,
    }
  }
  const byId = new Map(
    observation.contactRegions.map((region) => [region.primitiveId, region]),
  )
  const matched = contacts
    .map((contact) => (contact.primitiveId ? byId.get(contact.primitiveId) : undefined))
    .filter((region): region is GripContactRegionObservation => region !== undefined)
  if (matched.length !== contacts.length) return null
  const regions = [...new Set(matched.map((region) => region.region))]
  const primitiveIds = [...new Set(matched.map((region) => region.primitiveId))]
  if (regions.length !== 1 || primitiveIds.length === 0) return null
  return {
    prizeId: matched[0].prizeId,
    primitiveIds,
    regions,
    retentionFactor: matched.reduce((minimum, region) => Math.min(minimum, region.retentionFactor), 1),
  }
}

function qualityFor(caught: GripContactRegionResult | null): GripQuality {
  if (!caught) return EMPTY_QUALITY
  const region = caught.regions[0]
  return {
    caughtRegion: region,
    retentionFactor: caught.retentionFactor,
    contactGeometry: region === 'body' ? 'body-cage' : 'packaging-catch',
  }
}

function validProfile(profile: GripProfile | null): profile is GripProfile {
  if (!profile || !profile.revision || !profile.objectBodyId) return false
  if (!Number.isFinite(profile.margin) || profile.margin < 0) return false
  if (!Number.isInteger(profile.settlingSteps) || profile.settlingSteps < 1) {
    return false
  }
  if (profile.requiredContacts.length === 0) return false
  const ids = new Set(profile.requiredContacts.map((contact) => contact.id))
  const directions = new Set(
    profile.requiredContacts.map((contact) => contact.approachDirection),
  )
  return (
    ids.size === profile.requiredContacts.length &&
    directions.size === profile.requiredContacts.length &&
    profile.captureEnvelopeHalfExtents.every((value) => value > 0) &&
    profile.requiredVolumeHalfExtents.every((value) => value >= 0)
  )
}

function referencePoint(
  profile: GripProfile,
  observation: GripCandidateObservation,
): readonly [number, number, number] {
  return profile.referencePoint.map(
    (offset, axis) => observation.objectPositionWorld[axis] + offset,
  ) as [number, number, number]
}

function envelopeCenter(
  profile: GripProfile,
  observation: GripCandidateObservation,
): readonly [number, number, number] {
  return profile.captureEnvelopeOffset.map(
    (offset, axis) => observation.captureEnvelopeOriginWorld[axis] + offset,
  ) as [number, number, number]
}

function diagnostics(
  profile: GripProfile | null,
  observation: GripCandidateObservation | null,
  contacts: readonly GripSolverContact[] = EMPTY_CONTACTS,
  fixedStepWindow = 0,
  fixedSteps: readonly number[] = EMPTY_STEPS,
  caught: GripContactRegionResult | null = null,
): GripEvaluationDiagnostics {
  return {
    profileRevision: profile?.revision ?? null,
    captureEnvelope:
      observation && profile
        ? {
            center: envelopeCenter(profile, observation),
            halfExtents: profile.captureEnvelopeHalfExtents,
            margin: profile.margin,
          }
        : null,
    objectReferencePoint:
      observation && profile ? referencePoint(profile, observation) : null,
    contactRegionIds: contacts.map((contact) => contact.contactRegionId),
    caughtGeometry: caught,
    sensorIntersection: observation?.sensorIntersection ?? false,
    sensorObjectBodyId: observation?.sensorObjectBodyId ?? null,
    solverContacts: contacts,
    objectBodyId: observation?.objectBodyId ?? null,
    runId: observation?.runId ?? null,
    expectedRunId: observation?.expectedRunId ?? null,
    fixedStepWindow,
    fixedSteps,
  }
}

function outsideEnvelope(
  profile: GripProfile,
  observation: GripCandidateObservation,
): boolean {
  const point = referencePoint(profile, observation)
  const center = envelopeCenter(profile, observation)
  return profile.requiredVolumeHalfExtents.some((volume, axis) => {
    const distance = Math.abs(point[axis] - center[axis])
    const available =
      profile.captureEnvelopeHalfExtents[axis] - profile.margin - volume
    return available < 0 || distance > available
  })
}

function validContacts(
  profile: GripProfile,
  observation: GripCandidateObservation,
): readonly GripSolverContact[] {
  const required = new Map(
    profile.requiredContacts.map((contact) => [contact.id, contact]),
  )
  const matched = new Map<GripContactRegionId, GripSolverContact>()
  for (const contact of observation.solverContacts) {
    const expected = required.get(contact.contactRegionId)
    if (
      !expected ||
      contact.objectBodyId !== profile.objectBodyId ||
      contact.approachDirection !== expected.approachDirection ||
      !contact.solverContact ||
      !contact.collisionGroupEligible
    ) {
      continue
    }
    matched.set(contact.contactRegionId, contact)
  }
  return [...matched.values()]
}

function evaluateSample(
  profile: GripProfile,
  observation: GripCandidateObservation,
): SampleResult {
  if (
    observation.runId !== observation.expectedRunId ||
    !Number.isInteger(observation.runId) ||
    observation.runId < 0 ||
    !Number.isInteger(observation.fixedStep) ||
    observation.fixedStep < 0
  ) {
    return { reason: 'grip-stale-observation', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }
  if (!observation.colliderMappingValid) {
    return { reason: 'grip-collider-ambiguous', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }
  if (!observation.collisionGroupEligible) {
    return { reason: 'collision-group-ineligible', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }
  if (observation.objectBodyId !== profile.objectBodyId) {
    return { reason: 'grip-wrong-body', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }
  if (
    observation.sensorIntersection &&
    observation.sensorObjectBodyId !== profile.objectBodyId
  ) {
    return { reason: 'grip-wrong-body', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }
  if (
    observation.solverContacts.some(
      (contact) => contact.objectBodyId !== profile.objectBodyId,
    )
  ) {
    return { reason: 'grip-wrong-body', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }
  if (
    observation.solverContacts.some(
      (contact) => !contact.collisionGroupEligible,
    )
  ) {
    return { reason: 'collision-group-ineligible', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }
  if (outsideEnvelope(profile, observation)) {
    return { reason: 'grip-outside-envelope', contacts: EMPTY_CONTACTS, caughtGeometry: null }
  }

  const contacts = validContacts(profile, observation)
  if (!observation.sensorIntersection) {
    return { reason: 'grip-incomplete-contact', contacts, caughtGeometry: null }
  }
  if (contacts.length === 0) {
    return { reason: 'grip-sensor-only', contacts, caughtGeometry: null }
  }
  if (contacts.length !== profile.requiredContacts.length) {
    return { reason: 'grip-incomplete-contact', contacts, caughtGeometry: null }
  }  const caught = caughtGeometry(observation, contacts)
  if (!caught) {
    return {
      reason: observation.contactRegions !== undefined && observation.contactRegions.length === 0
        ? 'pseudo-capture'
        : 'strap-vs-body-ambiguous',
      contacts,
      caughtGeometry: null,
    }
  }
  return { reason: 'approved', contacts, caughtGeometry: caught }

}

/** Pure N37 predicate; Rapier and fixed-step sampling remain adapter-owned. */
export function evaluateGrip(
  profile: GripProfile | null,
  observations: readonly GripCandidateObservation[],
): GripEvaluation {
  if (!validProfile(profile) || observations.length === 0) {
    return {
      approved: false,
      reason: 'grip-collider-ambiguous',
      diagnostics: diagnostics(
        profile,
        observations[0] ?? null,
        EMPTY_CONTACTS,
        observations.length,
        observations.map((observation) => observation.fixedStep),
        null,
      ),
      quality: EMPTY_QUALITY,
    }
  }

  const samples = observations.map((observation) =>
    evaluateSample(profile, observation),
  )
  const firstFailure = samples.find((sample) => sample.reason !== 'approved')
  const lastObservation = observations.at(-1)!
  const lastSample = samples.at(-1)!
  const fixedSteps = observations.map((observation) => observation.fixedStep)
  const runIds = observations.map((observation) => observation.runId)
  const expectedRunIds = observations.map(
    (observation) => observation.expectedRunId,
  )
  const sameRunEpoch =
    runIds.every((runId) => runId === runIds[0]) &&
    expectedRunIds.every((runId) => runId === expectedRunIds[0]) &&
    runIds[0] === expectedRunIds[0]
  if (!sameRunEpoch) {
    return {
      approved: false,
      reason: 'grip-stale-observation',
      diagnostics: diagnostics(
        profile,
        lastObservation,
        lastSample.contacts,
        observations.length,
        fixedSteps,
        lastSample.caughtGeometry,
      ),
      quality: qualityFor(lastSample.caughtGeometry),
    }
  }
  const stepsAreConsecutive = fixedSteps.every(
    (step, index) => index === 0 || step === fixedSteps[index - 1] + 1,
  )
  if (firstFailure) {
    return {
      approved: false,
      reason: firstFailure.reason,
      diagnostics: diagnostics(
        profile,
        lastObservation,
        lastSample.contacts,
        observations.length,
        fixedSteps,
        lastSample.caughtGeometry,
      ),
      quality: qualityFor(lastSample.caughtGeometry),
    }
  }
  if (observations.length < profile.settlingSteps || !stepsAreConsecutive) {
    return {
      approved: false,
      reason: 'grip-unstable-contact',
      diagnostics: diagnostics(
        profile,
        lastObservation,
        lastSample.contacts,
        observations.length,
        fixedSteps,
        lastSample.caughtGeometry,
      ),
      quality: qualityFor(lastSample.caughtGeometry),
    }
  }
  return {
    approved: true,
    reason: 'approved',
    diagnostics: diagnostics(
      profile,
      lastObservation,
      lastSample.contacts,
      observations.length,
      fixedSteps,
      lastSample.caughtGeometry,
    ),
    quality: qualityFor(lastSample.caughtGeometry),
  }
}
