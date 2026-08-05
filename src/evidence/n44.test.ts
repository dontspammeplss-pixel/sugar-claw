import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createN44Evidence } from './n44-evidence'

describe('N44 prize packaging geometry and region-aware grip', () => {
  it('passes body/corner/tag/strap fixtures and rejects pseudo-capture', async () => {
    const evidence = createN44Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile('records/evidence/n44-geometry-variety.json', JSON.stringify(evidence, null, 2))

    expect(evidence.status).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.fixtures.map(({ caughtRegion }) => caughtRegion)).toEqual([
      'body',
      'corner',
      'tag',
      'strap',
    ])
    expect(evidence.fixtures[0].retentionFactor).toBeGreaterThan(evidence.fixtures[2].retentionFactor)
    expect(evidence.fixtures.every(({ fixedStepRepeatable }) => fixedStepRepeatable)).toBe(true)
    expect(evidence.negativeFixture).toMatchObject({
      rejected: true,
      reason: 'pseudo-capture',
      caughtRegion: null,
    })
  })
})
