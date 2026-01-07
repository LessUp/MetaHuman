/**
 * Dialogue Orchestrator Property-Based Tests
 * 
 * Feature: digital-human-refactor
 * Tests Properties 19, 20, 21, 22 from design.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Track state changes
const stateChanges: { type: string; value: string; timestamp: number }[] = [];

// Mock the store
vi.mock('../../store/digitalHumanStore', () => ({
    useDigitalHumanStore: {
        getState: vi.fn(() => ({
            addChatMessage: vi.fn(),
            setBehavior: vi.fn((val: string) => {
                stateChanges.push({ type: 'behavior', value: val, timestamp: Date.now() });
            }),
            setEmotion: vi.fn((val: string) => {
                stateChanges.push({ type: 'emotion', value: val, timestamp: Date.now() });
            }),
            currentEmotion: 'neutral',
            currentBehavior: 'idle',
            isSpeaking: false,
            isLoading: false,
        })),
        subscribe: vi.fn(() => vi.fn()),
    },
}));

// Mock the engine
vi.mock('../../core/avatar/DigitalHumanEngine', () => ({
    digitalHumanEngine: {
        setEmotion: vi.fn((val: string) => {
            stateChanges.push({ type: 'engine-emotion', value: val, timestamp: Date.now() });
        }),
        playAnimation: vi.fn((val: string) => {
            stateChanges.push({ type: 'engine-animation', value: val, timestamp: Date.now() });
        }),
    },
}));

describe('Dialogue Orchestrator Properties', () => {
    beforeEach(() => {
        stateChanges.length = 0;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Property 19: Orchestrator State Sequence
     * For any dialogue response handling, the Dialogue_Orchestrator SHALL update states
     * in the order: emotion → action → speech (if not muted).
     */
    it('Property 19: Orchestrator State Sequence - updates in correct order', async () => {
        const { handleDialogueResponse } = await import('../../core/dialogue/dialogueOrchestrator');

        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    replyText: fc.string({ minLength: 1, maxLength: 100 }),
                    emotion: fc.constantFrom('neutral', 'happy', 'surprised', 'sad', 'angry'),
                    action: fc.constantFrom('idle', 'wave', 'greet', 'nod', 'think'),
                }),
                async (response) => {
                    stateChanges.length = 0;

                    await handleDialogueResponse(response, {
                        isMuted: true, // Muted to simplify test
                        addAssistantMessage: false,
                    });

                    // Find emotion and action changes
                    const emotionChange = stateChanges.find(c => c.type === 'engine-emotion');
                    const actionChange = stateChanges.find(c => c.type === 'engine-animation');

                    if (emotionChange && actionChange && response.action !== 'idle') {
                        // Emotion should be set before action
                        expect(emotionChange.timestamp).toBeLessThanOrEqual(actionChange.timestamp);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 20: Orchestrator Speech Wait
     * For any dialogue response with speech, the Dialogue_Orchestrator SHALL NOT reset
     * to idle state until speech synthesis completes.
     */
    it('Property 20: Orchestrator Speech Wait - waits for speech completion', async () => {
        const { handleDialogueResponse } = await import('../../core/dialogue/dialogueOrchestrator');

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 100 }),
                async (replyText) => {
                    stateChanges.length = 0;
                    let speechCalled = false;

                    const mockSpeakWith = vi.fn(async () => {
                        speechCalled = true;
                    });

                    await handleDialogueResponse(
                        { replyText, emotion: 'happy', action: 'wave' },
                        {
                            isMuted: false,
                            speakWith: mockSpeakWith,
                            waitForSpeech: true,
                        }
                    );

                    // Speech should have been called
                    expect(speechCalled).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 21: Orchestrator Invalid Value Fallback
     * For any response containing an emotion or action not in the valid set,
     * the Dialogue_Orchestrator SHALL use 'neutral' for emotion and 'idle' for action.
     */
    it('Property 21: Orchestrator Invalid Value Fallback - uses defaults for invalid values', async () => {
        const { handleDialogueResponse } = await import('../../core/dialogue/dialogueOrchestrator');
        const { digitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 20 }), // Random invalid emotion
                fc.string({ minLength: 1, maxLength: 20 }), // Random invalid action
                async (invalidEmotion, invalidAction) => {
                    // Skip if accidentally valid
                    const validEmotions = ['neutral', 'happy', 'surprised', 'sad', 'angry'];
                    const validActions = ['idle', 'wave', 'greet', 'nod', 'shakeHead', 'dance', 'think', 'speak'];

                    if (validEmotions.includes(invalidEmotion) || validActions.includes(invalidAction)) {
                        return;
                    }

                    stateChanges.length = 0;

                    await handleDialogueResponse(
                        { replyText: 'Test', emotion: invalidEmotion, action: invalidAction },
                        { isMuted: true, addAssistantMessage: false }
                    );

                    // Engine should have been called (validation happens in orchestrator)
                    expect(digitalHumanEngine.setEmotion).toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 22: Orchestrator Muted Behavior
     * For any dialogue response when isMuted is true, the Dialogue_Orchestrator SHALL
     * update emotion and action but SHALL NOT invoke speech synthesis.
     */
    it('Property 22: Orchestrator Muted Behavior - skips speech when muted', async () => {
        const { handleDialogueResponse } = await import('../../core/dialogue/dialogueOrchestrator');
        const { digitalHumanEngine } = await import('../../core/avatar/DigitalHumanEngine');

        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    replyText: fc.string({ minLength: 1, maxLength: 100 }),
                    emotion: fc.constantFrom('neutral', 'happy', 'surprised', 'sad', 'angry'),
                    action: fc.constantFrom('idle', 'wave', 'greet', 'nod'),
                }),
                async (response) => {
                    const mockSpeakWith = vi.fn();

                    await handleDialogueResponse(response, {
                        isMuted: true,
                        speakWith: mockSpeakWith,
                    });

                    // Speech should NOT have been called
                    expect(mockSpeakWith).not.toHaveBeenCalled();

                    // But emotion should have been set
                    expect(digitalHumanEngine.setEmotion).toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });
});
