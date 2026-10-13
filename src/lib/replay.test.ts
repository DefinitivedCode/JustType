import { describe, expect, it } from 'vitest'
import { backspace, createTest, insertCharacter } from './typingEngine'
import { advanceReplay, createReplayTimeline, getReplayStateAtTime, KEY_FEEDBACK_MS, ReplayRecorder, seekReplay } from './replay'
import type { Recording, ReplayMotion } from './replay'

function session() {
  const recorder = new ReplayRecorder()
  let engine = createTest({ kind: 'time', value: 15 }, 'earth moon')
  const press = (key: string, at: number, repeat = false) => {
    recorder.keyDown(key, key === 'Backspace' ? 'Backspace' : `Key${key.toUpperCase()}`, repeat, 1000 + at, engine.status)
    const previousCount = engine.events.length
    engine = key === 'Backspace' ? backspace(engine, 1000 + at) : insertCharacter(engine, key, 1000 + at)
    const event = engine.events.at(-1)
    if (event && engine.events.length > previousCount) recorder.edit(event, engine.input, engine.startedAt!)
  }
  const release = (key: string, at: number) => recorder.keyUp(key, key === 'Backspace' ? 'Backspace' : `Key${key.toUpperCase()}`, 1000 + at)
  const finish = (durationMs = 2000) => recorder.finish(engine.target, durationMs)
  return { recorder, press, release, finish }
}

function correction() {
  const test = session()
  test.press('e', 0); test.release('e', 40)
  test.press('r', 300); test.release('r', 380)
  test.press('Backspace', 700); test.release('Backspace', 750)
  test.press('a', 1100); test.release('a', 1500)
  return createReplayTimeline(test.finish())
}

const motion = (overrides: Partial<ReplayMotion> = {}): ReplayMotion => ({ time: 0, target: 0, speed: 1, playing: true, seek: null, ...overrides })

describe('session recording', () => {
  it('records actual keys, edits, correctness, caret positions, and monotonic timestamps', () => {
    const test = session()
    test.press('e', 0); test.release('e', 60)
    test.press('r', 300); test.release('r', 400)
    const recording = test.finish()
    expect(recording.target).toBe('earth moon')
    expect(recording.events.map((event) => event.at)).toEqual([0, 0, 60, 300, 300, 400])
    expect(recording.events[0]).toMatchObject({ kind: 'keydown', key: 'e', code: 'KeyE', correct: true, source: 'keyboard' })
    expect(recording.events[3]).toMatchObject({ kind: 'keydown', key: 'r', correct: false })
    expect(recording.events[4]).toMatchObject({ kind: 'edit', input: 'er', caret: 2, position: 1 })
  })

  it('records deleted characters and their original correctness', () => {
    const events = correction().recording.events
    expect(events.find((event) => event.kind === 'edit' && event.operation === 'delete')).toMatchObject({
      at: 700, character: 'r', correct: false, input: 'e', caret: 1, position: 1,
    })
    expect(events.find((event) => event.kind === 'keydown' && event.key === 'Backspace')).toMatchObject({ correct: null })
  })

  it('records Backspace at an empty cursor as a real key press without inventing a deletion', () => {
    const test = session()
    test.press('e', 0)
    test.press('Backspace', 200); test.release('Backspace', 240)
    test.press('Backspace', 500); test.release('Backspace', 550)
    const timeline = createReplayTimeline(test.finish())
    expect(timeline.edits).toHaveLength(2)
    expect(getReplayStateAtTime(timeline, 600)).toMatchObject({ input: '', caret: 0, feedback: { backspace: { correct: true } } })
  })

  it('ignores unrelated keys and never records a test that has not started', () => {
    const recorder = new ReplayRecorder()
    recorder.keyDown('e', 'KeyE', false, 0, 'ready')
    recorder.keyUp('e', 'KeyE', 50)
    recorder.keyDown('Escape', 'Escape', false, 100, 'running')
    recorder.keyDown('x', 'KeyX', false, 200, 'finished')
    expect(recorder.finish('earth moon', 0).events).toEqual([])
  })

  it('records actual mobile input operations without inventing physical keyups', () => {
    const recorder = new ReplayRecorder()
    let state = createTest({ kind: 'time', value: 10 }, 'a b')
    for (const [index, character] of [...'a b'].entries()) {
      state = insertCharacter(state, character, 1000 + index * 100)
      recorder.edit(state.events.at(-1)!, state.input, state.startedAt!)
    }
    const timeline = createReplayTimeline(recorder.finish(state.target, 1000))
    expect(timeline.recording.events.filter((event) => event.kind === 'keydown').map((event) => event.source)).toEqual(['input', 'input', 'input'])
    expect(getReplayStateAtTime(timeline, 120)).toMatchObject({ input: 'a ', caret: 2, feedback: { ' ': { correct: true } } })
  })

  it('never reuses a consumed physical keydown for a later input-only character', () => {
    const recorder = new ReplayRecorder()
    let state = createTest({ kind: 'time', value: 10 }, 'earth moon')
    recorder.keyDown('e', 'KeyE', false, 1000, state.status)
    state = insertCharacter(state, 'e', 1000)
    recorder.edit(state.events.at(-1)!, state.input, state.startedAt!)
    state = insertCharacter(state, 'e', 1100)
    recorder.edit(state.events.at(-1)!, state.input, state.startedAt!)
    const presses = recorder.finish(state.target, 2000).events.filter((event) => event.kind === 'keydown')
    expect(presses).toMatchObject([{ source: 'keyboard', key: 'e', correct: true }, { source: 'input', key: 'e', correct: false }])
    expect(presses[0]!.id).not.toBe(presses[1]!.id)
  })

  it('releases held keys on blur, preserves order, and finishes with an independent copy', () => {
    const test = session()
    test.press('e', 0)
    test.recorder.blur(1500)
    const recording = test.finish()
    test.press('a', 700)
    expect(recording.events).toHaveLength(3)
    expect(recording.events[2]).toMatchObject({ kind: 'keyup', at: 500, source: 'blur' })
    expect(getReplayStateAtTime(createReplayTimeline(recording), 501).feedback).toEqual({})
  })
})

describe('deterministic bidirectional reconstruction', () => {
  it('reconstructs the same text and caret at any timestamp in any seek order', () => {
    const timeline = correction()
    for (const at of [1400, 400, 800, 1, 2000, 0, 800, 1400]) {
      const expected = at === 0 ? '' : at < 300 ? 'e' : at < 700 ? 'er' : at < 1100 ? 'e' : 'ea'
      expect(getReplayStateAtTime(timeline, at)).toMatchObject({ input: expected, caret: expected.length })
    }
  })

  it('reverses each edit, restoring the deleted mistake when crossing Backspace', () => {
    const timeline = correction()
    expect([1400, 800, 400, 1, 0].map((at) => getReplayStateAtTime(timeline, at).input)).toEqual(['ea', 'e', 'er', 'e', ''])
    expect([0, 1, 400, 800, 1400].map((at) => getReplayStateAtTime(timeline, at).input)).toEqual(['', 'e', 'er', 'e', 'ea'])
  })

  it('illuminates the actual incorrect key, never the expected letter', () => {
    const state = getReplayStateAtTime(correction(), 350)
    expect(state.feedback.r?.correct).toBe(false)
    expect(state.feedback.a).toBeUndefined()
    expect(state.input).toBe('er')
  })

  it('rewinds key presses and releases together with the text', () => {
    const timeline = correction()
    expect([900, 800, 699, 500, 400, 299].map((at) => Object.keys(getReplayStateAtTime(timeline, at).feedback))).toEqual([
      [], ['backspace'], [], [], ['r'], [],
    ])
    expect(getReplayStateAtTime(timeline, 800).input).toBe('e')
    expect(getReplayStateAtTime(timeline, 400).input).toBe('er')
  })

  it('preserves longer physical holds and provides a consistent fallback', () => {
    const timeline = correction()
    expect(getReplayStateAtTime(timeline, 1400).feedback.a).toBeDefined()
    expect(getReplayStateAtTime(timeline, 1500).feedback.a).toBeUndefined()
    const test = session()
    test.press('e', 0)
    const fallback = createReplayTimeline(test.finish())
    expect(getReplayStateAtTime(fallback, KEY_FEEDBACK_MS - 1).feedback.e).toBeDefined()
    expect(getReplayStateAtTime(fallback, KEY_FEEDBACK_MS).feedback.e).toBeUndefined()
  })

  it('reproduces physical keyup timing while retaining the original brief colour feedback', () => {
    const timeline = correction()
    expect(getReplayStateAtTime(timeline, 20).feedback.e).toMatchObject({ pressed: true })
    expect(getReplayStateAtTime(timeline, 40).feedback.e).toMatchObject({ pressed: false, correct: true })
    expect(getReplayStateAtTime(timeline, 179).feedback.e).toMatchObject({ pressed: false })
    expect(getReplayStateAtTime(timeline, 180).feedback.e).toBeUndefined()
  })

  it('handles repeated held-key presses with their own correctness and release timing', () => {
    const test = session()
    test.press('e', 0)
    test.press('e', 100, true)
    test.release('e', 500)
    const timeline = createReplayTimeline(test.finish())
    expect(getReplayStateAtTime(timeline, 50).feedback.e).toMatchObject({ correct: true, sequence: 1 })
    expect(getReplayStateAtTime(timeline, 150).feedback.e).toMatchObject({ correct: false, sequence: 2 })
    expect(getReplayStateAtTime(timeline, 499).feedback.e).toBeDefined()
    expect(getReplayStateAtTime(timeline, 500).feedback.e).toBeUndefined()
    expect(getReplayStateAtTime(timeline, 150).input).toBe('ee')
  })

  it('keeps a physical key held across a repeat arriving after the fallback duration', () => {
    const test = session()
    test.press('e', 0)
    test.press('e', 500, true)
    test.release('e', 1000)
    const timeline = createReplayTimeline(test.finish())
    expect(getReplayStateAtTime(timeline, 400).feedback.e).toMatchObject({ correct: true, pressed: true })
    expect(getReplayStateAtTime(timeline, 900).feedback.e).toMatchObject({ correct: false, pressed: true })
    expect(getReplayStateAtTime(timeline, 1000).feedback.e).toBeUndefined()
  })

  it('supports spaces, uppercase mistakes, overlapping keys, and rapid bursts', () => {
    const recorder = new ReplayRecorder()
    let state = createTest({ kind: 'time', value: 120 }, 'a b')
    for (const [index, character] of [...'A b'].entries()) {
      recorder.keyDown(character, character === ' ' ? 'Space' : `Key${character.toUpperCase()}`, false, 1000 + index * 10, state.status)
      state = insertCharacter(state, character, 1000 + index * 10)
      recorder.edit(state.events.at(-1)!, state.input, state.startedAt!)
    }
    const timeline = createReplayTimeline(recorder.finish(state.target, 120000))
    expect(getReplayStateAtTime(timeline, 30)).toMatchObject({ input: 'A b', feedback: { a: { correct: false }, ' ': { correct: true }, b: { correct: true } } })
    expect(getReplayStateAtTime(timeline, 500).feedback).toEqual({})
  })

  it('supports empty and zero-duration recordings and releases the final key', () => {
    const empty: Recording = { target: 'earth moon', durationMs: 0, events: [] }
    expect(getReplayStateAtTime(createReplayTimeline(empty), 500)).toEqual({ input: '', caret: 0, feedback: {} })
    const test = session()
    test.press('e', 0)
    const timeline = createReplayTimeline(test.finish(0))
    expect(timeline.endMs).toBe(KEY_FEEDBACK_MS)
    expect(getReplayStateAtTime(timeline, 1).input).toBe('e')
    expect(getReplayStateAtTime(timeline, timeline.endMs).feedback).toEqual({})
  })

  it('seeks through thousands of events without re-running the typing engine', () => {
    const recorder = new ReplayRecorder()
    const text = Array(500).fill('earth').join(' ')
    let state = createTest({ kind: 'time', value: 120 }, text)
    for (const [index, character] of [...text].entries()) {
      state = insertCharacter(state, character, 1000 + index * 30)
      recorder.edit(state.events.at(-1)!, state.input, state.startedAt!)
    }
    const timeline = createReplayTimeline(recorder.finish(text, 120000))
    for (const index of [2000, 25, 1500, 1, 2500, 100]) {
      expect(getReplayStateAtTime(timeline, index * 30 + 1).input).toBe(text.slice(0, index + 1))
    }
  })
})

describe('playback clock and responsive scrubbing', () => {
  it('plays forwards at the original rhythm and finishes at the release tail', () => {
    const timeline = correction()
    const next = advanceReplay(motion(), 400, 400, timeline.endMs)
    expect(next.time).toBe(400)
    expect(getReplayStateAtTime(timeline, next.time).input).toBe('er')
    expect(advanceReplay(next, 2500, 2100, timeline.endMs)).toMatchObject({ time: timeline.endMs, playing: false })
  })

  it('does not advance when paused and resumes from the same position', () => {
    const paused = motion({ time: 500, target: 500, playing: false })
    expect(advanceReplay(paused, 20000, 20000, 15000)).toBe(paused)
    expect(advanceReplay({ ...paused, playing: true }, 20100, 100, 15000).time).toBe(600)
  })

  it.each([0.5, 1, 1.5, 2])('advances at %s× without changing recorded events', (speed) => {
    expect(advanceReplay(motion({ speed, time: 100 }), 1000, 200, 15000).time).toBe(100 + 200 * speed)
  })

  it('traverses a large backward seek smoothly and settles within 180ms', () => {
    const seek = seekReplay(motion({ time: 120000 }), 0, 1000, 120000)
    const halfway = advanceReplay(seek, 1090, 90, 120000)
    expect(halfway).toMatchObject({ time: 60000, target: 0, playing: false })
    expect(advanceReplay(halfway, 1180, 90, 120000)).toMatchObject({ time: 0, seek: null })
  })

  it('changes direction repeatedly from the current visual position without a seek queue', () => {
    let current = motion({ time: 1400 })
    for (const target of [0, 2000, 300, 1800, 0, 2000]) {
      current = seekReplay(current, target, 1000, 2000)
      const halfway = advanceReplay(current, 1040, 40, 2000)
      expect(halfway.time).toBeGreaterThanOrEqual(Math.min(current.time, target))
      expect(halfway.time).toBeLessThanOrEqual(Math.max(current.time, target))
      current = advanceReplay(halfway, 1200, 160, 2000)
      expect(current).toMatchObject({ time: target, target, seek: null, playing: false })
    }
  })

  it('reverses direction midway through an unfinished drag animation', () => {
    const first = seekReplay(motion({ time: 1400 }), 0, 1000, 2000)
    const backwards = advanceReplay(first, 1030, 30, 2000)
    const reversed = seekReplay(backwards, 2000, 1030, 2000)
    expect(reversed.time).toBe(backwards.time)
    const forwards = advanceReplay(reversed, 1060, 30, 2000)
    expect(forwards.time).toBeGreaterThan(backwards.time)
    const reversedAgain = seekReplay(forwards, 300, 1060, 2000)
    expect(advanceReplay(reversedAgain, 1240, 180, 2000)).toMatchObject({ time: 300, target: 300, seek: null })
  })

  it('crosses real keyboard and edit boundaries when seeking across a long idle gap', () => {
    const source = correction().recording
    const timeline = createReplayTimeline({ ...source, durationMs: 120000 })
    const seek = seekReplay(motion({ time: 120000 }), 0, 1000, 120000, timeline)
    const states = Array.from({ length: 12 }, (_, index) => {
      const next = advanceReplay(seek, 1000 + index * 16, 16, timeline.endMs)
      return getReplayStateAtTime(timeline, next.time)
    })
    expect(states.some((state) => state.input === 'er' && state.feedback.r?.correct === false)).toBe(true)
    expect(states.some((state) => state.input === 'e' && state.feedback.backspace)).toBe(true)
    expect(advanceReplay(seek, 1180, 16, timeline.endMs).time).toBe(0)
  })

  it('clamps seeks at either endpoint and restart has no stale seek', () => {
    expect(seekReplay(motion(), -100, 0, 2000).target).toBe(0)
    expect(seekReplay(motion(), 5000, 0, 2000).target).toBe(2000)
    const restarted = motion()
    expect(advanceReplay(restarted, 100, 100, 2000).time).toBe(100)
  })
})
