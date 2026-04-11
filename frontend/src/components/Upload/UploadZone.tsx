import { useState, useCallback, useRef } from 'react'
import { Upload, Film, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../stores/appStore'
import { api } from '../../hooks/useApi'
import clsx from 'clsx'

type UploadState = 'idle' | 'dragging' | 'uploading' | 'done' | 'error'

export function UploadZone() {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const { setCurrentSession, setUploadProgress, uploadProgress, setAnalyzing } = useAppStore()

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|avi|mkv|webm|mpeg)$/i)) {
      setError('Please upload a video file (MP4, MOV, AVI, MKV, WEBM)')
      setState('error')
      return
    }

    setState('uploading')
    setError('')

    try {
      const result = await api.uploadVideo(file, (pct) => setUploadProgress(pct))

      setState('done')
      setUploadProgress(100)

      setCurrentSession({
        id: result.session_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        video_filename: result.filename,
        video_path: result.video_url,
        status: 'uploaded',
        version: 1,
        duration: result.duration,
        thumbnail_path: result.thumbnail || undefined,
      })

      setAnalyzing(true)

    } catch (e: unknown) {
      setState('error')
      setError((e as Error).message || 'Upload failed')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setState('dragging')
  }

  const onDragLeave = () => setState('idle')

  const onClick = () => fileRef.current?.click()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={state === 'idle' || state === 'error' ? onClick : undefined}
          className={clsx(
            'relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer group',
            state === 'dragging' && 'border-brand-400 bg-brand-500/10 scale-[1.02]',
            state === 'uploading' && 'border-accent-cyan/40 bg-dark-800 cursor-default',
            state === 'done' && 'border-accent-green/40 bg-accent-green/5 cursor-default',
            state === 'error' && 'border-accent-red/40 bg-accent-red/5',
            state === 'idle' && 'border-dark-600 hover:border-brand-500/50 hover:bg-brand-500/5',
          )}
        >
          {/* Background grid */}
          <div className="absolute inset-0 rounded-2xl bg-grid-pattern bg-[size:24px_24px] opacity-30" />

          <AnimatePresence mode="wait">
            {state === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-dark-700 border border-dark-500 flex items-center justify-center group-hover:border-brand-500/50 transition-colors">
                    <Upload className="w-9 h-9 text-dark-300 group-hover:text-brand-400 transition-colors" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg mb-1">Drop your video here</p>
                    <p className="text-dark-400 text-sm">or click to browse</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-dark-500">
                    {['MP4', 'MOV', 'AVI', 'MKV', 'WEBM'].map(f => (
                      <span key={f} className="px-2 py-0.5 rounded bg-dark-700 border border-dark-600">{f}</span>
                    ))}
                    <span className="text-dark-600">· up to 500 MB</span>
                  </div>
                </div>
              </motion.div>
            )}

            {state === 'dragging' && (
              <motion.div key="dragging" initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <Film className="w-16 h-16 text-brand-400 animate-bounce" />
                  <p className="text-brand-300 font-semibold text-xl">Release to upload</p>
                </div>
              </motion.div>
            )}

            {state === 'uploading' && (
              <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="relative z-10 flex flex-col items-center gap-5">
                  <Loader2 className="w-14 h-14 text-accent-cyan animate-spin" />
                  <div className="w-full max-w-xs">
                    <div className="flex justify-between text-xs text-dark-400 mb-2">
                      <span>Uploading...</span>
                      <span className="text-accent-cyan font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {state === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <CheckCircle className="w-16 h-16 text-accent-green" />
                  <div>
                    <p className="text-white font-semibold text-lg">Upload complete!</p>
                    <p className="text-dark-400 text-sm mt-1">Analysing video content...</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-accent-green">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                    Running AI analysis
                  </div>
                </div>
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <AlertCircle className="w-14 h-14 text-accent-red" />
                  <div>
                    <p className="text-white font-semibold">Upload failed</p>
                    <p className="text-accent-red text-sm mt-1">{error}</p>
                  </div>
                  <p className="text-dark-400 text-xs">Click to try again</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input ref={fileRef} type="file" accept="video/*" onChange={onFileChange} className="hidden" />

        {/* Features row */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { icon: '🎬', label: 'Scene Detection', desc: 'Auto-detect scene changes' },
            { icon: '🎤', label: 'Speech Analysis', desc: 'Detect speech & silence' },
            { icon: '📊', label: 'Waveform', desc: 'Audio amplitude visualisation' },
          ].map(f => (
            <div key={f.label} className="bg-dark-800 rounded-xl p-3 border border-dark-700">
              <div className="text-2xl mb-1.5">{f.icon}</div>
              <div className="text-white text-xs font-medium">{f.label}</div>
              <div className="text-dark-400 text-xs mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
