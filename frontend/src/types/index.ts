export type AgentStatus = 'idle' | 'pending' | 'active' | 'complete' | 'failed'
export type SessionStatus = 'uploaded' | 'analyzing' | 'ready' | 'processing' | 'complete' | 'failed'

export interface AgentNode {
  name: string
  label: string
  description: string
  status: AgentStatus
  message?: string
  data?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
}

export interface Segment {
  start: number
  end: number
  reason?: string
}

export interface VideoAnalysis {
  session_id: string
  waveform_data: number[]
  scene_timestamps: number[]
  speech_segments: Segment[]
  silence_segments: Segment[]
  cut_points: number[]
  duration: number
  fps: number
  width: number
  height: number
  total_frames: number
  audio_rms: number
  speech_density: number
}

export interface EditPlan {
  summary: string
  style_tags: string[]
  pacing: string
  keep_ratio: number
  add_subtitles: boolean
  remove_filler_words: boolean
  fade_in: number
  fade_out: number
  reasoning: string
  visual_settings: {
    brightness: number
    contrast: number
    saturation: number
    warmth: number
    vignette: number
  }
  audio_settings: {
    volume: number
    music_level: number
    denoise: boolean
    normalize: boolean
  }
}

export interface Review {
  overall_score: number
  quality_assessment: string
  strengths: string[]
  improvements: Array<{ priority: string; text: string }>
  pacing_score: number
  audio_score: number
  visual_score: number
  suggestions: Array<{ type: string; description: string; action: string }>
  re_edit_recommended: boolean
}

export interface AgentStep {
  id: string
  agent_name: string
  agent_label: string
  status: AgentStatus
  input_data?: unknown
  output_data?: unknown
  error_message?: string
  started_at?: string
  completed_at?: string
  step_order: number
}

export interface EditDecision {
  id: string
  session_id: string
  decision_type: string
  description: string
  parameters: Record<string, unknown>
  agent_name: string
  accepted: number
  timestamp: string
}

export interface Session {
  id: string
  created_at: string
  updated_at: string
  video_filename: string
  video_path: string
  prompt?: string
  status: SessionStatus
  output_path?: string
  version: number
  duration?: number
  thumbnail_path?: string
  steps?: AgentStep[]
  analysis?: VideoAnalysis
  decisions?: EditDecision[]
}

export interface Metrics {
  session_id: string
  waveform: number[]
  scenes: number[]
  speech_segments: Segment[]
  silence_segments: Segment[]
  duration: number
  total_speech_duration: number
  total_silence_duration: number
  speech_density: number
  average_rms: number
  cut_frequency_per_min: number
  scene_count: number
  silence_distribution: number[]
  pacing_score: number
}

export interface Controls {
  volume: number
  musicLevel: number
  denoise: boolean
  normalize: boolean
  brightness: number
  contrast: number
  saturation: number
  warmth: number
  vignette: number
  removeFiller: boolean
  highlightEmotional: boolean
  addSubtitles: boolean
}

export type ViewTab = 'editor' | 'workflow' | 'metrics' | 'history'
