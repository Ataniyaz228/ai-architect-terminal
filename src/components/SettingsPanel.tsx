'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useHistoryStore, useSettingsStore, useSessionStore } from '@/stores';
import { XIcon, CheckIcon } from './Icons';

export default function SettingsPanel() {
    const { activePanel, setActivePanel } = useHistoryStore();
    const { openaiKeySet, setOpenaiKeySet } = useSettingsStore();
    const { selectedModel, setSelectedModel } = useSessionStore();

    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8045/v1');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (activePanel !== 'settings') return;
        checkKeyStatus();
        loadBaseUrl();
    }, [activePanel]);

    const checkKeyStatus = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const isSet = await invoke<boolean>('get_api_key_status');
            setOpenaiKeySet(isSet);
        } catch {
            // Dev mode without Tauri
        }
    }, [setOpenaiKeySet]);

    const loadBaseUrl = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const url = await invoke<string>('get_base_url');
            setBaseUrl(url);
        } catch {
            // Dev mode
        }
    }, []);

    const handleSaveKey = useCallback(async () => {
        if (!apiKey.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('save_api_key', { key: apiKey.trim() });
            setOpenaiKeySet(true);
            setApiKey('');
            setMessage('API key saved securely ✓');
        } catch (err) {
            setMessage(`Error: ${err}`);
        }
        setSaving(false);
    }, [apiKey, setOpenaiKeySet]);

    const handleSaveBaseUrl = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('save_base_url', { url: baseUrl.trim() });
            setMessage('Base URL saved ✓');
        } catch (err) {
            setMessage(`Error: ${err}`);
        }
    }, [baseUrl]);

    const handleDeleteKey = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('delete_api_key');
            setOpenaiKeySet(false);
            setMessage('API key deleted');
        } catch (err) {
            setMessage(`Error: ${err}`);
        }
    }, [setOpenaiKeySet]);

    if (activePanel !== 'settings') return null;

    const models = [
        { id: 'gemini-3.1-pro-high', label: 'Gemini 3.1 Pro High' },
        { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4' },
        { id: 'claude-opus-4-6-thinking', label: 'Claude Opus 4 (Thinking)' },
        { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    ];

    return (
        <div
            style={{
                width: '360px',
                minWidth: '360px',
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-primary)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <span
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                    }}
                >
                    SETTINGS
                </span>
                <button
                    onClick={() => setActivePanel('none')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        padding: '2px',
                    }}
                >
                    <XIcon size={14} />
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                {/* Model selector */}
                <div style={{ marginBottom: '24px' }}>
                    <label
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            display: 'block',
                            marginBottom: '8px',
                        }}
                    >
                        MODEL
                    </label>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 10px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            outline: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        {models.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Base URL */}
                <div style={{ marginBottom: '24px' }}>
                    <label
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            display: 'block',
                            marginBottom: '8px',
                        }}
                    >
                        API BASE URL
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="http://127.0.0.1:8045/v1"
                            style={{
                                flex: 1,
                                padding: '6px 10px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                outline: 'none',
                            }}
                        />
                        <button
                            onClick={handleSaveBaseUrl}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--accent-glow)',
                                border: '1px solid var(--accent-dim)',
                                borderRadius: '4px',
                                color: 'var(--accent-primary)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                                cursor: 'pointer',
                            }}
                        >
                            SAVE
                        </button>
                    </div>
                </div>

                {/* API Key */}
                <div style={{ marginBottom: '20px' }}>
                    <label
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '8px',
                        }}
                    >
                        API KEY
                        {openaiKeySet && (
                            <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <CheckIcon size={10} /> SET
                            </span>
                        )}
                    </label>

                    {openaiKeySet ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span
                                style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    color: 'var(--text-tertiary)',
                                }}
                            >
                                ●●●●●●●●●●●●
                            </span>
                            <button
                                onClick={handleDeleteKey}
                                style={{
                                    padding: '4px 8px',
                                    background: 'transparent',
                                    border: '1px solid var(--status-error)',
                                    borderRadius: '4px',
                                    color: 'var(--status-error)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                }}
                            >
                                DELETE
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                style={{
                                    flex: 1,
                                    padding: '6px 10px',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={handleSaveKey}
                                disabled={!apiKey.trim() || saving}
                                style={{
                                    padding: '6px 12px',
                                    background: apiKey.trim() ? 'var(--accent-glow)' : 'transparent',
                                    border: apiKey.trim()
                                        ? '1px solid var(--accent-dim)'
                                        : '1px solid var(--border-primary)',
                                    borderRadius: '4px',
                                    color: apiKey.trim() ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '10px',
                                    cursor: apiKey.trim() ? 'pointer' : 'default',
                                }}
                            >
                                {saving ? '...' : 'SAVE'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Message */}
                {message && (
                    <div
                        style={{
                            padding: '8px 12px',
                            background: message.startsWith('Error')
                                ? 'rgba(248, 81, 73, 0.1)'
                                : 'var(--accent-glow)',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            color: message.startsWith('Error')
                                ? 'var(--status-error)'
                                : 'var(--accent-primary)',
                            marginTop: '8px',
                        }}
                    >
                        {message}
                    </div>
                )}

                {/* Security note */}
                <div
                    style={{
                        marginTop: '24px',
                        padding: '12px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        border: '1px solid var(--border-secondary)',
                    }}
                >
                    <span
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            lineHeight: '1.6',
                        }}
                    >
                        🔒 API key is stored securely in your OS Keychain
                        (Windows Credential Manager). It never leaves
                        the Rust backend and is never exposed to the browser.
                    </span>
                </div>
            </div>
        </div>
    );
}
