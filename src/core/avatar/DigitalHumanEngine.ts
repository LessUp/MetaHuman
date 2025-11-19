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

  setEmotion(emotion: string) {
    const { setEmotion } = useDigitalHumanStore.getState();
    setEmotion(emotion);
  }

  playAnimation(name: string) {
    const { setAnimation, setPlaying } = useDigitalHumanStore.getState();
    setAnimation(name);
    setPlaying(true);
  }
}

export const digitalHumanEngine = new DigitalHumanEngine();
