import { create } from 'zustand';

export interface ModeConfig {
    id: string;
    label: string;
    icon: string;
    description: string;
    prompt_file: string;
    default_model: string;
    temperature: number;
    max_tokens: number;
}

export interface Entry {
    id: string;
    session_id: string;
    raw_input: string;
    generated_prompt: string;
    token_usage_prompt: number;
    token_usage_completion: number;
    pinned: boolean;
    status: string;
    created_at: string;
}

export interface Session {
    id: string;
    title: string;
    mode: string;
    model: string;
    created_at: string;
    updated_at: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Per-mode cached state — saved when switching away, restored when switching back
interface ModeState {
    output: string;
    versions: string[];
    currentVersionIndex: number;
    conversationHistory: ChatMessage[];
    currentSessionId: string | null;
    currentEntryId: string | null;
    tokenUsage: { prompt: number; completion: number };
    errorMessage: string | null;
    streamingStatus: StreamingStatus;
}

type StreamingStatus = 'idle' | 'generating' | 'error' | 'aborted';

interface SessionStore {
    // Input
    rawInput: string;
    setRawInput: (input: string) => void;

    // Mode
    selectedMode: string;
    setSelectedMode: (mode: string) => void;

    // Per-mode state cache
    modeStates: Record<string, ModeState>;
    modes: ModeConfig[];
    setModes: (modes: ModeConfig[]) => void;

    // Model
    selectedModel: string;
    setSelectedModel: (model: string) => void;

    // Output
    output: string;
    setOutput: (output: string) => void;
    appendOutput: (chunk: string) => void;
    clearOutput: () => void;

    // Versioning
    versions: string[];
    currentVersionIndex: number;
    pushVersion: (content: string) => void;
    goToVersion: (index: number) => void;

    // Conversation History (for Refine)
    conversationHistory: ChatMessage[];
    addToHistory: (role: ChatMessage['role'], content: string) => void;
    resetConversation: () => void;

    // Inline Edit
    inlineEditLoading: boolean;
    setInlineEditLoading: (v: boolean) => void;

    // Streaming
    streamingStatus: StreamingStatus;
    setStreamingStatus: (status: StreamingStatus) => void;

    // Current session
    currentSessionId: string | null;
    setCurrentSessionId: (id: string | null) => void;
    currentEntryId: string | null;
    setCurrentEntryId: (id: string | null) => void;

    // Token usage
    tokenUsage: { prompt: number; completion: number };
    setTokenUsage: (usage: { prompt: number; completion: number }) => void;

    // Timing
    requestStartTime: number | null;
    setRequestStartTime: (time: number | null) => void;
    latencyMs: number | null;
    setLatencyMs: (ms: number | null) => void;

    // Error
    errorMessage: string | null;
    setErrorMessage: (msg: string | null) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
    rawInput: '',
    setRawInput: (input) => set({ rawInput: input }),

    selectedMode: 'architecture',
    setSelectedMode: (mode) =>
        set((state) => {
            // Don't do anything if mode is the same
            if (state.selectedMode === mode) return {};

            // Save current mode's state
            const currentModeState: ModeState = {
                output: state.output,
                versions: state.versions,
                currentVersionIndex: state.currentVersionIndex,
                conversationHistory: state.conversationHistory,
                currentSessionId: state.currentSessionId,
                currentEntryId: state.currentEntryId,
                tokenUsage: state.tokenUsage,
                errorMessage: state.errorMessage,
                streamingStatus: state.streamingStatus,
            };

            const updatedModeStates = {
                ...state.modeStates,
                [state.selectedMode]: currentModeState,
            };

            // Restore target mode's cached state (or defaults)
            const cached = updatedModeStates[mode];

            // Find the default model for the new mode
            const modeConfig = state.modes.find((m) => m.id === mode);
            const defaultModel = modeConfig?.default_model ?? state.selectedModel;

            if (cached) {
                return {
                    selectedMode: mode,
                    selectedModel: defaultModel,
                    modeStates: updatedModeStates,
                    output: cached.output,
                    versions: cached.versions,
                    currentVersionIndex: cached.currentVersionIndex,
                    conversationHistory: cached.conversationHistory,
                    currentSessionId: cached.currentSessionId,
                    currentEntryId: cached.currentEntryId,
                    tokenUsage: cached.tokenUsage,
                    errorMessage: cached.errorMessage,
                    streamingStatus: cached.streamingStatus,
                };
            }

            // No cached state — start fresh for this mode
            return {
                selectedMode: mode,
                selectedModel: defaultModel,
                modeStates: updatedModeStates,
                output: '',
                versions: [],
                currentVersionIndex: -1,
                conversationHistory: [],
                currentSessionId: null,
                currentEntryId: null,
                tokenUsage: { prompt: 0, completion: 0 },
                errorMessage: null,
                streamingStatus: 'idle' as StreamingStatus,
            };
        }),
    modeStates: {},
    modes: [],
    setModes: (modes) => set({ modes }),

    selectedModel: 'gemini-3-flash',
    setSelectedModel: (model) => set({ selectedModel: model }),

    output: '',
    setOutput: (output) => set({ output }),
    appendOutput: (chunk) => set((state) => ({ output: state.output + chunk })),
    clearOutput: () => set({ output: '' }),

    // Versioning
    versions: [],
    currentVersionIndex: -1,
    pushVersion: (content) =>
        set((state) => {
            const newVersions = [...state.versions, content];
            return {
                versions: newVersions,
                currentVersionIndex: newVersions.length - 1,
            };
        }),
    goToVersion: (index) =>
        set((state) => {
            if (index < 0 || index >= state.versions.length) return {};
            return {
                currentVersionIndex: index,
                output: state.versions[index],
            };
        }),

    // Conversation History
    conversationHistory: [],
    addToHistory: (role, content) =>
        set((state) => ({
            conversationHistory: [...state.conversationHistory, { role, content }],
        })),
    resetConversation: () =>
        set({
            conversationHistory: [],
            versions: [],
            currentVersionIndex: -1,
        }),

    // Inline Edit
    inlineEditLoading: false,
    setInlineEditLoading: (v) => set({ inlineEditLoading: v }),

    streamingStatus: 'idle',
    setStreamingStatus: (status) => set({ streamingStatus: status }),

    currentSessionId: null,
    setCurrentSessionId: (id) => set({ currentSessionId: id }),
    currentEntryId: null,
    setCurrentEntryId: (id) => set({ currentEntryId: id }),

    tokenUsage: { prompt: 0, completion: 0 },
    setTokenUsage: (usage) => set({ tokenUsage: usage }),

    requestStartTime: null,
    setRequestStartTime: (time) => set({ requestStartTime: time }),
    latencyMs: null,
    setLatencyMs: (ms) => set({ latencyMs: ms }),

    errorMessage: null,
    setErrorMessage: (msg) => set({ errorMessage: msg }),
}));

// ── History Store ──

type ActivePanel = 'none' | 'history' | 'settings';

interface HistoryStore {
    sessions: Session[];
    setSessions: (sessions: Session[]) => void;
    pinnedEntries: Entry[];
    setPinnedEntries: (entries: Entry[]) => void;
    activePanel: ActivePanel;
    setActivePanel: (panel: ActivePanel) => void;
    selectedSession: Session | null;
    setSelectedSession: (session: Session | null) => void;
    sessionEntries: Entry[];
    setSessionEntries: (entries: Entry[]) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: Entry[];
    setSearchResults: (results: Entry[]) => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
    sessions: [],
    setSessions: (sessions) => set({ sessions }),
    pinnedEntries: [],
    setPinnedEntries: (entries) => set({ pinnedEntries: entries }),
    activePanel: 'none',
    setActivePanel: (panel) => set({ activePanel: panel }),
    selectedSession: null,
    setSelectedSession: (session) => set({ selectedSession: session }),
    sessionEntries: [],
    setSessionEntries: (entries) => set({ sessionEntries: entries }),
    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),
    searchResults: [],
    setSearchResults: (results) => set({ searchResults: results }),
}));

// ── Settings Store ──

interface SettingsStore {
    openaiKeySet: boolean;
    setOpenaiKeySet: (set: boolean) => void;
    anthropicKeySet: boolean;
    setAnthropicKeySet: (set: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    openaiKeySet: false,
    setOpenaiKeySet: (v) => set({ openaiKeySet: v }),
    anthropicKeySet: false,
    setAnthropicKeySet: (v) => set({ anthropicKeySet: v }),
}));
