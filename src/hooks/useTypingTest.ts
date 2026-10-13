import { useCallback, useEffect, useRef, useState } from 'react'
import { advance, appendWords, backspace, createTest, insertCharacter } from '../lib/typingEngine'
import { generateTarget, generateWords } from '../lib/wordGenerator'
import { getPersonalBest, loadMode, saveMode, savePersonalBest } from '../lib/storage'
import type { Mode, TestState } from '../lib/types'
import { useKeyboardFeedback } from './useKeyboardFeedback'

export function useTypingTest() {
  const [state, setState] = useState(() => {
    const mode = loadMode()
    return createTest(mode, generateTarget(mode))
  })
  const engine = useRef(state)
  const [session, setSession] = useState(0)
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const [personalBest, setPersonalBest] = useState(() => getPersonalBest(state.mode))
  const { feedback, flash, clear } = useKeyboardFeedback()

  const publish = useCallback((next: TestState) => {
    if (next === engine.current) return
    if (next.result && engine.current.status !== 'finished') {
      setIsPersonalBest(savePersonalBest(next.result))
      setPersonalBest(getPersonalBest(next.mode))
    }
    engine.current = next
    setState(next)
  }, [])

  const restart = useCallback((mode: Mode = engine.current.mode) => {
    clear()
    saveMode(mode)
    setIsPersonalBest(false)
    setPersonalBest(getPersonalBest(mode))
    publish(createTest(mode, generateTarget(mode)))
    setSession((current) => current + 1)
  }, [clear, publish])

  const changeInput = useCallback((value: string) => {
    let next = engine.current
    if (next.status === 'finished') return
    const now = performance.now()
    let common = 0
    while (common < next.input.length && common < value.length && next.input[common] === value[common]) common++
    while (next.input.length > common) {
      const edited = backspace(next, now)
      if (edited === next || edited.status === 'finished') { next = edited; break }
      next = edited
    }
    for (const character of value.slice(common)) {
      if (next.status === 'finished') break
      if (next.mode.kind === 'time' && next.target.length - next.input.length < 80) {
        next = appendWords(next, generateWords(60, undefined, next.target.split(' ').slice(-10)))
      }
      const edited = insertCharacter(next, character, now)
      if (edited.totalInputs > next.totalInputs) flash(character, edited.events.at(-1)!.correct)
      next = edited
    }
    publish(next)
  }, [flash, publish])

  useEffect(() => {
    if (state.status !== 'running') return
    const tick = () => publish(advance(engine.current, performance.now()))
    const timer = window.setInterval(tick, 50)
    // Browsers may throttle background tabs. Re-check the monotonic deadline
    // on visibility/focus and before input; time is never paused by blur.
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [state.status, publish])

  return { state, session, restart, changeInput, feedback, isPersonalBest, personalBest }
}
