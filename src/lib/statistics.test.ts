import { describe, expect, it } from 'vitest'
import { calculateMetrics, completedWords, consistency, elapsedMs } from './statistics'
import { createTest, insertCharacter } from './typingEngine'
import type { Sample } from './types'

const sample = (at: number, totalInputs: number): Sample => ({ at, totalInputs, wpm: 0, rawWpm: 0, errors: 0 })
describe('statistics', () => {
  it('uses the five-character WPM convention and historical accuracy', () => {
    expect(calculateMetrics(250, 300, 270, 60000)).toEqual({ wpm: 50, rawWpm: 60, accuracy: 90 })
    expect(calculateMetrics(25, 30, 27, 15000)).toEqual({ wpm: 20, rawWpm: 24, accuracy: 90 })
  })
  it('handles zero duration and zero inputs', () => {
    expect(calculateMetrics(0, 0, 0, 0)).toEqual({ wpm: 0, rawWpm: 0, accuracy: 100 })
    expect(calculateMetrics(5, 5, 5, 0).wpm).toBe(0)
    expect(elapsedMs(createTest({ kind: 'time', value: 10 }, 'a'))).toBe(0)
  })
  it('scores constant interval speed at 100 percent', () => {
    expect(consistency([sample(0, 0), sample(1, 5), sample(2, 10), sample(3, 15)])).toBe(100)
  })
  it('scores highly uneven intervals lower and clamps at zero', () => {
    expect(consistency([sample(0, 0), sample(1, 0), sample(2, 10)])).toBe(0)
    expect(consistency([sample(0, 0), sample(1, 0), sample(2, 0), sample(3, 30)])).toBe(0)
  })
  it('weights partial intervals by duration', () => {
    expect(consistency([sample(0, 0), sample(1, 4), sample(1.5, 6)])).toBe(100)
  })
  it('reports unavailable with insufficient, zero-length, or empty samples', () => {
    expect(consistency([])).toBeNull()
    expect(consistency([sample(0, 0), sample(0.5, 2)])).toBeNull()
    expect(consistency([sample(0, 0), sample(0, 0), sample(1, 5)])).toBeNull()
    expect(consistency([sample(0, 0), sample(1, 0), sample(2, 0)])).toBeNull()
  })
  it('counts word progress only after separators or the final character', () => {
    let state = createTest({ kind: 'words', value: 10 }, 'a b')
    expect(completedWords(state)).toBe(0)
    state = insertCharacter(state, 'a', 0)
    expect(completedWords(state)).toBe(0)
    state = insertCharacter(state, ' ', 100)
    expect(completedWords(state)).toBe(1)
    state = insertCharacter(state, 'b', 200)
    expect(completedWords(state)).toBe(2)
  })
})
