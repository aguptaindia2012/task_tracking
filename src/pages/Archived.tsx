import { useNavigate } from 'react-router-dom'
import { useStore } from '../hooks/useStore'
import { deleteProject, deleteTask, restoreProject, restoreTask } from '../lib/store'
import { colorName } from '../lib/brand'
import { formatTimestamp } from '../lib/dates'
import { STATUS_LABELS } from '../types'

export default function Archived() {
  const { projects, tasks } = useStore()
  const navigate = useNavigate()

  const archivedProjects = projects.filter((p) => p.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))
  const archivedTasks = tasks.filter((t) => t.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 className="page-title" style={{ margin: 0 }}>Archived</h1>
      <p className="small muted" style={{ margin: '-8px 0 0' }}>
        Archived items are kept for your records and hidden from the board and timeline. Restore returns them to their original state.
      </p>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Projects</h2>
        {archivedProjects.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No archived projects.</p>
        ) : (
          <ul className="manage-list">
            {archivedProjects.map((p) => (
              <li key={p.id}>
                <span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                <span className="grow">{p.name} <span className="small muted">· {colorName(p.color)}</span></span>
                <span className="small muted">archived {formatTimestamp(p.archived_at!)}</span>
                <button className="btn secondary sm" onClick={() => restoreProject(p.id)}>Restore</button>
                <button className="btn danger sm" onClick={() => { if (confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) deleteProject(p.id) }}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Tasks</h2>
        {archivedTasks.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No archived tasks.</p>
        ) : (
          <ul className="manage-list">
            {archivedTasks.map((t) => {
              const project = projects.find((p) => p.id === t.project_id)
              return (
                <li key={t.id}>
                  {project && <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: project.color, display: 'inline-block' }} />}
                  <span className="grow" style={{ cursor: 'pointer' }} onClick={() => navigate(`/task/${t.id}`)}>
                    {t.title} <span className="small muted">· {STATUS_LABELS[t.status]}</span>
                  </span>
                  <span className="small muted">archived {formatTimestamp(t.archived_at!)}</span>
                  <button className="btn secondary sm" onClick={() => restoreTask(t.id)}>Restore</button>
                  <button className="btn danger sm" onClick={() => { if (confirm('Permanently delete this task and its history?')) deleteTask(t.id) }}>Delete</button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
