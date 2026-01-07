import { ChatResponsePayload } from './dialogueService';
import { useDigitalHumanStore, type EmotionType, type BehaviorType } from '../../store/digitalHumanStore';
import { digitalHumanEngine } from '../avatar/DigitalHumanEngine';

export interface DialogueHandleOptions {
  isMuted?: boolean;
  speakWith?: (text: string) => Promise<void> | void;
  addAssistantMessage?: boolean;
  waitForSpeech?: boolean;
  transitionDuration?: number;
}

// 有效的情感值
const VALID_EMOTIONS: EmotionType[] = ['neutral', 'happy', 'surprised', 'sad', 'angry'];

// 有效的动作值
const VALID_ACTIONS: BehaviorType[] = [
  'idle', 'greeting', 'listening', 'thinking', 'speaking', 'excited',
  'wave', 'greet', 'think', 'nod', 'shakeHead', 'dance', 'speak', 'waveHand', 'raiseHand'
];

// 验证情感值
function validateEmotion(emotion: string): EmotionType {
  if (VALID_EMOTIONS.includes(emotion as EmotionType)) {
    return emotion as EmotionType;
  }
  console.warn(`无效的情感值: ${emotion}, 使用默认 neutral`);
  return 'neutral';
}

// 验证动作值
function validateAction(action: string): BehaviorType {
  if (VALID_ACTIONS.includes(action as BehaviorType)) {
    return action as BehaviorType;
  }
  console.warn(`无效的动作值: ${action}, 使用默认 idle`);
  return 'idle';
}

// 状态转换日志
function logStateTransition(from: string, to: string, type: string): void {
  if (import.meta.env.DEV) {
    console.debug(`[Orchestrator] ${type}: ${from} → ${to}`);
  }
}

// 等待动画完成
export function waitForAnimationComplete(): Promise<void> {
  return new Promise((resolve) => {
    const store = useDigitalHumanStore.getState();

    // 如果没有在播放动画，立即返回
    if (!store.isPlaying || store.currentAnimation === 'idle') {
      resolve();
      return;
    }

    // 监听动画状态变化
    const unsubscribe = useDigitalHumanStore.subscribe((state, prevState) => {
      if (state.currentAnimation === 'idle' || !state.isPlaying) {
        unsubscribe();
        resolve();
      }
    });

    // 超时保护
    setTimeout(() => {
      unsubscribe();
      resolve();
    }, 10000);
  });
}

// 状态转换管理
export async function transitionState(
  fromState: BehaviorType,
  toState: BehaviorType,
  duration: number = 300
): Promise<void> {
  const store = useDigitalHumanStore.getState();

  logStateTransition(fromState, toState, 'behavior');

  // 如果有过渡时间，等待
  if (duration > 0 && fromState !== toState) {
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  store.setBehavior(toState);
}

// 主响应处理函数
export async function handleDialogueResponse(
  res: ChatResponsePayload,
  options: DialogueHandleOptions = {}
): Promise<void> {
  const store = useDigitalHumanStore.getState();
  const {
    isMuted = false,
    speakWith,
    addAssistantMessage = true,
    waitForSpeech = true,
    transitionDuration = 0,
  } = options;

  // 1. 添加助手消息到聊天历史
  if (addAssistantMessage && res.replyText) {
    store.addChatMessage('assistant', res.replyText);
  }

  // 2. 验证并设置情感 (第一步)
  const validEmotion = validateEmotion(res.emotion);
  const prevEmotion = store.currentEmotion;
  logStateTransition(prevEmotion, validEmotion, 'emotion');
  digitalHumanEngine.setEmotion(validEmotion);

  // 3. 验证并设置动作 (第二步)
  const validAction = validateAction(res.action);
  if (validAction !== 'idle') {
    const prevBehavior = store.currentBehavior;
    logStateTransition(prevBehavior, validAction, 'action');
    digitalHumanEngine.playAnimation(validAction, !waitForSpeech);
  }

  // 4. 语音合成 (第三步，如果未静音)
  if (res.replyText && !isMuted && speakWith) {
    // 设置说话状态
    store.setBehavior('speaking');

    try {
      await speakWith(res.replyText);
    } catch (error) {
      console.error('语音合成失败:', error);
    }

    // 语音完成后，如果需要等待，则重置到 idle
    if (waitForSpeech) {
      await transitionState('speaking', 'idle', transitionDuration);
      digitalHumanEngine.setEmotion('neutral');
    }
  } else if (isMuted) {
    // 静音时：更新视觉状态但跳过语音
    // 情感和动作已经设置，只需要在适当时间后重置
    if (validAction !== 'idle') {
      // 等待动画完成后重置
      setTimeout(() => {
        store.setBehavior('idle');
        store.setEmotion('neutral');
      }, 3000);
    }
  }
}

// 处理用户情绪输入（来自视觉服务）
export function handleUserEmotion(emotion: string): void {
  const store = useDigitalHumanStore.getState();

  // 如果正在说话或处理中，不响应用户情绪
  if (store.isSpeaking || store.isLoading) {
    return;
  }

  // 镜像用户情绪
  const validEmotion = validateEmotion(emotion);
  digitalHumanEngine.setEmotion(validEmotion);
}

// 处理用户动作输入（来自视觉服务）
export function handleUserMotion(motion: 'nod' | 'shakeHead' | 'raiseHand' | 'waveHand'): void {
  const store = useDigitalHumanStore.getState();

  // 如果正在说话或处理中，不响应用户动作
  if (store.isSpeaking || store.isLoading) {
    return;
  }

  // 响应用户动作
  switch (motion) {
    case 'nod':
      digitalHumanEngine.playAnimation('nod');
      break;
    case 'shakeHead':
      digitalHumanEngine.playAnimation('shakeHead');
      break;
    case 'waveHand':
      digitalHumanEngine.playAnimation('wave');
      break;
    case 'raiseHand':
      digitalHumanEngine.playAnimation('greet');
      break;
  }
}
