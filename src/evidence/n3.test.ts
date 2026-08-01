import { Group, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { ASSET_MANIFEST } from '../assets/manifest'
import { createAssetRegistry, sourceForManifestEntry } from '../assets/registry'
import {
  REQUIRED_HIERARCHY,
  captureRuntimeSceneReport,
  createHierarchyReport,
  createTransformReport,
  validateHomeTransform,
} from '../scene/report'

describe('N3 static scene evidence', () => {
  it('traverses a mounted hierarchy and validates the active review camera', () => {
    const sceneRoot = new Group()
    sceneRoot.name = 'SceneRoot'
    const objects = new Map<string, Group>([['SceneRoot', sceneRoot]])

    for (const path of REQUIRED_HIERARCHY.slice(1)) {
      const segments = path.split('/')
      const parentPath = segments.slice(0, -1).join('/')
      const name = segments.at(-1)!
      const parent = objects.get(parentPath)
      const object = new Group()
      object.name = name
      parent?.add(object)
      objects.set(path, object)
    }

    objects.get('SceneRoot/MachineRoot')!.position.set(0, 0, 0)
    objects.get('SceneRoot/MachineRoot/ClawMount')!.position.set(0, 0, 0)
    objects
      .get('SceneRoot/MachineRoot/ClawMount/ClawSystem')!
      .position.set(0, 2.85, 0.1)

    const camera = new PerspectiveCamera(38, 1, 0.05, 100)
    camera.name = 'ReviewCamera'
    camera.position.set(6.3, 4.35, 7.8)
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 2.05, 0)
    camera.updateProjectionMatrix()

    const report = captureRuntimeSceneReport(sceneRoot, camera)
    expect(report.missingHierarchy).toEqual([])
    expect(report.validation).toEqual([])
    expect(report.transforms.clawSystemWorldPosition).toEqual([0, 2.85, 0.1])
    expect(report.activeCamera).toMatchObject({
      name: 'ReviewCamera',
      fov: 38,
      near: 0.05,
      far: 100,
    })
  })

  it('reports the approved hierarchy and identity static transforms', () => {
    const hierarchy = createHierarchyReport()
    const transforms = createTransformReport()

    expect(hierarchy).toContain('SceneRoot/MachineRoot/ClawMount/ClawSystem')
    expect(hierarchy).toContain(
      'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot/FingerRig/FingerPivot_2',
    )
    expect(validateHomeTransform(transforms)).toEqual([])
    expect(transforms.machineEnvelope).toEqual([3.6, 4.2, 2])
    expect(transforms.machineRoot).toEqual({
      position: [0, 0, 0],
      scale: [1, 1, 1],
    })
    expect(transforms.clawHome).toEqual([0, 2.85, 0.1])
  })

  it('deduplicates concurrent requests and applies per-instance clone keys', async () => {
    const registry = createAssetRegistry()
    let loadCount = 0
    const sourceLoader = async () => {
      loadCount += 1
      return sourceForManifestEntry('claw-visual')
    }

    const [first, second] = await Promise.all([
      registry.request('claw-visual', sourceLoader),
      registry.request('claw-visual', sourceLoader),
    ])
    const cloneA = registry.cloneForInstance('claw-visual', 'scene-a')
    const cloneARepeat = registry.cloneForInstance('claw-visual', 'scene-a')
    const cloneB = registry.cloneForInstance('claw-visual', 'scene-b')

    expect(loadCount).toBe(1)
    expect(first).toBe(second)
    expect(cloneA).toBe(cloneARepeat)
    expect(cloneA.instanceKey).not.toBe(cloneB.instanceKey)
    expect(cloneA.source).toBe(cloneB.source)
  })

  it('blocks ready on missing anchors and exposes an actionable failure', async () => {
    const registry = createAssetRegistry()
    const invalidSource = {
      ...sourceForManifestEntry('machine-frame'),
      anchors: ['MachineRoot'],
    }

    await expect(
      registry.request('machine-frame', async () => invalidSource),
    ).rejects.toThrow('missing anchor MachineVisuals')
    expect(registry.get('machine-frame')).toMatchObject({
      status: 'failed',
      id: 'machine-frame',
    })
  })

  it('rejects non-finite and dimension-drifted asset sources', async () => {
    const registry = createAssetRegistry()
    const invalidSource = {
      ...sourceForManifestEntry('test-prize'),
      bounds: { width: 0.7, height: 0.62, depth: 0.62 },
      transform: {
        position: [0, Number.NaN, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
      },
    }

    await expect(
      registry.request('test-prize', async () => invalidSource),
    ).rejects.toThrow('transform contains non-finite values')
    expect(registry.get('test-prize')).toMatchObject({ status: 'failed' })
  })

  it('disposes instance clones and permits a clean remount request', async () => {
    const registry = createAssetRegistry()
    let loadCount = 0
    const sourceLoader = async () => {
      loadCount += 1
      return sourceForManifestEntry('machine-frame')
    }

    await registry.request('machine-frame', sourceLoader)
    const firstClone = registry.cloneForInstance('machine-frame', 'remount')
    registry.dispose('machine-frame')
    expect(registry.get('machine-frame')).toEqual({ status: 'disposed' })
    await registry.request('machine-frame', sourceLoader)
    const secondClone = registry.cloneForInstance('machine-frame', 'remount')

    expect(loadCount).toBe(2)
    expect(secondClone).not.toBe(firstClone)
    expect(secondClone.source).toEqual(firstClone.source)
  })

  it('does not let an in-flight request resurrect a disposed record', async () => {
    const registry = createAssetRegistry()
    let resolveSource:
      ((source: ReturnType<typeof sourceForManifestEntry>) => void) | undefined
    const pendingSource = new Promise<
      ReturnType<typeof sourceForManifestEntry>
    >((resolve) => {
      resolveSource = resolve
    })
    const request = registry.request('test-prize', () => pendingSource)

    registry.dispose('test-prize')
    resolveSource?.(sourceForManifestEntry('test-prize'))

    await expect(request).rejects.toThrow('request completed after disposal')
    expect(registry.get('test-prize')).toEqual({ status: 'disposed' })
  })

  it('keeps all required manifest entries validated and uniquely declared', () => {
    expect(Object.keys(ASSET_MANIFEST)).toEqual([
      'machine-frame',
      'claw-visual',
      'test-prize',
    ])
    for (const entry of Object.values(ASSET_MANIFEST)) {
      expect(entry.preloadPolicy).toBe('required')
      expect(entry.authoredUnitScale).toBe(1)
      expect(entry.expectedAnchors.length).toBeGreaterThan(0)
    }
  })
})
