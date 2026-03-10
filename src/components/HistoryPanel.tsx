'use client';

import React, { useEffect, useCallback } from 'react';
import { useHistoryStore, useSessionStore } from '@/stores';
import { XIcon, TrashIcon, PinIcon } from './Icons';

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

    const {
        setRawInput,
        setOutput,
        setCurrentSessionId,
        setCurrentEntryId,
        startNewSession,
        pushVersion,
        resetConversation,
        setSelectedMode,
    } = useSessionStore();

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

    const handleLoadSession = useCallback(async (session: typeof sessions[0]) => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            // Load all entries for this session (versions)
            const entries = await invoke<typeof sessionEntries>('get_session_entries', {
                sessionId: session.id,
            });

            if (entries.length === 0) return;

            // Get the latest entry
            const latest = entries[entries.length - 1];

            // Restore state
            resetConversation();
            setRawInput(latest.raw_input);
            setOutput(latest.generated_prompt);
            setCurrentSessionId(session.id);
            setCurrentEntryId(latest.id);
            setSelectedMode(session.mode);

            // Populate versions from all entries
            entries.forEach((entry: typeof latest) => {
                if (entry.generated_prompt) {
                    pushVersion(entry.generated_prompt);
                }
            });

            setActivePanel('none');
        } catch (err) {
            console.error('Failed to load session:', err);
        }
    }, [setRawInput, setOutput, setCurrentSessionId, setCurrentEntryId, setActivePanel, resetConversation, pushVersion, setSelectedMode]);

    const handleNewSession = useCallback(() => {
        startNewSession();
        setActivePanel('none');
    }, [startNewSession, setActivePanel]);

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

            {/* Search + New Session */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search history..."
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
                    onClick={handleNewSession}
                    title="New Session"
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '5px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '14px',
                        lineHeight: 1,
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
                    +
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {searchResults.length > 0 ? (
                    // Search results
                    <div style={{ padding: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', padding: '0 4px' }}>
                            {searchResults.length} results
                        </span>
                        {searchResults.map((entry) => (
                            <button
                                key={entry.id}
                                onClick={() => {
                                    // Find the session for this entry and load it
                                    const session = sessions.find(s => s.id === entry.session_id);
                                    if (session) handleLoadSession(session);
                                }}
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
                                    onClick={() => handleLoadSession(session)}
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
