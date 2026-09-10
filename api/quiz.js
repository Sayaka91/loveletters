import { createClient } from '@supabase/supabase-js'

// service_role key bypasses RLS — only ever used here, server-side, never
// sent to the browser. Keep RLS enabled with no public policies on
// `quiz_config`/`quiz_questions`.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function toApiQuestion(row) {
  return {
    id: row.id,
    type: row.type,
    question: row.question,
    hint: row.hint,
    placeholder: row.placeholder,
    options: row.options
    // correct_answer intentionally left out of the select below — never
    // sent to the client, only used server-side in quiz/verify.js.
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Quiz content changes rarely (unlike notes/topics), so a longer edge
    // cache than those is fine here.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120')

    const [configResult, questionsResult] = await Promise.all([
      supabase.from('quiz_config').select('title, subtitle, time_limit').eq('id', 'default').maybeSingle(),
      supabase
        .from('quiz_questions')
        .select('id, type, question, hint, placeholder, options')
        .order('sort_order', { ascending: true })
    ])
    if (configResult.error) return res.status(500).json({ error: configResult.error.message })
    if (questionsResult.error) return res.status(500).json({ error: questionsResult.error.message })

    return res.status(200).json({
      title: configResult.data?.title || '🔒 Em là ai?',
      subtitle: configResult.data?.subtitle || 'Trả lời đúng các câu hỏi để vào trang nhé!',
      timeLimit: configResult.data?.time_limit || 30,
      questions: (questionsResult.data || []).map(toApiQuestion)
    })
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ error: `Method ${req.method} not allowed` })
}
