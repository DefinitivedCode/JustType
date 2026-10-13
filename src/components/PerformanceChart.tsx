import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { TestResult } from '../lib/types'

export function PerformanceChart({ result }: { result: TestResult }) {
  const titleId = useId()
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [hovered, setHovered] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = container.current!
    const resize = () => setWidth(Math.max(280, element.clientWidth))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const height = 228, left = 38, top = 18, plotWidth = width - 54, plotHeight = 164
  const duration = Math.max(result.durationMs / 1000, 0.001)
  const max = Math.max(40, Math.ceil(Math.max(...result.samples.map((sample) => sample.rawWpm), result.rawWpm) / 20) * 20)
  const x = (seconds: number) => left + (seconds / duration) * plotWidth
  const y = (wpm: number) => top + plotHeight - (wpm / max) * plotHeight
  const line = (raw: boolean) => result.samples.map((sample, index) => `${index === 0 ? 'M' : 'L'}${x(sample.at).toFixed(2)},${y(raw ? sample.rawWpm : sample.wpm).toFixed(2)}`).join(' ')
  const sample = hovered === null ? null : result.samples[hovered] ?? null
  const errors = result.events.filter((event) => event.kind === 'insert' && !event.correct)
  return (
    <div ref={container} className="performance-chart">
      <div className="chart-heading"><span>your rhythm</span><div className="chart-legend"><span><i className="legend-line" />wpm</span><span><i className="legend-line raw" />raw</span><span><i className="legend-error" />errors</span></div></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId} onPointerLeave={() => setHovered(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const time = Math.max(0, Math.min(duration, (((event.clientX - rect.left) / rect.width) * width - left) / plotWidth * duration))
          let nearest = 0
          result.samples.forEach((point, index) => { if (Math.abs(point.at - time) < Math.abs(result.samples[nearest]!.at - time)) nearest = index })
          setHovered(nearest)
        }}>
        <title id={titleId}>Typing speed over {duration.toFixed(1)} seconds. Blue: WPM. Dashed: raw WPM. Red markers: errors.</title>
        {[0, max / 2, max].map((value) => <g key={value}><line className="chart-grid" x1={left} y1={y(value)} x2={width - 20} y2={y(value)} /><text className="chart-axis" x={left - 14} y={y(value) + 4} textAnchor="end">{value}</text></g>)}
        {[0, 1, 2, 3, 4].map((value) => { const at = duration * value / 4; return <text className="chart-axis" key={value} x={x(at)} y={top + plotHeight + 25} textAnchor="middle">{Number(at.toFixed(1))}</text> })}
        <text className="chart-axis axis-caption" x={left + plotWidth / 2} y={height - 4} textAnchor="middle">elapsed seconds</text>
        <path className="chart-line raw" d={line(true)} />
        <path className="chart-line" d={line(false)} />
        {errors.map((event, index) => <circle className="chart-error" key={index} cx={x(event.at / 1000)} cy={top + plotHeight - 3} r={2.4}><title>Error at {(event.at / 1000).toFixed(2)}s</title></circle>)}
        {sample && <g><line className="chart-hover-line" x1={x(sample.at)} x2={x(sample.at)} y1={top} y2={top + plotHeight} /><circle className="chart-point" cx={x(sample.at)} cy={y(sample.wpm)} r={4} /></g>}
      </svg>
      {sample && <div className="chart-tooltip">{sample.at.toFixed(1)}s <span>{Math.round(sample.wpm)} wpm</span><span>{Math.round(sample.rawWpm)} raw</span></div>}
      <div className="sr-only"><table><caption>Recorded typing performance</caption><thead><tr><th>Seconds</th><th>WPM</th><th>Raw WPM</th><th>Cumulative errors</th></tr></thead><tbody>{result.samples.map((point, index) => <tr key={index}><td>{point.at.toFixed(2)}</td><td>{point.wpm.toFixed(2)}</td><td>{point.rawWpm.toFixed(2)}</td><td>{point.errors}</td></tr>)}</tbody></table></div>
    </div>
  )
}
