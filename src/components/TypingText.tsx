import { memo, useLayoutEffect, useMemo, useRef } from 'react'

const Word = memo(function Word({ text, start, input }: { text: string; start: number; input: string }) {
  return <span className="typing-word">{[...text].map((character, index) => {
    const typed = input[index]
    const state = typed === undefined ? 'untyped' : typed === character ? 'correct' : 'incorrect'
    return <span key={index} data-position={start + index} className={`character ${state}${character === ' ' ? ' space-character' : ''}`}>{character}</span>
  })}</span>
})

export const TypingText = memo(function TypingText({ target, input, focused, running }: { target: string; input: string; focused: boolean; running: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const words = useMemo(() => {
    let start = 0
    return target.split(' ').map((word, index, all) => {
      const text = word + (index < all.length - 1 ? ' ' : '')
      const entry = { text, start }
      start += text.length
      return entry
    })
  }, [target])

  useLayoutEffect(() => {
    const root = viewport.current!
    const text = content.current!
    const positionCaret = () => {
      const position = Math.min(input.length, target.length - 1)
      const character = text.querySelector<HTMLElement>(`[data-position="${position}"]`)
      if (!character) return
      const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight)
      const y = character.offsetTop
      const offset = Math.max(0, Math.floor(y / lineHeight) - 1) * lineHeight
      const x = character.offsetLeft + (input.length === target.length ? character.offsetWidth : 0)
      root.style.setProperty('--caret-x', `${x}px`)
      root.style.setProperty('--caret-y', `${y - offset + 4}px`)
      root.style.setProperty('--text-offset', `${-offset}px`)
    }
    positionCaret()
    const observer = new ResizeObserver(positionCaret)
    observer.observe(root)
    return () => observer.disconnect()
  }, [input.length, target])

  return (
    <div ref={viewport} className={`typing-viewport${focused ? ' focused' : ''}`} aria-hidden="true">
      <div ref={content} className="typing-text" data-testid="typing-text" data-target={target}>
        {words.map(({ text, start }) => <Word key={start} text={text} start={start} input={input.slice(start, start + text.length)} />)}
      </div>
      <span className={`caret${running ? ' moving' : ''}`} />
    </div>
  )
})
