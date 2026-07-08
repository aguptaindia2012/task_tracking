import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions)
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { [i: number]: { isFinal: boolean } & ArrayLike<{ transcript: string }> } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

export const speechSupported = typeof window !== 'undefined' && getRecognitionCtor() !== null

export type ListenState = 'idle' | 'listening' | 'error'

export function useSpeech(onFinal: (transcript: string) => void) {
  const [listenState, setListenState] = useState<ListenState>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError('Speech recognition is not supported in this browser. Use Chrome on Android or desktop.')
      setListenState('error')
      return
    }
    const rec = new Ctor()
    recRef.current = rec
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous = false

    rec.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      setInterim(interimText || finalText)
      if (finalText.trim()) {
        onFinalRef.current(finalText.trim())
      }
    }
    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setListenState('idle')
        return
      }
      setError(
        event.error === 'not-allowed'
          ? 'Microphone access was denied. Allow the microphone in your browser settings.'
          : `Speech error: ${event.error}`,
      )
      setListenState('error')
    }
    rec.onend = () => {
      setListenState((s) => (s === 'error' ? s : 'idle'))
      setInterim('')
    }

    setError(null)
    setInterim('')
    setListenState('listening')
    rec.start()
  }, [])

  useEffect(() => () => recRef.current?.abort(), [])

  return { start, stop, listenState, interim, error }
}

// Speak a confirmation out loud so the driver never has to look at the screen.
export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.05
  window.speechSynthesis.speak(utterance)
}
