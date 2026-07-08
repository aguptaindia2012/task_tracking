import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractTasks, fileToBase64, type ExtractedTask } from '../lib/aiExtract'
import { createTask, findOrCreateContact, findProject } from '../lib/store'

const MAX_FILE_MB = 3

export default function Extract() {
  const navigate = useNavigate()
  const [instructions, setInstructions] = useState('Extract every task assigned to me, with any deadlines and who is responsible.')
  const [pastedText, setPastedText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ExtractedTask[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResults(null)
    if (file && file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_FILE_MB} MB). Try a smaller file or paste the text instead.`)
      return
    }
    if (!file && !pastedText.trim()) {
      setError('Attach a document or paste some text first.')
      return
    }
    setBusy(true)
    try {
      const payload = {
        instructions,
        pastedText: pastedText.trim() || undefined,
        file: file ? { name: file.name, type: file.type, dataBase64: await fileToBase64(file) } : undefined,
      }
      const tasks = await extractTasks(payload)
      setResults(tasks)
      setPicked(new Set(tasks.map((_, i) => i))) // select all by default
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function toggle(i: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function addSelected() {
    if (!results) return
    let added = 0
    results.forEach((t, i) => {
      if (!picked.has(i)) return
      const project = t.project ? findProject(t.project) : undefined
      const contact = t.assignee ? findOrCreateContact(t.assignee) : undefined
      createTask({
        title: t.title,
        description: t.description || '',
        project_id: project?.id ?? null,
        contact_id: contact?.id ?? null,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
      })
      added++
    })
    navigate('/', { replace: true })
    void added
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 className="page-title">Extract tasks from a document</h1>

      {!results && (
        <form className="card" onSubmit={submit}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Upload a document (PDF, Word, or text) or paste text, tell the AI what to pull out, and it proposes tasks you can add to your board.
          </p>
          <div className="field">
            <label>What should I extract?</label>
            <textarea className="input" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <div className="field">
            <label>Document (PDF, .docx, .txt — up to {MAX_FILE_MB} MB)</label>
            <input
              className="input"
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,.csv,application/pdf,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="field">
            <label>…or paste text</label>
            <textarea className="input" rows={5} placeholder="Paste meeting notes, an email, a brief…" value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Extracting…' : '✨ Extract tasks'}</button>
        </form>
      )}

      {results && (
        <div>
          {results.length === 0 ? (
            <div className="card muted">No tasks were found in that material. Try different instructions or another document.</div>
          ) : (
            <div className="card">
              <div className="row spread" style={{ marginBottom: 12 }}>
                <strong>{picked.size} of {results.length} selected</strong>
                <button className="btn secondary sm" onClick={() => { setResults(null); setError(null) }}>Start over</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map((t, i) => (
                  <label key={i} className="proposed-task">
                    <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{t.title}</div>
                      {t.description && <div className="small muted">{t.description}</div>}
                      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {t.project && <span className="chip">📁 {t.project}</span>}
                        {t.assignee && <span className="chip">👤 {t.assignee}</span>}
                        {t.due_date && <span className="chip">📅 {t.due_date}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn" disabled={picked.size === 0} onClick={addSelected}>
                  Add {picked.size} task{picked.size === 1 ? '' : 's'} to board
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
