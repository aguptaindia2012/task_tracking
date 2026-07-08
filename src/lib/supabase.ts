import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// When env vars are absent the app runs in local-only mode: everything is
// stored in IndexedDB on this device and the outbox waits until Supabase
// is configured.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const isCloudConfigured = supabase !== null
