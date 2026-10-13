export const TIME_OPTIONS = [10, 15, 30, 60, 120] as const
export const WORD_OPTIONS = [10, 25, 50, 100] as const
export type Mode =
  | { kind: 'time'; value: (typeof TIME_OPTIONS)[number] }
  | { kind: 'words'; value: (typeof WORD_OPTIONS)[number] }
export const DEFAULT_MODE: Mode = { kind: 'time', value: 15 }
export type Theme = 'dark' | 'light'
export type Status = 'ready' | 'running' | 'finished'

export interface TypingEvent {
  kind: 'insert' | 'delete'
  character: string
  correct: boolean
  position: number
  /** Milliseconds from the first accepted input. */
  at: number
}

export interface Sample {
  /** Seconds from the first accepted input. */
  at: number
  wpm: number
  rawWpm: number
  totalInputs: number
  errors: number
}

export interface Metrics {
  wpm: number
  rawWpm: number
  accuracy: number
}

export interface TestResult extends Metrics {
  mode: Mode
  durationMs: number
  correctCharacters: number
  incorrectCharacters: number
  totalInputs: number
  incorrectInputs: number
  correctedErrors: number
  consistency: number | null
  samples: Sample[]
  events: TypingEvent[]
}

export interface TestState {
  mode: Mode
  status: Status
  target: string
  input: string
  startedAt: number | null
  endedAt: number | null
  updatedAt: number
  correctCharacters: number
  correctInputs: number
  totalInputs: number
  correctedErrors: number
  events: TypingEvent[]
  samples: Sample[]
  result: TestResult | null
}

export function isMode(value: unknown): value is Mode {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    (candidate.kind === 'time' && TIME_OPTIONS.some((n) => n === candidate.value)) ||
    (candidate.kind === 'words' && WORD_OPTIONS.some((n) => n === candidate.value))
  )
}

export function modeLabel(mode: Mode): string {
  return mode.kind === 'time' ? `${mode.value} seconds` : `${mode.value} words`
}
