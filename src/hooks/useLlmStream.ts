'use client';

import { useRef, useCallback } from 'react';
import { useSessionStore } from '@/stores';

/**
 * Encapsulates all streaming LLM logic: generate, refine, abort.
 * Fixes:
 *   #1 — abort leaks listeners no more (cleanupRef called in handleAbort)
 *   #2 — refine race condition fixed (snapshot of refineInput before first await)
 *   #5 — logic extracted from InputZone into this hook
 */
export function useLlmStream() {
    // Holds unlisten fns for the active request — cleaned up on abort or new request
    const cleanupRef = useRef<(() => void) | null>(null);

    const handleGenerate = useCallback(async (
        rawInput: string,
        selectedMode: string,
        selectedModel: string,
    ) => {
        const store = useSessionStore.getState();
        if (!rawInput.trim() || store.streamingStatus === 'generating') return;

        store.clearOutput();
        store.setStreamingStatus('generating');
        store.setErrorMessage(null);
        store.setRequestStartTime(Date.now());
        store.setLatencyMs(null);
        store.resetConversation();

        // Clean up any existing listeners from a previous request
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const { listen } = await import('@tauri-apps/api/event');

            const unlistenChunk = await listen<{ content: string; done: boolean }>('llm_chunk', (event) => {
                const s = useSessionStore.getState();
                if (s.latencyMs === null && s.requestStartTime) {
                    s.setLatencyMs(Date.now() - s.requestStartTime);
                }
                s.appendOutput(event.payload.content);
            });

            const unlistenDone = await listen<{ total_content: string; prompt_tokens: number; completion_tokens: number }>('llm_done', (event) => {
                const s = useSessionStore.getState();
                s.setStreamingStatus('idle');
                s.setTokenUsage({
                    prompt: event.payload.prompt_tokens,
                    completion: event.payload.completion_tokens,
                });
                if (s.latencyMs === null && s.requestStartTime) {
                    s.setLatencyMs(Date.now() - s.requestStartTime);
                }
                s.pushVersion(event.payload.total_content);
                s.addToHistory('user', s.rawInput);
                s.addToHistory('assistant', event.payload.total_content);

                if (s.currentEntryId) {
                    invoke('save_entry_result', {
                        entryId: s.currentEntryId,
                        prompt: event.payload.total_content,
                        status: 'complete',
                        tokensPrompt: event.payload.prompt_tokens,
                        tokensCompletion: event.payload.completion_tokens,
                    }).catch(console.error);
                }

                cleanupRef.current = null;
                unlistenChunk();
                unlistenDone();
                unlistenError();
            });

            const unlistenError = await listen<{ message: string; error_type: string }>('llm_error', (event) => {
                const s = useSessionStore.getState();
                s.setStreamingStatus('error');
                s.setErrorMessage(event.payload.message);
                cleanupRef.current = null;
                unlistenChunk();
                unlistenDone();
                unlistenError();
            });

            cleanupRef.current = () => {
                unlistenChunk();
                unlistenDone();
                unlistenError();
            };

            const result = await invoke<string>('llm_request', {
                payload: {
                    raw_input: rawInput,
                    mode_id: selectedMode,
                    model: selectedModel,
                    session_id: store.currentSessionId,
                },
            });

            const parsed = JSON.parse(result);
            useSessionStore.getState().setCurrentSessionId(parsed.session_id);
            useSessionStore.getState().setCurrentEntryId(parsed.entry_id);
        } catch (err: unknown) {
            const s = useSessionStore.getState();
            s.setStreamingStatus('error');
            s.setErrorMessage(err instanceof Error ? err.message : String(err));
        }
    }, []);

    const handleRefine = useCallback(async (
        refineInput: string,
        selectedMode: string,
        selectedModel: string,
    ) => {
        // Fix #2: snapshot value before any await so closures capture the right string
        const refinedText = refineInput.trim();
        const store = useSessionStore.getState();

        if (!refinedText || store.streamingStatus === 'generating') return;

        store.setStreamingStatus('generating');
        store.setErrorMessage(null);
        store.setRequestStartTime(Date.now());
        store.setLatencyMs(null);

        // Clean up any existing listeners
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const { listen } = await import('@tauri-apps/api/event');

            const messages = [
                ...store.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
                { role: 'user', content: refinedText },
            ];

            let clearedForRefine = false;

            const unlistenChunk = await listen<{ content: string; done: boolean }>('llm_chunk', (event) => {
                const s = useSessionStore.getState();
                if (!clearedForRefine) {
                    s.clearOutput();
                    clearedForRefine = true;
                }
                if (s.latencyMs === null && s.requestStartTime) {
                    s.setLatencyMs(Date.now() - s.requestStartTime);
                }
                s.appendOutput(event.payload.content);
            });

            const unlistenDone = await listen<{ total_content: string; prompt_tokens: number; completion_tokens: number }>('llm_done', (event) => {
                const s = useSessionStore.getState();
                s.setStreamingStatus('idle');
                s.setTokenUsage({
                    prompt: event.payload.prompt_tokens,
                    completion: event.payload.completion_tokens,
                });
                if (s.latencyMs === null && s.requestStartTime) {
                    s.setLatencyMs(Date.now() - s.requestStartTime);
                }
                s.pushVersion(event.payload.total_content);
                // Fix #2: use refinedText snapshot, not a captured state variable
                s.addToHistory('user', refinedText);
                s.addToHistory('assistant', event.payload.total_content);

                cleanupRef.current = null;
                unlistenChunk();
                unlistenDone();
                unlistenError();
            });

            const unlistenError = await listen<{ message: string; error_type: string }>('llm_error', (event) => {
                const s = useSessionStore.getState();
                s.setStreamingStatus('error');
                s.setErrorMessage(event.payload.message);
                cleanupRef.current = null;
                unlistenChunk();
                unlistenDone();
                unlistenError();
            });

            cleanupRef.current = () => {
                unlistenChunk();
                unlistenDone();
                unlistenError();
            };

            await invoke<string>('llm_request', {
                payload: {
                    raw_input: refinedText,
                    mode_id: selectedMode,
                    model: selectedModel,
                    session_id: store.currentSessionId,
                    messages,
                    skip_entry: true,
                },
            });
        } catch (err: unknown) {
            const s = useSessionStore.getState();
            s.setStreamingStatus('error');
            s.setErrorMessage(err instanceof Error ? err.message : String(err));
        }
    }, []);

    const handleAbort = useCallback(async () => {
        // Fix #1: clean up listeners BEFORE telling the backend to abort,
        // so no stale llm_chunk/llm_done events fire after abort
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('abort_stream');
            useSessionStore.getState().setStreamingStatus('aborted');
        } catch (err) {
            console.error('Abort failed:', err);
        }
    }, []);

    return { handleGenerate, handleRefine, handleAbort };
}
