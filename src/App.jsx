import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_INTERVAL_MS = 5000
// Picks up every image dropped into src/assets/photo/ automatically — add or
// remove files there and the slideshow adjusts, no code change needed.
const BG_IMAGES = Object.entries(
  import.meta.glob('./assets/photo/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url)
const MAX_VISIBLE_NOTES = 45

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

// Local calendar-day key (YYYY-MM-DD) for a timestamp, used to group notes
// by the day they were created on rather than a rolling time window.
function formatDateKey(timestampMs) {
  const d = new Date(timestampMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Clock time for a note's creation, e.g. "09:05", "23:41".
function formatClockTime(createdAtMs) {
  if (!createdAtMs) return ''
  const d = new Date(createdAtMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Elapsed time for topics, phrased as "X trước" (e.g. "5m trước"), collapsing
// to whole days ("2d trước") once a full day has passed so long-lived topics
// don't show large hour counts like "72h54m trước".
function formatTopicElapsed(createdAtMs) {
  if (!createdAtMs) return ''
  const totalMinutes = Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000))
  const days = Math.floor(totalMinutes / 1440)
  if (days >= 1) return `${days}d trước`
  return `${formatElapsed(createdAtMs)} trước`
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

// Open eye — notes are visible, click to hide them.
function EyeIcon({ size = 18 }) {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// Eye with a slash — notes are hidden, click to show them again.
function EyeOffIcon({ size = 18 }) {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="21" x2="21" y2="3" />
    </svg>
  )
}

// Cross-fades to the next image in BG_IMAGES (looping back to the first)
// each time the caller advances `index` — driven by a click on the stage,
// not a timer.
function BackgroundSlideshow({ index }) {
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

function NoteScatterCard({ note, index, total, onClick }) {
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
    <div
      className="scatter-card"
      style={{ left, top, transform: `rotate(${rotate}deg)`, opacity, zIndex }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(note)
      }}
    >
      <p className="note-meta note-meta-compact">{note.author}</p>
    </div>
  )
}

// Full-size readable version of a note, shown over a backdrop after
// clicking a shrunk scatter card.
function NoteExpandOverlay({ note, onClose, closing }) {
  return (
    <div
      className={'note-expand-overlay' + (closing ? ' note-expand-overlay-closing' : '')}
      onClick={onClose}
    >
      <div className="note-expand-card" onClick={(e) => e.stopPropagation()}>
        <p className="note-content">{note.content}</p>
        <p className="note-meta">
          — {note.author} · {formatClockTime(note.createdAt)}
        </p>
      </div>
    </div>
  )
}

// Add more entries here to expose new pages as options next to the brand title.
const NAV_ITEMS = [{ key: 'confession', label: 'Góc tâm sự' }]

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

function TopicListView({ topics, error, onTopicClick, onBack }) {
  return (
    <div className="page">
      <button className="back-link" onClick={onBack} aria-label="Quay lại">
        ←
      </button>
      <h1>Góc tâm sự</h1>

      {error && <p className="error">{error}</p>}

      {topics.length === 0 && !error && <p className="empty-state">Chưa có chủ đề nào.</p>}

      <ul className="topic-list">
        {topics.map((topic) => (
          <li key={topic.id} className="topic-card" onClick={() => onTopicClick(topic)}>
            <p className="topic-title">{topic.title}</p>
            <div className="topic-meta-row">
              <span className="topic-reply-count">{topic.replyCount} trả lời</span>
              <span className="note-meta">{formatTopicElapsed(topic.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Clamps reply text to 2 lines with a "Xem thêm" toggle, only shown when the
// text actually overflows those 2 lines.
function ReplyItem({ reply }) {
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    if (expanded) return
    const el = contentRef.current
    if (el) setIsTruncated(el.scrollHeight > el.clientHeight + 1)
  }, [reply.content, expanded])

  return (
    <li className="note-card">
      <p
        ref={contentRef}
        className={'note-content reply-content' + (expanded ? '' : ' note-content-clamped')}
      >
        {reply.content}
      </p>
      {(isTruncated || expanded) && (
        <button type="button" className="see-more-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Ẩn' : 'Xem thêm'}
        </button>
      )}
      <p className="note-meta">{formatTopicElapsed(reply.createdAt)}</p>
    </li>
  )
}

function TopicDetailView({ topic, replies, page, totalPages, error, onBack, onAddClick, onPageChange }) {
  function goToPage(newPage) {
    onPageChange(newPage)
    // Instant, not smooth: the reply list's height changes as soon as the
    // new page's data arrives, which cuts an in-progress smooth scroll short.
    window.scrollTo(0, 0)
  }

  return (
    <div className="page">
      <button className="back-link" onClick={onBack} aria-label="Quay lại">
        ←
      </button>
      <h1 className="topic-detail-title">{topic.title}</h1>
      <p className="subtitle">Tạo {formatTopicElapsed(topic.createdAt)}</p>

      {error && <p className="error">{error}</p>}

      {replies.length === 0 && !error && <p className="empty-state">Chưa có câu trả lời nào.</p>}

      <ul className="note-list">
        {replies.map((reply) => (
          <ReplyItem key={reply.id} reply={reply} />
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="pagination">
          <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            ← Trước
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
            Sau →
          </button>
        </div>
      )}

      <button className="fab" onClick={onAddClick} aria-label="Trả lời" title="Trả lời">
        +
      </button>
    </div>
  )
}

function ReplyCreateView({ topic, onCancel, onCreated }) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/topics/${topic.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'HTTP ' + res.status)
      }
      onCreated()
    } catch (err) {
      setError('Gửi câu trả lời thất bại: ' + err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <button className="back-link" onClick={onCancel} aria-label="Quay lại">
        ←
      </button>
      <h1>Trả lời</h1>
      <p className="subtitle">{topic.title}</p>
      <form className="note-form" onSubmit={handleSubmit}>
        <textarea
          placeholder="Viết câu trả lời..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={6}
          required
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            Hủy
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi trả lời'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Owns its own list/detail/create navigation so App() only needs to mount it
// for the 'confession' page, same as NoteListView owns scatter/list toggling.
function ConfessionPage({ onBack }) {
  const [view, setView] = useState('list')
  const [topics, setTopics] = useState([])
  const [error, setError] = useState('')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [replies, setReplies] = useState([])
  const [repliesError, setRepliesError] = useState('')
  const [repliesPage, setRepliesPage] = useState(1)
  const [repliesTotalPages, setRepliesTotalPages] = useState(1)

  const loadTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/topics')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setTopics(await res.json())
      setError('')
    } catch (err) {
      setError('Không tải được chủ đề: ' + err.message)
    }
  }, [])

  const loadReplies = useCallback(async (topicId, page) => {
    try {
      const res = await fetch(`/api/topics/${topicId}/replies?page=${page}`)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      setReplies(data.replies)
      setRepliesPage(data.page)
      setRepliesTotalPages(data.totalPages)
      setRepliesError('')
    } catch (err) {
      setRepliesError('Không tải được câu trả lời: ' + err.message)
    }
  }, [])

  useEffect(() => {
    loadTopics()
    if (view !== 'list') return
    const interval = setInterval(loadTopics, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadTopics, view])

  useEffect(() => {
    if (view !== 'detail' || !selectedTopic) return
    loadReplies(selectedTopic.id, repliesPage)
    const interval = setInterval(() => loadReplies(selectedTopic.id, repliesPage), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadReplies, view, selectedTopic, repliesPage])

  function openTopic(topic) {
    setSelectedTopic(topic)
    setRepliesPage(1)
    setView('detail')
  }

  if (view === 'detail' && selectedTopic) {
    return (
      <TopicDetailView
        topic={selectedTopic}
        replies={replies}
        page={repliesPage}
        totalPages={repliesTotalPages}
        error={repliesError}
        onBack={() => setView('list')}
        onAddClick={() => setView('create-reply')}
        onPageChange={setRepliesPage}
      />
    )
  }

  if (view === 'create-reply' && selectedTopic) {
    return (
      <ReplyCreateView
        topic={selectedTopic}
        onCancel={() => setView('detail')}
        onCreated={async () => {
          // A new reply always lands on the last page (replies are ordered
          // oldest-first) — request a page far beyond what's known and let
          // the API clamp it down to the real last page.
          await loadReplies(selectedTopic.id, Number.MAX_SAFE_INTEGER)
          setView('detail')
        }}
      />
    )
  }

  return <TopicListView topics={topics} error={error} onTopicClick={openTopic} onBack={onBack} />
}

function NoteListView({ notes, error, onAddClick }) {
  const [displayMode, setDisplayMode] = useState('scatter')
  const [expandedNote, setExpandedNote] = useState(null)
  const [overlayClosing, setOverlayClosing] = useState(false)
  const [bgIndex, setBgIndex] = useState(0)
  const [notesHidden, setNotesHidden] = useState(false)
  const todayKey = formatDateKey(Date.now())
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const visibleNotes = notes
    .filter((note) => formatDateKey(note.createdAt) === selectedDate)
    .slice(0, MAX_VISIBLE_NOTES)

  // Plays the overlay's fade-out before actually unmounting it, instead of
  // it vanishing instantly.
  function closeExpandedNote() {
    if (!expandedNote) return
    setOverlayClosing(true)
    setTimeout(() => {
      setExpandedNote(null)
      setOverlayClosing(false)
    }, 200)
  }

  function handleAdvanceBg() {
    setBgIndex((i) => (i + 1) % BG_IMAGES.length)
  }

  return (
    <div className="page page-list">
      <div className="list-header">
        <p className="subtitle">Mỗi ngày một lời yêu &lt;3</p>
        <div className="list-header-actions">
          <input
            type="date"
            className="date-picker"
            value={selectedDate}
            max={todayKey}
            onChange={(e) => setSelectedDate(e.target.value || todayKey)}
            aria-label="Chọn ngày xem note"
          />
          <button
            className="all-btn"
            onClick={() => setNotesHidden((hidden) => !hidden)}
            aria-label={notesHidden ? 'Hiện note' : 'Ẩn note'}
            title={notesHidden ? 'Hiện note' : 'Ẩn note'}
          >
            {notesHidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button
            className="all-btn"
            onClick={() => setDisplayMode((mode) => (mode === 'scatter' ? 'list' : 'scatter'))}
            aria-label={displayMode === 'scatter' ? 'Xem dạng danh sách' : 'Xem ngẫu nhiên'}
            title={displayMode === 'scatter' ? 'Xem dạng danh sách' : 'Xem ngẫu nhiên'}
          >
            {displayMode === 'scatter' ? <ListIcon /> : <ShuffleIcon />}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="notes-stage" onClick={handleAdvanceBg}>
        <BackgroundSlideshow index={bgIndex} />
        {notesHidden ? null : displayMode === 'scatter' ? (
          <div className="scatter-board">
            {visibleNotes.map((note, index) => (
              <NoteScatterCard
                key={note.id}
                note={note}
                index={index}
                total={visibleNotes.length}
                onClick={setExpandedNote}
              />
            ))}
          </div>
        ) : (
          <ul className="note-list note-list-scroll">
            {visibleNotes.map((note) => (
              <NoteListItem key={note.id} note={note} />
            ))}
          </ul>
        )}
      </div>

      {visibleNotes.length === 0 && !error && (
        <p className="empty-state">
          {selectedDate === todayKey
            ? 'Chưa có note nào hôm nay. Hãy là người đầu tiên viết!'
            : 'Không có note nào trong ngày này.'}
        </p>
      )}

      {expandedNote && (
        <NoteExpandOverlay note={expandedNote} onClose={closeExpandedNote} closing={overlayClosing} />
      )}

      <button className="fab" onClick={onAddClick} aria-label="Thêm note" title="Thêm note">
        +
      </button>
    </div>
  )
}

// Clamps note text to 2 lines with a "Xem thêm"/"Ẩn" toggle, only shown when
// the text actually overflows those 2 lines. Mirrors ReplyItem's pattern.
function NoteListItem({ note }) {
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    if (expanded) return
    const el = contentRef.current
    if (el) setIsTruncated(el.scrollHeight > el.clientHeight + 1)
  }, [note.content, expanded])

  return (
    <li className="note-card">
      <p
        ref={contentRef}
        className={'note-content note-content-list' + (expanded ? '' : ' note-content-clamped')}
      >
        {note.content}
      </p>
      {(isTruncated || expanded) && (
        <button type="button" className="see-more-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Ẩn' : 'Xem thêm'}
        </button>
      )}
      <p className="note-meta">
        — {note.author} · {formatElapsed(note.createdAt)}
      </p>
    </li>
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

  // Clicking a nav item that's already active toggles back to the notes
  // home screen instead of doing nothing.
  function handleNavigate(key) {
    const nextPage = page === key ? 'notes' : key
    setPage(nextPage)
    if (nextPage === 'notes') setView('list')
  }

  return (
    <>
      <AppHeader activePage={page} onNavigate={handleNavigate} />
      {page === 'confession' ? (
        <ConfessionPage onBack={() => handleNavigate('notes')} />
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
