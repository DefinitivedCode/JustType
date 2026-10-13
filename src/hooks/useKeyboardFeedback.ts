import { useCallback, useEffect, useRef, useState } from 'react'

export type Feedback = Record<string, { correct: boolean; sequence: number }>

export function useKeyboardFeedback() {
  const [feedback, setFeedback] = useState<Feedback>({})
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const sequence = useRef(0)
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
    setFeedback({})
  }, [])
  const flash = useCallback((character: string, correct: boolean) => {
    const key = character.toLowerCase()
    if (!/^[a-z ]$/.test(key)) return
    clearTimeout(timers.current.get(key))
    const id = ++sequence.current
    setFeedback((current) => ({ ...current, [key]: { correct, sequence: id } }))
    timers.current.set(key, setTimeout(() => {
      setFeedback((current) => {
        if (current[key]?.sequence !== id) return current
        const next = { ...current }
        delete next[key]
        return next
      })
      timers.current.delete(key)
    }, 180))
  }, [])
  useEffect(() => {
    const currentTimers = timers.current
    window.addEventListener('blur', clear)
    return () => {
      currentTimers.forEach(clearTimeout)
      window.removeEventListener('blur', clear)
    }
  }, [clear])
  return { feedback, flash, clear }
}
