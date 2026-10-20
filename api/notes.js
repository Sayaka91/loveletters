import { createClient } from '@supabase/supabase-js'

const MAX_CONTENT_LENGTH = 1000
const MAX_AUTHOR_LENGTH = 50
// Longest [from, to) a GET may ask for — a local calendar day is 23–25h, so
// 48h always fits one, while nobody can pull the whole table in one request.
const MAX_RANGE_MS = 48 * 60 * 60 * 1000

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
    // [from, to) range instead of downloading every note ever written. Its
    // 5s polls also pass `since` (the newest note it already has), so most
    // polls return nothing instead of the whole day again. Without a range
    // (a tab still running an older bundle, which only needs today) it gets
    // the last MAX_RANGE_MS.
    const { from, to, since } = req.query
    let query = supabase
      .from('notes')
      .select('id, author, content, created_at')
      .order('created_at', { ascending: false })
    if (from || to) {
      const fromMs = Date.parse(from)
      const toMs = Date.parse(to)
      if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs || toMs - fromMs > MAX_RANGE_MS) {
        return res.status(400).json({ error: 'from and to must be valid dates at most 48h apart' })
      }
      query = query.gte('created_at', from).lt('created_at', to)
    } else {
      query = query.gte('created_at', new Date(Date.now() - MAX_RANGE_MS).toISOString())
    }
    if (since !== undefined) {
      if (Number.isNaN(Date.parse(since))) {
        return res.status(400).json({ error: 'since must be a valid date' })
      }
      // gte, not gt: API timestamps are whole milliseconds while created_at
      // keeps microseconds, so the client's newest note comes back again
      // (it dedupes by id) — gt could skip a note posted in that same ms.
      query = query.gte('created_at', since)
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
