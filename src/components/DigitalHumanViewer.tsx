import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, Sparkles, ContactShadows, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { useDigitalHumanStore } from '../store/digitalHumanStore';

// 模型缓存
const modelCache = new Map<string, THREE.Group>();

// FPS 监控组件
function FPSMonitor({ onFPSUpdate }: { onFPSUpdate?: (fps: number) => void }) {
  const frameTimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const { updatePerformanceMetrics } = useDigitalHumanStore.getState();

  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    frameTimesRef.current.push(now);

    // 保持最近 60 帧的时间
    while (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    // 每 500ms 更新一次 FPS
    if (now - lastUpdateRef.current > 500 && frameTimesRef.current.length > 1) {
      const times = frameTimesRef.current;
      const totalTime = times[times.length - 1] - times[0];
      const fps = totalTime > 0 ? Math.round((times.length - 1) / (totalTime / 1000)) : 0;

      updatePerformanceMetrics({ fps, lastFrameTime: now });
      onFPSUpdate?.(fps);
      lastUpdateRef.current = now;
    }
  });

  return null;
}

// 页面可见性优化组件
function VisibilityOptimizer({
  onVisibilityChange
}: {
  autoRotate: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      onVisibilityChange?.(isVisible);

      if (!isVisible) {
        // 页面隐藏时降低渲染频率
        gl.setAnimationLoop(null);
      } else {
        // 页面显示时恢复渲染
        gl.setAnimationLoop(() => gl.render(gl.domElement as any, {} as any));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gl, onVisibilityChange]);

  return null;
}

interface DigitalHumanViewerProps {
  modelUrl?: string;
  autoRotate?: boolean;
  showControls?: boolean;
  showFPS?: boolean;
  onModelLoad?: (model: unknown) => void;
  onFPSUpdate?: (fps: number) => void;
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
    const intensity = Math.max(0, Math.min(1, expressionIntensity ?? 1));

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
      const baseScaleY = 1;
      let targetScaleY = baseScaleY;

      // Blink Logic
      const blink = Math.sin(t * 3);
      const isBlinking = blink > 0.98 || currentExpression === 'blink';

      // Emotional Logic
      if (currentExpression === 'smile') {
        targetScaleY = 0.5; // Happy eyes (squint)
      } else if (currentExpression === 'surprise') {
        targetScaleY = 1.3; // Wide eyes
      }

      const scaleY = isBlinking ? 0.1 : THREE.MathUtils.lerp(baseScaleY, targetScaleY, intensity);

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
        <mesh position={[0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 32]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 32]} />
          <meshStandardMaterial color="#475569" />
        </mesh>

      </Float>
    </group>
  );
}

function Scene({
  autoRotate,
  modelScene,
  onFPSUpdate
}: {
  autoRotate?: boolean;
  modelScene?: THREE.Group | null;
  onFPSUpdate?: (fps: number) => void;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />

      {/* FPS 监控 */}
      <FPSMonitor onFPSUpdate={onFPSUpdate} />

      {/* 页面可见性优化 */}
      <VisibilityOptimizer autoRotate={autoRotate ?? false} />

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
  showFPS = false,
  onModelLoad,
  onFPSUpdate
}: DigitalHumanViewerProps) {
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(modelUrl ? 'idle' : 'ready');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [currentFPS, setCurrentFPS] = useState<number>(0);

  // 处理 FPS 更新
  const handleFPSUpdate = useCallback((fps: number) => {
    setCurrentFPS(fps);
    onFPSUpdate?.(fps);
  }, [onFPSUpdate]);

  useEffect(() => {
    if (!modelUrl) {
      setModelScene(null);
      setLoadStatus('ready');
      onModelLoad?.({ type: 'procedural-cyber-avatar' });
      return;
    }

    // 检查缓存
    const cachedModel = modelCache.get(modelUrl);
    if (cachedModel) {
      setModelScene(cachedModel.clone());
      setLoadStatus('ready');
      onModelLoad?.({ type: 'cached-model', url: modelUrl });
      return;
    }

    let cancelled = false;
    const loader = new GLTFLoader();

    setLoadStatus('loading');
    setLoadError(null);
    setLoadProgress(0);

    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        // 缓存模型
        modelCache.set(modelUrl, gltf.scene.clone());
        setModelScene(gltf.scene);
        setLoadStatus('ready');
        setLoadProgress(100);
        onModelLoad?.(gltf.scene);
      },
      (progress) => {
        if (cancelled) return;
        if (progress.total > 0) {
          setLoadProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
      (error) => {
        if (cancelled) return;
        console.error('模型加载失败', error);
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error && 'message' in error
              ? String((error as { message: unknown }).message)
              : '未知错误';
        setModelScene(null);
        setLoadStatus('error');
        setLoadError(message);
        onModelLoad?.({ type: 'procedural-fallback', error: message });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [modelUrl, onModelLoad]);

  return (
    <div className="w-full h-full bg-transparent space-y-4 relative">
      {/* FPS 显示 */}
      {showFPS && (
        <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded bg-black/50 text-white text-xs font-mono">
          {currentFPS} FPS
          {currentFPS < 30 && <span className="text-yellow-400 ml-1">⚠</span>}
        </div>
      )}

      <Canvas shadows dpr={[1, 2]}>
        {(loadStatus === 'loading' || loadStatus === 'error') && (
          <Html center>
            <div className="px-4 py-2 rounded-xl bg-black/70 text-white text-sm border border-white/10 shadow-lg">
              {loadStatus === 'loading'
                ? `模型加载中… ${loadProgress}%`
                : `加载失败，使用内置模型 (${loadError})`}
            </div>
          </Html>
        )}
        <Scene autoRotate={autoRotate} modelScene={modelScene} onFPSUpdate={handleFPSUpdate} />
      </Canvas>

      {showControls && (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 space-y-3 text-white">
          <h2 className="text-lg font-semibold">数字人控制</h2>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-white/70">模型状态:</span>
              <span className={loadStatus === 'ready' ? 'text-green-400' : 'text-yellow-300'}>
                {loadStatus === 'ready' ? '已加载' : loadStatus === 'loading' ? `加载中 ${loadProgress}%` : '使用内置模型'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70">渲染引擎:</span>
              <span className="text-blue-300">Three.js</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70">帧率:</span>
              <span className={currentFPS >= 30 ? 'text-green-400' : 'text-yellow-400'}>
                {currentFPS} FPS
              </span>
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