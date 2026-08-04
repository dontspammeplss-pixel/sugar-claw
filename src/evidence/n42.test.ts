import { describe, expect, it } from 'vitest'
import { createN42Evidence } from './n42-evidence'

describe('N42 chute delivery semantics', () => {
  it('captures no-win carry, carried delivery, emergent delivery, attached safety, and stale epoch evidence', async () => {
    const evidence = await createN42Evidence()
    expect(evidence.checks).toEqual({
      noWinPass: true,
      carriedPass: true,
      emergentPass: true,
      attachedPass: true,
      stalePass: true,
    })
    expect(evidence.status).toBe('pass')
    expect(evidence.physics.fixedDt).toBe(1 / 60)
    expect(evidence.fixtures.noWinCarry).toMatchObject({
      gripApproved: true,
      delivered: null,
      payoutHook: null,
      countdownAfter: { resetCount: 0 },
    })
    expect(evidence.fixtures.carriedDelivery).toMatchObject({
      state: 'result',
      gripApproved: true,
      delivery: {
        delivered: true,
        removed: true,
        prizeId: 'prize',
        relativePosition: expect.any(Array),
      },
      payoutHook: {
        type: 'payout/inventory-hook',
        prizeId: 'prize',
      },
      countdown: {
        resetCount: 1,
        remainingSteps: expect.any(Number),
      },
      prizeRemoved: true,
    })
    expect(evidence.fixtures.emergentDelivery).toMatchObject({
      gripApproved: false,
      delivery: { delivered: true, removed: true, prizeId: 'prize' },
      payoutHook: { type: 'payout/inventory-hook', runId: 1 },
    })
    expect(evidence.fixtures.attachedSafety).toEqual({
      gripApproved: true,
      holdActive: true,
      delivery: null,
    })
    expect(evidence.fixtures.staleEpoch).toMatchObject({
      activeRunId: expect.any(Number),
      staleAccepted: false,
      staleDiagnostic: 'stale-callback',
    })
  })
})
