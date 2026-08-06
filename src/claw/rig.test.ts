import { Object3D, Quaternion, Vector3 } from 'three'
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
    expect(FINGER_SEGMENT_COLLIDERS).toHaveLength(FINGER_RIG.fingers.length * 2)
    expect(FINGER_RIG.fingers.map(({ id }) => id)).toEqual(['right', 'left', 'back'])

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
      const angle = FINGER_RIG.fingers[index].angle
      expect(pivot.position[0]).toBeCloseTo(Math.cos(angle) * FINGER_RIG.ringRadius, 6)
      expect(pivot.position[1]).toBeCloseTo(FINGER_RIG.pivotY, 6)
      expect(pivot.position[2]).toBeCloseTo(Math.sin(angle) * FINGER_RIG.ringRadius, 6)
    }
  })

  it('matches the authored pivot and segment transform at nonzero articulation', () => {
    const segmentArticulation = 0.08
    const expected = fingerSegmentTransform(1, 'blade', segmentArticulation)
    const finger = FINGER_RIG.fingers[1]
    const pivot = new Object3D()
    pivot.position.fromArray([...DEFAULT_CLAW_RIG.baseline[finger.pivotName].position])
    pivot.quaternion.fromArray([
      ...DEFAULT_CLAW_RIG.poses.open[finger.pivotName].quaternion,
    ])
    const segmentJoint = new Object3D()
    segmentJoint.rotation.z = segmentArticulation
    const segment = new Object3D()
    segment.position.fromArray([...FINGER_RIG.blade.colliderCenter])
    segmentJoint.add(segment)
    pivot.add(segmentJoint)
    pivot.updateWorldMatrix(true, true)
    const actualPosition = segment.getWorldPosition(new Vector3())
    const actualRotation = segment.getWorldQuaternion(new Quaternion())
    expect(actualPosition.x).toBeCloseTo(expected.position[0], 5)
    expect(actualPosition.y).toBeCloseTo(expected.position[1], 5)
    expect(actualPosition.z).toBeCloseTo(expected.position[2], 5)
    const direct = [actualRotation.x, actualRotation.y, actualRotation.z, actualRotation.w]
    const negated = direct.map((value) => -value)
    const expectedRotation = expected.rotation
    const matches = (values: readonly number[]) =>
      values.every((value, index) => Math.abs(value - expectedRotation[index]) <= 0.00001)
    expect(matches(direct) || matches(negated)).toBe(true)
  })

  it('produces finite, distinct transforms for every finger and segment', () => {
    const positions = new Set<string>()

    for (let fingerIndex = 0; fingerIndex < FINGER_RIG.fingers.length; fingerIndex += 1) {
      for (const segment of ['blade', 'hook'] as const) {
        const collider = fingerSegmentTransform(fingerIndex, segment)
        expect([...collider.position, ...collider.rotation].every(Number.isFinite)).toBe(true)
        positions.add(collider.position.join(','))
      }
    }

    expect(positions).toHaveLength(FINGER_RIG.fingers.length * 2)
  })

  it('rejects invalid finger indices instead of silently aliasing a collider', () => {
    expect(() => fingerSegmentTransform(-1, 'blade')).toThrow(/invalid finger index/)
    expect(() => fingerSegmentTransform(FINGER_RIG.fingers.length, 'hook')).toThrow(
      /invalid finger index/,
    )
    expect(() => fingerSegmentTransform(0.5, 'blade')).toThrow(/invalid finger index/)
  })
})
