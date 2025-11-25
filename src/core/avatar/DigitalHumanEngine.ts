import { useDigitalHumanStore, type EmotionType, type ExpressionType, type BehaviorType } from '../../store/digitalHumanStore';

// 表情与情感的映射
const EMOTION_TO_EXPRESSION: Record<EmotionType, ExpressionType> = {
  'neutral': 'neutral',
  'happy': 'smile',
  'surprised': 'surprise',
  'sad': 'sad',
  'angry': 'angry',
};

// 动作持续时间配置
const ANIMATION_DURATIONS: Record<string, number> = {
  'wave': 3000,
  'greet': 3000,
  'nod': 2000,
  'shakeHead': 2000,
  'dance': 6000,
  'think': 3000,
  'speak': 0, // 由语音控制
  'idle': 0,
};

export class DigitalHumanEngine {
  private animationTimeout: NodeJS.Timeout | null = null;

  play(): void {
    const { play } = useDigitalHumanStore.getState();
    play();
  }

  pause(): void {
    const { pause } = useDigitalHumanStore.getState();
    pause();
  }

  reset(): void {
    const { reset } = useDigitalHumanStore.getState();
    reset();
    this.clearAnimationTimeout();
  }

  setExpression(expression: string): void {
    const store = useDigitalHumanStore.getState();
    // 验证表情类型
    const validExpressions: ExpressionType[] = ['neutral', 'smile', 'laugh', 'surprise', 'sad', 'angry', 'blink', 'eyebrow_raise', 'eye_blink', 'mouth_open', 'head_nod'];
    if (validExpressions.includes(expression as ExpressionType)) {
      store.setExpression(expression as ExpressionType);
    } else {
      console.warn(`未知表情类型: ${expression}, 使用默认 neutral`);
      store.setExpression('neutral');
    }
  }

  setExpressionIntensity(intensity: number): void {
    const { setExpressionIntensity } = useDigitalHumanStore.getState();
    setExpressionIntensity(intensity);
  }

  setEmotion(emotion: string): void {
    const store = useDigitalHumanStore.getState();
    // 验证情感类型
    const validEmotions: EmotionType[] = ['neutral', 'happy', 'surprised', 'sad', 'angry'];
    if (validEmotions.includes(emotion as EmotionType)) {
      store.setEmotion(emotion as EmotionType);
      // 自动设置对应的表情
      const mappedExpression = EMOTION_TO_EXPRESSION[emotion as EmotionType];
      if (mappedExpression) {
        store.setExpression(mappedExpression);
      }
    } else {
      console.warn(`未知情感类型: ${emotion}, 使用默认 neutral`);
      store.setEmotion('neutral');
      store.setExpression('neutral');
    }
  }

  setBehavior(behavior: string): void {
    const store = useDigitalHumanStore.getState();
    const validBehaviors: BehaviorType[] = ['idle', 'greeting', 'listening', 'thinking', 'speaking', 'excited', 'wave', 'greet', 'think', 'nod', 'shakeHead', 'dance', 'speak', 'waveHand', 'raiseHand'];
    if (validBehaviors.includes(behavior as BehaviorType)) {
      store.setBehavior(behavior as BehaviorType);
    } else {
      console.warn(`未知行为类型: ${behavior}, 使用默认 idle`);
      store.setBehavior('idle');
    }
  }

  playAnimation(name: string, autoReset: boolean = true): void {
    const store = useDigitalHumanStore.getState();
    
    this.clearAnimationTimeout();
    
    store.setAnimation(name);
    store.setPlaying(true);
    
    // 设置对应的行为状态
    const behaviorMap: Record<string, BehaviorType> = {
      'wave': 'greeting',
      'greet': 'greeting',
      'nod': 'listening',
      'shakeHead': 'idle',
      'dance': 'excited',
      'think': 'thinking',
      'speak': 'speaking',
    };
    
    if (behaviorMap[name]) {
      store.setBehavior(behaviorMap[name]);
    }
    
    // 自动恢复到 idle 状态
    if (autoReset) {
      const duration = ANIMATION_DURATIONS[name] || 3000;
      if (duration > 0) {
        this.animationTimeout = setTimeout(() => {
          store.setAnimation('idle');
          store.setBehavior('idle');
        }, duration);
      }
    }
  }

  // 组合动作：打招呼
  performGreeting(): void {
    this.setEmotion('happy');
    this.playAnimation('wave');
  }

  // 组合动作：思考
  performThinking(): void {
    this.setEmotion('neutral');
    this.setBehavior('thinking');
    this.playAnimation('think');
  }

  // 组合动作：聆听
  performListening(): void {
    this.setEmotion('neutral');
    this.setBehavior('listening');
    this.playAnimation('nod', false);
  }

  private clearAnimationTimeout(): void {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
      this.animationTimeout = null;
    }
  }
}

export const digitalHumanEngine = new DigitalHumanEngine();
