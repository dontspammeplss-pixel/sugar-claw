import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { RuntimeSceneReport } from './report'
import { captureRuntimeSceneReport } from './report'
import { StaticScene } from './StaticScene'

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

export interface N3CanvasProps {
  readonly onRuntimeReport?: (report: RuntimeSceneReport) => void
  /** Optional in-Canvas integration seam; scene ownership remains here. */
  readonly children?: ReactNode
}

export function N3Canvas({ onRuntimeReport, children }: N3CanvasProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{
        name: 'ReviewCamera',
        position: [0, 2.3, 7],
        fov: 38,
        near: 0.05,
        far: 100,
      }}
      onCreated={({ scene, camera }) => {
        scene.background = null
        camera.name = 'ReviewCamera'
      }}
    >
      <StaticScene />
      <RuntimeEvidenceProbe onReport={onRuntimeReport} />
      {children}
    </Canvas>
  )
}
