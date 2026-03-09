'use client';

import React from 'react';
import { useSessionStore } from '@/stores';
import { iconMap } from './Icons';

export default function ModeSelector() {
    const { modes, selectedMode, setSelectedMode } = useSessionStore();

    return (
        <div
            style={{
                height: 'var(--mode-bar-height)',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '6px',
                overflowX: 'auto',
            }}
        >
            <span
                style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginRight: '8px',
                    whiteSpace: 'nowrap',
                }}
            >
                MODE:
            </span>

            {modes.map((mode) => {
                const isActive = selectedMode === mode.id;
                const IconComponent = iconMap[mode.icon];
                return (
                    <button
                        key={mode.id}
                        onClick={() => setSelectedMode(mode.id)}
                        title={mode.description}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            background: isActive ? 'var(--bg-elevated)' : 'transparent',
                            border: isActive
                                ? '1px solid var(--border-primary)'
                                : '1px solid transparent',
                            borderRadius: '6px',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '12px',
                            fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.color = 'var(--text-primary)';
                                e.currentTarget.style.background = 'var(--bg-hover)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        {IconComponent && <IconComponent size={13} />}
                        {mode.label}
                    </button>
                );
            })}
        </div>
    );
}
