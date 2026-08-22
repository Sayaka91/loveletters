import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 5000

function formatTime(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('vi-VN')
}

// Deterministic pseudo-random in [0, 1) so each note keeps the same scatter
// position/rotation across re-renders and polling refreshes.
function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  h ^= h << 13
  h ^= h >>> 17
  h ^= h << 5
  return ((h >>> 0) % 100000) / 100000
}

function NoteScatterCard({ note, index, total }) {
  const left = 4 + seededRandom(note.id + ':left') * 72
  const top = 4 + seededRandom(note.id + ':top') * 72
  const rotate = (seededRandom(note.id + ':rot') * 16 - 8).toFixed(1)
  // Newest note (index 0) is fully opaque and on top; older notes fade and
  // sit further back in the stack.
  const opacity = Math.max(0.3, 1 - index * 0.12)
  const zIndex = total - index

  return (
    <div
      className="scatter-card"
      style={{ left: `${left}%`, top: `${top}%`, transform: `rotate(${rotate}deg)`, opacity, zIndex }}
    >
      <p className="note-content">{note.content}</p>
      <p className="note-meta">
        — {note.author} · {formatTime(note.createdAt)}
      </p>
    </div>
  )
}

function NoteListView({ notes, error, onAddClick }) {
  const [displayMode, setDisplayMode] = useState('scatter')

  return (
    <div className="page page-list">
      <div className="list-header">
        <div>
          <h1>💌 Love Letter</h1>
          <p className="subtitle">Những note mọi người đã viết</p>
        </div>
        <button
          className="all-btn"
          onClick={() => setDisplayMode((mode) => (mode === 'scatter' ? 'list' : 'scatter'))}
        >
          {displayMode === 'scatter' ? 'All' : 'Ngẫu nhiên'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {notes.length === 0 && !error && (
        <p className="empty-state">Chưa có note nào. Hãy là người đầu tiên viết!</p>
      )}

      {displayMode === 'scatter' ? (
        <div className="scatter-board">
          {notes.map((note, index) => (
            <NoteScatterCard key={note.id} note={note} index={index} total={notes.length} />
          ))}
        </div>
      ) : (
        <ul className="note-list note-list-scroll">
          {notes.map((note) => (
            <li key={note.id} className="note-card">
              <p className="note-content">{note.content}</p>
              <p className="note-meta">
                — {note.author} · {formatTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

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
