import { useCallback, useState } from 'react'
import type { RuntimeSceneReport } from './scene/report'
import { N3Canvas } from './scene/N3Canvas'
import {
  N7Runtime,
  type N7EffectCoordinator,
  type N7RuntimeReport,
} from './effects/n7-coordinator'

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
  const runtimeStatus = runtimeReport
    ? runtimeReport.validation.length === 0
      ? 'pass'
      : 'fail'
    : 'pending'
  const n7State = n7Report?.state.state ?? 'booting'
  const n7Sync = n7Report?.sync
  const n7Ready = coordinator !== null && n7State === 'ready'

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

  const dispatchAim = (axis: 'x' | 'z', value: number) => {
    if (!coordinator || n7State !== 'aiming') return
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
        n7Report?.state.outcome
          ? JSON.stringify(n7Report.state.outcome)
          : ''
      }
    >
      <N3Canvas onRuntimeReport={setRuntimeReport}>
        <N7Runtime
          onReady={setCoordinator}
          onSnapshot={onN7Snapshot}
        />
      </N3Canvas>
      <section aria-label="Claw controls" data-n7-controls>
        <button
          type="button"
          onClick={() => coordinator?.dispatch({ type: 'beginAim' })}
          disabled={!n7Ready}
        >
          Aim
        </button>
        <button
          type="button"
          onClick={() => dispatchAim('x', aimX)}
          disabled={n7State !== 'aiming'}
        >
          Set X {aimX.toFixed(2)}
        </button>
        <button
          type="button"
          onClick={() => dispatchAim('z', aimZ)}
          disabled={n7State !== 'aiming'}
        >
          Set Z {aimZ.toFixed(2)}
        </button>
        <label>
          X
          <input
            aria-label="Aim X"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={aimX}
            onChange={(event) => {
              const value = Number(event.target.value)
              setAimX(value)
              dispatchAim('x', value)
            }}
          />
        </label>
        <label>
          Z
          <input
            aria-label="Aim Z"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={aimZ}
            onChange={(event) => {
              const value = Number(event.target.value)
              setAimZ(value)
              dispatchAim('z', value)
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => coordinator?.dispatch({ type: 'confirmDrop' })}
          disabled={n7State !== 'aiming'}
        >
          Drop
        </button>
        <button
          type="button"
          onClick={() => coordinator?.dispatch({ type: 'requestReset' })}
          disabled={coordinator === null || n7State === 'resetting'}
        >
          Reset
        </button>
        <output aria-live="polite" data-n7-status>
          {n7State}
        </output>
      </section>
    </main>
  )
}
