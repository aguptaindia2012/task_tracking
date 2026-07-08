import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpeech, speak, speechSupported } from '../hooks/useSpeech'
import { parseVoiceCommand } from '../lib/voiceParser'
import { createNote, createTask, deleteNote, deleteTask, findOrCreateContact, findProject } from '../lib/store'
import { formatDate } from '../lib/dates'
import { useStore } from '../hooks/useStore'

interface LastCapture {
  type: 'task' | 'note'
  id: string
  label: string
}

const UNDO_WINDOW_MS = 10_000

export default function Driving() {
  const navigate = useNavigate()
  const { syncState } = useStore()
  const [lastCapture, setLastCapture] = useState<LastCapture | null>(null)
  const undoTimer = useRef<number | undefined>(undefined)

  function handleTranscript(transcript: string) {
    const cmd = parseVoiceCommand(transcript)
    const spoken: string[] = []

    if (cmd.kind === 'task') {
      const project = cmd.projectName ? findProject(cmd.projectName) : undefined
      const contact = cmd.assigneeName ? findOrCreateContact(cmd.assigneeName) : undefined
      const task = createTask({
        title: cmd.title,
        project_id: project?.id ?? null,
        contact_id: contact?.id ?? null,
        due_date: cmd.dueDate,
      })
      spoken.push(`Task added: ${cmd.title}`)
      if (cmd.dueDate) spoken.push(`due ${formatDate(cmd.dueDate)}`)
      if (contact) spoken.push(`assigned to ${contact.name}`)
      if (project) spoken.push(`in project ${project.name}`)
      else if (cmd.projectName) spoken.push(`project ${cmd.projectName} not found, saved without project`)
      setCapture({ type: 'task', id: task.id, label: `Task: ${cmd.title}` })
    } else {
      const project = cmd.projectName ? findProject(cmd.projectName) : undefined
      const note = createNote(cmd.title, 'voice', project?.id ?? null)
      spoken.push(`Note saved: ${cmd.title.length > 60 ? cmd.title.slice(0, 60) + '…' : cmd.title}`)
      if (project) spoken.push(`in project ${project.name}`)
      setCapture({ type: 'note', id: note.id, label: `Note: ${cmd.title.slice(0, 40)}` })
    }

    if (syncState === 'local-only' || !navigator.onLine) spoken.push('saved on this device, will sync later')
    speak(spoken.join(', '))
  }

  function setCapture(capture: LastCapture) {
    window.clearTimeout(undoTimer.current)
    setLastCapture(capture)
    undoTimer.current = window.setTimeout(() => setLastCapture(null), UNDO_WINDOW_MS)
  }

  function undo() {
    if (!lastCapture) return
    if (lastCapture.type === 'task') deleteTask(lastCapture.id)
    else deleteNote(lastCapture.id)
    window.clearTimeout(undoTimer.current)
    setLastCapture(null)
    speak('Deleted')
  }

  const { start, stop, listenState, interim, error } = useSpeech(handleTranscript)
  const listening = listenState === 'listening'

  return (
    <div className="driving">
      <button className="exit-drive" onClick={() => navigate('/')}>✕ Exit</button>

      <button
        className={`mic-button${listening ? ' listening' : ''}`}
        onClick={() => (listening ? stop() : start())}
        aria-label={listening ? 'Stop listening' : 'Start listening'}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
        </svg>
        {listening ? 'Listening…' : 'Tap to speak'}
      </button>

      <div className="transcript">{interim}</div>

      {error ? (
        <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>
      ) : !speechSupported ? (
        <p className="hint" style={{ color: 'var(--warning)' }}>
          This browser has no speech recognition. Use Chrome on Android or desktop Chrome/Edge.
        </p>
      ) : (
        <p className="hint">
          Say <strong>“Task …”</strong> or <strong>“Note …”</strong>. Add <em>“due tomorrow”</em>, <em>“assign to Ramesh”</em>,{' '}
          <em>“for project Home”</em> in any order. Anything else is saved as a note.
        </p>
      )}

      {lastCapture && (
        <div className="undo-bar">
          <span>✓ {lastCapture.label}</span>
          <button onClick={undo}>UNDO</button>
        </div>
      )}
    </div>
  )
}
