import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { N38_COLLISION_MATRIX } from '../physics/config'
import { createN38Evidence } from './n38-evidence'

describe('N38 collision observability and barrier contract', () => {
  it('proves registered physics identities, matrix coverage, contacts, barriers, and reset', async () => {
    const evidence = await createN38Evidence()
    await mkdir('records/evidence', { recursive: true })
    await writeFile(
      'records/evidence/n38-collision-observability.json',
      JSON.stringify(evidence, null, 2),
    )

    expect(evidence.status).toBe('pass')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.inventory.beforeStepping.missingRegistrations).toEqual([])
    expect(evidence.inventory.afterReset.missingRegistrations).toEqual([])
    expect(evidence.inventory.beforeStepping.visualProxyBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          visualId: 'ClawVisualRoot',
          missingColliderIds: [],
        }),
        expect.objectContaining({
          visualId: 'PrizeBody',
          missingColliderIds: [],
        }),
        expect.objectContaining({
          visualId: 'MachineCollisionProxies/ChamberWalls',
          missingColliderIds: [],
        }),
      ]),
    )
    expect(evidence.inventory.beforeStepping.identities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'collider',
          logicalBodyId: 'head',
          colliderId: 'claw-head',
          role: 'clawBody',
          shapeType: 'cuboid',
          mode: 'solver',
        }),
        expect.objectContaining({
          entity: 'collider',
          logicalBodyId: 'head',
          colliderId: 'grip-sensor',
          role: 'sensor',
          shapeType: 'ball',
          sensor: true,
          mode: 'sensor',
          solverMask: 0,
        }),
        expect.objectContaining({
          entity: 'collider',
          logicalBodyId: 'environment',
          colliderId: 'environment-floor',
          role: 'floor',
          shapeType: 'cuboid',
        }),
      ]),
    )
    expect(evidence.pairMatrix.contractCells).toBe(N38_COLLISION_MATRIX.length)
    expect(evidence.pairMatrix.pass).toBe(true)
    expect(evidence.claims.visualManifestPass).toBe(true)
    expect(evidence.fixtures.negativeVisualOverlap).toMatchObject({
      visualOverlap: true,
      sensorIntersection: false,
      carryConstraintCreated: false,
    })
    expect(evidence.fixtures.clawToObject.contactObserved).toBe(true)
    expect(evidence.fixtures.clawToObject.solverContact).toBe(true)
    expect(evidence.fixtures.fingerToObject.contactObserved).toBe(true)
    expect(evidence.fixtures.objectToFloor.contactObserved).toBe(true)
    expect(evidence.fixtures.clawToWall.contactObserved).toBe(true)
    expect(evidence.barrierTraces.every((trace) => trace.contactObserved)).toBe(
      true,
    )
    expect(evidence.reset).toMatchObject({
      runIdAdvanced: true,
      noMissingBefore: true,
      noMissingAfter: true,
      sameRegistrationShape: true,
      baselineClawRestored: true,
      baselineBodiesRestored: true,
      noContactsAfterReset: true,
      zeroVelocitiesAfterReset: true,
      noCarryAfterReset: true,
    })
    expect(evidence.claims).toMatchObject({
      visualOverlapNeverApprovesCarry: true,
      registrationComplete: true,
      barrierResponsePhysical: true,
      resetRepeatable: true,
    })
  })
})
