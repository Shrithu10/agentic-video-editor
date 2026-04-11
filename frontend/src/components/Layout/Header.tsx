import { Film, Zap, Clock, BarChart2, Edit3, Cpu } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { ViewTab } from '../../types'
import clsx from 'clsx'

const TABS: { id: ViewTab; label: string; icon: typeof Film }[] = [
  { id: 'editor',   label: 'Editor',   icon: Edit3 },
  { id: 'workflow', label: 'Workflow',  icon: Cpu },
  { id: 'metrics',  label: 'Metrics',  icon: BarChart2 },
  { id: 'history',  label: 'History',  icon: Clock },
]

export function Header() {
  const { activeTab, setActiveTab, isProcessing, isAnalyzing, currentSession } = useAppStore()

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-white/5 bg-dark-900/80 backdrop-blur-sm z-50 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <Film className="w-6 h-6 text-brand-400" />
          <Zap className="w-3 h-3 text-accent-cyan absolute -top-0.5 -right-0.5" />
        </div>
        <span className="font-bold text-white text-sm tracking-wide">
          Agentic<span className="text-brand-400">Editor</span>
        </span>
        <span className="text-[10px] text-dark-400 font-mono bg-dark-700 px-1.5 py-0.5 rounded">
          v1.0
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex items-center gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              activeTab === id
                ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30'
                : 'text-dark-300 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {/* Status */}
      <div className="flex items-center gap-3">
        {isAnalyzing && (
          <div className="flex items-center gap-1.5 text-xs text-accent-cyan">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
            Analyzing
          </div>
        )}
        {isProcessing && (
          <div className="flex items-center gap-1.5 text-xs text-accent-purple">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse" />
            Processing
          </div>
        )}
        {currentSession && (
          <div className="text-xs text-dark-400 font-mono truncate max-w-[120px]">
            {currentSession.video_filename}
          </div>
        )}
      </div>
    </header>
  )
}
