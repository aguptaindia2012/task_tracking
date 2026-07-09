import { useState, type FormEvent } from 'react'
import { useStore } from '../hooks/useStore'
import {
  archiveProject,
  createContact,
  createProject,
  createTemplate,
  deleteContact,
  deleteProject,
  deleteTemplate,
  instantiateTemplate,
  sync,
  templateFromProject,
  updateProject,
  updateTemplate,
} from '../lib/store'
import { supabase, isCloudConfigured } from '../lib/supabase'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { BRAND_COLORS, colorName } from '../lib/brand'
import type { Project, Template, TemplateTask } from '../types'

const todayISO = () => new Date().toISOString().slice(0, 10)

function Swatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="swatches">
      {BRAND_COLORS.map((c) => (
        <button
          type="button"
          key={c.hex}
          className={`swatch${value === c.hex ? ' selected' : ''}`}
          style={{ background: c.hex }}
          title={c.name}
          aria-label={c.name}
          onClick={() => onChange(c.hex)}
        />
      ))}
    </div>
  )
}

function ProjectRow({ project, taskCount }: { project: Project; taskCount: number }) {
  const [open, setOpen] = useState(false)
  return (
    <li style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: project.color, display: 'inline-block' }} />
        <span className="grow">
          {project.name} <span className="small muted">· {colorName(project.color)}</span>
        </span>
        <span className="small muted">{taskCount} tasks</span>
        <button className="btn secondary sm" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Edit'}</button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px 6px' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Name</label>
            <input
              className="input"
              defaultValue={project.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== project.name) updateProject(project.id, { name: v })
              }}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Colour — <strong style={{ color: 'var(--text)' }}>{colorName(project.color)}</strong></label>
            <Swatches value={project.color} onChange={(hex) => updateProject(project.id, { color: hex })} />
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 150 }}>
              <label>Start date</label>
              <input
                className="input"
                type="date"
                value={project.start_date ?? ''}
                onChange={(e) => updateProject(project.id, { start_date: e.target.value || null })}
              />
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 150 }}>
              <label>End date</label>
              <input
                className="input"
                type="date"
                value={project.end_date ?? ''}
                onChange={(e) => updateProject(project.id, { end_date: e.target.value || null })}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn secondary sm"
              onClick={() => {
                const name = prompt('Save this project as a reusable SOP template. Template name:', `${project.name} template`)
                if (name && name.trim()) {
                  templateFromProject(project.id, name.trim())
                  alert('Template saved — see the SOP Templates section below.')
                }
              }}
            >
              Save as template
            </button>
            <button
              className="btn secondary sm"
              onClick={() => {
                if (confirm(`Archive "${project.name}"? It moves to the Archived tab and can be restored later.`)) archiveProject(project.id)
              }}
            >
              Archive
            </button>
            <button
              className="btn danger sm"
              onClick={() => {
                if (confirm(`Permanently delete "${project.name}"? Its tasks are kept without a project. This cannot be undone.`)) deleteProject(project.id)
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function TemplateRow({ template }: { template: Template }) {
  const [open, setOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [offset, setOffset] = useState('')

  function addTask(e: FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    const t: TemplateTask = {
      title: taskTitle.trim(),
      description: '',
      due_offset_days: offset.trim() === '' ? null : Math.max(0, parseInt(offset, 10) || 0),
    }
    updateTemplate(template.id, { tasks: [...template.tasks, t] })
    setTaskTitle('')
    setOffset('')
  }

  function removeTask(i: number) {
    updateTemplate(template.id, { tasks: template.tasks.filter((_, idx) => idx !== i) })
  }

  function run() {
    const name = prompt('Create a new project from this template. Project name:', template.name)
    if (!name || !name.trim()) return
    const start = prompt('Project start date (YYYY-MM-DD):', todayISO())
    if (!start) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start.trim())) {
      alert('Please enter the date as YYYY-MM-DD.')
      return
    }
    instantiateTemplate(template.id, name.trim(), start.trim(), BRAND_COLORS[0].hex)
    alert(`Project "${name.trim()}" created with ${template.tasks.length} preset task${template.tasks.length === 1 ? '' : 's'}.`)
  }

  return (
    <li style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="grow">📋 {template.name} <span className="small muted">· {template.tasks.length} task{template.tasks.length === 1 ? '' : 's'}</span></span>
        <button className="btn sm" onClick={run}>Run</button>
        <button className="btn secondary sm" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Edit'}</button>
        <button className="btn danger sm" onClick={() => { if (confirm(`Delete template "${template.name}"?`)) deleteTemplate(template.id) }}>Delete</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 2px 6px' }}>
          {template.tasks.map((t, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              <span className="grow small">{t.title}</span>
              <span className="small muted">{t.due_offset_days != null ? `due day +${t.due_offset_days}` : 'no due date'}</span>
              <button className="btn danger sm" onClick={() => removeTask(i)}>✕</button>
            </div>
          ))}
          <form className="row" onSubmit={addTask} style={{ gap: 6 }}>
            <input className="input" placeholder="Preset task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <input className="input" style={{ width: 120 }} placeholder="due day +" value={offset} onChange={(e) => setOffset(e.target.value)} inputMode="numeric" />
            <button className="btn sm">Add</button>
          </form>
          <p className="small muted" style={{ margin: 0 }}>
            "Due day +N" = the task is due N days after the project's start date when you run the template. Leave blank for no due date.
          </p>
        </div>
      )}
    </li>
  )
}

export default function Settings() {
  const { projects, contacts, tasks, templates, syncState, pendingCount } = useStore()
  const { available: canInstall, installed, promptInstall } = useInstallPrompt()
  const [projectName, setProjectName] = useState('')
  const [projectColor, setProjectColor] = useState(BRAND_COLORS[0].hex)
  const [projectStart, setProjectStart] = useState('')
  const [projectEnd, setProjectEnd] = useState('')
  const [contactName, setContactName] = useState('')
  const [templateName, setTemplateName] = useState('')

  const activeProjects = projects.filter((p) => !p.archived_at)

  function addProject(e: FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    createProject(projectName.trim(), projectColor, { start_date: projectStart || null, end_date: projectEnd || null })
    setProjectName('')
    setProjectStart('')
    setProjectEnd('')
  }

  function addContact(e: FormEvent) {
    e.preventDefault()
    if (!contactName.trim()) return
    createContact(contactName.trim())
    setContactName('')
  }

  function addTemplate(e: FormEvent) {
    e.preventDefault()
    if (!templateName.trim()) return
    createTemplate(templateName.trim())
    setTemplateName('')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 className="page-title" style={{ margin: 0 }}>Settings</h1>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Projects</h2>
        <form onSubmit={addProject}>
          <div className="row" style={{ marginBottom: 10 }}>
            <input className="input" placeholder="New project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <button className="btn">Add</button>
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <Swatches value={projectColor} onChange={setProjectColor} />
            <span className="small muted">Colour: <strong style={{ color: 'var(--text)' }}>{colorName(projectColor)}</strong></span>
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 150 }}>
              <label>Start date (optional)</label>
              <input className="input" type="date" value={projectStart} onChange={(e) => setProjectStart(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 150 }}>
              <label>End date (optional)</label>
              <input className="input" type="date" value={projectEnd} onChange={(e) => setProjectEnd(e.target.value)} />
            </div>
          </div>
        </form>
        <ul className="manage-list">
          {activeProjects.map((p) => (
            <ProjectRow key={p.id} project={p} taskCount={tasks.filter((t) => t.project_id === p.id && !t.archived_at).length} />
          ))}
          {activeProjects.length === 0 && <li className="muted small">No projects yet.</li>}
        </ul>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>SOP Templates</h2>
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Preset task lists for projects you run repeatedly. Build one from scratch, or save an existing project as a template (in its Edit panel). "Run" creates a fresh project with all the preset tasks so nothing from the SOP is missed.
        </p>
        <form className="row" onSubmit={addTemplate}>
          <input className="input" placeholder="New template name (e.g. Field survey SOP)" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          <button className="btn">Add</button>
        </form>
        <ul className="manage-list">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} />
          ))}
          {templates.length === 0 && <li className="muted small">No templates yet.</li>}
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
              sync between devices yet.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Install as an app</h2>
        {installed ? (
          <p className="small" style={{ margin: 0, color: 'var(--success)' }}>✓ Running as an installed app.</p>
        ) : canInstall ? (
          <>
            <p className="small muted" style={{ margin: '0 0 10px' }}>
              Install VoiceTask so it opens full-screen from your desktop or home screen, like a native app.
            </p>
            <button className="btn" onClick={() => void promptInstall()}>⬇ Install app</button>
          </>
        ) : (
          <div className="small muted">
            <p style={{ marginTop: 0 }}>A web app installs through the browser — there is no file to download.</p>
            <ul style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
              <li><strong>Desktop Chrome / Edge:</strong> the install icon (a monitor with a ⬇) at the right of the address bar, or ⋮ → <em>Install VoiceTask…</em></li>
              <li><strong>Android Chrome:</strong> ⋮ menu → <em>Add to Home screen</em></li>
              <li><strong>iPhone Safari:</strong> Share → <em>Add to Home Screen</em></li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
