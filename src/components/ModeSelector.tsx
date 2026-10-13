import { Clock3, TextCursorInput } from 'lucide-react'
import { TIME_OPTIONS, WORD_OPTIONS } from '../lib/types'
import type { Mode } from '../lib/types'

export function ModeSelector({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="mode-selector" aria-label="Test configuration">
      <div className="mode-kinds" role="group" aria-label="Test type">
        <button id="mode-time" className={mode.kind === 'time' ? 'selected' : ''} aria-pressed={mode.kind === 'time'} onClick={() => onChange({ kind: 'time', value: 15 })}>
          <Clock3 size={15} /><span>time</span>
        </button>
        <button id="mode-words" className={mode.kind === 'words' ? 'selected' : ''} aria-pressed={mode.kind === 'words'} onClick={() => onChange({ kind: 'words', value: 25 })}>
          <TextCursorInput size={16} /><span>words</span>
        </button>
      </div>
      <span className="mode-divider" aria-hidden="true" />
      <div className="mode-options" role="group" aria-label={mode.kind === 'time' ? 'Test duration' : 'Word count'}>
        {(mode.kind === 'time' ? TIME_OPTIONS : WORD_OPTIONS).map((value) => (
          <button key={value} className={mode.value === value ? 'selected' : ''} aria-pressed={mode.value === value}
            aria-label={`${value} ${mode.kind === 'time' ? 'seconds' : 'words'}`}
            onClick={() => onChange(mode.kind === 'time' ? { kind: 'time', value: value as (typeof TIME_OPTIONS)[number] } : { kind: 'words', value: value as (typeof WORD_OPTIONS)[number] })}>
            {value}<span className="option-unit">{mode.kind === 'time' ? 's' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
