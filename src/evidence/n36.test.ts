import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createN36Evidence } from './n36-evidence'

describe('N36 descent-to-base contract', () => {
  it('proves explicit base geometry, legal descent, contacts, reset, and repeatability', async () => {
    const evidence = await createN36Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n36-descent-trace.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.status).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.geometry.basePlane).toMatchObject({
      y: 0.89,
      normal: [0, 1, 0],
      coordinateLayer: 'world/ClawMount',
    })
    expect(evidence.geometry.clawEnvelope).toMatchObject({
      baseInteractionY: expect.any(Number),
      tolerance: N6_PHYSICS_CONFIG.clawClearance.tolerance,
    })
    expect(evidence.fixtures).toHaveLength(4)
    expect(evidence.fixtures.map(({ fixture }) => fixture)).toEqual([
      'center',
      'edge',
      'corner',
      'object-adjacent',
    ])
    expect(
      evidence.fixtures.every(
        (fixture) =>
          (fixture.completionReason === 'barrier-contact' ||
            (fixture.completionReason === 'base-clearance' &&
              Math.abs(fixture.basePlaneDistance) <=
                N6_PHYSICS_CONFIG.clawClearance.tolerance)) &&
          fixture.noForbiddenPenetration &&
          fixture.objectMovedByRapier &&
          fixture.noAnimationOnlyEndpoint &&
          (fixture.completionReason !== 'barrier-contact' ||
            fixture.contactPairs.length > 0),
      ),
    ).toBe(true)
    expect(evidence.assertions).toEqual({
      basePlaneDistanceWithinTolerance: true,
      noForbiddenPenetration: true,
      noAnimationOnlyEndpoint: true,
      repeatedRunWithinTolerance: true,
      resetRestoresEpochAndBaseline: true,
    })
    expect(evidence.repeatability.every((run) => run.sameEndpoint)).toBe(true)
    expect(evidence.reset).toMatchObject({
      runIdAdvanced: true,
      state: 'ready',
      baselineRestored: true,
      noContacts: true,
      noLogs: true,
    })
  })
})
