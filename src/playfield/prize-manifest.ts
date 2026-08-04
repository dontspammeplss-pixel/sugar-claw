import defaultPrizeManifestJson from './default-prize-manifest.json'
import type { Vec3 } from '../types/geometry'

export type PrizeGeometryType =
  | 'sphere'
  | 'box'
  | 'soft-pouch'
  | 'tag'
  | 'strap'
  | 'loop'

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
  readonly weight: number
  readonly centerOfMass: Vec3
  readonly geometry: PrizeGeometryType
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

const ID_PATTERN = /^[a-z][a-z0-9-]*$/

function isFiniteVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

function isQuaternion(value: unknown): value is PrizeOrientation['quaternion'] {
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

/** Returns all schema errors; invalid data is never silently repaired. */
export function validatePrizeManifest(manifest: unknown): readonly string[] {
  const errors: string[] = []
  if (!manifest || typeof manifest !== 'object') return ['manifest must be an object']
  const candidate = manifest as Partial<PrizeManifest>
  if (typeof candidate.revision !== 'string' || candidate.revision.length === 0) {
    errors.push('manifest revision is required')
  }
  if (!isSpawnLayout(candidate.spawnLayout)) {
    errors.push('manifest spawnLayout is invalid')
  }
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
    if (!isFiniteVec3(item.position)) errors.push(`prizes[${index}].position is invalid`)
    if (!item.orientation || !isQuaternion(item.orientation.quaternion)) {
      errors.push(`prizes[${index}].orientation is invalid`)
    }
    if (!isSpawnLayout(item.spawnLayout)) {
      errors.push(`prizes[${index}].spawnLayout is invalid`)
    }
    if (typeof item.weight !== 'number' || !Number.isFinite(item.weight) || item.weight <= 0) {
      errors.push(`prizes[${index}].weight must be positive and finite`)
    }
    if (!isFiniteVec3(item.centerOfMass)) {
      errors.push(`prizes[${index}].centerOfMass is invalid`)
    }
    if (!GEOMETRY_TYPES.includes(item.geometry as PrizeGeometryType)) {
      errors.push(`prizes[${index}].geometry is invalid`)
    }
  }
  return errors
}

export function loadPrizeManifest(manifest: unknown): PrizeManifest {
  const errors = validatePrizeManifest(manifest)
  if (errors.length > 0) throw new Error(`manifest-invalid: ${errors.join('; ')}`)
  return manifest as PrizeManifest
}

export function initialPrizeStates(manifest: PrizeManifest): readonly PrizeState[] {
  return manifest.prizes.map((prize) => ({
    id: prize.id,
    position: [...prize.position] as Vec3,
    orientation: {
      quaternion: [...prize.orientation.quaternion] as PrizeOrientation['quaternion'],
    },
    won: false,
    removed: false,
  }))
}

/** N43 default is authored only in default-prize-manifest.json. */
export const DEFAULT_PRIZE_MANIFEST = Object.freeze(
  loadPrizeManifest(defaultPrizeManifestJson),
)
