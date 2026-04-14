import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import { useAppStore } from '../../stores/appStore'
import { api } from '../../hooks/useApi'
import type { Metrics } from '../../types'
import {
  TrendingUp, Activity, Mic, Scissors,
  BarChart2, Loader2, Clock, Zap, Film
} from 'lucide-react'

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  brand:  '#3d5eff',
  cyan:   '#00e5ff',
  green:  '#00ff88',
  purple: '#b347ff',
  orange: '#ff7c00',
  red:    '#ff4757',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(s: number) {
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}
function pct(v: number) { return `${Math.round(v * 100)}%` }

// ── Sub-components ────────────────────────────────────────────────────────────
interface KpiProps {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: string
  bar?: number   // 0-1 fill for the accent bar
}
function KpiCard({ icon, label, value, sub, accent, bar }: KpiProps) {
  return (
    <div className="relative bg-dark-800 border border-dark-700 rounded-xl p-4 overflow-hidden flex flex-col gap-2">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
           style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
             style={{ background: accent + '22', color: accent }}>
          {icon}
        </div>
        <span className="text-[10px] text-dark-500 font-mono">{sub}</span>
      </div>
      <div>
        <div className="text-xl font-bold text-white" style={{ color: accent }}>{value}</div>
        <div className="text-xs text-dark-400 mt-0.5">{label}</div>
      </div>
      {bar !== undefined && (
        <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${Math.round(bar * 100)}%`, background: accent }} />
        </div>
      )}
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null
  return (
    <div className="bg-dark-800 border border-dark-600/60 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label !== undefined && <p className="text-dark-400 mb-1.5">{String(label)}</p>}
      {(payload as Array<{ name: string; value: number; color: string }>).map((p, i) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>
          {p.name}: <span className="text-white">{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function MetricsDashboard() {
  const { currentSession, metrics, setMetrics } = useAppStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentSession) return
    setLoading(true)
    api.getMetrics(currentSession.id)
      .then((m) => setMetrics(m as Metrics))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [currentSession?.id])

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!currentSession) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-dark-500">
        <BarChart2 className="w-14 h-14 opacity-20" />
        <div className="text-center">
          <p className="text-sm font-medium text-dark-400">No video loaded</p>
          <p className="text-xs mt-1">Upload a video to see analytics</p>
        </div>
      </div>
    )
  }

  if (loading || !metrics) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        <p className="text-xs text-dark-500">Loading analytics...</p>
      </div>
    )
  }

  // ── Data prep ────────────────────────────────────────────────────────────────
  const dur = metrics.duration || 1

  const waveformData = (metrics.waveform || []).map((v, i) => {
    const t = (i / (metrics.waveform?.length || 1)) * dur
    const inSpeech = (metrics.speech_segments || []).some(s => t >= s.start && t <= s.end)
    return { t: +t.toFixed(1), amp: +v.toFixed(4), speech: inSpeech ? +v.toFixed(4) : 0 }
  })

  // Scene timeline: segments between cuts
  const cuts = [0, ...(metrics.scenes || []), dur]
  const sceneSegments = cuts.slice(0, -1).map((start, i) => ({
    start: +start.toFixed(1),
    end: +(cuts[i + 1]).toFixed(1),
    len: +(cuts[i + 1] - start).toFixed(1),
    label: `S${i + 1}`,
  }))

  // Silence distribution cleaned up
  const silDist = (metrics.silence_distribution || Array(10).fill(0)).map((v, i) => ({
    time: `${Math.round(i * dur / 10)}s`,
    silence: +v.toFixed(2),
  }))

  // Pie: speech vs silence
  const speechT = metrics.total_speech_duration || 0
  const silenceT = metrics.total_silence_duration || 0
  const other = Math.max(0, dur - speechT - silenceT)
  const pieData = [
    { name: 'Speech',  value: +speechT.toFixed(1) },
    { name: 'Silence', value: +silenceT.toFixed(1) },
    ...(other > 0.5 ? [{ name: 'Other', value: +other.toFixed(1) }] : []),
  ]
  const pieColors = [C.green, C.orange, '#555']

  // Radar
  const radarData = [
    { metric: 'Speech',  value: Math.round((metrics.speech_density || 0) * 100) },
    { metric: 'Pacing',  value: Math.round((metrics.pacing_score || 0) * 100) },
    { metric: 'Audio',   value: Math.min(100, Math.round((metrics.average_rms || 0) * 400)) },
    { metric: 'Scenes',  value: Math.min(100, Math.round((metrics.scene_count || 0) * 10)) },
    { metric: 'Cuts/m',  value: Math.min(100, Math.round((metrics.cut_frequency_per_min || 0) * 6)) },
  ]

  // Insights text
  const insights: { icon: React.ReactNode; text: string; color: string }[] = []
  if ((metrics.speech_density || 0) > 0.7)
    insights.push({ icon: <Mic className="w-3.5 h-3.5" />, text: 'High speech density — great for removing silence', color: C.green })
  if ((metrics.cut_frequency_per_min || 0) < 3)
    insights.push({ icon: <Scissors className="w-3.5 h-3.5" />, text: 'Low cut frequency — video may benefit from faster pacing', color: C.orange })
  if ((metrics.pacing_score || 0) > 0.6)
    insights.push({ icon: <Zap className="w-3.5 h-3.5" />, text: 'Good pacing score', color: C.cyan })
  if ((metrics.scene_count || 0) > 8)
    insights.push({ icon: <Film className="w-3.5 h-3.5" />, text: `${metrics.scene_count} scenes detected — rich content`, color: C.purple })

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5 min-h-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Video Analytics</h2>
            <p className="text-xs text-dark-500 mt-0.5">
              {currentSession.video_filename} · {fmt(dur)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-800 border border-dark-700 rounded-full">
            <Clock className="w-3 h-3 text-dark-500" />
            <span className="text-[10px] text-dark-400 font-mono">{fmt(dur)}</span>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            icon={<Mic className="w-4 h-4" />}
            label="Speech Density"
            value={pct(metrics.speech_density || 0)}
            sub={fmt(speechT) + ' speech'}
            accent={C.green}
            bar={metrics.speech_density || 0}
          />
          <KpiCard
            icon={<Scissors className="w-4 h-4" />}
            label="Cut Frequency"
            value={`${(metrics.cut_frequency_per_min || 0).toFixed(1)}/min`}
            sub={`${metrics.scene_count || 0} scenes`}
            accent={C.orange}
            bar={Math.min(1, (metrics.cut_frequency_per_min || 0) / 20)}
          />
          <KpiCard
            icon={<Activity className="w-4 h-4" />}
            label="Avg Audio Level"
            value={(metrics.average_rms || 0).toFixed(3)}
            sub="RMS amplitude"
            accent={C.cyan}
            bar={Math.min(1, (metrics.average_rms || 0) * 4)}
          />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Pacing Score"
            value={`${Math.round((metrics.pacing_score || 0) * 100)}`}
            sub="out of 100"
            accent={C.purple}
            bar={metrics.pacing_score || 0}
          />
        </div>

        {/* Waveform */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-dark-200">Audio Waveform</h3>
            <div className="flex items-center gap-3 text-[10px] text-dark-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-1 rounded" style={{ background: C.brand }} />
                Amplitude
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-1 rounded" style={{ background: C.green }} />
                Speech
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={waveformData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="ampGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.brand} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={C.brand} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="amp"    stroke={C.brand} fill="url(#ampGrad)" strokeWidth={1.5} dot={false} name="Amplitude" />
              <Area type="monotone" dataKey="speech" stroke={C.green} fill="url(#spGrad)"  strokeWidth={1}   dot={false} name="Speech" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Scene timeline */}
        {sceneSegments.length > 1 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-dark-200 mb-3">
              Scene Timeline · {sceneSegments.length} scenes
            </h3>
            <div className="flex h-8 rounded-lg overflow-hidden gap-px">
              {sceneSegments.map((seg, i) => (
                <div
                  key={i}
                  title={`Scene ${i + 1}: ${seg.start}s – ${seg.end}s (${seg.len}s)`}
                  className="group relative flex items-center justify-center text-[9px] font-mono cursor-default transition-all hover:brightness-125"
                  style={{
                    flex: seg.len,
                    background: i % 2 === 0
                      ? `${C.brand}30`
                      : `${C.purple}25`,
                    borderTop: `2px solid ${i % 2 === 0 ? C.brand : C.purple}`,
                  }}
                >
                  <span className="text-dark-500 group-hover:text-dark-300 select-none">
                    {seg.len >= dur / sceneSegments.length * 0.7 ? `${seg.len}s` : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-dark-600 font-mono">
              <span>0:00</span>
              <span>{fmt(dur / 2)}</span>
              <span>{fmt(dur)}</span>
            </div>
          </div>
        )}

        {/* Row: Silence + Pie */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-dark-200 mb-3">Silence Distribution</h3>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={silDist} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#555' }} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="silence" fill={C.orange + 'aa'} name="Silence (s)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-dark-200 mb-2">Speech vs Silence</h3>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%"
                     innerRadius={28} outerRadius={44}
                     dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i] || '#555'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-dark-400 mt-1">
              {pieData.map((d, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: pieColors[i] }} />
                  {d.name} {fmt(d.value)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Radar */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-dark-200 mb-1">Quality Radar</h3>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
              <PolarGrid stroke="#2e2e2e" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#888' }} />
              <Radar name="Score" dataKey="value" stroke={C.cyan}
                     fill={C.cyan + '18'} strokeWidth={2} dot={{ r: 3, fill: C.cyan }} />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-dark-200 mb-3">Insights</h3>
            <div className="space-y-2">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs"
                     style={{ color: ins.color }}>
                  {ins.icon}
                  <span className="text-dark-300">{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scene list */}
        {(metrics.scenes || []).length > 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-dark-200 mb-3">Scene Cuts</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {(metrics.scenes || []).slice(0, 18).map((ts, i) => (
                <div key={i}
                  className="flex items-center gap-1.5 bg-dark-900 rounded-lg px-2 py-1.5 border border-dark-700">
                  <span className="w-4 h-4 shrink-0 rounded bg-brand-600/30 text-brand-400 flex items-center justify-center text-[9px]">
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-dark-300 font-mono">{formatTime(ts)}</span>
                </div>
              ))}
              {(metrics.scenes || []).length > 18 && (
                <div className="flex items-center justify-center bg-dark-900 rounded-lg px-2 py-1.5 border border-dark-700 text-[10px] text-dark-500">
                  +{(metrics.scenes || []).length - 18} more
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
