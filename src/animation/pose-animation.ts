import { Quaternion, Vector3 } from 'three'
import {
  ClawPoseAdapter,
  type ClawPoseSnapshot,
  type PivotSnapshot,
} from '../claw/pose-adapter'
import {
  PIVOT_NAMES,
  type ClawPose,
  type ClawPoseName,
  type Quat,
  type Vec3,
} from '../claw/rig'

export interface PoseAnimationState {
  readonly active: boolean
  readonly progress: number
  readonly target: ClawPoseName | null
  readonly generation: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function interpolatePivot(
  start: PivotSnapshot,
  target: PivotSnapshot,
  progress: number,
): PivotSnapshot {
  const position = new Vector3()
    .fromArray([...start.position])
    .lerp(new Vector3().fromArray([...target.position]), progress)
  const quaternion = new Quaternion()
    .fromArray([...start.quaternion])
    .slerp(new Quaternion().fromArray([...target.quaternion]), progress)
    .normalize()
  return {
    position: position.toArray() as Vec3,
    quaternion: quaternion.toArray() as Quat,
  }
}

function snapshotAsPose(snapshot: ClawPoseSnapshot): ClawPose {
  return Object.fromEntries(
    PIVOT_NAMES.map((name) => {
      const pivot = snapshot[name]
      return [
        name,
        {
          position: [...pivot.position] as Vec3,
          quaternion: [...pivot.quaternion] as Quat,
        },
      ]
    }),
  ) as ClawPose
}

/**
 * A deterministic presentation animator. Callers supply elapsed time through
 * `advance`; no timer, RAF loop, state promotion, or physics writer is owned.
 */
export class ClawPoseAnimator {
  private startSnapshot: ClawPoseSnapshot | null = null
  private targetPose: ClawPoseName | null = null
  private elapsedMs = 0
  private durationMs = 0
  private generation = 0

  constructor(private readonly adapter: ClawPoseAdapter) {}

  get state(): PoseAnimationState {
    return {
      active: this.startSnapshot !== null,
      progress:
        this.startSnapshot === null || this.durationMs === 0
          ? this.startSnapshot === null
            ? 0
            : 1
          : clamp01(this.elapsedMs / this.durationMs),
      target: this.targetPose,
      generation: this.generation,
    }
  }

  /** Starts from the current absolute snapshot, so interruption cannot drift. */
  start(target: ClawPoseName, durationMs = 250): PoseAnimationState {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error('ClawPoseAnimator: durationMs must be finite and non-negative')
    }
    this.generation = this.adapter.cancelPresentation()
    this.startSnapshot = this.adapter.snapshot()
    this.targetPose = target
    this.elapsedMs = 0
    this.durationMs = durationMs
    if (durationMs === 0) this.advance(0)
    return this.state
  }

  /** Advances from an explicit timestamp delta; endpoint writes are exact. */
  advance(
    deltaMs: number,
    expectedGeneration = this.generation,
  ): ClawPoseSnapshot {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new Error('ClawPoseAnimator: deltaMs must be finite and non-negative')
    }
    if (expectedGeneration !== this.generation) {
      return this.adapter.snapshot()
    }
    if (this.adapter.generation !== this.generation) {
      this.finish()
      return this.adapter.snapshot()
    }
    if (!this.startSnapshot || !this.targetPose) return this.adapter.snapshot()

    this.elapsedMs += deltaMs
    const progress =
      this.durationMs === 0 ? 1 : clamp01(this.elapsedMs / this.durationMs)
    const target = this.adapter.target(this.targetPose)
    if (progress === 1) {
      const snapshot = this.adapter.applyPoseTarget(this.targetPose)
      this.finish()
      return snapshot
    }

    const interpolated = Object.fromEntries(
      PIVOT_NAMES.map((name) => [
        name,
        interpolatePivot(
          this.startSnapshot![name],
          {
            position: target[name].position,
            quaternion: target[name].quaternion,
          },
          progress,
        ),
      ]),
    ) as ClawPoseSnapshot
    return this.adapter.applyPoseTarget(snapshotAsPose(interpolated))
  }

  /**
   * Cancels the active transition without changing the current transform.
   * Callers holding an older generation can pass it to `advance`; that stale
   * callback is ignored rather than regaining presentation ownership.
   */
  cancel(): ClawPoseSnapshot {
    this.generation = this.adapter.cancelPresentation()
    this.startSnapshot = null
    this.targetPose = null
    this.elapsedMs = 0
    this.durationMs = 0
    return this.adapter.snapshot()
  }

  private finish(): void {
    this.startSnapshot = null
    this.targetPose = null
    this.elapsedMs = 0
    this.durationMs = 0
  }
}

export function createClawPoseAnimator(
  adapter: ClawPoseAdapter,
): ClawPoseAnimator {
  return new ClawPoseAnimator(adapter)
}
