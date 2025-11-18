import React, { useState, useEffect } from 'react';
import DigitalHumanViewer from '../components/DigitalHumanViewer';
import ControlPanel from '../components/ControlPanel';
import VoiceInteractionPanel from '../components/VoiceInteractionPanel';
import ExpressionControlPanel from '../components/ExpressionControlPanel';
import BehaviorControlPanel from '../components/BehaviorControlPanel';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import { ttsService, asrService } from '../core/audio/audioService';
import { digitalHumanEngine } from '../core/avatar/DigitalHumanEngine';
import { sendUserInput } from '../core/dialogue/dialogueService';
import { Toaster, toast } from 'sonner';

export default function AdvancedDigitalHumanPage() {
  const {
    isPlaying,
    isRecording,
    isMuted,
    autoRotate,
    currentExpression,
    currentEmotion,
    isSpeaking,
    setRecording,
    toggleMute,
    toggleAutoRotate
  } = useDigitalHumanStore();

  const [modelLoaded, setModelLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [currentBehavior, setCurrentBehavior] = useState('idle');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: number; role: 'user' | 'assistant'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // 处理模型加载完成
  const handleModelLoad = (model: any) => {
    console.log('数字人模型加载完成:', model);
    setModelLoaded(true);
    toast.success('数字人模型加载成功！');
  };

  // 处理播放/暂停
  const handlePlayPause = () => {
    if (isPlaying) {
      digitalHumanEngine.pause();
      toast.info('数字人暂停');
    } else {
      digitalHumanEngine.play();
      toast.success('数字人开始播放');
    }
  };

  // 处理重置
  const handleReset = () => {
    digitalHumanEngine.reset();
    setCurrentBehavior('idle');
    toast.info('数字人重置到初始状态');
  };

  // 处理对话发送（文本或语音）
  const handleChatSend = async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content) return;

    const userMessage = {
      id: Date.now(),
      role: 'user' as const,
      text: content
    };
    setChatMessages((prev) => [...prev, userMessage]);

    if (!text) {
      setChatInput('');
    }

    setIsChatLoading(true);
    try {
      const res = await sendUserInput({
        userText: content,
        sessionId: 'demo-session'
      });

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant' as const,
        text: res.replyText
      };
      setChatMessages((prev) => [...prev, assistantMessage]);

      if (res.emotion) {
        digitalHumanEngine.setEmotion(res.emotion);
        if (res.emotion === 'happy') {
          digitalHumanEngine.setExpression('smile');
        } else if (res.emotion === 'surprised') {
          digitalHumanEngine.setExpression('surprise');
        } else {
          digitalHumanEngine.setExpression('neutral');
        }
      }

      if (res.action && res.action !== 'idle') {
        digitalHumanEngine.playAnimation(res.action);
      }

      if (res.replyText) {
        ttsService.speak(res.replyText);
      }
    } catch (error) {
      console.error('对话接口调用失败:', error);
      toast.error('对话服务异常，请稍后重试');
    } finally {
      setIsChatLoading(false);
    }
  };

  // 处理录音开关
  const handleToggleRecording = () => {
    if (isRecording) {
      asrService.stop();
      setRecording(false);
      toast.info('录音已停止');
    } else {
      asrService.start();
      toast.success('开始录音');
    }
  };

  // 处理静音开关
  const handleToggleMute = () => {
    toggleMute();
    toast.info(isMuted ? '已取消静音' : '已静音');
  };

  // 处理自动旋转开关
  const handleToggleAutoRotate = () => {
    toggleAutoRotate();
    toast.info(autoRotate ? '自动旋转已关闭' : '自动旋转已开启');
  };

  // 处理语音命令
  const handleVoiceCommand = (command: string) => {
    console.log('执行语音命令:', command);
    
    // 处理基本命令
    switch (command) {
      case '打招呼':
        digitalHumanEngine.setExpression('smile');
        digitalHumanEngine.setEmotion('happy');
        setCurrentBehavior('greeting');
        ttsService.speak('您好！很高兴见到您！');
        toast.success('执行打招呼动作');
        break;
      case '跳舞':
        digitalHumanEngine.setExpression('laugh');
        digitalHumanEngine.setEmotion('excited');
        setCurrentBehavior('excited');
        ttsService.speak('让我为您跳一支舞！');
        toast.success('执行跳舞动作');
        break;
      case '说话':
        digitalHumanEngine.setExpression('speaking');
        setCurrentBehavior('speaking');
        ttsService.speak('我正在说话，有什么可以帮助您的吗？');
        toast.success('执行说话动作');
        break;
      case '表情':
        const expressions = ['smile', 'surprise', 'sad', 'angry'];
        const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];
        digitalHumanEngine.setExpression(randomExpression);
        ttsService.speak(`这是我的${randomExpression}表情！`);
        toast.success(`切换到${randomExpression}表情`);
        break;
      default:
        ttsService.speak(`我没有理解您的指令：${command}`);
        toast.warning(`未识别的命令: ${command}`);
    }
  };

  // 处理语音识别结果
  const handleTranscript = (text: string) => {
    console.log('语音识别结果:', text);
    void handleChatSend(text);
  };

  // 处理语音合成
  const handleSpeak = (text: string) => {
    ttsService.speak(text);
  };

  // 处理表情变化
  const handleExpressionChange = (expression: string, intensity: number) => {
    digitalHumanEngine.setExpression(expression);
    console.log(`表情变化: ${expression}, 强度: ${intensity}`);
    toast.info(`表情切换到: ${expression}`);
  };

  // 处理行为变化
  const handleBehaviorChange = (behavior: string, parameters: any) => {
    setCurrentBehavior(behavior);
    console.log(`行为变化: ${behavior}, 参数:`, parameters);
    toast.info(`行为切换到: ${behavior}`);
  };

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

  const tabs = [
    { id: 'basic', label: '基础控制', icon: '🎮' },
    { id: 'voice', label: '语音交互', icon: '🎤' },
    { id: 'chat', label: '对话', icon: '💬' },
    { id: 'expression', label: '表情控制', icon: '😊' },
    { id: 'behavior', label: '行为控制', icon: '🧠' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Toaster position="top-right" />
      
      {/* 页面标题 */}
      <div className="pt-8 pb-4 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">数字人交互系统</h1>
        <p className="text-xl text-gray-300">基于Web技术的3D虚拟人物交互平台</p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* 3D数字人查看器 */}
          <div className="xl:col-span-3">
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
                    表情: {currentExpression} | 行为: {currentBehavior} | Three.js 渲染引擎
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 控制面板 */}
          <div className="xl:col-span-1">
            {/* 标签页导航 */}
            <div className="bg-white rounded-lg shadow-lg mb-6">
              <div className="flex border-b">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 标签页内容 */}
            <div className="space-y-6">
              {activeTab === 'basic' && (
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
              )}
              
              {activeTab === 'voice' && (
                <VoiceInteractionPanel
                  onTranscript={handleTranscript}
                  onSpeak={handleSpeak}
                />
              )}
              
              {activeTab === 'chat' && (
                <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
                  <div className="h-48 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    {chatMessages.length === 0 && (
                      <div className="text-gray-400 text-center">暂无对话，先输入点什么吧。</div>
                    )}
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-800'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex space-x-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleChatSend();
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="输入要对数字人说的话..."
                    />
                    <button
                      onClick={() => void handleChatSend()}
                      disabled={isChatLoading}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm transition-colors"
                    >
                      {isChatLoading ? '发送中...' : '发送'}
                    </button>
                  </div>
                </div>
              )}
              
              {activeTab === 'expression' && (
                <ExpressionControlPanel
                  currentExpression={currentExpression}
                  onExpressionChange={handleExpressionChange}
                />
              )}
              
              {activeTab === 'behavior' && (
                <BehaviorControlPanel
                  currentBehavior={currentBehavior}
                  onBehaviorChange={handleBehaviorChange}
                />
              )}
            </div>

            {/* 功能说明 */}
            <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">系统特性</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <h4 className="font-medium text-gray-700">🎮 基础控制</h4>
                  <p>播放控制、自动旋转、模型重置等基础功能</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">🎤 语音交互</h4>
                  <p>集成Web Speech API，支持语音识别和语音合成</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">😊 表情控制</h4>
                  <p>丰富的面部表情控制，支持强度调节和自定义</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">🧠 行为控制</h4>
                  <p>AI驱动的行为决策系统，支持自动模式和手动控制</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}