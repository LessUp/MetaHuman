/**
 * Store Property-Based Tests
 * 
 * Feature: digital-human-refactor
 * Tests Properties 27, 28, 29, 30 from design.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};

Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
});

describe('Store Properties', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockLocalStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    /**
     * Property 27: Store Session ID Availability
     * For any Store initialization, a valid session ID SHALL be available
     * regardless of localStorage availability.
     */
    it('Property 27: Store Session ID Availability - always has valid session ID', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.boolean(), // localStorage available
                async (storageAvailable) => {
                    // Reset module cache
                    vi.resetModules();

                    if (!storageAvailable) {
                        mockLocalStorage.getItem.mockImplementation(() => { throw new Error('Storage unavailable'); });
                        mockLocalStorage.setItem.mockImplementation(() => { throw new Error('Storage unavailable'); });
                    } else {
                        mockLocalStorage.getItem.mockImplementation((key: string) => mockStorage[key] || null);
                        mockLocalStorage.setItem.mockImplementation((key: string, value: string) => { mockStorage[key] = value; });
                    }

                    const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');
                    const state = useDigitalHumanStore.getState();

                    // Session ID should always be present and valid
                    expect(state.sessionId).toBeDefined();
                    expect(typeof state.sessionId).toBe('string');
                    expect(state.sessionId.length).toBeGreaterThan(0);
                    expect(state.sessionId).toMatch(/^session_/);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 28: Store Error Auto-Clear
     * For any error added to the Store with an autoHideMs value,
     * the error SHALL be automatically removed after the specified duration.
     */
    it('Property 28: Store Error Auto-Clear - errors auto-clear after duration', async () => {
        vi.resetModules();
        const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');

        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 100 }),
                fc.integer({ min: 100, max: 1000 }),
                async (errorMessage, autoHideMs) => {
                    const store = useDigitalHumanStore.getState();

                    // Clear existing errors
                    store.clearAllErrors();

                    // Add error with auto-hide
                    store.addError(errorMessage, 'error', autoHideMs);

                    // Error should be in queue
                    let state = useDigitalHumanStore.getState();
                    expect(state.errorQueue.length).toBeGreaterThan(0);

                    // Fast-forward past auto-hide duration
                    vi.advanceTimersByTime(autoHideMs + 100);

                    // Error should be removed
                    state = useDigitalHumanStore.getState();
                    const errorStillExists = state.errorQueue.some(e => e.message === errorMessage);
                    expect(errorStillExists).toBe(false);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 29: Store Connection State Transitions
     * For any connection status change, the transition SHALL follow valid paths:
     * disconnected → connecting → connected, or any state → error.
     */
    it('Property 29: Store Connection State Transitions - follows valid paths', async () => {
        vi.resetModules();
        const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');

        const validTransitions: Record<string, string[]> = {
            'disconnected': ['connecting', 'error'],
            'connecting': ['connected', 'error', 'disconnected'],
            'connected': ['disconnected', 'error'],
            'error': ['connecting', 'disconnected', 'connected'],
        };

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('disconnected', 'connecting', 'connected', 'error'),
                fc.constantFrom('disconnected', 'connecting', 'connected', 'error'),
                async (fromState, toState) => {
                    vi.resetModules();
                    const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');
                    const store = useDigitalHumanStore.getState();

                    // Set initial state (force it)
                    (store as any).connectionStatus = fromState;

                    // Attempt transition
                    store.setConnectionStatus(toState as any);

                    const newState = useDigitalHumanStore.getState();

                    // If transition is valid, state should change
                    // If invalid, state should remain (or warning logged)
                    const isValidTransition = validTransitions[fromState]?.includes(toState) || fromState === toState;

                    if (isValidTransition) {
                        expect(newState.connectionStatus).toBe(toState);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 30: Store Chat History Limit
     * For any chat history that exceeds the maximum configured length,
     * adding a new message SHALL remove the oldest message to maintain the limit.
     */
    it('Property 30: Store Chat History Limit - maintains max length', async () => {
        vi.resetModules();
        const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');

        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 5, max: 20 }),
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 30 }),
                async (maxLength, messages) => {
                    vi.resetModules();
                    const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');
                    const store = useDigitalHumanStore.getState();

                    // Set max length
                    (store as any).maxChatHistoryLength = maxLength;

                    // Clear history
                    store.clearChatHistory();

                    // Add messages
                    messages.forEach((msg, i) => {
                        store.addChatMessage(i % 2 === 0 ? 'user' : 'assistant', msg);
                    });

                    const state = useDigitalHumanStore.getState();

                    // History should not exceed max length
                    expect(state.chatHistory.length).toBeLessThanOrEqual(maxLength);

                    // If we added more than max, oldest should be removed
                    if (messages.length > maxLength) {
                        // The first message should not be the first one we added
                        const firstMessage = state.chatHistory[0];
                        expect(firstMessage?.text).not.toBe(messages[0]);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Additional: Error queue length limit
     */
    it('Error queue respects max length', async () => {
        vi.resetModules();
        const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');

        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
                async (errorMessages) => {
                    vi.resetModules();
                    const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');
                    const store = useDigitalHumanStore.getState();

                    store.clearAllErrors();

                    // Add many errors
                    errorMessages.forEach(msg => {
                        store.addError(msg, 'error', 0); // No auto-hide
                    });

                    const state = useDigitalHumanStore.getState();

                    // Queue should not exceed max length
                    expect(state.errorQueue.length).toBeLessThanOrEqual(state.maxErrorQueueLength);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Additional: Dismiss error removes from queue
     */
    it('Dismiss error removes specific error', async () => {
        vi.resetModules();
        const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');

        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
                fc.integer({ min: 0, max: 4 }),
                async (errorMessages, dismissIndex) => {
                    vi.resetModules();
                    const { useDigitalHumanStore } = await import('../../store/digitalHumanStore');
                    const store = useDigitalHumanStore.getState();

                    store.clearAllErrors();

                    // Add errors
                    errorMessages.forEach(msg => {
                        store.addError(msg, 'error', 0);
                    });

                    let state = useDigitalHumanStore.getState();
                    const actualIndex = Math.min(dismissIndex, state.errorQueue.length - 1);

                    if (state.errorQueue.length > 0 && actualIndex >= 0) {
                        const errorToDismiss = state.errorQueue[actualIndex];

                        store.dismissError(errorToDismiss.id);

                        state = useDigitalHumanStore.getState();

                        // Error should be removed
                        const stillExists = state.errorQueue.some(e => e.id === errorToDismiss.id);
                        expect(stillExists).toBe(false);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
