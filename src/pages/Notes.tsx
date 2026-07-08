import { useState, type FormEvent } from 'react'
import { useStore } from '../hooks/useStore'
import { createNote, deleteNote } from '../lib/store'
import { formatTimestamp } from '../lib/dates'

export default function Notes() {
  const { notes, projects } = useStore()
  const [content, setContent] = useState('')
  const [projectId, setProjectId] = useState('')
  const [filter, setFilter] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    createNote(content.trim(), 'typed', projectId || null)
    setContent('')
  }

  const visible = notes
    .filter((n) => !filter || n.project_id === filter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="row spread" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Notes</h1>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
        <div className="field">
          <textarea className="input" rows={2} placeholder="Write a note…" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="row spread">
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: 'auto' }}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn">Add note</button>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.length === 0 && <p className="muted">No notes yet. Add one above, or dictate one in Drive mode.</p>}
        {visible.map((note) => {
          const project = projects.find((p) => p.id === note.project_id)
          return (
            <div key={note.id} className="card note-item">
              <div style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
              <div className="row spread">
                <span className="small muted">
                  {formatTimestamp(note.created_at)}
                  {note.source === 'voice' && ' · 🎙 voice'}
                  {project && (
                    <>
                      {' · '}
                      <span className="chip" style={{ marginLeft: 4 }}>
                        <span className="dot" style={{ background: project.color }} />
                        {project.name}
                      </span>
                    </>
                  )}
                </span>
                <button className="btn danger sm" onClick={() => deleteNote(note.id)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
