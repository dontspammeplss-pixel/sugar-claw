import { Quaternion, Vector3 } from 'three'
import {
  DEFAULT_CLAW_RIG,
  PIVOT_NAMES,
  type ClawPose,
  type ClawPoseName,
  type ClawRigDefinition,
  type ClawTransformTarget,
  type PivotName,
} from './rig'
import type { Quat, Vec3 } from '../types/geometry'

export type PivotSnapshot = ClawTransformTarget

export type ClawPoseSnapshot = Readonly<
  Record<PivotName, PivotSnapshot>
>

export interface PoseDrift {
  readonly pose: ClawPoseName
  readonly errors: readonly string[]
  readonly maxPositionError: number
  readonly maxQuaternionError: number
  readonly matches: boolean
}

const EPSILON = 0.000001

function tuple(vector: Vector3): Vec3 {
  return vector.toArray() as Vec3
}

function quaternionTuple(quaternion: Quaternion): Quat {
  return quaternion.toArray() as Quat
}

function cloneTarget(target: ClawTransformTarget): PivotSnapshot {
  return {
    position: [...target.position] as Vec3,
    quaternion: [...target.quaternion] as Quat,
  }
}

function targetForSnapshot(snapshot: PivotSnapshot): ClawTransformTarget {
  return {
    position: snapshot.position,
    quaternion: snapshot.quaternion,
  }
}

function targetPose(
  definition: ClawRigDefinition,
  pose: ClawPoseName,
): ClawPose {
  return definition.poses[pose]
}

/**
 * Applies only local articulation targets to the named finger pivots.
 *
 * The adapter deliberately owns no module-level Object3D and never computes
 * an inverse rotation. Every write is an absolute position/quaternion write
 * from the immutable rig definition or an explicit interpolated target.
 */
export class ClawPoseAdapter {
  readonly pivotNames = PIVOT_NAMES
  readonly definition: ClawRigDefinition

  private readonly pivots: Readonly<Record<PivotName, import('three').Object3D>>
  private poseName: ClawPoseName = 'home'
  private epoch = 0

  constructor(
    root: import('three').Object3D,
    definition: ClawRigDefinition = DEFAULT_CLAW_RIG,
  ) {
    this.definition = definition
    const resolved = Object.fromEntries(
      PIVOT_NAMES.map((name) => {
        const pivot = root.getObjectByName(name)
        if (!pivot) {
          throw new Error(`ClawPoseAdapter: missing named pivot ${name}`)
        }
        return [name, pivot]
      }),
    ) as Record<PivotName, import('three').Object3D>
    this.pivots = Object.freeze(resolved)
  }

  get currentPose(): ClawPoseName {
    return this.poseName
  }

  get generation(): number {
    return this.epoch
  }

  /** Returns a detached snapshot suitable as an interpolation start. */
  snapshot(): ClawPoseSnapshot {
    return Object.fromEntries(
      PIVOT_NAMES.map((name) => {
        const pivot = this.pivots[name]
        return [
          name,
          {
            position: tuple(pivot.position),
            quaternion: quaternionTuple(pivot.quaternion),
          },
        ]
      }),
    ) as unknown as ClawPoseSnapshot
  }

  /** Applies one named pose as an exact, absolute target. */
  applyPoseTarget(pose: ClawPoseName): ClawPoseSnapshot
  /** Applies an explicit absolute target pose, without changing pose label. */
  applyPoseTarget(pose: ClawPose, label?: ClawPoseName): ClawPoseSnapshot
  applyPoseTarget(
    pose: ClawPoseName | ClawPose,
    label?: ClawPoseName,
  ): ClawPoseSnapshot {
    const resolvedPose: ClawPose =
      typeof pose === 'string' ? targetPose(this.definition, pose) : pose
    PIVOT_NAMES.forEach((name) => {
      const pivot = this.pivots[name]
      const target = resolvedPose[name]
      pivot.position.fromArray([...target.position])
      pivot.quaternion.fromArray([...target.quaternion])
    })
    if (typeof pose === 'string') this.poseName = label ?? pose
    else if (label) this.poseName = label
    return this.snapshot()
  }

  /** Cancels pending presentation ownership and returns a new cancellation epoch. */
  cancelPresentation(): number {
    this.epoch += 1
    return this.epoch
  }

  /** Restores the immutable baseline through the explicit reset target. */
  restoreBaseline(): ClawPoseSnapshot {
    this.cancelPresentation()
    return this.applyPoseTarget('reset')
  }

  /** Compares actual pivot transforms with one explicit absolute target pose. */
  detectDrift(pose: ClawPoseName = this.poseName): PoseDrift {
    const expected = targetPose(this.definition, pose)
    const errors: string[] = []
    let maxPositionError = 0
    let maxQuaternionError = 0

    PIVOT_NAMES.forEach((name) => {
      const pivot = this.pivots[name]
      const target = expected[name]
      const targetPosition = new Vector3().fromArray([...target.position])
      const targetQuaternion = new Quaternion().fromArray([...target.quaternion])
      const positionError = pivot.position.distanceTo(targetPosition)
      const quaternionError = pivot.quaternion.angleTo(targetQuaternion)
      maxPositionError = Math.max(maxPositionError, positionError)
      maxQuaternionError = Math.max(maxQuaternionError, quaternionError)
      if (positionError > EPSILON) {
        errors.push(`${name}: position drift ${positionError}`)
      }
      if (quaternionError > EPSILON) {
        errors.push(`${name}: quaternion drift ${quaternionError}`)
      }
    })

    return {
      pose,
      errors,
      maxPositionError,
      maxQuaternionError,
      matches: errors.length === 0,
    }
  }

  /** Exposes a detached target for deterministic animation/evidence code. */
  target(pose: ClawPoseName): ClawPose {
    return targetPose(this.definition, pose)
  }

  /** Makes a detached target from a snapshot without sharing mutable arrays. */
  static targetFromSnapshot(snapshot: ClawPoseSnapshot): ClawPose {
    return Object.fromEntries(
      PIVOT_NAMES.map((name) => [
        name,
        cloneTarget(targetForSnapshot(snapshot[name])),
      ]),
    ) as unknown as ClawPose
  }
}
