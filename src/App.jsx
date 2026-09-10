import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_INTERVAL_MS = 5000
// Picks up every image dropped into src/assets/photo/ automatically — add or
// remove files there and the slideshow adjusts, no code change needed.
const BG_IMAGES = Object.entries(
  import.meta.glob('./assets/photo/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url)
// Same breakpoint as the .scatter-card mobile sizing in index.css, so the
// note count and card size shrink together.
const MOBILE_BREAKPOINT_PX = 600
const MAX_VISIBLE_NOTES_MOBILE = 30
const MAX_VISIBLE_NOTES_DESKTOP = 99

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

// How many notes to scatter on screen at once — fewer on phones, where the
// full 99 makes the board feel cluttered. Re-evaluates on resize/rotate via
// the same 600px breakpoint the scatter-card CSS uses, so both shrink
// together instead of the note count and card size disagreeing.
function useMaxVisibleNotes() {
  const getValue = () =>
    window.innerWidth <= MOBILE_BREAKPOINT_PX ? MAX_VISIBLE_NOTES_MOBILE : MAX_VISIBLE_NOTES_DESKTOP
  const [maxVisible, setMaxVisible] = useState(getValue)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`)
    function handleChange() {
      setMaxVisible(getValue())
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  return maxVisible
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

function HandPetIcon({ size = 20 }) {
  return (
    <span
      style={{
        fontSize: `${size}px`,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none'
      }}
      aria-hidden="true"
    >
      🫳
    </span>
  )
}

function HandPinchIcon({ size = 20 }) {
  return (
    <span
      style={{
        fontSize: `${size}px`,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none'
      }}
      aria-hidden="true"
    >
      🤏
    </span>
  )
}

function InteractionOverlay({ mode }) {
  const active = Boolean(mode)
  const [pos, setPos] = useState({ x: -200, y: -200 })
  const [isHolding, setIsHolding] = useState(false)
  const [isPatting, setIsPatting] = useState(false)
  const [particles, setParticles] = useState([])
  const [showToast, setShowToast] = useState(false)
  const isHoldingRef = useRef(false)
  const lastSpawnRef = useRef({ x: 0, y: 0, time: 0 })
  const pattingTimeoutRef = useRef(null)

  // Toggle body cursor: none class
  useEffect(() => {
    if (active) {
      document.body.classList.add('petting-mode-active')
    } else {
      document.body.classList.remove('petting-mode-active')
    }
    return () => {
      document.body.classList.remove('petting-mode-active')
    }
  }, [active])

  useEffect(() => {
    if (!active) {
      setParticles([])
      setShowToast(false)
      setIsHolding(false)
      setIsPatting(false)
      isHoldingRef.current = false
      setPos({ x: -200, y: -200 })
      return
    }

    setShowToast(true)
    const toastTimer = setTimeout(() => setShowToast(false), 3000)

    function spawnParticles(x, y, burstCount = null) {
      const isPinch = mode === 'pinch'
      const newBatch = []

      if (isPinch) {
        // Pinch mode: spawn "đủ ời, đau nha=))"
        const count = burstCount || 1
        for (let i = 0; i < count; i++) {
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
          const angle = Math.random() * Math.PI * 2
          const distance = 30 + Math.random() * 50
          const vx = Math.cos(angle) * distance
          const vy = -35 - Math.random() * 55
          const rotStart = (Math.random() * 20 - 10).toFixed(1)
          const rotDelta = (Math.random() * 30 - 15).toFixed(1)

          newBatch.push({
            id,
            x: x + (Math.random() * 16 - 8),
            y: y + (Math.random() * 16 - 8),
            vx,
            vy,
            rotStart,
            rotDelta,
            type: 'text',
            text: 'đủ ời, đau nha=))'
          })
        }
      } else {
        // Pet mode: 🌸 🥑 🩵 ✨
        const emojis = ['🌸', '🥑', '🩵', '✨', '🌸', '🥑', '🩵', '✨']
        const count = burstCount || (Math.random() < 0.65 ? 2 : 1)

        for (let i = 0; i < count; i++) {
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
          const angle = Math.random() * Math.PI * 2
          const distance = 40 + Math.random() * 65
          const vx = Math.cos(angle) * distance
          const vy = -35 - Math.random() * 65 // Bias upwards
          const rotStart = (Math.random() * 40 - 20).toFixed(1)
          const rotDelta = (Math.random() * 120 - 60).toFixed(1)
          const emoji = emojis[Math.floor(Math.random() * emojis.length)]
          const size = (1.3 + Math.random() * 0.7).toFixed(2)

          newBatch.push({
            id,
            x: x + (Math.random() * 20 - 10),
            y: y + (Math.random() * 20 - 10),
            vx,
            vy,
            rotStart,
            rotDelta,
            type: 'emoji',
            emoji,
            size
          })
        }
      }

      setParticles((prev) => [...prev.slice(-30), ...newBatch])
    }

    function handlePointerDown(e) {
      if (e.button && e.button !== 0) return

      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return

      isHoldingRef.current = true
      setIsHolding(true)
      setIsPatting(true)
      setPos({ x: clientX, y: clientY })
      lastSpawnRef.current = { x: clientX, y: clientY, time: performance.now() }
      spawnParticles(clientX, clientY, mode === 'pinch' ? 1 : 3)
    }

    function handlePointerMove(e) {
      const isTouch = !!e.touches && e.touches.length > 0
      const isMouseDown = (e.buttons & 1) === 1
      const isPressed = isMouseDown || isTouch

      const clientX = isTouch ? e.touches[0].clientX : e.clientX
      const clientY = isTouch ? e.touches[0].clientY : e.clientY
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return

      setPos({ x: clientX, y: clientY })

      if (!isPressed) {
        if (isHoldingRef.current) {
          isHoldingRef.current = false
          setIsHolding(false)
          setIsPatting(false)
        }
        return
      }

      isHoldingRef.current = true
      setIsHolding(true)
      setIsPatting(true)

      if (pattingTimeoutRef.current) clearTimeout(pattingTimeoutRef.current)
      pattingTimeoutRef.current = setTimeout(() => setIsPatting(false), 220)

      const now = performance.now()
      const dx = clientX - lastSpawnRef.current.x
      const dy = clientY - lastSpawnRef.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      const minDistance = mode === 'pinch' ? 35 : 22
      const minInterval = mode === 'pinch' ? 220 : 90

      if (dist > minDistance || (now - lastSpawnRef.current.time > minInterval && dist > 10)) {
        lastSpawnRef.current = { x: clientX, y: clientY, time: now }
        spawnParticles(clientX, clientY)
      }
    }

    function handlePointerUp() {
      isHoldingRef.current = false
      setIsHolding(false)
      setIsPatting(false)
    }

    window.addEventListener('mousedown', handlePointerDown, { passive: true })
    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('mouseup', handlePointerUp, { passive: true })
    window.addEventListener('mouseleave', handlePointerUp, { passive: true })
    window.addEventListener('blur', handlePointerUp, { passive: true })

    window.addEventListener('touchstart', handlePointerDown, { passive: true })
    window.addEventListener('touchmove', handlePointerMove, { passive: true })
    window.addEventListener('touchend', handlePointerUp, { passive: true })
    window.addEventListener('touchcancel', handlePointerUp, { passive: true })

    return () => {
      clearTimeout(toastTimer)
      if (pattingTimeoutRef.current) clearTimeout(pattingTimeoutRef.current)
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('mouseleave', handlePointerUp)
      window.removeEventListener('blur', handlePointerUp)
      window.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('touchmove', handlePointerMove)
      window.removeEventListener('touchend', handlePointerUp)
      window.removeEventListener('touchcancel', handlePointerUp)
    }
  }, [active, mode])

  // Cleanup old particles from DOM
  useEffect(() => {
    if (particles.length === 0) return
    const timer = setTimeout(() => {
      setParticles((prev) => prev.slice(5))
    }, 900)
    return () => clearTimeout(timer)
  }, [particles])

  if (!active) return null

  const isPinch = mode === 'pinch'
  const handEmoji = isPinch ? '🤏' : '🫳'
  const followerAnimClass = isPatting ? (isPinch ? ' is-pinching' : ' is-patting') : ''

  return (
    <div className="petting-overlay" aria-hidden="true">
      {showToast && (
        <div className="petting-toast">
          {isPinch
            ? '🤏 Chế độ véo má: Nhấn giữ chuột và chà lên ảnh idol nhé! =))'
            : '🫳 Nhấn giữ chuột và chà lên ảnh để xoa đầu idol nhé! 🌸🥑🩵✨'}
        </div>
      )}

      {pos.x >= 0 && (
        <div
          className={'petting-follower' + followerAnimClass}
          style={{ left: `${pos.x}px`, top: `${pos.y - 12}px` }}
        >
          {handEmoji}
        </div>
      )}

      {particles.map((p) =>
        p.type === 'text' ? (
          <div
            key={p.id}
            className="pinch-text-particle"
            style={{
              left: `${p.x}px`,
              top: `${p.y}px`,
              '--vx': `${p.vx}px`,
              '--vy': `${p.vy}px`,
              '--rot-start': `${p.rotStart}deg`,
              '--rot-delta': `${p.rotDelta}deg`
            }}
          >
            {p.text}
          </div>
        ) : (
          <div
            key={p.id}
            className="petting-particle"
            style={{
              left: `${p.x}px`,
              top: `${p.y}px`,
              fontSize: `${p.size}rem`,
              '--vx': `${p.vx}px`,
              '--vy': `${p.vy}px`,
              '--rot-start': `${p.rotStart}deg`,
              '--rot-delta': `${p.rotDelta}deg`
            }}
          >
            {p.emoji}
          </div>
        )
      )}
    </div>
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

// Halton low-discrepancy sequence: the n-th point in base `base`, used to
// spread notes evenly across the board. Unlike per-note independent random
// coordinates (which can clump together purely by chance, especially with
// only a handful of notes), every prefix of a Halton sequence — the first
// note, the first two, the first three, and so on — stays well spread out
// on its own, regardless of how many notes end up on screen.
function halton(index, base) {
  let result = 0
  let f = 1 / base
  let i = index
  while (i > 0) {
    result += f * (i % base)
    i = Math.floor(i / base)
    f /= base
  }
  return result
}
const SCATTER_JITTER = 0.06

function clamp01(n) {
  return Math.min(1, Math.max(0, n))
}

function NoteScatterCard({ note, index, total, onClick, leaving, rank }) {
  // Halton point for this note's rank, nudged by a small note-id-seeded
  // jitter so cards don't look like they're sitting on a rigid sequence.
  // `rank` is the note's stable position among *all* of today's notes,
  // oldest-first (see NoteListView) — not `index` (its position among
  // just the currently-visible ones) — so a note's spot on the board
  // doesn't shift when an earlier note is hidden, or jump for every note
  // when a new one arrives (oldest-first means a new note is appended
  // after every existing rank instead of shifting them all up by one).
  const rLeft = clamp01(halton(rank + 1, 2) + (seededRandom(note.id + ':left') - 0.5) * SCATTER_JITTER)
  const rTop = clamp01(halton(rank + 1, 3) + (seededRandom(note.id + ':top') - 0.5) * SCATTER_JITTER)
  const rotate = (seededRandom(note.id + ':rot') * 16 - 8).toFixed(1)
  // Newest note (index 0) is fully opaque and on top; older notes fade and
  // sit further back in the stack.
  const opacity = Math.max(0.3, 1 - index * 0.12)
  const zIndex = total - index

  // rLeft/rTop place the CARD'S CENTER anywhere from 0% to 100% of the
  // container — including right up to the true edge — instead of keeping
  // the whole card inside a safety-margined box. A card whose center lands
  // near an edge simply hangs off it; .notes-stage clips the overflow
  // (`overflow: hidden`), so only the part still over the photo is shown.
  const left = `calc(${(rLeft * 100).toFixed(2)}% - var(--card-w) / 2)`
  const top = `calc(${(rTop * 100).toFixed(2)}% - var(--card-h) / 2)`

  return (
    <div
      className={'scatter-card' + (leaving ? ' scatter-card-leaving' : '')}
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

function TopicListView({ topics, error, onTopicClick, onBack, loaded }) {
  return (
    <div className="page">
      <button className="back-link" onClick={onBack} aria-label="Quay lại">
        ←
      </button>
      <h1>Góc tâm sự</h1>

      {error && <p className="error">{error}</p>}

      {!loaded && !error && <p className="empty-state">Đang tải...</p>}
      {loaded && topics.length === 0 && !error && <p className="empty-state">Chưa có chủ đề nào.</p>}

      <ul className="topic-list">
        {topics.map((topic) => (
          <li key={topic.id} className="topic-card" onClick={() => onTopicClick(topic)}>
            <p className="topic-title">{topic.title}</p>
            <div className="topic-meta-row">
              <span className="topic-reply-count">{topic.replyCount} tình iu gửi đến bạn học Nguyễn Mạnh Cường</span>
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

function TopicDetailView({
  topic,
  replies,
  page,
  totalPages,
  error,
  onBack,
  onAddClick,
  onPageChange,
  loaded
}) {
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

      {!loaded && !error && <p className="empty-state">Đang tải...</p>}
      {loaded && replies.length === 0 && !error && <p className="empty-state">Chưa có câu trả lời nào.</p>}

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
function ConfessionPage({ onBack, pushScreen }) {
  const [view, setView] = useState('list')
  const [topics, setTopics] = useState([])
  const [topicsLoaded, setTopicsLoaded] = useState(false)
  const [error, setError] = useState('')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [replies, setReplies] = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
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
    } finally {
      setTopicsLoaded(true)
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
    } finally {
      setRepliesLoaded(true)
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
    pushScreen(() => setView('list'))
    setSelectedTopic(topic)
    setRepliesPage(1)
    setRepliesLoaded(false)
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
        loaded={repliesLoaded}
        onBack={() => window.history.back()}
        onAddClick={() => {
          pushScreen(() => setView('detail'))
          setView('create-reply')
        }}
        onPageChange={setRepliesPage}
      />
    )
  }

  if (view === 'create-reply' && selectedTopic) {
    return (
      <ReplyCreateView
        topic={selectedTopic}
        onCancel={() => window.history.back()}
        onCreated={async () => {
          // A new reply always lands on the last page (replies are ordered
          // oldest-first) — request a page far beyond what's known and let
          // the API clamp it down to the real last page.
          await loadReplies(selectedTopic.id, Number.MAX_SAFE_INTEGER)
          window.history.back()
        }}
      />
    )
  }

  return (
    <TopicListView
      topics={topics}
      error={error}
      onTopicClick={openTopic}
      onBack={onBack}
      loaded={topicsLoaded}
    />
  )
}

function NoteListView({ notes, error, onAddClick, loaded, readNoteIds, onNoteRead }) {
  const [displayMode, setDisplayMode] = useState('scatter')
  const [expandedNote, setExpandedNote] = useState(null)
  const [overlayClosing, setOverlayClosing] = useState(false)
  const [leavingId, setLeavingId] = useState(null)
  const [bgIndex, setBgIndex] = useState(0)
  const [notesHidden, setNotesHidden] = useState(false)
  const [interactionMode, setInteractionMode] = useState(null)
  const todayKey = formatDateKey(Date.now())
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const maxVisibleNotes = useMaxVisibleNotes()
  const todaysNotes = notes.filter((note) => formatDateKey(note.createdAt) === selectedDate)
  const dateNoteCount = todaysNotes.length
  const visibleNotes = todaysNotes.filter((note) => !readNoteIds.has(note.id)).slice(0, maxVisibleNotes)

  // Each note's scatter position is keyed off its rank here, oldest-first
  // among *all* of today's notes (not just the currently-visible ones) —
  // so hiding a note doesn't reshuffle where the others sit, and a brand
  // new note (always the newest) only ever gets appended a rank, instead
  // of bumping every existing note's rank/position up by one the way
  // sorting newest-first would.
  const rankById = new Map(
    [...todaysNotes].sort((a, b) => a.createdAt - b.createdAt).map((note, i) => [note.id, i])
  )

  // Plays the overlay's fade-out and the scatter card's shrink-out at the
  // same time, then hides the note for the rest of this browser session
  // (readNoteIds, reset on reload) only once the card's animation has
  // actually finished — instead of both vanishing instantly.
  function closeExpandedNote() {
    const note = expandedNote
    if (!note) return
    setOverlayClosing(true)
    setLeavingId(note.id)
    setTimeout(() => {
      setExpandedNote(null)
      setOverlayClosing(false)
    }, 200)
    setTimeout(() => {
      onNoteRead(note.id)
      setLeavingId((id) => (id === note.id ? null : id))
    }, 320)
  }

  function handleAdvanceBg() {
    setBgIndex((i) => (i + 1) % BG_IMAGES.length)
  }

  return (
    <div className="page page-list">
      <InteractionOverlay mode={interactionMode} />
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
            className={'all-btn' + (interactionMode === 'pet' ? ' all-btn-active' : '')}
            onClick={() => setInteractionMode((m) => (m === 'pet' ? null : 'pet'))}
            aria-label={interactionMode === 'pet' ? 'Tắt chế độ xoa đầu' : 'Bật chế độ xoa đầu 🫳'}
            title={interactionMode === 'pet' ? 'Tắt chế độ xoa đầu' : 'Bật chế độ xoa đầu 🫳'}
          >
            <HandPetIcon size={20} />
          </button>
          <button
            className={'all-btn' + (interactionMode === 'pinch' ? ' all-btn-active-pinch' : '')}
            onClick={() => setInteractionMode((m) => (m === 'pinch' ? null : 'pinch'))}
            aria-label={interactionMode === 'pinch' ? 'Tắt chế độ véo má' : 'Bật chế độ véo má 🤏'}
            title={interactionMode === 'pinch' ? 'Tắt chế độ véo má' : 'Bật chế độ véo má 🤏'}
          >
            <HandPinchIcon size={20} />
          </button>
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
                leaving={note.id === leavingId}
                rank={rankById.get(note.id)}
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

      <p className="love-count-text">
        Hôm nay có <span className="love-count-number">{dateNoteCount}</span> tình iu gửi đến bạn học Nguyễn Mạnh Cường
      </p>

      {!loaded && !error && <p className="empty-state">Đang tải...</p>}

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

const DEFAULT_QUIZ = {
  title: '🔒 Em là ai?',
  subtitle: 'Trả lời đúng các câu hỏi để vào trang nhé!',
  timeLimit: 30,
  questions: [
    {
      id: 'q1',
      type: 'choice',
      question: 'Ngày 14 Casper chính thức debut theo đuổi sự nghiệp âm nhạc?',
      options: [
        { label: 'A', text: '19/8/2019', value: '19/8/2019' },
        { label: 'B', text: '18/9/2018', value: '18/9/2018' },
        { label: 'C', text: '19/8/2018', value: '19/8/2018' },
        { label: 'D', text: '18/9/2019', value: '18/9/2019' }
      ]
    },
    {
      id: 'q2',
      type: 'text',
      question: 'MV solo cá nhân mới ra mắt của 14 Casper gần đây nhất?',
      hint: '(viết hoa đầu các chữ)',
      placeholder: 'Nhập tên MV...'
    },
    {
      id: 'q3',
      type: 'choice',
      question: 'MV nào của 14 Casper chạm mốc 100tr views đầu tiên?',
      options: [
        { label: 'A', text: 'Một Đời', value: 'Một Đời' },
        { label: 'B', text: 'Bao Tiền Một Mớ Bình Yên', value: 'Bao Tiền Một Mớ Bình Yên' },
        { label: 'C', text: 'Người Tốt Nhất Cho Em', value: 'Người Tốt Nhất Cho Em' },
        { label: 'D', text: 'Có Ai Ở Đây Không', value: 'Có Ai Ở Đây Không' }
      ]
    }
  ]
}

function QuizGate({ onPass }) {
  const [quiz, setQuiz] = useState(DEFAULT_QUIZ)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(30)
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch quiz questions from data file via backend
  useEffect(() => {
    fetch('/api/quiz')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.questions) && data.questions.length > 0) {
          setQuiz(data)
          if (data.timeLimit && typeof data.timeLimit === 'number') {
            setTimeLeft(data.timeLimit)
          }
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_QUIZ
      })
  }, [])

  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [timeLeft])

  // Block copy, right-click, screenshots, and dev-tools while quiz is active
  useEffect(() => {
    function blockCopy(e) { e.preventDefault() }
    function blockContext(e) { e.preventDefault() }
    function blockKeys(e) {
      const k = e.key.toLowerCase()
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && ['c', 'a', 'p', 'u', 's'].includes(k)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||
        e.key === 'F12'
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    function blockDrag(e) { e.preventDefault() }

    document.addEventListener('copy', blockCopy, true)
    document.addEventListener('cut', blockCopy, true)
    document.addEventListener('contextmenu', blockContext, true)
    document.addEventListener('keydown', blockKeys, true)
    document.addEventListener('dragstart', blockDrag, true)
    document.addEventListener('selectstart', blockCopy, true)

    return () => {
      document.removeEventListener('copy', blockCopy, true)
      document.removeEventListener('cut', blockCopy, true)
      document.removeEventListener('contextmenu', blockContext, true)
      document.removeEventListener('keydown', blockKeys, true)
      document.removeEventListener('dragstart', blockDrag, true)
      document.removeEventListener('selectstart', blockCopy, true)
    }
  }, [])

  function handleRetry() {
    setAnswers({})
    setTimeLeft(quiz.timeLimit || 30)
    setError('')
    setShaking(false)
  }

  function handleAnswerChange(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (timeLeft <= 0 || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/quiz/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      })
      const data = await res.json()

      if (data.valid) {
        sessionStorage.setItem('quizPassed', '1')
        onPass()
      } else {
        setError(data.error || 'Sai rồi! Bạn có thật sự là fan của 14 Casper không? 🤔')
        setShaking(true)
        setTimeout(() => setShaking(false), 500)
      }
    } catch {
      setError('Lỗi kết nối máy chủ. Vui lòng thử lại!')
    } finally {
      setSubmitting(false)
    }
  }

  const expired = timeLeft <= 0
  const maxTime = quiz.timeLimit || 30
  const questions = quiz.questions || []
  const isAllAnswered = questions.length > 0 && questions.every((q) => {
    const val = answers[q.id]
    return typeof val === 'string' && val.trim().length > 0
  })

  return (
    <div className="quiz-gate">
      <div className={'quiz-card' + (shaking ? ' quiz-shake' : '')}>
        <h1 className="quiz-title">{quiz.title || '🔒 Em là ai?'}</h1>
        <p className="quiz-subtitle">{quiz.subtitle || 'Trả lời đúng các câu hỏi để vào trang nhé!'}</p>

        <div className="quiz-timer-bar">
          <div
            className={'quiz-timer-fill' + (timeLeft <= 10 ? ' quiz-timer-danger' : '')}
            style={{ width: `${Math.max(0, (timeLeft / maxTime) * 100)}%` }}
          />
        </div>
        <p className={'quiz-timer-text' + (timeLeft <= 10 ? ' quiz-timer-danger-text' : '')}>
          ⏱ {timeLeft}s
        </p>

        {expired ? (
          <div className="quiz-expired">
            <p className="quiz-expired-text">⏰ Hết giờ rồi!</p>
            <button type="button" className="quiz-retry-btn" onClick={handleRetry}>
              Thử lại
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {questions.map((q, idx) => (
              <div key={q.id || idx} className="quiz-question">
                <p className="quiz-q-label">Câu {idx + 1}:</p>
                <p className="quiz-q-text">
                  {q.question}
                  {q.hint && <span className="quiz-hint"> {q.hint}</span>}
                </p>

                {q.type === 'choice' && Array.isArray(q.options) && (
                  <div className="quiz-options">
                    {q.options.map((opt) => (
                      <button
                        key={opt.value + opt.label}
                        type="button"
                        className={'quiz-option' + (answers[q.id] === opt.value ? ' quiz-option-selected' : '')}
                        onClick={() => handleAnswerChange(q.id, opt.value)}
                      >
                        <span className="quiz-option-label">{opt.label}.</span>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === 'text' && (
                  <input
                    type="text"
                    className="quiz-input"
                    placeholder={q.placeholder || 'Nhập câu trả lời...'}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    maxLength={100}
                  />
                )}
              </div>
            ))}

            {error && <p className="quiz-error">{error}</p>}

            <button
              type="submit"
              className="quiz-submit-btn"
              disabled={!isAllAnswered || submitting}
            >
              {submitting ? 'Đang kiểm tra...' : 'Xác nhận'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [quizPassed, setQuizPassed] = useState(
    () => import.meta.env.DEV || sessionStorage.getItem('quizPassed') === '1'
  )
  const [page, setPage] = useState('notes')
  const [view, setView] = useState('list')
  const [notes, setNotes] = useState([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [error, setError] = useState('')
  // Notes closed after viewing are hidden for the rest of this browser
  // session only — never persisted, so a reload brings them all back.
  const [readNoteIds, setReadNoteIds] = useState(() => new Set())

  function markNoteRead(noteId) {
    setReadNoteIds((ids) => new Set(ids).add(noteId))
  }
  // Screens pushed onto browser history, deepest last. The phone/browser
  // back button fires 'popstate', which pops and runs whichever function
  // is on top — so back always returns to the previous in-app screen
  // instead of exiting the site. Empty stack means we're at the notes
  // home screen, so an unhandled back there falls through and actually
  // exits, which is correct.
  const backStackRef = useRef([])

  function pushScreen(onBack) {
    window.history.pushState({ appNav: true }, '')
    backStackRef.current.push(onBack)
  }

  useEffect(() => {
    function handlePopState() {
      const onBack = backStackRef.current.pop()
      if (onBack) onBack()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setNotes(await res.json())
      setError('')
    } catch (err) {
      setError('Không tải được note: ' + err.message)
    } finally {
      setNotesLoaded(true)
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
    if (nextPage === 'notes') {
      // Going home (brand click, or toggling the active nav item off):
      // unwind any pushed screens (e.g. confession sub-views) and correct
      // the browser history position to match, instead of leaving stale
      // entries that a later physical back-press would misinterpret.
      const depth = backStackRef.current.length
      backStackRef.current = []
      if (depth > 0) window.history.go(-depth)
      setPage('notes')
      setView('list')
      return
    }
    pushScreen(() => {
      setPage('notes')
      setView('list')
    })
    setPage(nextPage)
  }

  if (!quizPassed) {
    return <QuizGate onPass={() => setQuizPassed(true)} />
  }

  return (
    <>
      <AppHeader activePage={page} onNavigate={handleNavigate} />
      {page === 'confession' ? (
        <ConfessionPage onBack={() => window.history.back()} pushScreen={pushScreen} />
      ) : view === 'create' ? (
        <NoteCreateView
          onCancel={() => window.history.back()}
          onCreated={async () => {
            await loadNotes()
            window.history.back()
          }}
        />
      ) : (
        <NoteListView
          notes={notes}
          error={error}
          loaded={notesLoaded}
          readNoteIds={readNoteIds}
          onNoteRead={markNoteRead}
          onAddClick={() => {
            pushScreen(() => setView('list'))
            setView('create')
          }}
        />
      )}
    </>
  )
}
