import defaultPrizeManifestJson from './default-prize-manifest.json'
import type { Quat, Vec3 } from '../types/geometry'

export type PrizeGeometryType =
  'sphere' | 'box' | 'soft-pouch' | 'tag' | 'strap' | 'loop'

/** Convex primitives only: N39 does not authorize cloth or concave physics. */
export type PrizePrimitiveShape = 'sphere' | 'box' | 'capsule'
export type PrizeSubGeometryRegion =
  'body' | 'corner' | 'tag' | 'strap' | 'loop'

export interface PrizeSubGeometry {
  readonly id: string
  readonly region: PrizeSubGeometryRegion
  readonly shape: PrizePrimitiveShape
  readonly position: Vec3
  readonly quaternion: Quat
  readonly halfExtents?: Vec3
  readonly radius?: number
  readonly halfHeight?: number
  readonly captureTarget: boolean
  /** F-01 input: packaging catches retain less than a full body cage. */
  readonly retentionFactor: number
}

export interface PrizeOrientation {
  readonly quaternion: readonly [number, number, number, number]
}

export interface PrizeSpawnLayout {
  readonly density: number
  readonly angle: number
  readonly preset: string
}

export interface PrizeDefinition {
  readonly id: string
  readonly position: Vec3
  readonly orientation: PrizeOrientation
  readonly spawnLayout: PrizeSpawnLayout
  /** Declared physical mass in kg; weight is retained as F-01 load input. */
  readonly mass: number
  readonly weight: number
  readonly centerOfMass: Vec3
  readonly geometry: PrizeGeometryType
  /** N44 authored collider primitives; scene meshes never define grip. */
  readonly subGeometries?: readonly PrizeSubGeometry[]
}

export interface PrizeState {
  readonly id: string
  readonly position: Vec3
  readonly orientation: PrizeOrientation
  readonly won: boolean
  readonly removed: boolean
}

export interface PrizeManifest {
  readonly revision: string
  readonly spawnLayout: PrizeSpawnLayout
  readonly prizes: readonly PrizeDefinition[]
}

const GEOMETRY_TYPES: readonly PrizeGeometryType[] = [
  'sphere',
  'box',
  'soft-pouch',
  'tag',
  'strap',
  'loop',
]
const SUB_GEOMETRY_REGIONS: readonly PrizeSubGeometryRegion[] = [
  'body',
  'corner',
  'tag',
  'strap',
  'loop',
]
const PRIMITIVE_SHAPES: readonly PrizePrimitiveShape[] = [
  'sphere',
  'box',
  'capsule',
]
const ID_PATTERN = /^[a-z][a-z0-9-]*$/

function isFiniteVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

function isQuaternion(value: unknown): value is Quat {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

function isSpawnLayout(value: unknown): value is PrizeSpawnLayout {
  if (!value || typeof value !== 'object') return false
  const layout = value as Partial<PrizeSpawnLayout>
  return (
    typeof layout.preset === 'string' &&
    layout.preset.length > 0 &&
    typeof layout.density === 'number' &&
    Number.isFinite(layout.density) &&
    layout.density > 0 &&
    typeof layout.angle === 'number' &&
    Number.isFinite(layout.angle)
  )
}

function subGeometryErrors(value: unknown, prefix: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [`${prefix} must contain at least one primitive`]
  }
  const errors: string[] = []
  const ids = new Set<string>()
  let captureTargetCount = 0
  for (const [index, primitive] of value.entries()) {
    const path = `${prefix}[${index}]`
    if (!primitive || typeof primitive !== 'object') {
      errors.push(`${path} must be an object`)
      continue
    }
    const item = primitive as Partial<PrizeSubGeometry>
    if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) {
      errors.push(`${path}.id is invalid`)
    } else if (ids.has(item.id)) {
      errors.push(`${prefix} duplicate primitive ID: ${item.id}`)
    } else {
      ids.add(item.id)
    }
    if (!SUB_GEOMETRY_REGIONS.includes(item.region as PrizeSubGeometryRegion)) {
      errors.push(`${path}.region is invalid`)
    }
    if (!PRIMITIVE_SHAPES.includes(item.shape as PrizePrimitiveShape)) {
      errors.push(`${path}.shape is invalid`)
    }
    if (!isFiniteVec3(item.position)) errors.push(`${path}.position is invalid`)
    if (!isQuaternion(item.quaternion))
      errors.push(`${path}.quaternion is invalid`)
    if (typeof item.captureTarget !== 'boolean') {
      errors.push(`${path}.captureTarget must be boolean`)
    } else if (item.captureTarget) {
      captureTargetCount += 1
    }
    if (
      typeof item.retentionFactor !== 'number' ||
      !Number.isFinite(item.retentionFactor) ||
      item.retentionFactor <= 0 ||
      item.retentionFactor > 1
    ) {
      errors.push(`${path}.retentionFactor must be in (0, 1]`)
    }
    if (
      item.shape === 'box' &&
      (!isFiniteVec3(item.halfExtents) || item.halfExtents.some((n) => n <= 0))
    ) {
      errors.push(`${path}.halfExtents is required for box primitives`)
    }
    if (
      item.shape === 'sphere' &&
      (typeof item.radius !== 'number' ||
        !Number.isFinite(item.radius) ||
        item.radius <= 0)
    ) {
      errors.push(`${path}.radius is required for sphere primitives`)
    }
    if (
      item.shape === 'capsule' &&
      (typeof item.radius !== 'number' ||
        !Number.isFinite(item.radius) ||
        item.radius <= 0 ||
        typeof item.halfHeight !== 'number' ||
        !Number.isFinite(item.halfHeight) ||
        item.halfHeight <= 0)
    ) {
      errors.push(
        `${path}.radius and halfHeight are required for capsule primitives`,
      )
    }
  }
  if (captureTargetCount === 0)
    errors.push(`${prefix} must declare a capture target`)
  return errors
}

/** Returns all schema errors; invalid data is never silently repaired. */
export function validatePrizeManifest(manifest: unknown): readonly string[] {
  const errors: string[] = []
  if (!manifest || typeof manifest !== 'object')
    return ['manifest must be an object']
  const candidate = manifest as Partial<PrizeManifest>
  if (
    typeof candidate.revision !== 'string' ||
    candidate.revision.length === 0
  ) {
    errors.push('manifest revision is required')
  }
  if (!isSpawnLayout(candidate.spawnLayout))
    errors.push('manifest spawnLayout is invalid')
  if (!Array.isArray(candidate.prizes) || candidate.prizes.length === 0) {
    errors.push('manifest prizes must contain at least one prize')
    return errors
  }

  const ids = new Set<string>()
  for (const [index, prize] of candidate.prizes.entries()) {
    if (!prize || typeof prize !== 'object') {
      errors.push(`prizes[${index}] must be an object`)
      continue
    }
    const item = prize as Partial<PrizeDefinition>
    if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) {
      errors.push(`prizes[${index}].id is invalid`)
    } else if (ids.has(item.id)) {
      errors.push(`duplicate prize ID: ${item.id}`)
    } else {
      ids.add(item.id)
    }
    if (!isFiniteVec3(item.position))
      errors.push(`prizes[${index}].position is invalid`)
    if (!item.orientation || !isQuaternion(item.orientation.quaternion)) {
      errors.push(`prizes[${index}].orientation is invalid`)
    }
    if (!isSpawnLayout(item.spawnLayout))
      errors.push(`prizes[${index}].spawnLayout is invalid`)
    if (
      typeof item.mass !== 'number' ||
      !Number.isFinite(item.mass) ||
      item.mass <= 0
    ) {
      errors.push(`prizes[${index}].mass must be positive and finite`)
    }
    if (
      typeof item.weight !== 'number' ||
      !Number.isFinite(item.weight) ||
      item.weight <= 0
    ) {
      errors.push(`prizes[${index}].weight must be positive and finite`)
    }
    if (!isFiniteVec3(item.centerOfMass))
      errors.push(`prizes[${index}].centerOfMass is invalid`)
    if (!GEOMETRY_TYPES.includes(item.geometry as PrizeGeometryType)) {
      errors.push(`prizes[${index}].geometry is invalid`)
    }
    if (item.subGeometries !== undefined) {
      errors.push(
        ...subGeometryErrors(
          item.subGeometries,
          `prizes[${index}].subGeometries`,
        ),
      )
    }
  }
  return errors
}

export function loadPrizeManifest(manifest: unknown): PrizeManifest {
  const errors = validatePrizeManifest(manifest)
  if (errors.length > 0)
    throw new Error(`manifest-invalid: ${errors.join('; ')}`)
  return manifest as PrizeManifest
}

const HORIZONTAL_CAPSULE_QUATERNION: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2]

const DEFAULT_BODY_BY_GEOMETRY: Record<
  PrizeGeometryType,
  readonly PrizeSubGeometry[]
> = {
  sphere: [
    {
      id: 'body',
      region: 'body',
      shape: 'sphere',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      radius: 0.22,
      captureTarget: true,
      retentionFactor: 1,
    },
  ],
  box: [
    {
      id: 'body',
      region: 'body',
      shape: 'box',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      halfExtents: [0.22, 0.22, 0.22],
      captureTarget: true,
      retentionFactor: 1,
    },
  ],
  'soft-pouch': [
    {
      id: 'body',
      region: 'body',
      shape: 'box',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      halfExtents: [0.21, 0.25, 0.14],
      captureTarget: true,
      retentionFactor: 1,
    },
  ],
  tag: [
    {
      id: 'body',
      region: 'body',
      shape: 'sphere',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      radius: 0.22,
      captureTarget: false,
      retentionFactor: 1,
    },
    {
      id: 'tag',
      region: 'tag',
      shape: 'box',
      position: [0, 0.24, 0],
      quaternion: [0, 0, 0, 1],
      halfExtents: [0.08, 0.06, 0.015],
      captureTarget: true,
      retentionFactor: 0.42,
    },
  ],
  strap: [
    {
      id: 'body',
      region: 'body',
      shape: 'sphere',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      radius: 0.22,
      captureTarget: false,
      retentionFactor: 1,
    },
    {
      id: 'strap',
      region: 'strap',
      shape: 'capsule',
      position: [0, 0.24, 0],
      quaternion: HORIZONTAL_CAPSULE_QUATERNION,
      radius: 0.025,
      halfHeight: 0.12,
      captureTarget: true,
      retentionFactor: 0.5,
    },
  ],
  loop: [
    {
      id: 'body',
      region: 'body',
      shape: 'sphere',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      radius: 0.22,
      captureTarget: false,
      retentionFactor: 1,
    },
    {
      id: 'loop',
      region: 'loop',
      shape: 'capsule',
      position: [0, 0.24, 0],
      quaternion: HORIZONTAL_CAPSULE_QUATERNION,
      radius: 0.025,
      halfHeight: 0.12,
      captureTarget: true,
      retentionFactor: 0.55,
    },
  ],
}

/** Legacy N43 manifests remain deterministic while N44 data is opt-in per prize. */
export function prizeSubGeometries(
  prize: PrizeDefinition,
): readonly PrizeSubGeometry[] {
  if (prize.subGeometries) return prize.subGeometries
  const fallback = DEFAULT_BODY_BY_GEOMETRY[prize.geometry]
  if (!fallback) throw new Error('geometry-undefined')
  return fallback
}

export function initialPrizeStates(
  manifest: PrizeManifest,
): readonly PrizeState[] {
  return manifest.prizes.map((prize) => ({
    id: prize.id,
    position: [...prize.position] as Vec3,
    orientation: {
      quaternion: [
        ...prize.orientation.quaternion,
      ] as PrizeOrientation['quaternion'],
    },
    won: false,
    removed: false,
  }))
}

/** N43 default is authored only in default-prize-manifest.json. */
export const DEFAULT_PRIZE_MANIFEST = Object.freeze(
  loadPrizeManifest(defaultPrizeManifestJson),
)
