import { describe, expect, it } from 'vitest'
import {
  buildRetentionState,
  calculateHoldCapacity,
  calculateHoldRequirement,
} from './retention'

describe('retention calculations', () => {
  const capacityConfig = {
    minGripVoltage: 12,
    maxGripVoltage: 36,
    gripVoltage: 24,
    maxHoldForceAtMinVoltage: 30,
    maxHoldForceAtMaxVoltage: 90,
    padFriction: 0.8,
  } as const

  it('calculates finite capacity and requirement values', () => {
    const capacity = calculateHoldCapacity(capacityConfig, 3, 1)
    const requirement = calculateHoldRequirement({
      prizeWeight: 10,
      centerOfMass: [0, 0, 0],
      gripPoint: [0, 0, 0],
      gripLeverArm: 0.5,
      gravityY: -9.81,
      swingAcceleration: 2,
      travelAcceleration: 1,
      packingForce: 0,
    })
    const state = buildRetentionState({
      status: 'holding',
      releasedAt: null,
      voltage: 24,
      capacity,
      prizeWeight: 10,
      centerOfMass: [0, 0, 0],
      gripPoint: [0, 0, 0],
      gripLeverArm: 0.5,
      gravityY: -9.81,
      swingAcceleration: 2,
      travelAcceleration: 1,
      packingForce: 0,
      contactCount: 3,
      gripRetentionFactor: 1,
    })
    expect(capacity).toBeCloseTo(48)
    expect(requirement.torque).toBe(0)
    expect(state.margin).toBeCloseTo(capacity - requirement.required)
  })

  it.each([
    { label: 'zero voltage range', input: { ...capacityConfig, maxGripVoltage: 12 } },
    { label: 'negative friction', input: { ...capacityConfig, padFriction: -1 } },
    { label: 'negative contacts', input: capacityConfig, contactCount: -1 },
  ])('rejects $label', ({ input, contactCount = 3 }) => {
    expect(() => calculateHoldCapacity(input, contactCount, 1)).toThrow(/invalid capacity/)
  })

  it.each([
    { label: 'zero gravity', gravityY: 0 },
    { label: 'negative weight', prizeWeight: -1 },
    { label: 'zero lever arm', gripLeverArm: 0 },
  ])('rejects $label', ({ gravityY = -9.81, prizeWeight = 10, gripLeverArm = 0.5 }) => {
    expect(() => calculateHoldRequirement({
      prizeWeight,
      centerOfMass: [0, 0, 0],
      gripPoint: [0, 0, 0],
      gripLeverArm,
      gravityY,
      swingAcceleration: 0,
      travelAcceleration: 0,
      packingForce: 0,
    })).toThrow(/invalid requirement/)
  })
})
