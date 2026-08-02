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

/** Articulation is local to each named pivot; it never changes HeadRoot. */
export const POSE_ARTICULATION_RADIANS: Readonly<
  Record<ClawPoseName, number>
> = Object.freeze({
  // Raised/lowered are rigid-head travel poses. Finger articulation remains
  // at its authored baseline until the later physics/travel adapter owns it.
  home: 0,
  raised: 0,
  lowered: 0,
  open: 0.36,
  closed: -0.22,
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
  const angle = (index * Math.PI * 2) / PIVOT_NAMES.length
  const quaternion = new Quaternion().setFromEuler(
    new Euler(0, -angle, 0, 'XYZ'),
  )
  return {
    position: [Math.cos(angle) * 0.16, -0.05, Math.sin(angle) * 0.16],
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
  const localArticulation = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    articulation,
  )
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
