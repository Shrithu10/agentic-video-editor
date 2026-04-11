import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'

interface Props {
  currentTime: number
  duration: number
  onSeek: (t: number) => void
}

export function Waveform({ currentTime, duration, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { analysis } = useAppStore()

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const wf = analysis?.waveform_data || []
    const speech = analysis?.speech_segments || []
    const silence = analysis?.silence_segments || []
    const dur = duration || analysis?.duration || 60

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    // Speech segments (green tint)
    ctx.fillStyle = 'rgba(0, 255, 136, 0.07)'
    for (const seg of speech) {
      const x1 = (seg.start / dur) * W
      const x2 = (seg.end / dur) * W
      ctx.fillRect(x1, 0, x2 - x1, H)
    }

    // Silence segments (slightly darker)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    for (const seg of silence) {
      const x1 = (seg.start / dur) * W
      const x2 = (seg.end / dur) * W
      ctx.fillRect(x1, 0, x2 - x1, H)
    }

    // Draw waveform bars
    if (wf.length > 0) {
      const barW = W / wf.length
      const mid = H / 2
      const maxH = H * 0.42

      for (let i = 0; i < wf.length; i++) {
        const x = i * barW
        const barH = Math.max(1, wf[i] * maxH)
        const progress = currentTime / dur
        const barProgress = i / wf.length

        // Gradient fill based on playback position
        if (barProgress < progress) {
          const grad = ctx.createLinearGradient(x, mid - barH, x, mid + barH)
          grad.addColorStop(0, 'rgba(96, 136, 255, 0.9)')
          grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.9)')
          grad.addColorStop(1, 'rgba(96, 136, 255, 0.9)')
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
        }

        ctx.fillRect(x, mid - barH, Math.max(1, barW - 0.5), barH * 2)
      }
    } else {
      // Placeholder wave
      const mid = H / 2
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, mid)
      ctx.lineTo(W, mid)
      ctx.stroke()
    }

    // Scene markers
    const scenes = analysis?.scene_timestamps || []
    ctx.strokeStyle = 'rgba(179, 71, 255, 0.6)'
    ctx.lineWidth = 1.5
    for (const ts of scenes) {
      const x = (ts / dur) * W
      ctx.beginPath()
      ctx.setLineDash([3, 3])
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Playhead
    if (currentTime > 0 && dur > 0) {
      const px = (currentTime / dur) * W
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fillRect(px - 1, 0, 2, H)

      // Triangle head
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(px - 5, 0)
      ctx.lineTo(px + 5, 0)
      ctx.lineTo(px, 8)
      ctx.closePath()
      ctx.fill()
    }
  }, [analysis, currentTime, duration])

  useEffect(() => {
    draw()
  }, [draw])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !duration) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    onSeek(ratio * duration)
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={80}
        onClick={handleClick}
        className="w-full h-full cursor-crosshair rounded-lg"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Time ruler */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[9px] text-dark-600 pointer-events-none">
          {Array.from({ length: 6 }, (_, i) => {
            const t = (i / 5) * duration
            const mins = Math.floor(t / 60)
            const secs = Math.floor(t % 60)
            return (
              <span key={i}>{mins}:{secs.toString().padStart(2, '0')}</span>
            )
          })}
        </div>
      )}
    </div>
  )
}
