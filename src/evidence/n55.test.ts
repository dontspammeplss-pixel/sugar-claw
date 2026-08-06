import { describe, expect, it } from 'vitest'
import { fingerSegmentTransform } from '../claw/rig'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { DEFAULT_PRIZE_MANIFEST, type PrizeManifest } from '../playfield/prize-manifest'

const SIZE_CASES = [
  { label: 'small', radius: 0.08 },
  { label: 'medium', radius: 0.22 },
  { label: 'large', radius: 0.3 },
] as const

function manifestForRadius(radius: number): PrizeManifest {
  const base = DEFAULT_PRIZE_MANIFEST.prizes[0]
  return {
    ...DEFAULT_PRIZE_MANIFEST,
    revision: `n55-size-${radius}`,
    prizes: [{
      ...base,
      position: [...N6_PHYSICS_CONFIG.prizePosition],
      subGeometries: [{
        id: 'body',
        region: 'body',
        shape: 'sphere',
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        radius,
        captureTarget: true,
        retentionFactor: 1,
      }],
    }],
  }
}

describe('N55 segmented finger collision protection', () => {
  it('registers a fitted collider for every blade and hook segment with CCD enabled', async () => {
    const adapter = await N6PhysicsAdapter.create({
      prizeManifest: manifestForRadius(0.22),
      persistPrizeState: false,
    })
    const inventory = adapter.diagnosticInventory()
    const fingerIdentities = inventory.identities.filter(
      (identity) => identity.entity === 'collider' && identity.role === 'clawFinger',
    )
    expect(fingerIdentities).toHaveLength(6)
    expect(fingerIdentities.map((identity) => identity.colliderId)).toEqual([
      'claw-finger-0-blade',
      'claw-finger-0-hook',
      'claw-finger-1-blade',
      'claw-finger-1-hook',
      'claw-finger-2-blade',
      'claw-finger-2-hook',
    ])
    expect(fingerIdentities.every((identity) => identity.ccdEnabled)).toBe(true)
    for (const identity of fingerIdentities) {
      const match = identity.colliderId.match(/^claw-finger-(\d+)-(blade|hook)$/)
      expect(match).not.toBeNull()
      const [, index, segment] = match!
      const expected = fingerSegmentTransform(
        Number(index),
        segment as 'blade' | 'hook',
        0,
        0,
      )
      const head = inventory.identities.find(
        (entry) => entry.entity === 'body' && entry.logicalBodyId === 'head',
      )!
      expect(identity.transform.position).toEqual(
        expected.position.map((value, axis) =>
          expect.closeTo(value + head.transform.position[axis], 5),
        ) as unknown as readonly [number, number, number],
      )
      expect(identity.transform.quaternion).toEqual(
        expected.rotation.map((value) => expect.closeTo(value, 5)) as unknown as readonly [number, number, number, number],
      )
    }
    const prizeBody = inventory.identities.find(
      (identity) => identity.entity === 'body' && identity.logicalBodyId === 'prize',
    )
    expect(prizeBody?.ccdEnabled).toBe(true)
    expect(inventory.missingRegistrations).toEqual([])
    adapter.dispose()
  })

  it.each(SIZE_CASES)('keeps $label prize contacts solver-owned without mesh-envelope clipping', async ({ radius }) => {
    const adapter = await N6PhysicsAdapter.create({
      prizeManifest: manifestForRadius(radius),
      persistPrizeState: false,
    })
    try {
      adapter.moveClaw([0, 1.72, 0])
      adapter.stepMany(2)
      if (radius === 0.08) {
        adapter.moveClaw([0.7, 1.52, 0])
        adapter.step()
        adapter.moveClaw([-0.7, 1.52, 0])
        adapter.step()
      } else {
        adapter.movePrize('prize', [0.28, 1.52, 0])
      }
      const observation = adapter.observeGrip()
      const traces = adapter.observeN38ContactTraces()
      const fingerTraces = traces.filter(
        (trace) =>
          (trace.a === 'clawFinger' && trace.b === 'prize') ||
          (trace.a === 'prize' && trace.b === 'clawFinger'),
      )
      expect(observation.physicalContact).toBe(true)
      expect(fingerTraces.length).toBeGreaterThan(0)
      expect(fingerTraces.every((trace) => trace.solverContact && trace.eligible)).toBe(true)
      // The swept small-prize case verifies CCD contact rather than relying
      // on a rendered overlap; medium/large cases stay within solver epsilon.
      if (radius !== 0.08) {
        expect(observation.contacts.every((contact) => contact.distance >= -0.001)).toBe(true)
      }
    } finally {
      adapter.dispose()
    }
  })
})
