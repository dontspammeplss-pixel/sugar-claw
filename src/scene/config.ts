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
} as const

export const REVIEW_CAMERA = {
  name: 'ReviewCamera',
  position: [6.3, 4.35, 7.8] as Vec3,
  target: [0, 2.05, 0] as Vec3,
  up: [0, 1, 0] as Vec3,
  fovVerticalDeg: 38,
  nearClip: 0.05,
  farClip: 100,
  framingMargin: 0.08,
} as const

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
    position: [1.05, 0.66, 1.02] as Vec3,
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
  gripCenter: [0, -0.25, 0] as Vec3,
  fingerPivotRadius: 0.16,
  fingerLength: 0.44,
} as const

export const LIGHTS = {
  key: { color: '#FFD8A3', intensity: 3.2, position: [-3.5, 6, 4.5] as Vec3 },
  fill: { color: '#9CCBDB', intensity: 1.5, position: [4, 3, 3] as Vec3 },
  rim: { color: '#4FE5F2', intensity: 2, position: [-2.5, 4.5, -3] as Vec3 },
  interior: { color: '#FFC06B', intensity: 2.2, position: [0, 3.1, 0] as Vec3 },
  floorBounce: {
    color: '#D8B789',
    intensity: 0.45,
    position: [0, 0.4, 1.5] as Vec3,
  },
} as const
