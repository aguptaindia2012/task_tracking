import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome/Edge fire `beforeinstallprompt` once the PWA is installable. We stash
// the event so the app can trigger the native install dialog from its own button.
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt() {
  const [available, setAvailable] = useState(deferred !== null)
  const [installed, setInstalled] = useState(typeof window !== 'undefined' && isStandalone())

  useEffect(() => {
    const update = () => {
      setAvailable(deferred !== null)
      setInstalled(isStandalone())
    }
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const choice = await deferred.userChoice
    deferred = null
    listeners.forEach((l) => l())
    return choice.outcome
  }

  return { available, installed, promptInstall }
}
