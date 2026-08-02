import type { Vec3 } from '../types/geometry'

export interface TravelAnimationState {
  readonly active: boolean
  readonly progress: number
}

/** Smoothstep ease so kinematic travel accelerates and decelerates. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * A deterministic kinematic travel animator between two absolute positions.
 * Callers supply elapsed time through `advance` and write the returned
 * position to the authoritative body themselves; no timer, RAF loop, or
 * physics writer is owned. Mirrors the ClawPoseAnimator contract in this
 * directory so the claw has one animation pattern.
 */
export class ClawTravelAnimator {
  private startPosition: Vec3 | null = null
  private target: Vec3 | null = null
  private durationMs = 0
  private elapsedMs = 0

  get state(): TravelAnimationState {
    return {
      active: this.startPosition !== null,
      progress:
        this.startPosition === null || this.durationMs === 0
          ? this.startPosition === null
            ? 0
            : 1
          : clamp01(this.elapsedMs / this.durationMs),
    }
  }

  /** Starts travel from an absolute start position to an absolute target. */
  start(start: Vec3, target: Vec3, durationMs: number): TravelAnimationState {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error('ClawTravelAnimator: durationMs must be finite and non-negative')
    }
    this.startPosition = [...start]
    this.target = [...target]
    this.durationMs = durationMs
    this.elapsedMs = 0
    return this.state
  }

  /**
   * Advances the active travel by a fixed step. Returns the eased position to
   * write, or null when idle. Snaps exactly to the target on completion and
   * finishes; a degenerate (<= 0) duration also snaps immediately.
   */
  advance(deltaMs: number): Vec3 | null {
    if (!this.startPosition || !this.target) return null
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new Error('ClawTravelAnimator: deltaMs must be finite and non-negative')
    }
    if (this.durationMs <= 0) {
      const target = this.target
      this.finish()
      return target
    }
    this.elapsedMs += deltaMs
    const t = Math.min(1, this.elapsedMs / this.durationMs)
    const eased = easeInOutCubic(t)
    const position: Vec3 = [
      this.startPosition[0] + (this.target[0] - this.startPosition[0]) * eased,
      this.startPosition[1] + (this.target[1] - this.startPosition[1]) * eased,
      this.startPosition[2] + (this.target[2] - this.startPosition[2]) * eased,
    ]
    if (t >= 1) {
      const target = this.target
      this.finish()
      return target
    }
    return position
  }

  /** Cancels the active travel without snapping. */
  cancel(): void {
    this.finish()
  }

  private finish(): void {
    this.startPosition = null
    this.target = null
    this.durationMs = 0
    this.elapsedMs = 0
  }
}

export function createClawTravelAnimator(): ClawTravelAnimator {
  return new ClawTravelAnimator()
}
