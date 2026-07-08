// Lightweight parsing of spoken date phrases ("tomorrow", "next friday",
// "july 15", "in 3 days") into YYYY-MM-DD, plus display formatting.

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDatePhrase(phrase: string, from: Date = new Date()): string | null {
  const text = phrase.trim().toLowerCase()
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate())

  if (text === 'today' || text === 'tonight') return toISO(base)
  if (text === 'tomorrow') return toISO(addDays(base, 1))
  if (text === 'day after tomorrow') return toISO(addDays(base, 2))
  if (text === 'next week') return toISO(addDays(base, 7))
  if (text === 'next month') {
    const d = new Date(base)
    d.setMonth(d.getMonth() + 1)
    return toISO(d)
  }

  const inDays = text.match(/^in (\d+) days?$/)
  if (inDays) return toISO(addDays(base, parseInt(inDays[1], 10)))

  const weekday = text.match(/^(next )?([a-z]+)$/)
  if (weekday) {
    const idx = DAYS.indexOf(weekday[2])
    if (idx >= 0) {
      let diff = (idx - base.getDay() + 7) % 7
      if (diff === 0) diff = 7 // "friday" said on a Friday means next Friday
      if (weekday[1]) diff += diff <= 0 ? 7 : 0
      return toISO(addDays(base, diff))
    }
  }

  // "july 15" / "15 july" / "july 15th"
  const md = text.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?$/) ?? text.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)$/)
  if (md) {
    const monthStr = isNaN(Number(md[1])) ? md[1] : md[2]
    const dayStr = isNaN(Number(md[1])) ? md[2] : md[1]
    const monthIdx = MONTHS.findIndex((m) => m.startsWith(monthStr))
    const day = parseInt(dayStr, 10)
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      let d = new Date(base.getFullYear(), monthIdx, day)
      if (d < base) d = new Date(base.getFullYear() + 1, monthIdx, day) // already passed -> next year
      return toISO(d)
    }
  }

  return null
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'done') return false
  return dueDate < toISO(new Date())
}
