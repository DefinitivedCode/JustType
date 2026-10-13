import { describe, expect, it } from 'vitest'
import { advance, appendWords, backspace, createTest, insertCharacter } from './typingEngine'
import { elapsedMs, liveMetrics } from './statistics'
import type { TestState } from './types'

const timed = (target = 'the quick brown fox') => createTest({ kind: 'time', value: 15 }, target)
function type(state: TestState, text: string, start = 0, step = 100): TestState {
  return [...text].reduce((next, character, index) => insertCharacter(next, character, start + index * step), state)
}

describe('typing state machine', () => {
  it('starts only on valid actual input', () => {
    const ready = timed()
    expect(advance(ready, 10000)).toBe(ready)
    expect(backspace(ready, 10000)).toBe(ready)
    for (const key of ['Enter', '\t', '1', '.', '\n', '']) expect(insertCharacter(ready, key, 10000)).toBe(ready)
    const state = insertCharacter(ready, 't', 1234)
    expect(state.status).toBe('running')
    expect(state.startedAt).toBe(1234)
    expect(elapsedMs(state)).toBe(0)
  })

  it('tracks correct and incorrect input at exact character positions', () => {
    const state = type(timed(), 'txe ')
    expect(state.input).toBe('txe ')
    expect(state.correctCharacters).toBe(3)
    expect(state.correctInputs).toBe(3)
    expect(state.totalInputs).toBe(4)
    expect(state.events.map((event) => [event.position, event.correct])).toEqual([[0, true], [1, false], [2, true], [3, true]])
  })

  it('handles spaces as real correct or incorrect typing positions', () => {
    expect(type(timed('a b'), 'a b').correctCharacters).toBe(3)
    const state = type(timed('a b'), 'aab')
    expect(state.events[1]).toMatchObject({ character: 'a', correct: false, position: 1 })
    expect(insertCharacter(timed(), ' ', 0).events[0]?.correct).toBe(false)
  })

  it('corrects visible mistakes while preserving historical accuracy', () => {
    let state = insertCharacter(createTest({ kind: 'words', value: 10 }, 'ab'), 'x', 0)
    state = backspace(state, 250)
    expect(state.correctedErrors).toBe(1)
    expect(state.input).toBe('')
    state = insertCharacter(state, 'a', 500)
    state = insertCharacter(state, 'b', 1000)
    expect(state.result?.correctCharacters).toBe(2)
    expect(state.result?.incorrectCharacters).toBe(0)
    expect(state.result?.totalInputs).toBe(3)
    expect(state.result?.accuracy).toBeCloseTo(200 / 3)
    expect(state.result?.wpm).toBe(24)
    expect(state.result?.rawWpm).toBe(36)
  })

  it('removes correct characters from net speed but not historical events', () => {
    const state = backspace(type(timed(), 'th'), 1000)
    expect(state.correctCharacters).toBe(1)
    expect(state.correctInputs).toBe(2)
    expect(state.totalInputs).toBe(2)
    expect(state.correctedErrors).toBe(0)
    expect(state.input).toBe('t')
    expect(liveMetrics(state).wpm).toBe(12)
    expect(liveMetrics(state).rawWpm).toBe(24)
    expect(state.events.at(-1)?.kind).toBe('delete')
  })

  it('does not backspace beyond zero or start a test with backspace', () => {
    const ready = timed()
    expect(backspace(ready, 10)).toBe(ready)
    let state = backspace(insertCharacter(ready, 't', 0), 10)
    state = backspace(state, 20)
    expect(state.input).toBe('')
    expect(state.correctCharacters).toBe(0)
    expect(state.status).toBe('running')
  })

  it('finishes a word test at the exact final position, even with errors', () => {
    let state = type(createTest({ kind: 'words', value: 10 }, 'ab cd'), 'ab x')
    expect(state.status).toBe('running')
    state = insertCharacter(state, 'd', 1000)
    expect(state.status).toBe('finished')
    expect(state.result).toMatchObject({ correctCharacters: 4, incorrectCharacters: 1, durationMs: 1000 })
    expect(insertCharacter(state, 'a', 2000)).toBe(state)
    expect(backspace(state, 2000)).toBe(state)
    expect(advance(state, 2000)).toBe(state)
  })

  it('never finishes a timed test when initial text is exhausted', () => {
    let state = type(timed('ab'), 'ab')
    expect(state.status).toBe('running')
    expect(insertCharacter(state, 'c', 200).status).toBe('running')
    state = appendWords(state, ['cat', 'dog'])
    state = insertCharacter(state, ' ', 300)
    expect(state.target).toBe('ab cat dog')
    expect(state.input).toBe('ab ')
    expect(state.events.at(-1)?.correct).toBe(true)
  })

  it('does not append to word tests or finished tests', () => {
    const state = createTest({ kind: 'words', value: 10 }, 'ab')
    expect(appendWords(state, ['cat'])).toBe(state)
    const finished = advance(insertCharacter(timed(), 't', 0), 15000)
    expect(appendWords(finished, ['cat'])).toBe(finished)
    expect(() => appendWords(timed(), ['not a word'])).toThrow()
  })

  it('uses a monotonic deadline even when the rendering clock is late', () => {
    const started = insertCharacter(timed(), 't', 1000)
    expect(advance(started, 15999).status).toBe('running')
    const finished = advance(started, 200000)
    expect(finished.status).toBe('finished')
    expect(finished.endedAt).toBe(16000)
    expect(finished.result?.durationMs).toBe(15000)
    expect(finished.samples).toHaveLength(16)
    expect(finished.samples.at(-1)?.at).toBe(15)
  })

  it('rejects input at or after the deadline', () => {
    const started = insertCharacter(timed(), 't', 0)
    const finished = insertCharacter(started, 'h', 15000)
    expect(finished.status).toBe('finished')
    expect(finished.input).toBe('t')
    expect(finished.totalInputs).toBe(1)
  })

  it('ignores backward timestamps', () => {
    const started = insertCharacter(timed(), 't', 1000)
    expect(elapsedMs(advance(started, 900))).toBe(0)
    const state = advance(started, 2000)
    expect(advance(state, 1500).updatedAt).toBe(2000)
  })

  it('preserves real historical chart samples after correction', () => {
    let state = type(timed(), 'tx', 0, 100)
    state = advance(state, 1000)
    const sample = { ...state.samples[1]! }
    state = backspace(state, 1100)
    state = insertCharacter(state, 'h', 1200)
    state = advance(state, 2000)
    expect(state.samples[1]).toEqual(sample)
    expect(state.samples[1]?.errors).toBe(1)
    expect(state.samples[2]?.totalInputs).toBe(3)
    expect(state.events.filter((event) => event.kind === 'insert' && !event.correct)).toHaveLength(1)
  })

  it('captures overdue boundaries before a late input instead of assigning it to the past', () => {
    let state = insertCharacter(timed(), 't', 0)
    state = insertCharacter(state, 'h', 3100)
    expect(state.samples.map((sample) => sample.totalInputs)).toEqual([0, 1, 1, 1])
    expect(state.events.at(-1)?.at).toBe(3100)
  })

  it('fully resets every field on restart with a new target', () => {
    const prior = advance(type(timed(), 'tx'), 15000)
    const restarted = createTest(prior.mode, 'new fresh words')
    expect(restarted).toMatchObject({ status: 'ready', input: '', startedAt: null, endedAt: null, result: null, totalInputs: 0, correctInputs: 0, correctedErrors: 0, correctCharacters: 0, updatedAt: 0, events: [], samples: [] })
    expect(restarted.target).not.toBe(prior.target)
  })

  it('handles rapid repeated input without stale positions or lost events', () => {
    const target = 'a'.repeat(2000)
    const state = type(createTest({ kind: 'time', value: 120 }, target), target, 0, 0.5)
    expect(state.totalInputs).toBe(2000)
    expect(state.correctCharacters).toBe(2000)
    expect(state.events.at(-1)?.position).toBe(1999)
    expect(state.status).toBe('running')
    expect(state.input).toBe(target)
  })

  it('keeps previous states immutable', () => {
    const prior = type(timed(), 't')
    const serialized = JSON.stringify(prior)
    const next = insertCharacter(prior, 'h', 1000)
    backspace(next, 2000)
    appendWords(next, ['new'])
    expect(JSON.stringify(prior)).toBe(serialized)
  })

  it('handles zero-duration word tests without NaN or Infinity', () => {
    const state = type(createTest({ kind: 'words', value: 10 }, 'a'), 'a', 0, 0)
    expect(state.result?.wpm).toBe(0)
    expect(state.result?.rawWpm).toBe(0)
    expect(state.result?.accuracy).toBe(100)
    expect(state.result?.consistency).toBeNull()
  })
})
