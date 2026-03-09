'use client';

import React from 'react';
import { HomeIcon, HistoryIcon, SettingsIcon } from './Icons';
import { useHistoryStore } from '@/stores';

export default function Rail() {
    const { activePanel, setActivePanel } = useHistoryStore();

    const items = [
        { id: 'none' as const, icon: HomeIcon, label: 'Workspace' },
        { id: 'history' as const, icon: HistoryIcon, label: 'History' },
        { id: 'settings' as const, icon: SettingsIcon, label: 'Settings' },
    ];

    return (
        <div
            style={{
                width: 'var(--rail-width)',
                minWidth: 'var(--rail-width)',
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-primary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '12px',
                gap: '4px',
            }}
        >
            {items.map((item) => {
                const isActive = activePanel === item.id || (item.id === 'none' && activePanel === 'none');
                return (
                    <button
                        key={item.id}
                        onClick={() => setActivePanel(activePanel === item.id ? 'none' : item.id)}
                        title={item.label}
                        style={{
                            width: 36,
                            height: 36,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isActive ? 'var(--bg-hover)' : 'transparent',
                            border: 'none',
                            borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            borderRadius: '0 4px 4px 0',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.background = 'var(--bg-hover)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.color = 'var(--text-tertiary)';
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        <item.icon size={18} />
                    </button>
                );
            })}

            {/* Version indicator at bottom */}
            <div style={{ marginTop: 'auto', paddingBottom: '12px' }}>
                <span
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '8px',
                        color: 'var(--text-muted)',
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        letterSpacing: '1px',
                    }}
                >
                    v0.1.0
                </span>
            </div>
        </div>
    );
}
