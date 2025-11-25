import { useDigitalHumanStore } from '../../store/digitalHumanStore';

export interface ChatRequestPayload {
  sessionId?: string;
  userText: string;
  meta?: Record<string, any>;
}

export interface ChatResponsePayload {
  replyText: string;
  emotion: string;
  action: string;
}

// 对话服务配置
export interface DialogueServiceConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const DEFAULT_CONFIG: Required<DialogueServiceConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 15000,
};

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
  // 5xx 服务器错误和 429 (Rate Limit) 可重试
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

// 本地降级响应
function getFallbackResponse(userText: string): ChatResponsePayload {
  // 简单的本地响应逻辑
  const greetings = ['你好', '您好', 'hello', 'hi', '嗨'];
  const isGreeting = greetings.some(g => userText.toLowerCase().includes(g));

  if (isGreeting) {
    return {
      replyText: '您好！很高兴见到您。由于网络问题，我目前处于离线模式，但仍然可以进行简单的交互。',
      emotion: 'happy',
      action: 'wave',
    };
  }

  return {
    replyText: '抱歉，我暂时无法连接到服务器。请检查网络连接后重试，或者稍后再来。',
    emotion: 'neutral',
    action: 'idle',
  };
}

// 检查服务器连接状态
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/health`,
      { method: 'GET' },
      5000
    );
    return response.ok;
  } catch {
    return false;
  }
}

// 主发送函数 - 带重试和降级
export async function sendUserInput(
  payload: ChatRequestPayload,
  config: DialogueServiceConfig = {}
): Promise<ChatResponsePayload> {
  const { maxRetries, retryDelay, timeout } = { ...DEFAULT_CONFIG, ...config };
  const store = useDigitalHumanStore.getState();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 更新连接状态
      if (attempt > 0) {
        store.setConnectionStatus('connecting');
        console.log(`对话服务重试 ${attempt}/${maxRetries}`);
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
          await delay(retryDelay * (attempt + 1)); // 指数退避
          continue;
        }

        throw new DialogueApiError(errorMsg, response.status, false);
      }

      const data = await response.json();

      // 成功 - 更新连接状态
      store.setConnectionStatus('connected');
      store.clearError();

      return {
        replyText: data.replyText ?? '',
        emotion: data.emotion ?? 'neutral',
        action: data.action ?? 'idle',
      };

    } catch (error: any) {
      lastError = error;

      // 处理中断错误（超时）
      if (error.name === 'AbortError') {
        lastError = new DialogueApiError('请求超时，请重试', 408, true);
      }

      // 处理网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        lastError = new DialogueApiError('网络连接失败，请检查网络', 0, true);
      }

      // 如果还有重试次数且错误可重试，继续
      if (attempt < maxRetries) {
        const isRetryable =
          error instanceof DialogueApiError ? error.isRetryable : true;
        if (isRetryable) {
          await delay(retryDelay * (attempt + 1));
          continue;
        }
      }
    }
  }

  // 所有重试都失败了，返回降级响应
  console.error('对话服务所有重试都失败:', lastError);
  store.setConnectionStatus('error');
  store.setError(lastError?.message || '对话服务不可用');

  return getFallbackResponse(payload.userText);
}

// 流式对话（预留接口）
export async function* streamUserInput(
  payload: ChatRequestPayload
): AsyncGenerator<string, ChatResponsePayload, unknown> {
  // TODO: 实现流式响应
  const response = await sendUserInput(payload);
  yield response.replyText;
  return response;
}
