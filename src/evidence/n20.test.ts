import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import {
  DEFAULT_PRIZE_MANIFEST,
  loadPrizeManifest,
  type PrizeManifest,
} from '../playfield/prize-manifest'
import { createPrizePersistenceStore } from '../playfield/prize-persistence'

function cloneManifest(): PrizeManifest {
  return JSON.parse(JSON.stringify(DEFAULT_PRIZE_MANIFEST)) as PrizeManifest
}

function manifestWithTarget(targetId: string): PrizeManifest {
  const manifest = cloneManifest()
  const positions: Record<string, [number, number, number]> = {
    prize: [-0.9, 1.2, 0],
    'tag-prize': [0.9, 1.2, 0.08],
    'pouch-prize': [0, 1.2, 0.8],
  }
  return loadPrizeManifest({
    ...manifest,
    revision: `n20-grip-${targetId}-rev1`,
    prizes: manifest.prizes.map((prize) => ({
      ...prize,
      position:
        prize.id === targetId
          ? ([0, 1.2, 0] as [number, number, number])
          : positions[prize.id],
    })),
  })
}

describe('N-20 multi-prize grip onset', () => {
  it('selects and holds each contacted prize instead of passing through unselected prizes', async () => {
    const contactedPrizeIds = ['prize', 'tag-prize', 'pouch-prize'] as const
    const grips = []

    const initiallySelectedByTarget: Record<(typeof contactedPrizeIds)[number], string> = {
      prize: 'tag-prize',
      'tag-prize': 'prize',
      'pouch-prize': 'prize',
    }

    for (const contactedPrizeId of contactedPrizeIds) {
      const adapter = await N6PhysicsAdapter.create({
        prizeManifest: manifestWithTarget(contactedPrizeId),
        selectedPrizeId: initiallySelectedByTarget[contactedPrizeId],
        persistPrizeState: false,
      })
      try {
        expect(adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)).toBe(true)
        expect(adapter.selectedPrize).toBe(initiallySelectedByTarget[contactedPrizeId])
        adapter.stepMany(3)
        const observation = adapter.observeGrip()
        const attempt = adapter.attemptGrip()

        expect(observation).toMatchObject({
          physicalContact: true,
          gripApproved: true,
        })
        expect(adapter.selectedPrize).toBe(contactedPrizeId)
        expect(attempt).toMatchObject({
          accepted: true,
          holdStarted: true,
          reason: 'contact-approved',
        })
        grips.push({
          contactedPrizeId,
          physicalContact: observation.physicalContact,
          gripApproved: observation.gripApproved,
          selectedPrizeId: adapter.selectedPrize,
          holdStarted: attempt.holdStarted,
        })
      } finally {
        adapter.dispose()
      }
    }

    const evidence = {
      node: 'N20',
      status: grips.every(
        (grip) =>
          grip.physicalContact &&
          grip.gripApproved &&
          grip.contactedPrizeId === grip.selectedPrizeId &&
          grip.holdStarted,
      )
        ? 'pass'
        : 'fail',
      fixtures: grips,
    }
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n20-grip-onset-multi-prize.json',
      JSON.stringify(evidence, null, 2),
    )
    expect(evidence.status).toBe('pass')
    expect(grips).toHaveLength(3)
  })

  it('preserves no-contact behavior when every prize is removed', async () => {
    const manifest = loadPrizeManifest({
      ...cloneManifest(),
      revision: 'n20-grip-all-removed-rev1',
    })
    const persistence = createPrizePersistenceStore()
    persistence.save({
      manifestRevision: manifest.revision,
      prizes: manifest.prizes.map((prize) => ({
        id: prize.id,
        position: [...prize.position],
        orientation: { quaternion: [...prize.orientation.quaternion] },
        won: true,
        removed: true,
      })),
    })

    const adapter = await N6PhysicsAdapter.create({
      prizeManifest: manifest,
      selectedPrizeId: 'prize',
      persistence,
      persistPrizeState: true,
    })
    try {
      const observation = adapter.observeGrip()
      const attempt = adapter.attemptGrip()
      expect(observation.physicalContact).toBe(false)
      expect(observation.gripApproved).toBe(false)
      expect(adapter.selectedPrize).toBe('prize')
      expect(attempt).toMatchObject({
        accepted: false,
        holdStarted: false,
        reason: 'no-physical-contact',
      })
    } finally {
      adapter.dispose()
    }
  })
})
