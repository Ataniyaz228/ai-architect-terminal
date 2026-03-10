'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSessionStore } from '@/stores';
import { CopyIcon, DownloadIcon, PinIcon, CheckIcon } from './Icons';
import FloatingCommandBar from './FloatingCommandBar';

// Fix #8: extracted shared button style to avoid ~60 lines of duplication
interface ActionButtonProps {
    onClick: () => void;
    title: string;
    active?: boolean;
    children: React.ReactNode;
}

function ActionButton({ onClick, title, active, children }: ActionButtonProps) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={onClick}
            title={title}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                background: 'transparent',
                border: `1px solid ${hovered ? 'var(--text-muted)' : 'var(--border-primary)'}`,
                borderRadius: '4px',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s',
            }}
        >
            {children}
        </button>
    );
}

export default function OutputZone() {
    const {
        output,
        streamingStatus,
        errorMessage,
        versions,
        currentVersionIndex,
        currentEntryId, // Fix #9: moved here instead of calling getState() inside callback
        goToVersion,
        inlineEditLoading,
    } = useSessionStore();

    const outputRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    // Auto-scroll during streaming
    useEffect(() => {
        if (streamingStatus === 'generating' && outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output, streamingStatus]);

    const handleCopy = useCallback(async () => {
        if (!output) return;
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [output]);

    const handleExport = useCallback(() => {
        if (!output) return;
        const blob = new Blob([output], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompt-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }, [output]);

    // Fix #9: use currentEntryId from hook destructure, not getState() inside callback
    const handlePin = useCallback(async () => {
        if (!currentEntryId) return;
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('toggle_pin', { entryId: currentEntryId });
        } catch (err) {
            console.error('Pin failed:', err);
        }
    }, [currentEntryId]);

    const isGenerating = streamingStatus === 'generating';
    const isAborted = streamingStatus === 'aborted';
    const isEmpty = !output && streamingStatus === 'idle';
    const hasVersions = versions.length > 1;

    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-primary)',
                borderLeft: '1px solid var(--border-primary)',
                minWidth: 0,
                position: 'relative',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                        }}
                    >
                        {'>'} OUTPUT
                    </span>
                    {isGenerating && (
                        <span
                            className="animate-pulse-glow"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                                color: 'var(--accent-primary)',
                            }}
                        >
                            ● GENERATING...
                        </span>
                    )}
                    {inlineEditLoading && (
                        <span
                            className="animate-pulse-glow"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                                color: 'var(--status-warning)',
                            }}
                        >
                            ● EDITING...
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Version Navigator */}
                    {hasVersions && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '4px',
                                border: '1px solid var(--border-secondary)',
                            }}
                        >
                            <button
                                onClick={() => goToVersion(currentVersionIndex - 1)}
                                disabled={currentVersionIndex <= 0}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: currentVersionIndex > 0 ? 'var(--text-secondary)' : 'var(--border-primary)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    cursor: currentVersionIndex > 0 ? 'pointer' : 'default',
                                    padding: '0 2px',
                                }}
                            >
                                ◀
                            </button>
                            <span
                                style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '10px',
                                    color: 'var(--text-primary)',
                                    fontWeight: 600,
                                    minWidth: '50px',
                                    textAlign: 'center',
                                }}
                            >
                                v{currentVersionIndex + 1} / {versions.length}
                            </span>
                            <button
                                onClick={() => goToVersion(currentVersionIndex + 1)}
                                disabled={currentVersionIndex >= versions.length - 1}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: currentVersionIndex < versions.length - 1 ? 'var(--text-secondary)' : 'var(--border-primary)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    cursor: currentVersionIndex < versions.length - 1 ? 'pointer' : 'default',
                                    padding: '0 2px',
                                }}
                            >
                                ▶
                            </button>
                        </div>
                    )}

                    {/* Fix #8: use ActionButton instead of duplicated inline styles */}
                    {output && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <ActionButton onClick={handleCopy} title="Copy to clipboard" active={copied}>
                                {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                                {copied ? 'COPIED' : 'COPY'}
                            </ActionButton>
                            <ActionButton onClick={handleExport} title="Export as .md">
                                <DownloadIcon size={11} />
                                .MD
                            </ActionButton>
                            <ActionButton onClick={handlePin} title="Pin entry">
                                <PinIcon size={11} />
                                PIN
                            </ActionButton>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div
                ref={outputRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '16px',
                    position: 'relative',
                }}
            >
                {isEmpty && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            gap: '12px',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '40px',
                                color: 'var(--border-primary)',
                            }}
                        >
                            ⟩
                        </span>
                        <span
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                textAlign: 'center',
                                lineHeight: '1.8',
                            }}
                        >
                            Результат генерации появится здесь.
                            <br />
                            Выбери режим, введи контекст и нажми GENERATE.
                        </span>
                    </div>
                )}

                {errorMessage && (
                    <div
                        className="animate-fade-in"
                        style={{
                            padding: '12px 16px',
                            background: 'rgba(248, 81, 73, 0.1)',
                            border: '1px solid var(--status-error)',
                            borderRadius: '4px',
                            marginBottom: '12px',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--status-error)',
                            }}
                        >
                            ERROR: {errorMessage}
                        </span>
                    </div>
                )}

                {/* Fix #10: show aborted banner so user knows generation was stopped */}
                {isAborted && (
                    <div
                        className="animate-fade-in"
                        style={{
                            padding: '8px 16px',
                            background: 'rgba(210, 153, 34, 0.1)',
                            border: '1px solid var(--status-warning)',
                            borderRadius: '4px',
                            marginBottom: '12px',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--status-warning)',
                            }}
                        >
                            ■ GENERATION STOPPED — partial result shown below
                        </span>
                    </div>
                )}

                {output && (
                    <div className={`markdown-output animate-fade-in ${isGenerating ? 'streaming-cursor' : ''}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {output}
                        </ReactMarkdown>
                    </div>
                )}

                {/* Floating Command Bar for inline editing */}
                {output && !isGenerating && <FloatingCommandBar containerRef={outputRef} />}
            </div>
        </div>
    );
}
