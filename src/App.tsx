import { Canvas } from '@react-three/fiber'

function BootstrapScene() {
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 3, 4]} intensity={2} />
      <mesh rotation={[0.25, 0.5, 0]}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial color="#7dd3fc" />
      </mesh>
    </>
  )
}

export default function App() {
  return (
    <main className="app-shell">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <BootstrapScene />
      </Canvas>
    </main>
  )
}
