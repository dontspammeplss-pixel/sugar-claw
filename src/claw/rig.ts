import { Euler, Quaternion, Vector3 } from 'three'
import type { Quat, Vec3 } from '../types/geometry'
// N13: canonical tuple types live in src/types/geometry.ts. Re-exported here
// so the rig module keeps its historical public type surface for consumers
// (e.g. scene/evidence) that import Vec3/Quat through the rig.
export type { Quat, Vec3 } from '../types/geometry'

export const PIVOT_NAMES = [
  'FingerPivot_0',
  'FingerPivot_1',
  'FingerPivot_2',
] as const

export type PivotName = (typeof PIVOT_NAMES)[number]

export const POSE_NAMES = [
  'home',
  'raised',
  'lowered',
  'open',
  'closed',
  'reset',
] as const

export type ClawPoseName = (typeof POSE_NAMES)[number]

export interface ClawTransformTarget {
  readonly position: Vec3
  readonly quaternion: Quat
}

export type ClawPose = Readonly<
  Record<PivotName, ClawTransformTarget>
>

export interface ClawRigDefinition {
  readonly pivotNames: readonly PivotName[]
  readonly baseline: ClawPose
  readonly poses: Readonly<Record<ClawPoseName, ClawPose>>
}

export type FingerSegmentName = 'blade' | 'hook'
export type FingerId = 'right' | 'left' | 'back'

export interface FingerDefinition {
  readonly id: FingerId
  readonly pivotName: PivotName
  readonly angle: number
}

export const FINGER_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'right', pivotName: PIVOT_NAMES[0], angle: 0 }),
  Object.freeze({ id: 'left', pivotName: PIVOT_NAMES[1], angle: Math.PI }),
  Object.freeze({ id: 'back', pivotName: PIVOT_NAMES[2], angle: (3 * Math.PI) / 2 }),
] as const satisfies readonly FingerDefinition[])

/**
 * Canonical finger geometry shared by the scene and Rapier adapter. Keeping
 * the visual envelope and solver approximation together makes any deliberate
 * approximation explicit instead of scattering dimensions across systems.
 */
export const FINGER_RIG = Object.freeze({
  ringRadius: 0.28,
  pivotY: -0.05,
  fingers: FINGER_DEFINITIONS,
  hingeAxis: [0, 0, 1] as Vec3,
  openArticulation: 0.14,
  blade: Object.freeze({
    visualCenter: [0, -0.25, 0] as Vec3,
    colliderCenter: [0, -0.15, 0] as Vec3,
    rotation: [0, 0, 0] as const,
    visual: {
      shape: 'box' as const,
      size: [0.1, 0.5, 0.12] as const,
    },
    collider: Object.freeze({ halfHeight: 0.15, radius: 0.04 }),
  }),
  hook: Object.freeze({
    visualCenter: [-0.05, -0.5, 0] as Vec3,
    colliderCenter: [-0.05, -0.5, 0] as Vec3,
    rotation: [0, 0, Math.PI / 2] as const,
    visual: {
      shape: 'cylinder' as const,
      radius: 0.05,
      height: 0.1,
    },
    collider: Object.freeze({ halfHeight: 0.05, radius: 0.05 }),
  }),
})

// Keep the exported rig safe to share between the scene and physics setup.
Object.freeze(FINGER_RIG.fingers)
Object.freeze(FINGER_RIG.hingeAxis)
Object.freeze(FINGER_RIG.blade.visualCenter)
Object.freeze(FINGER_RIG.blade.colliderCenter)
Object.freeze(FINGER_RIG.blade.rotation)
Object.freeze(FINGER_RIG.blade.visual.size)
Object.freeze(FINGER_RIG.blade.visual)
Object.freeze(FINGER_RIG.blade)
Object.freeze(FINGER_RIG.hook.visualCenter)
Object.freeze(FINGER_RIG.hook.colliderCenter)
Object.freeze(FINGER_RIG.hook.rotation)
Object.freeze(FINGER_RIG.hook.visual)
Object.freeze(FINGER_RIG.hook)

function segmentDefinition(name: FingerSegmentName) {
  return name === 'blade' ? FINGER_RIG.blade : FINGER_RIG.hook
}

function pivotTransform(
  index: number,
  pivotArticulation: number,
): { position: Vector3; quaternion: Quaternion } {
  if (!Number.isInteger(index) || index < 0 || index >= FINGER_RIG.fingers.length) {
    throw new Error(`fingerSegmentTransform: invalid finger index ${index}`)
  }
  const finger = FINGER_RIG.fingers[index]
  const position = new Vector3(
    Math.cos(finger.angle) * FINGER_RIG.ringRadius,
    FINGER_RIG.pivotY,
    Math.sin(finger.angle) * FINGER_RIG.ringRadius,
  )
  const quaternion = new Quaternion()
    .setFromEuler(new Euler(0, -finger.angle, 0, 'XYZ'))
    .multiply(axisRotation(FINGER_RIG.openArticulation))
  quaternion.premultiply(axisRotation(pivotArticulation))
  return { position, quaternion }
}

function axisRotation(angle: number): Quaternion {
  return new Quaternion().setFromAxisAngle(
    new Vector3(...FINGER_RIG.hingeAxis),
    angle,
  )
}

/**
 * Computes a segment collider transform from the authored finger rig.
 * `pivotArticulation` is the delta from the authored open pivot; `articulation`
 * is the segment-local flex.
 */
export function fingerSegmentTransform(
  index: number,
  segment: FingerSegmentName,
  articulation = 0,
  pivotArticulation = 0,
): { position: Vec3; rotation: Quat } {
  const { position: pivotPosition, quaternion: pivotQuaternion } =
    pivotTransform(index, pivotArticulation)
  const definition = segmentDefinition(segment)
  const segmentRotation = axisRotation(articulation)
  const localRotation = new Quaternion().setFromEuler(
    new Euler(...definition.rotation),
  )
  const center = new Vector3(...definition.colliderCenter)
    .applyQuaternion(segmentRotation)
    .applyQuaternion(pivotQuaternion)
    .add(pivotPosition)
  const rotation = pivotQuaternion
    .clone()
    .multiply(segmentRotation)
    .multiply(localRotation)

  return {
    position: [center.x, center.y, center.z],
    rotation: rotation.toArray() as Quat,
  }
}

export const FINGER_SEGMENT_COLLIDERS =
  Object.freeze(
    FINGER_RIG.fingers.flatMap((_, fingerIndex) =>
      (['blade', 'hook'] as const).map((segment) => {
        const definition = segmentDefinition(segment)
        const transform = fingerSegmentTransform(fingerIndex, segment)
        return Object.freeze({
          fingerIndex,
          segment,
          position: Object.freeze(transform.position),
          rotation: Object.freeze(transform.rotation),
          halfHeight: definition.collider.halfHeight,
          radius: definition.collider.radius,
        })
      }),
    ),
  )

/**
 * Authoritative finger layout (N13): Right · Left · Back, viewed from the
 * front (camera side, +Z toward the glass). Index 0 is the right finger
 * (0 rad), index 1 the left (π rad), index 2 the back (3π/2 rad — pointing
 * toward −Z). The open mouth faces the camera. This is the single source of
 * truth consumed by the scene hierarchy and the physics finger colliders.
 */

/**
 * Articulation is local to each named pivot; it never changes HeadRoot.
 * N22: values retuned for the grip-wrap geometry (ring 0.28, blades 0.50)
 * so closed tips land on the prize surface instead of sinking to the axis.
 * The hinge stays on the tangential local Z axis (N17) — open flares blades
 * radially outward, closed folds them in just past vertical.
 */
export const POSE_ARTICULATION_RADIANS: Readonly<
  Record<ClawPoseName, number>
> = Object.freeze({
  // Raised/lowered are rigid-head travel poses. Finger articulation remains
  // at its authored baseline until the later physics/travel adapter owns it.
  home: 0,
  raised: 0,
  lowered: 0,
  // N24: open widened ~40% (0.10 -> 0.14 rad) so the resting mouth reads as
  // clearly open and gives the prize room to enter the cage before the close.
  open: FINGER_RIG.openArticulation,
  closed: -0.05,
  reset: 0,
})

function freezeTuple<T extends readonly number[]>(tuple: T): T {
  return Object.freeze([...tuple]) as T
}

function freezeTarget(target: ClawTransformTarget): ClawTransformTarget {
  return Object.freeze({
    position: freezeTuple(target.position),
    quaternion: freezeTuple(target.quaternion),
  })
}

function freezePose(pose: Record<PivotName, ClawTransformTarget>): ClawPose {
  return Object.freeze({
    ...Object.fromEntries(
      PIVOT_NAMES.map((name) => [name, freezeTarget(pose[name])]),
    ),
  }) as ClawPose
}

function baselineTarget(index: number): ClawTransformTarget {
  const finger = FINGER_RIG.fingers[index]
  const quaternion = new Quaternion().setFromEuler(
    new Euler(0, -finger.angle, 0, 'XYZ'),
  )
  return {
    position: [
      Math.cos(finger.angle) * FINGER_RIG.ringRadius,
      FINGER_RIG.pivotY,
      Math.sin(finger.angle) * FINGER_RIG.ringRadius,
    ],
    quaternion: quaternion.toArray() as Quat,
  }
}

function poseTarget(
  baseline: ClawTransformTarget,
  articulation: number,
): ClawTransformTarget {
  const base = new Quaternion().fromArray([...baseline.quaternion])
  // N17: the baseline Euler (0, -angle, 0) orients each pivot so its local X
  // is the RADIAL axis (outward from the claw axis) and its local Z is the
  // TANGENTIAL axis (along the claw's circle). Articulating about the radial
  // axis swept the hanging blade (-Y) tangentially, so the fingers could never
  // flare around a prize ("twisted" appearance, no enclosure). The correct
  // hinge for a hanging claw finger is the tangential axis: the blade then
  // swings in the radial plane, flaring outward on open and converging on the
  // claw axis on closed.
  const localArticulation = axisRotation(articulation)
  return {
    position: baseline.position,
    quaternion: base.multiply(localArticulation).toArray() as Quat,
  }
}

/**
 * Creates immutable authored targets for the three contract pivots.
 * Every pose is an absolute target derived from the same baseline snapshot.
 */
export function createClawRigDefinition(): ClawRigDefinition {
  const baseline = freezePose({
    FingerPivot_0: baselineTarget(0),
    FingerPivot_1: baselineTarget(1),
    FingerPivot_2: baselineTarget(2),
  })
  const poses = Object.fromEntries(
    POSE_NAMES.map((poseName) => [
      poseName,
      freezePose(
        Object.fromEntries(
          PIVOT_NAMES.map((pivotName) => [
            pivotName,
            poseTarget(
              baseline[pivotName],
              POSE_ARTICULATION_RADIANS[poseName],
            ),
          ]),
        ) as Record<PivotName, ClawTransformTarget>,
      ),
    ]),
  ) as Record<ClawPoseName, ClawPose>

  return Object.freeze({
    pivotNames: PIVOT_NAMES,
    baseline,
    poses: Object.freeze(poses),
  })
}

export const DEFAULT_CLAW_RIG = createClawRigDefinition()
export const POSE_TARGETS = DEFAULT_CLAW_RIG.poses

export function clonePose(pose: ClawPose): Record<PivotName, ClawTransformTarget> {
  return Object.fromEntries(
    PIVOT_NAMES.map((name) => [
      name,
      {
        position: [...pose[name].position] as Vec3,
        quaternion: [...pose[name].quaternion] as Quat,
      },
    ]),
  ) as Record<PivotName, ClawTransformTarget>
}
