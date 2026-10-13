import type { CSSProperties } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useReplay } from '../hooks/useReplay'
import type { Recording } from '../lib/replay'
import { TypingText } from './TypingText'
import { VirtualKeyboard } from './VirtualKeyboard'

function timeLabel(ms: number) {
  const tenths = Math.floor(Math.max(0, ms) / 100)
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`
}

export function TypingReplay({ recording }: { recording: Recording }) {
  const replay = useReplay(recording)
  const target = Math.min(replay.target, recording.durationMs)
  const current = Math.min(replay.time, recording.durationMs)
  return (
    <section className="replay-section" aria-label="Typing replay" data-testid="replay"
      data-time={current} data-target-time={target} data-playing={replay.playing} data-input={replay.state.input}>
      <div className="replay-heading"><h2>Replay</h2><span>your words. your rhythm.</span></div>
      <p className="sr-only">Original words: {recording.target}. Drag the timeline in either direction to rewind or advance the text and keyboard.</p>
      <TypingText target={recording.target} input={replay.state.input} focused running />
      <VirtualKeyboard feedback={replay.state.feedback} />
      <div className="replay-timeline">
        <input type="range" aria-label="Replay timeline" min={0} max={recording.durationMs} step={1} value={target}
          aria-valuetext={`${timeLabel(target)} of ${timeLabel(recording.durationMs)}`}
          style={{ '--replay-progress': `${recording.durationMs ? target / recording.durationMs * 100 : 0}%` } as CSSProperties}
          onPointerDown={replay.pause}
          onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) replay.pause() }}
          onChange={(event) => replay.seek(Number(event.target.value))} />
      </div>
      <div className="replay-controls">
        <div className="replay-actions">
          <button className="icon-button" onClick={replay.toggle} aria-label={replay.playing ? 'Pause replay' : 'Play replay'} title={replay.playing ? 'Pause replay' : 'Play replay'}>{replay.playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <button className="icon-button" onClick={replay.restart} aria-label="Restart replay" title="Restart replay"><RotateCcw size={16} /></button>
          <label className="sr-only" htmlFor="replay-speed">Playback speed</label>
          <select id="replay-speed" value={replay.speed} onChange={(event) => replay.setSpeed(Number(event.target.value))}>
            {[0.5, 1, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
          </select>
        </div>
        <span className="replay-time" aria-label="Replay time"><span>{timeLabel(current)}</span><span className="muted"> / {timeLabel(recording.durationMs)}</span></span>
      </div>
    </section>
  )
}
