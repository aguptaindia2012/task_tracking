import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, isCloudConfigured } from './lib/supabase'
import { sync } from './lib/store'
import { useStore } from './hooks/useStore'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import Login from './pages/Login'
import Board from './pages/Board'
import TaskDetail from './pages/TaskDetail'
import Timeline from './pages/Timeline'
import Notes from './pages/Notes'
import Extract from './pages/Extract'
import Driving from './pages/Driving'
import Settings from './pages/Settings'
import Archived from './pages/Archived'

const SYNC_LABELS = {
  'local-only': 'Local only',
  synced: 'Synced',
  pending: 'Pending sync',
  syncing: 'Syncing…',
  error: 'Sync error',
} as const

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isCloudConfigured)
  const { syncState, pendingCount } = useStore()
  const { available: canInstall, promptInstall } = useInstallPrompt()
  const location = useLocation()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
      if (data.session) void sync()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) void sync()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!authReady) return null
  if (isCloudConfigured && !session) return <Login />

  // Driving mode takes over the whole screen — no chrome.
  if (location.pathname === '/drive') {
    return (
      <Routes>
        <Route path="/drive" element={<Driving />} />
      </Routes>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Voice<span>Task</span>
        </div>
        <nav className="nav">
          <NavLink to="/">Board</NavLink>
          <NavLink to="/timeline">Timeline</NavLink>
          <NavLink to="/notes">Notes</NavLink>
          <NavLink to="/extract">✨ Extract</NavLink>
          <NavLink to="/drive">🎙 Drive</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <NavLink to="/archived">Archived</NavLink>
        </nav>
        {canInstall && (
          <button className="btn sm" onClick={() => void promptInstall()} title="Install this app on your device">
            ⬇ Install app
          </button>
        )}
        <span className={`sync-badge ${syncState}`} title="Cloud sync status">
          {SYNC_LABELS[syncState]}
          {pendingCount > 0 && ` (${pendingCount})`}
        </span>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Board />} />
          <Route path="/task/:id" element={<TaskDetail />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/extract" element={<Extract />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/archived" element={<Archived />} />
        </Routes>
      </main>
    </div>
  )
}
