'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSessionStore } from '@/stores';

interface FloatingCommandBarProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function FloatingCommandBar({ containerRef }: FloatingCommandBarProps) {
    const [visible, setVisible] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [instruction, setInstruction] = useState('');
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const inputRef = useRef<HTMLInputElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    // Track whether the bar is "locked" (user is interacting with it)
    const lockedRef = useRef(false);

    const {
        output,
        setOutput,
        pushVersion,
        selectedModel,
        setInlineEditLoading,
        inlineEditLoading,
    } = useSessionStore();

    // Show the bar only on mouseup — after the user finishes selecting text.
    // This avoids the old selectionchange approach which fires on every cursor
    // move during drag-selection, causing jitter, scrolling, and fighting.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseUp = () => {
            // Delay lets the browser finalise the selection range
            setTimeout(() => {
                // If bar is locked (user is interacting with it), don't touch it
                if (lockedRef.current) return;

                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) {
                    setVisible(false);
                    return;
                }

                const text = selection.toString().trim();
                if (!text || text.length < 3) {
                    setVisible(false);
                    return;
                }

                const range = selection.getRangeAt(0);
                if (!container.contains(range.commonAncestorContainer)) {
                    setVisible(false);
                    return;
                }

                const rect = range.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                setSelectedText(text);
                setPosition({
                    // Include scrollTop so position is correct when container is scrolled
                    top: rect.top - containerRect.top + container.scrollTop - 44,
                    left: Math.max(0, rect.left - containerRect.left),
                });
                setVisible(true);
            }, 50);
        };

        container.addEventListener('mouseup', handleMouseUp);
        return () => container.removeEventListener('mouseup', handleMouseUp);
    }, [containerRef]);

    // Hide the bar when the user clicks outside the output container entirely
    useEffect(() => {
        const container = containerRef.current;
        const handleMouseDown = (e: MouseEvent) => {
            // If clicking inside the bar itself, mark as locked and don't hide
            if (barRef.current && barRef.current.contains(e.target as Node)) {
                lockedRef.current = true;
                return;
            }
            // If clicking inside the output container but outside the bar, unlock and let mouseup handle
            if (container && container.contains(e.target as Node)) {
                lockedRef.current = false;
                return;
            }
            // Clicking fully outside — dismiss the bar
            lockedRef.current = false;
            setVisible(false);
            setInstruction('');
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [containerRef]);

    // No auto-focus — let the user copy text freely with Ctrl+C
    // They can click the input manually when they want to edit

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setVisible(false);
                setInstruction('');
                lockedRef.current = false;
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!instruction.trim() || !selectedText || inlineEditLoading) return;

        setInlineEditLoading(true);
        setVisible(false);
        lockedRef.current = false;

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const newFragment = await invoke<string>('inline_edit_request', {
                payload: {
                    full_document: output,
                    target_text: selectedText,
                    instruction: instruction.trim(),
                    model: selectedModel,
                },
            });

            // The LLM returns the full updated document
            const store = useSessionStore.getState();
            store.setOutput(newFragment);
            store.pushVersion(newFragment);

            setInstruction('');
        } catch (err) {
            console.error('Inline edit failed:', err);
            const store = useSessionStore.getState();
            store.setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
            setInlineEditLoading(false);
        }
    }, [instruction, selectedText, output, selectedModel, inlineEditLoading, setInlineEditLoading]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
            }
        },
        [handleSubmit]
    );

    if (!visible) return null;

    return (
        <div
            ref={barRef}
            style={{
                position: 'absolute',
                top: `${position.top}px`,
                left: `${Math.min(position.left, 300)}px`,
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                animation: 'fadeIn 0.15s ease',
                minWidth: '300px',
                maxWidth: '500px',
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <span
                style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    flexShrink: 0,
                }}
            >
                {'>'}
            </span>
            <input
                ref={inputRef}
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Как изменить этот фрагмент..."
                style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    outline: 'none',
                }}
            />
            <button
                onClick={handleSubmit}
                disabled={!instruction.trim() || inlineEditLoading}
                style={{
                    padding: '3px 8px',
                    background: instruction.trim() ? 'var(--text-primary)' : 'transparent',
                    border: '1px solid transparent',
                    borderRadius: '4px',
                    color: instruction.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: instruction.trim() ? 'pointer' : 'default',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                }}
            >
                EDIT ↵
            </button>
        </div>
    );
}
