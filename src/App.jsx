import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 5000

function formatTime(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('vi-VN')
}

export default function App() {
  const [notes, setNotes] = useState([])
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setNotes(await res.json())
      setError('')
    } catch (err) {
      setError('Không tải được note: ' + err.message)
    }
  }, [])

  useEffect(() => {
    loadNotes()
    const interval = setInterval(loadNotes, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadNotes])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, content })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'HTTP ' + res.status)
      }
      setContent('')
      await loadNotes()
    } catch (err) {
      setError('Gửi note thất bại: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <h1>💌 Love Letter</h1>
      <p className="subtitle">Viết vài dòng cho mọi người cùng đọc</p>

      <form className="note-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Tên của bạn (không bắt buộc)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={50}
        />
        <textarea
          placeholder="Viết note ở đây..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={4}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Đang gửi...' : 'Gửi note'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <ul className="note-list">
        {notes.map((note) => (
          <li key={note.id} className="note-card">
            <p className="note-content">{note.content}</p>
            <p className="note-meta">
              — {note.author} · {formatTime(note.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
