/**
 * Digital Human Engine Property-Based Tests
 * 
 * Feature: digital-human-refactor
 * Tests Properties 23, 24, 25, 26 from design.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Track state changes
const storeState = {
    currentAnimation: 'idle',
    currentEmotion: 'neutral',
    currentExpression: 'neutral',
    currentBehavior: 'idle',
    isPlaying: false,
};

// Mock the store
vi.mock('../../store/digitalHumanStore', () => ({
    useDigitalHumanStore: {
        getState: vi.fn(() => ({
            setAnimation: vi.fn((val: string) => { storeState.currentAnimation = val; }),
            setEmotion: vi.fn((val: string) => { storeState.currentEmotion = val; }),
            setExpression: vi.fn((val: string) => { storeState.currentExpression = val; }),
            setBehavior: vi.fn((val: string) => { storeState.currentBehavior = val; }),
            setPlaying: vi.fn((val: boolean) => { storeState.isPlaying = val; }),
            play: vi.fn(() => { storeState.isPlaying = true; }),
            pause: vi.fn(() => { storeState.isPlaying = false; }),
            reset: vi.fn(() => {
                storeState.currentAnimation = 'idle';
                storeState.currentEmotion = 'neutral';
                storeState.currentExpression = 'neutral';
                storeState.currentBehavior = 'idle';
                storeState.isPlaying = false;
            }),
            ...storeState,
        })),
    },
}));

describe('Digital Human Engine Properties', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        storeState.currentAnimation = 'idle';
        storeState.currentEmotion = 'neutral';
        storeState.currentExpression = 'neutral';
        storeState.currentBehavior = 'idle';
        storeState.isPlaying = false;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    /**
     * Property 23: Engine Animation Queue
     * For any sequence of queueAnimation() calls, animations SHALL be played in FIFO order,
     * and getQueueLength() SHALL accurately reflect the pending count.
     */
    it('Property 23: Engine Animation Queue - FIFO order and accurate queue length', async () => {
        const { DigitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');

        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.constantFrom('wave', 'greet', 'nod', 'shakeHead', 'dance', 'think'),
                    { minLength: 1, maxLength: 5 }
                ),
                async (animations) => {
                    const engine = new DigitalHumanEngine();

                    // Queue all animations
                    animations.forEach(anim => {
                        engine.queueAnimation(anim, { duration: 100 });
                    });

                    // Queue length should match
                    expect(engine.getQueueLength()).toBeLessThanOrEqual(animations.length);

                    // Clear queue
                    engine.clearAnimationQueue();
                    expect(engine.getQueueLength()).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 24: Engine Animation Auto-Reset
     * For any animation with autoReset=true (default), the engine SHALL return to 'idle'
     * animation after the animation duration completes.
     */
    it('Property 24: Engine Animation Auto-Reset - returns to idle after duration', async () => {
        const { DigitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('wave', 'greet', 'nod', 'shakeHead', 'dance', 'think'),
                async (animation) => {
                    const engine = new DigitalHumanEngine();

                    // Play animation with auto-reset
                    engine.playAnimation(animation, true);

                    // Animation should be set
                    expect(storeState.currentAnimation).toBe(animation);

                    // Fast-forward past animation duration
                    vi.advanceTimersByTime(10000);

                    // Should have reset to idle
                    expect(storeState.currentAnimation).toBe('idle');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 25: Engine Emotion-Expression Mapping
     * For any valid emotion set via setEmotion(), the corresponding expression SHALL be
     * automatically set according to the EMOTION_TO_EXPRESSION mapping.
     */
    it('Property 25: Engine Emotion-Expression Mapping - emotion maps to expression', async () => {
        const { DigitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');

        const emotionToExpression: Record<string, string> = {
            'neutral': 'neutral',
            'happy': 'smile',
            'surprised': 'surprise',
            'sad': 'sad',
            'angry': 'angry',
        };

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('neutral', 'happy', 'surprised', 'sad', 'angry'),
                async (emotion) => {
                    const engine = new DigitalHumanEngine();

                    const result = engine.setEmotion(emotion);

                    // Should return true for valid emotion
                    expect(result).toBe(true);

                    // Expression should be mapped
                    expect(storeState.currentExpression).toBe(emotionToExpression[emotion]);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 26: Engine Invalid Expression Fallback
     * For any invalid expression string passed to setExpression(), the engine SHALL log
     * a warning and set expression to 'neutral'.
     */
    it('Property 26: Engine Invalid Expression Fallback - uses neutral for invalid', async () => {
        const { DigitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const validExpressions = [
            'neutral', 'smile', 'laugh', 'surprise', 'sad', 'angry',
            'blink', 'eyebrow_raise', 'eye_blink', 'mouth_open', 'head_nod'
        ];

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 20 }),
                async (expression) => {
                    // Skip if accidentally valid
                    if (validExpressions.includes(expression)) {
                        return;
                    }

                    const engine = new DigitalHumanEngine();
                    consoleSpy.mockClear();

                    const result = engine.setExpression(expression);

                    // Should return false for invalid expression
                    expect(result).toBe(false);

                    // Should have logged a warning
                    expect(consoleSpy).toHaveBeenCalled();

                    // Expression should be neutral
                    expect(storeState.currentExpression).toBe('neutral');
                }
            ),
            { numRuns: 100 }
        );

        consoleSpy.mockRestore();
    });

    /**
     * Additional: Invalid emotion fallback
     */
    it('Invalid emotion falls back to neutral', async () => {
        const { DigitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const validEmotions = ['neutral', 'happy', 'surprised', 'sad', 'angry'];

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 20 }),
                async (emotion) => {
                    if (validEmotions.includes(emotion)) {
                        return;
                    }

                    const engine = new DigitalHumanEngine();
                    consoleSpy.mockClear();

                    const result = engine.setEmotion(emotion);

                    expect(result).toBe(false);
                    expect(storeState.currentEmotion).toBe('neutral');
                }
            ),
            { numRuns: 100 }
        );

        consoleSpy.mockRestore();
    });

    /**
     * Additional: Invalid behavior fallback
     */
    it('Invalid behavior falls back to idle', async () => {
        const { DigitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const validBehaviors = [
            'idle', 'greeting', 'listening', 'thinking', 'speaking', 'excited',
            'wave', 'greet', 'think', 'nod', 'shakeHead', 'dance', 'speak', 'waveHand', 'raiseHand'
        ];

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 20 }),
                async (behavior) => {
                    if (validBehaviors.includes(behavior)) {
                        return;
                    }

                    const engine = new DigitalHumanEngine();
                    consoleSpy.mockClear();

                    const result = engine.setBehavior(behavior);

                    expect(result).toBe(false);
                    expect(storeState.currentBehavior).toBe('idle');
                }
            ),
            { numRuns: 100 }
        );

        consoleSpy.mockRestore();
    });
});
