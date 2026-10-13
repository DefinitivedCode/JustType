import { completedWords, elapsedMs, liveMetrics } from '../lib/statistics'
import type { TestState } from '../lib/types'

export function LiveStats({ state }: { state: TestState }) {
  const elapsed = elapsedMs(state)
  const metrics = liveMetrics(state)
  const remaining = state.mode.kind === 'time' ? Math.max(0, Math.ceil(state.mode.value - elapsed / 1000)) : completedWords(state)
  const progress = state.mode.kind === 'time' ? elapsed / (state.mode.value * 1000) : state.input.length / state.target.length
  return (
    <div className={`live-stats ${state.status === 'running' ? 'is-running' : ''}`}>
      <div className="test-context"><span className="language-dot" />english<span className="context-separator">/</span>common words</div>
      <div className="live-values">
        <span className="live-speed"><strong data-testid="live-wpm">{elapsed >= 1000 ? Math.round(metrics.wpm) : '—'}</strong> wpm</span>
        <span className="live-progress"><strong data-testid="progress">{remaining}</strong><span>{state.mode.kind === 'time' ? 's' : ` / ${state.mode.value}`}</span></span>
      </div>
      <div className="test-progress-track" aria-hidden="true"><div style={{ transform: `scaleX(${Math.min(1, progress)})` }} /></div>
    </div>
  )
}
