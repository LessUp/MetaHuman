import React, { useEffect, useState, useCallback } from 'react';
import DigitalHumanViewer from '../components/DigitalHumanViewer';
import ControlPanel from '../components/ControlPanel';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import { ttsService, asrService } from '../core/audio/audioService';
import { digitalHumanEngine } from '../core/avatar/DigitalHumanEngine';
import { Toaster, toast } from 'sonner';
import { Wifi, WifiOff } from 'lucide-react';

export default function DigitalHumanPage() {
  const {
    isPlaying,
    isRecording,
    isMuted,
    autoRotate,
    isSpeaking,
    connectionStatus,
    currentBehavior,
    setRecording,
    toggleMute,
    toggleAutoRotate
  } = useDigitalHumanStore();

  const [modelLoaded, setModelLoaded] = useState(false);

  // 处理模型加载完成
  const handleModelLoad = useCallback((model: any) => {
    setModelLoaded(true);
    toast.success('数字人模型加载完成');
  }, []);

  // 处理播放/暂停
  const handlePlayPause = () => {
    if (isPlaying) {
      digitalHumanEngine.pause();
    } else {
      digitalHumanEngine.play();
    }
  };

  // 处理重置
  const handleReset = () => {
    digitalHumanEngine.reset();
  };

  // 处理录音开关
  const handleToggleRecording = () => {
    if (isRecording) {
      asrService.stop();
      setRecording(false);
    } else {
      asrService.start();
    }
  };

  // 处理静音开关
  const handleToggleMute = () => {
    toggleMute();
  };

  // 处理自动旋转开关
  const handleToggleAutoRotate = () => {
    toggleAutoRotate();
  };

  // 处理语音命令
  const handleVoiceCommand = useCallback((command: string) => {
    toast.success(`执行命令: ${command}`);
    
    // 根据命令执行不同操作
    switch (command) {
      case '打招呼':
        asrService.performGreeting();
        break;
      case '跳舞':
        asrService.performDance();
        break;
      case '说话':
        ttsService.speak('您好！有什么可以帮助您的吗？');
        break;
      case '表情':
        const expressions = ['smile', 'surprise', 'laugh'];
        const randomExpr = expressions[Math.floor(Math.random() * expressions.length)];
        digitalHumanEngine.setExpression(randomExpr);
        setTimeout(() => digitalHumanEngine.setExpression('neutral'), 3000);
        break;
      default:
        ttsService.speak(`收到命令: ${command}`);
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (isRecording) {
        asrService.stop();
      }
      if (isSpeaking) {
        ttsService.stop();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Toaster position="top-right" />
      
      {/* 页面标题 */}
      <div className="pt-8 pb-4 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">数字人交互系统</h1>
        <p className="text-xl text-gray-300">基于Web技术的3D虚拟人物交互平台</p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 3D数字人查看器 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden">
              <div className="h-96 lg:h-[600px]">
                <DigitalHumanViewer
                  modelUrl="/models/digital-human.glb"
                  autoRotate={autoRotate}
                  showControls={true}
                  onModelLoad={handleModelLoad}
                />
              </div>
              
              {/* 状态栏 */}
              <div className="bg-gray-50 px-6 py-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${modelLoaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm text-gray-600">
                        {modelLoaded ? '模型已加载' : '模型加载中...'}
                      </span>
                    </div>
                    
                    {isSpeaking && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-blue-600">正在说话</span>
                      </div>
                    )}
                    
                    {isRecording && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-red-600">录音中</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Three.js 渲染引擎 | WebGL
                  </div>
                  
                  {/* 连接状态 */}
                  <div className="flex items-center space-x-1">
                    {connectionStatus === 'connected' ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 控制面板 */}
          <div className="lg:col-span-1">
            <ControlPanel
              isPlaying={isPlaying}
              isRecording={isRecording}
              isMuted={isMuted}
              autoRotate={autoRotate}
              onPlayPause={handlePlayPause}
              onReset={handleReset}
              onToggleRecording={handleToggleRecording}
              onToggleMute={handleToggleMute}
              onToggleAutoRotate={handleToggleAutoRotate}
              onVoiceCommand={handleVoiceCommand}
            />
            
            {/* 功能说明 */}
            <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">功能说明</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <h4 className="font-medium text-gray-700">3D渲染</h4>
                  <p>基于Three.js的实时3D渲染，支持模型加载和动画播放</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">语音交互</h4>
                  <p>集成Web Speech API，支持语音识别和语音合成</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">行为控制</h4>
                  <p>支持表情控制、动作序列和情感状态管理</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">多平台支持</h4>
                  <p>基于Web技术，支持PC、移动端和AR/VR设备</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}