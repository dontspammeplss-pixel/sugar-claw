import {
  N39_DERIVATION_ALGORITHM_REVISION,
  resolveColliderProfile,
  type N39GeometryInput,
} from '../assets/collider-profiles'

const BOX_POSITIONS = [
  -0.5, -0.5, -0.5,
  0.5, -0.5, -0.5,
  0.5, 0.5, -0.5,
  -0.5, 0.5, -0.5,
  -0.5, -0.5, 0.5,
  0.5, -0.5, 0.5,
  0.5, 0.5, 0.5,
  -0.5, 0.5, 0.5,
]
const BOX_INDICES = [
  0, 1, 2, 0, 2, 3,
  4, 6, 5, 4, 7, 6,
  0, 4, 5, 0, 5, 1,
  3, 2, 6, 3, 6, 7,
  0, 3, 7, 0, 7, 4,
  1, 5, 6, 1, 6, 2,
]

function fixture(
  overrides: Partial<N39GeometryInput> = {},
): N39GeometryInput {
  return {
    sourceMeshId: 'fixture-box',
    geometryRevision: 'mesh-rev1',
    positions: BOX_POSITIONS,
    indices: BOX_INDICES,
    topology: 'box-like',
    authoredUnitScale: 1,
    authoredUpAxis: '+Y',
    authoredForwardAxis: '+Z',
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    ...overrides,
  }
}

export function createN39Evidence() {
  const candidate = resolveColliderProfile(
    fixture({ expectedBounds: { width: 1, height: 1, depth: 1 } }),
  )
  const transformed = resolveColliderProfile(
    fixture({
      transform: {
        position: [4, 8, -2],
        rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
        scale: [2, 1, 3],
      },
      expectedBounds: { width: 3, height: 1, depth: 2 },
    }),
  )
  const authored = resolveColliderProfile(
    fixture({
      authoredProfile: {
        profileId: 'authored-fixture-rev1',
        sourceMeshId: 'fixture-box',
        revision: 'authored-rev1',
        shapes: [
          {
            kind: 'sphere',
            dimensions: [0.9, 0.9, 0.9],
            localTransform: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
          },
        ],
        runtimePolicy: {
          bodyType: 'dynamic',
          mode: 'solver',
          collisionGroup: 2,
          collisionMask: 12,
          solverMask: 12,
          friction: 0.7,
          restitution: 0,
          ccd: true,
          sleeping: true,
        },
        gripContactRegions: ['authored-grip-region'],
      },
    }),
  )
  const concave = resolveColliderProfile(fixture({ topology: 'concave' }))
  const hollow = resolveColliderProfile(fixture({ topology: 'hollow' }))
  const articulated = resolveColliderProfile(fixture({ topology: 'articulated' }))
  const invalid = resolveColliderProfile(
    fixture({ positions: [0, 0, Number.NaN], topology: 'box-like' }),
  )
  const outOfTolerance = resolveColliderProfile(
    fixture({
      expectedBounds: { width: 2, height: 1, depth: 1 },
      approximationTolerance: 0.05,
    }),
  )
  const missing = resolveColliderProfile(
    fixture({ indices: [], topology: undefined }),
  )
  const deterministicRepeat = resolveColliderProfile(fixture())

  const pass =
    candidate.status === 'candidate' &&
    candidate.profile.shapes[0].kind === 'box' &&
    candidate.profile.gripContactRegions === null &&
    transformed.status === 'candidate' &&
    JSON.stringify(transformed.profile.shapes[0].dimensions) ===
      JSON.stringify([3, 1, 2]) &&
    authored.status === 'authored' &&
    authored.profile.profileId === 'authored-fixture-rev1' &&
    concave.status === 'rejected' &&
    concave.failureCode === 'collider-candidate-rejected' &&
    hollow.status === 'rejected' &&
    articulated.status === 'rejected' &&
    invalid.status === 'rejected' &&
    invalid.failureCode === 'collider-derivation-inconclusive' &&
    outOfTolerance.failureCode === 'collider-approximation-out-of-tolerance' &&
    missing.blockReason === 'collision-registration-missing' &&
    deterministicRepeat.status === 'candidate' &&
    candidate.status === deterministicRepeat.status &&
    candidate.profile.profileId === deterministicRepeat.profile.profileId

  return {
    node: 'N39',
    status: pass ? 'pass' : 'fail',
    deterministic: true,
    algorithmRevision: N39_DERIVATION_ALGORITHM_REVISION,
    authority: {
      assetBoundary: 'src/assets/collider-profiles.ts',
      runtimeProfiles: 'src/physics/config.ts',
      runtimeInstantiation: 'src/physics/adapter.ts',
      evidence: 'src/evidence/n39-evidence.ts',
      gripInference: false,
    },
    fixtures: {
      simpleBox: candidate,
      rotatedScaled: transformed,
      authoredPrecedence: authored,
      concave,
      hollow,
      articulated,
      invalidGeometry: invalid,
      outOfTolerance,
      missingGeometry: missing,
    },
    claims: {
      authoredProfilePreferred: authored.status === 'authored',
      canonicalTransformApplied:
        transformed.status === 'candidate' &&
        JSON.stringify(transformed.profile.shapes[0].dimensions) ===
          JSON.stringify([3, 1, 2]),
      candidateDoesNotAuthorizeGrip:
        candidate.status === 'candidate' &&
        candidate.profile.gripContactRegions === null,
      unsupportedGeometryBlocked:
        [concave, hollow, articulated].every(
          (result) => result.status === 'rejected',
        ),
      invalidGeometryBlocked: invalid.status === 'rejected',
      toleranceBlocked:
        outOfTolerance.failureCode === 'collider-approximation-out-of-tolerance',
      missingRegistrationBlocked:
        missing.blockReason === 'collision-registration-missing',
      stableProfileIdentity:
        candidate.status === 'candidate' &&
        deterministicRepeat.status === 'candidate' &&
        candidate.profile.profileId === deterministicRepeat.profile.profileId,
    },
    verificationCommands: [
      'npm run typecheck',
      'npm run lint',
      'npm test',
      'npm run build',
    ],
  }
}

export async function serializeN39Evidence(): Promise<string> {
  return JSON.stringify(createN39Evidence(), null, 2)
}
