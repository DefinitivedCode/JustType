import { useCallback, useEffect, useRef, useState } from 'react'
import { feedbackKey, KEY_FEEDBACK_MS } from '../lib/replay'

export type Feedback = Record<string, { correct: boolean; sequence: number; pressed: boolean }>

export function useKeyboardFeedback() {
  const [feedback, setFeedback] = useState<Feedback>({})
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const sequence = useRef(0)
  const held = useRef(new Set<string>())
  const pressedAt = useRef(new Map<string, number>())
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
    held.current.clear()
    pressedAt.current.clear()
    setFeedback({})
  }, [])
  const flash = useCallback((character: string, correct: boolean) => {
    const key = feedbackKey(character)
    if (!key) return
    clearTimeout(timers.current.get(key))
    const id = ++sequence.current
    pressedAt.current.set(key, performance.now())
    setFeedback((current) => ({ ...current, [key]: { correct, sequence: id, pressed: true } }))
    timers.current.set(key, setTimeout(() => {
      if (held.current.has(key)) return
      setFeedback((current) => {
        if (current[key]?.sequence !== id) return current
        const next = { ...current }
        delete next[key]
        return next
      })
      timers.current.delete(key)
    }, KEY_FEEDBACK_MS))
  }, [])
  const hold = useCallback((character: string) => {
    const key = feedbackKey(character)
    if (key) held.current.add(key)
  }, [])
  const release = useCallback((character: string) => {
    const key = feedbackKey(character)
    if (!key) return
    held.current.delete(key)
    if (performance.now() - (pressedAt.current.get(key) ?? Infinity) >= KEY_FEEDBACK_MS) {
      clearTimeout(timers.current.get(key))
      timers.current.delete(key)
      setFeedback((current) => { const next = { ...current }; delete next[key]; return next })
    } else {
      setFeedback((current) => current[key] ? { ...current, [key]: { ...current[key], pressed: false } } : current)
    }
  }, [])
  useEffect(() => {
    const currentTimers = timers.current
    return () => {
      currentTimers.forEach(clearTimeout)
    }
  }, [])
  return { feedback, flash, hold, release, clear }
}
