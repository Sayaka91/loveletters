import { createClient } from '@supabase/supabase-js'

// service_role key bypasses RLS — only ever used here, server-side, never
// sent to the browser. Keep RLS enabled with no public policies on `topics`.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function toApiTopic(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at).getTime(),
    replyCount: row.replies?.[0]?.count ?? 0
  }
}

// Topics are seeded directly via the Supabase SQL Editor — no create-topic
// endpoint by design, this route only ever reads.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Short edge cache so the app's 5s polling doesn't hit Supabase on
    // every single request.
    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=8')

    // `replies(count)` uses PostgREST's embedded-resource count via the
    // topics <-> replies foreign key, avoiding a separate query per topic.
    const { data, error } = await supabase
      .from('topics')
      .select('id, title, created_at, replies(count)')
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data.map(toApiTopic))
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ error: `Method ${req.method} not allowed` })
}
