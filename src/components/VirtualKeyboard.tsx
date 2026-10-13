import { memo } from 'react'
import { Delete } from 'lucide-react'
import type { Feedback } from '../hooks/useKeyboardFeedback'

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
export const VirtualKeyboard = memo(function VirtualKeyboard({ feedback }: { feedback: Feedback }) {
  const keycap = (character: string) => {
    const active = feedback[character]
    return (
      <span key={character} className={`keycap${character === ' ' ? ' spacebar' : character === 'backspace' ? ' backspace-key' : ''}`} data-key={character === ' ' ? 'space' : character} data-pressed={active?.pressed ?? false} data-tone={active ? active.correct ? 'correct' : 'incorrect' : 'neutral'}>
        {active && <span key={active.sequence} className={`key-flash ${active.correct ? 'correct' : 'incorrect'}`} />}
        <span className="key-label">{character === ' ' ? <span className="spacebar-mark" /> : character === 'backspace' ? <Delete size={15} /> : character.toUpperCase()}</span>
      </span>
    )
  }
  return (
    <div className="virtual-keyboard" aria-hidden="true">
      {ROWS.map((row) => <div className="keyboard-row" key={row}>{[...row].map(keycap)}</div>)}
      <div className="keyboard-row">{keycap(' ')}{keycap('backspace')}</div>
    </div>
  )
})
