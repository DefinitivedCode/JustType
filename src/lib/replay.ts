import type { Feedback } from '../hooks/useKeyboardFeedback'
import type { Status, TypingEvent } from './types'

export const KEY_FEEDBACK_MS = 180

export interface ReplayPress {
  kind: 'keydown'
  at: number
  id: number
  key: string
  code: string
  repeat: boolean
  correct: boolean | null
  source: 'keyboard' | 'input'
}
export interface ReplayRelease {
  kind: 'keyup'
  at: number
  pressId: number
  source: 'keyboard' | 'blur'
}
export interface ReplayEdit {
  kind: 'edit'
  at: number
  pressId: number
  operation: TypingEvent['kind']
  character: string
  correct: boolean
  position: number
  input: string
  caret: number
}
export type ReplayEvent = ReplayPress | ReplayRelease | ReplayEdit
export interface Recording {
  target: string
  durationMs: number
  events: readonly ReplayEvent[]
}

export function feedbackKey(key: string): string | null {
  if (key === 'Backspace') return 'backspace'
  return /^[a-zA-Z ]$/.test(key) ? key.toLowerCase() : null
}

/** Owned by one typing session. Only the focused textarea calls these methods.
 * Edits come from accepted engine operations, never from the final input.
 * Touch/IME input without physical key events gets explicit input-source presses. */
export class ReplayRecorder {
  private events: ReplayEvent[] = []
  private startedAt: number | null = null
  private sequence = 0
  private held = new Map<string, ReplayPress>()
  private pending: { key: string; code: string; repeat: boolean; now: number } | null = null

  private time(now: number) {
    return Math.max(0, now - this.startedAt!, this.events.at(-1)?.at ?? 0)
  }

  keyDown(key: string, code: string, repeat: boolean, now: number, status: Status) {
    if (!feedbackKey(key) || status === 'finished') return
    if (status === 'ready') { this.pending = { key, code, repeat, now }; return }
    this.press(key, code, repeat, this.time(now), 'keyboard')
  }

  private press(key: string, code: string, repeat: boolean, at: number, source: ReplayPress['source']) {
    const press: ReplayPress = { kind: 'keydown', at, id: ++this.sequence, key, code, repeat, correct: null, source }
    this.events.push(press)
    if (source === 'keyboard') this.held.set(code || key, press)
    return press
  }

  edit(event: TypingEvent, input: string, startedAt: number) {
    if (this.startedAt === null) {
      this.startedAt = startedAt
      if (this.pending && event.kind === 'insert' && feedbackKey(this.pending.key) === feedbackKey(event.character)) {
        const { key, code, repeat, now } = this.pending
        this.press(key, code, repeat, Math.max(0, now - startedAt), 'keyboard')
      }
      this.pending = null
    }
    const key = event.kind === 'delete' ? 'Backspace' : event.character
    const physical = [...this.held.values()].reverse().find((press) => feedbackKey(press.key) === feedbackKey(key) &&
      (event.kind === 'delete' || press.correct === null))
    const at = Math.max(event.at, this.events.at(-1)?.at ?? 0)
    const press = physical ?? this.press(key, '', false, at, 'input')
    if (event.kind === 'insert') press.correct = event.correct
    this.events.push({ kind: 'edit', at, pressId: press.id, operation: event.kind,
      character: event.character, correct: event.correct, position: event.position, input, caret: input.length })
  }

  keyUp(key: string, code: string, now: number) {
    if (this.startedAt === null) { this.pending = null; return }
    const token = code || key
    const press = this.held.get(token)
    if (!press) return
    this.events.push({ kind: 'keyup', at: this.time(now), pressId: press.id, source: 'keyboard' })
    this.held.delete(token)
  }

  blur(now: number) {
    if (this.startedAt !== null) {
      for (const press of this.held.values()) {
        this.events.push({ kind: 'keyup', at: this.time(now), pressId: press.id, source: 'blur' })
      }
    }
    this.held.clear()
    this.pending = null
  }

  finish(target: string, durationMs: number): Recording {
    const recording = { target, durationMs, events: this.events.filter((event) => event.at <= durationMs).map((event) => ({ ...event })) }
    this.held.clear()
    this.pending = null
    return recording
  }
}

interface KeyInterval { start: number; end: number; releaseAt: number; hasRelease: boolean; physical: boolean; correct: boolean; sequence: number }
export interface ReplayTimeline {
  recording: Recording
  edits: readonly ReplayEdit[]
  keys: ReadonlyMap<string, readonly KeyInterval[]>
  boundaries: readonly number[]
  /** A brief release tail lets the final key return to neutral after completion.
   * The slider and time readout still represent the original test duration. */
  endMs: number
}

/** Compile once. Edit snapshots and per-key intervals allow O(log n) seeking
 * in either direction, including overlapping holds and repeated keydowns. */
export function createReplayTimeline(recording: Recording): ReplayTimeline {
  const releases = new Map<number, number>()
  for (const event of recording.events) if (event.kind === 'keyup') releases.set(event.pressId, event.at)
  const keys = new Map<string, KeyInterval[]>()
  let endMs = recording.durationMs
  for (const event of recording.events) {
    if (event.kind !== 'keydown') continue
    const key = feedbackKey(event.key)
    if (!key) continue
    const intervals = keys.get(key) ?? []
    const previous = intervals.at(-1)
    if (previous) {
      if (event.repeat && previous.physical && !previous.hasRelease) {
        // A repeat proves the same physical key was held between keydowns.
        previous.end = event.at
        previous.releaseAt = event.at
      } else previous.end = Math.min(previous.end, event.at)
    }
    const releaseAt = releases.get(event.id) ?? event.at + KEY_FEEDBACK_MS
    const end = Math.max(event.at + KEY_FEEDBACK_MS, releaseAt)
    intervals.push({ start: event.at, end, releaseAt, hasRelease: releases.has(event.id), physical: event.source === 'keyboard', correct: event.correct ?? true, sequence: event.id })
    keys.set(key, intervals)
    endMs = Math.max(endMs, end)
  }
  const boundaries = [...new Set([0, recording.durationMs, ...recording.events.map((event) => event.at),
    ...[...keys.values()].flatMap((intervals) => intervals.map((interval) => Math.min(interval.end, recording.durationMs)))])].sort((a, b) => a - b)
  return { recording, keys, boundaries, endMs, edits: recording.events.filter((event): event is ReplayEdit => event.kind === 'edit') }
}

function lastAtOrBefore<T>(items: readonly T[], time: number, timestamp: (item: T) => number): T | undefined {
  let low = 0
  let high = items.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (timestamp(items[mid]!) <= time) low = mid + 1
    else high = mid
  }
  return items[low - 1]
}

export function getReplayStateAtTime(timeline: ReplayTimeline, time: number) {
  const at = Math.max(0, Math.min(time, timeline.endMs))
  // Zero is the untouched beginning, before the first input at timestamp zero.
  const edit = at === 0 ? undefined : lastAtOrBefore(timeline.edits, at, (event) => event.at)
  const feedback: Feedback = {}
  for (const [key, intervals] of timeline.keys) {
    const interval = lastAtOrBefore(intervals, at, (entry) => entry.start)
    if (interval && at > 0 && at < interval.end) feedback[key] = { correct: interval.correct, sequence: interval.sequence, pressed: at < interval.releaseAt }
  }
  return { input: edit?.input ?? '', caret: edit?.caret ?? 0, feedback }
}

export interface ReplayMotion {
  time: number
  target: number
  playing: boolean
  speed: number
  seek: { from: number; to: number; startedAt: number; duration: number; stops?: readonly number[] } | null
}
export function seekReplay(motion: ReplayMotion, target: number, now: number, duration: number, timeline?: ReplayTimeline): ReplayMotion {
  const to = Math.max(0, Math.min(target, duration))
  const between = timeline?.boundaries.filter((at) => at > Math.min(motion.time, to) && at < Math.max(motion.time, to))
  if (to < motion.time) between?.reverse()
  // Cross actual actions instead of spending the whole transition on an idle
  // gap and then skipping a short burst of typing in the last animation frame.
  const stops = between ? [motion.time, ...between, to] : undefined
  const transitionMs = Math.min(180, Math.max(60, Math.abs(to - motion.time) / 20, ((stops?.length ?? 2) - 1) * 16))
  return { ...motion, playing: false, target: to,
    seek: { from: motion.time, to, startedAt: now, duration: transitionMs, stops } }
}
/** One clock and one state model for forward playback and bidirectional seeks.
 * A large seek traverses elapsed time in at most 180ms, never building a backlog. */
export function advanceReplay(motion: ReplayMotion, now: number, delta: number, endMs: number): ReplayMotion {
  if (motion.seek) {
    const progress = Math.min(1, Math.max(0, (now - motion.seek.startedAt) / motion.seek.duration))
    const stops = motion.seek.stops ?? [motion.seek.from, motion.seek.to]
    const position = progress * (stops.length - 1)
    const index = Math.min(Math.floor(position), stops.length - 2)
    const time = stops[index]! + (stops[index + 1]! - stops[index]!) * (position - index)
    return { ...motion, time, seek: progress === 1 ? null : motion.seek }
  }
  if (!motion.playing) return motion
  const time = Math.min(endMs, motion.time + Math.max(0, delta) * motion.speed)
  return { ...motion, time, target: time, playing: time < endMs }
}
