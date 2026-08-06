import type { Vec3 } from '../types/geometry'

export type RetentionStatus = 'idle' | 'holding' | 'released'

export interface RetentionState {
  readonly status: RetentionStatus
  readonly voltage: number
  readonly capacity: number
  readonly required: number
  readonly margin: number
  readonly torque: number
  readonly weight: number
  readonly centerOfMass: Vec3
  readonly gripPoint: Vec3
  readonly contactCount: number
  readonly swingAcceleration: number
  readonly travelAcceleration: number
  readonly releasedAt: number | null
}

export interface RetentionReleaseEvent {
  readonly state: 'released'
  readonly step: number
  readonly runId: number
  readonly margin: number
  readonly reason: 'hold-margin-negative'
}
