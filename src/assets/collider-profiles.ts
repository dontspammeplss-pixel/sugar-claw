import type { Quat, Vec3 } from '../types/geometry'

export const N39_DERIVATION_ALGORITHM_REVISION = 'n39-geometry-candidate-rev1'
export const N39_DEFAULT_APPROXIMATION_TOLERANCE = 0.05

export type N39ShapeKind = 'sphere' | 'box' | 'capsule'
export type N39Topology =
  | 'convex'
  | 'box-like'
  | 'concave'
  | 'hollow'
  | 'articulated'
  | 'non-manifold'
  | 'unknown'
export type N39FailureCode =
  | 'collider-candidate-rejected'
  | 'collider-profile-missing'
  | 'collider-approximation-out-of-tolerance'
  | 'collider-derivation-inconclusive'

export type N39BlockReason =
  | 'grip-collider-ambiguous'
  | 'collision-registration-missing'

export interface N39Bounds {
  readonly width: number
  readonly height: number
  readonly depth: number
}

export interface N39LocalTransform {
  readonly position: Vec3
  readonly rotation: Quat
}

export interface N39ColliderShape {
  readonly kind: N39ShapeKind
  readonly dimensions: Vec3
  readonly localTransform: N39LocalTransform
}

/** Runtime behavior is authored data; candidates deliberately do not fill it in. */
export interface N39RuntimePolicy {
  readonly bodyType: 'dynamic' | 'kinematic' | 'fixed'
  readonly mode: 'sensor' | 'solver'
  readonly collisionGroup: number
  readonly collisionMask: number
  readonly solverMask: number
  readonly friction: number
  readonly restitution: number
  readonly ccd: boolean
  readonly sleeping: boolean
}

export interface N39AuthoredColliderProfile {
  readonly profileId: string
  readonly sourceMeshId: string
  readonly revision: string
  readonly shapes: readonly N39ColliderShape[]
  readonly runtimePolicy: N39RuntimePolicy
  readonly gripContactRegions?: readonly string[]
}

export interface N39CanonicalAssetTransform {
  readonly position: Vec3
  readonly rotation: Quat
  readonly scale: Vec3
  readonly authoredUnitScale: number
  readonly authoredUpAxis: '+Y'
  readonly authoredForwardAxis: '+Z' | '-Z'
}

export interface N39CandidateColliderProfile {
  readonly profileId: string
  readonly sourceMeshId: string
  readonly geometryRevision: string
  readonly geometryHash: string
  readonly algorithmRevision: string
  readonly topology: N39Topology
  readonly canonicalTransform: N39CanonicalAssetTransform
  readonly shapes: readonly N39ColliderShape[]
  readonly runtimePolicy: null
  readonly gripContactRegions: null
  readonly approximation: {
    readonly relativeBoundsError: number
    readonly clearanceError: number
    readonly tolerance: number
  }
}

export interface N39GeometryInput {
  readonly sourceMeshId: string
  readonly geometryRevision: string
  /** Position triples in the asset's canonical local coordinate space. */
  readonly positions: readonly number[]
  readonly indices: readonly number[]
  /** Classification supplied by the validated asset boundary when available. */
  readonly topology?: N39Topology
  readonly authoredUnitScale: number
  readonly authoredUpAxis: '+Y'
  readonly authoredForwardAxis: '+Z' | '-Z'
  readonly transform: {
    readonly position: Vec3
    readonly rotation: Quat
    readonly scale: Vec3
  }
  readonly authoredProfile?: N39AuthoredColliderProfile | null
  readonly expectedBounds?: N39Bounds
  readonly approximationTolerance?: number
}

export interface N39DerivationDiagnostic {
  readonly sourceMeshId: string
  readonly geometryRevision: string
  readonly geometryHash: string | null
  readonly algorithmRevision: string
  readonly topology: N39Topology | null
  readonly chosenShape: N39ShapeKind | null
  readonly dimensions: Vec3 | null
  readonly canonicalTransform: N39CanonicalAssetTransform | null
  readonly reason: string | null
}

export type N39Resolution =
  | {
      readonly status: 'authored'
      readonly profile: N39AuthoredColliderProfile
      readonly failureCode: null
      readonly blockReason: null
      readonly diagnostic: N39DerivationDiagnostic
    }
  | {
      readonly status: 'candidate'
      readonly profile: N39CandidateColliderProfile
      readonly failureCode: null
      readonly blockReason: null
      readonly diagnostic: N39DerivationDiagnostic
    }
  | {
      readonly status: 'rejected'
      readonly profile: null
      readonly failureCode: N39FailureCode
      readonly blockReason: N39BlockReason
      readonly diagnostic: N39DerivationDiagnostic
    }

function freezeVec3(value: Vec3): Vec3 {
  return Object.freeze([...value]) as unknown as Vec3
}

function freezeQuat(value: Quat): Quat {
  return Object.freeze([...value]) as unknown as Quat
}

function freezeTransform(
  value: N39LocalTransform,
): N39LocalTransform {
  return Object.freeze({
    position: freezeVec3(value.position),
    rotation: freezeQuat(value.rotation),
  })
}

function finite(values: readonly number[]): boolean {
  return values.every(Number.isFinite)
}

function positive(values: readonly number[]): boolean {
  return values.every((value) => Number.isFinite(value) && value > 0)
}

function validQuaternion(value: Quat): boolean {
  return finite(value) && Math.abs(value[0] ** 2 + value[1] ** 2 + value[2] ** 2 + value[3] ** 2 - 1) <= 0.0001
}

function round(value: number): string {
  return value.toFixed(6)
}

/** Small deterministic hash; avoids a runtime crypto dependency in the asset boundary. */
function hash(value: string): string {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}

function geometryHash(input: N39GeometryInput): string {
  const vertices = Array.from({ length: input.positions.length / 3 }, (_, index) =>
    [
      round(input.positions[index * 3]),
      round(input.positions[index * 3 + 1]),
      round(input.positions[index * 3 + 2]),
    ].join(','),
  ).sort()
  const triangles: string[] = []
  for (let index = 0; index < input.indices.length; index += 3) {
    const triangle = [
      input.indices[index],
      input.indices[index + 1],
      input.indices[index + 2],
    ].map((vertexIndex) => verticesForHash(input, vertexIndex))
    triangle.sort()
    triangles.push(triangle.join(';'))
  }
  triangles.sort()
  return hash(
    `${vertices.join('|')}#${triangles.join('|')}|unit:${round(input.authoredUnitScale)}|up:${input.authoredUpAxis}|forward:${input.authoredForwardAxis}|scale:${input.transform.scale.map(round).join(',')}|rotation:${input.transform.rotation.map(round).join(',')}`,
  )
}

function safeGeometryHash(input: N39GeometryInput): string | null {
  try {
    return geometryHash(input)
  } catch {
    return null
  }
}

function verticesForHash(input: N39GeometryInput, vertexIndex: number): string {
  const offset = vertexIndex * 3
  return [
    round(input.positions[offset]),
    round(input.positions[offset + 1]),
    round(input.positions[offset + 2]),
  ].join(',')
}

function rotateVector(value: Vec3, rotation: Quat): Vec3 {
  const [x, y, z, w] = rotation
  const tx = 2 * (y * value[2] - z * value[1])
  const ty = 2 * (z * value[0] - x * value[2])
  const tz = 2 * (x * value[1] - y * value[0])
  return [
    value[0] + w * tx + y * tz - z * ty,
    value[1] + w * ty + z * tx - x * tz,
    value[2] + w * tz + x * ty - y * tx,
  ]
}

function bounds(input: N39GeometryInput): N39Bounds | null {
  if (input.positions.length === 0 || input.positions.length % 3 !== 0) return null
  const minimum = [Infinity, Infinity, Infinity]
  const maximum = [-Infinity, -Infinity, -Infinity]
  for (let index = 0; index < input.positions.length; index += 3) {
    const local = [
      input.positions[index],
      input.positions[index + 1],
      input.positions[index + 2],
    ] as unknown as Vec3
    if (!finite(local)) return null
    const scaled = local.map(
      (value, axis) => value * input.transform.scale[axis] * input.authoredUnitScale,
    ) as unknown as Vec3
    const canonical = rotateVector(scaled, input.transform.rotation)
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], canonical[axis])
      maximum[axis] = Math.max(maximum[axis], canonical[axis])
    }
  }
  const dimensions = maximum.map((value, axis) => value - minimum[axis])
  if (!positive(dimensions)) return null
  return {
    width: dimensions[0],
    height: dimensions[1],
    depth: dimensions[2],
  }
}

function relativeBoundsError(actual: N39Bounds, expected: N39Bounds): number {
  return Math.max(
    Math.abs(actual.width - expected.width) / expected.width,
    Math.abs(actual.height - expected.height) / expected.height,
    Math.abs(actual.depth - expected.depth) / expected.depth,
  )
}

function topology(input: N39GeometryInput): N39Topology {
  if (input.positions.length % 3 !== 0 || input.indices.length % 3 !== 0) {
    return 'unknown'
  }
  const vertexCount = input.positions.length / 3
  if (
    input.indices.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= vertexCount,
    )
  ) {
    return 'non-manifold'
  }
  const edges = new Map<string, number>()
  for (let index = 0; index < input.indices.length; index += 3) {
    const triangle = [
      input.indices[index],
      input.indices[index + 1],
      input.indices[index + 2],
    ]
    for (let edge = 0; edge < 3; edge += 1) {
      const left = triangle[edge]
      const right = triangle[(edge + 1) % 3]
      const key = left < right ? `${left}:${right}` : `${right}:${left}`
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  if (edges.size === 0 || [...edges.values()].some((count) => count !== 2)) {
    return 'non-manifold'
  }
  return input.topology ?? 'unknown'
}

function convexish(input: N39GeometryInput): boolean {
  const epsilon = 0.000001
  for (let index = 0; index < input.indices.length; index += 3) {
    const aIndex = input.indices[index] * 3
    const bIndex = input.indices[index + 1] * 3
    const cIndex = input.indices[index + 2] * 3
    const ax = input.positions[aIndex]
    const ay = input.positions[aIndex + 1]
    const az = input.positions[aIndex + 2]
    const ab = [
      input.positions[bIndex] - ax,
      input.positions[bIndex + 1] - ay,
      input.positions[bIndex + 2] - az,
    ]
    const ac = [
      input.positions[cIndex] - ax,
      input.positions[cIndex + 1] - ay,
      input.positions[cIndex + 2] - az,
    ]
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ]
    const normalLength = Math.hypot(...normal)
    if (normalLength <= epsilon) return false
    let positiveSide = false
    let negativeSide = false
    for (let vertex = 0; vertex < input.positions.length; vertex += 3) {
      const distance =
        normal[0] * (input.positions[vertex] - ax) +
        normal[1] * (input.positions[vertex + 1] - ay) +
        normal[2] * (input.positions[vertex + 2] - az)
      positiveSide ||= distance > epsilon
      negativeSide ||= distance < -epsilon
      if (positiveSide && negativeSide) return false
    }
  }
  return true
}

function diagnostic(
  input: N39GeometryInput,
  values: Partial<N39DerivationDiagnostic> = {},
): N39DerivationDiagnostic {
  return Object.freeze({
    sourceMeshId: input.sourceMeshId,
    geometryRevision: input.geometryRevision,
    geometryHash: values.geometryHash ?? null,
    algorithmRevision: N39_DERIVATION_ALGORITHM_REVISION,
    topology: values.topology ?? null,
    chosenShape: values.chosenShape ?? null,
    dimensions: values.dimensions ? freezeVec3(values.dimensions) : null,
    canonicalTransform: values.canonicalTransform
      ? Object.freeze({
          position: freezeVec3(values.canonicalTransform.position),
          rotation: freezeQuat(values.canonicalTransform.rotation),
          scale: freezeVec3(values.canonicalTransform.scale),
          authoredUnitScale: values.canonicalTransform.authoredUnitScale,
          authoredUpAxis: values.canonicalTransform.authoredUpAxis,
          authoredForwardAxis: values.canonicalTransform.authoredForwardAxis,
        })
      : null,
    reason: values.reason ?? null,
  })
}

function rejection(
  input: N39GeometryInput,
  failureCode: N39FailureCode,
  reason: string,
  topologyValue: N39Topology | null = null,
): N39Resolution {
  return {
    status: 'rejected',
    profile: null,
    failureCode,
    blockReason:
      failureCode === 'collider-derivation-inconclusive'
        ? 'collision-registration-missing'
        : 'grip-collider-ambiguous',
    diagnostic: diagnostic(input, {
      topology: topologyValue,
      reason,
    }),
  }
}

function validAuthoredProfile(
  input: N39GeometryInput,
): N39AuthoredColliderProfile | null {
  const profile = input.authoredProfile
  if (!profile || profile.sourceMeshId !== input.sourceMeshId) return null
  if (!profile.profileId.trim() || !profile.revision.trim()) return null
  if (profile.shapes.length === 0 || !profile.runtimePolicy) return null
  if (
    profile.shapes.some(
      (shape) =>
        !positive(shape.dimensions) ||
        !finite(shape.localTransform.position) ||
        !validQuaternion(shape.localTransform.rotation),
    )
  ) {
    return null
  }
  return profile
}

function canonicalTransform(input: N39GeometryInput): N39CanonicalAssetTransform {
  return Object.freeze({
    position: freezeVec3(input.transform.position),
    rotation: freezeQuat(input.transform.rotation),
    scale: freezeVec3(input.transform.scale),
    authoredUnitScale: input.authoredUnitScale,
    authoredUpAxis: input.authoredUpAxis,
    authoredForwardAxis: input.authoredForwardAxis,
  })
}

export function resolveColliderProfile(input: N39GeometryInput): N39Resolution {
  const authored = validAuthoredProfile(input)
  if (input.authoredProfile && !authored) {
    return rejection(
      input,
      'collider-profile-missing',
      'authored collider profile is present but invalid',
    )
  }
  if (authored) {
    return {
      status: 'authored',
      profile: Object.freeze({
        ...authored,
        shapes: Object.freeze(
          authored.shapes.map((shape) =>
            Object.freeze({
              ...shape,
              dimensions: freezeVec3(shape.dimensions),
              localTransform: freezeTransform(shape.localTransform),
            }),
          ),
        ),
      }),
      failureCode: null,
      blockReason: null,
      diagnostic: diagnostic(input, {
        geometryHash: safeGeometryHash(input),
        topology: topology(input),
        canonicalTransform: canonicalTransform(input),
        reason: 'authored profile preferred',
      }),
    }
  }

  if (
    !input.sourceMeshId.trim() ||
    !input.geometryRevision.trim() ||
    !Number.isFinite(input.authoredUnitScale) ||
    input.authoredUnitScale <= 0 ||
    !finite(input.transform.position) ||
    !finite(input.transform.rotation) ||
    !finite(input.transform.scale) ||
    !positive(input.transform.scale) ||
    !validQuaternion(input.transform.rotation) ||
    !input.authoredUpAxis ||
    !input.authoredForwardAxis
  ) {
    return rejection(
      input,
      'collider-derivation-inconclusive',
      'canonical asset transform, unit scale, axes, or dimensions are invalid',
    )
  }
  if (input.indices.length === 0) {
    return rejection(
      input,
      'collider-derivation-inconclusive',
      'mesh topology is missing; a candidate cannot be registered safely',
    )
  }
  if (!finite(input.positions)) {
    return rejection(
      input,
      'collider-derivation-inconclusive',
      'mesh positions contain non-finite values',
    )
  }
  const topologyValue = topology(input)
  const allowedTopology = topologyValue === 'convex' || topologyValue === 'box-like'
  if (!allowedTopology) {
    return rejection(
      input,
      topologyValue === 'unknown'
        ? 'collider-derivation-inconclusive'
        : 'collider-candidate-rejected',
      `automatic derivation rejected for ${topologyValue} geometry`,
      topologyValue,
    )
  }
  if (!convexish(input)) {
    return rejection(
      input,
      'collider-candidate-rejected',
      'validated topology is not convex-ish; authored profile required',
      'concave',
    )
  }
  const actualBounds = bounds(input)
  if (!actualBounds) {
    return rejection(
      input,
      'collider-derivation-inconclusive',
      'mesh positions are missing, non-finite, or degenerate',
      topologyValue,
    )
  }
  const tolerance = input.approximationTolerance ?? N39_DEFAULT_APPROXIMATION_TOLERANCE
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return rejection(
      input,
      'collider-derivation-inconclusive',
      'approximation tolerance is invalid',
      topologyValue,
    )
  }
  const expected = input.expectedBounds
  const error = expected ? relativeBoundsError(actualBounds, expected) : 0
  if (expected && (!positive([expected.width, expected.height, expected.depth]) || error > tolerance)) {
    return rejection(
      input,
      'collider-approximation-out-of-tolerance',
      `candidate bounds differ from authored bounds by ${error.toFixed(6)}`,
      topologyValue,
    )
  }
  const dimensions = freezeVec3([
    Number(actualBounds.width.toFixed(6)),
    Number(actualBounds.height.toFixed(6)),
    Number(actualBounds.depth.toFixed(6)),
  ])
  const hashValue = safeGeometryHash(input)
  if (!hashValue) {
    return rejection(
      input,
      'collider-derivation-inconclusive',
      'geometry identity could not be computed safely',
      topologyValue,
    )
  }
  const canonical = canonicalTransform(input)
  const profileId = `candidate:${input.sourceMeshId}:${input.geometryRevision}:${hashValue}:${N39_DERIVATION_ALGORITHM_REVISION}`
  const shape: N39ColliderShape = Object.freeze({
    kind: 'box',
    dimensions,
    localTransform: freezeTransform({
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
    }),
  })
  const profile: N39CandidateColliderProfile = Object.freeze({
    profileId,
    sourceMeshId: input.sourceMeshId,
    geometryRevision: input.geometryRevision,
    geometryHash: hashValue,
    algorithmRevision: N39_DERIVATION_ALGORITHM_REVISION,
    topology: topologyValue,
    canonicalTransform: canonical,
    shapes: Object.freeze([shape]),
    runtimePolicy: null,
    gripContactRegions: null,
    approximation: Object.freeze({
      relativeBoundsError: error,
      clearanceError: 0,
      tolerance,
    }),
  })
  return {
    status: 'candidate',
    profile,
    failureCode: null,
    blockReason: null,
    diagnostic: diagnostic(input, {
      geometryHash: hashValue,
      topology: topologyValue,
      chosenShape: 'box',
      dimensions,
      canonicalTransform: canonicalTransform(input),
      reason: 'bounded box candidate from validated convex-ish bounds',
    }),
  }
}
