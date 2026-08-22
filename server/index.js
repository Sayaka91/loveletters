import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'notes.json')
const MAX_CONTENT_LENGTH = 1000
const MAX_AUTHOR_LENGTH = 50

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8')
}

function readNotes() {
  ensureDataFile()
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
}

function writeNotes(notes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2), 'utf-8')
}

const app = express()
app.use(express.json())

app.get('/api/notes', (req, res) => {
  const notes = readNotes().sort((a, b) => b.createdAt - a.createdAt)
  res.json(notes)
})

app.post('/api/notes', (req, res) => {
  const { author, content } = req.body || {}
  const trimmedContent = typeof content === 'string' ? content.trim() : ''
  if (!trimmedContent) {
    return res.status(400).json({ error: 'content is required' })
  }

  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    author: (typeof author === 'string' ? author.trim() : '').slice(0, MAX_AUTHOR_LENGTH) || 'Ẩn danh',
    content: trimmedContent.slice(0, MAX_CONTENT_LENGTH),
    createdAt: Date.now()
  }

  const notes = readNotes()
  notes.push(note)
  writeNotes(notes)
  res.status(201).json(note)
})

const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Love Letter server listening on port ${PORT}`))
