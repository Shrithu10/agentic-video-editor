const BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

export const api = {
  async uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<{
    session_id: string
    filename: string
    video_url: string
    duration: number
    fps: number
    width: number
    height: number
    thumbnail: string | null
    status: string
  }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd = new FormData()
      fd.append('file', file)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          try {
            reject(new Error(JSON.parse(xhr.responseText).detail || xhr.statusText))
          } catch {
            reject(new Error(xhr.statusText))
          }
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))
      xhr.open('POST', `${BASE}/upload`)
      xhr.send(fd)
    })
  },

  async startEdit(sessionId: string, prompt: string, settings = {}) {
    const res = await fetch(`${BASE}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, prompt, settings }),
    })
    return json(res)
  },

  async getSessions() {
    const res = await fetch(`${BASE}/sessions`)
    return json<{ sessions: unknown[] }>(res)
  },

  async getSession(id: string) {
    const res = await fetch(`${BASE}/sessions/${id}`)
    return json(res)
  },

  async getMetrics(id: string) {
    const res = await fetch(`${BASE}/sessions/${id}/metrics`)
    return json(res)
  },

  async manualEdit(sessionId: string, edits: unknown[]) {
    const res = await fetch(`${BASE}/manual-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, edits }),
    })
    return json(res)
  },

  async acceptSuggestion(sessionId: string, decisionId: string, accepted: boolean) {
    const res = await fetch(`${BASE}/accept-suggestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, decision_id: decisionId, accepted }),
    })
    return json(res)
  },

  downloadUrl: (sessionId: string) => `${BASE}/download/${sessionId}`,
}
