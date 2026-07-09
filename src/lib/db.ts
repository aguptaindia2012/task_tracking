import { openDB, type IDBPDatabase } from 'idb'

export const TABLES = ['projects', 'contacts', 'tasks', 'notes', 'activity_log', 'templates'] as const
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
    dbPromise = openDB('voicetask', 2, {
      upgrade(db) {
        // Idempotent: create any store that doesn't exist yet (covers both a
        // fresh install and an upgrade from v1, which lacked `templates`).
        for (const table of TABLES) {
          if (!db.objectStoreNames.contains(table)) {
            db.createObjectStore(table, { keyPath: 'id' })
          }
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'key', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}
