import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../hooks/useStore'
import { deleteTask, updateTask } from '../lib/store'
import { formatTimestamp } from '../lib/dates'
import { STATUS_LABELS, type Activity, type Status } from '../types'

function describeActivity(a: Activity): string {
  switch (a.action) {
    case 'created':
      return `Created — "${a.detail.title ?? ''}"`
    case 'assigned':
      return `Assigned to ${a.detail.to ?? 'someone'}`
    case 'unassigned':
      return `Unassigned${a.detail.was ? ` (was ${a.detail.was})` : ''}`
    case 'status_changed':
      return `Moved from ${STATUS_LABELS[a.detail.from as Status] ?? a.detail.from} to ${STATUS_LABELS[a.detail.to as Status] ?? a.detail.to}`
    case 'due_date_set':
      return a.detail.due ? `Due date set to ${a.detail.due}` : 'Due date removed'
    case 'completed':
      return 'Marked as done'
    case 'reopened':
      return 'Reopened'
    case 'edited':
      return 'Details edited'
  }
}

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tasks, projects, contacts, activity } = useStore()
  const task = tasks.find((t) => t.id === id)

  if (!task) {
    return (
      <div className="card">
        <p>Task not found.</p>
        <button className="btn secondary" onClick={() => navigate('/')}>Back to board</button>
      </div>
    )
  }

  const taskActivity = activity
    .filter((a) => a.task_id === task.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="row spread">
        <button className="btn secondary sm" onClick={() => navigate(-1)}>← Back</button>
        <button
          className="btn danger sm"
          onClick={() => {
            if (confirm('Delete this task and its history?')) {
              deleteTask(task.id)
              navigate('/')
            }
          }}
        >
          Delete
        </button>
      </div>

      <div className="card">
        <div className="field">
          <label>Title</label>
          {/* commit on blur so the audit log gets one "edited" entry, not one per keystroke */}
          <input
            key={`title-${task.id}`}
            className="input"
            defaultValue={task.title}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== task.title) updateTask(task.id, { title: v })
            }}
          />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            key={`desc-${task.id}`}
            className="input"
            rows={3}
            defaultValue={task.description}
            onBlur={(e) => {
              if (e.target.value !== task.description) updateTask(task.id, { description: e.target.value })
            }}
          />
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Status</label>
            <select className="input" value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value as Status })}>
              {(['todo', 'in_progress', 'done'] as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Project</label>
            <select
              className="input"
              value={task.project_id ?? ''}
              onChange={(e) => updateTask(task.id, { project_id: e.target.value || null })}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Assignee</label>
            <select
              className="input"
              value={task.contact_id ?? ''}
              onChange={(e) => updateTask(task.id, { contact_id: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Start date</label>
            <input
              className="input"
              type="date"
              value={task.start_date ?? ''}
              onChange={(e) => updateTask(task.id, { start_date: e.target.value || null })}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Due date</label>
            <input
              className="input"
              type="date"
              value={task.due_date ?? ''}
              onChange={(e) => updateTask(task.id, { due_date: e.target.value || null })}
            />
          </div>
        </div>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          Created {formatTimestamp(task.created_at)} · Last updated {formatTimestamp(task.updated_at)}
          {task.completed_at && <> · Completed {formatTimestamp(task.completed_at)}</>}
        </p>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Activity</h2>
        {taskActivity.length === 0 && <p className="muted small">No activity recorded yet.</p>}
        <ul className="activity-list">
          {taskActivity.map((a) => (
            <li key={a.id}>
              <span className="when">{formatTimestamp(a.created_at)}</span>
              <span>{describeActivity(a)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
