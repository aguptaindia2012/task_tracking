import { useState, type FormEvent } from 'react'
import { useStore } from '../hooks/useStore'
import { createContact, createProject, deleteContact, deleteProject, sync } from '../lib/store'
import { supabase, isCloudConfigured } from '../lib/supabase'

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a855f7', '#84cc16']

export default function Settings() {
  const { projects, contacts, tasks, syncState, pendingCount } = useStore()
  const [projectName, setProjectName] = useState('')
  const [projectColor, setProjectColor] = useState(PALETTE[0])
  const [contactName, setContactName] = useState('')

  function addProject(e: FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    createProject(projectName.trim(), projectColor)
    setProjectName('')
  }

  function addContact(e: FormEvent) {
    e.preventDefault()
    if (!contactName.trim()) return
    createContact(contactName.trim())
    setContactName('')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 className="page-title" style={{ margin: 0 }}>Settings</h1>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Projects</h2>
        <form className="row" onSubmit={addProject}>
          <input className="input" placeholder="New project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <select className="input" value={projectColor} onChange={(e) => setProjectColor(e.target.value)} style={{ width: 'auto', background: projectColor, color: '#fff' }}>
            {PALETTE.map((c) => (
              <option key={c} value={c} style={{ background: c }}>{c}</option>
            ))}
          </select>
          <button className="btn">Add</button>
        </form>
        <ul className="manage-list">
          {projects.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
              <span className="grow">{p.name}</span>
              <span className="small muted">{tasks.filter((t) => t.project_id === p.id).length} tasks</span>
              <button
                className="btn danger sm"
                onClick={() => {
                  if (confirm(`Delete project "${p.name}"? Its tasks are kept without a project.`)) deleteProject(p.id)
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Assignees</h2>
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          People you delegate tasks to. They are labels only — they never get access to this app.
        </p>
        <form className="row" onSubmit={addContact}>
          <input className="input" placeholder="New assignee name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <button className="btn">Add</button>
        </form>
        <ul className="manage-list">
          {contacts.map((c) => (
            <li key={c.id}>
              <span className="grow">👤 {c.name}</span>
              <span className="small muted">{tasks.filter((t) => t.contact_id === c.id).length} tasks</span>
              <button
                className="btn danger sm"
                onClick={() => {
                  if (confirm(`Remove "${c.name}"? Their tasks become unassigned.`)) deleteContact(c.id)
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Cloud sync</h2>
        {isCloudConfigured ? (
          <>
            <p className="small" style={{ margin: '0 0 10px' }}>
              Status: <strong>{syncState}</strong>
              {pendingCount > 0 && ` — ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to upload`}
            </p>
            <div className="row">
              <button className="btn secondary sm" onClick={() => void sync()}>Sync now</button>
              <button
                className="btn danger sm"
                onClick={async () => {
                  await supabase!.auth.signOut()
                  location.reload()
                }}
              >
                Sign out
              </button>
            </div>
          </>
        ) : (
          <div className="small muted">
            <p style={{ marginTop: 0 }}>
              <strong style={{ color: 'var(--warning)' }}>Local-only mode.</strong> Your data lives in this browser only and does not
              sync between devices yet. To turn on cloud sync:
            </p>
            <ol style={{ paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a></li>
              <li>Open its <em>SQL Editor</em> and run the contents of <code>supabase/migration.sql</code> from this app's folder</li>
              <li>Copy the project URL and anon key (Project Settings → API) into a <code>.env</code> file (see <code>.env.example</code>)</li>
              <li>Rebuild / redeploy the app</li>
            </ol>
          </div>
        )}
      </div>

      <div className="card small muted">
        <strong>Install on your phone:</strong> open this app in Chrome on Android, tap the ⋮ menu → <em>Add to Home screen</em>.
        It then launches full-screen like a native app, including Drive mode.
      </div>
    </div>
  )
}
