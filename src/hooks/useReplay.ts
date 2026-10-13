import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { advanceReplay, createReplayTimeline, getReplayStateAtTime, seekReplay } from '../lib/replay'
import type { Recording, ReplayMotion } from '../lib/replay'

export function useReplay(recording: Recording) {
  const timeline = useMemo(() => createReplayTimeline(recording), [recording])
  const [view, setView] = useState<ReplayMotion>(() => ({ time: 0, target: 0, playing: timeline.endMs > 0, speed: 1, seek: null }))
  const motion = useRef(view)
  const frameId = useRef<number | null>(null)
  const lastNow = useRef(0)

  const frame = useCallback(function tick(now: number) {
    motion.current = advanceReplay(motion.current, now, now - lastNow.current, timeline.endMs)
    lastNow.current = now
    setView(motion.current)
    frameId.current = motion.current.playing || motion.current.seek ? requestAnimationFrame(tick) : null
  }, [timeline])

  const startClock = useCallback(() => {
    if (frameId.current !== null) cancelAnimationFrame(frameId.current)
    frameId.current = null
    lastNow.current = performance.now()
    setView(motion.current)
    if (motion.current.playing || motion.current.seek) frameId.current = requestAnimationFrame(frame)
  }, [frame])

  useEffect(() => {
    startClock()
    return () => { if (frameId.current !== null) cancelAnimationFrame(frameId.current) }
  }, [startClock])

  const pause = useCallback(() => {
    const now = performance.now()
    motion.current = { ...advanceReplay(motion.current, now, now - lastNow.current, timeline.endMs), playing: false }
    startClock()
  }, [startClock, timeline])

  const toggle = useCallback(() => {
    if (motion.current.playing) { pause(); return }
    const time = motion.current.time >= timeline.endMs ? 0 : motion.current.time
    motion.current = { ...motion.current, time, target: time, seek: null, playing: true }
    startClock()
  }, [pause, startClock, timeline])

  const restart = useCallback(() => {
    motion.current = { ...motion.current, time: 0, target: 0, seek: null, playing: timeline.endMs > 0 }
    startClock()
  }, [startClock, timeline])

  const seek = useCallback((target: number) => {
    motion.current = seekReplay(motion.current, target, performance.now(), recording.durationMs, timeline)
    startClock()
  }, [recording.durationMs, startClock, timeline])

  const setSpeed = useCallback((speed: number) => {
    const now = performance.now()
    motion.current = { ...advanceReplay(motion.current, now, now - lastNow.current, timeline.endMs), speed }
    startClock()
  }, [startClock, timeline])

  const state = useMemo(() => getReplayStateAtTime(timeline, view.time), [timeline, view.time])
  return { ...view, state, pause, toggle, restart, seek, setSpeed }
}
