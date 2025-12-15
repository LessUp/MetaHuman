import React, { useEffect, useState } from 'react';
import DigitalHumanViewer from '../components/DigitalHumanViewer';
import ControlPanel from '../components/ControlPanel';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import { ttsService, asrService } from '../core/audio/audioService';
import { digitalHumanEngine } from '../core/avatar/DigitalHumanEngine';
import { Toaster, toast } from 'sonner';

export default function DigitalHumanPage() {
  const {
    isPlaying,
    isRecording,
    isMuted,
    autoRotate,
    isSpeaking,
    setRecording,
    toggleMute,
    toggleAutoRotate
  } = useDigitalHumanStore();

  const [modelLoaded, setModelLoaded] = useState(false);

  // 处理模型加载完成
  const handleModelLoad = (model: unknown) => {
    console.log('数字人模型加载完成:', model);
    console.log('当前modelLoaded状态:', modelLoaded);
    
    // 使用函数式更新确保状态正确更新
    setModelLoaded(prevState => {
      console.log('从状态', prevState, '更新到', true);
      return true;
    });
    
    console.log('状态更新已调用，检查UI是否刷新...');
  };

  // 监听modelLoaded状态变化
  useEffect(() => {
    console.log('modelLoaded状态已更新为:', modelLoaded);
  }, [modelLoaded]);

  // 添加一个测试按钮来手动触发状态更新
  const testStateUpdate = () => {
    console.log('手动测试状态更新');
    setModelLoaded(prev => !prev);
  };

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
  const handleVoiceCommand = (command: string) => {
    console.log('执行语音命令:', command);
    
    // 立即显示点击反馈
    alert(`点击了: ${command}`);
    
    // 检查浏览器是否支持语音合成
    if (!('speechSynthesis' in window)) {
      console.error('浏览器不支持语音合成');
      toast.error('浏览器不支持语音合成功能');
      return;
    }
    
    // 添加视觉反馈
    const message = `正在执行命令：${command}`;
    console.log('TTS消息:', message);
    
    // 显示toast通知
    toast.success(`执行命令: ${command}`);
    
    // 语音命令处理已经在ASRService中实现
    try {
      // 添加延迟以确保用户交互被正确识别
      setTimeout(() => {
        ttsService.speak(message);
        console.log('TTS命令发送成功');
      }, 100);
    } catch (error) {
      console.error('TTS执行失败:', error);
      toast.error('语音合成失败');
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      const { isRecording: recording, isSpeaking: speaking } = useDigitalHumanStore.getState();
      if (recording) {
        asrService.stop();
      }
      if (speaking) {
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
                  
                  {/* 测试按钮 */}
                  <button 
                    onClick={testStateUpdate}
                    className="ml-4 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  >
                    测试状态
                  </button>
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