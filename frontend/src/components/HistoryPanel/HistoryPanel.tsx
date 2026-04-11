import { useEffect, useState } from 'react'
import { Clock, Loader2, Film, ChevronRight, Star, RotateCcw, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../stores/appStore'
import { api } from '../../hooks/useApi'
import type { Session, AgentStep } from '../../types'
import clsx from 'clsx'

const STATUS_COLORS: Record<string, string> = {
  uploaded:   'text-dark-400 bg-dark-700',
  analyzing:  'text-accent-cyan bg-cyan-500/10',
  ready:      'text-blue-400 bg-blue-500/10',
  processing: 'text-accent-purple bg-purple-500/10',
  complete:   'text-accent-green bg-green-500/10',
  failed:     'text-accent-red bg-red-500/10',
}

interface StepBadgeProps { step: AgentStep }
function StepBadge({ step }: StepBadgeProps) {
  return (
    <div className={clsx(
      'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg',
      step.status === 'complete' ? 'bg-accent-green/10 text-accent-green' :
      step.status === 'failed'   ? 'bg-accent-red/10 text-accent-red' :
      'bg-dark-700 text-dark-400'
    )}>
      {step.status === 'complete' ? <Check className="w-2.5 h-2.5" /> :
       step.status === 'failed'   ? <X className="w-2.5 h-2.5" /> :
       <Clock className="w-2.5 h-2.5" />}
      {step.agent_label}
    </div>
  )
}

interface SessionCardProps {
  session: Session
  isSelected: boolean
  onClick: () => void
}

function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  const dur = session.duration
  const date = new Date(session.created_at).toLocaleString()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={clsx(
        'rounded-xl border cursor-pointer transition-all p-3',
        isSelected
          ? 'border-brand-500/40 bg-brand-600/10'
          : 'border-dark-700 bg-dark-800 hover:border-dark-500 hover:bg-dark-750'
      )}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-16 h-10 rounded-lg overflow-hidden bg-dark-700 shrink-0 flex items-center justify-center">
          {session.thumbnail_path ? (
            <img src={`/thumbnails/${session.thumbnail_path.split('/').pop()}`}
                 alt="" className="w-full h-full object-cover" />
          ) : (
            <Film className="w-5 h-5 text-dark-500" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-medium text-white truncate">
              {session.video_filename}
            </p>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
              STATUS_COLORS[session.status] || STATUS_COLORS.ready
            )}>
              {session.status}
            </span>
          </div>

          {session.prompt && (
            <p className="text-[11px] text-dark-400 mt-0.5 truncate italic">
              "{session.prompt}"
            </p>
          )}

          <div className="flex items-center gap-2 mt-1 text-[10px] text-dark-500">
            <span>{date}</span>
            {dur && <span>· {Math.floor(dur / 60)}:{Math.floor(dur % 60).toString().padStart(2, '0')}</span>}
            <span>· v{session.version}</span>
          </div>
        </div>

        <ChevronRight className={clsx('w-3.5 h-3.5 text-dark-600 mt-1 transition-transform',
          isSelected && 'rotate-90')} />
      </div>
    </motion.div>
  )
}

interface DetailViewProps { session: Session }
function DetailView({ session }: DetailViewProps) {
  const [detail, setDetail] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getSession(session.id)
      .then((d) => setDetail(d as Session))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [session.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (!detail) return null

  const steps: AgentStep[] = detail.steps || []
  const decisions = detail.decisions || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 mt-3"
    >
      {/* Agent trace */}
      <div>
        <h4 className="text-xs font-semibold text-dark-300 uppercase tracking-wide mb-2">
          Agent Trace ({steps.length} steps)
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {steps.map(s => <StepBadge key={s.id} step={s} />)}
        </div>
      </div>

      {/* Step details */}
      {steps.filter(s => s.status === 'complete' && s.output_data).map(step => (
        <div key={step.id} className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-dark-800/50">
            <span className="text-xs font-medium text-dark-200">{step.agent_label}</span>
            {step.started_at && step.completed_at && (
              <span className="text-[10px] text-dark-500 font-mono">
                {((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          <div className="px-3 py-2 text-[10px] font-mono text-dark-400 max-h-24 overflow-y-auto">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(step.output_data, null, 2).slice(0, 500)}
            </pre>
          </div>
        </div>
      ))}

      {/* Edit decisions */}
      {decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-dark-300 uppercase tracking-wide mb-2">
            Edit Decisions ({decisions.length})
          </h4>
          <div className="space-y-1.5">
            {decisions.slice(0, 6).map(d => (
              <div key={d.id}
                className="flex items-start gap-2 text-xs bg-dark-800 rounded-lg px-3 py-2 border border-dark-700">
                <span className={clsx(
                  'px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 mt-0.5',
                  d.decision_type === 'cut'    ? 'bg-orange-500/20 text-orange-300' :
                  d.decision_type === 'effect' ? 'bg-purple-500/20 text-purple-300' :
                  'bg-brand-500/20 text-brand-300'
                )}>
                  {d.decision_type}
                </span>
                <span className="text-dark-300 flex-1">{d.description}</span>
                <span className="text-[9px] text-dark-600 shrink-0">{d.agent_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output */}
      {detail.output_path && (
        <div className="bg-accent-green/10 border border-accent-green/20 rounded-xl p-3">
          <p className="text-xs font-medium text-accent-green mb-1">Output Video Ready</p>
          <a
            href={api.downloadUrl(detail.id)}
            download
            className="text-xs text-accent-green/70 hover:text-accent-green underline"
          >
            Download edited video →
          </a>
        </div>
      )}
    </motion.div>
  )
}

export function HistoryPanel() {
  const { sessions, setSessions, selectedHistorySession, setSelectedHistorySession } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSessions()
      .then(data => setSessions((data as { sessions: Session[] }).sessions))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white">Edit History</h2>
        <button
          onClick={() => {
            setLoading(true)
            api.getSessions()
              .then(data => setSessions((data as { sessions: Session[] }).sessions))
              .catch(console.error)
              .finally(() => setLoading(false))
          }}
          className="p-1 rounded text-dark-500 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-dark-500">
            <Clock className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No edit history yet</p>
            <p className="text-xs mt-1">Upload and edit a video to see it here</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.id}>
              <SessionCard
                session={session}
                isSelected={selectedHistorySession?.id === session.id}
                onClick={() => setSelectedHistorySession(
                  selectedHistorySession?.id === session.id ? null : session
                )}
              />
              <AnimatePresence>
                {selectedHistorySession?.id === session.id && (
                  <motion.div
                    key="detail"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-1"
                  >
                    <DetailView session={session} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
