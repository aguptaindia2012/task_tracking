import { parseDatePhrase } from './dates'

export interface ParsedCommand {
  kind: 'task' | 'note'
  title: string
  assigneeName: string | null
  projectName: string | null
  dueDate: string | null
  raw: string
}

const TASK_PREFIX = /^(?:please\s+)?(?:add|create|make|new)?\s*(?:a\s+)?task[,:]?\s+/i
const NOTE_PREFIX = /^(?:please\s+)?(?:add|take|create|make|new)?\s*(?:a\s+)?note[,:]?\s+/i

// Clause markers that can appear anywhere after the title, in any order:
//   "... assign to Ramesh"  "... for project Home Reno"  "... due tomorrow"
const MARKER = /\b(assign(?:ed)?\s+to|(?:for|in|under)\s+project|project|due(?:\s+(?:on|by))?)\s+/gi

export function parseVoiceCommand(transcript: string, now: Date = new Date()): ParsedCommand {
  const raw = transcript.trim()
  let text = raw
  let kind: 'task' | 'note' = 'note' // default to note: while driving, losing a capture is worse than misfiling it

  if (TASK_PREFIX.test(text)) {
    kind = 'task'
    text = text.replace(TASK_PREFIX, '')
  } else if (NOTE_PREFIX.test(text)) {
    text = text.replace(NOTE_PREFIX, '')
  }

  // Split into title + clauses at each marker.
  const segments: { marker: string | null; content: string }[] = []
  let lastIndex = 0
  let lastMarker: string | null = null
  MARKER.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MARKER.exec(text)) !== null) {
    segments.push({ marker: lastMarker, content: text.slice(lastIndex, m.index).trim() })
    lastMarker = m[1].toLowerCase()
    lastIndex = m.index + m[0].length
  }
  segments.push({ marker: lastMarker, content: text.slice(lastIndex).trim() })

  let title = ''
  let assigneeName: string | null = null
  let projectName: string | null = null
  let dueDate: string | null = null

  for (const seg of segments) {
    if (!seg.content) continue
    if (seg.marker === null) {
      title = seg.content
    } else if (seg.marker.startsWith('assign')) {
      assigneeName = seg.content
    } else if (seg.marker.includes('project')) {
      projectName = seg.content
    } else if (seg.marker.startsWith('due')) {
      const parsed = parseDatePhrase(seg.content, now)
      if (parsed) {
        dueDate = parsed
      } else {
        // Unparseable date phrase: keep the words rather than lose them.
        title = `${title} due ${seg.content}`.trim()
      }
    }
  }

  // Trailing punctuation from the recognizer
  title = title.replace(/[.,;]+$/, '').trim()

  if (!title) title = raw // never lose the capture entirely

  return { kind, title, assigneeName, projectName, dueDate, raw }
}
