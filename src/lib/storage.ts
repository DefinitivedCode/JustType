import { DEFAULT_MODE, isMode } from './types'
import type { Mode, TestResult, Theme } from './types'

const KEYS = { mode: 'justtype.mode.v1', theme: 'justtype.theme.v1', bests: 'justtype.bests.v1' }
export interface PersonalBest { wpm: number; accuracy: number; date: string }
type Bests = Record<string, PersonalBest>

function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown } catch { return null }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage is optional, including in private browsing. */ }
}
export function loadMode(): Mode { const value = read(KEYS.mode); return isMode(value) ? value : DEFAULT_MODE }
export function saveMode(mode: Mode): void { write(KEYS.mode, mode) }
export function loadTheme(): Theme { return read(KEYS.theme) === 'dark' ? 'dark' : 'light' }
export function saveTheme(theme: Theme): void { write(KEYS.theme, theme) }
export function modeKey(mode: Mode): string { return `${mode.kind}:${mode.value}` }

function loadBests(): Bests {
  const value = read(KEYS.bests)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const bests: Bests = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!/^(time:(10|15|30|60|120)|words:(10|25|50|100))$/.test(key)) continue
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    if (typeof item.wpm === 'number' && Number.isFinite(item.wpm) && item.wpm > 0 &&
      typeof item.accuracy === 'number' && Number.isFinite(item.accuracy) && item.accuracy >= 0 && item.accuracy <= 100 &&
      typeof item.date === 'string' && Number.isFinite(Date.parse(item.date))) {
      bests[key] = { wpm: item.wpm, accuracy: item.accuracy, date: item.date }
    }
  }
  return bests
}
export function getPersonalBest(mode: Mode): PersonalBest | null { return loadBests()[modeKey(mode)] ?? null }
export function savePersonalBest(result: TestResult): boolean {
  if (!Number.isFinite(result.wpm) || result.wpm <= 0 || result.durationMs < 1000) return false
  const bests = loadBests()
  const key = modeKey(result.mode)
  if (bests[key] && bests[key].wpm >= result.wpm) return false
  bests[key] = { wpm: result.wpm, accuracy: result.accuracy, date: new Date().toISOString() }
  write(KEYS.bests, bests)
  return true
}
