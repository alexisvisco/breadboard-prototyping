// Rendu des calques visibles, par-dessus tout le reste du canevas (ne capte pas la souris).
// Les repères gardent une taille lisible quel que soit le zoom.

import { railShift, type Pt } from './geom'
import { annColor, portName, resolvePart, resolvePort, type Layer } from './layers'
import type { Session } from './model'

interface Props {
  session: Session
  layers: Layer[]
  portWorld: (s: Session, port: string) => Pt | null
  /** Zoom actuel du canevas. */
  scale: number
}

export function Pill({ x, y, text, color, size = 13 }: { x: number; y: number; text: string; color: string; size?: number }) {
  const w = text.length * size * 0.58 + size * 1.3
  const h = size * 1.85
  const dark = ['#ffffff', '#ffd60a'].includes(color)
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={-h / 2} width={w} height={h} rx={h / 2} fill={color} stroke="#fff" strokeWidth={size / 6} />
      <text x={w / 2} y={size * 0.38} fontSize={size} fontWeight={700} textAnchor="middle" fill={dark ? '#111' : '#fff'} fontFamily="IBM Plex Sans, system-ui, sans-serif">{text}</text>
    </g>
  )
}

/** Bande colorée sur ce qui est relié au trou visé : sa colonne (5 trous) ou quelques trous de rail ; ligne discrète sur sa rangée. */
function Band({ port, color, at, k }: { port: string; color: string; at: (p: string) => Pt | null; k: number }) {
  const rail = /^([+-][HB])(\d+)$/.exec(port)
  let ends: [string, string]
  let row: [string, string] | null = null
  if (rail) {
    ends = [railShift(port, -2), railShift(port, 2)]
  } else {
    const m = /^([a-j])(\d+)$/.exec(port)
    if (!m) return null
    const top = 'abcde'.includes(m[1])
    ends = [`${top ? 'a' : 'f'}${m[2]}`, `${top ? 'e' : 'j'}${m[2]}`]
    row = [`${m[1]}62`, `${m[1]}1`]
  }
  const a = at(ends[0])
  const b = at(ends[1])
  if (!a || !b) return null
  const ra = row ? at(row[0]) : null
  const rb = row ? at(row[1]) : null
  return (
    <g>
      {ra && rb && <line x1={ra.x} y1={ra.y} x2={rb.x} y2={rb.y} stroke={color} strokeWidth={14} strokeOpacity={0.1} strokeLinecap="round" />}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={Math.max(22, 14 * k)} strokeOpacity={0.28} strokeLinecap="round" />
    </g>
  )
}

export function Overlay({ session, layers, portWorld, scale }: Props) {
  const resolved = (ref: string) => resolvePort(ref)
  const at = (ref: string) => {
    const port = resolved(ref)
    return port ? portWorld(session, port) : null
  }
  // Facteur pour garder une taille à l'écran à peu près constante en dézoomant.
  const k = Math.max(1, 0.9 / scale)
  const visible = layers.filter((l) => l.visible)

  return (
    <g pointerEvents="none">
      {/* Bandes d'abord, sous les cercles. */}
      {visible.flatMap((l) =>
        l.items.map((it, i) => {
          if (it.type !== 'probe') return null
          const port = resolved(it.port)
          return port ? <Band key={`band-${l.id}-${i}`} port={port} color={annColor(it.color)} at={(p) => portWorld(session, p)} k={k} /> : null
        }),
      )}
      {visible.flatMap((l) =>
        l.items.map((it, i) => {
          const key = `${l.id}-${i}`
          if (it.type === 'probe') {
            const p = at(it.port)
            if (!p) return null
            const c = annColor(it.color)
            // Étiquette du côté opposé aux autres pointes du calque (sinon alternée) : rien ne se chevauche.
            const others = l.items
              .filter((x, j) => j !== i && x.type === 'probe')
              .map((x) => at((x as { port: string }).port))
              .filter((q): q is Pt => !!q)
            const avgY = others.length ? others.reduce((t, q) => t + q.y, 0) / others.length : p.y
            const up = Math.abs(avgY - p.y) > 2 ? p.y < avgY : l.items.slice(0, i).filter((x) => x.type === 'probe').length % 2 === 0
            const text = `${it.label ? `${it.label} → ` : ''}${portName(it.port)}`
            const size = 15 * k
            const w = text.length * size * 0.58 + size * 1.3
            const ly = (up ? -1 : 1) * (34 * k + 6)
            const r = 11 * k
            return (
              <g key={key} transform={`translate(${p.x},${p.y})`}>
                <circle r={r} fill="none" stroke={c} strokeWidth={3 * k}>
                  <animate attributeName="r" values={`${r};${r * 2.4}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle r={r} fill="none" stroke="#fff" strokeWidth={8 * k} opacity={0.95} />
                <circle r={r} fill="none" stroke={c} strokeWidth={4.5 * k} />
                <line x1={0} y1={(up ? -1 : 1) * r} x2={0} y2={ly + (up ? 1 : -1) * size * 0.9} stroke={c} strokeWidth={3 * k} />
                <Pill x={-w / 2} y={ly} text={text} color={c} size={size} />
              </g>
            )
          }
          if (it.type === 'note') {
            const p = at(it.port)
            if (!p) return null
            const c = annColor(it.color, '#ffd60a')
            return (
              <g key={key}>
                <line x1={p.x} y1={p.y} x2={p.x + 24 * k} y2={p.y - 32 * k} stroke={c} strokeWidth={2.5 * k} />
                <circle cx={p.x} cy={p.y} r={5 * k} fill={c} stroke="#111" />
                <Pill x={p.x + 24 * k} y={p.y - 32 * k} text={it.text} color={c} size={13 * k} />
              </g>
            )
          }
          if (it.type === 'line') {
            const a = at(it.from)
            const b = at(it.to)
            if (!a || !b) return null
            const c = annColor(it.color)
            const ang = Math.atan2(b.y - a.y, b.x - a.x)
            const hl = 16 * k
            const head = [0, 1, -1].map((d) => `${b.x - Math.cos(ang + d * 0.45) * (d ? hl : 0)},${b.y - Math.sin(ang + d * 0.45) * (d ? hl : 0)}`).join(' ')
            return (
              <g key={key}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth={8 * k} opacity={0.8} strokeLinecap="round" />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeWidth={4 * k} strokeDasharray={`${10 * k} ${7 * k}`} strokeLinecap="round" />
                <polygon points={head} fill={c} stroke="#fff" strokeWidth={1.5} />
                {it.label && <Pill x={(a.x + b.x) / 2 + 8 * k} y={(a.y + b.y) / 2 - 18 * k} text={it.label} color={c} size={13 * k} />}
              </g>
            )
          }
          // Pièce mise en évidence.
          const part = resolvePart(session, it.part)
          if (!part) return null
          const a = part.kind === 'L' ? (part.b ? portWorld(session, part.b) : null) : part.a ? portWorld(session, part.a) : null
          const b = part.kind === 'L' ? portWorld(session, part.a!) : part.b ? portWorld(session, part.b) : null
          if (!a) return null
          const end = b ?? a
          const c = annColor(it.color)
          return (
            <g key={key}>
              <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} stroke={c} strokeWidth={30} strokeOpacity={0.35} strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} stroke={c} strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" />
              {it.label && <Pill x={(a.x + end.x) / 2 + 14} y={(a.y + end.y) / 2 + 24} text={it.label} color={c} size={13 * k} />}
            </g>
          )
        }),
      )}
    </g>
  )
}
