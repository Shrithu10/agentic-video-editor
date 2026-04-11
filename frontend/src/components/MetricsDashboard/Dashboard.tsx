import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart,
  Radar, PolarGrid, PolarAngleAxis
} from 'recharts'
import { useAppStore } from '../../stores/appStore'
import { api } from '../../hooks/useApi'
import type { Metrics } from '../../types'
import { TrendingUp, Activity, Mic, Scissors, BarChart2, Loader2 } from 'lucide-react'

const BRAND = '#3d5eff'
const CYAN  = '#00e5ff'
const GREEN = '#00ff88'
const PURPLE = '#b347ff'
const ORANGE = '#ff7c00'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
      <div className="flex items-start justify-between mb-3">
        <div className="text-dark-400">{icon}</div>
        <span className="text-xs text-dark-500">{sub}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-0.5"
           style={{ color }}>{value}</div>
      <div className="text-xs text-dark-400">{label}</div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-xs">
      <p className="text-dark-400 mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>).map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  )
}

export function MetricsDashboard() {
  const { currentSession, metrics, setMetrics, analysis } = useAppStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentSession) return
    setLoading(true)
    api.getMetrics(currentSession.id)
      .then((m) => setMetrics(m as Metrics))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentSession?.id])

  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center text-dark-500">
        <div className="text-center">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Upload a video to see metrics</p>
        </div>
      </div>
    )
  }

  if (loading || !metrics) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  // Waveform chart data
  const waveformData = (metrics.waveform || []).map((v, i) => ({
    i, amplitude: v,
    speech: ((metrics.speech_segments || []).some(
      s => (i / (metrics.waveform?.length || 1)) * metrics.duration >= s.start &&
           (i / (metrics.waveform?.length || 1)) * metrics.duration <= s.end
    ) ? v : 0)
  }))

  // Silence distribution
  const silDist = (metrics.silence_distribution || Array(10).fill(0)).map((v, i) => ({
    bucket: `${Math.round(i * metrics.duration / 10)}s`,
    silence: v,
  }))

  // Pie chart: speech vs silence
  const pieData = [
    { name: 'Speech', value: metrics.total_speech_duration || 0 },
    { name: 'Silence', value: metrics.total_silence_duration || 0 },
  ]

  // Radar chart
  const radarData = [
    { metric: 'Speech', value: Math.round((metrics.speech_density || 0) * 100) },
    { metric: 'Pacing', value: Math.round((metrics.pacing_score || 0) * 100) },
    { metric: 'Clarity', value: Math.round((metrics.average_rms || 0) * 300) },
    { metric: 'Scenes', value: Math.min(100, Math.round((metrics.scene_count || 0) * 8)) },
    { metric: 'Cuts', value: Math.min(100, Math.round((metrics.cut_frequency_per_min || 0) * 5)) },
  ]

  const dur = metrics.duration || 1

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-sm font-semibold text-white">Video Analytics</h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Mic className="w-4 h-4" />}
          label="Speech Density" color={CYAN}
          value={`${Math.round((metrics.speech_density || 0) * 100)}%`}
          sub={`${(metrics.total_speech_duration || 0).toFixed(1)}s speech`} />
        <StatCard icon={<Scissors className="w-4 h-4" />}
          label="Cut Frequency" color={ORANGE}
          value={`${(metrics.cut_frequency_per_min || 0).toFixed(1)}/min`}
          sub={`${metrics.scene_count || 0} scenes`} />
        <StatCard icon={<Activity className="w-4 h-4" />}
          label="Audio RMS" color={GREEN}
          value={(metrics.average_rms || 0).toFixed(3)}
          sub="avg amplitude" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />}
          label="Pacing Score" color={PURPLE}
          value={`${Math.round((metrics.pacing_score || 0) * 100)}`}
          sub="out of 100" />
      </div>

      {/* Waveform */}
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
        <h3 className="text-xs font-medium text-dark-300 mb-3">Waveform + Speech Overlay</h3>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={waveformData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={[0, 1]} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="amplitude" stroke={BRAND} fill={BRAND + '30'} strokeWidth={1} dot={false} name="Amplitude" />
            <Area type="monotone" dataKey="speech" stroke={GREEN} fill={GREEN + '20'} strokeWidth={1} dot={false} name="Speech" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row: Silence dist + Pie */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <h3 className="text-xs font-medium text-dark-300 mb-3">Silence Distribution</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={silDist} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#6b6b6b' }} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="silence" fill={ORANGE + '80'} name="Silence (s)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <h3 className="text-xs font-medium text-dark-300 mb-3">Speech vs Silence</h3>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50}
                   dataKey="value" paddingAngle={3}>
                <Cell fill={GREEN} />
                <Cell fill={ORANGE + '80'} />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs text-dark-400 mt-2">
            <span><span className="inline-block w-2 h-2 rounded-full bg-accent-green mr-1" />Speech</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-accent-orange/80 mr-1" />Silence</span>
          </div>
        </div>
      </div>

      {/* Row: Radar + scene list */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <h3 className="text-xs font-medium text-dark-300 mb-3">Video Quality Radar</h3>
          <ResponsiveContainer width="100%" height={150}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#2e2e2e" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#6b6b6b' }} />
              <Radar name="Score" dataKey="value" stroke={CYAN} fill={CYAN + '20'} strokeWidth={2} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
          <h3 className="text-xs font-medium text-dark-300 mb-3">Scene Timestamps</h3>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {(metrics.scenes || []).length === 0
              ? <p className="text-xs text-dark-500">No scenes detected</p>
              : (metrics.scenes || []).slice(0, 12).map((ts, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded bg-brand-600/30 text-brand-400 flex items-center justify-center text-[9px] shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-dark-300 font-mono">{formatTime(ts)}</span>
                    <div className="flex-1 h-0.5 bg-dark-700 rounded" />
                  </div>
                ))}
          </div>
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
