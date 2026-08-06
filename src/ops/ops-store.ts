import { N6_PHYSICS_CONFIG } from '../physics/config'

/**
 * N51 (F-11): dev/operator-only grip strength. The ops layer is build-gated
 * (VITE_OPS=1 — player builds tree-shake the panel) and persists to its own
 * dev-only localStorage namespace, never player save data (`claw-app:player:*`).
 * gripVoltage stays the single runtime-tunable retention knob (12–36V, default
 * 24V) per A-45 (shared voltage namespace, C-10).
 */

/** localStorage key for dev/operator settings (never player save data). */
export const OPS_STORAGE_KEY = 'claw-app:ops:v1'
/** Stable marker string rendered only by the ops panel (build-gate trace). */
export const OPS_PANEL_MARKER = 'claw-ops-v1'
/** Build-scoped gate: the ops UI exists only when built with VITE_OPS=1. */
export const OPS_ENABLED = import.meta.env.VITE_OPS === '1'

export interface OpsSettings {
  readonly revision: string
  readonly gripVoltage: number
}

export const DEFAULT_OPS_SETTINGS: Readonly<OpsSettings> = {
  revision: 'n51-ops-rev1',
  gripVoltage: N6_PHYSICS_CONFIG.retention.gripVoltage,
}

/** Clamp finite input to the approved 12–36V retention range. */
export function clampGripVoltage(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('N51 ops: grip voltage must be finite')
  }
  const { minGripVoltage, maxGripVoltage } = N6_PHYSICS_CONFIG.retention
  return Math.min(maxGripVoltage, Math.max(minGripVoltage, value))
}

/** Internal 0–100% readout for calibration display (display-only). */
export function percentReadout(voltage: number): number {
  const { minGripVoltage, maxGripVoltage } = N6_PHYSICS_CONFIG.retention
  return ((voltage - minGripVoltage) / (maxGripVoltage - minGripVoltage)) * 100
}

/** 45–60 psi linear readout for calibration display (display-only). */
export function psiReadout(voltage: number): number {
  const { minGripVoltage, maxGripVoltage } = N6_PHYSICS_CONFIG.retention
  const ratio = (voltage - minGripVoltage) / (maxGripVoltage - minGripVoltage)
  return 45 + ratio * 15
}

/**
 * N51 (F-11): sanctioned ops write path — applies the operator voltage to the
 * coordinator with clamping and returns the applied value. The panel calls
 * this on mount so the write logic is unit-testable without a DOM.
 */
export function applyOpsVoltage(
  coordinator: { setGripVoltage(value: number): number },
  settings: OpsSettings | null,
): number {
  const next = clampGripVoltage(
    settings?.gripVoltage ?? DEFAULT_OPS_SETTINGS.gripVoltage,
  )
  coordinator.setGripVoltage(next)
  return next
}

const memoryStore = new Map<string, string>()

function storage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') return null
  return globalThis.localStorage
}

export function loadOpsSettings(): OpsSettings | null {
  const raw =
    storage()?.getItem(OPS_STORAGE_KEY) ?? memoryStore.get(OPS_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OpsSettings>
    if (
      parsed.revision !== DEFAULT_OPS_SETTINGS.revision ||
      typeof parsed.gripVoltage !== 'number' ||
      !Number.isFinite(parsed.gripVoltage)
    ) {
      return null
    }
    return {
      revision: parsed.revision,
      gripVoltage: clampGripVoltage(parsed.gripVoltage),
    }
  } catch {
    return null
  }
}

/** Persists to the dev-only namespace only — never touches player keys. */
export function saveOpsSettings(settings: OpsSettings): void {
  const normalized: OpsSettings = {
    revision: DEFAULT_OPS_SETTINGS.revision,
    gripVoltage: clampGripVoltage(settings.gripVoltage),
  }
  const raw = JSON.stringify(normalized)
  const target = storage()
  if (target) target.setItem(OPS_STORAGE_KEY, raw)
  memoryStore.set(OPS_STORAGE_KEY, raw)
}
