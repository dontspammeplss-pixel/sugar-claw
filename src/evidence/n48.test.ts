import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { GLIDE_SPEED_X, GLIDE_SPEED_Z } from '../effects/n7-coordinator'
import { createN48Evidence } from './n48-evidence'

/**
 * N48 (F-08): per-phase speed profile throttling + the physical speed/success
 * tradeoff. The profile lives in config; the phase scheduler applies it; the
 * adapter measures the carriage's travel acceleration into RequiredHoldForce.
 * The fixtures prove the tradeoff is the physics — a fast carry with a weak
 * grip drops while a slow carry with the same grip holds — and that the
 * defaults never feel sluggish. N23 glide/bounds coverage stays in n7.test.ts.
 */
describe('N48 speed-profile throttling', () => {
  it('passes the profile trace, fast-vs-slow tradeoff, and gate with fixed-step evidence', async () => {
    const evidence = await createN48Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n48-speed-trace.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.node).toBe('N48')
    expect(evidence.result).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.physics).toMatchObject({
      revision: N6_PHYSICS_CONFIG.revision,
      retentionRevision: N6_PHYSICS_CONFIG.retention.revision,
      travelProfileRevision: N6_PHYSICS_CONFIG.travelProfile.revision,
      dt: 1 / 60,
      travelTransfer: {
        revision: N6_PHYSICS_CONFIG.retention.travelTransfer.revision,
      },
    })

    // Evidence 1 — per-phase speed trace vs profile (measured step velocities),
    // and the phase ordering: free positioning fastest, descent/lift slowest.
    expect(evidence.traces.length).toBeGreaterThanOrEqual(5)
    expect(evidence.gates.traceObeysProfile).toBe(true)
    expect(evidence.gates.phaseOrdering).toBe(true)

    // Contract 2 — fast carry with a weak grip drops; slow carry with the
    // same grip holds; the release is the balance, not a scripted event.
    expect(evidence.fastCarry.voltage).toBe(evidence.slowCarry.voltage)
    expect(evidence.fastCarry.marginBefore).toBeGreaterThan(0)
    expect(evidence.fastCarry.released).toBe(true)
    expect(evidence.fastCarry.releaseReason).toBe('hold-margin-negative')
    expect(evidence.fastCarry.finalMargin).toBeLessThan(0)
    expect(evidence.slowCarry.released).toBe(false)
    expect(evidence.slowCarry.finalMargin).toBeGreaterThan(0)
    expect(evidence.gates.tradeoffPhysical).toBe(true)

    // Contract 3 — conservative, config-tunable defaults never feel sluggish.
    expect(evidence.gates.feelNotSluggish).toBe(true)

    // Contract 4 — N23 aim-glide semantics preserved (speeds unchanged).
    expect(evidence.traces[0].velocities).toEqual([
      GLIDE_SPEED_X,
      GLIDE_SPEED_Z,
    ])

    // Physics — the travel term feeds F-01, is absent at rest, and the
    // fast-vs-slow outcome is fixed-step repeatable.
    expect(evidence.gates.atRestPreserved).toBe(true)
    expect(evidence.gates.fixedStepRepeatable).toBe(true)

    // All gates are asserted individually above; the evidence is self-checking.
    expect(Object.values(evidence.gates).every(Boolean)).toBe(true)
  })
})
