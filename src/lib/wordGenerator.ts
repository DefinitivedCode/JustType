import { ENGLISH_WORDS } from '../data/englishWords'
import type { Mode } from './types'

export function random(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000
  }
  return Math.random()
}

/** Fisher–Yates bags avoid repeats within a bag, and a recent-word window
 * avoids repeats across generation/appending boundaries. RNG is injectable. */
export function generateWords(count: number, rng = random, previous: string[] = []): string[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid word count')
  const words: string[] = []
  const recent = previous.slice(-10)
  const initialRecent = new Set(recent)
  while (words.length < count) {
    const bag = [...ENGLISH_WORDS]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))))
      ;[bag[i], bag[j]] = [bag[j]!, bag[i]!]
    }
    for (const word of bag) {
      if (recent.includes(word) || (words.length < 10 && initialRecent.has(word))) continue
      words.push(word)
      recent.push(word)
      if (recent.length > 10) recent.shift()
      if (words.length === count) break
    }
  }
  return words
}

export function generateTarget(mode: Mode): string {
  return generateWords(mode.kind === 'words' ? mode.value : 80).join(' ')
}
