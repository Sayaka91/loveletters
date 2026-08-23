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
    // Count first so an out-of-range requested page (e.g. "load the last
    // page" via a huge page number after posting a reply) clamps correctly.
    const { count, error: countError } = await supabase
      .from('replies')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', topicId)
    if (countError) return res.status(500).json({ error: countError.message })

    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / REPLIES_PAGE_SIZE))
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1)
    const page = Math.min(requestedPage, totalPages)
    const from = (page - 1) * REPLIES_PAGE_SIZE
    const to = from + REPLIES_PAGE_SIZE - 1

    const { data, error } = await supabase
      .from('replies')
      .select('id, topic_id, content, created_at')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .range(from, to)
    if (error) return res.status(500).json({ error: error.message })
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
