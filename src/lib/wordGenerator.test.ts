import { describe, expect, it } from 'vitest'
import { generateTarget, generateWords } from './wordGenerator'
import { ENGLISH_WORDS } from '../data/englishWords'
import { WORD_OPTIONS } from './types'

describe('local word generation', () => {
  it('has a sizeable, unique, lowercase word bank', () => {
    expect(ENGLISH_WORDS.length).toBeGreaterThan(500)
    expect(new Set(ENGLISH_WORDS).size).toBe(ENGLISH_WORDS.length)
    expect(ENGLISH_WORDS.every((word) => /^[a-z]+$/.test(word))).toBe(true)
  })
  it.each(WORD_OPTIONS)('generates exactly %i words', (value) => {
    expect(generateTarget({ kind: 'words', value }).split(' ')).toHaveLength(value)
  })
  it('avoids repeats within a shuffled bag', () => {
    const words = generateWords(100)
    expect(new Set(words).size).toBe(100)
  })
  it('accepts a deterministic RNG and leaves the bank unchanged', () => {
    const before = [...ENGLISH_WORDS]
    expect(generateWords(10, () => 0.5)).toEqual(generateWords(10, () => 0.5))
    expect(ENGLISH_WORDS).toEqual(before)
  })
  it('avoids recent words when appending and handles multiple bags', () => {
    const recent = ENGLISH_WORDS.slice(0, 10)
    const words = generateWords(ENGLISH_WORDS.length * 2, () => 0.3, [...recent])
    expect(words).toHaveLength(ENGLISH_WORDS.length * 2)
    expect(words.slice(0, 10).every((word) => !recent.includes(word))).toBe(true)
    words.forEach((word, index) => expect(words.slice(Math.max(0, index - 10), index)).not.toContain(word))
    expect(recent).toEqual(ENGLISH_WORDS.slice(0, 10))
  })
  it('rejects invalid counts and supports zero', () => {
    expect(generateWords(0)).toEqual([])
    for (const count of [-1, 0.5, NaN, Infinity]) expect(() => generateWords(count)).toThrow(RangeError)
  })
})
