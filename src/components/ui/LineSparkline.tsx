import { useId, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/format'

export type LineSparklinePoint = {
  key: string
  label: string
  value: number
}

export function LineSparkline({
  points,
  activeKey,
  onSelect,
  height = 88,
}: {
  points: LineSparklinePoint[]
  activeKey?: string
  onSelect?: (key: string) => void
  height?: number
}) {
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)

  const chart = useMemo(() => {
    const padL = 2
    const padR = 2
    const padT = 10
    const padB = 18
    const w = 320
    const h = height
    const innerW = w - padL - padR
    const innerH = h - padT - padB
    const max = Math.max(0, ...points.map((p) => p.value))
    const n = Math.max(1, points.length)
    const xAt = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const yAt = (v: number) => padT + (max <= 0 ? innerH : innerH * (1 - v / max))
    const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value), ...p }))
    const line = coords.map((c) => `${c.x},${c.y}`).join(' ')
    const area =
      coords.length === 0
        ? ''
        : `${padL},${padT + innerH} ${line} ${coords[coords.length - 1].x},${padT + innerH}`
    return { w, h, max, coords, line, area, baseline: padT + innerH }
  }, [points, height])

  if (points.length === 0) return null

  const tip = hover != null ? chart.coords[hover] : null

  return (
    <div className="relative w-full min-w-0">
      <svg
        viewBox={`0 0 ${chart.w} ${chart.h}`}
        className="h-[5.5rem] w-full overflow-visible"
        role="img"
        aria-label="Producción de los últimos 6 meses"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          x2={chart.w}
          y1={chart.baseline}
          y2={chart.baseline}
          stroke="var(--brand-border)"
          strokeWidth="1"
        />
        {chart.area && (
          <polygon points={chart.area} fill={`url(#fill-${gid})`} />
        )}
        <polyline
          points={chart.line}
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {chart.coords.map((c, i) => {
          const active = c.key === activeKey
          const hovered = hover === i
          return (
            <g key={c.key}>
              <circle
                cx={c.x}
                cy={c.y}
                r={12}
                fill="transparent"
                className={onSelect ? 'cursor-pointer' : undefined}
                onMouseEnter={() => setHover(i)}
                onClick={() => onSelect?.(c.key)}
              />
              <circle
                cx={c.x}
                cy={c.y}
                r={hovered || active ? 4.5 : 3.2}
                fill={active || hovered ? 'var(--brand-primary)' : '#fff'}
                stroke="var(--brand-primary)"
                strokeWidth="2"
                className="pointer-events-none"
              />
              <text
                x={c.x}
                y={chart.h - 4}
                textAnchor="middle"
                className="fill-slate-400"
                style={{ fontSize: 8, fontFamily: 'var(--font-sans)' }}
              >
                {c.label}
              </text>
            </g>
          )
        })}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm"
          style={{
            left: `${(tip.x / chart.w) * 100}%`,
            background: 'var(--brand-card)',
            border: '1px solid var(--brand-border)',
          }}
        >
          {tip.label}: {tip.value ? formatCurrency(tip.value) : '—'}
        </div>
      )}
    </div>
  )
}
