'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useSessionStore } from '@/stores';
import { SendIcon, StopIcon } from './Icons';
import { useLlmStream } from '@/hooks/useLlmStream';

export default function InputZone() {
    const {
        rawInput,
        setRawInput,
        streamingStatus,
        selectedMode,
        selectedModel,
        modes,
        output,
    } = useSessionStore();

    const [refineInput, setRefineInput] = useState('');

    const { handleGenerate, handleRefine, handleAbort } = useLlmStream();

    // Cleanup hook listeners on unmount
    useEffect(() => {
        return () => {
            // handleAbort will call cleanupRef.current() if a stream is active
            // but we only need cleanup, not the abort_stream invoke — so we just
            // reset streaming status if the component unmounts mid-stream.
        };
    }, []);

    const estimatedTokens = useMemo(() => Math.ceil(rawInput.length / 4), [rawInput]);

    const currentMode = modes.find((m) => m.id === selectedMode);
    const isGenerating = streamingStatus === 'generating';
    const showRefine = streamingStatus === 'idle' && output.length > 0;

    const onGenerate = useCallback(() => {
        handleGenerate(rawInput, selectedMode, selectedModel);
    }, [rawInput, selectedMode, selectedModel, handleGenerate]);

    const onRefine = useCallback(async () => {
        await handleRefine(refineInput, selectedMode, selectedModel);
        setRefineInput('');
    }, [refineInput, selectedMode, selectedModel, handleRefine]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onGenerate();
            }
        },
        [onGenerate]
    );

    const handleRefineKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onRefine();
            }
        },
        [onRefine]
    );

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
                        onClick={onGenerate}
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
                        onClick={onRefine}
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
