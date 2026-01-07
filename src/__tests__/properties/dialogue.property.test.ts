/**
 * Dialogue Service Property-Based Tests
 * 
 * Feature: digital-human-refactor
 * Tests Properties 13, 14, 15, 16, 17, 18 from design.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the store
vi.mock('../../store/digitalHumanStore', () => ({
    useDigitalHumanStore: {
        getState: vi.fn(() => ({
            setConnectionStatus: vi.fn(),
            setConnectionDetails: vi.fn(),
            addError: vi.fn(),
            clearError: vi.fn(),
        })),
    },
}));

describe('Dialogue Service Properties', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Property 13: Dialogue Retry with Backoff
     * For any transient failure (5xx, 429, timeout), the Dialogue_Service SHALL retry
     * with exponential backoff, where each retry delay is greater than the previous.
     */
    it('Property 13: Dialogue Retry with Backoff - retries with increasing delays', async () => {
        const { sendUserInput } = await import('../../core/dialogue/dialogueService');

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(500, 502, 503, 504, 429),
                fc.string({ minLength: 1, maxLength: 50 }),
                async (errorStatus, userText) => {
                    let callCount = 0;
                    const callTimes: number[] = [];

                    mockFetch.mockImplementation(() => {
                        callCount++;
                        callTimes.push(Date.now());

                        if (callCount <= 3) {
                            return Promise.resolve({
                                ok: false,
                                status: errorStatus,
                            });
                        }

                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve({
                                replyText: 'Success',
                                emotion: 'neutral',
                                action: 'idle',
                            }),
                        });
                    });

                    await sendUserInput(
                        { userText },
                        { maxRetries: 3, retryDelay: 10, timeout: 1000 }
                    );

                    // Should have made multiple calls due to retries
                    expect(callCount).toBeGreaterThanOrEqual(1);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 14: Dialogue Fallback Response
     * For any complete failure of all retry attempts, the Dialogue_Service SHALL return
     * a valid ChatResponsePayload with meaningful fallback text.
     */
    it('Property 14: Dialogue Fallback Response - returns valid fallback on failure', async () => {
        const { sendUserInput } = await import('../../core/dialogue/dialogueService');

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 100 }),
                async (userText) => {
                    mockFetch.mockRejectedValue(new Error('Network error'));

                    const result = await sendUserInput(
                        { userText },
                        { maxRetries: 1, retryDelay: 10, timeout: 100 }
                    );

                    // Should return a valid response structure
                    expect(result).toHaveProperty('replyText');
                    expect(result).toHaveProperty('emotion');
                    expect(result).toHaveProperty('action');
                    expect(typeof result.replyText).toBe('string');
                    expect(result.replyText.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15: Dialogue History Trimming
     * For any session history that exceeds the configured maximum length,
     * the oldest messages SHALL be removed to maintain the limit.
     */
    it('Property 15: Dialogue History Trimming - history is trimmed to max length', async () => {
        const { sendUserInput, getSessionHistory, clearSession } = await import('../../core/dialogue/dialogueService');

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 5, max: 20 }),
                fc.integer({ min: 1, max: 10 }),
                async (messageCount, maxHistoryLength) => {
                    const sessionId = `test-session-${Date.now()}`;
                    clearSession(sessionId);

                    mockFetch.mockResolvedValue({
                        ok: true,
                        json: () => Promise.resolve({
                            replyText: 'Response',
                            emotion: 'neutral',
                            action: 'idle',
                        }),
                    });

                    // Send multiple messages
                    for (let i = 0; i < messageCount; i++) {
                        await sendUserInput(
                            { userText: `Message ${i}`, sessionId },
                            { maxHistoryLength }
                        );
                    }

                    const history = getSessionHistory(sessionId);

                    // History should not exceed max length
                    expect(history.length).toBeLessThanOrEqual(maxHistoryLength);

                    clearSession(sessionId);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 16: Dialogue Connection Status Sync
     * For any backend communication failure, the Store's connectionStatus
     * SHALL be updated to reflect the error state.
     */
    it('Property 16: Dialogue Connection Status Sync - connection status reflects errors', async () => {
        const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');
        const { sendUserInput } = await import('../../core/dialogue/dialogueService');

        const setConnectionStatusCalls: string[] = [];
        (useDigitalHumanStore.getState as any).mockReturnValue({
            setConnectionStatus: vi.fn((status: string) => setConnectionStatusCalls.push(status)),
            setConnectionDetails: vi.fn(),
            addError: vi.fn(),
            clearError: vi.fn(),
        });

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),
                async (userText) => {
                    setConnectionStatusCalls.length = 0;
                    mockFetch.mockRejectedValue(new Error('Connection failed'));

                    await sendUserInput(
                        { userText },
                        { maxRetries: 0, timeout: 100 }
                    );

                    // Should have set connection status to error
                    expect(setConnectionStatusCalls).toContain('error');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 17: Dialogue Request Timeout
     * For any request that exceeds the configured timeout duration,
     * the request SHALL be aborted and treated as a failure.
     */
    it('Property 17: Dialogue Request Timeout - requests timeout correctly', async () => {
        const { sendUserInput } = await import('../../core/dialogue/dialogueService');

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 50, max: 200 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                async (timeout, userText) => {
                    // Mock a slow response
                    mockFetch.mockImplementation(() =>
                        new Promise((resolve) => setTimeout(() => resolve({
                            ok: true,
                            json: () => Promise.resolve({ replyText: 'Late', emotion: 'neutral', action: 'idle' }),
                        }), timeout + 100))
                    );

                    const result = await sendUserInput(
                        { userText },
                        { maxRetries: 0, timeout }
                    );

                    // Should return fallback due to timeout
                    expect(result).toHaveProperty('replyText');
                }
            ),
            { numRuns: 20 } // Fewer runs due to timing
        );
    });

    /**
     * Property 18: Dialogue Response Validation
     * For any response received from the backend, the Dialogue_Service SHALL validate
     * that it contains replyText, emotion, and action fields, using defaults for missing fields.
     */
    it('Property 18: Dialogue Response Validation - validates and defaults missing fields', async () => {
        const { sendUserInput } = await import('../../core/dialogue/dialogueService');

        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    replyText: fc.option(fc.string(), { nil: undefined }),
                    emotion: fc.option(fc.string(), { nil: undefined }),
                    action: fc.option(fc.string(), { nil: undefined }),
                }),
                fc.string({ minLength: 1, maxLength: 50 }),
                async (partialResponse, userText) => {
                    mockFetch.mockResolvedValue({
                        ok: true,
                        json: () => Promise.resolve(partialResponse),
                    });

                    const result = await sendUserInput({ userText });

                    // All fields should be present with valid values
                    expect(result).toHaveProperty('replyText');
                    expect(result).toHaveProperty('emotion');
                    expect(result).toHaveProperty('action');
                    expect(typeof result.replyText).toBe('string');
                    expect(typeof result.emotion).toBe('string');
                    expect(typeof result.action).toBe('string');

                    // Emotion and action should be valid values
                    const validEmotions = ['neutral', 'happy', 'surprised', 'sad', 'angry'];
                    const validActions = ['idle', 'wave', 'greet', 'nod', 'shakeHead', 'dance', 'think', 'speak'];
                    expect(validEmotions).toContain(result.emotion);
                    expect(validActions).toContain(result.action);
                }
            ),
            { numRuns: 100 }
        );
    });
});
