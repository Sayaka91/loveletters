import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 5000
const BG_SLIDE_INTERVAL_MS = 5000
const BG_IMAGES = ['/photo/bg1.jpg', '/photo/bg2.jpg', '/photo/bg3.jpg', '/photo/bg4.jpg', '/photo/bg5.jpg']

function formatTime(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('vi-VN')
}

// Cross-fades through BG_IMAGES in order, looping back to the first.
function BackgroundSlideshow() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % BG_IMAGES.length)
    }, BG_SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="bg-slideshow" aria-hidden="true">
      {BG_IMAGES.map((src, i) => (
        <div
          key={src}
          className="bg-slide"
          style={{ backgroundImage: `url(${src})`, opacity: i === index ? 1 : 0 }}
        />
      ))}
    </div>
  )
}

function AvocadoIcon({ size = 34 }) {
  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 100 112"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M42 10 C40 5 44 1 48 3 C52 5 51 12 48 16 L44 18 Z" fill="#8a6b3f" />
      <path d="M46 8 C38 1 28 6 30 13 C32 19 40 17 45 12 Z" fill="#7fb069" />
      <path
        d="M50 12
           C25 12 12 40 12 64
           C12 92 28 108 50 108
           C72 108 88 92 88 64
           C88 40 75 12 50 12 Z"
        fill="#eef7df"
        stroke="#9cc26b"
        strokeWidth="4"
      />
      <ellipse cx="50" cy="74" rx="23" ry="27" fill="#8a4b32" />
      <ellipse cx="42" cy="64" rx="8" ry="6" fill="#a5613f" opacity="0.6" />
      <circle cx="39" cy="50" r="2.6" fill="#3a2e39" />
      <circle cx="61" cy="50" r="2.6" fill="#3a2e39" />
      <ellipse cx="30" cy="57" rx="5" ry="3.2" fill="#f5a8a8" opacity="0.75" />
      <ellipse cx="70" cy="57" rx="5" ry="3.2" fill="#f5a8a8" opacity="0.75" />
      <path d="M41 58 Q50 65 59 58" stroke="#3a2e39" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  )
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

// Add more entries here to expose new pages as options next to the brand title.
const NAV_ITEMS = [{ key: 'about', label: 'Giới thiệu' }]

function AppHeader({ activePage, onNavigate }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <button type="button" className="brand-button" onClick={() => onNavigate('notes')}>
          <span className="brand-title">
            <AvocadoIcon size={38} /> Súp Bơ
          </span>
        </button>
        <nav className="nav-options">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={'nav-item' + (item.key === activePage ? ' nav-item-active' : '')}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

function AboutView({ onBack }) {
  return (
    <div className="page">
      <button className="back-link" onClick={onBack}>
        ← Quay lại
      </button>
      <h1>Giới thiệu</h1>
      <div className="about-card">
        <p>
          <strong>Tên:</strong> (sẽ bổ sung)
        </p>
        <p>
          <strong>Thông tin liên hệ:</strong> (sẽ bổ sung)
        </p>
      </div>
    </div>
  )
}

function NoteListView({ notes, error, onAddClick }) {
  const [displayMode, setDisplayMode] = useState('scatter')

  return (
    <div className="page page-list">
      <div className="list-header">
        <p className="subtitle">Những note mọi người đã viết</p>
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

      <div className="notes-stage">
        <BackgroundSlideshow />
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
      </div>

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
  const [page, setPage] = useState('notes')
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
    if (page !== 'notes' || view !== 'list') return
    const interval = setInterval(loadNotes, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadNotes, page, view])

  function handleNavigate(key) {
    setPage(key)
    if (key === 'notes') setView('list')
  }

  return (
    <>
      <AppHeader activePage={page} onNavigate={handleNavigate} />
      {page === 'about' ? (
        <AboutView onBack={() => handleNavigate('notes')} />
      ) : view === 'create' ? (
        <NoteCreateView
          onCancel={() => setView('list')}
          onCreated={async () => {
            await loadNotes()
            setView('list')
          }}
        />
      ) : (
        <NoteListView notes={notes} error={error} onAddClick={() => setView('create')} />
      )}
    </>
  )
}
