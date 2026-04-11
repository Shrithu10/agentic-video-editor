import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from './components/Layout/Header'
import { UploadZone } from './components/Upload/UploadZone'
import { VideoPlayer } from './components/Player/VideoPlayer'
import { Timeline } from './components/Timeline/Timeline'
import { PromptInput } from './components/PromptInput/PromptInput'
import { WorkflowCanvas } from './components/AgentWorkflow/WorkflowCanvas'
import { ControlsPanel } from './components/Controls/ControlsPanel'
import { MetricsDashboard } from './components/MetricsDashboard/Dashboard'
import { HistoryPanel } from './components/HistoryPanel/HistoryPanel'
import { useWebSocket } from './hooks/useWebSocket'
import { useAppStore } from './stores/appStore'

function App() {
  const { currentSession, activeTab, isAnalyzing } = useAppStore()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Connect WebSocket for the current session
  useWebSocket(currentSession?.id || null)

  const hasVideo = !!currentSession

  return (
    <div className="h-screen flex flex-col bg-dark-950 text-white overflow-hidden font-sans">
      <Header />

      <div className="flex-1 overflow-hidden">
        {/* EDITOR TAB */}
        {activeTab === 'editor' && (
          <div className="h-full flex flex-col">
            {!hasVideo ? (
              // Upload screen
              <div className="flex-1 flex items-center justify-center p-8">
                <UploadZone />
              </div>
            ) : (
              // Main editor layout — explicit heights so nothing gets clipped
              <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* Left column: Controls — scrollable */}
                <div className="w-52 shrink-0 border-r border-white/5 overflow-y-auto">
                  <ControlsPanel />
                </div>

                {/* Center column */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0">

                  {/* Video player — fixed height, leaves room for timeline + prompt */}
                  <div className="h-[calc(100%-165px-72px)] min-h-0 p-3 shrink-0">
                    <VideoPlayer
                      onTimeUpdate={setCurrentTime}
                      onDurationChange={setDuration}
                    />
                  </div>

                  {/* Timeline — fixed 165px */}
                  <div className="h-[165px] shrink-0 border-t border-white/5 bg-dark-900">
                    <Timeline
                      currentTime={currentTime}
                      duration={duration || currentSession.duration || 0}
                      onSeek={() => {}}
                    />
                  </div>

                  {/* Prompt input — fixed, sits at bottom */}
                  <div className="shrink-0 p-3 border-t border-white/5 bg-dark-900/50">
                    <PromptInput />
                  </div>
                </div>

                {/* Right column: Workflow — scrollable */}
                <div className="w-[270px] shrink-0 border-l border-white/5 overflow-hidden">
                  <WorkflowCanvas />
                </div>

              </div>
            )}
          </div>
        )}

        {/* WORKFLOW TAB */}
        {activeTab === 'workflow' && (
          <div className="h-full flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <WorkflowCanvas />
            </div>
            {hasVideo && (
              <div className="w-80 shrink-0 border-l border-white/5 flex flex-col">
                <div className="flex-1 p-3">
                  <VideoPlayer
                    onTimeUpdate={setCurrentTime}
                    onDurationChange={setDuration}
                  />
                </div>
                <div className="p-3 border-t border-white/5">
                  <PromptInput />
                </div>
              </div>
            )}
          </div>
        )}

        {/* METRICS TAB */}
        {activeTab === 'metrics' && (
          <div className="h-full flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <MetricsDashboard />
            </div>
            {hasVideo && (
              <div className="w-64 shrink-0 border-l border-white/5 overflow-y-auto">
                <ControlsPanel />
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="h-full overflow-hidden">
            <HistoryPanel />
          </div>
        )}
      </div>

      {/* Analysis banner */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-dark-800 border border-accent-cyan/30 rounded-full px-4 py-2 flex items-center gap-2 text-xs text-accent-cyan shadow-2xl shadow-accent-cyan/10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
            Running AI video analysis...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
