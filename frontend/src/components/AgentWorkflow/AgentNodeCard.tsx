import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Microscope, Scissors, Sparkles, Type,
  Music2, Star, CheckCircle2, Loader2, Clock, XCircle
} from 'lucide-react'
import type { AgentNode } from '../../types'
import clsx from 'clsx'
import { useState } from 'react'

const ICONS: Record<string, typeof Brain> = {
  planner:   Brain,
  analyzer:  Microscope,
  cutter:    Scissors,
  effects:   Sparkles,
  subtitles: Type,
  music:     Music2,
  critic:    Star,
}

const COLORS: Record<string, { ring: string; glow: string; bg: string; text: string }> = {
  planner:   { ring: 'ring-brand-400',  glow: '#6088ff', bg: 'bg-brand-500/20',  text: 'text-brand-300'  },
  analyzer:  { ring: 'ring-accent-cyan',    glow: '#00e5ff', bg: 'bg-cyan-500/20',   text: 'text-cyan-300'   },
  cutter:    { ring: 'ring-accent-orange',  glow: '#ff7c00', bg: 'bg-orange-500/20', text: 'text-orange-300' },
  effects:   { ring: 'ring-accent-purple',  glow: '#b347ff', bg: 'bg-purple-500/20', text: 'text-purple-300' },
  subtitles: { ring: 'ring-yellow-400',     glow: '#facc15', bg: 'bg-yellow-500/20', text: 'text-yellow-300' },
  music:     { ring: 'ring-pink-400',       glow: '#f472b6', bg: 'bg-pink-500/20',   text: 'text-pink-300'   },
  critic:    { ring: 'ring-accent-green',   glow: '#00ff88', bg: 'bg-green-500/20',  text: 'text-green-300'  },
}

interface Props {
  agent: AgentNode
  index: number
  isLast: boolean
}

export function AgentNodeCard({ agent, index, isLast }: Props) {
  const [expanded, setExpanded] = useState(false)
  const Icon = ICONS[agent.name] || Brain
  const color = COLORS[agent.name] || COLORS.planner

  const isActive   = agent.status === 'active'
  const isComplete = agent.status === 'complete'
  const isFailed   = agent.status === 'failed'
  const isPending  = agent.status === 'pending' || agent.status === 'idle'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex items-start gap-4 pb-6 last:pb-0"
    >
      {/* Icon bubble */}
      <div className="relative z-10 shrink-0">
        <motion.div
          animate={isActive ? {
            boxShadow: [
              `0 0 8px ${color.glow}40`,
              `0 0 20px ${color.glow}80`,
              `0 0 8px ${color.glow}40`,
            ]
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={clsx(
            'w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-300',
            isActive   && `${color.ring} ${color.bg} ring-1`,
            isComplete && 'border-accent-green/50 bg-accent-green/10',
            isFailed   && 'border-accent-red/50 bg-accent-red/10',
            isPending  && 'border-dark-600 bg-dark-800',
          )}
        >
          {isActive   && <Loader2 className={clsx('w-6 h-6 animate-spin', color.text)} />}
          {isComplete && <CheckCircle2 className="w-6 h-6 text-accent-green" />}
          {isFailed   && <XCircle className="w-6 h-6 text-accent-red" />}
          {isPending  && <Icon className="w-6 h-6 text-dark-400" />}
        </motion.div>

        {/* Pulse ring for active */}
        {isActive && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={clsx(
              'absolute inset-0 rounded-2xl border-2',
              color.ring,
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => (isComplete || isFailed) && setExpanded(!expanded)}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx(
                'text-sm font-semibold',
                isActive   && color.text,
                isComplete && 'text-white',
                isFailed   && 'text-accent-red',
                isPending  && 'text-dark-400',
              )}>
                {agent.label}
              </span>
              {isActive && (
                <span className={clsx('text-xs px-1.5 py-0.5 rounded font-mono', color.bg, color.text)}>
                  RUNNING
                </span>
              )}
              {isComplete && (
                <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-accent-green/10 text-accent-green">
                  DONE
                </span>
              )}
            </div>
            <p className={clsx(
              'text-xs mt-0.5',
              isActive || isComplete ? 'text-dark-300' : 'text-dark-500'
            )}>
              {agent.message || agent.description}
            </p>
          </div>
          {isComplete && agent.data && (
            <button className="text-xs text-dark-500 hover:text-dark-300 shrink-0 ml-2">
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>

        {/* Expanded output data */}
        <AnimatePresence>
          {expanded && isComplete && agent.data && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 bg-dark-900/80 rounded-xl border border-dark-700 text-xs font-mono text-dark-300 max-h-40 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(agent.data, null, 2)
                    .split('\n')
                    .slice(0, 30)
                    .join('\n')}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timing */}
        {(agent.startedAt || agent.completedAt) && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-dark-600">
            <Clock className="w-2.5 h-2.5" />
            {agent.completedAt && agent.startedAt
              ? `${((new Date(agent.completedAt).getTime() - new Date(agent.startedAt).getTime()) / 1000).toFixed(1)}s`
              : 'Running...'}
          </div>
        )}
      </div>
    </motion.div>
  )
}
