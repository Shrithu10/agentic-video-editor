import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Play, Pause, Volume2, VolumeX, Download,
  Maximize, Loader2
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { api } from '../../hooks/useApi'
import clsx from 'clsx'

interface Props {
  onTimeUpdate: (t: number) => void
  onDurationChange: (d: number) => void
}

export function VideoPlayer({ onTimeUpdate, onDurationChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showOutput, setShowOutput] = useState(false)

  const { currentSession, outputUrl, isProcessing, controls } = useAppStore()

  const videoSrc = outputUrl
    ? outputUrl
    : currentSession?.video_path
    ? currentSession.video_path
    : null

  useEffect(() => {
    if (outputUrl) setShowOutput(true)
  }, [outputUrl])

  const displaySrc = showOutput && outputUrl ? outputUrl : videoSrc

  // ── Apply controls panel → video element ────────────────────────────────────
  // Volume from controls panel
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = Math.max(0, Math.min(2, controls.volume))
    setVolume(controls.volume)
  }, [controls.volume])

  // CSS visual filters: brightness, contrast, saturation, warmth
  const videoFilter = [
    `brightness(${1 + controls.brightness})`,
    `contrast(${controls.contrast})`,
    `saturate(${controls.saturation})`,
    controls.warmth !== 0
      ? `hue-rotate(${-controls.warmth * 18}deg) sepia(${Math.abs(controls.warmth) * 0.3})`
      : '',
  ].filter(Boolean).join(' ')

  // ── Playback handlers ────────────────────────────────────────────────────────
  const handleTimeUpdate = () => {
    const t = videoRef.current?.currentTime || 0
    setCurrentTime(t)
    onTimeUpdate(t)
  }

  const handleDurationChange = () => {
    const d = videoRef.current?.duration || 0
    if (d && isFinite(d)) {
      setDuration(d)
      onDurationChange(d)
    }
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }

  const seek = useCallback((t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t
      setCurrentTime(t)
    }
  }, [])

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted
      setMuted(!muted)
    }
  }

  const handleVolumeChange = (v: number) => {
    setVolume(v)
    if (videoRef.current) videoRef.current.volume = v
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden flex flex-col min-h-0">
      {/* Video */}
      <div className="relative flex-1 min-h-0 bg-dark-950 flex items-center justify-center overflow-hidden">
        {displaySrc ? (
          <>
            <video
              ref={videoRef}
              src={displaySrc}
              className="max-h-full max-w-full"
              style={{ filter: videoFilter }}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onWaiting={() => setLoading(true)}
              onCanPlay={() => setLoading(false)}
              onEnded={() => setPlaying(false)}
            />
            {/* Vignette overlay */}
            {controls.vignette > 0 && (
              <div
                className="absolute inset-0 pointer-events-none rounded-xl"
                style={{
                  background: `radial-gradient(ellipse at center, transparent ${Math.round((1 - controls.vignette) * 60)}%, rgba(0,0,0,${(controls.vignette * 0.85).toFixed(2)}) 100%)`,
                }}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-dark-600">
            <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center">
              <Play className="w-7 h-7 ml-0.5" />
            </div>
            <p className="text-sm">No video loaded</p>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-accent-cyan animate-spin" />
            <p className="text-white text-sm font-medium">AI Agents Processing...</p>
            <p className="text-dark-400 text-xs">Your edited video will appear here</p>
          </div>
        )}

        {/* Toggle original/output */}
        {outputUrl && (
          <div className="absolute top-3 right-3 flex gap-1">
            <button
              onClick={() => setShowOutput(false)}
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                !showOutput ? 'bg-white/20 text-white' : 'text-dark-400 hover:text-white'
              )}
            >
              Original
            </button>
            <button
              onClick={() => setShowOutput(true)}
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                showOutput ? 'bg-brand-500/40 text-brand-300 border border-brand-500/30' : 'text-dark-400 hover:text-white'
              )}
            >
              Edited
            </button>
          </div>
        )}

        {/* Active filter indicator */}
        {(controls.brightness !== 0 || controls.contrast !== 1 ||
          controls.saturation !== 1 || controls.warmth !== 0 || controls.vignette > 0) && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
            <span className="text-[10px] text-accent-cyan font-mono">filters active</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-dark-900/95 px-4 py-3 space-y-2 border-t border-white/5">
        {/* Progress bar */}
        <div
          className="relative h-1.5 bg-dark-700 rounded-full cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - rect.left) / rect.width
            seek(ratio * duration)
          }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-accent-cyan rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${pct}% - 6px)` }}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            disabled={!displaySrc}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Volume */}
          <button onClick={toggleMute}
            className="p-1 text-dark-400 hover:text-white transition-colors">
            {muted || volume === 0
              ? <VolumeX className="w-3.5 h-3.5" />
              : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range" min="0" max="2" step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 accent-brand-400"
          />

          {/* Time */}
          <span className="text-xs text-dark-400 font-mono ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Download */}
          {currentSession && outputUrl && (
            <a
              href={api.downloadUrl(currentSession.id)}
              download
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition-colors text-xs font-medium border border-accent-green/20"
            >
              <Download className="w-3 h-3" />
              Download
            </a>
          )}

          <button className="p-1.5 rounded text-dark-400 hover:text-white transition-colors"
            onClick={() => videoRef.current?.requestFullscreen()}>
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
