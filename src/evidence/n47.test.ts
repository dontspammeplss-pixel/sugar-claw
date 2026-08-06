import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createN47Evidence } from './n47-evidence'

/**
 * N47 (F-07): functional pendulum — swing shakes marginal grips loose.
 * The head is already a real spherical-jointed pendulum; the coupling feeds
 * its measured angular acceleration into RequiredHoldForce each fixed step.
 * The fixtures prove the release is caused by the physical swing (never a
 * scripted event), that the coupling is monotone and bounded, and that at
 * rest the retention balance is unchanged (N41 semantics preserved).
 */
describe('N47 pendulum-swing retention coupling', () => {
  it('passes the swing coupling, sweep, and at-rest gates with fixed-step evidence', async () => {
    const evidence = await createN47Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n47-swing-coupling.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.node).toBe('N47')
    expect(evidence.result).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.physics).toMatchObject({
      revision: N6_PHYSICS_CONFIG.revision,
      retentionRevision: N6_PHYSICS_CONFIG.retention.revision,
      dt: 1 / 60,
      swingTransfer: {
        revision: N6_PHYSICS_CONFIG.retention.swingTransfer.revision,
      },
    })

    // Contract item 2 — sharp swing / sudden stop: weak grip releases, strong
    // grip holds, and the release is the balance (margin<0), not a script.
    expect(evidence.weakGrip.marginBefore).toBeGreaterThan(0)
    expect(evidence.weakGrip.released).toBe(true)
    expect(evidence.weakGrip.releaseReason).toBe('hold-margin-negative')
    expect(evidence.weakGrip.peakSwingAcceleration).toBeGreaterThan(0)
    expect(evidence.weakGrip.finalMargin).toBeLessThan(0)
    expect(evidence.strongGrip.marginBefore).toBeGreaterThan(0)
    expect(evidence.strongGrip.released).toBe(false)
    expect(evidence.strongGrip.peakSwingAcceleration).toBeGreaterThan(0)
    expect(evidence.strongGrip.finalMargin).toBeGreaterThan(0)

    // Contract item 4 — monotone and bounded sweep.
    expect(evidence.sweep.length).toBeGreaterThan(2)
    expect(evidence.gates.couplingMonotone).toBe(true)
    expect(evidence.gates.couplingBounded).toBe(true)

    // Contract evidence 3 — N33-weighted settling preserved at rest (N41 terms
    // unchanged: zero swing ⇒ RequiredHoldForce ≈ declared prize weight).
    expect(evidence.gates.atRestPreserved).toBe(true)
    expect(evidence.gates.fixedStepRepeatable).toBe(true)

    // All gates are asserted individually above; the evidence is self-checking.
    expect(Object.values(evidence.gates).every(Boolean)).toBe(true)
  })
})
