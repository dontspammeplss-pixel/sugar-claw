import { useEffect, useState } from 'react'
import type { N7EffectCoordinator } from '../effects/n7-coordinator'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import {
  applyOpsVoltage,
  clampGripVoltage,
  DEFAULT_OPS_SETTINGS,
  loadOpsSettings,
  OPS_PANEL_MARKER,
  percentReadout,
  psiReadout,
  saveOpsSettings,
} from '../ops/ops-store'

export interface OpsPanelProps {
  readonly coordinator: N7EffectCoordinator | null
  readonly margin: number | null
}

/**
 * N51 (F-11): dev/operator-only grip-strength panel. Rendered only when the
 * app is built with VITE_OPS=1 and the panel is toggled on (Ctrl+Alt+O,
 * with Ctrl+Shift+O retained as the contract shortcut).
 * Every change writes through the coordinator → adapter clamped path and
 * persists to the dev-only ops namespace (`claw-app:ops:v1`).
 */
export function OpsPanel({ coordinator, margin }: OpsPanelProps) {
  const { minGripVoltage, maxGripVoltage } = N6_PHYSICS_CONFIG.retention
  const [voltage, setVoltage] = useState<number>(
    DEFAULT_OPS_SETTINGS.gripVoltage,
  )

  // Apply persisted dev settings once the coordinator is ready (clamped
  // write path lives in ops-store so it is unit-testable without a DOM).
  useEffect(() => {
    if (!coordinator) return
    const next = applyOpsVoltage(coordinator, loadOpsSettings())
    setVoltage(next)
  }, [coordinator])

  const handleVoltage = (value: number): void => {
    const next = clampGripVoltage(value)
    setVoltage(next)
    if (coordinator) coordinator.setGripVoltage(next)
    saveOpsSettings({
      revision: DEFAULT_OPS_SETTINGS.revision,
      gripVoltage: next,
    })
  }

  return (
    <aside
      className="ops-panel"
      data-ops-panel
      data-ops-marker={OPS_PANEL_MARKER}
    >
      <header className="ops-panel-header">
        <strong>OPS · Grip</strong>
        <span className="ops-panel-badge">dev-only</span>
      </header>
      <label className="ops-panel-row" htmlFor="ops-grip-voltage">
        <span>
          gripVoltage <em>{voltage.toFixed(1)} V</em>
        </span>
        <input
          id="ops-grip-voltage"
          className="ops-panel-slider"
          type="range"
          min={minGripVoltage}
          max={maxGripVoltage}
          step={0.5}
          value={voltage}
          onChange={(event) => handleVoltage(Number(event.target.value))}
        />
      </label>
      <div className="ops-panel-readouts">
        <span className="ops-panel-readout">
          <b>{percentReadout(voltage).toFixed(0)}%</b>
          strength
        </span>
        <span className="ops-panel-readout">
          <b>{psiReadout(voltage).toFixed(0)} psi</b>
          calibration
        </span>
        <span
          className={`ops-margin-chip ${
            margin === null || margin >= 0 ? 'is-ok' : 'is-risk'
          }`}
          title="Live retention margin"
        >
          margin {margin === null ? '—' : `${margin.toFixed(1)} N`}
        </span>
      </div>
      <footer className="ops-panel-footer">
        live · dev-only · Ctrl+Alt+O to hide (Ctrl+Shift+O also works)
      </footer>
    </aside>
  )
}
