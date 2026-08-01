import type { AssetId, AssetManifestEntry } from './manifest'
import { ASSET_MANIFEST, validateManifestEntry } from './manifest'

export type AssetStatus =
  'unrequested' | 'loading' | 'ready' | 'failed' | 'disposed'

export interface AssetSource {
  readonly anchors: readonly string[]
  readonly bounds: AssetManifestEntry['expectedBounds']
  readonly transform: {
    readonly position: readonly [number, number, number]
    readonly rotation: readonly [number, number, number]
    readonly scale: readonly [number, number, number]
  }
}

export interface ResolvedAsset {
  readonly id: AssetId
  readonly status: 'ready'
  readonly source: AssetSource
  readonly instanceKey: string
  readonly authoredUnitScale: number
  readonly authoredUpAxis: AssetManifestEntry['authoredUpAxis']
  readonly authoredForwardAxis: AssetManifestEntry['authoredForwardAxis']
}

export interface AssetFailure {
  readonly id: AssetId
  readonly status: 'failed'
  readonly message: string
}

export type AssetRecord =
  | { readonly status: 'unrequested' }
  | { readonly status: 'loading'; readonly promise: Promise<ResolvedAsset> }
  | ResolvedAsset
  | AssetFailure
  | { readonly status: 'disposed' }

export interface AssetRegistry {
  readonly get: (id: AssetId) => AssetRecord
  readonly request: (
    id: AssetId,
    sourceLoader?: () => Promise<AssetSource>,
  ) => Promise<ResolvedAsset>
  readonly cloneForInstance: (id: AssetId, instanceKey: string) => ResolvedAsset
  readonly dispose: (id: AssetId) => void
}

function finiteTransform(source: AssetSource): boolean {
  return [
    ...source.transform.position,
    ...source.transform.rotation,
    ...source.transform.scale,
  ].every(Number.isFinite)
}

function validateSource(
  entry: AssetManifestEntry,
  source: AssetSource,
): readonly string[] {
  const errors = [...validateManifestEntry(entry)]
  if (!finiteTransform(source))
    errors.push(`${entry.id}: transform contains non-finite values`)
  if (source.transform.scale.some((value) => value <= 0)) {
    errors.push(`${entry.id}: transform scale must be positive`)
  }
  for (const anchor of entry.expectedAnchors) {
    if (!source.anchors.includes(anchor))
      errors.push(`${entry.id}: missing anchor ${anchor}`)
  }
  const dimensions = ['width', 'height', 'depth'] as const
  for (const dimension of dimensions) {
    const actual = source.bounds[dimension]
    const expected = entry.expectedBounds[dimension]
    if (!Number.isFinite(actual) || actual <= 0) {
      errors.push(`${entry.id}: ${dimension} must be positive and finite`)
    } else if (Math.abs(actual - expected) > 0.000001) {
      errors.push(
        `${entry.id}: ${dimension} ${actual} does not match expected ${expected}`,
      )
    }
  }

  return errors
}

export function createAssetRegistry(
  manifest: Readonly<Record<AssetId, AssetManifestEntry>> = ASSET_MANIFEST,
): AssetRegistry {
  const records = new Map<AssetId, AssetRecord>()
  const instanceKeys = new Map<string, ResolvedAsset>()
  const generations = new Map<AssetId, number>()

  const get = (id: AssetId): AssetRecord =>
    records.get(id) ?? { status: 'unrequested' }

  const request = async (
    id: AssetId,
    sourceLoader: () => Promise<AssetSource> = async () => {
      throw new Error(`${id}: no source loader registered`)
    },
  ): Promise<ResolvedAsset> => {
    const existing = get(id)
    if (existing.status === 'ready') return existing
    if (existing.status === 'loading') return existing.promise
    if (existing.status === 'failed') throw new Error(existing.message)
    if (existing.status === 'disposed') {
      records.delete(id)
    }

    const entry = manifest[id]
    const generation = generations.get(id) ?? 0
    if (!entry) {
      const message = `${id}: asset is not declared in the manifest`
      records.set(id, { id, status: 'failed', message })
      throw new Error(message)
    }

    const promise = Promise.resolve()
      .then(sourceLoader)
      .then((source) => {
        if ((generations.get(id) ?? 0) !== generation) {
          throw new Error(`${id}: request completed after disposal`)
        }
        const errors = validateSource(entry, source)
        if (errors.length > 0) throw new Error(errors.join('; '))
        const resolved: ResolvedAsset = {
          id,
          status: 'ready',
          source,
          instanceKey: `${id}:source`,
          authoredUnitScale: entry.authoredUnitScale,
          authoredUpAxis: entry.authoredUpAxis,
          authoredForwardAxis: entry.authoredForwardAxis,
        }
        records.set(id, resolved)
        return resolved
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if ((generations.get(id) ?? 0) === generation) {
          records.set(id, { id, status: 'failed', message })
        }
        throw new Error(message)
      })
    records.set(id, { status: 'loading', promise })
    return promise
  }

  const cloneForInstance = (
    id: AssetId,
    instanceKey: string,
  ): ResolvedAsset => {
    const record = get(id)
    if (record.status !== 'ready') {
      throw new Error(`${id}: cannot clone before the required asset is ready`)
    }
    const key = `${id}:${instanceKey}`
    const existing = instanceKeys.get(key)
    if (existing) return existing
    const clone: ResolvedAsset = { ...record, instanceKey: key }
    instanceKeys.set(key, clone)
    return clone
  }

  const dispose = (id: AssetId) => {
    generations.set(id, (generations.get(id) ?? 0) + 1)
    records.set(id, { status: 'disposed' })
    for (const key of instanceKeys.keys()) {
      if (key.startsWith(`${id}:`)) instanceKeys.delete(key)
    }
  }

  return { get, request, cloneForInstance, dispose }
}

export function sourceForManifestEntry(id: AssetId): AssetSource {
  const entry = ASSET_MANIFEST[id]
  return {
    anchors: entry.expectedAnchors,
    bounds: entry.expectedBounds,
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  }
}
