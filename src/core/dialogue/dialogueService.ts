import { useDigitalHumanStore } from '../../store/digitalHumanStore';

export interface ChatRequestPayload {
  sessionId?: string;
  userText: string;
  meta?: Record<string, unknown>;
}

export interface ChatResponsePayload {
  replyText: string;
  emotion: string;
  action: string;
}

// 对话服务配置
export interface DialogueServiceConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  maxHistoryLength: number;
}

// 重试状态
export interface RetryState {
  attempt: number;
  lastError: Error | null;
  nextRetryTime: number;
}

// API 错误类
export class DialogueApiError extends Error {
  status: number;
  isRetryable: boolean;

  constructor(message: string, status: number, isRetryable = false) {
    super(message);
    this.name = 'DialogueApiError';
    this.status = status;
    this.isRetryable = isRetryable;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const DEFAULT_CONFIG: Required<DialogueServiceConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 15000,
  maxHistoryLength: 50,
};

// 会话历史存储
const sessionHistories: Map<string, ChatRequestPayload[]> = new Map();

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 带超时的 fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 判断错误是否可重试
function isRetryableError(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

// 获取用户友好的错误消息
function getErrorMessage(status: number, defaultMessage: string): string {
  const messages: Record<number, string> = {
    400: '请求格式错误，请重试',
    401: '认证失败，请刷新页面',
    403: '访问被拒绝',
    404: '服务不可用，请稍后重试',
    408: '请求超时，请重试',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误，请稍后重试',
    502: '网关错误，请稍后重试',
    503: '服务暂时不可用，请稍后重试',
    504: '网关超时，请稍后重试',
  };
  return messages[status] || defaultMessage;
}

// 验证响应数据
function validateResponse(data: unknown): ChatResponsePayload {
  if (!data || typeof data !== 'object') {
    return {
      replyText: '',
      emotion: 'neutral',
      action: 'idle',
    };
  }

  const obj = data as Record<string, unknown>;

  // 验证 emotion 值
  const validEmotions = ['neutral', 'happy', 'surprised', 'sad', 'angry'];
  const emotion = typeof obj.emotion === 'string' && validEmotions.includes(obj.emotion)
    ? obj.emotion
    : 'neutral';

  // 验证 action 值
  const validActions = ['idle', 'wave', 'greet', 'nod', 'shakeHead', 'dance', 'think', 'speak'];
  const action = typeof obj.action === 'string' && validActions.includes(obj.action)
    ? obj.action
    : 'idle';

  return {
    replyText: typeof obj.replyText === 'string' ? obj.replyText : '',
    emotion,
    action,
  };
}

// 智能降级响应 - 基于用户输入生成
function getFallbackResponse(
  userText: string,
  context?: { emotion?: string; lastTopic?: string }
): ChatResponsePayload {
  const lowerText = userText.toLowerCase();

  // 问候语
  const greetings = ['你好', '您好', 'hello', 'hi', '嗨', '早上好', '下午好', '晚上好'];
  if (greetings.some(g => lowerText.includes(g))) {
    return {
      replyText: '您好！很高兴见到您。由于网络问题，我目前处于离线模式，但仍然可以进行简单的交互。',
      emotion: 'happy',
      action: 'wave',
    };
  }

  // 感谢
  if (lowerText.includes('谢谢') || lowerText.includes('感谢') || lowerText.includes('thank')) {
    return {
      replyText: '不客气！很高兴能帮到您。',
      emotion: 'happy',
      action: 'nod',
    };
  }

  // 再见
  if (lowerText.includes('再见') || lowerText.includes('拜拜') || lowerText.includes('bye')) {
    return {
      replyText: '再见！期待下次与您交流。',
      emotion: 'happy',
      action: 'wave',
    };
  }

  // 询问状态
  if (lowerText.includes('怎么样') || lowerText.includes('如何') || lowerText.includes('好吗')) {
    return {
      replyText: '我现在状态不错，谢谢关心！不过由于网络问题，我暂时无法提供完整的服务。',
      emotion: 'neutral',
      action: 'nod',
    };
  }

  // 默认响应
  return {
    replyText: '抱歉，我暂时无法连接到服务器。请检查网络连接后重试，或者稍后再来。',
    emotion: 'neutral',
    action: 'idle',
  };
}

// 检查服务器连接状态
export async function checkServerHealth(): Promise<{
  healthy: boolean;
  latency: number;
  services: Record<string, string>;
}> {
  const startTime = performance.now();
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/health`,
      { method: 'GET' },
      5000
    );
    const latency = performance.now() - startTime;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        healthy: true,
        latency,
        services: data.services || { api: 'ok' },
      };
    }

    return {
      healthy: false,
      latency,
      services: { api: `error: ${response.status}` },
    };
  } catch (error) {
    return {
      healthy: false,
      latency: performance.now() - startTime,
      services: { api: 'unreachable' },
    };
  }
}

// 会话历史管理
export function clearSession(sessionId: string): void {
  sessionHistories.delete(sessionId);
}

export function getSessionHistory(sessionId: string): ChatRequestPayload[] {
  return sessionHistories.get(sessionId) || [];
}

// 添加到会话历史
function addToSessionHistory(
  sessionId: string,
  payload: ChatRequestPayload,
  maxLength: number
): void {
  const history = sessionHistories.get(sessionId) || [];
  history.push(payload);

  // 修剪历史
  while (history.length > maxLength) {
    history.shift();
  }

  sessionHistories.set(sessionId, history);
}

// 主发送函数 - 带重试和降级
export async function sendUserInput(
  payload: ChatRequestPayload,
  config: Partial<DialogueServiceConfig> = {}
): Promise<ChatResponsePayload> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxRetries, retryDelay, timeout, maxHistoryLength } = mergedConfig;
  const store = useDigitalHumanStore.getState();

  let lastError: Error | null = null;
  let retryState: RetryState = {
    attempt: 0,
    lastError: null,
    nextRetryTime: 0,
  };

  // 添加到会话历史
  if (payload.sessionId) {
    addToSessionHistory(payload.sessionId, payload, maxHistoryLength);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    retryState.attempt = attempt;

    try {
      // 更新连接状态
      if (attempt > 0) {
        store.setConnectionStatus('connecting');
        store.setConnectionDetails({ reconnectAttempts: attempt });
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        timeout
      );

      if (!response.ok) {
        const isRetryable = isRetryableError(response.status);
        const errorMsg = getErrorMessage(response.status, `服务错误: ${response.status}`);

        if (isRetryable && attempt < maxRetries) {
          lastError = new DialogueApiError(errorMsg, response.status, true);
          retryState.lastError = lastError;

          // 指数退避
          const backoffDelay = retryDelay * Math.pow(2, attempt);
          retryState.nextRetryTime = Date.now() + backoffDelay;
          await delay(backoffDelay);
          continue;
        }

        throw new DialogueApiError(errorMsg, response.status, false);
      }

      const data = await response.json();

      // 验证响应
      const validatedResponse = validateResponse(data);

      // 成功 - 更新连接状态
      store.setConnectionStatus('connected');
      store.setConnectionDetails({
        lastConnectedAt: Date.now(),
        reconnectAttempts: 0,
      });
      store.clearError();

      return validatedResponse;

    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      lastError = err;
      retryState.lastError = err;

      // 处理中断错误（超时）
      if (err.name === 'AbortError') {
        lastError = new DialogueApiError('请求超时，请重试', 408, true);
      }

      // 处理网络错误
      if (err instanceof TypeError && err.message.includes('fetch')) {
        lastError = new DialogueApiError('网络连接失败，请检查网络', 0, true);
      }

      // 如果还有重试次数且错误可重试，继续
      if (attempt < maxRetries) {
        const isRetryable = err instanceof DialogueApiError ? err.isRetryable : true;
        if (isRetryable) {
          const backoffDelay = retryDelay * Math.pow(2, attempt);
          retryState.nextRetryTime = Date.now() + backoffDelay;
          await delay(backoffDelay);
          continue;
        }
      }
    }
  }

  // 所有重试都失败了，返回降级响应
  console.error('对话服务所有重试都失败:', lastError);
  store.setConnectionStatus('error');
  store.setConnectionDetails({ lastErrorAt: Date.now() });
  store.addError(lastError?.message || '对话服务不可用');

  return getFallbackResponse(payload.userText);
}

// 流式对话（预留接口）
export async function* streamUserInput(
  payload: ChatRequestPayload
): AsyncGenerator<string, ChatResponsePayload, unknown> {
  const response = await sendUserInput(payload);
  yield response.replyText;
  return response;
}
