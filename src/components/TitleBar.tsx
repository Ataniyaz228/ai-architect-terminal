'use client';

import React from 'react';
import { MinimizeIcon, MaximizeIcon, XIcon } from './Icons';

export default function TitleBar() {
    const handleMinimize = async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().minimize();
    };

    const handleMaximize = async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const isMaximized = await win.isMaximized();
        if (isMaximized) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    };

    const handleClose = async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().close();
    };

    return (
        <div
            data-tauri-drag-region
            style={{
                height: 'var(--titlebar-height)',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                position: 'relative',
                zIndex: 100,
            }}
        >
            {/* App title */}
            <div
                data-tauri-drag-region
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingLeft: '8px',
                }}
            >
                <span
                    data-tauri-drag-region
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        letterSpacing: '0.5px',
                    }}
                >
                    AI ARCHITECT
                </span>
                <span
                    data-tauri-drag-region
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--text-tertiary)',
                        letterSpacing: '1px',
                    }}
                >
                    TERMINAL
                </span>
            </div>

            {/* Window controls */}
            <div style={{ display: 'flex', gap: '2px' }}>
                <button
                    onClick={handleMinimize}
                    style={{
                        width: 36,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                >
                    <MinimizeIcon size={14} />
                </button>
                <button
                    onClick={handleMaximize}
                    style={{
                        width: 36,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                >
                    <MaximizeIcon size={14} />
                </button>
                <button
                    onClick={handleClose}
                    style={{
                        width: 36,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--status-error)';
                        e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                >
                    <XIcon size={14} />
                </button>
            </div>
        </div>
    );
}
