import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createN49Evidence } from './n49-evidence'

/**
 * N49 (F-09): evidence of EMERGENT braking — per A-44 (F-10 middle path) N49
 * writes no braking code. This test proves scheduled travel decelerates into
 * targets, release does not snap, no overshoot, the behavior is fixed-step
 * reproducible, and the N23 glide is untouched — across every
 * duration-scheduled phase (descent/lift/returnTraverse/returnDescent).
 */
describe('N49 emergent braking (evidence-only)', () => {
  it('evidences deceleration into target, no snap, no overshoot, determinism, glide intact', async () => {
    const evidence = createN49Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n49-braking-trace.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.node).toBe('N49')
    expect(evidence.result).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.physics).toMatchObject({
      revision: N6_PHYSICS_CONFIG.revision,
      travelTolerance: N6_PHYSICS_CONFIG.tolerances.travel,
      dt: N6_PHYSICS_CONFIG.dt,
    })

    // Evidence 1 — travel visibly decelerates into targets (braking), across
    // all four duration-scheduled phases; glide excluded.
    expect(
      evidence.traces.filter((trace) => trace.phase !== 'freePositioning').length,
    ).toBe(4)
    expect(evidence.gates.decelerationVisible).toBe(true)

    // Evidence 2 — release does not snap: arrival velocity is a small fraction
    // of peak and completion satisfies the coordinator's positionsMatch gate.
    expect(evidence.gates.noSnapAtArrival).toBe(true)

    // Evidence 3 — no overshoot: positions stay within [start, target] and the
    // animator returns the exact target.
    expect(evidence.gates.noOvershoot).toBe(true)

    // Contract 2 — braking distance/settle emerge from config caps (tuning
    // sweep), never hardcoded durations.
    expect(evidence.gates.configDriven).toBe(true)

    // Evidence 4 — fixed-step determinism across independent runs.
    expect(evidence.repeat.byteIdentical).toBe(true)
    expect(evidence.gates.fixedStepRepeatable).toBe(true)

    // Contract — N23 glide semantics untouched and excluded from braking gates.
    expect(evidence.gates.glideIntact).toBe(true)

    // All gates asserted individually above; the evidence is self-checking.
    expect(Object.values(evidence.gates).every(Boolean)).toBe(true)
  })
})
