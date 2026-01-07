/**
 * TTS Service Property-Based Tests
 * 
 * Feature: digital-human-refactor
 * Tests Properties 3, 4, 5 from design.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the store before importing the service
vi.mock('../../store/digitalHumanStore', () => ({
    useDigitalHumanStore: {
        getState: vi.fn(() => ({
            setSpeaking: vi.fn(),
            setBehavior: vi.fn(),
            addError: vi.fn(),
        })),
    },
}));

// Mock dialogue service
vi.mock('../../core/dialogue/dialogueService', () => ({
    sendUserInput: vi.fn(),
}));

vi.mock('../../core/dialogue/dialogueOrchestrator', () => ({
    handleDialogueResponse: vi.fn(),
}));

describe('TTS Service Properties', () => {
    let mockSynth: any;
    let mockUtterances: any[];
    let speakOrder: string[];

    beforeEach(() => {
        mockUtterances = [];
        speakOrder = [];

        mockSynth = {
            speak: vi.fn((utterance: any) => {
                mockUtterances.push(utterance);
                // Simulate sync speech for testing
                utterance.onstart?.();
                speakOrder.push(utterance.text);
                utterance.onend?.();
            }),
            cancel: vi.fn(() => {
                mockUtterances = [];
            }),
            getVoices: vi.fn(() => [
                { lang: 'zh-CN', name: 'Chinese Voice' },
                { lang: 'en-US', name: 'English Voice' },
            ]),
            speaking: false,
            paused: false,
            pending: false,
            pause: vi.fn(),
            resume: vi.fn(),
            onvoiceschanged: null,
        };

        Object.defineProperty(window, 'speechSynthesis', {
            writable: true,
            value: mockSynth,
        });

        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
            writable: true,
            value: class MockUtterance {
                text: string;
                lang: string = 'zh-CN';
                rate: number = 1;
                pitch: number = 1;
                volume: number = 0.8;
                voice: any = null;
                onstart: (() => void) | null = null;
                onend: (() => void) | null = null;
                onerror: ((e: any) => void) | null = null;
                constructor(text: string) {
                    this.text = text;
                }
            },
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Property 3: TTS Speech Queue Ordering
     * For any sequence of speak() calls made while speech is in progress,
     * all speeches SHALL be played in the order they were queued.
     */
    it('Property 3: TTS Speech Queue Ordering - speeches are played in FIFO order', async () => {
        const { TTSService } = await import('../../core/audio/audioService');

        await fc.assert(
            fc.asyncProperty(
                // Generate non-whitespace strings to avoid empty text filtering
                fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
                async (texts) => {
                    const tts = new TTSService();
                    speakOrder = [];

                    // Queue all texts
                    const promises = texts.map(text => tts.speak(text));

                    // Wait for all to complete
                    await Promise.all(promises);

                    // Verify order matches input order
                    expect(speakOrder).toEqual(texts);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 4: TTS Speaking State Round-Trip
     * For any speech operation, the Store's speaking state SHALL be true while
     * speech is in progress and SHALL be false after speech completes.
     */
    it('Property 4: TTS Speaking State Round-Trip - speaking state correctly tracks speech', async () => {
        const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');
        const { TTSService } = await import('../../core/audio/audioService');

        const setSpeakingCalls: boolean[] = [];
        const mockSetSpeaking = vi.fn((val: boolean) => setSpeakingCalls.push(val));

        (useDigitalHumanStore.getState as any).mockReturnValue({
            setSpeaking: mockSetSpeaking,
            setBehavior: vi.fn(),
            addError: vi.fn(),
        });

        await fc.assert(
            fc.asyncProperty(
                // Generate non-whitespace strings to ensure valid speech text
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                async (text) => {
                    setSpeakingCalls.length = 0;
                    const tts = new TTSService();

                    await tts.speak(text);

                    // Should have set speaking to true then false
                    const trueIndex = setSpeakingCalls.indexOf(true);
                    const falseIndex = setSpeakingCalls.lastIndexOf(false);

                    expect(trueIndex).toBeGreaterThanOrEqual(0);
                    expect(falseIndex).toBeGreaterThan(trueIndex);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 5: TTS Config Application
     * For any configuration update via updateConfig(), subsequent speak() calls
     * SHALL use the new configuration values.
     */
    it('Property 5: TTS Config Application - config updates are applied', async () => {
        const { TTSService } = await import('../../core/audio/audioService');

        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    rate: fc.double({ min: 0.5, max: 2.0, noNaN: true }),
                    pitch: fc.double({ min: 0.5, max: 2.0, noNaN: true }),
                    volume: fc.double({ min: 0.1, max: 1.0, noNaN: true }),
                }),
                // Generate non-whitespace strings to avoid empty text filtering
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                async (config, text) => {
                    const tts = new TTSService();
                    mockUtterances = []; // Clear previous utterances

                    tts.updateConfig(config);
                    await tts.speak(text);

                    // Check that the utterance was created with the config
                    const lastUtterance = mockUtterances[mockUtterances.length - 1];
                    expect(lastUtterance).toBeDefined();
                    if (lastUtterance) {
                        expect(lastUtterance.rate).toBeCloseTo(config.rate, 1);
                        expect(lastUtterance.pitch).toBeCloseTo(config.pitch, 1);
                        expect(lastUtterance.volume).toBeCloseTo(config.volume, 1);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Additional: Queue length tracking
     */
    it('Queue length accurately reflects pending speeches', async () => {
        const { TTSService } = await import('../../core/audio/audioService');

        await fc.assert(
            fc.asyncProperty(
                // Generate non-whitespace strings to avoid empty text filtering
                fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 0, maxLength: 5 }),
                async (texts) => {
                    const tts = new TTSService();

                    // Initially queue should be empty
                    expect(tts.getQueueLength()).toBe(0);

                    // Queue texts without waiting, catch rejections
                    const promises = texts.map(text => tts.speak(text).catch(() => { }));

                    // Clear queue
                    tts.clearQueue();
                    expect(tts.getQueueLength()).toBe(0);

                    // Wait for all promises to settle
                    await Promise.allSettled(promises);
                }
            ),
            { numRuns: 100 }
        );
    });
});
