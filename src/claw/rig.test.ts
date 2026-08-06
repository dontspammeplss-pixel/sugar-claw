import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CLAW_RIG,
  FINGER_RIG,
  FINGER_SEGMENT_COLLIDERS,
  PIVOT_NAMES,
  fingerSegmentTransform,
} from './rig'

describe('canonical finger rig', () => {
  it('keeps visual dimensions and collider approximations in one definition', () => {
    expect(FINGER_SEGMENT_COLLIDERS).toHaveLength(FINGER_RIG.angles.length * 2)

    for (const segment of [FINGER_RIG.blade, FINGER_RIG.hook]) {
      expect(segment.visualCenter.every(Number.isFinite)).toBe(true)
      expect(segment.colliderCenter.every(Number.isFinite)).toBe(true)
      expect(segment.collider.halfHeight).toBeGreaterThan(0)
      expect(segment.collider.radius).toBeGreaterThan(0)
    }

    expect(FINGER_RIG.blade.visual.size).toEqual([0.1, 0.5, 0.12])
    expect(FINGER_RIG.hook.visual).toMatchObject({
      radius: 0.05,
      height: 0.1,
    })
  })

  it('keeps scene pivot positions aligned with the authored pose targets', () => {
    for (let index = 0; index < PIVOT_NAMES.length; index += 1) {
      const pivot = DEFAULT_CLAW_RIG.baseline[PIVOT_NAMES[index]]
      const angle = FINGER_RIG.angles[index]
      expect(pivot.position[0]).toBeCloseTo(Math.cos(angle) * FINGER_RIG.ringRadius, 6)
      expect(pivot.position[1]).toBeCloseTo(FINGER_RIG.pivotY, 6)
      expect(pivot.position[2]).toBeCloseTo(Math.sin(angle) * FINGER_RIG.ringRadius, 6)
    }
  })

  it('applies finite articulation to every segment', () => {
    const articulated = fingerSegmentTransform(1, 'blade', 0.08, -0.03)
    expect([...articulated.position, ...articulated.rotation].every(Number.isFinite)).toBe(true)
  })

  it('produces finite, distinct transforms for every finger and segment', () => {
    const positions = new Set<string>()

    for (let fingerIndex = 0; fingerIndex < FINGER_RIG.angles.length; fingerIndex += 1) {
      for (const segment of ['blade', 'hook'] as const) {
        const collider = fingerSegmentTransform(fingerIndex, segment)
        expect([...collider.position, ...collider.rotation].every(Number.isFinite)).toBe(true)
        positions.add(collider.position.join(','))
      }
    }

    expect(positions).toHaveLength(FINGER_RIG.angles.length * 2)
  })

  it('rejects invalid finger indices instead of silently aliasing a collider', () => {
    expect(() => fingerSegmentTransform(-1, 'blade')).toThrow(/invalid finger index/)
    expect(() => fingerSegmentTransform(FINGER_RIG.angles.length, 'hook')).toThrow(
      /invalid finger index/,
    )
    expect(() => fingerSegmentTransform(0.5, 'blade')).toThrow(/invalid finger index/)
  })
})
