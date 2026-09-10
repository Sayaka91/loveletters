import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const NOTES_FILE = path.join(DATA_DIR, 'notes.json')
const TOPICS_FILE = path.join(DATA_DIR, 'topics.json')
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json')
const QUIZ_FILE = path.join(DATA_DIR, 'quiz.json')
const MAX_CONTENT_LENGTH = 1000
const MAX_AUTHOR_LENGTH = 50
const REPLIES_PAGE_SIZE = 30

function ensureDataFile(file) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8')
}

function readJSON(file) {
  ensureDataFile(file)
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const app = express()
app.use(express.json())

app.get('/api/notes', (req, res) => {
  const notes = readJSON(NOTES_FILE).sort((a, b) => b.createdAt - a.createdAt)
  res.json(notes)
})

app.post('/api/notes', (req, res) => {
  const { author, content } = req.body || {}
  const trimmedContent = typeof content === 'string' ? content.trim() : ''
  if (!trimmedContent) {
    return res.status(400).json({ error: 'content is required' })
  }

  const note = {
    id: makeId(),
    author: (typeof author === 'string' ? author.trim() : '').slice(0, MAX_AUTHOR_LENGTH) || 'Ẩn danh',
    content: trimmedContent.slice(0, MAX_CONTENT_LENGTH),
    createdAt: Date.now()
  }

  const notes = readJSON(NOTES_FILE)
  notes.push(note)
  writeJSON(NOTES_FILE, notes)
  res.status(201).json(note)
})

app.get('/api/topics', (req, res) => {
  const replies = readJSON(REPLIES_FILE)
  const topics = readJSON(TOPICS_FILE)
    .map((topic) => ({
      ...topic,
      replyCount: replies.filter((reply) => reply.topicId === topic.id).length
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
  res.json(topics)
})

// Topics are seeded directly into data/topics.json (or via Supabase SQL
// Editor when deployed) — no create-topic endpoint by design.

app.get('/api/topics/:id/replies', (req, res) => {
  const allReplies = readJSON(REPLIES_FILE)
    .filter((reply) => reply.topicId === req.params.id)
    .sort((a, b) => a.createdAt - b.createdAt)

  const total = allReplies.length
  const totalPages = Math.max(1, Math.ceil(total / REPLIES_PAGE_SIZE))
  const page = Math.min(Math.max(1, parseInt(req.query.page, 10) || 1), totalPages)
  const start = (page - 1) * REPLIES_PAGE_SIZE
  const replies = allReplies.slice(start, start + REPLIES_PAGE_SIZE)

  res.json({ replies, page, totalPages, total })
})

app.post('/api/topics/:id/replies', (req, res) => {
  const topics = readJSON(TOPICS_FILE)
  if (!topics.some((topic) => topic.id === req.params.id)) {
    return res.status(404).json({ error: 'topic not found' })
  }

  const { content } = req.body || {}
  const trimmedContent = typeof content === 'string' ? content.trim() : ''
  if (!trimmedContent) {
    return res.status(400).json({ error: 'content is required' })
  }

  const reply = {
    id: makeId(),
    topicId: req.params.id,
    content: trimmedContent.slice(0, MAX_CONTENT_LENGTH),
    createdAt: Date.now()
  }

  const replies = readJSON(REPLIES_FILE)
  replies.push(reply)
  writeJSON(REPLIES_FILE, replies)
  res.status(201).json(reply)
})

app.get('/api/quiz', (req, res) => {
  try {
    const quiz = readJSON(QUIZ_FILE)
    const publicQuestions = (quiz.questions || []).map((q) => {
      const { correctAnswer, ...rest } = q
      return rest
    })
    res.json({
      title: quiz.title || '🔒 Em là ai?',
      subtitle: quiz.subtitle || 'Trả lời đúng các câu hỏi để vào trang nhé!',
      timeLimit: quiz.timeLimit || 30,
      questions: publicQuestions
    })
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải câu hỏi quiz' })
  }
})

app.post('/api/quiz/verify', (req, res) => {
  try {
    const quiz = readJSON(QUIZ_FILE)
    const { answers } = req.body || {}
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ valid: false, error: 'Dữ liệu không hợp lệ' })
    }

    const questions = quiz.questions || []
    let allCorrect = questions.length > 0

    for (const q of questions) {
      const userAns = answers[q.id]
      if (typeof userAns !== 'string') {
        allCorrect = false
        break
      }
      const correct = String(q.correctAnswer || '').trim()
      const provided = userAns.trim()

      if (provided !== correct) {
        allCorrect = false
        break
      }
    }

    if (allCorrect) {
      res.json({ valid: true })
    } else {
      res.json({
        valid: false,
        error: quiz.errorMessage || 'Sai rồi! Bạn có thật sự là fan của 14 Casper không? 🤔'
      })
    }
  } catch (err) {
    res.status(500).json({ valid: false, error: 'Lỗi xác thực câu hỏi' })
  }
})

const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Love Letter server listening on port ${PORT}`))
