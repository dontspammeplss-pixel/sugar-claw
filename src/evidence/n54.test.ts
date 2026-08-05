import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createN54Evidence } from './n54-evidence'

describe('N54 fallback prize collider geometry', () => {
  it('supports every default visual body and settles without floor or glass clipping', async () => {
    const evidence = await createN54Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n54-prize-collider-settle.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.status).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.contract.bodyFirst).toBe(true)
    expect(evidence.contract.bodyShapesMatch).toBe(true)
    expect(evidence.contract.packagingMatches).toBe(true)
    expect(evidence.contract.captureTargetsAndRetention).toBe(true)
    expect(evidence.contract.colliderCountMatches).toBe(true)
    expect(evidence.contract.actualColliderCount).toBe(4)
    expect(evidence.settle.floorAndWallClear).toBe(true)
    expect(
      evidence.settle.prizes.find((prize) => prize.id === 'prize')?.position[1],
    ).toBeCloseTo(1.109, 2)
    expect(
      evidence.settle.prizes.find((prize) => prize.id === 'tag-prize')
        ?.position[1],
    ).toBeGreaterThanOrEqual(1.1)
    expect(
      evidence.settle.prizes.find((prize) => prize.id === 'pouch-prize')
        ?.position[1],
    ).toBeGreaterThanOrEqual(1.13)
    expect(evidence.settle.prizes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'prize',
          geometry: 'sphere',
          position: expect.arrayContaining([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number),
          ]),
        }),
        expect.objectContaining({
          id: 'tag-prize',
          geometry: 'tag',
          visualBottom: expect.any(Number),
          floorClear: true,
        }),
        expect.objectContaining({
          id: 'pouch-prize',
          geometry: 'soft-pouch',
          visualBottom: expect.any(Number),
          floorClear: true,
        }),
      ]),
    )
    expect(evidence.repeatability.withinTolerance).toBe(true)
    expect(evidence.failureResults).toEqual([])
  })
})
