import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
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
        color="#8FA9B0"
        intensity={0.25}
      />
      <directionalLight
        name="KeyLight"
        color={LIGHTS.key.color}
        intensity={LIGHTS.key.intensity}
        position={LIGHTS.key.position}
        castShadow
        shadow-mapSize={[1024, 1024]}
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
        position={[1.05, 0.78, 1.03]}
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

function ClawFinger({ index, angle }: { index: number; angle: number }) {
  const x = Math.cos(angle) * CLAW.fingerPivotRadius
  const z = Math.sin(angle) * CLAW.fingerPivotRadius
  return (
    <group
      name={`FingerPivot_${index}`}
      position={[x, -0.05, z]}
      rotation={[0, -angle, 0]}
      userData={{ baseline: 0, pose: 'home' }}
    >
      <group name={`FingerMesh_${index}`} rotation={[0.25, 0, 0]}>
        <Box
          name={`FingerBlade_${index}`}
          size={[0.1, CLAW.fingerLength, 0.12]}
          position={[0, -CLAW.fingerLength / 2, 0]}
          color={MATERIALS.clawSteel}
          metalness={0.92}
          roughness={0.24}
        />
        <Cylinder
          name={`FingerHook_${index}`}
          radius={0.065}
          height={0.16}
          position={[0, -CLAW.fingerLength, 0.035]}
          rotation={[Math.PI / 2, 0, 0]}
          color={MATERIALS.clawSteel}
          metalness={0.92}
          roughness={0.24}
        />
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
            radius={0.22}
            height={0.28}
            rotation={[Math.PI / 2, 0, 0]}
            color={MATERIALS.clawSteel}
            metalness={0.92}
            roughness={0.24}
          />
          <Cylinder
            name="HeadAccentRing"
            radius={0.1}
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
            {[0, 1, 2].map((index) => (
              <ClawFinger
                key={index}
                index={index}
                angle={(index * Math.PI * 2) / 3}
              />
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

function PrizeRoot() {
  return (
    <group name="PrizeRoot" position={[0, 1.2, 0]}>
      <mesh name="PrizeBody" castShadow>
        <sphereGeometry args={[0.31, 24, 16]} />
        <meshStandardMaterial
          color={MATERIALS.prizeIvory}
          roughness={0.3}
          metalness={0.05}
        />
      </mesh>
      <Box
        name="PrizeBand"
        size={[0.5, 0.07, 0.5]}
        position={[0, 0, 0]}
        color={MATERIALS.clawCyanAccent}
        roughness={0.2}
      />
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
      <PrizeRoot />
      <PlayfieldRoot />
      <group name="DebugRoot" visible={false} userData={{ readOnly: true }} />
    </group>
  )
}
