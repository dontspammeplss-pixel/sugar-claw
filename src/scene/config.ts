import { FINGER_RING_RADIUS } from '../claw/rig'
import { N6_PHYSICS_CONFIG } from '../physics/config'

export type Vec3 = readonly [number, number, number]

export const MATERIALS = {
  machineGraphite: '#20262B',
  machineEdge: '#46515A',
  clawSteel: '#AEB9BD',
  clawCyanAccent: '#41D9E8',
  interiorSlate: '#303A3E',
  glassNeutral: '#B8D0D2',
  chuteAmber: '#D88932',
  playfieldWarm: '#88745C',
  rubberDark: '#151719',
  prizeIvory: '#F5E2B8',
  backdropAccent: '#1D2A33',
} as const

export const REVIEW_CAMERA = {
  name: 'ReviewCamera',
  position: [0, 2.3, 7] as Vec3,
  target: [0, 2.05, 0] as Vec3,
  up: [0, 1, 0] as Vec3,
  fovVerticalDeg: 38,
  nearClip: 0.05,
  farClip: 100,
  framingMargin: 0.08,
} as const

export type CameraViewName = 'orbit' | 'top' | 'side'

export interface CameraViewPreset {
  readonly name: string
  readonly position: Vec3
  readonly target: Vec3
  readonly up: Vec3
  readonly fovVerticalDeg: number
}

/** Selectable viewport camera angles (Free Orbit / Top / Side). */
export const CAMERA_VIEWS: Readonly<Record<CameraViewName, CameraViewPreset>> =
  {
    // Only the front glass is transparent; the top cap and side frames are solid.
    // Cameras therefore live in front of the glass (z > 1.2) at steep angles so
    // their sightline enters the chamber through the glass.
    orbit: {
      name: 'Free Orbit',
      position: [0, 2.3, 7],
      target: [0, 2.05, 0],
      up: [0, 1, 0],
      fovVerticalDeg: 38,
    },
    top: {
      name: 'Top View',
      position: [0, 5.5, 4.5],
      target: [0, 0.9, 0],
      up: [0, 0, -1],
      fovVerticalDeg: 40,
    },
    side: {
      name: 'Side View',
      position: [5.5, 2.15, 4.5],
      target: [0, 2.05, 0],
      up: [0, 1, 0],
      fovVerticalDeg: 36,
    },
  }

export const MACHINE = {
  envelope: [3.6, 4.2, 2] as Vec3,
  plinth: { size: [3.6, 0.55, 2] as Vec3, position: [0, 0.275, 0] as Vec3 },
  chamber: {
    size: [3.4, 2.35, 1.78] as Vec3,
    position: [0, 1.72, 0] as Vec3,
  },
  topCap: { size: [3.6, 0.55, 2] as Vec3, position: [0, 3.95, 0] as Vec3 },
  leftFrame: {
    size: [0.18, 2.85, 1.92] as Vec3,
    position: [-1.71, 2.25, 0] as Vec3,
  },
  rightFrame: {
    size: [0.18, 2.85, 1.92] as Vec3,
    position: [1.71, 2.25, 0] as Vec3,
  },
  topFrame: {
    size: [3.42, 0.18, 1.92] as Vec3,
    position: [0, 3.57, 0] as Vec3,
  },
  frontGlass: {
    size: [3.2, 2.65, 0.035] as Vec3,
    position: [0, 2.15, 0.91] as Vec3,
  },
  playfieldFloor: {
    size: [3.18, 0.06, 1.52] as Vec3,
    position: [0, 0.86, -0.05] as Vec3,
  },
  chute: {
    size: [0.72, 0.22, 0.52] as Vec3,
    position: [
      N6_PHYSICS_CONFIG.chute.sensorPosition[0],
      0.66,
      N6_PHYSICS_CONFIG.chute.sensorPosition[2],
    ] as Vec3,
    openingPosition: [
      N6_PHYSICS_CONFIG.chute.sensorPosition[0],
      0.78,
      N6_PHYSICS_CONFIG.chute.sensorPosition[2],
    ] as Vec3,
  },
} as const

export const CLAW = {
  mountEnvelope: [2.5, 1.85, 0.9] as Vec3,
  headCenterBounds: {
    min: [-1.25, 1.35, -0.35] as Vec3,
    max: [1.25, 3.2, 0.55] as Vec3,
  },
  homeHeadCenter: [0, 2.85, 0.1] as Vec3,
  visualEnvelope: [0.7, 1.1, 0.58] as Vec3,
  carriage: { size: [0.58, 0.2, 0.42] as Vec3, position: [0, 0.5, 0] as Vec3 },
  head: { size: [0.46, 0.28, 0.44] as Vec3, position: [0, 0.05, 0] as Vec3 },
  gripCenter: [0, -0.53, 0] as Vec3,
  // N22 claw-hand geometry: the pivot ring was widened (0.16 -> 0.28) and the
  // blades lengthened (0.44 -> 0.50) so closed fingers wrap the prize instead
  // of sinking into it. Head widened to cover the new ring; hooks point
  // radially inward per the approved design ("soft inward hook").
  // The ring radius is owned by the rig (single source of truth) so the
  // authored hierarchy can never desync from the pose adapter's writes.
  fingerPivotRadius: FINGER_RING_RADIUS,
  fingerLength: 0.5,
  headRadius: 0.3,
  headAccentRadius: 0.26,
  hookRadius: 0.05,
  hookLength: 0.1,
  // Inward offset of the hook center from the blade centerline (negative =
  // toward the claw axis); the hook cylinder's axis runs radially.
  hookInset: -0.05,
} as const

export const LIGHTS = {
  ambient: { color: '#A9C4CB', intensity: 0.65 },
  hemisphere: {
    skyColor: '#CBE3EA',
    groundColor: '#263038',
    intensity: 0.8,
  },
  key: { color: '#FFD8A3', intensity: 4.2, position: [-3.5, 6, 4.5] as Vec3 },
  fill: { color: '#9CCBDB', intensity: 2.4, position: [4, 3, 3] as Vec3 },
  rim: { color: '#4FE5F2', intensity: 2.8, position: [-2.5, 4.5, -3] as Vec3 },
  interior: { color: '#FFC06B', intensity: 3.2, position: [0, 3.1, 0] as Vec3 },
  floorBounce: {
    color: '#D8B789',
    intensity: 0.9,
    position: [0, 0.4, 1.5] as Vec3,
  },
} as const
