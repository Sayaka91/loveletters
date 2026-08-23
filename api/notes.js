import { Redis } from '@upstash/redis'

const MAX_CONTENT_LENGTH = 1000
const MAX_AUTHOR_LENGTH = 50
const NOTES_KEY = 'loveletter:notes'

// Vercel's Upstash Redis integration may inject either naming convention
// depending on how it was connected, so accept both.
const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
})

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const notes = (await kv.get(NOTES_KEY)) || []
    notes.sort((a, b) => b.createdAt - a.createdAt)
    return res.status(200).json(notes)
  }

  if (req.method === 'POST') {
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

    const notes = (await kv.get(NOTES_KEY)) || []
    notes.push(note)
    await kv.set(NOTES_KEY, notes)
    return res.status(201).json(note)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: `Method ${req.method} not allowed` })
}
