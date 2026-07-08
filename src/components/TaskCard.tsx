import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import type { Contact, Project, Task } from '../types'
import { formatDate, isOverdue } from '../lib/dates'

interface Props {
  task: Task
  project?: Project
  contact?: Contact
}

export default function TaskCard({ task, project, contact }: Props) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      className={`task-card${isDragging ? ' dragging' : ''}`}
      {...listeners}
      {...attributes}
      onClick={() => navigate(`/task/${task.id}`)}
    >
      <div className="title">{task.title}</div>
      {(project || contact || task.due_date) && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {project && (
            <span className="chip">
              <span className="dot" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {contact && <span className="chip">👤 {contact.name}</span>}
          {task.due_date && (
            <span className={`chip${isOverdue(task.due_date, task.status) ? ' overdue' : ''}`}>
              📅 {formatDate(task.due_date)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
