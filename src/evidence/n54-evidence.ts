import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG, type Vec3 } from '../physics/config'
import {
  DEFAULT_PRIZE_MANIFEST,
  prizeSubGeometries,
  type PrizeDefinition,
  type PrizeGeometryType,
} from '../playfield/prize-manifest'

const SETTLE_STEPS = 400
const POSITION_TOLERANCE = N6_PHYSICS_CONFIG.tolerances.repeatPosition
const FLOOR_TOLERANCE = 0.005
const SPHERE_HEIGHT_TOLERANCE = 0.01
const TAG_MINIMUM_CENTER_Y = 1.1
const POUCH_MINIMUM_CENTER_Y = 1.13
const HORIZONTAL_CAPSULE_QUATERNION: readonly [number, number, number, number] =
  [0, 0, Math.SQRT1_2, Math.SQRT1_2]

type Tuple3 = [number, number, number]

const GEOMETRIES: readonly PrizeGeometryType[] = [
  'sphere',
  'box',
  'soft-pouch',
  'tag',
  'strap',
  'loop',
]

interface VisualComponent {
  readonly center: Vec3
  readonly halfExtents: Vec3
  readonly kind?: 'sphere' | 'box'
}

const VISUAL_COMPONENTS: Readonly<
  Record<PrizeGeometryType, readonly VisualComponent[]>
> = {
  sphere: [
    { center: [0, 0, 0], halfExtents: [0.22, 0.22, 0.22], kind: 'sphere' },
  ],
  box: [{ center: [0, 0, 0], halfExtents: [0.22, 0.22, 0.22] }],
  'soft-pouch': [
    { center: [0, 0, 0], halfExtents: [0.21, 0.25, 0.14] },
    // PrizeBand is present on non-packaging prizes.
    { center: [0, 0, 0], halfExtents: [0.18, 0.03, 0.18] },
  ],
  tag: [
    { center: [0, 0, 0], halfExtents: [0.22, 0.22, 0.22], kind: 'sphere' },
    { center: [0, 0.24, 0], halfExtents: [0.08, 0.06, 0.015] },
  ],
  strap: [
    { center: [0, 0, 0], halfExtents: [0.22, 0.22, 0.22], kind: 'sphere' },
    // Three.js torusGeometry is in the local XY plane.
    { center: [0, 0.24, 0], halfExtents: [0.145, 0.145, 0.025] },
  ],
  loop: [
    { center: [0, 0, 0], halfExtents: [0.22, 0.22, 0.22], kind: 'sphere' },
    { center: [0, 0.24, 0], halfExtents: [0.145, 0.025, 0.145] },
  ],
}

function visualEnvelope(geometry: PrizeGeometryType): {
  readonly min: Tuple3
  readonly max: Tuple3
  readonly halfExtents: Tuple3
} {
  const min: Tuple3 = [Infinity, Infinity, Infinity]
  const max: Tuple3 = [-Infinity, -Infinity, -Infinity]
  for (const component of VISUAL_COMPONENTS[geometry]) {
    // StaticScene's PrizeRoot currently receives position/geometry only, so
    // the rendered visual remains at identity orientation.
    const center = component.center
    const extents = component.halfExtents

    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], center[axis] - extents[axis])
      max[axis] = Math.max(max[axis], center[axis] + extents[axis])
    }
  }
  return {
    min,
    max,
    halfExtents: [
      Math.max(Math.abs(max[0]), Math.abs(min[0])),
      Math.max(Math.abs(max[1]), Math.abs(min[1])),
      Math.max(Math.abs(max[2]), Math.abs(min[2])),
    ],
  }
}

function syntheticFallbackDefinition(
  geometry: PrizeGeometryType,
): PrizeDefinition {
  return {
    ...DEFAULT_PRIZE_MANIFEST.prizes[0],
    id: `n54-${geometry}`,
    geometry,
  }
}

function maxDelta(a: readonly number[], b: readonly number[]): number {
  return Math.max(...a.map((value, axis) => Math.abs(value - b[axis])))
}

function settleFixture() {
  return N6PhysicsAdapter.create({
    prizeManifest: DEFAULT_PRIZE_MANIFEST,
    persistPrizeState: false,
  })
}

async function runSettle() {
  const adapter = await settleFixture()
  try {
    adapter.stepMany(SETTLE_STEPS)
    const prizes = DEFAULT_PRIZE_MANIFEST.prizes.map((definition) => {
      const transform = adapter.transformPrize(definition.id)
      const position = transform.position
      const envelope = visualEnvelope(definition.geometry)
      const bottom = position[1] + envelope.min[1]
      const rightWallClearance = 1.65 - (position[0] + envelope.max[0])
      const leftWallClearance = position[0] + envelope.min[0] + 1.65
      const frontWallClearance = 0.83 - (position[2] + envelope.max[2])
      const backWallClearance = position[2] + envelope.min[2] + 0.83
      const wallClearance = {
        x: Math.min(rightWallClearance, leftWallClearance),
        z: Math.min(frontWallClearance, backWallClearance),
      }
      return {
        id: definition.id,
        geometry: definition.geometry,
        position,
        visualOrientation: [0, 0, 0, 1],
        visualEnvelopeHalfExtents: envelope.halfExtents,
        visualBottom: bottom,
        floorClear: bottom >= N6_PHYSICS_CONFIG.basePlane.y - FLOOR_TOLERANCE,
        wallClearance,
        wallClear: wallClearance.x > 0 && wallClearance.z > 0,
        expectedHeight:
          definition.geometry === 'sphere'
            ? { target: 1.109, tolerance: SPHERE_HEIGHT_TOLERANCE }
            : definition.geometry === 'tag'
              ? { minimum: TAG_MINIMUM_CENTER_Y }
              : definition.geometry === 'soft-pouch'
                ? { minimum: POUCH_MINIMUM_CENTER_Y }
                : null,
        settleHeightClear:
          definition.geometry === 'sphere'
            ? Math.abs(position[1] - 1.109) <= SPHERE_HEIGHT_TOLERANCE
            : definition.geometry === 'tag'
              ? position[1] >= TAG_MINIMUM_CENTER_Y
              : definition.geometry === 'soft-pouch'
                ? position[1] >= POUCH_MINIMUM_CENTER_Y
                : true,
      }
    })
    const inventory = adapter.diagnosticInventory()
    const prizeColliderIdentities = inventory.identities.filter(
      (identity) => identity.entity === 'collider' && identity.role === 'prize',
    )
    const prizeColliderCount = prizeColliderIdentities.length
    const prizeColliderCounts = Object.fromEntries(
      DEFAULT_PRIZE_MANIFEST.prizes.map((definition) => [
        definition.id,
        prizeColliderIdentities.filter((identity) =>
          definition.id === DEFAULT_PRIZE_MANIFEST.prizes[0].id
            ? identity.colliderId === 'prize-collider'
            : identity.colliderId.startsWith(`prize-${definition.id}-`),
        ).length,
      ]),
    ) as Record<string, number>
    return { prizes, prizeColliderCount, prizeColliderCounts }
  } finally {
    adapter.dispose()
  }
}

async function runRepeatability() {
  const [first, second] = await Promise.all([runSettle(), runSettle()])
  const deltas = first.prizes.map((prize, index) => ({
    id: prize.id,
    delta: maxDelta(prize.position, second.prizes[index].position),
  }))
  return {
    runs: 2,
    deltas,
    withinTolerance: deltas.every(({ delta }) => delta <= POSITION_TOLERANCE),
  }
}

function primitiveContract() {
  const byGeometry = Object.fromEntries(
    GEOMETRIES.map((geometry) => [
      geometry,
      prizeSubGeometries(syntheticFallbackDefinition(geometry)),
    ]),
  ) as Record<PrizeGeometryType, ReturnType<typeof prizeSubGeometries>>
  const body = (geometry: PrizeGeometryType) => byGeometry[geometry][0]
  const packaging = (geometry: 'tag' | 'strap' | 'loop') =>
    byGeometry[geometry][1]
  const vectorEquals = (
    actual: readonly number[],
    expected: readonly number[],
  ) => actual.every((value, index) => value === expected[index])

  const bodyShapesMatch =
    GEOMETRIES.every(
      (geometry) =>
        vectorEquals(body(geometry).position, [0, 0, 0]) &&
        vectorEquals(body(geometry).quaternion, [0, 0, 0, 1]),
    ) &&
    body('sphere').shape === 'sphere' &&
    body('sphere').radius === 0.22 &&
    body('box').shape === 'box' &&
    vectorEquals(body('box').halfExtents!, [0.22, 0.22, 0.22]) &&
    body('soft-pouch').shape === 'box' &&
    vectorEquals(body('soft-pouch').halfExtents!, [0.21, 0.25, 0.14]) &&
    body('tag').shape === 'sphere' &&
    body('tag').radius === 0.22 &&
    body('strap').shape === 'sphere' &&
    body('strap').radius === 0.22 &&
    body('loop').shape === 'sphere' &&
    body('loop').radius === 0.22
  const packagingMatches =
    packaging('tag').shape === 'box' &&
    vectorEquals(packaging('tag').position, [0, 0.24, 0]) &&
    vectorEquals(packaging('tag').halfExtents!, [0.08, 0.06, 0.015]) &&
    packaging('tag').retentionFactor === 0.42 &&
    packaging('strap').shape === 'capsule' &&
    vectorEquals(packaging('strap').position, [0, 0.24, 0]) &&
    vectorEquals(
      packaging('strap').quaternion,
      HORIZONTAL_CAPSULE_QUATERNION,
    ) &&
    packaging('strap').radius === 0.025 &&
    packaging('strap').halfHeight === 0.12 &&
    packaging('strap').retentionFactor === 0.5 &&
    packaging('loop').shape === 'capsule' &&
    vectorEquals(packaging('loop').position, [0, 0.24, 0]) &&
    vectorEquals(packaging('loop').quaternion, HORIZONTAL_CAPSULE_QUATERNION) &&
    packaging('loop').radius === 0.025 &&
    packaging('loop').halfHeight === 0.12 &&
    packaging('loop').retentionFactor === 0.55
  const captureTargetsAndRetention =
    ['sphere', 'box', 'soft-pouch'].every(
      (geometry) =>
        body(geometry as 'sphere' | 'box' | 'soft-pouch').captureTarget,
    ) &&
    GEOMETRIES.every((geometry) => body(geometry).retentionFactor === 1) &&
    ['tag', 'strap', 'loop'].every(
      (geometry) => !body(geometry as 'tag' | 'strap' | 'loop').captureTarget,
    ) &&
    ['tag', 'strap', 'loop'].every(
      (geometry) =>
        packaging(geometry as 'tag' | 'strap' | 'loop').captureTarget,
    )

  return {
    byGeometry,
    bodyShapesMatch,
    packagingMatches,
    captureTargetsAndRetention,
    bodyFirst: GEOMETRIES.every(
      (geometry) => byGeometry[geometry][0].region === 'body',
    ),
    declaredPrimitiveCounts: Object.fromEntries(
      GEOMETRIES.map((geometry) => [geometry, byGeometry[geometry].length]),
    ),
  }
}

export async function createN54Evidence() {
  const [settled, repeatability] = await Promise.all([
    runSettle(),
    runRepeatability(),
  ])
  const contract = primitiveContract()
  const floorAndWallClear = settled.prizes.every(
    (prize) => prize.floorClear && prize.wallClear && prize.settleHeightClear,
  )
  const expectedColliderCounts = Object.fromEntries(
    DEFAULT_PRIZE_MANIFEST.prizes.map((prize) => [
      prize.id,
      prizeSubGeometries(prize).length,
    ]),
  ) as Record<string, number>
  const expectedColliderCount = Object.values(expectedColliderCounts).reduce(
    (count, value) => count + value,
    0,
  )
  const colliderCountsMatch = DEFAULT_PRIZE_MANIFEST.prizes.every(
    (prize) =>
      settled.prizeColliderCounts[prize.id] ===
      expectedColliderCounts[prize.id],
  )
  const pass =
    floorAndWallClear &&
    repeatability.withinTolerance &&
    settled.prizeColliderCount === expectedColliderCount &&
    colliderCountsMatch &&
    contract.bodyShapesMatch &&
    contract.packagingMatches &&
    contract.captureTargetsAndRetention &&
    contract.bodyFirst

  return {
    node: 'N54',
    status: pass ? 'pass' : 'fail',
    deterministic: true,
    fixedStep: {
      revision: N6_PHYSICS_CONFIG.revision,
      dt: N6_PHYSICS_CONFIG.dt,
      settleSteps: SETTLE_STEPS,
    },
    contract: {
      ...contract,
      expectedColliderCounts,
      actualColliderCounts: settled.prizeColliderCounts,
      expectedColliderCount,
      actualColliderCount: settled.prizeColliderCount,
      colliderCountMatches:
        settled.prizeColliderCount === expectedColliderCount &&
        colliderCountsMatch,
    },
    settle: {
      manifestRevision: DEFAULT_PRIZE_MANIFEST.revision,
      floorTop: N6_PHYSICS_CONFIG.basePlane.y,
      floorTolerance: FLOOR_TOLERANCE,
      chamberInnerBounds: { x: 1.65, z: 0.83 },
      prizes: settled.prizes,
      floorAndWallClear,
    },
    repeatability,
    failureResults: pass
      ? []
      : [
          ...settled.prizes.flatMap((prize) => [
            ...(prize.floorClear
              ? []
              : [{ prize: prize.id, reason: 'clip-through-floor' }]),
            ...(prize.wallClear
              ? []
              : [{ prize: prize.id, reason: 'clip-through-glass' }]),
            ...(prize.settleHeightClear
              ? []
              : [{ prize: prize.id, reason: 'settle-height-drift' }]),
          ]),
          ...(colliderCountsMatch &&
          settled.prizeColliderCount === expectedColliderCount
            ? []
            : [{ reason: 'collider-count-drift' }]),
        ],
    verificationCommands: [
      'npm run typecheck',
      'npm run lint',
      'npm test',
      'npm run build',
    ],
  }
}
