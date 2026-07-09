import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../hooks/useStore'
import { formatDate } from '../lib/dates'
import type { Project, Task } from '../types'

// Rolling window: a few days back through the next ~10 weeks.
const DAYS_BACK = 3
const DAYS_FORWARD = 70

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Bar {
  label: string
  startIso: string
  endIso: string
  color: string
  faded: boolean
  isProject: boolean
  onClick?: () => void
}

export default function Timeline() {
  const { tasks, projects } = useStore()
  const navigate = useNavigate()

  const days = useMemo(() => {
    const list: { iso: string; label: string; isToday: boolean }[] = []
    const start = new Date()
    start.setDate(start.getDate() - DAYS_BACK)
    const todayIso = toISO(new Date())
    for (let i = 0; i < DAYS_BACK + DAYS_FORWARD; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const iso = toISO(d)
      list.push({
        iso,
        label: d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : String(d.getDate()),
        isToday: iso === todayIso,
      })
    }
    return list
  }, [])

  const first = days[0].iso
  const last = days[days.length - 1].iso
  const dayIndex = (iso: string) => days.findIndex((d) => d.iso === iso)

  // Build the ordered list of rows: each active project (with dates), then its
  // dated tasks indented beneath it, then a group for project-less tasks.
  const rows = useMemo(() => {
    const activeProjects = projects.filter((p) => !p.archived_at)
    const out: Bar[] = []

    const projectTasks = (pid: string | null) =>
      tasks
        .filter((t) => !t.archived_at && t.project_id === pid && (t.due_date || t.start_date))
        .sort((a, b) => (a.start_date ?? a.due_date ?? '').localeCompare(b.start_date ?? b.due_date ?? ''))

    const taskBar = (t: Task, color: string): Bar => ({
      label: t.title,
      startIso: t.start_date ?? t.due_date!,
      endIso: t.due_date ?? t.start_date!,
      color,
      faded: t.status === 'done',
      isProject: false,
      onClick: () => navigate(`/task/${t.id}`),
    })

    for (const p of activeProjects) {
      const pt = projectTasks(p.id)
      // Project bar spans its own dates, or the envelope of its tasks.
      const taskStarts = pt.map((t) => t.start_date ?? t.due_date!).filter(Boolean)
      const taskEnds = pt.map((t) => t.due_date ?? t.start_date!).filter(Boolean)
      const startIso = p.start_date ?? (taskStarts.length ? taskStarts.reduce((a, b) => (a < b ? a : b)) : null)
      const endIso = p.end_date ?? (taskEnds.length ? taskEnds.reduce((a, b) => (a > b ? a : b)) : null)
      if (startIso && endIso) {
        out.push({ label: p.name, startIso, endIso, color: p.color, faded: false, isProject: true })
      } else if (pt.length) {
        // Project has no dates itself but has dated tasks — show a label row.
        out.push({ label: p.name, startIso: '', endIso: '', color: p.color, faded: false, isProject: true })
      }
      for (const t of pt) out.push(taskBar(t, p.color))
    }

    // Tasks with no project but with dates.
    const loose = projectTasks(null)
    if (loose.length) {
      out.push({ label: 'No project', startIso: '', endIso: '', color: 'var(--muted)', faded: false, isProject: true })
      for (const t of loose) out.push(taskBar(t, 'var(--accent)'))
    }
    return out
  }, [projects, tasks, navigate])

  const unscheduled = tasks.filter((t) => !t.archived_at && !t.due_date && !t.start_date && t.status !== 'done')

  function colSpan(startIso: string, endIso: string): { start: number; end: number } | null {
    if (!startIso || !endIso || endIso < first || startIso > last) return null
    const s = Math.max(0, dayIndex(startIso < first ? first : startIso)) + 2
    const e = Math.max(0, dayIndex(endIso > last ? last : endIso)) + 3
    return { start: s, end: e }
  }

  return (
    <div>
      <h1 className="page-title">Timeline</h1>
      {rows.length === 0 ? (
        <div className="card muted">
          No projects or tasks with dates yet. Set start/end dates on a project in Settings, or a due date on a task — they appear here as a Gantt chart.
        </div>
      ) : (
        <div className="timeline-scroll card" style={{ paddingBottom: 8 }}>
          <div className="timeline-grid" style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(22px, 1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={d.iso} className={`timeline-head${d.isToday ? ' today' : ''}`}>{d.label}</div>
            ))}
            {rows.map((bar, i) => {
              const span = colSpan(bar.startIso, bar.endIso)
              return (
                <div key={i} style={{ display: 'contents' }}>
                  <div
                    className="timeline-label"
                    title={bar.label}
                    style={{
                      fontWeight: bar.isProject ? 800 : 400,
                      paddingLeft: bar.isProject ? 0 : 14,
                      color: bar.isProject ? 'var(--charcoal)' : 'var(--text)',
                    }}
                  >
                    {bar.isProject ? bar.label : `— ${bar.label}`}
                  </div>
                  {span ? (
                    <div
                      className="timeline-bar"
                      style={{
                        gridColumn: `${span.start} / ${span.end}`,
                        background: bar.color,
                        opacity: bar.faded ? 0.45 : 1,
                        height: bar.isProject ? 20 : 16,
                        alignSelf: 'center',
                        fontWeight: bar.isProject ? 700 : 400,
                        cursor: bar.onClick ? 'pointer' : 'default',
                      }}
                      title={`${bar.label} — ${formatDate(bar.startIso)} to ${formatDate(bar.endIso)}`}
                      onClick={bar.onClick}
                    >
                      {bar.isProject ? bar.label : ''}
                    </div>
                  ) : (
                    <div style={{ gridColumn: `2 / ${days.length + 2}` }} className="small muted" title="No dates in the visible window" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15 }} className="muted">Tasks with no dates yet</h2>
          <ul className="manage-list">
            {unscheduled.map((t: Task) => {
              const project: Project | undefined = projects.find((p) => p.id === t.project_id)
              return (
                <li key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/task/${t.id}`)}>
                  {project && <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: project.color, display: 'inline-block' }} />}
                  <span className="grow">{t.title}</span>
                  <span className="small muted">set a due date →</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
