import { create } from 'zustand'
import type {
  Session, VideoAnalysis, AgentNode, Metrics,
  Controls, ViewTab, AgentStep
} from '../types'

const AGENT_DEFS: Omit<AgentNode, 'status'>[] = [
  { name: 'planner',   label: 'Planner',   description: 'Converts prompt into edit plan' },
  { name: 'analyzer',  label: 'Analyzer',  description: 'Detects scenes, speech, emotions' },
  { name: 'cutter',    label: 'Cutter',    description: 'Determines precise cut points' },
  { name: 'effects',   label: 'Effects',   description: 'Applies color grade & audio FX' },
  { name: 'subtitles', label: 'Subtitles', description: 'Generates & burns captions' },
  { name: 'music',     label: 'Music',     description: 'Selects background music' },
  { name: 'critic',    label: 'Critic',    description: 'Reviews quality & scores edit' },
]

interface AppState {
  // Session
  currentSession: Session | null
  sessions: Session[]
  selectedHistorySession: Session | null

  // Analysis
  analysis: VideoAnalysis | null
  sceneThumbUrls: string[]
  metrics: Metrics | null

  // Agents
  agents: AgentNode[]
  isProcessing: boolean
  isAnalyzing: boolean

  // UI
  activeTab: ViewTab
  prompt: string
  outputUrl: string | null
  uploadProgress: number

  // Controls
  controls: Controls

  // Actions
  setCurrentSession: (s: Session | null | ((prev: Session | null) => Session | null)) => void
  setSessions: (s: Session[]) => void
  setSelectedHistorySession: (s: Session | null) => void
  setAnalysis: (a: VideoAnalysis | null) => void
  setSceneThumbs: (urls: string[]) => void
  setMetrics: (m: Metrics | null) => void
  setActiveTab: (t: ViewTab) => void
  setPrompt: (p: string) => void
  setOutputUrl: (u: string | null) => void
  setUploadProgress: (n: number) => void
  setProcessing: (b: boolean) => void
  setAnalyzing: (b: boolean) => void
  updateAgent: (name: string, patch: Partial<AgentNode>) => void
  resetAgents: () => void
  updateControl: <K extends keyof Controls>(key: K, value: Controls[K]) => void
}

const defaultControls: Controls = {
  volume: 1.0,
  musicLevel: 0.0,
  denoise: false,
  normalize: false,
  brightness: 0.0,
  contrast: 1.0,
  saturation: 1.0,
  warmth: 0.0,
  vignette: 0.0,
  removeFiller: true,
  highlightEmotional: false,
  addSubtitles: false,
}

export const useAppStore = create<AppState>((set) => ({
  currentSession: null,
  sessions: [],
  selectedHistorySession: null,
  analysis: null,
  sceneThumbUrls: [],
  metrics: null,
  agents: AGENT_DEFS.map(a => ({ ...a, status: 'idle' as const })),
  isProcessing: false,
  isAnalyzing: false,
  activeTab: 'editor',
  prompt: '',
  outputUrl: null,
  uploadProgress: 0,
  controls: defaultControls,

  setCurrentSession: (s) => set((state) => ({
    currentSession: typeof s === 'function' ? s(state.currentSession) : s
  })),
  setSessions: (s) => set({ sessions: s }),
  setSelectedHistorySession: (s) => set({ selectedHistorySession: s }),
  setAnalysis: (a) => set({ analysis: a }),
  setSceneThumbs: (urls) => set({ sceneThumbUrls: urls }),
  setMetrics: (m) => set({ metrics: m }),
  setActiveTab: (t) => set({ activeTab: t }),
  setPrompt: (p) => set({ prompt: p }),
  setOutputUrl: (u) => set({ outputUrl: u }),
  setUploadProgress: (n) => set({ uploadProgress: n }),
  setProcessing: (b) => set({ isProcessing: b }),
  setAnalyzing: (b) => set({ isAnalyzing: b }),

  updateAgent: (name, patch) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.name === name ? { ...a, ...patch } : a
      ),
    })),

  resetAgents: () =>
    set({
      agents: AGENT_DEFS.map((a) => ({ ...a, status: 'idle' as const })),
    }),

  updateControl: (key, value) =>
    set((state) => ({
      controls: { ...state.controls, [key]: value },
    })),
}))
