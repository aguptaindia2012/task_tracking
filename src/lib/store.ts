import { getDb, TABLES, type OutboxOp, type TableName } from './db'
import { supabase } from './supabase'
import { addDaysISO } from './dates'
import type { Activity, ActivityAction, Contact, Note, Project, Status, Task, Template, TemplateTask } from '../types'

export type SyncState = 'local-only' | 'synced' | 'pending' | 'syncing' | 'error'

export interface StoreState {
  ready: boolean
  projects: Project[]
  contacts: Contact[]
  tasks: Task[]
  notes: Note[]
  activity: Activity[]
  templates: Template[]
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
  templates: [],
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
  const [projects, contacts, tasks, notes, activity, templates] = await Promise.all([
    db.getAll('projects'),
    db.getAll('contacts'),
    db.getAll('tasks'),
    db.getAll('notes'),
    db.getAll('activity_log'),
    db.getAll('templates'),
  ])
  const pendingCount = await db.count('outbox')
  setState({ ready: true, projects, contacts, tasks, notes, activity, templates, pendingCount })
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
      let error = null
      if (op.type === 'upsert' && op.payload) {
        ;({ error } = await supabase.from(op.table).upsert(op.payload))
      } else if (op.type === 'delete') {
        ;({ error } = await supabase.from(op.table).delete().eq('id', op.id))
      }
      if (error) {
        // Leave the op queued so it retries later (e.g. after the v2 migration
        // adds a missing table/column); don't let it wedge the rest.
        console.warn(`sync push failed for "${op.table}"`, error.message)
        continue
      }
      await db.delete('outbox', op.key!)
    }
    // Pull only when nothing local is unpushed, so we never clobber it.
    if ((await db.count('outbox')) === 0) {
      const fresh: Partial<StoreState> = {}
      for (const table of TABLES) {
        const { data: rows, error } = await supabase.from(table).select('*')
        if (error) {
          // A single missing/denied table (e.g. `templates` before the v2
          // migration is run) shouldn't abort the whole sync — skip it.
          console.warn(`sync: skipping table "${table}"`, error.message)
          continue
        }
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
    archived_at: null,
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

export function archiveTask(id: string) {
  const before = state.tasks.find((t) => t.id === id)
  if (!before) return
  const after: Task = { ...before, archived_at: now(), updated_at: now() }
  setState({ tasks: state.tasks.map((t) => (t.id === id ? after : t)) })
  void persistUpsert('tasks', after)
  logActivity(id, 'archived', {})
}

export function restoreTask(id: string) {
  const before = state.tasks.find((t) => t.id === id)
  if (!before) return
  const after: Task = { ...before, archived_at: null, updated_at: now() }
  setState({ tasks: state.tasks.map((t) => (t.id === id ? after : t)) })
  void persistUpsert('tasks', after)
  logActivity(id, 'restored', {})
}

// ---------------------------------------------------------------------------
// projects & contacts
// ---------------------------------------------------------------------------

export function createProject(
  name: string,
  color: string,
  dates: { start_date?: string | null; end_date?: string | null } = {},
): Project {
  const project: Project = {
    id: uuid(),
    name,
    color,
    start_date: dates.start_date ?? null,
    end_date: dates.end_date ?? null,
    archived_at: null,
    created_at: now(),
  }
  setState({ projects: [...state.projects, project] })
  void persistUpsert('projects', project)
  return project
}

export function updateProject(id: string, patch: Partial<Omit<Project, 'id' | 'created_at'>>) {
  const before = state.projects.find((p) => p.id === id)
  if (!before) return
  const after: Project = { ...before, ...patch }
  setState({ projects: state.projects.map((p) => (p.id === id ? after : p)) })
  void persistUpsert('projects', after)
}

export function archiveProject(id: string) {
  updateProject(id, { archived_at: now() })
}

export function restoreProject(id: string) {
  updateProject(id, { archived_at: null })
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

// ---------------------------------------------------------------------------
// SOP templates — reusable sets of preset tasks for repeated projects
// ---------------------------------------------------------------------------

export function createTemplate(name: string, tasks: TemplateTask[] = []): Template {
  const template: Template = { id: uuid(), name, tasks, created_at: now() }
  setState({ templates: [...state.templates, template] })
  void persistUpsert('templates', template)
  return template
}

export function updateTemplate(id: string, patch: Partial<Omit<Template, 'id' | 'created_at'>>) {
  const before = state.templates.find((t) => t.id === id)
  if (!before) return
  const after: Template = { ...before, ...patch }
  setState({ templates: state.templates.map((t) => (t.id === id ? after : t)) })
  void persistUpsert('templates', after)
}

export function deleteTemplate(id: string) {
  setState({ templates: state.templates.filter((t) => t.id !== id) })
  void persistDelete('templates', id)
}

// Build a template from an existing project's current (non-archived) tasks.
export function templateFromProject(projectId: string, name: string): Template | undefined {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return undefined
  const tasks: TemplateTask[] = state.tasks
    .filter((t) => t.project_id === projectId && !t.archived_at)
    .sort((a, b) => a.position - b.position)
    .map((t) => ({
      title: t.title,
      description: t.description,
      // Preserve each task's due date as an offset from the project start.
      due_offset_days: t.due_date && project.start_date ? daysBetween(project.start_date, t.due_date) : null,
    }))
  return createTemplate(name, tasks)
}

// Instantiate a template into a brand-new project with dated tasks.
export function instantiateTemplate(templateId: string, projectName: string, startDate: string, color: string): Project | undefined {
  const template = state.templates.find((t) => t.id === templateId)
  if (!template) return undefined
  const offsets = template.tasks.map((t) => t.due_offset_days ?? 0)
  const maxOffset = offsets.length ? Math.max(...offsets) : 0
  const project = createProject(projectName, color, {
    start_date: startDate,
    end_date: maxOffset > 0 ? addDaysISO(startDate, maxOffset) : startDate,
  })
  for (const t of template.tasks) {
    createTask({
      title: t.title,
      description: t.description,
      project_id: project.id,
      due_date: t.due_offset_days != null ? addDaysISO(startDate, t.due_offset_days) : null,
    })
  }
  return project
}

function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number)
  const [ty, tm, td] = toISO.split('-').map(Number)
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)
  return Math.round(ms / 86400000)
}
