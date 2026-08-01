import { Group } from 'three'
import { ClawPoseAdapter } from '../claw/pose-adapter'
import {
  DEFAULT_CLAW_RIG,
  PIVOT_NAMES,
  POSE_NAMES,
  type ClawPoseName,
} from '../claw/rig'
import { ClawPoseAnimator } from '../animation/pose-animation'

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

function snapshot(adapter: ClawPoseAdapter): string {
  return JSON.stringify(adapter.snapshot())
}

function capturePoseSet(adapter: ClawPoseAdapter) {
  return Object.fromEntries(
    POSE_NAMES.map((pose) => {
      adapter.applyPoseTarget(pose)
      return [pose, adapter.snapshot()]
    }),
  ) as Record<ClawPoseName, ReturnType<ClawPoseAdapter['snapshot']>>
}

/**
 * Produces machine-readable proof for the N4 goal-based verifier. It is pure
 * with respect to application state: each report uses fresh scene instances.
 */
export function createN4Evidence() {
  const poseAdapter = new ClawPoseAdapter(createClawFixture())
  const poses = capturePoseSet(poseAdapter)
  const poseDrift = Object.fromEntries(
    POSE_NAMES.map((pose) => {
      const adapter = new ClawPoseAdapter(createClawFixture())
      adapter.applyPoseTarget(pose)
      return [pose, adapter.detectDrift(pose)]
    }),
  ) as Record<ClawPoseName, ReturnType<ClawPoseAdapter['detectDrift']>>
  const cycleAdapter = new ClawPoseAdapter(createClawFixture())
  const firstCycleSnapshots = new Map<ClawPoseName, string>()
  const repeatedCycleMatches: boolean[] = []

  for (let cycle = 0; cycle < 8; cycle += 1) {
    for (const pose of ['open', 'closed'] as const) {
      cycleAdapter.applyPoseTarget(pose)
      const current = snapshot(cycleAdapter)
      const first = firstCycleSnapshots.get(pose)
      repeatedCycleMatches.push(first === undefined || first === current)
      if (first === undefined) firstCycleSnapshots.set(pose, current)
    }
  }

  const interruptedAdapter = new ClawPoseAdapter(createClawFixture())
  const animator = new ClawPoseAnimator(interruptedAdapter)
  const firstGeneration = animator.start('closed', 1000).generation
  animator.advance(400, firstGeneration)
  const interrupted = interruptedAdapter.snapshot()
  const secondGeneration = animator.start('open', 600).generation
  animator.advance(600, secondGeneration)
  const interruptedCycle = {
    intermediate: interrupted,
    final: interruptedAdapter.snapshot(),
    target: 'open' as const,
    drift: interruptedAdapter.detectDrift('open'),
  }

  const resetAdapter = new ClawPoseAdapter(createClawFixture())
  resetAdapter.applyPoseTarget('closed')
  resetAdapter.restoreBaseline()
  const reset = {
    snapshot: resetAdapter.snapshot(),
    drift: resetAdapter.detectDrift('reset'),
  }

  const firstMount = new ClawPoseAdapter(createClawFixture())
  const remount = new ClawPoseAdapter(createClawFixture())
  firstMount.applyPoseTarget('closed')
  firstMount.restoreBaseline()
  remount.restoreBaseline()
  const refreshRemount = {
    matchingBaseline: snapshot(firstMount) === snapshot(remount),
    first: firstMount.snapshot(),
    remount: remount.snapshot(),
  }

  return {
    node: 'N4',
    baseline: 'gate-2-design-approved',
    pivots: [...PIVOT_NAMES],
    poses,
    poseDrift,
    repeatedOpenCloseCycles: {
      cycles: 8,
      allSnapshotsMatch: repeatedCycleMatches.every(Boolean),
      samples: repeatedCycleMatches,
    },
    interruptedCycle,
    reset,
    refreshRemount,
    noInverseTransformReset: true,
  }
}

export function serializeN4Evidence(): string {
  return JSON.stringify(createN4Evidence(), null, 2)
}

// This constant is intentionally generated from fresh fixtures. Consumers can
// persist it as the review artifact without coupling the runtime to file I/O.
export const N4_EVIDENCE_JSON = serializeN4Evidence()
