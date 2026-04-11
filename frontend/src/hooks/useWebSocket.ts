import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'

const WS_BASE = `ws://${window.location.hostname}:8000`

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()

  const {
    updateAgent, setAnalysis, setSceneThumbs, setMetrics,
    setProcessing, setAnalyzing, setOutputUrl, setCurrentSession
  } = useAppStore()

  const connect = useCallback(() => {
    if (!sessionId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] connected to session', sessionId)
      clearTimeout(reconnectRef.current)
    }

    ws.onmessage = (evt) => {
      try {
        const { event, data } = JSON.parse(evt.data)
        handleEvent(event, data)
      } catch (e) {
        console.warn('[WS] bad message', evt.data)
      }
    }

    ws.onclose = () => {
      console.log('[WS] disconnected')
      // Reconnect after 3s if session still active
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = (e) => console.warn('[WS] error', e)
  }, [sessionId])

  function handleEvent(event: string, data: Record<string, unknown>) {
    switch (event) {
      case 'analysis_start':
        setAnalyzing(true)
        break

      case 'analysis_progress':
        // Progress updates — could show in UI
        break

      case 'analysis_complete': {
        setAnalyzing(false)
        const waveform = data.waveform as number[]
        const speech = data.speech_segments as { start: number; end: number }[]
        const silence = data.silence_segments as { start: number; end: number }[]
        const scenes = data.scenes as number[]
        const duration = data.duration as number
        const speechDensity = data.speech_density as number
        const metrics = data.metrics as Record<string, unknown>

        setAnalysis({
          session_id: data.session_id as string,
          waveform_data: waveform,
          scene_timestamps: scenes,
          speech_segments: speech,
          silence_segments: silence,
          cut_points: scenes,
          duration,
          fps: 30,
          width: 1920,
          height: 1080,
          total_frames: 0,
          audio_rms: (metrics?.average_rms as number) || 0,
          speech_density: speechDensity,
        })

        if (data.scene_thumbnails) {
          setSceneThumbs(data.scene_thumbnails as string[])
        }

        setMetrics({
          session_id: data.session_id as string,
          waveform: waveform,
          scenes,
          speech_segments: speech,
          silence_segments: silence,
          duration,
          ...(metrics as object),
        } as never)

        setCurrentSession((prev) =>
          prev ? { ...prev, status: 'ready' as const } : null
        )
        break
      }

      case 'agent_update': {
        const agentName = data.agent as string
        const status = data.status as string
        const message = data.message as string
        const agentData = data.data as Record<string, unknown>

        updateAgent(agentName, {
          status: status as never,
          message,
          data: agentData,
          ...(status === 'active' ? { startedAt: new Date().toISOString() } : {}),
          ...(status === 'complete' || status === 'failed'
              ? { completedAt: new Date().toISOString() } : {}),
        })
        break
      }

      case 'edit_complete': {
        setProcessing(false)
        setOutputUrl(data.output_url as string)
        setCurrentSession((prev) =>
          prev ? { ...prev, status: 'complete' as const, output_path: data.output_url as string } : null
        )
        break
      }

      case 'edit_error': {
        setProcessing(false)
        setCurrentSession((prev) =>
          prev ? { ...prev, status: 'failed' as const } : null
        )
        break
      }

      case 'analysis_error':
        setAnalyzing(false)
        break

      default:
        break
    }
  }

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
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
