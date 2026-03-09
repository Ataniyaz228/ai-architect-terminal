'use client';

import React, { useEffect } from 'react';
import TitleBar from '@/components/TitleBar';
import Rail from '@/components/Rail';
import ModeSelector from '@/components/ModeSelector';
import InputZone from '@/components/InputZone';
import OutputZone from '@/components/OutputZone';
import StatusBar from '@/components/StatusBar';
import HistoryPanel from '@/components/HistoryPanel';
import SettingsPanel from '@/components/SettingsPanel';
import { useSessionStore, useHistoryStore } from '@/stores';

export default function Home() {
  const { setModes } = useSessionStore();
  const { activePanel } = useHistoryStore();

  // Load modes on mount
  useEffect(() => {
    async function loadModes() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const modes = await invoke<any[]>('list_modes');
        setModes(modes);
      } catch {
        // Fallback modes for development without Tauri
        setModes([
          {
            id: 'architecture',
            label: 'Architecture',
            icon: 'layers',
            description: 'System architecture, component design, infrastructure decisions',
            prompt_file: 'architecture.md',
            default_model: 'gemini-3.1-pro-high',
            temperature: 0.3,
            max_tokens: 4096,
          },
          {
            id: 'design_review',
            label: 'Design Review',
            icon: 'search',
            description: 'Critical analysis of existing architecture and design decisions',
            prompt_file: 'design_review.md',
            default_model: 'claude-sonnet-4-6',
            temperature: 0.4,
            max_tokens: 4096,
          },
          {
            id: 'ideation',
            label: 'Ideation',
            icon: 'lightbulb',
            description: 'Brainstorming, exploring design spaces, generating creative solutions',
            prompt_file: 'ideation.md',
            default_model: 'claude-opus-4-6-thinking',
            temperature: 0.7,
            max_tokens: 4096,
          },
        ]);
      }
    }
    loadModes();
  }, [setModes]);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Title Bar */}
      <TitleBar />

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Rail */}
        <Rail />

        {/* Side panels */}
        <HistoryPanel />
        <SettingsPanel />

        {/* Workspace */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {/* Mode Selector */}
          <ModeSelector />

          {/* Split Pane */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <InputZone />
            <OutputZone />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
