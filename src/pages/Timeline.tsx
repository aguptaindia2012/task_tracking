import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../hooks/useStore'
import { formatDate } from '../lib/dates'

// Rolling window: a few days back through the next month.
const DAYS_BACK = 3
const DAYS_FORWARD = 30

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
        label: d.toLocaleDateString(undefined, { day: 'numeric', month: d.getDate() === 1 || i === 0 ? 'short' : undefined }),
        isToday: iso === todayIso,
      })
    }
    return list
  }, [])

  const scheduled = tasks
    .filter((t) => t.due_date || t.start_date)
    .sort((a, b) => (a.start_date ?? a.due_date ?? '').localeCompare(b.start_date ?? b.due_date ?? ''))

  const unscheduled = tasks.filter((t) => !t.due_date && !t.start_date && t.status !== 'done')

  const first = days[0].iso
  const last = days[days.length - 1].iso

  function dayIndex(iso: string): number {
    return days.findIndex((d) => d.iso === iso)
  }

  return (
    <div>
      <h1 className="page-title">Timeline</h1>
      {scheduled.length === 0 ? (
        <div className="card muted">No tasks with dates yet. Set a start or due date on a task and it appears here.</div>
      ) : (
        <div className="timeline-scroll card" style={{ paddingBottom: 8 }}>
          <div className="timeline-grid" style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(26px, 1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={d.iso} className={`timeline-head${d.isToday ? ' today' : ''}`}>{d.label}</div>
            ))}
            {scheduled.map((task) => {
              const project = projects.find((p) => p.id === task.project_id)
              const startIso = task.start_date ?? task.due_date!
              const endIso = task.due_date ?? task.start_date!
              // Clamp bars into the visible window; skip tasks entirely outside it.
              if (endIso < first || startIso > last) return null
              const startCol = Math.max(0, dayIndex(startIso < first ? first : startIso)) + 2
              const endCol = Math.max(0, dayIndex(endIso > last ? last : endIso)) + 3
              return (
                <div key={task.id} style={{ display: 'contents' }}>
                  <div className="timeline-label" title={task.title}>{task.title}</div>
                  <div
                    className="timeline-bar"
                    style={{
                      gridColumn: `${startCol} / ${endCol}`,
                      background: project?.color ?? 'var(--accent)',
                      opacity: task.status === 'done' ? 0.45 : 1,
                    }}
                    title={`${task.title} — ${formatDate(startIso)} to ${formatDate(endIso)}`}
                    onClick={() => navigate(`/task/${task.id}`)}
                  >
                    {task.title}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15 }} className="muted">No dates yet</h2>
          <ul className="manage-list">
            {unscheduled.map((t) => (
              <li key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/task/${t.id}`)}>
                <span className="grow">{t.title}</span>
                <span className="small muted">set dates →</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
