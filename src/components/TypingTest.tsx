import { useLayoutEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { TestState } from '../lib/types'
import type { Feedback } from '../hooks/useKeyboardFeedback'
import { LiveStats } from './LiveStats'
import { TypingText } from './TypingText'
import { VirtualKeyboard } from './VirtualKeyboard'

interface Props {
  state: TestState
  session: number
  feedback: Feedback
  changeInput: (value: string) => void
  restart: () => void
}

export function TypingTest({ state, session, feedback, changeInput, restart }: Props) {
  const input = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const restartButton = useRef<HTMLButtonElement>(null)
  const [focused, setFocused] = useState(false)
  const [armed, setArmed] = useState(false)
  const [compositionDraft, setCompositionDraft] = useState<string | null>(null)

  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true })
    setArmed(false)
    composing.current = false
    setCompositionDraft(null)
  }, [session])

  return (
    <section className="test-screen" aria-label="Typing test" data-status={state.status}>
      <LiveStats state={state} />
      <div className="typing-surface" onClick={() => input.current?.focus({ preventScroll: true })}>
        <label className="sr-only" htmlFor="typing-input">Type the displayed words</label>
        <p id="typing-target" className="sr-only">Words to type: {state.target}</p>
        <textarea id="typing-input" ref={input} className="typing-input" value={compositionDraft ?? state.input}
          aria-describedby="typing-instructions typing-target" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          inputMode="text" enterKeyHint="next"
          onFocus={() => { setFocused(true); input.current?.setSelectionRange(state.input.length, state.input.length) }}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            if (composing.current) setCompositionDraft(event.target.value)
            else changeInput(event.target.value)
            event.target.setSelectionRange(event.target.value.length, event.target.value.length)
          }}
          onCompositionStart={(event) => { composing.current = true; setCompositionDraft(event.currentTarget.value) }}
          onCompositionEnd={(event) => { composing.current = false; setCompositionDraft(null); changeInput(event.currentTarget.value) }}
          onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === 'Tab' && !event.shiftKey) {
              event.preventDefault()
              setArmed(true)
              restartButton.current?.focus()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              document.getElementById(`mode-${state.mode.kind}`)?.focus()
            } else if (['Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
              event.preventDefault()
            }
          }} />
        <TypingText target={state.target} input={state.input} focused={focused} running={state.status === 'running'} />
        {!focused && !armed && <div className="focus-prompt">Click here to focus</div>}
      </div>
      <div className="typing-message" id="typing-instructions">
        {armed ? <span className="armed-hint">Press <kbd>enter</kbd> for a fresh test</span> : !focused ? 'Your test keeps its place.' : state.status === 'ready' ? 'Start typing to begin.' : <span className="running-hint">One word at a time.</span>}
        <span className="sr-only">Type letters and spaces. Backspace corrects a character. Escape goes to controls. Tab focuses restart; Enter restarts. Shift Tab navigates to the mode controls.</span>
      </div>
      <VirtualKeyboard feedback={feedback} />
      <div className="restart-controls">
        <button ref={restartButton} className="restart-button" aria-label="Restart test" onClick={restart} onBlur={() => setArmed(false)} title="Restart test (Tab then Enter)"><RotateCcw size={18} /></button>
        <span className="shortcut-hint"><kbd>tab</kbd><span>+</span><kbd>enter</kbd><span>restart test</span></span>
      </div>
      <div className="test-bottom-note"><span><kbd>esc</kbd> controls</span><span className="note-dot">·</span><span>no rush. just type.</span></div>
    </section>
  )
}
