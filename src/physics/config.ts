export type Vec3 = readonly [number, number, number]
/**
 * N6 physics policy: one fixed-step configuration is shared by every adapter
 * and evidence fixture. Render timing never enters this simulation.
 */
export const N6_PHYSICS_CONFIG = Object.freeze({
  revision: 'fixed-step-rev1',
  dt: 1 / 60,
  gravity: Object.freeze({ x: 0, y: -9.81, z: 0 }),
  solverIterations: 8,
  additionalFrictionIterations: 2,
  sleeping: true,
  linearDamping: 0.05,
  angularDamping: 0.05,
  friction: 0.7,
  restitution: 0,
  ccd: true,
  tolerances: Object.freeze({
    idlePosition: 0.002,
    idleVelocity: 0.02,
    travel: 0.000001,
    carryPosition: 0.025,
    repeatPosition: 0.0005,
  }),
  travelBounds: Object.freeze({
    min: Object.freeze({ x: -1.25, y: 0.83, z: -0.35 }),
    max: Object.freeze({ x: 1.25, y: 2.8, z: 0.55 }),
  }),
  clawPosition: Object.freeze([0, 2.8, 0]) as Vec3,
  gripPosition: Object.freeze([0, 0.83, 0]) as Vec3,
  overlapPosition: Object.freeze([0.5, 0.83, 0]) as Vec3,
  liftPosition: Object.freeze([0, 2.8, 0]) as Vec3,
  failedLiftPosition: Object.freeze([0.5, 2.8, 0]) as Vec3,
  resetTravelPosition: Object.freeze([0.8, 2.4, 0.4]) as Vec3,
  carrySettleSteps: 10,
  carryLiftSteps: 120,
  maxRetainedStepRecords: 1024,
  prizePosition: Object.freeze([0, 0.18, 0]) as Vec3,
  clawHalfExtents: Object.freeze([0.3, 0.12, 0.3]) as Vec3,
  floorHalfExtents: Object.freeze([3, 0.1, 2]) as Vec3,
  floorPosition: Object.freeze([0, -0.1, 0]) as Vec3,
  visualEnvelopeHalfExtents: Object.freeze({ x: 0.55, y: 0.75, z: 0.55 }),
  prizeRadius: 0.18,
  sensorRadius: 0.24,
  sensorOffset: Object.freeze({ x: 0, y: -0.65, z: 0 }),
})

/** Collision groups are the single source of truth for the N6 fixture. */
export const N6_COLLISION_GROUPS = Object.freeze({
  environment: 1 << 0,
  prize: 1 << 1,
  clawBody: 1 << 2,
  clawFinger: 1 << 3,
  sensor: 1 << 4,
  debug: 1 << 5,
})

/** Rapier packs a 16-bit membership group and a 16-bit interaction mask. */
export function interactionGroups(group: number, mask: number): number {
  return (group << 16) | mask
}

