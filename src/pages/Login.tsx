import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    setInfo(null)
    const { error: err } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (err) setError(err.message)
    else if (mode === 'signup') setInfo('Account created. If email confirmation is enabled, check your inbox, then sign in.')
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand" style={{ marginBottom: 16, fontSize: 22 }}>
          Voice<span style={{ color: 'var(--accent-strong)' }}>Task</span>
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
        </div>
        {error && <p className="error-text">{error}</p>}
        {info && <p className="small" style={{ color: 'var(--success)' }}>{info}</p>}
        <button className="btn" style={{ width: '100%', marginTop: 4 }} disabled={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <p className="small muted" style={{ marginTop: 14, textAlign: 'center' }}>
          {mode === 'signin' ? (
            <>First time? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup') }}>Create your account</a></>
          ) : (
            <>Already registered? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signin') }}>Sign in</a></>
          )}
        </p>
      </form>
    </div>
  )
}
