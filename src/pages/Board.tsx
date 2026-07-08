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

const COLUMNS: Status[] = ['todo', 'in_progress', 'done']

function Column({ status, tasks, children }: { status: Status; tasks: Task[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={`column${isOver ? ' drop-over' : ''}`}>
      <div className="column-title">
        <span>{STATUS_LABELS[status]}</span>
        <span>{tasks.length}</span>
      </div>
      {children}
    </div>
  )
}

function QuickAdd({ status }: { status: Status }) {
  const [title, setTitle] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    createTask({ title: title.trim(), status })
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
  const [projectFilter, setProjectFilter] = useState('')
  const [contactFilter, setContactFilter] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!projectFilter || t.project_id === projectFilter) &&
          (!contactFilter || t.contact_id === contactFilter),
      ),
    [tasks, projectFilter, contactFilter],
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const status = over.id as Status
    const task = tasks.find((t) => t.id === active.id)
    if (!task || task.status === status) return
    const maxPos = Math.max(0, ...tasks.filter((t) => t.status === status).map((t) => t.position))
    updateTask(task.id, { status, position: maxPos + 1 })
  }

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Board</h1>
        <div className="row">
          <select className="input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All projects</option>
            {projects.map((p) => (
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

      <div className="board-scroll">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="board">
            {COLUMNS.map((status) => {
              const columnTasks = filtered
                .filter((t) => t.status === status)
                .sort((a, b) => a.position - b.position)
              return (
                <Column key={status} status={status} tasks={columnTasks}>
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      project={projects.find((p) => p.id === task.project_id)}
                      contact={contacts.find((c) => c.id === task.contact_id)}
                    />
                  ))}
                  <QuickAdd status={status} />
                </Column>
              )
            })}
          </div>
        </DndContext>
      </div>
    </div>
  )
}
