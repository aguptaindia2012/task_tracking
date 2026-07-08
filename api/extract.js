// Vercel serverless function: extract tasks from a document + instructions.
// Runs server-side so the Anthropic API key (ANTHROPIC_API_KEY) stays secret.
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

const MODEL = 'claude-opus-4-8'

// Structured-output schema: every field required (empty string = "none"), no
// extra properties — the shape structured outputs need.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          project: { type: 'string' },
          assignee: { type: 'string' },
          due_date: { type: 'string' },
        },
        required: ['title', 'description', 'project', 'assignee', 'due_date'],
      },
    },
  },
  required: ['tasks'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error:
        'The AI feature is not configured. Add an ANTHROPIC_API_KEY environment variable in your Vercel project settings.',
    })
    return
  }

  try {
    const { instructions, pastedText, file } = req.body || {}
    const userInstructions = (instructions || '').trim() || 'Extract every actionable task from this material.'

    const content = []

    if (file && file.dataBase64) {
      const type = (file.type || '').toLowerCase()
      const name = (file.name || '').toLowerCase()
      if (type.includes('pdf') || name.endsWith('.pdf')) {
        // Claude reads PDFs natively.
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: file.dataBase64 },
        })
      } else if (name.endsWith('.docx') || type.includes('word') || type.includes('officedocument')) {
        const buffer = Buffer.from(file.dataBase64, 'base64')
        const { value } = await mammoth.extractRawText({ buffer })
        content.push({ type: 'text', text: `Document "${file.name}":\n\n${value}` })
      } else {
        const text = Buffer.from(file.dataBase64, 'base64').toString('utf8')
        content.push({ type: 'text', text: `Document "${file.name}":\n\n${text}` })
      }
    }

    if (pastedText && pastedText.trim()) {
      content.push({ type: 'text', text: `Additional text:\n\n${pastedText.trim()}` })
    }

    if (content.length === 0) {
      res.status(400).json({ error: 'Provide a document or some text to extract tasks from.' })
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    content.push({
      type: 'text',
      text:
        `Today's date is ${today}.\n\n` +
        `Instructions from the user: ${userInstructions}\n\n` +
        `Extract a list of actionable tasks. For each task provide: a short title; ` +
        `a one-line description (empty string if none); the project name if one is clearly ` +
        `implied (empty string otherwise); the person it should be assigned to if a name is ` +
        `given (empty string otherwise); and a due date as YYYY-MM-DD if a deadline is stated ` +
        `or clearly implied (empty string otherwise). Only include genuine, actionable tasks — ` +
        `do not invent tasks that are not supported by the material.`,
    })

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    })

    let text = ''
    for (const block of message.content) if (block.type === 'text') text += block.text

    let data
    try {
      data = JSON.parse(text)
    } catch {
      res.status(502).json({ error: 'The AI response could not be parsed. Try again or rephrase your instructions.' })
      return
    }

    res.status(200).json({ tasks: Array.isArray(data.tasks) ? data.tasks : [] })
  } catch (err) {
    console.error('extract error', err)
    const msg = err?.error?.error?.message || err?.message || 'Extraction failed.'
    res.status(500).json({ error: msg })
  }
}
