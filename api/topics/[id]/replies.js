import { createClient } from '@supabase/supabase-js'

const MAX_CONTENT_LENGTH = 1000
const REPLIES_PAGE_SIZE = 30

// service_role key bypasses RLS — only ever used here, server-side, never
// sent to the browser. Keep RLS enabled with no public policies on `replies`.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function toApiReply(row) {
  return {
    id: row.id,
    topicId: row.topic_id,
    content: row.content,
    createdAt: new Date(row.created_at).getTime()
  }
}

export default async function handler(req, res) {
  const topicId = req.query.id

  if (req.method === 'GET') {
    // Short edge cache so the app's 5s polling (and multiple tabs/devices
    // polling the same topic) doesn't hit Supabase on every single request.
    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=8')

    // Fetch the requested page's rows and the total count in one round trip
    // (Supabase returns both from a single query via { count: 'exact' })
    // instead of a separate head-only count query before the real one.
    // This only under-shoots when the requested page is out of range (e.g.
    // the "load the last page" trick via a huge page number after posting
    // a reply) — that rare case falls back to a second, corrected query.
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1)
    let from = (requestedPage - 1) * REPLIES_PAGE_SIZE
    let to = from + REPLIES_PAGE_SIZE - 1

    let { data, count, error } = await supabase
      .from('replies')
      .select('id, topic_id, content, created_at', { count: 'exact' })
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .range(from, to)
    if (error) return res.status(500).json({ error: error.message })

    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / REPLIES_PAGE_SIZE))
    const page = Math.min(requestedPage, totalPages)

    if (page !== requestedPage) {
      from = (page - 1) * REPLIES_PAGE_SIZE
      to = from + REPLIES_PAGE_SIZE - 1
      const corrected = await supabase
        .from('replies')
        .select('id, topic_id, content, created_at')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true })
        .range(from, to)
      if (corrected.error) return res.status(500).json({ error: corrected.error.message })
      data = corrected.data
    }

    return res.status(200).json({ replies: data.map(toApiReply), page, totalPages, total })
  }

  if (req.method === 'POST') {
    const { content } = req.body || {}
    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    if (!trimmedContent) {
      return res.status(400).json({ error: 'content is required' })
    }

    const { data, error } = await supabase
      .from('replies')
      .insert({ topic_id: topicId, content: trimmedContent.slice(0, MAX_CONTENT_LENGTH) })
      .select('id, topic_id, content, created_at')
      .single()
    if (error) {
      // Postgres foreign key violation — topicId doesn't exist.
      if (error.code === '23503') return res.status(404).json({ error: 'topic not found' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(201).json(toApiReply(data))
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: `Method ${req.method} not allowed` })
}
