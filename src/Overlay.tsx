// Rendu des calques visibles, par-dessus tout le reste du canevas (ne capte pas la souris).

import type { Pt } from './geom'
import { annColor, resolvePart, resolvePort, type Layer } from './layers'
import type { Session } from './model'

interface Props {
  session: Session
  layers: Layer[]
  portWorld: (s: Session, port: string) => Pt | null
}

export function Pill({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const w = text.length * 7.4 + 16
  const dark = ['#ffffff', '#ffd60a'].includes(color)
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={-12} width={w} height={24} rx={12} fill={color} stroke="#fff" strokeWidth={2} />
      <text x={w / 2} y={5} fontSize={13} fontWeight={700} textAnchor="middle" fill={dark ? '#111' : '#fff'} fontFamily="IBM Plex Sans, system-ui, sans-serif">{text}</text>
    </g>
  )
}

export function Overlay({ session, layers, portWorld }: Props) {
  const at = (ref: string) => {
    const port = resolvePort(ref)
    return port ? portWorld(session, port) : null
  }
  return (
    <g pointerEvents="none">
      {layers.filter((l) => l.visible).flatMap((l) =>
        l.items.map((it, i) => {
          const key = `${l.id}-${i}`
          if (it.type === 'probe') {
            const p = at(it.port)
            if (!p) return null
            const c = annColor(it.color)
            // Étiquettes alternées au-dessus / en dessous : deux trous voisins restent lisibles.
            const up = l.items.slice(0, i).filter((x) => x.type === 'probe').length % 2 === 0
            const ly = up ? -38 : 38
            const w = (it.label?.length ?? 0) * 7.4 + 16
            return (
              <g key={key} transform={`translate(${p.x},${p.y})`}>
                <circle r={10} fill="none" stroke={c} strokeWidth={3}>
                  <animate attributeName="r" values="10;24" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle r={10} fill="none" stroke="#fff" strokeWidth={7} opacity={0.9} />
                <circle r={10} fill="none" stroke={c} strokeWidth={4} />
                {it.label && (
                  <>
                    <line x1={0} y1={up ? -10 : 10} x2={0} y2={ly + (up ? 12 : -12)} stroke={c} strokeWidth={2.5} />
                    <Pill x={-w / 2} y={ly} text={it.label} color={c} />
                  </>
                )}
              </g>
            )
          }
          if (it.type === 'note') {
            const p = at(it.port)
            if (!p) return null
            const c = annColor(it.color, '#ffd60a')
            return (
              <g key={key}>
                <line x1={p.x} y1={p.y} x2={p.x + 22} y2={p.y - 30} stroke={c} strokeWidth={2.5} />
                <circle cx={p.x} cy={p.y} r={5} fill={c} stroke="#111" />
                <Pill x={p.x + 22} y={p.y - 30} text={it.text} color={c} />
              </g>
            )
          }
          if (it.type === 'line') {
            const a = at(it.from)
            const b = at(it.to)
            if (!a || !b) return null
            const c = annColor(it.color)
            const ang = Math.atan2(b.y - a.y, b.x - a.x)
            const head = [0, 2.6, -2.6].map((d) => `${b.x - Math.cos(ang + d * 0.2) * (d ? 16 : 0)},${b.y - Math.sin(ang + d * 0.2) * (d ? 16 : 0)}`).join(' ')
            return (
              <g key={key}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth={8} opacity={0.8} strokeLinecap="round" />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeWidth={4} strokeDasharray="10 7" strokeLinecap="round" />
                <polygon points={head} fill={c} stroke="#fff" strokeWidth={1.5} />
                {it.label && <Pill x={(a.x + b.x) / 2 + 8} y={(a.y + b.y) / 2 - 18} text={it.label} color={c} />}
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
              {it.label && <Pill x={(a.x + end.x) / 2 + 14} y={(a.y + end.y) / 2 + 24} text={it.label} color={c} />}
            </g>
          )
        }),
      )}
    </g>
  )
}
