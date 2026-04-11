import { useState } from 'react'
import { Volume2, Sun, Palette, Zap, ChevronDown, CheckSquare, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../stores/appStore'
import type { Controls } from '../../types'
import clsx from 'clsx'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
  color?: string
}

function Slider({ label, value, min, max, step, onChange, format, color = 'brand' }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-dark-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-dark-700 cursor-pointer accent-brand-400"
          style={{
            background: `linear-gradient(to right, var(--tw-gradient-from) ${pct}%, #2e2e2e ${pct}%)`,
            '--tw-gradient-from': '#3d5eff',
          } as React.CSSProperties}
        />
      </div>
      <span className="text-xs text-dark-300 font-mono w-12 text-right shrink-0">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </div>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-dark-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-dark-800 hover:bg-dark-750 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-dark-200">
          {icon}
          {title}
        </div>
        <ChevronDown className={clsx('w-3.5 h-3.5 text-dark-500 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-3 space-y-3 bg-dark-900">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs text-dark-300 hover:text-white transition-colors w-full"
    >
      {checked
        ? <CheckSquare className="w-3.5 h-3.5 text-brand-400" />
        : <Square className="w-3.5 h-3.5 text-dark-600" />}
      {label}
    </button>
  )
}

export function ControlsPanel() {
  const { controls, updateControl } = useAppStore()
  const u = <K extends keyof Controls>(k: K) => (v: Controls[K]) => updateControl(k, v)

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <h3 className="text-xs font-semibold text-dark-300 uppercase tracking-wider px-1">Controls</h3>

      {/* Audio */}
      <Section title="Audio" icon={<Volume2 className="w-3.5 h-3.5 text-accent-cyan" />}>
        <Slider label="Volume" value={controls.volume} min={0} max={2} step={0.05}
          onChange={u('volume')} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Music Level" value={controls.musicLevel} min={0} max={1} step={0.05}
          onChange={u('musicLevel')} format={(v) => `${Math.round(v * 100)}%`} />
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Toggle label="Denoise" checked={controls.denoise} onChange={u('denoise')} />
          <Toggle label="Normalize" checked={controls.normalize} onChange={u('normalize')} />
        </div>
      </Section>

      {/* Visual */}
      <Section title="Visual" icon={<Sun className="w-3.5 h-3.5 text-accent-orange" />}>
        <Slider label="Brightness" value={controls.brightness} min={-1} max={1} step={0.05}
          onChange={u('brightness')} format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))} />
        <Slider label="Contrast" value={controls.contrast} min={0.5} max={2} step={0.05}
          onChange={u('contrast')} format={(v) => v.toFixed(2)} />
        <Slider label="Saturation" value={controls.saturation} min={0} max={2} step={0.05}
          onChange={u('saturation')} format={(v) => v.toFixed(2)} />
        <Slider label="Warmth" value={controls.warmth} min={-1} max={1} step={0.05}
          onChange={u('warmth')} format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))} />
        <Slider label="Vignette" value={controls.vignette} min={0} max={1} step={0.05}
          onChange={u('vignette')} format={(v) => `${Math.round(v * 100)}%`} />
      </Section>

      {/* AI Filters */}
      <Section title="AI Filters" icon={<Zap className="w-3.5 h-3.5 text-accent-purple" />}>
        <Toggle label="Remove Filler Words" checked={controls.removeFiller} onChange={u('removeFiller')} />
        <Toggle label="Highlight Emotional Parts" checked={controls.highlightEmotional} onChange={u('highlightEmotional')} />
        <Toggle label="Auto Subtitles" checked={controls.addSubtitles} onChange={u('addSubtitles')} />
      </Section>

      {/* Reset */}
      <button
        onClick={() => {
          updateControl('volume', 1.0)
          updateControl('musicLevel', 0.0)
          updateControl('denoise', false)
          updateControl('normalize', false)
          updateControl('brightness', 0.0)
          updateControl('contrast', 1.0)
          updateControl('saturation', 1.0)
          updateControl('warmth', 0.0)
          updateControl('vignette', 0.0)
          updateControl('removeFiller', true)
          updateControl('highlightEmotional', false)
          updateControl('addSubtitles', false)
        }}
        className="text-xs text-dark-500 hover:text-dark-300 transition-colors text-center mt-1"
      >
        Reset to defaults
      </button>
    </div>
  )
}
