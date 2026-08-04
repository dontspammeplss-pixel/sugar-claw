import { Group } from 'three'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'
import {
  DEFAULT_PRIZE_MANIFEST,
  loadPrizeManifest,
  validatePrizeManifest,
} from '../playfield/prize-manifest'
import {
  clearPrizePersistence,
  createPrizePersistenceStore,
} from '../playfield/prize-persistence'

function cloneManifest() {
  return JSON.parse(JSON.stringify(DEFAULT_PRIZE_MANIFEST)) as typeof DEFAULT_PRIZE_MANIFEST
}

function expectClose(actual: readonly number[], expected: readonly number[], tolerance = 0.0005): boolean {
  return actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance)
}

export async function createN43Evidence() {
  const manifest = loadPrizeManifest(DEFAULT_PRIZE_MANIFEST)
  const validationErrors = validatePrizeManifest(manifest)
  const invalidManifest = {
    ...cloneManifest(),
    prizes: [
      ...cloneManifest().prizes,
      { ...cloneManifest().prizes[0], id: 'tag-prize' },
    ],
  }
  let invalidManifestError = ''
  try {
    loadPrizeManifest(invalidManifest)
  } catch (error) {
    invalidManifestError = error instanceof Error ? error.message : String(error)
  }
  const persistence = createPrizePersistenceStore()
  clearPrizePersistence(manifest.revision)

  const first = await N6PhysicsAdapter.create({
    prizeManifest: manifest,
    persistence,
    persistPrizeState: true,
  })
  let nudgedPosition: readonly number[] = []
  let firstSnapshot
  try {
    first.movePrize('tag-prize', [-0.42, 1.24, 0.16])
    first.stepMany(3)
    nudgedPosition = first.transformPrize('tag-prize').position
    firstSnapshot = first.playfield
  } finally {
    first.dispose()
  }

  const resumed = await N6PhysicsAdapter.create({
    prizeManifest: manifest,
    persistence,
    persistPrizeState: true,
  })
  let resumedSnapshot
  try {
    resumedSnapshot = resumed.playfield
  } finally {
    resumed.dispose()
  }

  const revisionManifest = {
    ...cloneManifest(),
    revision: 'n43-new-machine-rev2',
  }
  clearPrizePersistence(revisionManifest.revision)
  const fresh = await N6PhysicsAdapter.create({
    prizeManifest: revisionManifest,
    persistence,
    persistPrizeState: true,
  })
  let freshSnapshot
  try {
    freshSnapshot = fresh.playfield
  } finally {
    fresh.dispose()
  }

  const deliveryManifest = {
    ...cloneManifest(),
    revision: 'n43-delivery-fixture-rev1',
    prizes: cloneManifest().prizes.map((prize) =>
      prize.id === 'tag-prize'
        ? { ...prize, position: [1.05, 1.1, 0.55] as [number, number, number] }
        : prize,
    ),
  }
  clearPrizePersistence(deliveryManifest.revision)
  const delivery = await N6PhysicsAdapter.create({
    prizeManifest: deliveryManifest,
    selectedPrizeId: 'tag-prize',
    persistence,
    persistPrizeState: true,
  })
  let winRemoval
  try {
    delivery.step()
    const delivered = delivery.delivery
    const selectedRetention = delivery.retention
    const afterWin = delivery.playfield
    delivery.dispose()
    const reloaded = await N6PhysicsAdapter.create({
      prizeManifest: deliveryManifest,
      persistence,
      persistPrizeState: true,
    })
    try {
      const resumedAfterWin = reloaded.playfield
      winRemoval = {
        delivered: delivered?.delivered === true,
        removed: delivered?.removed === true,
        selectedPrizeId: delivery.selectedPrize,
        selectedWeight: selectedRetention.weight,
        selectedCenterOfMass: selectedRetention.centerOfMass,
        winningsCount: afterWin.winningsCount,
        reloadRemoved: resumedAfterWin.prizes.find((prize) => prize.id === 'tag-prize')?.removed === true,
        reloadWinningsCount: resumedAfterWin.winningsCount,
      }
    } finally {
      reloaded.dispose()
    }
  } catch (error) {
    delivery.dispose()
    throw error
  }

  const collisionFixture = await N6PhysicsAdapter.create({
    prizeManifest: manifest,
    persistence: createPrizePersistenceStore(),
    persistPrizeState: false,
  })
  let prizeCollision
  try {
    collisionFixture.movePrize('tag-prize', [0, 1.2, 0])
    collisionFixture.stepMany(3)
    const traces = collisionFixture.observeN38ContactTraces()
    prizeCollision = {
      observed: traces.some((trace) =>
        trace.a === 'prize' && trace.b === 'prize' &&
        trace.aColliderId !== trace.bColliderId && trace.solverContact,
      ),
      traceCount: traces.filter((trace) =>
        trace.a === 'prize' && trace.b === 'prize' &&
        trace.aColliderId !== trace.bColliderId && trace.solverContact,
      ).length,
    }
  } finally {
    collisionFixture.dispose()
  }

  const performanceFixture = await N6PhysicsAdapter.create({
    prizeManifest: manifest,
    persistence: createPrizePersistenceStore(),
    persistPrizeState: false,
  })
  let measuredPerformance
  try {
    const start = performance.now()
    performanceFixture.stepMany(120)
    const elapsedMs = performance.now() - start
    measuredPerformance = {
      steps: 120,
      elapsedMs,
      averagePhysicsStepMs: elapsedMs / 120,
      thresholdMs: 2,
      withinPhysicsStepBudget: elapsedMs / 120 <= 2,
    }
  } finally {
    performanceFixture.dispose()
  }

  const repeatedA = await N6PhysicsAdapter.create({
    prizeManifest: manifest,
    persistence: createPrizePersistenceStore(),
    persistPrizeState: false,
  })
  const repeatedB = await N6PhysicsAdapter.create({
    prizeManifest: manifest,
    persistence: createPrizePersistenceStore(),
    persistPrizeState: false,
  })
  let repeatable
  try {
    repeatedA.stepMany(30)
    repeatedB.stepMany(30)
    repeatable = manifest.prizes.every((prize) =>
      expectClose(repeatedA.transformPrize(prize.id).position, repeatedB.transformPrize(prize.id).position),
    )
  } finally {
    repeatedA.dispose()
    repeatedB.dispose()
  }

  const collision = await N6PhysicsAdapter.create({
    prizeManifest: manifest,
    persistence: createPrizePersistenceStore(),
    persistPrizeState: false,
  })
  let collisionEvidence
  try {
    const inventory = collision.diagnosticInventory()
    const prizeGroups = inventory.identities
      .filter((identity) => identity.entity === 'collider' && identity.role === 'prize')
      .map((identity) => ({ id: identity.colliderId, group: identity.collisionGroup, mask: identity.filterMask }))
    collisionEvidence = {
      prizeColliderCount: prizeGroups.length,
      distinctFromClaw: prizeGroups.every((entry) => entry.group !== 4),
      prizeVsPrizeEligible: prizeGroups.length >= 2 && (prizeGroups[0].mask & 2) !== 0,
      prizeVsClawEligible: prizeGroups.length >= 1 && (prizeGroups[0].mask & 4) !== 0,
    }
  } finally {
    collision.dispose()
  }

  const result = {
    node: 'N43',
    status: validationErrors.length === 0 &&
      invalidManifestError.startsWith('manifest-invalid:') &&
      winRemoval.delivered && winRemoval.removed &&
      winRemoval.selectedPrizeId === 'tag-prize' &&
      winRemoval.selectedWeight === 8 &&
      winRemoval.selectedCenterOfMass[0] === 0.02 &&
      winRemoval.winningsCount === 1 &&
      winRemoval.reloadRemoved && winRemoval.reloadWinningsCount === 1 &&
      firstSnapshot.prizes.length >= 3 &&
      resumedSnapshot.freshLayout === false &&
      expectClose(
        resumedSnapshot.prizes.find((prize) => prize.id === 'tag-prize')?.position ?? [],
        nudgedPosition,
      ) &&
      freshSnapshot.freshLayout === true &&
      freshSnapshot.prizes.every((prize) => !prize.won && !prize.removed) &&
      repeatable &&
      collisionEvidence.prizeColliderCount >= 3 &&
      collisionEvidence.distinctFromClaw &&
      collisionEvidence.prizeVsPrizeEligible &&
      collisionEvidence.prizeVsClawEligible &&
      prizeCollision.observed &&
      measuredPerformance.withinPhysicsStepBudget
      ? 'pass'
      : 'fail',
    deterministic: true,
    physics: { revision: N6_PHYSICS_CONFIG.revision, fixedDt: N6_PHYSICS_CONFIG.dt },
    manifest: {
      revision: manifest.revision,
      prizeCount: manifest.prizes.length,
      geometries: manifest.prizes.map((prize) => prize.geometry),
      validationErrors,
      invalidManifestRejected: invalidManifestError.startsWith('manifest-invalid:'),
      invalidManifestError,
    },
    persistence: {
      firstSnapshot,
      nudgedPosition,
      resumedSnapshot,
      sameRevisionRestored: resumedSnapshot.freshLayout === false &&
        expectClose(resumedSnapshot.prizes.find((prize) => prize.id === 'tag-prize')?.position ?? [], nudgedPosition),
    },
    winRemoval: winRemoval,
    resetSemantics: {
      freshSnapshot,
      freshRevisionReset: freshSnapshot.freshLayout === true,
      noWonPrizesOnFreshRevision: freshSnapshot.prizes.every((prize) => !prize.won && !prize.removed),
    },
    collision: { ...collisionEvidence, prizeCollision },
    repeatability: { thirtyFixedStepsMatch: repeatable },
    performance: {
      methodology: 'N21 / records/contracts/performance-thresholds.md',
      thresholdReference: 'p95 frame <= 20ms; average physics step <= 2ms; sustained >= 50fps',
      measured: measuredPerformance,
      browserFps: 'not claimed; reference-device browser profiling remains required',
    },
    verificationCommands: ['npm run typecheck', 'npm run lint', 'npm test', 'npm run build'],
  }
  return result
}

export function createN43FixtureScene(): Group {
  const scene = new Group()
  scene.name = 'N43FixtureScene'
  return scene
}
