import { Group, MathUtils, type Object3D } from 'three'

export interface GripFlexSnapshot {
  readonly normalizedStrength: number
  readonly targetFlex: number
  readonly appliedFlex: number
  readonly bladeFlex: number
  readonly hookFlex: number
  readonly stiffness: number
  readonly damping: number
  readonly pivotArticulation: number
}

const FINGER_COUNT = 3
const MIN_VOLTAGE = 12
const MAX_VOLTAGE = 36
const MAX_BLADE_FLEX = 0.3
const MAX_HOOK_FLEX = 0.5
const RESPONSE_RATE = 10
const MIN_ARTICULATION = -0.05
const MAX_ARTICULATION = 0.14

function findOrCreate(root: Object3D, name: string, pivotIndex: number): Object3D {
  const existing = root.getObjectByName(name)
  if (existing) return existing
  const pivot = root.getObjectByName(`FingerPivot_${pivotIndex}`)
  if (!pivot) {
    throw new Error(`GripFlexController: missing FingerPivot_${pivotIndex}`)
  }
  const joint = new Group()
  joint.name = name
  pivot.add(joint)
  return joint
}

/**
 * Presentation hinge controller for authored blade and hook segments.
 * Grip strength maps continuously to flex and the authored pivot articulation.
 * Physics remains authoritative for whether the prize is retained or released.
 */
export class GripFlexController {
  private readonly bladeJoints: readonly Object3D[]
  private readonly hookJoints: readonly Object3D[]
  private readonly articulationJoints: readonly Object3D[]
  private normalizedStrength = 0.5
  private targetFlex = MAX_BLADE_FLEX * 0.5
  private appliedFlex = this.targetFlex
  private elapsedSeconds = 0
  private pivotArticulation = 0
  private frozen = false

  constructor(root: Object3D) {
    this.bladeJoints = Object.freeze(
      Array.from({ length: FINGER_COUNT }, (_, index) =>
        findOrCreate(root, `FingerBladeJoint_${index}`, index),
      ),
    )
    this.hookJoints = Object.freeze(
      Array.from({ length: FINGER_COUNT }, (_, index) =>
        findOrCreate(root, `FingerHookJoint_${index}`, index),
      ),
    )
    this.articulationJoints = Object.freeze(
      Array.from({ length: FINGER_COUNT }, (_, index) =>
        findOrCreate(root, `FingerMesh_${index}`, index),
      ),
    )
    this.applyJoints(0)
  }

  get snapshot(): GripFlexSnapshot {
    return {
      normalizedStrength: this.normalizedStrength,
      targetFlex: this.targetFlex,
      appliedFlex: this.appliedFlex,
      bladeFlex: this.appliedFlex,
      hookFlex: (this.appliedFlex / MAX_BLADE_FLEX) * MAX_HOOK_FLEX,
      stiffness: this.normalizedStrength,
      damping: 0.25 + this.normalizedStrength * 0.75,
      pivotArticulation: this.pivotArticulation,
    }
  }

  /** Sets a new voltage target; the next `advance` interpolates toward it. */
  setGripVoltage(voltage: number): GripFlexSnapshot {
    if (!Number.isFinite(voltage)) {
      throw new Error('GripFlexController: voltage must be finite')
    }
    const clamped = Math.min(MAX_VOLTAGE, Math.max(MIN_VOLTAGE, voltage))
    this.normalizedStrength =
      (clamped - MIN_VOLTAGE) / (MAX_VOLTAGE - MIN_VOLTAGE)
    this.targetFlex = (1 - this.normalizedStrength) * MAX_BLADE_FLEX
    this.pivotArticulation = MathUtils.lerp(
      MAX_ARTICULATION,
      MIN_ARTICULATION,
      this.normalizedStrength,
    )
    return this.snapshot
  }

  /** Advances the visual joints with a frame-rate-independent smooth response. */
  advance(deltaMs: number): GripFlexSnapshot {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new Error('GripFlexController: deltaMs must be finite and non-negative')
    }
    if (this.frozen) return this.snapshot
    const response = 1 - Math.exp((-RESPONSE_RATE * deltaMs) / 1000)
    this.appliedFlex += (this.targetFlex - this.appliedFlex) * response
    this.elapsedSeconds += deltaMs / 1000
    this.applyJoints(this.elapsedSeconds)
    return this.snapshot
  }

  private applyJoints(timeSeconds: number): void {
    const weakness = 1 - this.normalizedStrength
    const wobble = weakness * 0.035 * Math.sin(timeSeconds * 8)
    const bladeFlex = this.appliedFlex + wobble
    const hookFlex =
      (this.appliedFlex / MAX_BLADE_FLEX) * MAX_HOOK_FLEX + wobble * 1.25
    this.bladeJoints.forEach((joint, index) => {
      const phase = (index * Math.PI * 2) / FINGER_COUNT
      joint.rotation.z = bladeFlex + weakness * 0.012 * Math.sin(timeSeconds * 5 + phase)
    })
    this.hookJoints.forEach((joint, index) => {
      const phase = (index * Math.PI * 2) / FINGER_COUNT
      joint.rotation.z = hookFlex + weakness * 0.018 * Math.sin(timeSeconds * 7 + phase)
    })
    this.articulationJoints.forEach((joint) => {
      joint.rotation.z = this.pivotArticulation
    })
  }

  /** Holds the current finger pose during the stationary release window. */
  freeze(): void {
    this.frozen = true
  }

  /** Resumes live grip-driven articulation after a reset. */
  resume(): void {
    this.frozen = false
  }
}
