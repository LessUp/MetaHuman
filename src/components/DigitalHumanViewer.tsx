import React, { useRef, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useDigitalHumanStore } from '../store/digitalHumanStore';

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
  const [isLoaded, setIsLoaded] = useState(false);
  const {
    currentExpression,
    currentEmotion,
    currentAnimation,
    isPlaying,
    isSpeaking,
  } = useDigitalHumanStore((state) => ({
    currentExpression: state.currentExpression,
    currentEmotion: state.currentEmotion,
    currentAnimation: state.currentAnimation,
    isPlaying: state.isPlaying,
    isSpeaking: state.isSpeaking,
  }));

  // 使用默认的立方体作为数字人模型占位符
  // 在实际应用中，这里应该加载真实的3D模型文件
  useEffect(() => {
    console.log('DigitalHumanModel useEffect触发，onModelLoad:', typeof onModelLoad);

    if (meshRef.current && typeof meshRef.current.add === 'function') {
      console.log('开始创建数字人模型...');

      const bodyGeometry = new THREE.BoxGeometry(1, 2, 0.5);
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x4f46e5,
        metalness: 0.3,
        roughness: 0.4,
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

      const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.2,
        roughness: 0.6,
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 1.3;

      const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.1, 1.4, 0.25);

      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.1, 1.4, 0.25);

      const armGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
      const armMaterial = new THREE.MeshStandardMaterial({
        color: 0x4f46e5,
        metalness: 0.3,
        roughness: 0.4,
      });
      const leftArm = new THREE.Mesh(armGeometry, armMaterial);
      leftArm.position.set(-0.7, 0.3, 0);

      const rightArm = new THREE.Mesh(armGeometry, armMaterial);
      rightArm.position.set(0.7, 0.3, 0);

      meshRef.current.add(body);
      meshRef.current.add(head);
      meshRef.current.add(leftEye);
      meshRef.current.add(rightEye);
      meshRef.current.add(leftArm);
      meshRef.current.add(rightArm);

      (meshRef.current as any).userData = {
        body,
        head,
        leftEye,
        rightEye,
        leftArm,
        rightArm,
      };

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

  // 根据 store 中的状态驱动简单动画和表情
  useFrame((state) => {
    const group = meshRef.current;
    if (!group) return;

    const { body, head, leftArm, rightArm } = (group as any).userData || {};
    const t = state.clock.elapsedTime;

    // 基础重置
    if (head) {
      head.rotation.set(0, 0, 0);
      head.position.y = 1.3;
      head.scale.set(1, 1, 1);
    }
    if (body) {
      body.scale.set(1, 2, 0.5);
    }
    if (leftArm && rightArm) {
      leftArm.rotation.set(0, 0, 0);
      rightArm.rotation.set(0, 0, 0);
    }

    // 表情：用简单的头部形变和姿态模拟
    if (head) {
      switch (currentExpression) {
        case 'smile':
          head.scale.set(1.05, 1.05, 1.05);
          break;
        case 'laugh':
          head.scale.set(1.1, 1.1, 1.1);
          break;
        case 'surprise':
          head.scale.set(1.1, 1.1, 1.1);
          head.position.y = 1.35;
          break;
        case 'sad':
          head.scale.set(0.95, 0.9, 0.95);
          head.position.y = 1.25;
          break;
        case 'angry':
          head.rotation.z = 0.1;
          break;
        default:
          break;
      }
    }

    // 未播放时，仅保持静态表情
    if (!isPlaying) {
      return;
    }

    // 全局轻微摇摆 + 呼吸
    group.rotation.y = Math.sin(t * 0.5) * 0.1;
    if (body) {
      body.scale.y = 2 + Math.sin(t * 2) * 0.05;
    }

    // 头部相关动作
    if (head) {
      if (currentAnimation === 'nod') {
        head.rotation.x = Math.sin(t * 4) * 0.4;
      } else if (currentAnimation === 'shakeHead') {
        head.rotation.y = Math.sin(t * 4) * 0.4;
      } else if (currentAnimation === 'listening') {
        head.rotation.z = Math.sin(t * 1.5) * 0.1;
      } else if (currentAnimation === 'thinking') {
        head.rotation.x = -0.2 + Math.sin(t * 1.5) * 0.05;
      } else if (currentAnimation === 'speaking') {
        head.rotation.x = Math.sin(t * 6) * 0.1;
      }
    }

    // 手臂相关动作：举手 / 挥手 / 兴奋
    if (leftArm && rightArm) {
      if (currentAnimation === 'raiseHand') {
        rightArm.rotation.x = -Math.PI / 3;
      } else if (currentAnimation === 'waveHand' || currentAnimation === 'greeting') {
        rightArm.rotation.x = -Math.PI / 3;
        rightArm.rotation.z = Math.sin(t * 6) * 0.6;
      } else if (currentAnimation === 'excited') {
        leftArm.rotation.x = -Math.PI / 3 + Math.sin(t * 8) * 0.4;
        rightArm.rotation.x = -Math.PI / 3 + Math.cos(t * 8) * 0.4;
      }
    }

    // 说话时头部轻微点动
    if (isSpeaking && head) {
      head.rotation.x += Math.sin(t * 8) * 0.05;
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