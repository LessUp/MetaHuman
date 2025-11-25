import { create } from 'zustand';

// 表情类型定义
export type EmotionType = 'neutral' | 'happy' | 'surprised' | 'sad' | 'angry';
export type ExpressionType = 'neutral' | 'smile' | 'laugh' | 'surprise' | 'sad' | 'angry' | 'blink' | 'eyebrow_raise' | 'eye_blink' | 'mouth_open' | 'head_nod';
export type BehaviorType = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking' | 'excited' | 'wave' | 'greet' | 'think' | 'nod' | 'shakeHead' | 'dance' | 'speak' | 'waveHand' | 'raiseHand';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface DigitalHumanState {
  // 模型状态
  isPlaying: boolean;
  autoRotate: boolean;
  currentAnimation: string;
  
  // 语音状态
  isRecording: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  
  // 行为状态
  currentEmotion: EmotionType;
  currentExpression: ExpressionType;
  expressionIntensity: number;
  currentBehavior: BehaviorType;
  
  // 会话状态
  sessionId: string;
  chatHistory: { id: number; role: 'user' | 'assistant'; text: string; timestamp: number }[];
  
  // 系统状态
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  error: string | null;
  lastErrorTime: number | null;
  
  // 动作
  setPlaying: (playing: boolean) => void;
  setAutoRotate: (rotate: boolean) => void;
  setAnimation: (animation: string) => void;
  setRecording: (recording: boolean) => void;
  setMuted: (muted: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setEmotion: (emotion: EmotionType) => void;
  setExpression: (expression: ExpressionType) => void;
  setExpressionIntensity: (intensity: number) => void;
  setBehavior: (behavior: BehaviorType) => void;
  setConnected: (connected: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // 会话管理
  initSession: () => void;
  addChatMessage: (role: 'user' | 'assistant', text: string) => void;
  clearChatHistory: () => void;
  
  // 控制方法
  play: () => void;
  pause: () => void;
  reset: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  toggleMute: () => void;
  toggleAutoRotate: () => void;
}

// 生成唯一会话ID
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// 从 localStorage 获取或创建会话ID
const getOrCreateSessionId = (): string => {
  const stored = localStorage.getItem('metahuman_session_id');
  if (stored) return stored;
  const newId = generateSessionId();
  localStorage.setItem('metahuman_session_id', newId);
  return newId;
};

export const useDigitalHumanStore = create<DigitalHumanState>((set, get) => ({
  // 初始状态
  isPlaying: false,
  autoRotate: false,
  currentAnimation: 'idle',
  isRecording: false,
  isMuted: false,
  isSpeaking: false,
  currentEmotion: 'neutral',
  currentExpression: 'neutral',
  expressionIntensity: 0.8,
  currentBehavior: 'idle',
  sessionId: getOrCreateSessionId(),
  chatHistory: [],
  isConnected: true,
  connectionStatus: 'connected',
  isLoading: false,
  error: null,
  lastErrorTime: null,
  
  // 状态设置方法
  setPlaying: (playing) => set({ isPlaying: playing }),
  setAutoRotate: (rotate) => set({ autoRotate: rotate }),
  setAnimation: (animation) => set({ currentAnimation: animation }),
  setRecording: (recording) => set({ isRecording: recording }),
  setMuted: (muted) => set({ isMuted: muted }),
  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setEmotion: (emotion) => set({ currentEmotion: emotion }),
  setExpression: (expression) => set({ currentExpression: expression }),
  setExpressionIntensity: (intensity) => set({ expressionIntensity: Math.max(0, Math.min(1, intensity)) }),
  setBehavior: (behavior) => set({ currentBehavior: behavior }),
  setConnected: (connected) => set({ isConnected: connected }),
  setConnectionStatus: (status) => set({ 
    connectionStatus: status,
    isConnected: status === 'connected'
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, lastErrorTime: error ? Date.now() : null }),
  clearError: () => set({ error: null, lastErrorTime: null }),
  
  // 会话管理
  initSession: () => {
    const newId = generateSessionId();
    localStorage.setItem('metahuman_session_id', newId);
    set({ sessionId: newId, chatHistory: [] });
  },
  
  addChatMessage: (role, text) => set((state) => ({
    chatHistory: [
      ...state.chatHistory,
      { id: Date.now(), role, text, timestamp: Date.now() }
    ]
  })),
  
  clearChatHistory: () => set({ chatHistory: [] }),
  
  // 控制方法
  play: () => {
    set({ isPlaying: true });
    console.log('数字人播放');
  },
  
  pause: () => {
    set({ isPlaying: false });
    console.log('数字人暂停');
  },
  
  reset: () => {
    set({ 
      isPlaying: false,
      currentAnimation: 'idle',
      currentEmotion: 'neutral',
      currentExpression: 'neutral',
      expressionIntensity: 0.8,
      currentBehavior: 'idle',
      error: null,
      lastErrorTime: null
    });
    console.log('数字人重置');
  },
  
  startRecording: () => {
    set({ isRecording: true });
    console.log('开始录音');
    
    // 模拟录音超时
    setTimeout(() => {
      if (get().isRecording) {
        get().stopRecording();
      }
    }, 10000); // 10秒后自动停止
  },
  
  stopRecording: () => {
    set({ isRecording: false });
    console.log('停止录音');
  },
  
  toggleMute: () => {
    const { isMuted } = get();
    set({ isMuted: !isMuted });
    console.log(`音频${isMuted ? '取消静音' : '静音'}`);
  },
  
  toggleAutoRotate: () => {
    const { autoRotate } = get();
    set({ autoRotate: !autoRotate });
    console.log(`自动旋转${autoRotate ? '关闭' : '开启'}`);
  }
}));
