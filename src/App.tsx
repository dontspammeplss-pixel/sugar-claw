import { useCallback, useEffect, useRef, useState } from 'react'
import type { RuntimeSceneReport } from './scene/report'
import { N3Canvas } from './scene/N3Canvas'
import type { CameraViewName } from './scene/config'
import {
  N7Runtime,
  type N7EffectCoordinator,
  type N7RuntimeReport,
} from './effects/n7-coordinator'
import { Joystick } from './ui/Joystick'
import { OPS_ENABLED } from './ops/ops-store'
import { OpsPanel } from './ui/OpsPanel'
import { ZERO_DEFLECTION } from './ui/joystick-math'
import type { Deflection } from './ui/joystick-math'

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
  const [deflection, setDeflection] = useState<Deflection>(ZERO_DEFLECTION)
  const [cameraView, setCameraView] = useState<CameraViewName>('orbit')
  const [toastVisible, setToastVisible] = useState(false)
  const [opsVisible, setOpsVisible] = useState(false)
  const lastResultRunId = useRef<number | null>(null)

  const runtimeStatus = runtimeReport
    ? runtimeReport.validation.length === 0
      ? 'pass'
      : 'fail'
    : 'pending'
  const n7State = n7Report?.state.state ?? 'booting'
  const n7Sync = n7Report?.sync
  const joystickAvailable =
    coordinator !== null && (n7State === 'ready' || n7State === 'aiming')
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

  // The stick is live in ready (first deflection enters aiming) and aiming.
  // Keep it mounted and enabled across that state transition so the active
  // pointer capture and move stream are not torn down after the first sample.
  const joystickEnabled = joystickAvailable

  const onN7Snapshot = useCallback((report: N7RuntimeReport) => {
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

  // N23: joystick deflection -> commands. First deflection from ready enters
  // aim space automatically (the old "Aim" button is gone); from aiming the
  // stick glides the claw via moveAim. Center release stops the glide.
  const handleJoystickChange = useCallback(
    (next: Deflection) => {
      setDeflection(next)
      if (!coordinator) return
      const state = coordinator.snapshot.state
      if (next.x === 0 && next.z === 0 && state !== 'aiming') return
      if (state === 'ready') {
        const begun = coordinator.dispatch({ type: 'beginAim' })
        if (!begun.accepted) {
          setDeflection(ZERO_DEFLECTION)
          return
        }
      }
      if (coordinator.snapshot.state === 'aiming') {
        coordinator.dispatch({ type: 'moveAim', axis: 'x', value: next.x })
        coordinator.dispatch({ type: 'moveAim', axis: 'z', value: next.z })
      }
    },
    [coordinator],
  )

  // When the sequence leaves ready/aiming, return the stick to center so the
  // knob never shows a phantom deflection during the run.
  useEffect(() => {
    if (!joystickEnabled) {
      setDeflection(ZERO_DEFLECTION)
    }
  }, [joystickEnabled])

  // N51 (F-11): ops panel visibility — hidden shortcuts, ops builds only.
  // Ctrl+Shift+O is the contract shortcut, while Ctrl+Alt+O is a browser-safe
  // fallback because Chrome reserves Ctrl+Shift+O for Bookmarks Manager.
  // The panel component itself is tree-shaken from player builds (VITE_OPS=1).
  useEffect(() => {
    if (!OPS_ENABLED) return
    const onKeyDown = (event: KeyboardEvent): void => {
      const isOpsShortcut =
        event.key.toLowerCase() === 'o' &&
        ((event.ctrlKey && event.shiftKey) ||
          (event.ctrlKey && event.altKey))
      if (isOpsShortcut) {
        event.preventDefault()
        setOpsVisible((visible) => !visible)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
        {/* Joystick: continuous velocity glide on X/Z */}
        <div className="control-group" data-n7-joystick-group>
          <span className="control-group-label">Joystick</span>
          <Joystick
            deflection={deflection}
            onChange={handleJoystickChange}
            onFailure={(failure) => {
              setDeflection(ZERO_DEFLECTION)
              if (!coordinator) return
              coordinator.controller.dispatch({
                type: 'invariantFailure',
                error: failure.message,
                runId: coordinator.snapshot.runId,
              })
            }}
            disabled={!joystickEnabled}
            ariaLabel="Claw position joystick"
          />
        </div>

        {/* Action sub-panel: Drop CTA + Reset + state badge */}
        <div className="control-group" data-n7-action-group>
          <span className="control-group-label">Actions</span>
          <div className="action-row">
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
      {OPS_ENABLED && opsVisible && (
        <OpsPanel
          coordinator={coordinator}
          margin={n7Report?.retention.margin ?? null}
        />
      )}
    </main>
  )
}
