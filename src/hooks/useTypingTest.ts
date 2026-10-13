import { useCallback, useEffect, useRef, useState } from 'react'
import { advance, appendWords, backspace, createTest, insertCharacter } from '../lib/typingEngine'
import { generateTarget, generateWords } from '../lib/wordGenerator'
import { getPersonalBest, loadMode, saveMode, savePersonalBest } from '../lib/storage'
import type { Mode, TestState } from '../lib/types'
import { useKeyboardFeedback } from './useKeyboardFeedback'
import { feedbackKey, ReplayRecorder } from '../lib/replay'
import type { Recording } from '../lib/replay'

export function useTypingTest() {
  const [state, setState] = useState(() => {
    const mode = loadMode()
    return createTest(mode, generateTarget(mode))
  })
  const engine = useRef(state)
  const [session, setSession] = useState(0)
  const [isPersonalBest, setIsPersonalBest] = useState(false)
  const [personalBest, setPersonalBest] = useState(() => getPersonalBest(state.mode))
  const { feedback, flash, hold, release, clear } = useKeyboardFeedback()
  const recorder = useRef(new ReplayRecorder())
  const [recording, setRecording] = useState<Recording | null>(null)

  const publish = useCallback((next: TestState) => {
    if (next === engine.current) return
    if (next.result && engine.current.status !== 'finished') {
      setRecording(recorder.current.finish(next.target, next.result.durationMs))
      clear()
      setIsPersonalBest(savePersonalBest(next.result))
      setPersonalBest(getPersonalBest(next.mode))
    }
    engine.current = next
    setState(next)
  }, [clear])

  const restart = useCallback((mode: Mode = engine.current.mode) => {
    clear()
    recorder.current = new ReplayRecorder()
    setRecording(null)
    saveMode(mode)
    setIsPersonalBest(false)
    setPersonalBest(getPersonalBest(mode))
    publish(createTest(mode, generateTarget(mode)))
    setSession((current) => current + 1)
  }, [clear, publish])

  const changeInput = useCallback((value: string) => {
    let next = engine.current
    if (next.status === 'finished' || document.activeElement?.id !== 'typing-input') return
    const now = performance.now()
    let common = 0
    while (common < next.input.length && common < value.length && next.input[common] === value[common]) common++
    while (next.input.length > common) {
      const edited = backspace(next, now)
      if (edited.events.length > next.events.length) {
        recorder.current.edit(edited.events.at(-1)!, edited.input, edited.startedAt!)
        flash('Backspace', true)
      }
      if (edited === next || edited.status === 'finished') { next = edited; break }
      next = edited
    }
    for (const character of value.slice(common)) {
      if (next.status === 'finished') break
      if (next.mode.kind === 'time' && next.target.length - next.input.length < 80) {
        next = appendWords(next, generateWords(60, undefined, next.target.split(' ').slice(-10)))
      }
      const edited = insertCharacter(next, character, now)
      if (edited.totalInputs > next.totalInputs) {
        const event = edited.events.at(-1)!
        recorder.current.edit(event, edited.input, edited.startedAt!)
        flash(character, event.correct)
      }
      next = edited
    }
    publish(next)
  }, [flash, publish])

  const keyDown = useCallback((key: string, code: string, repeat: boolean) => {
    if (!feedbackKey(key)) return
    const now = performance.now()
    publish(advance(engine.current, now))
    if (engine.current.status === 'finished') return
    recorder.current.keyDown(key, code, repeat, now, engine.current.status)
    hold(key)
    if (key === 'Backspace' && engine.current.status === 'running') flash(key, true)
  }, [flash, hold, publish])

  const keyUp = useCallback((key: string, code: string) => {
    const now = performance.now()
    publish(advance(engine.current, now))
    if (engine.current.status !== 'finished') recorder.current.keyUp(key, code, now)
    release(key)
  }, [publish, release])

  const blurInput = useCallback(() => {
    recorder.current.blur(performance.now())
    clear()
  }, [clear])

  useEffect(() => {
    window.addEventListener('blur', blurInput)
    return () => window.removeEventListener('blur', blurInput)
  }, [blurInput])

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

  return { state, session, restart, changeInput, keyDown, keyUp, blurInput, feedback, recording, isPersonalBest, personalBest }
}
