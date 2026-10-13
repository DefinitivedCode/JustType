import { calculateMetrics, consistency, elapsedMs } from './statistics'
import type { Mode, Sample, TestState } from './types'

export function createTest(mode: Mode, target: string): TestState {
  if (!/^[a-z]+(?: [a-z]+)*$/.test(target)) throw new Error('Target must contain English words separated by single spaces')
  return {
    mode: { ...mode }, status: 'ready', target, input: '',
    startedAt: null, endedAt: null, updatedAt: 0,
    correctCharacters: 0, correctInputs: 0, totalInputs: 0, correctedErrors: 0,
    events: [], samples: [], result: null,
  }
}

function snapshot(state: TestState, at: number): Sample {
  return {
    at: at / 1000,
    ...calculateMetrics(state.correctCharacters, state.totalInputs, state.correctInputs, at),
    totalInputs: state.totalInputs,
    errors: state.totalInputs - state.correctInputs,
  }
}

function finish(state: TestState, endedAt: number): TestState {
  if (state.status !== 'running') return state
  const durationMs = Math.max(0, endedAt - state.startedAt!)
  const last = state.samples.at(-1)
  const finalSample = snapshot(state, durationMs)
  const samples = last?.at === finalSample.at
    ? [...state.samples.slice(0, -1), finalSample]
    : [...state.samples, finalSample]
  return {
    ...state, status: 'finished', updatedAt: endedAt, endedAt, samples,
    result: {
      mode: { ...state.mode }, durationMs,
      ...calculateMetrics(state.correctCharacters, state.totalInputs, state.correctInputs, durationMs),
      correctCharacters: state.correctCharacters,
      incorrectCharacters: state.input.length - state.correctCharacters,
      totalInputs: state.totalInputs,
      incorrectInputs: state.totalInputs - state.correctInputs,
      correctedErrors: state.correctedErrors,
      consistency: consistency(samples),
      samples, events: state.events,
    },
  }
}

/** Call before every input and on the rendering clock. Exact elapsed time,
 * never interval counts, determines completion. Late ticks retain the deadline.
 * No inputs occur between updates, so overdue sample boundaries use the last
 * known counts without interpolating or inventing typing activity. */
export function advance(state: TestState, now: number): TestState {
  if (state.status !== 'running') return state
  const deadline = state.mode.kind === 'time' ? state.startedAt! + state.mode.value * 1000 : Infinity
  const updatedAt = Math.min(deadline, Math.max(now, state.updatedAt))
  let next = { ...state, updatedAt }
  const elapsed = elapsedMs(next)
  const samples = [...state.samples]
  let boundary = (Math.floor(samples.at(-1)?.at ?? 0) + 1) * 1000
  while (boundary <= elapsed) {
    samples.push(snapshot(next, boundary))
    boundary += 1000
  }
  if (samples.length !== state.samples.length) next = { ...next, samples }
  return updatedAt >= deadline ? finish(next, deadline) : next
}

export function insertCharacter(state: TestState, character: string, now: number): TestState {
  if (!/^[a-zA-Z ]$/.test(character) || state.status === 'finished') return state
  let next = advance(state, now)
  if (next.status === 'finished' || next.input.length >= next.target.length) return next
  if (next.status === 'ready') {
    next = { ...next, status: 'running', startedAt: now, updatedAt: now, samples: [snapshot(next, 0)] }
  }
  const position = next.input.length
  const correct = next.target[position] === character
  next = {
    ...next, input: next.input + character,
    totalInputs: next.totalInputs + 1,
    correctInputs: next.correctInputs + Number(correct),
    correctCharacters: next.correctCharacters + Number(correct),
    events: [...next.events, { kind: 'insert', character, correct, position, at: elapsedMs(next) }],
  }
  return next.mode.kind === 'words' && next.input.length === next.target.length
    ? finish(next, next.updatedAt)
    : next
}

export function backspace(state: TestState, now: number): TestState {
  const next = advance(state, now)
  if (next.status !== 'running' || !next.input.length) return next
  const position = next.input.length - 1
  const character = next.input[position]!
  const correct = next.target[position] === character
  return {
    ...next, input: next.input.slice(0, -1),
    correctCharacters: next.correctCharacters - Number(correct),
    correctedErrors: next.correctedErrors + Number(!correct),
    events: [...next.events, { kind: 'delete', character, correct, position, at: elapsedMs(next) }],
  }
}

/** Append only in timed tests. Existing positions and snapshots remain intact. */
export function appendWords(state: TestState, words: readonly string[]): TestState {
  if (state.mode.kind !== 'time' || state.status === 'finished' || words.length === 0) return state
  if (words.some((word) => !/^[a-z]+$/.test(word))) throw new Error('Invalid appended word')
  return { ...state, target: `${state.target} ${words.join(' ')}` }
}
