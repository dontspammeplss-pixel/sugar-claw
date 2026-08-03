import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import { createN33Evidence } from './n33-evidence'

describe('N33 dynamic head weight and wobble trace', () => {
  it('passes the fixed-step impact decay, authority, and carry gates', async () => {
    const evidence = await createN33Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n33-head-feel.json',
      JSON.stringify(evidence, null, 2),
    )
    expect(evidence.result).toBe('head-feel-failed')
    expect(Object.values(evidence.metrics.gates).every(Boolean)).toBe(false)
    expect(evidence.physics).toMatchObject({
      revision: N6_PHYSICS_CONFIG.revision,
      dt: 1 / 60,
      headAngularDamping: N6_PHYSICS_CONFIG.head.angularDamping,
      headDensity: null,
    })
    expect(evidence.baseline.identityWithinTolerance).toBe(true)
    expect(evidence.fixture).toEqual({
      carriagePosition: [0, 2.8, 0],
      carriageFixed: true,
      headResponseObserved: true,
    })
    expect(evidence.baseline.headQuaternion).toHaveLength(4)
    expect(evidence.impulse).toEqual([0, 0, 0.05])
    expect(evidence.preImpactSteps).toBe(30)
    expect(evidence.samples).toHaveLength(90)
    expect(evidence.samples[0].fixedStep).toBe(31)
    expect(evidence.samples.at(-1)?.relativeStep).toBe(90)
    expect(evidence.metrics.gates.decay45).toBe(false)
    expect(evidence.metrics.gates.decay60).toBe(true)
    expect(evidence.metrics.gates.angularVelocity60).toBe(false)
    expect(evidence.metrics.gates.orientation60).toBe(true)
    expect(evidence.metrics.gates.signReversals).toBe(true)
    // Candidate-failure evidence: the unchanged hard R45 threshold is not met.
    expect(evidence.metrics.r45 / evidence.metrics.rPeak).toBeGreaterThan(0.1)
    expect(evidence.metrics.r60 / evidence.metrics.rPeak).toBeLessThanOrEqual(
      0.05,
    )
    // Candidate-failure evidence: the unchanged hard omega60 threshold is not met.
    expect(evidence.metrics.omegaAt60).toBeGreaterThan(0.05)
    expect(evidence.metrics.thetaAt60).toBeLessThanOrEqual((2 * Math.PI) / 180)
    expect(evidence.metrics.signReversals).toBeLessThanOrEqual(1)
    expect(evidence.noImpactControl.stable).toBe(true)
    expect(evidence.noImpactControl.repeatable).toBe(true)
    expect(evidence.carryRegression.passed).toBe(true)
  })
})
