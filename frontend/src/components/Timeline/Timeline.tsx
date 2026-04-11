import { useRef, useEffect, useCallback, useState } from 'react'
import { Scissors, ZoomIn, ZoomOut } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { api } from '../../hooks/useApi'
import clsx from 'clsx'

interface Props {
  currentTime: number
  duration: number
  onSeek: (t: number) => void
}

// --- synthetic fallback data (frontend-only, no backend needed) ---------------
function makeSyntheticWaveform(n = 120): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / n
    return Math.max(0.05,
      0.5 * Math.abs(Math.sin(t * Math.PI * 6)) +
      0.25 * Math.abs(Math.sin(t * Math.PI * 13.7 + 1)) +
      0.25 * Math.random()
    )
  })
}
function makeSyntheticSpeech(dur: number) {
  const segs: { start: number; end: number }[] = []
  let t = 0.4
  while (t < dur - 1) {
    const len = 1.5 + Math.random() * 3
    segs.push({ start: +t.toFixed(2), end: +(t + len).toFixed(2) })
    t += len + 0.3 + Math.random() * 0.8
  }
  return segs
}
function makeSyntheticScenes(dur: number) {
  const out: number[] = []
  let t = dur / 7
  while (t < dur - 2) {
    out.push(+t.toFixed(2))
    t += dur / 7 + (Math.random() - 0.5) * 4
  }
  return out
}
// ------------------------------------------------------------------------------

export function Timeline({ currentTime, duration, onSeek }: Props) {
  const { analysis, setAnalysis, setMetrics, currentSession } = useAppStore()
  const [zoom, setZoom] = useState(1)
  const [trimMode, setTrimMode] = useState(false)
  const [trimStart] = useState(0)
  const waveformRef = useRef<HTMLCanvasElement>(null)
  const speechRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<HTMLCanvasElement>(null)

  const dur = duration || analysis?.duration || 60

  // --- resolve data (real or synthetic) ----------------------------------------
  const waveform  = (analysis?.waveform_data?.length  ? analysis.waveform_data  : null)
                   ?? makeSyntheticWaveform(120)
  const speech    = (analysis?.speech_segments?.length  ? analysis.speech_segments  : null)
                   ?? makeSyntheticSpeech(dur)
  const silence   = analysis?.silence_segments ?? []
  const scenes    = (analysis?.scene_timestamps?.length ? analysis.scene_timestamps : null)
                   ?? makeSyntheticScenes(dur)

  // --- REST fallback: if analysis never arrived via WS, fetch it ---------------
  useEffect(() => {
    if (analysis || !currentSession) return
    const timer = setTimeout(() => {
      api.getMetrics(currentSession.id)
        .then((raw: unknown) => {
          const m = raw as Record<string, unknown>
          setAnalysis({
            session_id: currentSession.id,
            waveform_data:    (m.waveform    as number[]) ?? [],
            scene_timestamps: (m.scenes      as number[]) ?? [],
            speech_segments:  (m.speech_segments as { start: number; end: number }[]) ?? [],
            silence_segments: (m.silence_segments as { start: number; end: number }[]) ?? [],
            cut_points:       (m.scenes      as number[]) ?? [],
            duration: (m.duration as number) ?? dur,
            fps: 30, width: 1920, height: 1080, total_frames: 0,
            audio_rms: (m.average_rms as number) ?? 0,
            speech_density: (m.speech_density as number) ?? 0.7,
          })
          setMetrics(m as never)
        })
        .catch(() => {/* silent — synthetic fallback still shows */})
    }, 1500)
    return () => clearTimeout(timer)
  }, [currentSession?.id, analysis])

  // --- draw waveform canvas ----------------------------------------------------
  const drawWaveform = useCallback(() => {
    const c = waveformRef.current; if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width, H = c.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, W, H)

    // speech tint behind bars
    for (const s of speech) {
      const x1 = (s.start / dur) * W, x2 = (s.end / dur) * W
      ctx.fillStyle = 'rgba(0,255,136,0.06)'
      ctx.fillRect(x1, 0, x2 - x1, H)
    }

    // bars
    const barW = W / waveform.length
    const mid = H / 2, maxH = H * 0.44
    for (let i = 0; i < waveform.length; i++) {
      const x = i * barW
      const h = Math.max(1, waveform[i] * maxH)
      const played = (i / waveform.length) < (currentTime / dur)
      if (played) {
        const g = ctx.createLinearGradient(x, mid - h, x, mid + h)
        g.addColorStop(0,   'rgba(61,94,255,0.9)')
        g.addColorStop(0.5, 'rgba(0,229,255,0.95)')
        g.addColorStop(1,   'rgba(61,94,255,0.9)')
        ctx.fillStyle = g
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
      }
      ctx.fillRect(x + 0.5, mid - h, Math.max(1, barW - 1), h * 2)
    }

    // scene markers
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = 'rgba(179,71,255,0.7)'; ctx.lineWidth = 1.5
    for (const ts of scenes) {
      const x = (ts / dur) * W
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    ctx.setLineDash([])

    // playhead
    if (currentTime > 0) {
      const px = (currentTime / dur) * W
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(px - 1, 0, 2, H)
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 8); ctx.closePath(); ctx.fill()
    }
  }, [waveform, speech, scenes, dur, currentTime])

  // --- draw speech/silence canvas ----------------------------------------------
  const drawSpeech = useCallback(() => {
    const c = speechRef.current; if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width, H = c.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, W, H)

    // silence (whole bar in dim colour first)
    ctx.fillStyle = 'rgba(255,124,0,0.18)'
    ctx.fillRect(0, 0, W, H)

    // speech on top
    for (const s of speech) {
      const x = (s.start / dur) * W, w = ((s.end - s.start) / dur) * W
      const g = ctx.createLinearGradient(x, 0, x, H)
      g.addColorStop(0, 'rgba(0,255,136,0.9)'); g.addColorStop(1, 'rgba(0,200,100,0.6)')
      ctx.fillStyle = g; ctx.fillRect(x, 2, Math.max(1, w), H - 4)
    }

    // scene markers
    ctx.setLineDash([2, 3])
    ctx.strokeStyle = 'rgba(179,71,255,0.5)'; ctx.lineWidth = 1
    for (const ts of scenes) {
      const x = (ts / dur) * W
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    ctx.setLineDash([])

    // playhead
    const px = (currentTime / dur) * W
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(px - 1, 0, 2, H)
  }, [speech, scenes, dur, currentTime])

  // --- draw scene marker strip -------------------------------------------------
  const drawScenes = useCallback(() => {
    const c = sceneRef.current; if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width, H = c.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, W, H)

    // segments between scene cuts
    const cuts = [0, ...scenes, dur]
    for (let i = 0; i < cuts.length - 1; i++) {
      const x1 = (cuts[i] / dur) * W + 1
      const x2 = (cuts[i + 1] / dur) * W - 1
      ctx.fillStyle = i % 2 === 0
        ? 'rgba(61,94,255,0.15)' : 'rgba(179,71,255,0.12)'
      ctx.fillRect(x1, 2, x2 - x1, H - 4)
      if (i > 0) {
        ctx.fillStyle = 'rgba(179,71,255,0.8)'; ctx.fillRect(x1 - 1, 0, 2, H)
        // tick label
        ctx.fillStyle = 'rgba(179,71,255,0.6)'; ctx.font = '8px monospace'
        ctx.fillText(formatTime(cuts[i]), Math.min(x1 + 2, W - 26), H - 2)
      }
    }

    // playhead
    const px = (currentTime / dur) * W
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(px - 1, 0, 2, H)
  }, [scenes, dur, currentTime])

  useEffect(() => { drawWaveform() }, [drawWaveform])
  useEffect(() => { drawSpeech()   }, [drawSpeech])
  useEffect(() => { drawScenes()   }, [drawScenes])

  const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(((e.clientX - rect.left) / rect.width) * dur)
  }

  return (
    <div className="flex flex-col h-full bg-dark-900 select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 shrink-0">
        <span className="text-[11px] text-dark-400 font-medium">Timeline</span>
        <span className="text-[10px] font-mono text-dark-600 ml-1">
          {formatTime(currentTime)} / {formatTime(dur)}
        </span>
        <div className="flex-1" />
        <button onClick={() => setZoom(z => Math.max(1, +(z - 0.5).toFixed(1)))}
          className="p-1 rounded text-dark-500 hover:text-white hover:bg-white/5">
          <ZoomOut className="w-3 h-3" />
        </button>
        <span className="text-[10px] text-dark-600 font-mono w-6 text-center">{zoom}x</span>
        <button onClick={() => setZoom(z => Math.min(8, +(z + 0.5).toFixed(1)))}
          className="p-1 rounded text-dark-500 hover:text-white hover:bg-white/5">
          <ZoomIn className="w-3 h-3" />
        </button>
        <div className="w-px h-3 bg-dark-700 mx-1" />
        <button onClick={() => setTrimMode(!trimMode)}
          className={clsx('flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors',
            trimMode ? 'bg-accent-orange/20 text-accent-orange' : 'text-dark-500 hover:text-white hover:bg-white/5')}>
          <Scissors className="w-3 h-3" /> Trim
        </button>
      </div>

      {/* ── Tracks ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left', width: '100%' }}>

          {/* Waveform track */}
          <TrackRow label="Audio" color="text-brand-400">
            <canvas ref={waveformRef} width={900} height={56}
              className="w-full h-full cursor-crosshair" onClick={seek} />
          </TrackRow>

          {/* Speech / Silence track */}
          <TrackRow label="Speech" color="text-accent-green">
            <canvas ref={speechRef} width={900} height={24}
              className="w-full h-full cursor-crosshair" onClick={seek} />
          </TrackRow>

          {/* Scene cuts track */}
          <TrackRow label="Scenes" color="text-accent-purple">
            <canvas ref={sceneRef} width={900} height={22}
              className="w-full h-full cursor-crosshair" onClick={seek} />
          </TrackRow>

        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-white/5 shrink-0 flex-wrap">
        <Legend color="bg-brand-500/70"     label="Audio waveform" />
        <Legend color="bg-accent-green/70"  label="Speech" />
        <Legend color="bg-accent-orange/50" label="Silence" />
        <Legend color="bg-accent-purple/70" label="Scene cut" />
        {!analysis && (
          <span className="text-[9px] text-dark-600 ml-auto italic">preview data — upload video for real analysis</span>
        )}
      </div>
    </div>
  )
}

function TrackRow({ label, color, children }: {
  label: string; color: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center border-b border-white/[0.04]">
      <span className={clsx('text-[10px] font-medium w-14 shrink-0 px-2', color)}>
        {label}
      </span>
      <div className="flex-1 min-w-0 bg-dark-950/60">
        {children}
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-dark-500">
      <span className={clsx('inline-block w-3 h-1.5 rounded-full', color)} />
      {label}
    </div>
  )
}

function formatTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
