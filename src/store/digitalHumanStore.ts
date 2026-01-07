import { create } from 'zustand';

// 表情类型定义
export type EmotionType = 'neutral' | 'happy' | 'surprised' | 'sad' | 'angry';
export type ExpressionType = 'neutral' | 'smile' | 'laugh' | 'surprise' | 'sad' | 'angry' | 'blink' | 'eyebrow_raise' | 'eye_blink' | 'mouth_open' | 'head_nod';
export type BehaviorType = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking' | 'excited' | 'wave' | 'greet' | 'think' | 'nod' | 'shakeHead' | 'dance' | 'speak' | 'waveHand' | 'raiseHand';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// 错误项接口
export interface ErrorItem {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: number;
  dismissable: boolean;
  autoHideMs?: number;
}

// 连接详情接口
export interface ConnectionDetails {
  lastConnectedAt: number | null;
  lastErrorAt: number | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

// 性能指标接口
export interface PerformanceMetrics {
  fps: number;
  lastFrameTime: number;
}

// 聊天消息接口
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// 状态更新防抖配置
const DEBOUNCE_CONFIG = {
  maxUpdatesPerSecond: 10,
  debounceInterval: 100, // ms
};

// 防抖状态跟踪
let lastUpdateTime = 0;
let updateCount = 0;
let windowStart = 0;
let pendingUpdate: (() => void) | null = null;
let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;

// 防抖更新函数
function debouncedSetState(updateFn: () => void): void {
  const now = Date.now();

  // 重置计数窗口
  if (now - windowStart >= 1000) {
    updateCount = 0;
    windowStart = now;
  }

  // 检查是否超过每秒最大更新次数
  if (updateCount >= DEBOUNCE_CONFIG.maxUpdatesPerSecond) {
    pendingUpdate = updateFn;

    if (!debounceTimeoutId) {
      debounceTimeoutId = setTimeout(() => {
        debounceTimeoutId = null;
        if (pendingUpdate) {
          pendingUpdate();
          pendingUpdate = null;
          updateCount++;
        }
      }, DEBOUNCE_CONFIG.debounceInterval);
    }
    return;
  }

  // 检查防抖间隔
  if (now - lastUpdateTime < DEBOUNCE_CONFIG.debounceInterval) {
    pendingUpdate = updateFn;

    if (!debounceTimeoutId) {
      const delay = DEBOUNCE_CONFIG.debounceInterval - (now - lastUpdateTime);
      debounceTimeoutId = setTimeout(() => {
        debounceTimeoutId = null;
        if (pendingUpdate) {
          pendingUpdate();
          pendingUpdate = null;
          lastUpdateTime = Date.now();
          updateCount++;
        }
      }, delay);
    }
    return;
  }

  // 立即执行
  updateFn();
  lastUpdateTime = now;
  updateCount++;
}

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
  chatHistory: ChatMessage[];
  maxChatHistoryLength: number;

  // 系统状态
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionDetails: ConnectionDetails;
  isLoading: boolean;

  // 错误管理
  error: string | null;
  lastErrorTime: number | null;
  errorQueue: ErrorItem[];
  maxErrorQueueLength: number;

  // 性能指标
  performanceMetrics: PerformanceMetrics;

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
  setConnectionDetails: (details: Partial<ConnectionDetails>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // 错误队列管理
  addError: (message: string, severity?: 'info' | 'warning' | 'error', autoHideMs?: number) => void;
  dismissError: (errorId: string) => void;
  clearAllErrors: () => void;

  // 会话管理
  initSession: () => void;
  addChatMessage: (role: 'user' | 'assistant', text: string) => void;
  clearChatHistory: () => void;

  // 性能指标
  updatePerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => void;

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

// 生成唯一错误ID
const generateErrorId = (): string => {
  return `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const getSafeLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    // 测试 localStorage 是否可用
    const testKey = '__test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
};

// 从 localStorage 获取或创建会话ID
const getOrCreateSessionId = (): string => {
  const storage = getSafeLocalStorage();
  if (!storage) {
    // localStorage 不可用时，生成内存中的 session ID
    return generateSessionId();
  }
  try {
    const stored = storage.getItem('metahuman_session_id');
    if (stored) return stored;
    const newId = generateSessionId();
    storage.setItem('metahuman_session_id', newId);
    return newId;
  } catch {
    // 存储失败时返回新生成的 ID
    return generateSessionId();
  }
};

// 错误自动清除定时器存储
const errorTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

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
  maxChatHistoryLength: 100,
  isConnected: true,
  connectionStatus: 'connected',
  connectionDetails: {
    lastConnectedAt: null,
    lastErrorAt: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
  },
  isLoading: false,
  error: null,
  lastErrorTime: null,
  errorQueue: [],
  maxErrorQueueLength: 5,
  performanceMetrics: {
    fps: 0,
    lastFrameTime: 0,
  },

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

  setConnectionStatus: (status) => {
    // 验证状态转换
    const currentStatus = get().connectionStatus;
    const validTransitions: Record<ConnectionStatus, ConnectionStatus[]> = {
      'disconnected': ['connecting', 'error'],
      'connecting': ['connected', 'error', 'disconnected'],
      'connected': ['disconnected', 'error'],
      'error': ['connecting', 'disconnected', 'connected'],
    };

    if (validTransitions[currentStatus]?.includes(status) || currentStatus === status) {
      set({
        connectionStatus: status,
        isConnected: status === 'connected'
      });
    } else {
      console.warn(`无效的连接状态转换: ${currentStatus} → ${status}`);
    }
  },

  setConnectionDetails: (details) => set((state) => ({
    connectionDetails: { ...state.connectionDetails, ...details }
  })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, lastErrorTime: error ? Date.now() : null }),

  clearError: () => set({ error: null, lastErrorTime: null }),

  // 错误队列管理
  addError: (message, severity = 'error', autoHideMs = 5000) => {
    const errorId = generateErrorId();
    const errorItem: ErrorItem = {
      id: errorId,
      message,
      severity,
      timestamp: Date.now(),
      dismissable: true,
      autoHideMs,
    };

    set((state) => {
      let newQueue = [...state.errorQueue, errorItem];
      // 限制队列长度
      while (newQueue.length > state.maxErrorQueueLength) {
        const removed = newQueue.shift();
        if (removed) {
          const timer = errorTimers.get(removed.id);
          if (timer) {
            clearTimeout(timer);
            errorTimers.delete(removed.id);
          }
        }
      }
      return {
        errorQueue: newQueue,
        error: message,
        lastErrorTime: Date.now(),
      };
    });

    // 设置自动清除
    if (autoHideMs && autoHideMs > 0) {
      const timer = setTimeout(() => {
        get().dismissError(errorId);
      }, autoHideMs);
      errorTimers.set(errorId, timer);
    }
  },

  dismissError: (errorId) => {
    const timer = errorTimers.get(errorId);
    if (timer) {
      clearTimeout(timer);
      errorTimers.delete(errorId);
    }

    set((state) => ({
      errorQueue: state.errorQueue.filter(e => e.id !== errorId),
    }));
  },

  clearAllErrors: () => {
    // 清除所有定时器
    errorTimers.forEach((timer) => clearTimeout(timer));
    errorTimers.clear();

    set({
      errorQueue: [],
      error: null,
      lastErrorTime: null,
    });
  },

  // 会话管理
  initSession: () => {
    const newId = generateSessionId();
    const storage = getSafeLocalStorage();
    if (storage) {
      try {
        storage.setItem('metahuman_session_id', newId);
      } catch {
        // 忽略存储错误
      }
    }
    set({ sessionId: newId, chatHistory: [] });
  },

  addChatMessage: (role, text) => set((state) => {
    const newMessage: ChatMessage = {
      id: Date.now(),
      role,
      text,
      timestamp: Date.now(),
    };

    let newHistory = [...state.chatHistory, newMessage];

    // 限制历史长度
    while (newHistory.length > state.maxChatHistoryLength) {
      newHistory.shift();
    }

    return { chatHistory: newHistory };
  }),

  clearChatHistory: () => set({ chatHistory: [] }),

  // 性能指标 - 使用防抖更新
  updatePerformanceMetrics: (metrics) => {
    debouncedSetState(() => {
      set((state) => ({
        performanceMetrics: { ...state.performanceMetrics, ...metrics }
      }));
    });
  },

  // 控制方法
  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
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
  },

  startRecording: () => {
    set({ isRecording: true });
    // 录音超时保护
    setTimeout(() => {
      if (get().isRecording) {
        get().stopRecording();
      }
    }, 30000);
  },

  stopRecording: () => {
    set({ isRecording: false });
  },

  toggleMute: () => {
    const { isMuted } = get();
    set({ isMuted: !isMuted });
  },

  toggleAutoRotate: () => {
    const { autoRotate } = get();
    set({ autoRotate: !autoRotate });
  }
}));
