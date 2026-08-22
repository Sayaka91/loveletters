import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 5000

function formatTime(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('vi-VN')
}

function NoteListView({ notes, error, onAddClick }) {
  return (
    <div className="page">
      <h1>💌 Love Letter</h1>
      <p className="subtitle">Những note mọi người đã viết</p>

      {error && <p className="error">{error}</p>}

      {notes.length === 0 && !error && (
        <p className="empty-state">Chưa có note nào. Hãy là người đầu tiên viết!</p>
      )}

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

      <button className="fab" onClick={onAddClick} aria-label="Thêm note" title="Thêm note">
        +
      </button>
    </div>
  )
}

function NoteCreateView({ onCancel, onCreated }) {
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setError('')
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
      onCreated()
    } catch (err) {
      setError('Gửi note thất bại: ' + err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <button className="back-link" onClick={onCancel}>
        ← Quay lại
      </button>
      <h1>Viết note mới</h1>

      <form className="note-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Tên của bạn (không bắt buộc)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={50}
          autoFocus
        />
        <textarea
          placeholder="Viết note ở đây..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={6}
          required
        />
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            Hủy
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi note'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('list')
  const [notes, setNotes] = useState([])
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
    if (view !== 'list') return
    const interval = setInterval(loadNotes, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadNotes, view])

  if (view === 'create') {
    return (
      <NoteCreateView
        onCancel={() => setView('list')}
        onCreated={async () => {
          await loadNotes()
          setView('list')
        }}
      />
    )
  }

  return <NoteListView notes={notes} error={error} onAddClick={() => setView('create')} />
}
