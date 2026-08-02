import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { Vector3 } from 'three'
import type { RuntimeSceneReport } from './report'
import { captureRuntimeSceneReport } from './report'
import { StaticScene } from './StaticScene'
import { CAMERA_VIEWS, type CameraViewName } from './config'

declare global {
  interface Window {
    __N3_RUNTIME_REPORT__?: RuntimeSceneReport
  }
}

interface RuntimeEvidenceProbeProps {
  onReport?: (report: RuntimeSceneReport) => void
}

function RuntimeEvidenceProbe({ onReport }: RuntimeEvidenceProbeProps) {
  const { scene, camera } = useThree()

  useEffect(() => {
    delete window.__N3_RUNTIME_REPORT__
  }, [])
  const captured = useRef(false)
  const lastReport = useRef('')

  useFrame(() => {
    if (captured.current) return
    const sceneRoot = scene.getObjectByName('SceneRoot')
    if (!sceneRoot) return

    const report = captureRuntimeSceneReport(sceneRoot, camera)
    const serializedReport = JSON.stringify(report)
    if (serializedReport !== lastReport.current) {
      lastReport.current = serializedReport
      window.__N3_RUNTIME_REPORT__ = report
      const appShell = document.querySelector<HTMLElement>('.app-shell')
      appShell?.setAttribute(
        'data-n3-runtime',
        report.validation.length === 0 ? 'pass' : 'fail',
      )
      appShell?.setAttribute(
        'data-n3-runtime-errors',
        report.validation.join('|'),
      )
      onReport?.(report)
    }
    if (report.missingHierarchy.length > 0 || report.validation.length > 0)
      return

    captured.current = true
  })

  return null
}

/**
 * Smoothly transitions the active camera to a selected preset angle. Because
 * the runtime probe captures the static-home validation once on mount (at the
 * orbit angle, identical to the approved review camera), driving the camera
 * afterwards never invalidates the N3 evidence.
 */
interface CameraViewControllerProps {
  readonly view: CameraViewName
}

function CameraViewController({ view }: CameraViewControllerProps) {
  const { camera } = useThree()
  const targetPosition = useRef(new Vector3(...CAMERA_VIEWS.orbit.position))
  const targetLookAt = useRef(new Vector3(...CAMERA_VIEWS.orbit.target))
  const targetUp = useRef(new Vector3(...CAMERA_VIEWS.orbit.up))
  const targetFov = useRef(CAMERA_VIEWS.orbit.fovVerticalDeg)
  const lookAt = useRef(new Vector3(...CAMERA_VIEWS.orbit.target))

  useEffect(() => {
    if (camera.type !== 'PerspectiveCamera') return
    const preset = CAMERA_VIEWS[view]
    const perspective = camera as PerspectiveCamera
    perspective.name = 'ReviewCamera'
    perspective.near = 0.05
    perspective.far = 100
    targetPosition.current.set(...preset.position)
    targetLookAt.current.set(...preset.target)
    targetUp.current.set(...preset.up)
    targetFov.current = preset.fovVerticalDeg
    perspective.updateProjectionMatrix()
  }, [camera, view])

  useFrame((_, delta) => {
    if (camera.type !== 'PerspectiveCamera') return
    const perspective = camera as PerspectiveCamera
    const k = 1 - Math.exp(-delta * 4.5)
    perspective.position.lerp(targetPosition.current, k)
    lookAt.current.lerp(targetLookAt.current, k)
    perspective.up.lerp(targetUp.current, k).normalize()
    perspective.lookAt(lookAt.current)
    if (Math.abs(perspective.fov - targetFov.current) > 0.01) {
      perspective.fov += (targetFov.current - perspective.fov) * k
      perspective.updateProjectionMatrix()
    }
  })

  return null
}

export interface N3CanvasProps {
  readonly onRuntimeReport?: (report: RuntimeSceneReport) => void
  /** Optional in-Canvas integration seam; scene ownership remains here. */
  readonly children?: ReactNode
  /** Active viewport camera angle; defaults to the approved review angle. */
  readonly cameraView?: CameraViewName
}

export function N3Canvas({
  onRuntimeReport,
  children,
  cameraView = 'orbit',
}: N3CanvasProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{
        name: 'ReviewCamera',
        position: [...CAMERA_VIEWS.orbit.position],
        fov: CAMERA_VIEWS.orbit.fovVerticalDeg,
        near: 0.05,
        far: 100,
      }}
      onCreated={({ scene, camera }) => {
        scene.background = null
        camera.name = 'ReviewCamera'
        if (camera.type === 'PerspectiveCamera') {
          camera.up.set(...CAMERA_VIEWS.orbit.up)
          camera.lookAt(...CAMERA_VIEWS.orbit.target)
        }
      }}
    >
      <StaticScene />
      <CameraViewController view={cameraView} />
      <RuntimeEvidenceProbe onReport={onRuntimeReport} />
      {children}
    </Canvas>
  )
}
