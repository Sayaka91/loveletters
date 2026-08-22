import { useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

const NOTES_COLLECTION = 'notes'

function formatTime(timestamp) {
  if (!timestamp?.toDate) return ''
  return timestamp.toDate().toLocaleString('vi-VN')
}

export default function App() {
  const [notes, setNotes] = useState([])
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query(collection(db, NOTES_COLLECTION), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
        setError('')
      },
      (err) => setError('Không tải được note: ' + err.message)
    )
    return unsubscribe
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, NOTES_COLLECTION), {
        author: author.trim() || 'Ẩn danh',
        content: content.trim(),
        createdAt: serverTimestamp()
      })
      setContent('')
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
