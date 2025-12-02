import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, Sparkles, ContactShadows, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { useDigitalHumanStore } from '../store/digitalHumanStore';

interface DigitalHumanViewerProps {
  modelUrl?: string;
  autoRotate?: boolean;
  showControls?: boolean;
  onModelLoad?: (model: any) => void;
}

// --- Procedural Cyber Avatar Component ---
function CyberAvatar() {
  const group = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);
  
  const {
    currentExpression,
    isSpeaking,
    currentAnimation,
    expressionIntensity
  } = useDigitalHumanStore();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const intensity = expressionIntensity ?? 1;

    // Idle Floating Logic is handled by <Float>, we handle specific animations here
    
    if (group.current) {
      // Subtle breathing/idle motion for the whole group if not handled by Float
    }

    // Head movement based on animation state
    if (group.current) {
      if (currentAnimation === 'nod') {
        group.current.rotation.x = Math.sin(t * 5) * 0.2;
      } else if (currentAnimation === 'shakeHead') {
        group.current.rotation.y = Math.sin(t * 5) * 0.3;
      }
    }

    // Speaking Animation (Jaw/Head Bob)
    if (isSpeaking && headRef.current) {
      headRef.current.rotation.x = Math.sin(t * 15) * 0.05;
    }

    // Expressions
    if (leftEyeRef.current?.scale && rightEyeRef.current?.scale) {
      let scaleY = 1;

      // Blink Logic
      const blink = Math.sin(t * 3);
      if (blink > 0.98 || currentExpression === 'blink') {
        scaleY = 0.1;
      }

      // Emotional Logic
      if (currentExpression === 'smile') {
        scaleY = 0.5; // Happy eyes (squint)
      } else if (currentExpression === 'surprise') {
        scaleY = 1.3; // Wide eyes
      }

      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, scaleY, 0.2);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, scaleY, 0.2);
    }

    // Rings Animation (Enhanced for Motion)
    if (ringsRef.current?.rotation) {
      let ringSpeed = 0.2;
      let ringTilt = 0;
      let ringWobble = 0;

      if (currentAnimation === 'waveHand') {
        ringSpeed = 2.0;
        ringWobble = 0.5;
      } else if (currentAnimation === 'raiseHand') {
        ringTilt = Math.PI / 6;
        ringSpeed = 0.5;
      } else if (currentAnimation === 'excited') {
        ringSpeed = 3.0;
      }

      ringsRef.current.rotation.y += ringSpeed * 0.05; // Accumulate rotation
      ringsRef.current.rotation.z = Math.sin(t * 0.5 + ringSpeed) * 0.1 + Math.sin(t * 10) * ringWobble;
      ringsRef.current.rotation.x = THREE.MathUtils.lerp(ringsRef.current.rotation.x, ringTilt, 0.1);
    }
  });

  return (
    <group ref={group}>
      {/* Floating Container */}
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        
        {/* --- HEAD --- */}
        <mesh ref={headRef} position={[0, 0, 0]} castShadow receiveShadow>
          {/* Main Head Shape - A smooth capsule/sphere hybrid */}
          <sphereGeometry args={[0.8, 64, 64]} />
          <meshPhysicalMaterial
            color="#e2e8f0"
            metalness={0.6}
            roughness={0.2}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>

        {/* --- EYES --- */}
        <group position={[0, 0.1, 0.75]}>
          <mesh ref={leftEyeRef} position={[-0.25, 0, 0]}>
            <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
            <meshStandardMaterial
              color="#0ea5e9"
              emissive="#0ea5e9"
              emissiveIntensity={2}
              toneMapped={false}
            />
            <meshBasicMaterial color="#000" /> {/* Black backing */}
          </mesh>
          <mesh ref={rightEyeRef} position={[0.25, 0, 0]}>
            <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
            <meshStandardMaterial
              color="#0ea5e9"
              emissive="#0ea5e9"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
          {/* Eye Glow Spheres (Pupils) */}
          <mesh position={[-0.25, 0, 0.05]} scale={[1, 0.1, 1]}>
             <sphereGeometry args={[0.09, 16, 16]} />
             <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={4} />
          </mesh>
          <mesh position={[0.25, 0, 0.05]} scale={[1, 0.1, 1]}>
             <sphereGeometry args={[0.09, 16, 16]} />
             <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={4} />
          </mesh>
        </group>

        {/* --- NECK / BASE --- */}
        <mesh position={[0, -1, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 0.8, 32]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* --- HOLO RINGS --- */}
        <group ref={ringsRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.2, 0.02, 16, 100]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
              wireframe
            />
          </mesh>
          <mesh rotation={[Math.PI / 2.2, 0, 0]}>
            <torusGeometry args={[1.4, 0.01, 16, 100]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
              wireframe
            />
          </mesh>
        </group>

        {/* --- EARS / HEADPHONES --- */}
        <mesh position={[0.8, 0, 0]} rotation={[0, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.2, 0.2, 0.3, 32]} />
           <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.2, 0.2, 0.3, 32]} />
           <meshStandardMaterial color="#475569" />
        </mesh>

      </Float>
    </group>
  );
}

function Scene({ autoRotate, modelScene }: { autoRotate?: boolean; modelScene?: THREE.Group | null }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />
      
      {/* Lighting */}
      <ambientLight intensity={0.5} color="#ffffff" />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#3b82f6" />
      
      {/* Environment Reflections */}
      <Environment preset="city" />
      
      {/* The Avatar */}
      {modelScene ? (
        <primitive object={modelScene} position={[0, -1.2, 0]} />
      ) : (
        <CyberAvatar />
      )}
      
      {/* Particles */}
      <Sparkles count={100} scale={8} size={2} speed={0.4} opacity={0.5} color="#bae6fd" />
      
      {/* Shadows */}
      <ContactShadows resolution={1024} scale={10} blur={2} opacity={0.5} far={10} color="#000000" />

      <OrbitControls 
        enablePan={false} 
        minPolarAngle={Math.PI / 2.5} 
        maxPolarAngle={Math.PI / 1.8}
        enableZoom={true}
        minDistance={3}
        maxDistance={10}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export default function DigitalHumanViewer({
  modelUrl,
  autoRotate = false,
  showControls = true,
  onModelLoad
}: DigitalHumanViewerProps) {
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(modelUrl ? 'idle' : 'ready');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelUrl) {
      setModelScene(null);
      setLoadStatus('ready');
      onModelLoad?.({ type: 'procedural-cyber-avatar' });
      return;
    }

    let cancelled = false;
    const loader = new GLTFLoader();

    setLoadStatus('loading');
    setLoadError(null);

    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        setModelScene(gltf.scene);
        setLoadStatus('ready');
        onModelLoad?.(gltf.scene);
      },
      undefined,
      (error) => {
        if (cancelled) return;
        console.error('模型加载失败', error);
        setModelScene(null);
        setLoadStatus('error');
        setLoadError(error.message);
        onModelLoad?.({ type: 'procedural-fallback', error: error.message });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [modelUrl, onModelLoad]);

  return (
    <div className="w-full h-full bg-transparent space-y-4">
      <Canvas shadows dpr={[1, 2]}>
        {(loadStatus === 'loading' || loadStatus === 'error') && (
          <Html center>
            <div className="px-4 py-2 rounded-xl bg-black/70 text-white text-sm border border-white/10 shadow-lg">
              {loadStatus === 'loading' ? '模型加载中…' : `加载失败，使用内置模型 (${loadError})`}
            </div>
          </Html>
        )}
        <Scene autoRotate={autoRotate} modelScene={modelScene} />
      </Canvas>

      {showControls && (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 space-y-3 text-white">
          <h2 className="text-lg font-semibold">数字人控制</h2>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-white/70">模型状态:</span>
              <span className={loadStatus === 'ready' ? 'text-green-400' : 'text-yellow-300'}>
                {loadStatus === 'ready' ? '已加载' : loadStatus === 'loading' ? '加载中' : '使用内置模型'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70">渲染引擎:</span>
              <span className="text-blue-300">Three.js</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70">自动旋转:</span>
              <span className="text-white">{autoRotate ? '开启' : '关闭'}</span>
            </div>
            {loadError && (
              <div className="text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {loadError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
