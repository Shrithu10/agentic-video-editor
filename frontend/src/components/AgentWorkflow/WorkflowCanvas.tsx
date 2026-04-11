import { useAppStore } from '../../stores/appStore'
import { AgentNodeCard } from './AgentNodeCard'
import { motion } from 'framer-motion'

export function WorkflowCanvas() {
  const { agents, isProcessing } = useAppStore()

  const activeIdx = agents.findIndex(a => a.status === 'active')
  const completedCount = agents.filter(a => a.status === 'complete').length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <h2 className="text-white font-semibold text-sm">Agent Workflow</h2>
          <p className="text-dark-400 text-xs mt-0.5">
            {isProcessing
              ? `Running: ${agents[activeIdx]?.label || '...'}`
              : completedCount > 0
              ? `Completed ${completedCount}/${agents.length} agents`
              : 'Awaiting edit prompt'}
          </p>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-accent-purple">
            <span className="w-2 h-2 rounded-full bg-accent-purple animate-pulse" />
            Processing
          </div>
        )}
      </div>

      {/* Pipeline */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex flex-col gap-0 relative">
          {/* Vertical connector line */}
          <div className="absolute left-[27px] top-14 bottom-14 w-0.5 bg-dark-700" />
          <motion.div
            className="absolute left-[27px] top-14 w-0.5 bg-gradient-to-b from-brand-500 to-accent-cyan origin-top"
            style={{
              height: `${(completedCount / Math.max(1, agents.length - 1)) * 100}%`
            }}
            transition={{ duration: 0.5 }}
          />

          {agents.map((agent, idx) => (
            <AgentNodeCard
              key={agent.name}
              agent={agent}
              index={idx}
              isLast={idx === agents.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Summary row */}
      {completedCount > 0 && (
        <div className="p-4 border-t border-white/5">
          <div className="grid grid-cols-7 gap-1">
            {agents.map(a => (
              <div key={a.name}
                className={`h-1 rounded-full transition-all duration-500 ${
                  a.status === 'complete' ? 'bg-accent-green' :
                  a.status === 'active'   ? 'bg-accent-cyan animate-pulse' :
                  a.status === 'failed'   ? 'bg-accent-red' :
                  'bg-dark-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
