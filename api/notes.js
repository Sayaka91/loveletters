import { createClient } from '@supabase/supabase-js'

const MAX_CONTENT_LENGTH = 1000
const MAX_AUTHOR_LENGTH = 50

// service_role key bypasses RLS — only ever used here, server-side, never
// sent to the browser. Keep RLS enabled with no public policies on `notes`.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function toApiNote(row) {
  return {
    id: row.id,
    author: row.author,
    content: row.content,
    createdAt: new Date(row.created_at).getTime()
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('notes')
      .select('id, author, content, created_at')
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data.map(toApiNote))
  }

  if (req.method === 'POST') {
    const { author, content } = req.body || {}
    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    if (!trimmedContent) {
      return res.status(400).json({ error: 'content is required' })
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        author: (typeof author === 'string' ? author.trim() : '').slice(0, MAX_AUTHOR_LENGTH) || 'Ẩn danh',
        content: trimmedContent.slice(0, MAX_CONTENT_LENGTH)
      })
      .select('id, author, content, created_at')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(toApiNote(data))
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: `Method ${req.method} not allowed` })
}
