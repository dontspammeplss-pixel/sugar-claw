import { Vector3 } from 'three'
import type { Camera, Object3D, PerspectiveCamera } from 'three'
import { CLAW, MACHINE, REVIEW_CAMERA } from './config'

export const REQUIRED_HIERARCHY = [
  'SceneRoot',
  'SceneRoot/LightingRoot',
  'SceneRoot/CameraRig',
  'SceneRoot/MachineRoot',
  'SceneRoot/MachineRoot/MachineVisuals',
  'SceneRoot/MachineRoot/MachineCollisionProxies',
  'SceneRoot/MachineRoot/ClawMount',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawPhysicsRoot',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/Carriage',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/Cable',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot/GripCenter',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot/FingerRig',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot/FingerRig/FingerPivot_0',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot/FingerRig/FingerPivot_1',
  'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot/FingerRig/FingerPivot_2',
  'SceneRoot/PrizeRoot',
  'SceneRoot/PlayfieldRoot',
  'SceneRoot/DebugRoot',
] as const

export interface TransformReport {
  readonly machineEnvelope: readonly [number, number, number]
  readonly machineRoot: {
    position: readonly [number, number, number]
    scale: readonly [number, number, number]
  }
  readonly clawMount: {
    position: readonly [number, number, number]
    scale: readonly [number, number, number]
  }
  readonly clawHome: readonly [number, number, number]
  readonly camera: typeof REVIEW_CAMERA
}

export interface RuntimeSceneReport {
  readonly hierarchy: readonly string[]
  readonly missingHierarchy: readonly string[]
  readonly transforms: {
    readonly machineRoot: TransformReport['machineRoot']
    readonly clawMount: TransformReport['clawMount']
    readonly clawSystemWorldPosition: readonly [number, number, number]
    readonly headRootWorldPosition: readonly [number, number, number]
    readonly gripCenterWorldPosition: readonly [number, number, number]
  }
  readonly activeCamera: {
    readonly name: string
    readonly position: readonly [number, number, number]
    readonly fov: number
    readonly near: number
    readonly far: number
  }
  readonly validation: readonly string[]
}

export const HOME_TRANSFORM_REPORT: TransformReport = {
  machineEnvelope: MACHINE.envelope,
  machineRoot: { position: [0, 0, 0], scale: [1, 1, 1] },
  clawMount: { position: [0, 0, 0], scale: [1, 1, 1] },
  clawHome: CLAW.homeHeadCenter,
  camera: REVIEW_CAMERA,
}

export function createHierarchyReport(): readonly string[] {
  return [...REQUIRED_HIERARCHY]
}

export function createTransformReport(): TransformReport {
  return HOME_TRANSFORM_REPORT
}

function tuple(vector: Vector3): readonly [number, number, number] {
  return vector.toArray() as [number, number, number]
}

function worldPosition(object: Object3D): readonly [number, number, number] {
  return tuple(object.getWorldPosition(new Vector3()))
}

function localTransform(object: Object3D): TransformReport['machineRoot'] {
  return {
    position: tuple(object.position),
    scale: tuple(object.scale),
  }
}

function findChildPath(root: Object3D, path: string): Object3D | undefined {
  if (root.name !== 'SceneRoot') return undefined
  const segments = path.split('/').slice(1)
  let current: Object3D | undefined = root
  for (const segment of segments) {
    current = current?.children.find((child) => child.name === segment)
    if (!current) return undefined
  }
  return current
}

function emptyPosition(): readonly [number, number, number] {
  return [NaN, NaN, NaN]
}

function emptyTransform(): TransformReport['machineRoot'] {
  return { position: emptyPosition(), scale: emptyPosition() }
}

export function captureRuntimeSceneReport(
  sceneRoot: Object3D,
  activeCamera: Camera,
): RuntimeSceneReport {
  sceneRoot.updateWorldMatrix(true, true)
  const allPaths: string[] = []
  const visit = (object: Object3D, parentPath: string) => {
    const path = parentPath ? `${parentPath}/${object.name}` : object.name
    if (object.name) allPaths.push(path)
    object.children.forEach((child) => visit(child, path))
  }
  visit(sceneRoot, '')

  const foundHierarchy = REQUIRED_HIERARCHY.filter((path) =>
    Boolean(findChildPath(sceneRoot, path)),
  )
  const missingHierarchy = REQUIRED_HIERARCHY.filter(
    (path) => !foundHierarchy.includes(path),
  )
  const machineRoot = findChildPath(sceneRoot, 'SceneRoot/MachineRoot')
  const clawMount = findChildPath(sceneRoot, 'SceneRoot/MachineRoot/ClawMount')
  const clawSystem = findChildPath(
    sceneRoot,
    'SceneRoot/MachineRoot/ClawMount/ClawSystem',
  )
  const headRoot = findChildPath(
    sceneRoot,
    'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot',
  )
  const gripCenter = findChildPath(
    sceneRoot,
    'SceneRoot/MachineRoot/ClawMount/ClawSystem/ClawVisualRoot/HeadRoot/GripCenter',
  )
  const camera =
    activeCamera.type === 'PerspectiveCamera'
      ? (activeCamera as PerspectiveCamera)
      : undefined
  const cameraPosition = new Vector3(...REVIEW_CAMERA.position)
  const cameraTargetDirection = new Vector3(...REVIEW_CAMERA.target)
    .sub(cameraPosition)
    .normalize()
  const cameraDirection = camera
    ? camera.getWorldDirection(new Vector3())
    : new Vector3()
  const cameraUp = camera?.up ?? new Vector3()
  const expectedUp = new Vector3(...REVIEW_CAMERA.up)
  const validation = [
    ...(sceneRoot.name !== 'SceneRoot'
      ? ['runtime traversal root must be SceneRoot']
      : []),
    ...(missingHierarchy.length > 0
      ? [`missing runtime hierarchy: ${missingHierarchy.join(', ')}`]
      : []),
    ...(!camera ? ['active camera must be a perspective camera'] : []),
    ...(machineRoot &&
    (machineRoot.position.length() !== 0 ||
      machineRoot.scale.x !== 1 ||
      machineRoot.scale.y !== 1 ||
      machineRoot.scale.z !== 1)
      ? ['MachineRoot runtime transform drift detected']
      : []),
    ...(clawMount &&
    (clawMount.position.length() !== 0 ||
      clawMount.scale.x !== 1 ||
      clawMount.scale.y !== 1 ||
      clawMount.scale.z !== 1)
      ? ['ClawMount runtime transform drift detected']
      : []),
    ...(clawSystem &&
    worldPosition(clawSystem).some(
      (value, index) => Math.abs(value - CLAW.homeHeadCenter[index]) > 0.000001,
    )
      ? ['ClawSystem runtime home position drift detected']
      : []),
    ...(camera && camera.position.distanceTo(cameraPosition) > 0.000001
      ? ['ReviewCamera runtime position drift detected']
      : []),
    ...(camera && camera.name !== REVIEW_CAMERA.name
      ? [`active camera must be ${REVIEW_CAMERA.name}`]
      : []),
    ...(camera && Math.abs(camera.fov - REVIEW_CAMERA.fovVerticalDeg) > 0.000001
      ? ['ReviewCamera runtime FOV drift detected']
      : []),
    ...(camera &&
    (Math.abs(camera.near - REVIEW_CAMERA.nearClip) > 0.000001 ||
      Math.abs(camera.far - REVIEW_CAMERA.farClip) > 0.000001)
      ? ['ReviewCamera runtime clip range drift detected']
      : []),
    ...(camera && cameraDirection.distanceTo(cameraTargetDirection) > 0.000001
      ? ['ReviewCamera runtime target drift detected']
      : []),
    ...(camera && cameraUp.distanceTo(expectedUp) > 0.000001
      ? ['ReviewCamera runtime up-vector drift detected']
      : []),
  ]

  return {
    hierarchy: allPaths,
    missingHierarchy,
    transforms: {
      machineRoot: machineRoot ? localTransform(machineRoot) : emptyTransform(),
      clawMount: clawMount ? localTransform(clawMount) : emptyTransform(),
      clawSystemWorldPosition: clawSystem
        ? worldPosition(clawSystem)
        : emptyPosition(),
      headRootWorldPosition: headRoot
        ? worldPosition(headRoot)
        : emptyPosition(),
      gripCenterWorldPosition: gripCenter
        ? worldPosition(gripCenter)
        : emptyPosition(),
    },
    activeCamera: {
      name: camera?.name ?? activeCamera.name,
      position: camera ? tuple(camera.position) : emptyPosition(),
      fov: camera?.fov ?? NaN,
      near: camera?.near ?? NaN,
      far: camera?.far ?? NaN,
    },
    validation,
  }
}

export function validateHomeTransform(
  report: TransformReport,
): readonly string[] {
  const errors: string[] = []
  if (report.machineRoot.position.some((value) => value !== 0)) {
    errors.push('MachineRoot must remain at the SceneRoot world origin')
  }
  if (report.machineRoot.scale.some((value) => value !== 1)) {
    errors.push('MachineRoot must retain identity scale')
  }
  if (report.clawMount.position.some((value) => value !== 0)) {
    errors.push('ClawMount must retain the identity visual baseline')
  }
  if (report.clawMount.scale.some((value) => value !== 1)) {
    errors.push('ClawMount must retain identity scale')
  }
  const [x, y, z] = report.clawHome
  const [minX, minY, minZ] = CLAW.headCenterBounds.min
  const [maxX, maxY, maxZ] = CLAW.headCenterBounds.max
  if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) {
    errors.push(
      'Claw home head center must remain inside the legal mount volume',
    )
  }
  return errors
}

export function serializeEvidence(): string {
  return JSON.stringify(
    {
      baseline: 'gate-1-approved + gate-2-design-approved',
      cameraPreset: REVIEW_CAMERA,
      hierarchy: createHierarchyReport(),
      transforms: createTransformReport(),
      validation: validateHomeTransform(HOME_TRANSFORM_REPORT),
      runtimePolicy:
        'static scene; no physics, state, gameplay animation, or per-frame transform writer',
    },
    null,
    2,
  )
}
