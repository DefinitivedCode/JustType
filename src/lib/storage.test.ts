import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPersonalBest, loadMode, loadTheme, saveMode, savePersonalBest, saveTheme } from './storage'
import type { TestResult } from './types'

let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
})
afterEach(() => vi.unstubAllGlobals())
const result = (wpm = 50): TestResult => ({ mode: { kind: 'time', value: 15 }, wpm, accuracy: 98, rawWpm: 51, durationMs: 15000, correctCharacters: 62, incorrectCharacters: 1, totalInputs: 64, incorrectInputs: 1, correctedErrors: 0, consistency: 80, samples: [], events: [] })

describe('validated local preferences and records', () => {
  it('falls back safely from malformed or incompatible values', () => {
    for (const value of ['broken', '{}', 'null', '{"kind":"time","value":999}', '{"kind":"words","value":"10"}']) {
      data.set('justtype.mode.v1', value)
      expect(loadMode()).toEqual({ kind: 'time', value: 15 })
    }
    data.set('justtype.theme.v1', '"unknown"')
    expect(loadTheme()).toBe('light')
  })
  it('persists supported mode and theme preferences', () => {
    saveMode({ kind: 'words', value: 50 })
    expect(loadMode()).toEqual({ kind: 'words', value: 50 })
    for (const theme of ['light', 'dark'] as const) {
      saveTheme(theme)
      expect(loadTheme()).toBe(theme)
    }
  })
  it('keeps the highest record separately for each mode', () => {
    expect(savePersonalBest(result())).toBe(true)
    expect(savePersonalBest(result(49))).toBe(false)
    expect(savePersonalBest(result(50))).toBe(false)
    expect(savePersonalBest(result(60))).toBe(true)
    expect(getPersonalBest({ kind: 'time', value: 15 })?.wpm).toBe(60)
    expect(getPersonalBest({ kind: 'words', value: 10 })).toBeNull()
  })
  it('rejects invalid records and sub-second tests', () => {
    data.set('justtype.bests.v1', JSON.stringify({ 'time:15': { wpm: 40, accuracy: 200, date: 'not a date' }, 'words:999': { wpm: 50, accuracy: 100, date: new Date().toISOString() } }))
    expect(getPersonalBest({ kind: 'time', value: 15 })).toBeNull()
    expect(savePersonalBest(result(Infinity))).toBe(false)
    expect(savePersonalBest({ ...result(), durationMs: 200 })).toBe(false)
  })
  it('works when browser storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } })
    expect(loadMode()).toEqual({ kind: 'time', value: 15 })
    expect(loadTheme()).toBe('light')
    expect(() => saveMode({ kind: 'time', value: 10 })).not.toThrow()
    expect(() => savePersonalBest(result())).not.toThrow()
  })
})
