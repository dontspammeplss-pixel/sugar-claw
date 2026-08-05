import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createN43Evidence } from './n43-evidence'

describe('N43 multi-prize manifest and persistent playfield', () => {
  it('validates manifest, persistence, reset semantics, collision groups, and repeatability', async () => {
    const evidence = await createN43Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n43-playfield-manifest.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.status).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.manifest).toMatchObject({
      prizeCount: 3,
      geometries: ['sphere', 'tag', 'soft-pouch'],
      validationErrors: [],
      invalidManifestRejected: true,
    })
    expect(evidence.manifest.invalidManifestError).toMatch(/^manifest-invalid:/)
    expect(evidence.persistence.sameRevisionRestored).toBe(true)
    expect(evidence.winRemoval).toEqual({
      delivered: true,
      removed: true,
      winningsCount: 1,
      reloadRemoved: true,
      reloadWinningsCount: 1,
      selectedPrizeId: 'tag-prize',
      selectedWeight: 8,
      selectedCenterOfMass: [0.02, 0.01, 0],
    })
    expect(evidence.resetSemantics).toMatchObject({
      freshRevisionReset: true,
      noWonPrizesOnFreshRevision: true,
    })
    expect(evidence.collision).toMatchObject({
      prizeColliderCount: 4,
      distinctFromClaw: true,
      prizeVsPrizeEligible: true,
      prizeVsClawEligible: true,
      prizeCollision: { observed: true },
    })
    expect(evidence.repeatability.thirtyFixedStepsMatch).toBe(true)
    expect(evidence.performance.measured.withinPhysicsStepBudget).toBe(true)
  })
})
