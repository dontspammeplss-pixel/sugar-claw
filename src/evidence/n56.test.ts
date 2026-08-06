import { Group } from 'three'
import { describe, expect, it } from 'vitest'
import { GripFlexController } from '../claw/grip-flex'
import { DEFAULT_CLAW_RIG, PIVOT_NAMES } from '../claw/rig'
import { N6PhysicsAdapter } from '../physics/adapter'
import { N6_PHYSICS_CONFIG } from '../physics/config'

function createFlexFixture(): Group {
  const root = new Group()
  const rig = new Group()
  root.add(rig)
  PIVOT_NAMES.forEach((name, index) => {
    const pivot = new Group()
    pivot.name = name
    pivot.position.fromArray([...DEFAULT_CLAW_RIG.baseline[name].position])
    pivot.quaternion.fromArray([...DEFAULT_CLAW_RIG.baseline[name].quaternion])
    const blade = new Group()
    blade.name = `FingerBladeJoint_${index}`
    const hook = new Group()
    hook.name = `FingerHookJoint_${index}`
    pivot.add(blade, hook)
    rig.add(pivot)
  })
  return root
}

describe('N56 grip-strength finger flex', () => {
  it('interpolates from visibly soft/wobbly to stiff/minimal flex', () => {
    const root = createFlexFixture()
    const flex = new GripFlexController(root)
    flex.setGripVoltage(12)
    const weakStart = flex.snapshot
    flex.advance(16)
    const weakMid = flex.snapshot
    flex.advance(500)
    const weakSettled = flex.snapshot
    expect(weakSettled.appliedFlex).toBeGreaterThan(0.2)
    expect(weakSettled.stiffness).toBe(0)
    expect(weakSettled.damping).toBe(0.25)
    expect(weakMid.appliedFlex).toBeGreaterThan(weakStart.appliedFlex)

    flex.setGripVoltage(36)
    const strongStart = flex.snapshot
    expect(strongStart.appliedFlex).toBeGreaterThan(0)
    flex.advance(1000)
    const strongSettled = flex.snapshot
    expect(strongSettled.appliedFlex).toBeLessThan(0.01)
    expect(strongSettled.stiffness).toBe(1)
    expect(strongSettled.damping).toBe(1)
    expect(strongSettled.appliedFlex).toBeLessThan(weakSettled.appliedFlex)
    expect(root.getObjectByName('FingerBladeJoint_0')!.rotation.z).toBeCloseTo(0, 2)
  })

  it('keeps the same object under a strong grip and releases it under a weak grip', async () => {
    async function run(gripVoltage: number) {
      const adapter = await N6PhysicsAdapter.create({
        retention: { gripVoltage, prizeWeight: 40 },
      })
      adapter.moveClaw(N6_PHYSICS_CONFIG.gripPosition)
      adapter.stepMany(3)
      expect(adapter.attemptGrip().accepted).toBe(true)
      const records = adapter.stepMany(8)
      const released = records.some((record) => record.retentionRelease !== null)
      adapter.dispose()
      return released
    }

    expect(await run(12)).toBe(true)
    expect(await run(36)).toBe(false)
  })
})
