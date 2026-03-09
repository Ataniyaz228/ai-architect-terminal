'use client';

import React from 'react';
import { useSessionStore } from '@/stores';

export default function StatusBar() {
    const {
        streamingStatus,
        selectedModel,
        tokenUsage,
        latencyMs,
        selectedMode,
        modes,
    } = useSessionStore();

    const currentMode = modes.find((m) => m.id === selectedMode);

    const statusColor = {
        idle: 'var(--text-muted)',
        generating: 'var(--accent-primary)',
        error: 'var(--status-error)',
        aborted: 'var(--status-warning)',
    }[streamingStatus];

    const statusText = {
        idle: 'READY',
        generating: 'GENERATING...',
        error: 'ERROR',
        aborted: 'ABORTED',
    }[streamingStatus];

    return (
        <div
            style={{
                height: 'var(--statusbar-height)',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
            }}
        >
            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                    className={streamingStatus === 'generating' ? 'animate-pulse-glow' : ''}
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: statusColor,
                        display: 'inline-block',
                    }}
                />
                <span style={{ color: statusColor }}>{statusText}</span>
            </div>

            {/* Divider */}
            <span style={{ color: 'var(--border-primary)' }}>│</span>

            {/* Mode */}
            {currentMode && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                    {currentMode.label}
                </span>
            )}

            {/* Divider */}
            <span style={{ color: 'var(--border-primary)' }}>│</span>

            {/* Model */}
            <span style={{ color: 'var(--text-tertiary)' }}>{selectedModel}</span>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Token usage */}
            {(tokenUsage.prompt > 0 || tokenUsage.completion > 0) && (
                <>
                    <span style={{ color: 'var(--text-muted)' }}>
                        IN: {tokenUsage.prompt} · OUT: {tokenUsage.completion}
                    </span>
                    <span style={{ color: 'var(--border-primary)' }}>│</span>
                </>
            )}

            {/* Latency */}
            {latencyMs !== null && (
                <span style={{ color: 'var(--text-muted)' }}>
                    {latencyMs < 1000 ? `${latencyMs}ms` : `${(latencyMs / 1000).toFixed(1)}s`}
                </span>
            )}
        </div>
    );
}
