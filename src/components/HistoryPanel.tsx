'use client';

import React, { useEffect, useCallback } from 'react';
import { useHistoryStore, useSessionStore } from '@/stores';
import { XIcon, TrashIcon, ChevronRightIcon, PinIcon } from './Icons';

export default function HistoryPanel() {
    const {
        sessions,
        setSessions,
        activePanel,
        setActivePanel,
        selectedSession,
        setSelectedSession,
        sessionEntries,
        setSessionEntries,
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
    } = useHistoryStore();

    const { setRawInput, setOutput, setCurrentSessionId } = useSessionStore();

    // Load sessions on mount
    useEffect(() => {
        if (activePanel !== 'history') return;
        loadSessions();
    }, [activePanel]);

    const loadSessions = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const result = await invoke<typeof sessions>('list_sessions');
            setSessions(result);
        } catch (err) {
            console.error('Failed to load sessions:', err);
        }
    }, [setSessions]);

    const loadEntries = useCallback(async (sessionId: string) => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const result = await invoke<typeof sessionEntries>('get_session_entries', {
                sessionId,
            });
            setSessionEntries(result);
        } catch (err) {
            console.error('Failed to load entries:', err);
        }
    }, [setSessionEntries]);

    const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('delete_session', { sessionId });
            loadSessions();
            if (selectedSession?.id === sessionId) {
                setSelectedSession(null);
                setSessionEntries([]);
            }
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    }, [loadSessions, selectedSession, setSelectedSession, setSessionEntries]);

    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const result = await invoke<typeof searchResults>('search_entries', { query });
            setSearchResults(result);
        } catch (err) {
            console.error('Search failed:', err);
        }
    }, [setSearchQuery, setSearchResults]);

    const handleLoadEntry = useCallback((entry: { raw_input: string; generated_prompt: string; session_id: string }) => {
        setRawInput(entry.raw_input);
        setOutput(entry.generated_prompt);
        setCurrentSessionId(entry.session_id);
        setActivePanel('none');
    }, [setRawInput, setOutput, setCurrentSessionId, setActivePanel]);

    if (activePanel !== 'history') return null;

    return (
        <div
            style={{
                width: '320px',
                minWidth: '320px',
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
                    HISTORY
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

            {/* Search */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-secondary)' }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search history..."
                    style={{
                        width: '100%',
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
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {searchQuery && searchResults.length > 0 ? (
                    // Search results
                    <div style={{ padding: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', padding: '0 4px' }}>
                            {searchResults.length} results
                        </span>
                        {searchResults.map((entry) => (
                            <button
                                key={entry.id}
                                onClick={() => handleLoadEntry(entry)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    margin: '4px 0',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-secondary)',
                                    borderRadius: '4px',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-secondary)';
                                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                                }}
                            >
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.raw_input.slice(0, 80)}
                                </div>
                                {entry.pinned && (
                                    <PinIcon size={10} className="" />
                                )}
                            </button>
                        ))}
                    </div>
                ) : selectedSession ? (
                    // Session entries
                    <div style={{ padding: '8px' }}>
                        <button
                            onClick={() => { setSelectedSession(null); setSessionEntries([]); }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                                cursor: 'pointer',
                                marginBottom: '8px',
                            }}
                        >
                            ← Back
                        </button>
                        <div
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--text-primary)',
                                padding: '0 4px 8px',
                                fontWeight: 600,
                            }}
                        >
                            {selectedSession.title.slice(0, 50)}
                        </div>
                        {sessionEntries.map((entry) => (
                            <button
                                key={entry.id}
                                onClick={() => handleLoadEntry(entry)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    margin: '4px 0',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-secondary)',
                                    borderRadius: '4px',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-secondary)';
                                }}
                            >
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.raw_input.slice(0, 80)}
                                </div>
                                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {new Date(entry.created_at).toLocaleString()}
                                    {entry.pinned && ' · 📌'}
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    // Sessions list
                    <div style={{ padding: '8px' }}>
                        {sessions.length === 0 ? (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '40px 16px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                }}
                            >
                                No sessions yet.
                                <br />
                                Start generating prompts.
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <button
                                    key={session.id}
                                    onClick={() => {
                                        setSelectedSession(session);
                                        loadEntries(session.id);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        margin: '2px 0',
                                        background: 'transparent',
                                        border: '1px solid transparent',
                                        borderRadius: '4px',
                                        color: 'var(--text-secondary)',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '11px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--bg-hover)';
                                        e.currentTarget.style.borderColor = 'var(--border-secondary)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.borderColor = 'transparent';
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {session.title.slice(0, 45)}
                                        </div>
                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {session.mode} · {new Date(session.updated_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <button
                                            onClick={(e) => handleDeleteSession(session.id, e)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                padding: '2px',
                                                opacity: 0.5,
                                                transition: 'opacity 0.15s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.opacity = '1';
                                                e.currentTarget.style.color = 'var(--status-error)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.opacity = '0.5';
                                                e.currentTarget.style.color = 'var(--text-muted)';
                                            }}
                                        >
                                            <TrashIcon size={12} />
                                        </button>
                                        <ChevronRightIcon size={12} />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
