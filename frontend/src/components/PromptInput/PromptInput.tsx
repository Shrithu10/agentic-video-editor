import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../stores/appStore'
import { api } from '../../hooks/useApi'
import clsx from 'clsx'

const EXAMPLES = [
  "Make this cinematic with emotional pacing and dramatic color grading",
  "Create a fast-paced highlight reel, remove all silences",
  "Clean up audio, add subtitles, normalize speech",
  "Make it feel like a documentary with slow, thoughtful cuts",
  "Remove filler words and keep only the key points",
  "Add a warm, nostalgic tone with soft music",
]

export function PromptInput() {
  const [localPrompt, setLocalPrompt] = useState('')
  const [showExamples, setShowExamples] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    currentSession, isProcessing, isAnalyzing,
    setPrompt, prompt, setProcessing, resetAgents, setActiveTab, controls
  } = useAppStore()

  // Allow editing once we have a session and are not actively processing.
  // We do NOT gate on status === 'ready' because the WebSocket race condition
  // can leave status stuck at 'analyzing' even after analysis finishes.
  const canEdit = !!currentSession && !isProcessing && !isAnalyzing

  const handleSubmit = async () => {
    if (!localPrompt.trim() || !currentSession || !canEdit) return

    // Append active AI filter flags to the prompt so the pipeline knows about them
    const extras: string[] = []
    if (controls.removeFiller)        extras.push('remove filler words and um/uh sounds')
    if (controls.highlightEmotional)  extras.push('highlight emotional moments')
    if (controls.addSubtitles)        extras.push('add subtitles')
    const fullPrompt = extras.length
      ? `${localPrompt.trim()}. Additionally: ${extras.join(', ')}.`
      : localPrompt.trim()

    setPrompt(fullPrompt)
    setProcessing(true)
    resetAgents()
    setActiveTab('workflow')

    try {
      await api.startEdit(currentSession.id, fullPrompt)
    } catch (e: unknown) {
      setProcessing(false)
      console.error('Edit error:', e)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="relative">
      {/* Examples dropdown */}
      <AnimatePresence>
        {showExamples && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-dark-800 border border-dark-600 rounded-xl overflow-hidden shadow-2xl z-20"
          >
            <div className="p-2">
              <p className="text-xs text-dark-500 px-2 py-1 mb-1">Quick prompts</p>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setLocalPrompt(ex)
                    setShowExamples(false)
                    textareaRef.current?.focus()
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-dark-200 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Sparkles className="w-3 h-3 inline mr-2 text-accent-cyan" />
                  {ex}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className={clsx(
        'flex flex-col gap-2 p-3 rounded-xl border transition-all',
        canEdit
          ? 'bg-dark-800 border-dark-600 focus-within:border-brand-500/50 focus-within:bg-dark-750'
          : 'bg-dark-900 border-dark-700 opacity-50'
      )}>
        <textarea
          ref={textareaRef}
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canEdit}
          placeholder={
            !currentSession  ? 'Upload a video first...'
            : isProcessing   ? 'Processing...'
            : isAnalyzing    ? 'Analysing video...'
            : 'Describe how you want to edit this video...'
          }
          rows={2}
          className="w-full bg-transparent text-sm text-white placeholder:text-dark-500 resize-none outline-none"
        />

        <div className="flex items-center justify-between">
          {/* Examples button */}
          <button
            onClick={() => setShowExamples(!showExamples)}
            disabled={!canEdit}
            className="flex items-center gap-1 text-xs text-dark-500 hover:text-dark-300 transition-colors disabled:pointer-events-none"
          >
            <Sparkles className="w-3 h-3" />
            Examples
            <ChevronDown className={clsx('w-3 h-3 transition-transform', showExamples && 'rotate-180')} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-600">⌘↵ to run</span>
            <button
              onClick={handleSubmit}
              disabled={!canEdit || !localPrompt.trim()}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                canEdit && localPrompt.trim()
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/50'
                  : 'bg-dark-700 text-dark-500 cursor-not-allowed'
              )}
            >
              {isProcessing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
              {isProcessing ? 'Running...' : 'Run Edit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
