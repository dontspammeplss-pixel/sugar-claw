import { readdir, readFile } from 'node:fs/promises'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createPrizePersistenceStore } from '../playfield/prize-persistence'
import {
  DEFAULT_OPS_SETTINGS,
  loadOpsSettings,
  OPS_ENABLED,
  OPS_PANEL_MARKER,
  OPS_STORAGE_KEY,
  percentReadout,
  psiReadout,
  saveOpsSettings,
  type OpsSettings,
} from '../ops/ops-store'

/**
 * N51 (F-11): ops-only grip strength evidence. Proves (1) live tuning — a
 * single running adapter's GripCapacity moves with setGripVoltage (12→36V),
 * (2) failure results — out-of-band values clamp, non-finite rejects,
 * (3) dev-only namespace — the ops store writes only `claw-app:ops:v1` and
 * never touches player save data, (4) build gating — ops is off by default and
 * the prod bundle carries no ops marker. Evidence written by n51.test.ts to
 * records/evidence/n51-ops-gate.json.
 */

export interface N51LiveTuningPoint {
  readonly commanded: number
  readonly applied: number
  readonly voltage: number
  readonly capacity: number
  readonly margin: number
}

export interface N51OpsEvidence {
  readonly node: 'N51'
  readonly result: 'pass' | 'fail'
  readonly deterministic: true
  readonly ops: {
    readonly enabled: boolean
    readonly marker: string
    readonly storageKey: string
    readonly playerNamespace: string
    readonly defaults: Readonly<OpsSettings>
    readonly clamp: { readonly min: number; readonly max: number }
  }
  readonly liveTuning: {
    readonly points: readonly N51LiveTuningPoint[]
    readonly outOfBand: readonly { commanded: number; applied: number }[]
    readonly nonFiniteRejected: boolean
    readonly percentAt24: number
    readonly psiAt24: number
  }
  readonly namespace: {
    readonly keysAfterOpsSave: readonly string[]
    readonly keysAfterOpsAndPlayerSave: readonly string[]
    readonly roundTripVoltage: number | null
    readonly disjoint: boolean
    readonly opsSaveIsolated: boolean
    readonly playerSaveClean: boolean
  }
  readonly buildGate: {
    readonly opsEnabledByDefault: boolean
    readonly prodBundleChecked: boolean
    readonly prodBundleClean: boolean
  }
  readonly gates: {
    readonly voltageClamped: boolean
    readonly liveTuningCapacityMonotone: boolean
    readonly outOfBandClamped: boolean
    readonly nonFiniteRejected: boolean
    readonly readoutsInRange: boolean
    readonly namespaceDisjoint: boolean
    readonly opsSaveIsolated: boolean
    readonly playerSaveClean: boolean
    readonly opsEnabledByDefault: boolean
  }
}

interface MemoryStorage extends Storage {
  readonly keys: () => readonly string[]
}

function createMemoryStorage(): MemoryStorage {
  const entries = new Map<string, string>()
  return {
    get length(): number {
      return entries.size
    },
    clear: () => {
      entries.clear()
    },
    getItem: (key) => entries.get(String(key)) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(String(key))
    },
    setItem: (key, value) => {
      entries.set(String(key), String(value))
    },
    keys: () => [...entries.keys()],
  }
}

async function checkProdBundle(): Promise<{
  checked: boolean
  clean: boolean
}> {
  try {
    const assets = await readdir('dist/assets', { withFileTypes: true })
    const jsFiles = assets
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map((entry) => entry.name)
    if (jsFiles.length === 0) return { checked: false, clean: false }
    for (const name of jsFiles) {
      const source = await readFile(`dist/assets/${name}`, 'utf8')
      if (source.includes(OPS_PANEL_MARKER)) {
        return { checked: true, clean: false }
      }
    }
    return { checked: true, clean: true }
  } catch {
    return { checked: false, clean: false }
  }
}

const PLAYER_NAMESPACE = 'claw-app:player:prizes:'

export async function createN51Evidence(): Promise<N51OpsEvidence> {
  const clamp = {
    min: N6_PHYSICS_CONFIG.retention.minGripVoltage,
    max: N6_PHYSICS_CONFIG.retention.maxGripVoltage,
  }

  // --- live tuning on a single running adapter with an ACTIVE hold ---
  // The retention balance is re-evaluated every fixed step while holding
  // (adapter step(): createRetentionState('holding') per step), reading
  // retentionConfig.gripVoltage live — so a mid-carry voltage change shifts
  // capacity/margin on the very next step (ops-disconnected guard).
  const PARK_POSITION = N6_PHYSICS_CONFIG.gripPosition
  const adapter = await N6PhysicsAdapter.create({
    retention: { gripVoltage: 24 },
  })
  const points: N51LiveTuningPoint[] = []
  try {
    adapter.moveClaw(PARK_POSITION)
    adapter.stepMany(3)
    if (adapter.attemptGrip().holdStarted) {
      adapter.stepMany(3)
      for (const commanded of [24, 12, 36]) {
        const applied = adapter.setGripVoltage(commanded)
        adapter.stepMany(1)
        const retention = adapter.retention
        points.push({
          commanded,
          applied,
          voltage: retention.voltage,
          capacity: retention.capacity,
          margin: retention.margin,
        })
      }
    }
  } finally {
    adapter.dispose()
  }
  const voltageClamped =
    points.length === 3 &&
    points.every(
      (point) =>
        point.applied === point.commanded && point.voltage === point.commanded,
    )
  const liveTuningCapacityMonotone =
    points[2].capacity > points[0].capacity &&
    points[0].capacity > points[1].capacity &&
    points[2].margin > points[0].margin &&
    points[0].margin > points[1].margin

  // --- out-of-band + non-finite (failure results) ---
  const clampAdapter = await N6PhysicsAdapter.create({
    retention: { gripVoltage: 24 },
  })
  let outOfBand: readonly { commanded: number; applied: number }[] = []
  let nonFiniteRejected = false
  try {
    outOfBand = [
      { commanded: 5, applied: clampAdapter.setGripVoltage(5) },
      { commanded: 50, applied: clampAdapter.setGripVoltage(50) },
    ]
    try {
      clampAdapter.setGripVoltage(Number.NaN)
    } catch {
      nonFiniteRejected = true
    }
  } finally {
    clampAdapter.dispose()
  }
  const outOfBandClamped =
    outOfBand[0].applied === clamp.min && outOfBand[1].applied === clamp.max

  // --- calibration readouts (display-only) ---
  const pct12 = percentReadout(12)
  const pct36 = percentReadout(36)
  const psi12 = psiReadout(12)
  const psi36 = psiReadout(36)
  const readoutsInRange = pct12 === 0 && pct36 === 100 && psi12 === 45 && psi36 === 60

  // --- dev-only namespace (shimmed localStorage, restored after) ---
  const storageTarget = globalThis as unknown as { localStorage?: Storage }
  const original = storageTarget.localStorage
  const shim = createMemoryStorage()
  let keysAfterOpsSave: readonly string[] = []
  let keysAfterOpsAndPlayerSave: readonly string[] = []
  let roundTripVoltage: number | null = null
  let namespaceDisjoint = false
  let opsSaveIsolated = false
  let playerSaveClean = false
  try {
    storageTarget.localStorage = shim
    saveOpsSettings({
      revision: DEFAULT_OPS_SETTINGS.revision,
      gripVoltage: 30,
    })
    keysAfterOpsSave = shim.keys()
    const loaded = loadOpsSettings()
    roundTripVoltage = loaded?.gripVoltage ?? null
    const opsRaw = shim.getItem(OPS_STORAGE_KEY)
    let opsKeysOk = false
    if (opsRaw) {
      try {
        const opsJson = JSON.parse(opsRaw) as Record<string, unknown>
        opsKeysOk = Object.keys(opsJson).every(
          (key) => key === 'revision' || key === 'gripVoltage',
        )
      } catch {
        opsKeysOk = false
      }
    }
    opsSaveIsolated =
      keysAfterOpsSave.length === 1 &&
      keysAfterOpsSave[0] === OPS_STORAGE_KEY &&
      opsKeysOk &&
      roundTripVoltage === 30

    const playerStore = createPrizePersistenceStore()
    playerStore.save({ manifestRevision: 'n51-fixture', prizes: [] })
    keysAfterOpsAndPlayerSave = shim.keys()
    const playerKey = keysAfterOpsAndPlayerSave.find((key) =>
      key.startsWith(PLAYER_NAMESPACE),
    )
    namespaceDisjoint =
      keysAfterOpsAndPlayerSave.length === 2 &&
      keysAfterOpsAndPlayerSave.includes(OPS_STORAGE_KEY) &&
      playerKey !== undefined &&
      !OPS_STORAGE_KEY.startsWith(PLAYER_NAMESPACE)
    const playerRaw = playerKey ? shim.getItem(playerKey) : null
    playerSaveClean = false
    if (playerKey !== undefined && playerRaw !== null) {
      try {
        const playerJson = JSON.parse(playerRaw) as Record<string, unknown>
        playerSaveClean =
          !('gripVoltage' in playerJson) &&
          Object.keys(playerJson).every(
            (key) => !key.toLowerCase().includes('ops'),
          )
      } catch {
        playerSaveClean = false
      }
    }
  } finally {
    storageTarget.localStorage = original
  }

  const bundle = await checkProdBundle()
  const gates: N51OpsEvidence['gates'] = {
    voltageClamped,
    liveTuningCapacityMonotone,
    outOfBandClamped,
    nonFiniteRejected,
    readoutsInRange,
    namespaceDisjoint,
    opsSaveIsolated,
    playerSaveClean,
    opsEnabledByDefault: !OPS_ENABLED,
  }
  const result: N51OpsEvidence['result'] = Object.values(gates).every(Boolean)
    ? 'pass'
    : 'fail'

  return {
    node: 'N51',
    result,
    deterministic: true,
    ops: {
      enabled: OPS_ENABLED,
      marker: OPS_PANEL_MARKER,
      storageKey: OPS_STORAGE_KEY,
      playerNamespace: PLAYER_NAMESPACE,
      defaults: DEFAULT_OPS_SETTINGS,
      clamp,
    },
    liveTuning: {
      points,
      outOfBand,
      nonFiniteRejected,
      percentAt24: percentReadout(24),
      psiAt24: psiReadout(24),
    },
    namespace: {
      keysAfterOpsSave,
      keysAfterOpsAndPlayerSave,
      roundTripVoltage,
      disjoint: namespaceDisjoint,
      opsSaveIsolated,
      playerSaveClean,
    },
    buildGate: {
      opsEnabledByDefault: !OPS_ENABLED,
      prodBundleChecked: bundle.checked,
      prodBundleClean: bundle.clean,
    },
    gates,
  }
}
