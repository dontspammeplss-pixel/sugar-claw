import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { applyOpsVoltage, OPS_ENABLED } from '../ops/ops-store'
import { createN51Evidence } from './n51-evidence'

/**
 * N51 (F-11): adjustable grip strength, dev/operator-only. Per A-45 the knob
 * lives in the ops namespace (VITE_OPS=1 gate + Ctrl+Shift+O), feeds F-01's
 * GripCapacity live through the coordinator → adapter clamped path, and never
 * touches player save data. Failure results covered: ops-leak (namespace),
 * ops-gate-inert (build gate), ops-disconnected (live tuning), and
 * ops-voltage-out-of-band (clamp).
 */
describe('N51 ops-only grip strength', () => {
  it('evidences live voltage tuning, dev-only namespace, and build gating', async () => {
    const evidence = await createN51Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n51-ops-gate.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.node).toBe('N51')
    expect(evidence.result).toBe('pass')
    expect(evidence.deterministic).toBe(true)

    // Contract 1/3 — live tuning: voltage change shifts capacity on the SAME
    // running adapter (ops-disconnected guard).
    expect(evidence.gates.voltageClamped).toBe(true)
    expect(evidence.gates.liveTuningCapacityMonotone).toBe(true)

    // Failure results — out-of-band values clamp, non-finite rejects.
    expect(evidence.gates.outOfBandClamped).toBe(true)
    expect(evidence.gates.nonFiniteRejected).toBe(true)

    // Contract 4 — namespace separation: ops save isolated to its own key;
    // player save contains no ops values (ops-leak guard).
    expect(evidence.gates.namespaceDisjoint).toBe(true)
    expect(evidence.gates.opsSaveIsolated).toBe(true)
    expect(evidence.gates.playerSaveClean).toBe(true)

    // Contract 2/5 — ops off by default in non-ops builds; calibration
    // readouts are display-only and in range.
    expect(evidence.gates.opsEnabledByDefault).toBe(true)
    expect(OPS_ENABLED).toBe(false)
    expect(evidence.gates.readoutsInRange).toBe(true)

    // Build-gate trace is owned by `npm run gate:ops`, which builds fresh
    // player and ops bundles; this unit test records any available prod check
    // without depending on a pre-existing dist/ directory.
    if (evidence.buildGate.prodBundleChecked) {
      expect(evidence.buildGate.prodBundleClean).toBe(true)
    }

    // All gates asserted individually above; the evidence is self-checking.
    expect(Object.values(evidence.gates).every(Boolean)).toBe(true)
  })

  it('applies operator voltage through the clamped write path (panel → coordinator)', () => {
    const calls: number[] = []
    const fakeCoordinator = {
      setGripVoltage: (value: number): number => {
        calls.push(value)
        return value
      },
    }
    // Persisted out-of-band value clamps before it reaches the coordinator.
    expect(
      applyOpsVoltage(fakeCoordinator, {
        revision: 'n51-ops-rev1',
        gripVoltage: 50,
      }),
    ).toBe(36)
    expect(() => applyOpsVoltage(fakeCoordinator, {
      revision: 'n51-ops-rev1',
      gripVoltage: Number.NaN,
    })).toThrow(/must be finite/)
    // No persisted settings → the default 24V is applied (baseline parity).
    expect(applyOpsVoltage(fakeCoordinator, null)).toBe(24)
    expect(calls).toEqual([36, 24])
  })
})
