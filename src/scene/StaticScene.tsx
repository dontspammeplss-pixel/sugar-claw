import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { DEFAULT_CLAW_RIG, FINGER_RIG, PIVOT_NAMES } from '../claw/rig'
import { DEFAULT_PRIZE_MANIFEST } from '../playfield/prize-manifest'
import { CLAW, LIGHTS, MACHINE, MATERIALS, REVIEW_CAMERA } from './config'

function Box({
  name,
  size,
  position,
  color,
  opacity = 1,
  metalness = 0,
  roughness = 0.5,
}: {
  name: string
  size: readonly [number, number, number]
  position?: readonly [number, number, number]
  color: string
  opacity?: number
  metalness?: number
  roughness?: number
}) {
  return (
    <mesh name={name} position={position} castShadow receiveShadow>
      <boxGeometry args={[...size]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </mesh>
  )
}

function Cylinder({
  name,
  radius,
  height,
  position,
  color,
  rotation = [0, 0, 0],
  metalness = 0,
  roughness = 0.5,
}: {
  name: string
  radius: number
  height: number
  position?: readonly [number, number, number]
  color: string
  rotation?: readonly [number, number, number]
  metalness?: number
  roughness?: number
}) {
  return (
    <mesh
      name={name}
      position={position}
      rotation={[...rotation]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, height, 16]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  )
}

function LightingRoot() {
  return (
    <group name="LightingRoot">
      <ambientLight
        name="AmbientEnvironment"
        color={LIGHTS.ambient.color}
        intensity={LIGHTS.ambient.intensity}
      />
      <hemisphereLight
        name="HemisphereSkyFill"
        color={LIGHTS.hemisphere.skyColor}
        groundColor={LIGHTS.hemisphere.groundColor}
        intensity={LIGHTS.hemisphere.intensity}
      />
      <directionalLight
        name="KeyLight"
        color={LIGHTS.key.color}
        intensity={LIGHTS.key.intensity}
        position={LIGHTS.key.position}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <pointLight
        name="FillLight"
        color={LIGHTS.fill.color}
        intensity={LIGHTS.fill.intensity}
        distance={12}
        position={LIGHTS.fill.position}
      />
      <pointLight
        name="RimLight"
        color={LIGHTS.rim.color}
        intensity={LIGHTS.rim.intensity}
        distance={10}
        position={LIGHTS.rim.position}
      />
      <pointLight
        name="InteriorLight"
        color={LIGHTS.interior.color}
        intensity={LIGHTS.interior.intensity}
        distance={8}
        position={LIGHTS.interior.position}
      />
      <pointLight
        name="FloorBounce"
        color={LIGHTS.floorBounce.color}
        intensity={LIGHTS.floorBounce.intensity}
        distance={6}
        position={LIGHTS.floorBounce.position}
      />
    </group>
  )
}

function CameraRig() {
  const { camera } = useThree()

  useLayoutEffect(() => {
    if (camera.type !== 'PerspectiveCamera') return
    const reviewCamera = camera as PerspectiveCamera
    reviewCamera.name = REVIEW_CAMERA.name
    reviewCamera.position.set(...REVIEW_CAMERA.position)
    reviewCamera.up.set(...REVIEW_CAMERA.up)
    reviewCamera.lookAt(...REVIEW_CAMERA.target)
    reviewCamera.fov = REVIEW_CAMERA.fovVerticalDeg
    reviewCamera.near = REVIEW_CAMERA.nearClip
    reviewCamera.far = REVIEW_CAMERA.farClip
    reviewCamera.updateProjectionMatrix()
  }, [camera])

  return <group name="CameraRig" userData={{ preset: REVIEW_CAMERA.name }} />
}

function MachineVisuals() {
  return (
    <group name="MachineVisuals">
      <Box
        name="BackdropAccent"
        size={[7.5, 4.8, 0.12]}
        position={[0, 2.4, -1.65]}
        color={MATERIALS.backdropAccent}
        metalness={0.12}
        roughness={0.9}
      />
      <Box
        name="LowerPlinth"
        size={MACHINE.plinth.size}
        position={MACHINE.plinth.position}
        color={MATERIALS.machineGraphite}
        metalness={0.78}
        roughness={0.34}
      />
      <Box
        name="PlayfieldCabinet"
        size={[MACHINE.chamber.size[0], MACHINE.chamber.size[1], 0.08]}
        position={[
          MACHINE.chamber.position[0],
          MACHINE.chamber.position[1],
          -0.82,
        ]}
        color={MATERIALS.interiorSlate}
        metalness={0.35}
        roughness={0.52}
      />
      <Box
        name="TopCap"
        size={MACHINE.topCap.size}
        position={MACHINE.topCap.position}
        color={MATERIALS.machineGraphite}
        metalness={0.78}
        roughness={0.34}
      />
      <Box
        name="LeftFrame"
        size={MACHINE.leftFrame.size}
        position={MACHINE.leftFrame.position}
        color={MATERIALS.machineEdge}
        metalness={0.82}
        roughness={0.26}
      />
      <Box
        name="RightFrame"
        size={MACHINE.rightFrame.size}
        position={MACHINE.rightFrame.position}
        color={MATERIALS.machineEdge}
        metalness={0.82}
        roughness={0.26}
      />
      <Box
        name="TopFrame"
        size={MACHINE.topFrame.size}
        position={MACHINE.topFrame.position}
        color={MATERIALS.machineEdge}
        metalness={0.82}
        roughness={0.26}
      />
      <Box
        name="FrontGlass"
        size={MACHINE.frontGlass.size}
        position={MACHINE.frontGlass.position}
        color={MATERIALS.glassNeutral}
        opacity={0.16}
        roughness={0.08}
      />
      <Box
        name="PlayfieldFloor"
        size={MACHINE.playfieldFloor.size}
        position={MACHINE.playfieldFloor.position}
        color={MATERIALS.playfieldWarm}
        roughness={0.68}
      />
      <Box
        name="Chute"
        size={MACHINE.chute.size}
        position={MACHINE.chute.position}
        color={MATERIALS.chuteAmber}
        metalness={0.55}
        roughness={0.32}
      />
      <Box
        name="ChuteOpening"
        size={[0.52, 0.025, 0.3]}
        position={MACHINE.chute.openingPosition}
        color={MATERIALS.rubberDark}
        roughness={0.72}
      />
      <Box
        name="TopRail"
        size={[2.55, 0.08, 0.12]}
        position={[0, 3.34, 0.05]}
        color={MATERIALS.machineEdge}
        metalness={0.82}
        roughness={0.26}
      />
    </group>
  )
}

function ClawFinger({ index }: { index: number }) {
  const angle = FINGER_RIG.angles[index]
  const pivotName = PIVOT_NAMES[index]
  const pivotPosition = DEFAULT_CLAW_RIG.baseline[pivotName].position
  return (
    <group
      name={`FingerPivot_${index}`}
      position={pivotPosition}
      rotation={[0, -angle, 0]}
      userData={{ baseline: 0, pose: 'home' }}
    >
      {/* N22: no static tilt — the old [0.25, 0, 0] leaned every blade
          tangentially (the pinwheel look). Blades now hang straight and the
          rig's tangential-axis articulation (N17) sweeps them radially. */}
      <group name={`FingerMesh_${index}`}>
        <group name={`FingerBladeJoint_${index}`}>
          <Box
            name={`FingerBlade_${index}`}
            size={FINGER_RIG.blade.visual.size}
            position={FINGER_RIG.blade.visualCenter}
            color={MATERIALS.clawSteel}
            metalness={0.92}
            roughness={0.24}
          />
        </group>
        {/* Hook cylinder axis runs radially (local X) so the tip curls
            inward toward the prize, matching the approved design. */}
        <group name={`FingerHookJoint_${index}`}>
          <Cylinder
            name={`FingerHook_${index}`}
            radius={FINGER_RIG.hook.visual.radius}
            height={FINGER_RIG.hook.visual.height}
            position={FINGER_RIG.hook.visualCenter}
            rotation={FINGER_RIG.hook.rotation}
            color={MATERIALS.clawSteel}
            metalness={0.92}
            roughness={0.24}
          />
        </group>
      </group>
    </group>
  )
}

function ClawSystem() {
  return (
    <group name="ClawSystem" position={CLAW.homeHeadCenter}>
      <group name="ClawPhysicsRoot" userData={{ adapterBoundary: true }} />
      <group
        name="ClawVisualRoot"
        userData={{ authoredEnvelope: CLAW.visualEnvelope, pose: 'home' }}
      >
        <group name="Carriage" position={CLAW.carriage.position}>
          <Box
            name="CarriageBody"
            size={CLAW.carriage.size}
            color={MATERIALS.machineGraphite}
            metalness={0.78}
            roughness={0.34}
          />
          <Box
            name="CarriageCyanStripe"
            size={[0.42, 0.035, 0.43]}
            position={[0, -0.02, 0]}
            color={MATERIALS.clawCyanAccent}
            metalness={0.55}
            roughness={0.2}
          />
        </group>
        <Cylinder
          name="Cable"
          radius={0.035}
          height={0.45}
          position={[0, 0.26, 0]}
          color={MATERIALS.rubberDark}
          roughness={0.72}
        />
        <group name="HeadRoot" position={[0, 0, 0]}>
          <Cylinder
            name="HeadMesh"
            radius={CLAW.headRadius}
            height={0.28}
            rotation={[Math.PI / 2, 0, 0]}
            color={MATERIALS.clawSteel}
            metalness={0.92}
            roughness={0.24}
          />
          <Cylinder
            name="HeadAccentRing"
            radius={CLAW.headAccentRadius}
            height={0.02}
            position={[0, 0.15, 0]}
            color={MATERIALS.clawCyanAccent}
            metalness={0.55}
            roughness={0.2}
          />
          <group
            name="GripCenter"
            position={CLAW.gripCenter}
            userData={{ logicalMarker: true }}
          >
            <mesh name="GripCenterMarker" visible={false}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshBasicMaterial color={MATERIALS.clawCyanAccent} />
            </mesh>
          </group>
          <group name="FingerRig">
            {FINGER_RIG.angles.map((_, index) => (
              <ClawFinger key={index} index={index} />
            ))}
          </group>
        </group>
        <group name="ClawDebugRoot" visible={false} />
      </group>
    </group>
  )
}

function MachineRoot() {
  return (
    <group name="MachineRoot" userData={{ authoredEnvelope: MACHINE.envelope }}>
      <MachineVisuals />
      <group
        name="MachineCollisionProxies"
        visible={false}
        userData={{ reservedForPhysics: true }}
      />
      <group
        name="ClawMount"
        userData={{ envelope: CLAW.mountEnvelope, home: CLAW.homeHeadCenter }}
      >
        <ClawSystem />
      </group>
    </group>
  )
}

function PrizeRoot({
  id = 'prize',
  position = [0, 1.2, 0],
  geometry = 'sphere',
}: {
  readonly id?: string
  readonly position?: readonly [number, number, number]
  readonly geometry?: (typeof DEFAULT_PRIZE_MANIFEST.prizes)[number]['geometry']
}) {
  const isPouch = geometry === 'soft-pouch'
  const packaging = geometry === 'tag' || geometry === 'strap' || geometry === 'loop'
  return (
    <group name={id === 'prize' ? 'PrizeRoot' : `PrizeRoot-${id}`} position={position} userData={{ geometry }}>
      {isPouch ? (
        <Box name="PrizeBody" size={[0.42, 0.5, 0.28]} color={MATERIALS.prizeIvory} roughness={0.6} />
      ) : (
        <mesh name="PrizeBody" castShadow>
          {geometry === 'box' ? <boxGeometry args={[0.44, 0.44, 0.44]} /> : <sphereGeometry args={[0.22, 24, 16]} />}
          <meshStandardMaterial color={MATERIALS.prizeIvory} roughness={0.3} metalness={0.05} />
        </mesh>
      )}
      {packaging ? (
        <group name={`Prize${geometry[0].toUpperCase()}${geometry.slice(1)}`} position={[0, 0.24, 0]}>
          {geometry === 'tag' ? (
            <Box name="PrizeTag" size={[0.16, 0.12, 0.03]} color={MATERIALS.clawCyanAccent} roughness={0.2} />
          ) : (
            <mesh name="PrizeStrap" castShadow>
              <torusGeometry args={[0.12, 0.025, 8, 20]} />
              <meshStandardMaterial color={MATERIALS.clawCyanAccent} metalness={0.2} roughness={0.35} />
            </mesh>
          )}
        </group>
      ) : (
        <Box name="PrizeBand" size={[0.36, 0.06, 0.36]} position={[0, 0, 0]} color={MATERIALS.clawCyanAccent} roughness={0.2} />
      )}
    </group>
  )
}

function PlayfieldRoot() {
  return (
    <group name="PlayfieldRoot">
      <Box
        name="FloorReveal"
        size={[8, 0.08, 6]}
        position={[0, -0.08, 0]}
        color="#11171A"
        roughness={0.8}
      />
    </group>
  )
}

export function StaticScene() {
  return (
    <group name="SceneRoot">
      <LightingRoot />
      <CameraRig />
      <MachineRoot />
      {DEFAULT_PRIZE_MANIFEST.prizes.map((prize) => (
        <PrizeRoot
          key={prize.id}
          id={prize.id}
          position={prize.position}
          geometry={prize.geometry}
        />
      ))}
      <PlayfieldRoot />
      <group name="DebugRoot" visible={false} userData={{ readOnly: true }} />
    </group>
  )
}
