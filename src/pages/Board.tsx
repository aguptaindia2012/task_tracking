import { useMemo, useState, type FormEvent } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useStore } from '../hooks/useStore'
import { createTask, updateTask } from '../lib/store'
import TaskCard from '../components/TaskCard'
import { STATUS_LABELS, type Status, type Task } from '../types'

type GroupBy = 'status' | 'project' | 'contact'

const NONE = '__none__' // droppable id for the "No project" / "Unassigned" column

interface ColumnDef {
  id: string // droppable id — a status value, a project id, a contact id, or NONE
  label: string
  color?: string
}

function Column({ col, count, children }: { col: ColumnDef; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div ref={setNodeRef} className={`column${isOver ? ' drop-over' : ''}`}>
      <div className="column-title">
        <span className="row" style={{ gap: 6 }}>
          {col.color && <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: col.color, display: 'inline-block' }} />}
          {col.label}
        </span>
        <span>{count}</span>
      </div>
      {children}
    </div>
  )
}

function QuickAdd({ defaults }: { defaults: Partial<Task> }) {
  const [title, setTitle] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    createTask({
      title: title.trim(),
      status: (defaults.status as Status) ?? 'todo',
      project_id: defaults.project_id ?? null,
      contact_id: defaults.contact_id ?? null,
    })
    setTitle('')
  }
  return (
    <form className="quick-add" onSubmit={submit}>
      <input className="input" placeholder="+ Add task" value={title} onChange={(e) => setTitle(e.target.value)} />
    </form>
  )
}

export default function Board() {
  const { tasks, projects, contacts } = useStore()
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [projectFilter, setProjectFilter] = useState('')
  const [contactFilter, setContactFilter] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived_at), [projects])

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.archived_at &&
          (!projectFilter || t.project_id === projectFilter) &&
          (!contactFilter || t.contact_id === contactFilter),
      ),
    [tasks, projectFilter, contactFilter],
  )

  // Build the columns and the per-column defaults for quick-add, based on the grouping.
  const columns: ColumnDef[] = useMemo(() => {
    if (groupBy === 'status') return (['todo', 'in_progress', 'done'] as Status[]).map((s) => ({ id: s, label: STATUS_LABELS[s] }))
    if (groupBy === 'project')
      return [...activeProjects.map((p) => ({ id: p.id, label: p.name, color: p.color })), { id: NONE, label: 'No project' }]
    return [...contacts.map((c) => ({ id: c.id, label: c.name })), { id: NONE, label: 'Unassigned' }]
  }, [groupBy, activeProjects, contacts])

  function keyOf(task: Task): string {
    if (groupBy === 'status') return task.status
    if (groupBy === 'project') return task.project_id ?? NONE
    return task.contact_id ?? NONE
  }

  function defaultsFor(colId: string): Partial<Task> {
    if (groupBy === 'status') return { status: colId as Status }
    if (groupBy === 'project') return { project_id: colId === NONE ? null : colId }
    return { contact_id: colId === NONE ? null : colId }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const target = String(over.id)
    const task = tasks.find((t) => t.id === active.id)
    if (!task || keyOf(task) === target) return

    if (groupBy === 'status') {
      const maxPos = Math.max(0, ...tasks.filter((t) => t.status === target).map((t) => t.position))
      updateTask(task.id, { status: target as Status, position: maxPos + 1 })
    } else if (groupBy === 'project') {
      updateTask(task.id, { project_id: target === NONE ? null : target })
    } else {
      updateTask(task.id, { contact_id: target === NONE ? null : target })
    }
  }

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <h1 className="page-title" style={{ margin: 0 }}>Board</h1>
          <div className="seg">
            {(['status', 'project', 'contact'] as GroupBy[]).map((g) => (
              <button
                key={g}
                className={`seg-btn${groupBy === g ? ' active' : ''}`}
                onClick={() => setGroupBy(g)}
              >
                {g === 'status' ? 'Status' : g === 'project' ? 'Projects' : 'Assignees'}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <select className="input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All projects</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select className="input" value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All assignees</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="card muted">
          {groupBy === 'project'
            ? 'No projects yet. Add one in Settings to group by project.'
            : 'No assignees yet. Add one in Settings to group by assignee.'}
        </div>
      ) : (
        <div className="board-scroll">
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))`, minWidth: columns.length * 274 }}>
              {columns.map((col) => {
                const colTasks = filtered
                  .filter((t) => keyOf(t) === col.id)
                  .sort((a, b) => a.position - b.position)
                return (
                  <Column key={col.id} col={col} count={colTasks.length}>
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        project={projects.find((p) => p.id === task.project_id)}
                        contact={contacts.find((c) => c.id === task.contact_id)}
                      />
                    ))}
                    <QuickAdd defaults={defaultsFor(col.id)} />
                  </Column>
                )
              })}
            </div>
          </DndContext>
        </div>
      )}
    </div>
  )
}
