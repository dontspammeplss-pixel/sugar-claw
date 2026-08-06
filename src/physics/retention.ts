import type { RetentionState } from './retention-types'
import type { Vec3 } from '../types/geometry'

export interface RetentionCapacityConfig {
  readonly minGripVoltage: number
  readonly maxGripVoltage: number
  readonly gripVoltage: number
  readonly maxHoldForceAtMinVoltage: number
  readonly maxHoldForceAtMaxVoltage: number
  readonly padFriction: number
}

export interface RetentionRequirementInput {
  readonly prizeWeight: number
  readonly centerOfMass: Vec3
  readonly gripPoint: Vec3
  readonly gripLeverArm: number
  readonly gravityY: number
  readonly swingAcceleration: number
  readonly travelAcceleration: number
  readonly packingForce: number
}

export interface RetentionStateInput extends RetentionRequirementInput {
  readonly status: RetentionState['status']
  readonly releasedAt: number | null
  readonly voltage: number
  readonly capacity: number
  readonly contactCount: number
  readonly gripRetentionFactor: number
}

export function calculateHoldCapacity(
  config: RetentionCapacityConfig,
  contactCount: number,
  gripRetentionFactor: number,
): number {
  if (
    !Number.isFinite(config.minGripVoltage) ||
    !Number.isFinite(config.maxGripVoltage) ||
    config.maxGripVoltage <= config.minGripVoltage ||
    !Number.isFinite(config.gripVoltage) ||
    config.gripVoltage < config.minGripVoltage ||
    config.gripVoltage > config.maxGripVoltage ||
    !Number.isFinite(config.maxHoldForceAtMinVoltage) ||
    !Number.isFinite(config.maxHoldForceAtMaxVoltage) ||
    !Number.isFinite(config.padFriction) ||
    config.padFriction < 0 ||
    !Number.isFinite(contactCount) ||
    contactCount < 0 ||
    !Number.isFinite(gripRetentionFactor) ||
    gripRetentionFactor < 0
  ) {
    throw new Error('Retention: invalid capacity inputs')
  }
  const voltageRange = config.maxGripVoltage - config.minGripVoltage
  const voltageRatio =
    (config.gripVoltage - config.minGripVoltage) / voltageRange
  const maxHoldForce =
    config.maxHoldForceAtMinVoltage +
    voltageRatio *
      (config.maxHoldForceAtMaxVoltage - config.maxHoldForceAtMinVoltage)
  const contactGeometryFactor = 0.75 + 0.25 * Math.min(1, contactCount / 3)
  return maxHoldForce * config.padFriction * contactGeometryFactor * gripRetentionFactor
}

export function calculateHoldRequirement(
  input: RetentionRequirementInput,
): { readonly required: number; readonly torque: number } {
  if (
    !Number.isFinite(input.prizeWeight) ||
    input.prizeWeight <= 0 ||
    !Number.isFinite(input.gravityY) ||
    input.gravityY === 0 ||
    !Number.isFinite(input.gripLeverArm) ||
    input.gripLeverArm <= 0 ||
    input.centerOfMass.some((value) => !Number.isFinite(value)) ||
    input.gripPoint.some((value) => !Number.isFinite(value)) ||
    !Number.isFinite(input.swingAcceleration) ||
    input.swingAcceleration < 0 ||
    !Number.isFinite(input.travelAcceleration) ||
    input.travelAcceleration < 0 ||
    !Number.isFinite(input.packingForce) ||
    input.packingForce < 0
  ) {
    throw new Error('Retention: invalid requirement inputs')
  }
  const mass = input.prizeWeight / Math.abs(input.gravityY)
  const offset = input.centerOfMass.map(
    (value, axis) => value - input.gripPoint[axis],
  ) as unknown as Vec3
  const distance = Math.hypot(...offset)
  const torque = mass * Math.abs(input.gravityY) * distance
  const accelerationForce =
    input.prizeWeight *
    (input.swingAcceleration + input.travelAcceleration) /
    Math.abs(input.gravityY)
  return {
    torque,
    required:
      input.prizeWeight +
      accelerationForce +
      input.packingForce +
      Math.abs(torque) / input.gripLeverArm,
  }
}

export function buildRetentionState(
  input: RetentionStateInput,
): RetentionState {
  const { required, torque } = calculateHoldRequirement(input)
  return {
    status: input.status,
    voltage: input.voltage,
    capacity: input.capacity,
    required,
    margin: input.capacity - required,
    torque,
    weight: input.prizeWeight,
    centerOfMass: [...input.centerOfMass] as Vec3,
    gripPoint: [...input.gripPoint] as Vec3,
    contactCount: input.contactCount,
    swingAcceleration: input.swingAcceleration,
    travelAcceleration: input.travelAcceleration,
    releasedAt: input.releasedAt,
  }
}
