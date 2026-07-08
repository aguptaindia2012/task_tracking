import { openDB, type IDBPDatabase } from 'idb'

export const TABLES = ['projects', 'contacts', 'tasks', 'notes', 'activity_log'] as const
export type TableName = (typeof TABLES)[number]

export interface OutboxOp {
  key?: number
  table: TableName
  type: 'upsert' | 'delete'
  id: string
  payload?: Record<string, unknown>
}

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB('voicetask', 1, {
      upgrade(db) {
        for (const table of TABLES) {
          db.createObjectStore(table, { keyPath: 'id' })
        }
        db.createObjectStore('outbox', { keyPath: 'key', autoIncrement: true })
      },
    })
  }
  return dbPromise
}
