import React, { useRef, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

interface DigitalHumanViewerProps {
  modelUrl?: string;
  autoRotate?: boolean;
  showControls?: boolean;
  onModelLoad?: (model: any) => void;
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-600">加载数字人模型中...</p>
      </div>
    </Html>
  );
}

function DigitalHumanModel({ modelUrl, onModelLoad }: { modelUrl?: string; onModelLoad?: (model: any) => void }) {
  const meshRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  const [isLoaded, setIsLoaded] = useState(false);
  
  // 使用默认的立方体作为数字人模型占位符
  // 在实际应用中，这里应该加载真实的3D模型文件
  useEffect(() => {
    console.log('DigitalHumanModel useEffect触发，onModelLoad:', typeof onModelLoad);
    
    if (meshRef.current && typeof meshRef.current.add === 'function') {
      console.log('开始创建数字人模型...');
      
      // 创建基础数字人形状
      const geometry = new THREE.BoxGeometry(1, 2, 0.5);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x4f46e5,
        metalness: 0.3,
        roughness: 0.4
      });
      const mesh = new THREE.Mesh(geometry, material);
      
      // 添加头部
      const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const headMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xfbbf24,
        metalness: 0.2,
        roughness: 0.6
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 1.3;
      
      // 添加眼睛
      const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
      
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.1, 1.4, 0.25);
      
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.1, 1.4, 0.25);
      
      meshRef.current.add(mesh);
      meshRef.current.add(head);
      meshRef.current.add(leftEye);
      meshRef.current.add(rightEye);
      
      console.log('模型创建完成，准备调用onModelLoad...');
      
      // 延迟调用onModelLoad确保组件完全挂载
      setTimeout(() => {
        if (onModelLoad && meshRef.current) {
          console.log('调用onModelLoad回调函数...');
          onModelLoad(meshRef.current);
          console.log('onModelLoad回调函数已调用');
        }
        setIsLoaded(true);
      }, 100);
    }
  }, [onModelLoad]);
  
  // 添加简单的动画效果
  useFrame((state) => {
    if (meshRef.current && typeof meshRef.current.add === 'function') {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      // 头部轻微摆动
      const head = meshRef.current.children[1];
      if (head) {
        head.rotation.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
      }
      
      // 添加呼吸效果
      const body = meshRef.current.children[0];
      if (body) {
        body.scale.y = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      }
    }
  });
  
  return <group ref={meshRef} />;
}

function Scene({ modelUrl, autoRotate, showControls, onModelLoad }: DigitalHumanViewerProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      <DigitalHumanModel modelUrl={modelUrl} onModelLoad={onModelLoad} />
      
      {showControls && <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} autoRotate={autoRotate} />}
      
      {/* 简化环境设置，避免外部资源加载 */}
      <color attach="background" args={['#1a1a2e']} />
      <fog attach="fog" args={['#1a1a2e', 10, 50]} />
      
      {/* 添加网格地板 */}
      <gridHelper args={[10, 10]} position={[0, -1, 0]} />
    </>
  );
}

export default function DigitalHumanViewer({ 
  modelUrl, 
  autoRotate = false, 
  showControls = true, 
  onModelLoad 
}: DigitalHumanViewerProps) {
  console.log('DigitalHumanViewer渲染，onModelLoad:', typeof onModelLoad);
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-700 rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [0, 2, 5], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <Scene 
          modelUrl={modelUrl} 
          autoRotate={autoRotate} 
          showControls={showControls}
          onModelLoad={onModelLoad}
        />
      </Canvas>
      
      {/* 控制面板 */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 rounded-lg p-3 text-white">
        <h3 className="text-sm font-semibold mb-2">数字人控制</h3>
        <div className="space-y-2 text-xs">
          <div>模型状态: <span className="text-green-400">已加载</span></div>
          <div>渲染引擎: <span className="text-blue-400">Three.js</span></div>
          <div>自动旋转: <span className="text-yellow-400">{autoRotate ? '开启' : '关闭'}</span></div>
        </div>
      </div>
    </div>
  );
}