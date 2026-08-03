import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createN34Evidence } from './n34-evidence'

describe('N34 integrated deterministic verification', () => {
  it('proves terminal input cleanup, full state/physics integration, reset, and repeatability', async () => {
    const evidence = await createN34Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n34-integration.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.status).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.fixedStep).toEqual({
      dt: N6_PHYSICS_CONFIG.dt,
      frameMs: 1000 / 60,
      revision: N6_PHYSICS_CONFIG.revision,
    })
    expect(evidence.inputPaths).toHaveLength(6)
    expect(
      evidence.inputPaths.every(
        (path) => path.exactlyOneZeroEmission && path.aimZero && path.stopped,
      ),
    ).toBe(true)
    expect(evidence.integrated.reachedResult).toBe(true)
    expect(evidence.integrated.transitionPathExact).toBe(true)
    expect(evidence.integrated.acceptedPhysicalCarry).toBe(true)
    expect(evidence.integrated.synchronized).toBe(true)
    expect(evidence.reset).toMatchObject({
      resetAccepted: true,
      state: 'ready',
      controllerRunAdvanced: true,
      physicsRunAdvanced: true,
      aimZero: true,
      physicsReady: true,
      noCarryJoint: true,
      executionInputRejected: true,
      executionInputNoDrift: true,
      staleCallbackRejected: true,
      postResetStable: true,
    })
    expect(evidence.repeatability).toMatchObject({
      runs: 2,
      sameTransitionPath: true,
      finalPrizeMatch: true,
      finalClawMatch: true,
      withinTolerance: true,
    })
    expect(evidence.regressions.n6.status).toBe('pass')
    expect(evidence.regressions.n7.status).toBe('pass')
    expect(evidence.regressions.n33).toMatchObject({
      status: 'head-feel-failed',
      promotionBlocked: true,
    })
    expect(evidence.claims).toMatchObject({
      noStaleVelocityAfterTerminalInput: true,
      fullInputStatePhysicsPath: true,
      noStaleVelocityAfterResetOrStateTransition: true,
      carryResetRepeatabilityGreen: true,
      n33FeelPromotionBlocked: true,
    })
  })
})
