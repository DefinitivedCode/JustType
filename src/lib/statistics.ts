import type { Metrics, Sample, TestState } from './types'

export function elapsedMs(state: TestState): number {
  if (state.startedAt === null) return 0
  return Math.max(0, (state.endedAt ?? state.updatedAt) - state.startedAt)
}

export function calculateMetrics(correct: number, total: number, correctInputs: number, durationMs: number): Metrics {
  // Standard five-character words. Backspaces aren't typing inputs.
  const factor = durationMs > 0 ? 12000 / durationMs : 0
  return {
    wpm: correct * factor,
    rawWpm: total * factor,
    // Historical keystroke accuracy deliberately retains corrected mistakes.
    accuracy: total > 0 ? (correctInputs / total) * 100 : 100,
  }
}

export function liveMetrics(state: TestState): Metrics {
  return calculateMetrics(state.correctCharacters, state.totalInputs, state.correctInputs, elapsedMs(state))
}

/** 100 * (1 - population standard deviation / mean) of interval raw WPM,
 * clamped to 0–100. Partial intervals are duration-weighted. At least two
 * intervals are required; very short tests report unavailable, never invented. */
export function consistency(samples: readonly Sample[]): number | null {
  const intervals: { rate: number; weight: number }[] = []
  for (let i = 1; i < samples.length; i++) {
    const prior = samples[i - 1]!
    const current = samples[i]!
    const duration = current.at - prior.at
    if (duration > 0) intervals.push({ rate: ((current.totalInputs - prior.totalInputs) * 12) / duration, weight: duration })
  }
  if (intervals.length < 2) return null
  const weight = intervals.reduce((sum, item) => sum + item.weight, 0)
  const mean = intervals.reduce((sum, item) => sum + item.rate * item.weight, 0) / weight
  if (mean === 0) return null
  const variance = intervals.reduce((sum, item) => sum + (item.rate - mean) ** 2 * item.weight, 0) / weight
  return Math.max(0, Math.min(100, 100 * (1 - Math.sqrt(variance) / mean)))
}

export function completedWords(state: TestState): number {
  if (state.input.length === state.target.length) return state.target.split(' ').length
  return state.input.split(' ').length - 1
}
