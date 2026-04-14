import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { VideoAnalysis, Metrics } from '../types'

// Use the same host:port as the page so requests go through the Vite proxy,
// avoiding CORS issues when the dev server picks a port other than 8000.
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss' : 'ws'
const WS_BASE = `${WS_PROTOCOL}://${window.location.host}`
const API_BASE = '/api'

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()
  const pollRef = useRef<ReturnType<typeof setInterval>>()
  const connectedRef = useRef(false)
  const unmountedRef = useRef(false)   // prevents reconnect after intentional close

  const {
    updateAgent, setAnalysis, setSceneThumbs, setMetrics,
    setProcessing, setAnalyzing, setOutputUrl, setCurrentSession
  } = useAppStore()

  // ── REST fallback: fetch analysis + session status ──────────────────────────
  const fetchAnalysisFromREST = useCallback(async (sid: string) => {
    try {
      const [sessionRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE}/sessions/${sid}`),
        fetch(`${API_BASE}/sessions/${sid}/metrics`),
      ])
      if (!sessionRes.ok) return false

      const session = await sessionRes.json()
      const status = session.status as string

      // Update session status in store
      setCurrentSession((prev) => prev ? { ...prev, status: status as never } : null)

      if (status === 'analyzing') return false   // still running, keep polling

      // Analysis data available
      if (metricsRes.ok) {
        const m = await metricsRes.json()
        setAnalyzing(false)

        const analysis: VideoAnalysis = {
          session_id: sid,
          waveform_data:    m.waveform            ?? [],
          scene_timestamps: m.scenes              ?? [],
          speech_segments:  m.speech_segments     ?? [],
          silence_segments: m.silence_segments    ?? [],
          cut_points:       m.scenes              ?? [],
          duration:         m.duration            ?? 0,
          fps:              30,
          width:            1920,
          height:           1080,
          total_frames:     0,
          audio_rms:        m.average_rms         ?? 0,
          speech_density:   m.speech_density      ?? 0.7,
        }
        setAnalysis(analysis)
        setMetrics(m as Metrics)

        if (session.scene_thumbnails) setSceneThumbs(session.scene_thumbnails)
      }
      return true   // done
    } catch {
      return false
    }
  }, [])

  // ── Start polling until analysis arrives or status leaves 'analyzing' ───────
  const startPoll = useCallback((sid: string) => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const done = await fetchAnalysisFromREST(sid)
      if (done) clearInterval(pollRef.current)
    }, 2000)
  }, [fetchAnalysisFromREST])

  // ── WebSocket event handler ──────────────────────────────────────────────────
  function handleEvent(event: string, data: Record<string, unknown>) {
    switch (event) {

      case 'analysis_start':
        setAnalyzing(true)
        break

      case 'analysis_complete': {
        setAnalyzing(false)
        clearInterval(pollRef.current)    // WS beat the poll — cancel it

        const waveform = (data.waveform as number[]) ?? []
        const speech   = (data.speech_segments as { start: number; end: number }[]) ?? []
        const silence  = (data.silence_segments as { start: number; end: number }[]) ?? []
        const scenes   = (data.scenes as number[]) ?? []
        const duration = (data.duration as number) ?? 0
        const speechDensity = (data.speech_density as number) ?? 0.7
        const metrics = (data.metrics as Record<string, unknown>) ?? {}

        setAnalysis({
          session_id:       data.session_id as string,
          waveform_data:    waveform,
          scene_timestamps: scenes,
          speech_segments:  speech,
          silence_segments: silence,
          cut_points:       scenes,
          duration,
          fps:          30,
          width:        1920,
          height:       1080,
          total_frames: 0,
          audio_rms:      (metrics.average_rms as number) ?? 0,
          speech_density: speechDensity,
        })

        if (data.scene_thumbnails) setSceneThumbs(data.scene_thumbnails as string[])

        setMetrics({
          session_id: data.session_id as string,
          waveform: waveform,
          scenes,
          speech_segments:  speech,
          silence_segments: silence,
          duration,
          ...(metrics as object),
        } as Metrics)

        setCurrentSession((prev) => prev ? { ...prev, status: 'ready' as const } : null)
        break
      }

      case 'agent_update': {
        const agentName = data.agent as string
        const status    = data.status as string
        const message   = data.message as string
        const agentData = data.data as Record<string, unknown>

        updateAgent(agentName, {
          status:  status as never,
          message,
          data: agentData,
          ...(status === 'active'
              ? { startedAt: new Date().toISOString() } : {}),
          ...(status === 'complete' || status === 'failed'
              ? { completedAt: new Date().toISOString() } : {}),
        })
        break
      }

      case 'edit_complete': {
        setProcessing(false)
        setOutputUrl(data.output_url as string)
        setCurrentSession((prev) =>
          prev ? { ...prev, status: 'complete' as const,
                   output_path: data.output_url as string } : null
        )
        break
      }

      case 'edit_error': {
        setProcessing(false)
        setCurrentSession((prev) => prev ? { ...prev, status: 'ready' as const } : null)
        break
      }

      case 'analysis_error':
        setAnalyzing(false)
        // Fall back to REST to get whatever partial data exists
        if (sessionId) fetchAnalysisFromREST(sessionId)
        break

      default:
        break
    }
  }

  // ── Connect ──────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!sessionId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`)
    wsRef.current = ws

    ws.onopen = () => {
      connectedRef.current = true
      clearTimeout(reconnectRef.current)

      // Immediately check if analysis already finished (race condition fix)
      fetchAnalysisFromREST(sessionId).then((done) => {
        if (!done) startPoll(sessionId)  // still pending — keep polling
      })
    }

    ws.onmessage = (evt) => {
      try {
        const { event, data } = JSON.parse(evt.data)
        handleEvent(event, data)
      } catch { /* ignore bad frames */ }
    }

    ws.onclose = () => {
      connectedRef.current = false
      if (!unmountedRef.current) {
        reconnectRef.current = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => { /* onclose fires right after */ }
  }, [sessionId])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      clearTimeout(reconnectRef.current)
      clearInterval(pollRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { send }
}
