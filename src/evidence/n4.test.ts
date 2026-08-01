import { Group, Quaternion } from 'three'
import { describe, expect, it } from 'vitest'
import { ClawPoseAdapter } from '../claw/pose-adapter'
import {
  DEFAULT_CLAW_RIG,
  PIVOT_NAMES,
  POSE_NAMES,
  type ClawPoseName,
} from '../claw/rig'
import { ClawPoseAnimator } from '../animation/pose-animation'
import n4RuntimeReport from './n4-runtime-report.json'
import { createN4Evidence } from './n4-evidence'

function createClawFixture(): Group {
  const root = new Group()
  root.name = 'ClawVisualRoot'
  const fingerRig = new Group()
  fingerRig.name = 'FingerRig'
  root.add(fingerRig)

  for (const name of PIVOT_NAMES) {
    const pivot = new Group()
    pivot.name = name
    const baseline = DEFAULT_CLAW_RIG.baseline[name]
    pivot.position.fromArray([...baseline.position])
    pivot.quaternion.fromArray([...baseline.quaternion])
    fingerRig.add(pivot)
  }
  return root
}

function createAdapter(): ClawPoseAdapter {
  return new ClawPoseAdapter(createClawFixture())
}

function snapshotJson(adapter: ClawPoseAdapter): string {
  return JSON.stringify(adapter.snapshot())
}

describe('N4 deterministic claw articulation', () => {
  it('captures every named pose and keeps all targets finite', () => {
    const adapter = createAdapter()

    for (const pose of POSE_NAMES) {
      const snapshot = adapter.applyPoseTarget(pose)
      expect(adapter.currentPose).toBe(pose)
      expect(adapter.detectDrift(pose)).toMatchObject({
        pose,
        matches: true,
        errors: [],
      })
      for (const name of PIVOT_NAMES) {
        expect(snapshot[name].position.every(Number.isFinite)).toBe(true)
        expect(snapshot[name].quaternion.every(Number.isFinite)).toBe(true)
      }
    }
  })

  it('replays open/close cycles with identical snapshots and no cumulative drift', () => {
    const adapter = createAdapter()
    const expected = new Map<ClawPoseName, string>()

    for (let cycle = 0; cycle < 8; cycle += 1) {
      for (const pose of ['open', 'closed', 'open', 'closed'] as const) {
        adapter.applyPoseTarget(pose)
        const snapshot = snapshotJson(adapter)
        const first = expected.get(pose)
        if (first) expect(snapshot).toBe(first)
        else expected.set(pose, snapshot)
        expect(adapter.detectDrift(pose).matches).toBe(true)
      }
    }

    adapter.restoreBaseline()
    expect(snapshotJson(adapter)).toBe(
      JSON.stringify(DEFAULT_CLAW_RIG.poses.reset),
    )
    expect(adapter.detectDrift('reset').matches).toBe(true)
  })

  it('finishes an interrupted transition from the current absolute snapshot', () => {
    const adapter = createAdapter()
    const animator = new ClawPoseAnimator(adapter)

    const firstGeneration = animator.start('closed', 1000).generation
    animator.advance(400, firstGeneration)
    const interruptedSnapshot = snapshotJson(adapter)
    expect(animator.state.active).toBe(true)
    expect(animator.state.progress).toBeCloseTo(0.4)

    const secondGeneration = animator.start('open', 600).generation
    expect(secondGeneration).not.toBe(firstGeneration)
    const beforeStaleAdvance = snapshotJson(adapter)
    animator.advance(100, firstGeneration)
    expect(snapshotJson(adapter)).toBe(beforeStaleAdvance)
    animator.advance(600, secondGeneration)

    expect(animator.state.active).toBe(false)
    expect(snapshotJson(adapter)).toBe(JSON.stringify(DEFAULT_CLAW_RIG.poses.open))
    expect(snapshotJson(adapter)).not.toBe(interruptedSnapshot)
    expect(adapter.detectDrift('open').matches).toBe(true)
  })

  it('resets from an arbitrary interrupted transform without inverse rotation', () => {
    const adapter = createAdapter()
    const animator = new ClawPoseAnimator(adapter)

    animator.start('closed', 1000)
    animator.advance(375)
    const beforeReset = adapter.snapshot()
    expect(beforeReset.FingerPivot_0.quaternion).not.toEqual(
      DEFAULT_CLAW_RIG.poses.reset.FingerPivot_0.quaternion,
    )

    adapter.restoreBaseline()
    const beforeExternalCancellation = snapshotJson(adapter)
    animator.advance(100, animator.state.generation)
    expect(snapshotJson(adapter)).toBe(beforeExternalCancellation)

    expect(snapshotJson(adapter)).toBe(
      JSON.stringify(DEFAULT_CLAW_RIG.poses.reset),
    )
    expect(adapter.detectDrift('reset')).toMatchObject({
      matches: true,
      errors: [],
    })
  })

  it('detects deliberate pivot drift and reports the named pivot', () => {
    const root = createClawFixture()
    const adapter = new ClawPoseAdapter(root)
    adapter.applyPoseTarget('open')
    const pivot = root.getObjectByName('FingerPivot_1')!
    pivot.quaternion.multiply(
      new Quaternion().setFromAxisAngle(
        { x: 0, y: 1, z: 0 },
        0.01,
      ),
    )

    const drift = adapter.detectDrift('open')
    expect(drift.matches).toBe(false)
    expect(drift.errors.some((error) => error.startsWith('FingerPivot_1:'))).toBe(
      true,
    )
  })

  it('publishes complete deterministic evidence for the N4 scenarios', () => {
    const evidence = createN4Evidence()

    expect(evidence.pivots).toEqual([...PIVOT_NAMES])
    expect(Object.keys(evidence.poses)).toEqual([...POSE_NAMES])
    expect(
      Object.values(evidence.poseDrift).every((drift) => drift.matches),
    ).toBe(true)
    expect(evidence.repeatedOpenCloseCycles).toMatchObject({
      cycles: 8,
      allSnapshotsMatch: true,
    })
    expect(evidence.interruptedCycle.drift.matches).toBe(true)
    expect(evidence.reset.drift.matches).toBe(true)
    expect(evidence.refreshRemount.matchingBaseline).toBe(true)
    expect(evidence.noInverseTransformReset).toBe(true)
  })

  it('keeps the persisted pose captures synchronized with rig targets', () => {
    const captures = n4RuntimeReport.poseCaptures as unknown as Record<
      ClawPoseName,
      (typeof DEFAULT_CLAW_RIG.poses)[ClawPoseName]
    >

    for (const pose of POSE_NAMES) {
      expect(captures[pose]).toEqual(DEFAULT_CLAW_RIG.poses[pose])
    }
  })

  it('produces the same baseline after a fresh refresh and remount', () => {
    const first = createAdapter()
    const second = createAdapter()

    first.applyPoseTarget('closed')
    first.applyPoseTarget('open')
    first.restoreBaseline()
    second.restoreBaseline()

    expect(snapshotJson(first)).toBe(snapshotJson(second))
    expect(snapshotJson(first)).toBe(
      JSON.stringify(DEFAULT_CLAW_RIG.poses.reset),
    )
    expect(first.generation).toBeGreaterThan(0)
    expect(second.generation).toBeGreaterThan(0)
  })
})
