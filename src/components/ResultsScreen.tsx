import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Trophy } from 'lucide-react'
import type { TestResult } from '../lib/types'
import { modeLabel } from '../lib/types'
import { PerformanceChart } from './PerformanceChart'

export function ResultsScreen({ result, isPersonalBest, restart }: { result: TestResult; isPersonalBest: boolean; restart: () => void }) {
  const region = useRef<HTMLElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const [armed, setArmed] = useState(false)
  useLayoutEffect(() => { region.current?.focus({ preventScroll: true }) }, [])
  return (
    <section ref={region} tabIndex={-1} className="results-screen" aria-label="Test results" data-testid="results"
      onKeyDown={(event) => {
        if (event.target === region.current && event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault()
          setArmed(true)
          nextButton.current?.focus()
        }
      }}>
      <div className="results-heading"><span><i className="completion-dot" />test complete</span>{isPersonalBest && <span className="personal-best"><Trophy size={15} />new personal best</span>}</div>
      <div className="primary-results">
        <div className="primary-stat"><span className="stat-label">wpm</span><strong data-testid="result-wpm">{Math.round(result.wpm)}</strong><span className="stat-caption">words per minute</span></div>
        <div className="primary-stat accuracy-stat"><span className="stat-label">accuracy</span><strong data-testid="result-accuracy">{Number(result.accuracy.toFixed(1))}<span className="stat-unit">%</span></strong><span className="stat-caption">of all typing inputs</span></div>
        <div className="result-test-info"><span className="stat-label">test</span><span>{modeLabel(result.mode)}</span><span className="muted">english · common words</span></div>
      </div>
      <PerformanceChart result={result} />
      <dl className="secondary-results">
        <div><dt>raw wpm</dt><dd data-testid="result-raw">{Math.round(result.rawWpm)}</dd></div>
        <div><dt>consistency</dt><dd>{result.consistency === null ? '—' : `${Math.round(result.consistency)}%`}</dd></div>
        <div className="character-stat"><dt>characters</dt><dd><span className="character-count"><span>{result.correctCharacters}</span><span className="stat-slash"> / </span><span className={result.incorrectCharacters ? 'error-text' : 'muted'}>{result.incorrectCharacters}</span></span><span className="stat-caption">correct / incorrect</span></dd></div>
        <div><dt>keystrokes</dt><dd>{result.totalInputs}<span className="stat-caption">{result.incorrectInputs} incorrect</span></dd></div>
        <div><dt>corrections</dt><dd>{result.correctedErrors}<span className="stat-caption">errors removed</span></dd></div>
        <div><dt>duration</dt><dd>{Number((result.durationMs / 1000).toFixed(1))}<span className="secondary-unit">s</span></dd></div>
      </dl>
      <div className="next-test-controls"><button ref={nextButton} className="next-test-button" onClick={restart} onBlur={() => setArmed(false)}>Next test<ArrowRight size={17} /></button><span className="shortcut-hint"><kbd>tab</kbd><span>+</span><kbd>enter</kbd><span>{armed ? 'ready for the next one' : 'next test'}</span></span></div>
      <details className="statistics-explanation"><summary>How these numbers work<ChevronDown size={14} /></summary><div>
        <p><strong>WPM</strong> is currently correct characters, including spaces, divided by five and by elapsed minutes. <strong>Raw WPM</strong> uses all character inputs, including retyped characters. Backspace is excluded.</p>
        <p><strong>Accuracy</strong> is correct input events divided by all input events. Correcting a mistake fixes the visible text and WPM; the original error remains in keystroke accuracy and on the chart. Characters show the final text; corrections count incorrect characters removed.</p>
        <p><strong>Consistency</strong> is 100 × (1 − standard deviation ÷ mean) of raw speed in one-second intervals, clamped to 0–100%. The final partial interval is weighted by its duration. Fewer than two intervals gives no score.</p>
        <p>Input advances one character position at a time, including spaces. There are no skipped or extra character categories. The chart records cumulative speed during the test. Personal bests are stored for each mode; tests shorter than one second are excluded.</p>
      </div></details>
      <p className="sr-only" role="status">Test complete. {Math.round(result.wpm)} words per minute, {result.accuracy.toFixed(1)} percent accuracy. Press Tab then Enter for the next test.</p>
    </section>
  )
}
