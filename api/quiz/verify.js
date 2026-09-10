import { createClient } from '@supabase/supabase-js'

// service_role key bypasses RLS — only ever used here, server-side, never
// sent to the browser. Keep RLS enabled with no public policies on
// `quiz_config`/`quiz_questions`.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { answers } = req.body || {}
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ valid: false, error: 'Dữ liệu không hợp lệ' })
    }

    const [configResult, questionsResult] = await Promise.all([
      supabase.from('quiz_config').select('error_message').eq('id', 'default').maybeSingle(),
      supabase.from('quiz_questions').select('id, correct_answer')
    ])
    if (configResult.error) return res.status(500).json({ valid: false, error: configResult.error.message })
    if (questionsResult.error) return res.status(500).json({ valid: false, error: questionsResult.error.message })

    const questions = questionsResult.data || []
    let allCorrect = questions.length > 0

    for (const q of questions) {
      const userAnswer = answers[q.id]
      if (typeof userAnswer !== 'string') {
        allCorrect = false
        break
      }
      const correct = String(q.correct_answer || '').trim()
      const provided = userAnswer.trim()
      if (provided !== correct) {
        allCorrect = false
        break
      }
    }

    if (allCorrect) return res.status(200).json({ valid: true })
    return res.status(200).json({
      valid: false,
      error: configResult.data?.error_message || 'Sai rồi! Bạn có thật sự là fan không? 🤔'
    })
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: `Method ${req.method} not allowed` })
}
