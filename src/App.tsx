import { useCallback, useEffect, useRef, useState } from 'react'
import type { RuntimeSceneReport } from './scene/report'
import { N3Canvas } from './scene/N3Canvas'
import type { CameraViewName } from './scene/config'
import {
  N7Runtime,
  type N7EffectCoordinator,
  type N7RuntimeReport,
} from './effects/n7-coordinator'

/** Execution states where coordinate input must be locked out. */
const EXECUTION_STATES = new Set([
  'lowering',
  'aligning',
  'gripping',
  'lifting',
  'returning',
  'releasing',
  'resetting',
])

const CAMERA_VIEW_OPTIONS: readonly {
  readonly value: CameraViewName
  readonly label: string
}[] = [
  { value: 'orbit', label: 'Orbit' },
  { value: 'top', label: 'Top' },
  { value: 'side', label: 'Side' },
]

interface OutcomePayload {
  readonly accepted?: boolean
  readonly reason?: string
}

function outcomeAccepted(outcome: unknown): boolean | null {
  if (outcome === null || typeof outcome !== 'object') return null
  const payload = outcome as OutcomePayload
  if (typeof payload.accepted !== 'boolean') return null
  return payload.accepted
}

function outcomeReason(outcome: unknown): string {
  if (outcome === null || typeof outcome !== 'object') return ''
  const payload = outcome as OutcomePayload
  const reason = typeof payload.reason === 'string' ? payload.reason : ''
  switch (reason) {
    case 'no-physical-contact':
      return "the claws didn't reach the prize"
    // 'contact-approved' is reserved for the success path; the miss toast
    // never renders it today, but keep the mapping for future success copy.
    case 'contact-approved':
      return 'the claws grabbed the prize'
    default:
      return reason
  }
}

export default function App() {
  const [runtimeReport, setRuntimeReport] = useState<RuntimeSceneReport | null>(
    null,
  )
  const [n7Report, setN7Report] = useState<N7RuntimeReport | null>(null)
  const [coordinator, setCoordinator] = useState<N7EffectCoordinator | null>(
    null,
  )
  const [aimX, setAimX] = useState(0)
  const [aimZ, setAimZ] = useState(0)
  const [cameraView, setCameraView] = useState<CameraViewName>('orbit')
  const [toastVisible, setToastVisible] = useState(false)
  const lastResultRunId = useRef<number | null>(null)

  const runtimeStatus = runtimeReport
    ? runtimeReport.validation.length === 0
      ? 'pass'
      : 'fail'
    : 'pending'
  const n7State = n7Report?.state.state ?? 'booting'
  const n7Sync = n7Report?.sync
  const n7Ready = coordinator !== null && n7State === 'ready'
  const executionLocked = EXECUTION_STATES.has(n7State)
  const aiming = n7State === 'aiming'
  const resetting = n7State === 'resetting'
  const inResult = n7State === 'result'
  const resultAccepted = inResult
    ? outcomeAccepted(n7Report?.state.outcome ?? null)
    : null
  const resultReason = inResult
    ? outcomeReason(n7Report?.state.outcome ?? null)
    : ''

  const onN7Snapshot = useCallback((report: N7RuntimeReport) => {
    if (
      report.state.state === 'ready' &&
      report.state.aim.x === 0 &&
      report.state.aim.z === 0
    ) {
      setAimX(0)
      setAimZ(0)
    }
    setN7Report((previous) => {
      if (
        previous?.state.state === report.state.state &&
        previous?.state.runId === report.state.runId &&
        previous?.sync?.clawSynchronized === report.sync?.clawSynchronized &&
        previous?.sync?.prizeSynchronized === report.sync?.prizeSynchronized &&
        JSON.stringify(previous?.state.outcome) ===
          JSON.stringify(report.state.outcome)
      ) {
        return previous
      }
      return report
    })
  }, [])

  // Reveal the result toast when a run lands on the Result state.
  useEffect(() => {
    if (!inResult || !n7Report) return
    if (lastResultRunId.current === n7Report.state.runId) return
    lastResultRunId.current = n7Report.state.runId
    setToastVisible(true)
  }, [inResult, n7Report])

  const dismissToast = useCallback(() => setToastVisible(false), [])

  const dispatchAim = (axis: 'x' | 'z', value: number) => {
    if (!coordinator || !aiming) return
    coordinator.dispatch({ type: 'moveAim', axis, value })
  }

  return (
    <main
      className="app-shell"
      data-n3-runtime={runtimeStatus}
      data-n3-runtime-errors={runtimeReport?.validation.join('|') ?? ''}
      data-n7-state={n7State}
      data-n7-sync={
        n7Sync?.clawSynchronized && n7Sync.prizeSynchronized
          ? 'pass'
          : 'pending'
      }
      data-n7-outcome={
        n7Report?.state.outcome ? JSON.stringify(n7Report.state.outcome) : ''
      }
      data-n7-locked={executionLocked ? 'true' : 'false'}
    >
      <N3Canvas onRuntimeReport={setRuntimeReport} cameraView={cameraView}>
        <N7Runtime onReady={setCoordinator} onSnapshot={onN7Snapshot} />
      </N3Canvas>
      {/* Viewport camera angle toggle */}
      <div className="camera-switcher" role="group" aria-label="Camera view">
        {CAMERA_VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={cameraView === option.value}
            className={cameraView === option.value ? 'is-active' : undefined}
            onClick={() => setCameraView(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* Attempt result feedback overlay */}{' '}
      {toastVisible && inResult && (
        <div
          className={`result-toast ${resultAccepted ? 'is-success' : 'is-miss'}`}
          role="status"
          aria-live="polite"
        >
          <span className="result-toast-icon" aria-hidden="true">
            {resultAccepted ? '✓' : '✕'}
          </span>
          <div className="result-toast-body">
            <strong>{resultAccepted ? 'Success!' : 'Attempt Missed'}</strong>
            <span>
              {resultAccepted
                ? 'Prize secured — nice grab!'
                : resultReason
                  ? `Missed — ${resultReason}. Try again!`
                  : 'Missed the prize — try again!'}
            </span>
          </div>
          <div className="result-toast-actions">
            <button
              type="button"
              className="result-toast-retry"
              onClick={() => coordinator?.dispatch({ type: 'requestReset' })}
            >
              {resultAccepted ? 'Play Again' : 'Try Again'}
            </button>
            <button
              type="button"
              className="result-toast-dismiss"
              onClick={dismissToast}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <section aria-label="Claw controls" data-n7-controls>
        {/* Coordinate sub-panel: readouts, sliders, and preset triggers */}
        <div className="control-group" data-n7-coordinate-group>
          <span className="control-group-label">Coordinates</span>
          <div className="coordinate-fields">
            <label className="coordinate-field">
              <span className="coordinate-axis">X</span>
              <input
                aria-label="Aim X"
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={aimX}
                disabled={!aiming}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setAimX(value)
                  dispatchAim('x', value)
                }}
              />
              <output className="coordinate-readout">{aimX.toFixed(2)}</output>
            </label>
            <label className="coordinate-field">
              <span className="coordinate-axis">Z</span>
              <input
                aria-label="Aim Z"
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={aimZ}
                disabled={!aiming}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setAimZ(value)
                  dispatchAim('z', value)
                }}
              />
              <output className="coordinate-readout">{aimZ.toFixed(2)}</output>
            </label>
          </div>
          <div className="coordinate-presets">
            <button
              type="button"
              className="preset-button"
              onClick={() => dispatchAim('x', aimX)}
              disabled={!aiming}
            >
              Set X {aimX.toFixed(2)}
            </button>
            <button
              type="button"
              className="preset-button"
              onClick={() => dispatchAim('z', aimZ)}
              disabled={!aiming}
            >
              Set Z {aimZ.toFixed(2)}
            </button>
          </div>
        </div>

        {/* Action sub-panel: primary Drop CTA + secondary utilities */}
        <div className="control-group" data-n7-action-group>
          <span className="control-group-label">Actions</span>
          <div className="action-row">
            <button
              type="button"
              className="action-button action-secondary"
              onClick={() => coordinator?.dispatch({ type: 'beginAim' })}
              disabled={!n7Ready}
            >
              Aim
            </button>
            <button
              type="button"
              className="action-button action-primary"
              onClick={() => coordinator?.dispatch({ type: 'confirmDrop' })}
              disabled={!aiming}
            >
              Drop
            </button>
            <button
              type="button"
              className="action-button action-secondary"
              onClick={() => coordinator?.dispatch({ type: 'requestReset' })}
              disabled={coordinator === null || resetting}
            >
              Reset
            </button>
          </div>
          <output
            aria-live="polite"
            className="state-badge"
            data-n7-status
            data-n7-state-badge={n7State}
          >
            {n7State}
          </output>
        </div>
      </section>
    </main>
  )
}
