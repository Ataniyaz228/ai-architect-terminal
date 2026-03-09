'use client';

import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useSessionStore } from '@/stores';
import { SendIcon, StopIcon } from './Icons';

export default function InputZone() {
    const {
        rawInput,
        setRawInput,
        streamingStatus,
        selectedMode,
        modes,
        output,
        addToHistory,
        conversationHistory,
        pushVersion,
        resetConversation,
    } = useSessionStore();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const refineRef = useRef<HTMLInputElement>(null);
    const [refineInput, setRefineInput] = useState('');

    // Store cleanup functions for active event listeners
    const cleanupRef = useRef<(() => void) | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (cleanupRef.current) cleanupRef.current();
        };
    }, []);

    // Rough token counter (~4 chars per token)
    const estimatedTokens = useMemo(() => {
        return Math.ceil(rawInput.length / 4);
    }, [rawInput]);

    const currentMode = modes.find((m) => m.id === selectedMode);

    // Show refine bar when generation is done and there is output
    const showRefine = streamingStatus === 'idle' && output.length > 0;

    const handleGenerate = useCallback(async () => {
        if (!rawInput.trim() || streamingStatus === 'generating') return;

        const store = useSessionStore.getState();
        store.clearOutput();
        store.setStreamingStatus('generating');
        store.setErrorMessage(null);
        store.setRequestStartTime(Date.now());
        store.setLatencyMs(null);
        store.resetConversation();

        try {
            // Clean up any existing listeners from a previous request
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }

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

                // Save version & conversation history
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

            // Store cleanup function so we can cancel if a new request starts
            cleanupRef.current = () => {
                unlistenChunk();
                unlistenDone();
                unlistenError();
            };

            const result = await invoke<string>('llm_request', {
                payload: {
                    raw_input: rawInput,
                    mode_id: selectedMode,
                    model: store.selectedModel,
                    session_id: store.currentSessionId,
                },
            });

            const parsed = JSON.parse(result);
            store.setCurrentSessionId(parsed.session_id);
            store.setCurrentEntryId(parsed.entry_id);
        } catch (err: unknown) {
            const s = useSessionStore.getState();
            s.setStreamingStatus('error');
            s.setErrorMessage(err instanceof Error ? err.message : String(err));
        }
    }, [rawInput, streamingStatus, selectedMode]);

    const handleRefine = useCallback(async () => {
        if (!refineInput.trim() || streamingStatus === 'generating') return;

        const store = useSessionStore.getState();
        // Don't clear output yet — keep showing previous version while LLM thinks
        store.setStreamingStatus('generating');
        store.setErrorMessage(null);
        store.setRequestStartTime(Date.now());
        store.setLatencyMs(null);

        // Build conversation chain: system + existing history + refine instruction
        const modeConfig = store.modes.find((m) => m.id === store.selectedMode);

        try {
            // Clean up any existing listeners from a previous request
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }

            const { invoke } = await import('@tauri-apps/api/core');
            const { listen } = await import('@tauri-apps/api/event');

            // Build messages from conversation history
            const messages = [
                ...store.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
                { role: 'user', content: refineInput.trim() },
            ];

            // Track whether we've cleared the old output for this refine
            let clearedForRefine = false;

            const unlistenChunk = await listen<{ content: string; done: boolean }>('llm_chunk', (event) => {
                const s = useSessionStore.getState();
                // Clear old output only when the first chunk arrives
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

                // Save version & update conversation
                s.pushVersion(event.payload.total_content);
                s.addToHistory('user', refineInput.trim());
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

            // Store cleanup function
            cleanupRef.current = () => {
                unlistenChunk();
                unlistenDone();
                unlistenError();
            };

            const result = await invoke<string>('llm_request', {
                payload: {
                    raw_input: refineInput.trim(),
                    mode_id: selectedMode,
                    model: store.selectedModel,
                    session_id: store.currentSessionId,
                    messages: messages,
                    skip_entry: true,
                },
            });

            const parsed = JSON.parse(result);
            // We don't update session/entry IDs here because Refine reuses the existing ones
            // (skip_entry is true, so backend returns dummy IDs or we just ignore them)
            setRefineInput('');
        } catch (err: unknown) {
            const s = useSessionStore.getState();
            s.setStreamingStatus('error');
            s.setErrorMessage(err instanceof Error ? err.message : String(err));
        }
    }, [refineInput, streamingStatus, selectedMode]);

    const handleAbort = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('abort_stream');
            useSessionStore.getState().setStreamingStatus('aborted');
        } catch (err) {
            console.error('Abort failed:', err);
        }
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleGenerate();
            }
        },
        [handleGenerate]
    );

    const handleRefineKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleRefine();
            }
        },
        [handleRefine]
    );

    const isGenerating = streamingStatus === 'generating';

    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-primary)',
                minWidth: 0,
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <span
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                    }}
                >
                    {'>'} RAW INPUT
                </span>
                <span
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: estimatedTokens > 3000 ? 'var(--status-warning)' : 'var(--text-muted)',
                    }}
                >
                    ~{estimatedTokens} tokens
                </span>
            </div>

            {/* Textarea */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <textarea
                    ref={textareaRef}
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        currentMode
                            ? `Опиши свою идею для режима "${currentMode.label}"...\n\nМожешь писать хаотично — система структурирует всё за тебя.\n\nCtrl+Enter — отправить`
                            : 'Выбери режим и опиши свою идею...'
                    }
                    disabled={isGenerating}
                    style={{
                        width: '100%',
                        height: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        lineHeight: '1.7',
                        padding: '16px',
                        resize: 'none',
                        outline: 'none',
                        opacity: isGenerating ? 0.5 : 1,
                    }}
                />
            </div>

            {/* Action bar */}
            <div
                style={{
                    padding: '8px 16px',
                    borderTop: '1px solid var(--border-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                }}
            >
                {isGenerating ? (
                    <button
                        onClick={handleAbort}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 16px',
                            background: 'rgba(248, 81, 73, 0.15)',
                            border: '1px solid var(--status-error)',
                            borderRadius: '4px',
                            color: 'var(--status-error)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        <StopIcon size={12} />
                        STOP
                    </button>
                ) : (
                    <button
                        onClick={handleGenerate}
                        disabled={!rawInput.trim()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 16px',
                            background: rawInput.trim() ? 'var(--text-primary)' : 'transparent',
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            color: rawInput.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: rawInput.trim() ? 'pointer' : 'default',
                            transition: 'all 0.15s',
                            opacity: rawInput.trim() ? 1 : 0.5,
                        }}
                    >
                        <SendIcon size={12} />
                        GENERATE
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>Ctrl+↵</span>
                    </button>
                )}
            </div>

            {/* Refine Bar */}
            {showRefine && (
                <div
                    style={{
                        padding: '8px 16px',
                        borderTop: '1px solid var(--border-primary)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        animation: 'fadeIn 0.2s ease',
                    }}
                >
                    <span
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            color: 'var(--accent-primary)',
                            fontWeight: 600,
                        }}
                    >
                        {'>'}
                    </span>
                    <input
                        ref={refineRef}
                        type="text"
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        onKeyDown={handleRefineKeyDown}
                        placeholder="Уточни результат... (например: убери Redis, добавь оффлайн-режим)"
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleRefine}
                        disabled={!refineInput.trim()}
                        style={{
                            padding: '4px 12px',
                            background: refineInput.trim() ? 'var(--text-primary)' : 'transparent',
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            color: refineInput.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: refineInput.trim() ? 'pointer' : 'default',
                            transition: 'all 0.15s',
                        }}
                    >
                        REFINE
                        <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '4px' }}>↵</span>
                    </button>
                </div>
            )}
        </div>
    );
}
