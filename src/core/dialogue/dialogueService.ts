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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function sendUserInput(
  payload: ChatRequestPayload,
): Promise<ChatResponsePayload> {
  const response = await fetch(`${API_BASE_URL}/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    replyText: data.replyText ?? '',
    emotion: data.emotion ?? 'neutral',
    action: data.action ?? 'idle',
  };
}
