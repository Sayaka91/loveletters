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
    // The client only ever shows one calendar day, so it passes that day's
    // [from, to) range instead of downloading every note ever written on
    // each poll. Without a range (e.g. a tab still running the old bundle
    // right after a deploy) it falls back to returning everything.
    const { from, to } = req.query
    let query = supabase
      .from('notes')
      .select('id, author, content, created_at')
      .order('created_at', { ascending: false })
    if (from || to) {
      if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
        return res.status(400).json({ error: 'from and to must be valid dates' })
      }
      query = query.gte('created_at', from).lt('created_at', to)
    }
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    // The app polls this every 5s per open tab, and each uncached poll is a
    // Function invocation billed as Fast Origin Transfer — a short edge
    // cache lets tabs viewing the same day share one response. Set only on
    // success so an error is never what gets cached.
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=25')
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
