import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { resolveColliderProfile } from '../assets/collider-profiles'
import { createN39Evidence } from './n39-evidence'

describe('N39 mesh-to-collider derivation policy', () => {
  it('prefers authored profiles and generates bounded, grip-neutral candidates', () => {
    const evidence = createN39Evidence()
    expect(evidence.status).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.algorithmRevision).toBe('n39-geometry-candidate-rev1')
    expect(evidence.claims).toMatchObject({
      authoredProfilePreferred: true,
      candidateDoesNotAuthorizeGrip: true,
      stableProfileIdentity: true,
    })
    expect(evidence.fixtures.simpleBox).toMatchObject({
      status: 'candidate',
      failureCode: null,
      profile: { topology: 'box-like', gripContactRegions: null },
    })
    expect(evidence.fixtures.authoredPrecedence).toMatchObject({
      status: 'authored',
      profile: { profileId: 'authored-fixture-rev1' },
    })
  })

  it('applies canonical scale/rotation and rejects unsupported or unsafe geometry', () => {
    const evidence = createN39Evidence()
    expect(evidence.claims).toMatchObject({
      canonicalTransformApplied: true,
      unsupportedGeometryBlocked: true,
      invalidGeometryBlocked: true,
      toleranceBlocked: true,
      missingRegistrationBlocked: true,
    })
    expect(evidence.fixtures.rotatedScaled.profile).toMatchObject({
      shapes: [{ dimensions: [3, 1, 2] }],
    })
    expect(evidence.fixtures.concave).toMatchObject({
      status: 'rejected',
      failureCode: 'collider-candidate-rejected',
      blockReason: 'grip-collider-ambiguous',
    })
    expect(evidence.fixtures.missingGeometry).toMatchObject({
      status: 'rejected',
      blockReason: 'collision-registration-missing',
    })
  })

  it('does not silently derive a profile for an ambiguous mesh', () => {
    const result = resolveColliderProfile({
      sourceMeshId: 'ambiguous',
      geometryRevision: 'rev1',
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      authoredUnitScale: 1,
      authoredUpAxis: '+Y',
      authoredForwardAxis: '+Z',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
    })
    expect(result.status).toBe('rejected')
    expect(result.failureCode).toBe('collider-candidate-rejected')
    expect(result.blockReason).toBe('grip-collider-ambiguous')
  })

  it('publishes N39 evidence', async () => {
    const evidence = createN39Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n39-collider-derivation.json',
      JSON.stringify(evidence, null, 2),
    )
    expect(evidence).toMatchObject({
      node: 'N39',
      status: 'pass',
      deterministic: true,
    })
  })
})
