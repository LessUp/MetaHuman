import { useDigitalHumanStore } from '../../store/digitalHumanStore';

export class DigitalHumanEngine {
  play() {
    const { play } = useDigitalHumanStore.getState();
    play();
  }

  pause() {
    const { pause } = useDigitalHumanStore.getState();
    pause();
  }

  reset() {
    const { reset } = useDigitalHumanStore.getState();
    reset();
  }

  setExpression(expression: string) {
    const { setExpression } = useDigitalHumanStore.getState();
    setExpression(expression);
  }

  setExpressionIntensity(intensity: number) {
    const { setExpressionIntensity } = useDigitalHumanStore.getState();
    setExpressionIntensity(intensity);
  }

  setEmotion(emotion: string) {
    const { setEmotion } = useDigitalHumanStore.getState();
    setEmotion(emotion);
  }

  setBehavior(behavior: string, _params?: unknown) {
    const { setBehavior, setAnimation, setPlaying } = useDigitalHumanStore.getState();
    setBehavior(behavior);

    let animationName = behavior;
    switch (behavior) {
      case 'greeting':
        animationName = 'waveHand';
        break;
      case 'listening':
        animationName = 'nod';
        break;
      case 'thinking':
        animationName = 'shakeHead';
        break;
      case 'speaking':
        animationName = 'nod';
        break;
      case 'excited':
        animationName = 'excited';
        break;
      default:
        animationName = 'idle';
    }

    setAnimation(animationName);
    setPlaying(animationName !== 'idle');
  }

  playAnimation(name: string) {
    const { setAnimation, setPlaying } = useDigitalHumanStore.getState();
    setAnimation(name);
    setPlaying(true);
  }
}

export const digitalHumanEngine = new DigitalHumanEngine();
