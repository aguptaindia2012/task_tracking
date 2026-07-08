export type Status = 'todo' | 'in_progress' | 'done'

export interface Project {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Contact {
  id: string
  name: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  project_id: string | null
  contact_id: string | null
  status: Status
  position: number
  start_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface Note {
  id: string
  content: string
  project_id: string | null
  source: 'voice' | 'typed'
  created_at: string
}

export type ActivityAction =
  | 'created'
  | 'assigned'
  | 'unassigned'
  | 'status_changed'
  | 'edited'
  | 'due_date_set'
  | 'completed'
  | 'reopened'

export interface Activity {
  id: string
  task_id: string
  action: ActivityAction
  detail: Record<string, string | null>
  created_at: string
}

export const STATUS_LABELS: Record<Status, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}
