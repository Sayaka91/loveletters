import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 5000
const BG_SLIDE_INTERVAL_MS = 8000
const BG_IMAGES = ['/photo/bg1.jpg', '/photo/bg2.jpg', '/photo/bg3.jpg', '/photo/bg4.jpg', '/photo/bg5.jpg']
const VISIBLE_WINDOW_MS = 24 * 60 * 60 * 1000

// Elapsed time from note creation to now, e.g. "5m", "1h", "1h30m".
function formatElapsed(createdAtMs) {
  if (!createdAtMs) return ''
  const totalMinutes = Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${minutes}m`
}

// Monochrome shuffle icon — inherits `color` so it stays on-theme (blue/white)
// instead of a multicolor emoji.
function ShuffleIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}

// Soft rounded list icon, same visual language as ShuffleIcon.
function ListIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="17" x2="12" y2="17" />
    </svg>
  )
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
  const rLeft = seededRandom(note.id + ':left')
  const rTop = seededRandom(note.id + ':top')
  const rotate = (seededRandom(note.id + ':rot') * 16 - 8).toFixed(1)
  // Newest note (index 0) is fully opaque and on top; older notes fade and
  // sit further back in the stack.
  const opacity = Math.max(0.3, 1 - index * 0.12)
  const zIndex = total - index

  // calc() keeps the card within [2%, 98%] of the container regardless of
  // viewport size, since --card-w/--card-h (fixed px, overridden per
  // breakpoint in CSS) are subtracted before scaling by the percentage.
  // The rotation (up to ±8deg) enlarges the card's actual on-screen
  // bounding box beyond its own width/height — cos(8deg)+sin(8deg) ≈
  // 1.13 — so a 1.15x safety factor is applied to the reserved size to
  // keep the rotated box from poking past the container edge.
  const left = `calc(2% + ${rLeft.toFixed(4)} * (96% - var(--card-w) * 1.15))`
  const top = `calc(2% + ${rTop.toFixed(4)} * (96% - var(--card-h) * 1.15))`

  return (
    <div className="scatter-card" style={{ left, top, transform: `rotate(${rotate}deg)`, opacity, zIndex }}>
      <p className="note-content">{note.content}</p>
      <p className="note-meta">
        — {note.author} · {formatElapsed(note.createdAt)}
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
          <span className="brand-title">Súp Bơ</span>
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
      <button className="back-link" onClick={onBack} aria-label="Quay lại">
        ←
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
  const visibleNotes = notes.filter((note) => Date.now() - note.createdAt <= VISIBLE_WINDOW_MS)

  return (
    <div className="page page-list">
      <div className="list-header">
        <p className="subtitle">Để lại dấu chân ở đây nhé!</p>
        <button
          className="all-btn"
          onClick={() => setDisplayMode((mode) => (mode === 'scatter' ? 'list' : 'scatter'))}
          aria-label={displayMode === 'scatter' ? 'Xem dạng danh sách' : 'Xem ngẫu nhiên'}
          title={displayMode === 'scatter' ? 'Xem dạng danh sách' : 'Xem ngẫu nhiên'}
        >
          {displayMode === 'scatter' ? <ListIcon /> : <ShuffleIcon />}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {visibleNotes.length === 0 && !error && (
        <p className="empty-state">Chưa có note nào trong 24h qua. Hãy là người đầu tiên viết!</p>
      )}

      <div className="notes-stage">
        <BackgroundSlideshow />
        {displayMode === 'scatter' ? (
          <div className="scatter-board">
            {visibleNotes.map((note, index) => (
              <NoteScatterCard key={note.id} note={note} index={index} total={visibleNotes.length} />
            ))}
          </div>
        ) : (
          <ul className="note-list note-list-scroll">
            {visibleNotes.map((note) => (
              <li key={note.id} className="note-card">
                <p className="note-content">{note.content}</p>
                <p className="note-meta">
                  — {note.author} · {formatElapsed(note.createdAt)}
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
      <button className="back-link" onClick={onCancel} aria-label="Quay lại">
        ←
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
