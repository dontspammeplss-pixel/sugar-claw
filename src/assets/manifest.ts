export type AssetId = 'machine-frame' | 'claw-visual' | 'test-prize'
export type AssetKind = 'model'
export type PreloadPolicy = 'required' | 'optional'
export type AuthoredUpAxis = '+Y'
export type AuthoredForwardAxis = '+Z' | '-Z'

export interface AssetBounds {
  width: number
  height: number
  depth: number
}

export interface AssetManifestEntry {
  readonly id: AssetId
  readonly url: string
  readonly kind: AssetKind
  readonly version: string
  readonly authoredUnitScale: number
  readonly authoredUpAxis: AuthoredUpAxis
  readonly authoredForwardAxis: AuthoredForwardAxis
  readonly expectedAnchors: readonly string[]
  readonly expectedBounds: AssetBounds
  readonly preloadPolicy: PreloadPolicy
}

export const ASSET_MANIFEST = {
  'machine-frame': {
    id: 'machine-frame',
    url: '/assets/machine-frame.glb',
    kind: 'model',
    version: 'n3-static-1',
    authoredUnitScale: 1,
    authoredUpAxis: '+Y',
    authoredForwardAxis: '+Z',
    expectedAnchors: ['MachineRoot', 'MachineVisuals'],
    expectedBounds: { width: 3.6, height: 4.2, depth: 2 },
    preloadPolicy: 'required',
  },
  'claw-visual': {
    id: 'claw-visual',
    url: '/assets/claw-visual.glb',
    kind: 'model',
    version: 'n3-static-1',
    authoredUnitScale: 1,
    authoredUpAxis: '+Y',
    authoredForwardAxis: '+Z',
    expectedAnchors: [
      'ClawSystem',
      'ClawVisualRoot',
      'HeadRoot',
      'GripCenter',
      'FingerRig',
      'FingerPivot_0',
      'FingerPivot_1',
      'FingerPivot_2',
    ],
    expectedBounds: { width: 0.7, height: 1.1, depth: 0.58 },
    preloadPolicy: 'required',
  },
  'test-prize': {
    id: 'test-prize',
    url: '/assets/test-prize.glb',
    kind: 'model',
    version: 'n3-static-1',
    authoredUnitScale: 1,
    authoredUpAxis: '+Y',
    authoredForwardAxis: '+Z',
    expectedAnchors: ['PrizeRoot'],
    expectedBounds: { width: 0.62, height: 0.62, depth: 0.62 },
    preloadPolicy: 'required',
  },
} satisfies Readonly<Record<AssetId, AssetManifestEntry>>

export function validateManifestEntry(
  entry: AssetManifestEntry,
): readonly string[] {
  const errors: string[] = []
  if (!entry.url.trim()) errors.push(`${entry.id}: URL is empty`)
  if (!entry.version.trim()) errors.push(`${entry.id}: version is empty`)
  if (
    !Number.isFinite(entry.authoredUnitScale) ||
    entry.authoredUnitScale <= 0
  ) {
    errors.push(`${entry.id}: authoredUnitScale must be positive and finite`)
  }
  for (const [axisName, axis] of [
    ['authoredUpAxis', entry.authoredUpAxis],
    ['authoredForwardAxis', entry.authoredForwardAxis],
  ] as const) {
    if (!axis) errors.push(`${entry.id}: ${axisName} is missing`)
  }
  if (entry.expectedAnchors.length === 0) {
    errors.push(`${entry.id}: at least one expected anchor is required`)
  }
  const { width, height, depth } = entry.expectedBounds
  if (
    ![width, height, depth].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    errors.push(`${entry.id}: expected bounds must be positive and finite`)
  }
  return errors
}

export function validateManifest(
  manifest: Readonly<Record<AssetId, AssetManifestEntry>> = ASSET_MANIFEST,
): readonly string[] {
  const ids = Object.keys(manifest)
  const errors = ids.flatMap((id) =>
    validateManifestEntry(manifest[id as AssetId]),
  )
  if (new Set(ids).size !== ids.length)
    errors.push('manifest contains duplicate asset IDs')
  const urls = ids.map((id) => manifest[id as AssetId].url)
  if (new Set(urls).size !== urls.length)
    errors.push('manifest contains duplicate asset URLs')
  return errors
}

const manifestErrors = validateManifest()
if (manifestErrors.length > 0) {
  throw new Error(`Invalid N3 asset manifest: ${manifestErrors.join('; ')}`)
}
