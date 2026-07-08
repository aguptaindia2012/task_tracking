import { getDb, TABLES, type OutboxOp, type TableName } from './db'
import { supabase } from './supabase'
import type { Activity, ActivityAction, Contact, Note, Project, Status, Task } from '../types'

export type SyncState = 'local-only' | 'synced' | 'pending' | 'syncing' | 'error'

export interface StoreState {
  ready: boolean
  projects: Project[]
  contacts: Contact[]
  tasks: Task[]
  notes: Note[]
  activity: Activity[]
  syncState: SyncState
  pendingCount: number
}

let state: StoreState = {
  ready: false,
  projects: [],
  contacts: [],
  tasks: [],
  notes: [],
  activity: [],
  syncState: supabase ? 'pending' : 'local-only',
  pendingCount: 0,
}

const listeners = new Set<() => void>()

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): StoreState {
  return state
}

function setState(patch: Partial<StoreState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

// ---------------------------------------------------------------------------
// persistence helpers: every mutation updates memory + IndexedDB + outbox
// ---------------------------------------------------------------------------

async function persistUpsert<T extends { id: string }>(table: TableName, row: T) {
  const db = await getDb()
  const tx = db.transaction([table, 'outbox'], 'readwrite')
  await tx.objectStore(table).put(row)
  await tx.objectStore('outbox').put({ table, type: 'upsert', id: row.id, payload: row as unknown as Record<string, unknown> } satisfies OutboxOp)
  await tx.done
  void refreshPending()
  void sync()
}

async function persistDelete(table: TableName, id: string) {
  const db = await getDb()
  const tx = db.transaction([table, 'outbox'], 'readwrite')
  await tx.objectStore(table).delete(id)
  await tx.objectStore('outbox').put({ table, type: 'delete', id } satisfies OutboxOp)
  await tx.done
  void refreshPending()
  void sync()
}

async function refreshPending() {
  const db = await getDb()
  const count = await db.count('outbox')
  setState({ pendingCount: count, syncState: state.syncState === 'local-only' ? 'local-only' : count > 0 ? 'pending' : 'synced' })
}

// ---------------------------------------------------------------------------
// init: load the IndexedDB mirror into memory, then try a sync
// ---------------------------------------------------------------------------

export async function initStore() {
  const db = await getDb()
  const [projects, contacts, tasks, notes, activity] = await Promise.all([
    db.getAll('projects'),
    db.getAll('contacts'),
    db.getAll('tasks'),
    db.getAll('notes'),
    db.getAll('activity_log'),
  ])
  const pendingCount = await db.count('outbox')
  setState({ ready: true, projects, contacts, tasks, notes, activity, pendingCount })
  window.addEventListener('online', () => void sync())
  void sync()
}

// ---------------------------------------------------------------------------
// sync: push outbox to Supabase, then pull all tables into the mirror
// ---------------------------------------------------------------------------

let syncing = false

export async function sync() {
  if (!supabase || syncing || !navigator.onLine) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  syncing = true
  setState({ syncState: 'syncing' })
  try {
    const db = await getDb()
    const ops = (await db.getAll('outbox')) as OutboxOp[]
    for (const op of ops) {
      if (op.type === 'upsert' && op.payload) {
        const { error } = await supabase.from(op.table).upsert(op.payload)
        if (error) throw error
      } else if (op.type === 'delete') {
        const { error } = await supabase.from(op.table).delete().eq('id', op.id)
        if (error) throw error
      }
      await db.delete('outbox', op.key!)
    }
    // Pull only when nothing local is unpushed, so we never clobber it.
    if ((await db.count('outbox')) === 0) {
      const fresh: Partial<StoreState> = {}
      for (const table of TABLES) {
        const { data: rows, error } = await supabase.from(table).select('*')
        if (error) throw error
        const tx = db.transaction(table, 'readwrite')
        await tx.objectStore(table).clear()
        for (const row of rows ?? []) await tx.objectStore(table).put(row)
        await tx.done
        const key = table === 'activity_log' ? 'activity' : table
        ;(fresh as Record<string, unknown>)[key] = rows ?? []
      }
      setState({ ...fresh, syncState: 'synced', pendingCount: 0 })
    } else {
      setState({ syncState: 'pending' })
    }
  } catch (err) {
    console.error('sync failed', err)
    setState({ syncState: 'error' })
  } finally {
    syncing = false
  }
}

// ---------------------------------------------------------------------------
// activity log — every task mutation records what happened, when
// ---------------------------------------------------------------------------

function logActivity(taskId: string, action: ActivityAction, detail: Record<string, string | null> = {}) {
  const entry: Activity = { id: uuid(), task_id: taskId, action, detail, created_at: now() }
  setState({ activity: [...state.activity, entry] })
  void persistUpsert('activity_log', entry)
}

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export function createTask(input: {
  title: string
  description?: string
  project_id?: string | null
  contact_id?: string | null
  status?: Status
  due_date?: string | null
  start_date?: string | null
}): Task {
  const maxPos = Math.max(0, ...state.tasks.filter((t) => t.status === (input.status ?? 'todo')).map((t) => t.position))
  const task: Task = {
    id: uuid(),
    title: input.title,
    description: input.description ?? '',
    project_id: input.project_id ?? null,
    contact_id: input.contact_id ?? null,
    status: input.status ?? 'todo',
    position: maxPos + 1,
    start_date: input.start_date ?? null,
    due_date: input.due_date ?? null,
    created_at: now(),
    updated_at: now(),
    completed_at: null,
  }
  setState({ tasks: [...state.tasks, task] })
  void persistUpsert('tasks', task)
  logActivity(task.id, 'created', { title: task.title })
  if (task.contact_id) {
    logActivity(task.id, 'assigned', { to: contactName(task.contact_id) })
  }
  if (task.due_date) {
    logActivity(task.id, 'due_date_set', { due: task.due_date })
  }
  return task
}

function contactName(id: string | null): string | null {
  return state.contacts.find((c) => c.id === id)?.name ?? null
}

export function updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'created_at'>>) {
  const before = state.tasks.find((t) => t.id === id)
  if (!before) return
  const after: Task = { ...before, ...patch, updated_at: now() }

  if (patch.status && patch.status !== before.status) {
    if (patch.status === 'done') after.completed_at = now()
    else if (before.status === 'done') after.completed_at = null
  }

  setState({ tasks: state.tasks.map((t) => (t.id === id ? after : t)) })
  void persistUpsert('tasks', after)

  // Derive the audit trail from what actually changed.
  if (patch.status && patch.status !== before.status) {
    if (patch.status === 'done') logActivity(id, 'completed', {})
    else if (before.status === 'done') logActivity(id, 'reopened', { to: patch.status })
    else logActivity(id, 'status_changed', { from: before.status, to: patch.status })
  }
  if ('contact_id' in patch && patch.contact_id !== before.contact_id) {
    if (patch.contact_id) logActivity(id, 'assigned', { to: contactName(patch.contact_id) })
    else logActivity(id, 'unassigned', { was: contactName(before.contact_id) })
  }
  if ('due_date' in patch && patch.due_date !== before.due_date) {
    logActivity(id, 'due_date_set', { due: patch.due_date ?? null })
  }
  if (
    ('title' in patch && patch.title !== before.title) ||
    ('description' in patch && patch.description !== before.description) ||
    ('start_date' in patch && patch.start_date !== before.start_date) ||
    ('project_id' in patch && patch.project_id !== before.project_id)
  ) {
    logActivity(id, 'edited', {})
  }
}

export function deleteTask(id: string) {
  const orphaned = state.activity.filter((a) => a.task_id === id)
  setState({
    tasks: state.tasks.filter((t) => t.id !== id),
    activity: state.activity.filter((a) => a.task_id !== id),
  })
  void persistDelete('tasks', id)
  for (const a of orphaned) void persistDelete('activity_log', a.id)
}

// ---------------------------------------------------------------------------
// projects & contacts
// ---------------------------------------------------------------------------

export function createProject(name: string, color: string): Project {
  const project: Project = { id: uuid(), name, color, created_at: now() }
  setState({ projects: [...state.projects, project] })
  void persistUpsert('projects', project)
  return project
}

export function deleteProject(id: string) {
  // Mirror the FK "on delete set null" behaviour locally.
  const affected = state.tasks.filter((t) => t.project_id === id)
  setState({
    projects: state.projects.filter((p) => p.id !== id),
    tasks: state.tasks.map((t) => (t.project_id === id ? { ...t, project_id: null } : t)),
    notes: state.notes.map((n) => (n.project_id === id ? { ...n, project_id: null } : n)),
  })
  for (const t of affected) void persistUpsert('tasks', { ...t, project_id: null })
  void persistDelete('projects', id)
}

export function createContact(name: string): Contact {
  const contact: Contact = { id: uuid(), name, created_at: now() }
  setState({ contacts: [...state.contacts, contact] })
  void persistUpsert('contacts', contact)
  return contact
}

export function deleteContact(id: string) {
  const affected = state.tasks.filter((t) => t.contact_id === id)
  setState({
    contacts: state.contacts.filter((c) => c.id !== id),
    tasks: state.tasks.map((t) => (t.contact_id === id ? { ...t, contact_id: null } : t)),
  })
  for (const t of affected) void persistUpsert('tasks', { ...t, contact_id: null })
  void persistDelete('contacts', id)
}

// Fuzzy-find a contact by spoken name, creating it if new.
export function findOrCreateContact(name: string): Contact {
  const needle = name.trim().toLowerCase()
  const existing = state.contacts.find(
    (c) => c.name.toLowerCase() === needle || c.name.toLowerCase().startsWith(needle) || needle.startsWith(c.name.toLowerCase()),
  )
  return existing ?? createContact(name.trim())
}

export function findProject(name: string): Project | undefined {
  const needle = name.trim().toLowerCase()
  return state.projects.find(
    (p) => p.name.toLowerCase() === needle || p.name.toLowerCase().startsWith(needle) || needle.startsWith(p.name.toLowerCase()),
  )
}

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------

export function createNote(content: string, source: 'voice' | 'typed', projectId: string | null = null): Note {
  const note: Note = { id: uuid(), content, project_id: projectId, source, created_at: now() }
  setState({ notes: [...state.notes, note] })
  void persistUpsert('notes', note)
  return note
}

export function deleteNote(id: string) {
  setState({ notes: state.notes.filter((n) => n.id !== id) })
  void persistDelete('notes', id)
}
