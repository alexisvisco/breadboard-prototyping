// Canevas façon outil de workflow : grille de points, déplacement / zoom, blocs déplaçables et pivotables,
// pièces dont chaque patte s'accroche au trou ou à la broche la plus proche.

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import {
  BB_HOLE, BB_HOLES, CARD_JACK, CARD_PIN, CARD_PINS, JACK_LEAD, JACK_LEADS, JACK_PLUG, holeLabel, isHole, legHoles, localToWorld,
  stripLabel, stripOf, type Pos, type Pt,
} from './geom'
import { EXTRA_PORT, layoutOf } from './boards'
import {
  LEG_SHORT, POLAR, blockInfo, legCount, legsOf, type Ghost, portLabel, type Leg, type NodeId, type Part, type Session,
} from './model'
import { rotateNode } from './ContextMenu'
import type { Focus, Layer } from './layers'
import { BreadboardNode, CardNode, ExtraNode, FlipProvider, JackNode } from './nodes'
import { Overlay, Pill } from './Overlay'
import { MULTI_LIFT, MultiBody, PartBody } from './PartArt'

export interface CanvasApi {
  centerOn(p: Pt): void
  /** Cadre la vue sur ces points (avec une marge), sans dépasser un zoom confortable. */
  fitPoints(pts: Pt[]): void
  fit(): void
  zoom(f: number): void
}

const nodeWorld = (s: Session, id: NodeId, p: Pt): Pt | null => {
  const pos = s.nodes[id]
  if (!pos) return null
  const { w, h } = blockInfo(s, id)
  return localToWorld(pos, w, h, p)
}

/** Position monde d'un port (trou, broche, départ d'un fil jack) ; null si son bloc n'est pas posé. */
export function portWorld(s: Session, port: string): Pt | null {
  const h = BB_HOLE.get(port)
  if (h) return nodeWorld(s, 'bb', h)
  const pin = CARD_PIN.get(port)
  if (pin) return nodeWorld(s, 'card', pin)
  const lead = JACK_LEAD.get(port)
  if (lead) return nodeWorld(s, 'jack', lead)
  const x = EXTRA_PORT.get(port)
  if (x) return nodeWorld(s, x.node, x)
  return null
}

/** Centre d'un bloc posé, en coordonnées monde. */
export const nodeCenter = (s: Session, id: NodeId) => {
  const { w, h } = blockInfo(s, id)
  return nodeWorld(s, id, { x: w / 2, y: h / 2 })
}

/** Port le plus proche d'un point monde (trous, et broches de la carte si autorisé). */
function nearestPort(s: Session, p: Pt, withPins: boolean): string | null {
  let best: string | null = null
  let bestD = 15 ** 2
  const test = (id: string, w: Pt | null) => {
    if (!w) return
    const d = (w.x - p.x) ** 2 + (w.y - p.y) ** 2
    if (d < bestD) [best, bestD] = [id, d]
  }
  for (const h of BB_HOLES) test(h.id, nodeWorld(s, 'bb', h))
  if (withPins && s.nodes.card) for (const pin of CARD_PINS) test(pin.id, nodeWorld(s, 'card', pin))
  for (const x of s.extras ?? [])
    if (s.nodes[x.id])
      for (const q of layoutOf(x.id)?.ports ?? []) if (withPins || q.kind === 'hole') test(q.id, nodeWorld(s, x.id, q))
  return best
}

export function portDescription(port: string): string {
  if (isHole(port)) return `${holeLabel(port)} · ${stripLabel(stripOf(port))}`
  return portLabel(port)
}

type Mode =
  | { type: 'pan'; sx: number; sy: number; tx: number; ty: number; moved: boolean }
  | { type: 'node'; id: NodeId; dx: number; dy: number; sx: number; sy: number; moved: boolean }
  | { type: 'end'; partId: string; end: Leg; pins: boolean }

interface Props {
  session: Session
  onChange: (fn: (s: Session) => Session) => void
  selected: string | null
  setSelected: (id: string | null) => void
  highlight: string[]
  flash: string | null
  apiRef: Ref<CanvasApi>
  onHover: (text: string | null) => void
  onContext: (target: string, x: number, y: number) => void
  layers: Layer[]
  /** Diff : couleur par pièce changée, et anciennes places. */
  marks?: Record<string, string>
  ghosts?: Ghost[]
  /** Calque en focus : le reste est grisé. */
  focus?: Focus | null
}

export function Canvas({ session, onChange, selected, setSelected, highlight, flash, apiRef, onHover, onContext, layers, marks = {}, ghosts = [], focus = null }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState({ tx: 40, ty: 80, s: 0.5 })
  const viewRef = useRef(view)
  viewRef.current = view
  const mode = useRef<Mode | null>(null)
  const [dragPos, setDragPos] = useState<Pt | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const toWorld = useCallback((cx: number, cy: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (cx - r.left - v.tx) / v.s, y: (cy - r.top - v.ty) / v.s }
  }, [])

  const fit = useCallback(() => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    const s0 = { nodes: session.nodes, extras: session.extras } as Session
    const pts = (Object.keys(session.nodes) as NodeId[]).flatMap((id) => {
      const { w, h } = blockInfo(s0, id)
      return [{ x: -10, y: -40 }, { x: w + 10, y: -40 }, { x: -10, y: h + 90 }, { x: w + 10, y: h + 90 }]
        .map((p) => nodeWorld(s0, id, p))
        .filter((p): p is Pt => !!p)
    })
    if (!pts.length) return
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const s = Math.min((r.width - 60) / (x1 - x0), (r.height - 60) / (y1 - y0), 1.5)
    setView({ s, tx: (r.width - (x1 - x0) * s) / 2 - x0 * s, ty: (r.height - (y1 - y0) * s) / 2 - y0 * s })
  }, [session.nodes, session.extras])

  useImperativeHandle(apiRef, () => ({
    fit,
    fitPoints(pts) {
      const r = svgRef.current?.getBoundingClientRect()
      if (!r || !pts.length) return
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const pad = 140
      const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad]
      // Laisse de la place à droite pour le panneau des calques.
      const w = r.width - 380
      const s = Math.min(w / (x1 - x0), r.height / (y1 - y0), 1.6)
      setView({ s, tx: (w - (x1 - x0) * s) / 2 - x0 * s, ty: (r.height - (y1 - y0) * s) / 2 - y0 * s })
    },
    centerOn(p) {
      const r = svgRef.current!.getBoundingClientRect()
      const s = Math.max(viewRef.current.s, 1.1)
      setView({ s, tx: r.width / 2 - p.x * s, ty: r.height / 2 - p.y * s })
    },
    zoom(f) {
      const r = svgRef.current!.getBoundingClientRect()
      const v = viewRef.current
      const s = Math.min(4, Math.max(0.15, v.s * f))
      const cx = r.width / 2
      const cy = r.height / 2
      setView({ s, tx: cx - ((cx - v.tx) / v.s) * s, ty: cy - ((cy - v.ty) / v.s) * s })
    },
  }), [fit])

  // Vue d'ensemble au premier affichage.
  const fitted = useRef(false)
  useEffect(() => {
    if (!fitted.current) {
      fitted.current = true
      requestAnimationFrame(() => fit())
    }
  }, [fit])

  // Molette : pincer / Ctrl = zoom, sinon déplacement (comme Figma).
  useEffect(() => {
    const svg = svgRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect()
        const s = Math.min(4, Math.max(0.15, v.s * Math.exp(-e.deltaY * 0.01)))
        const cx = e.clientX - r.left
        const cy = e.clientY - r.top
        setView({ s, tx: cx - ((cx - v.tx) / v.s) * s, ty: cy - ((cy - v.ty) / v.s) * s })
      } else {
        setView({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY })
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const setPart = (id: string, patch: Partial<Part>) =>
    onChange((s) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    const t = e.target as Element
    // Bouton ↻ dans le titre d'un bloc.
    const action = t.closest('[data-action="rotate"]')
    if (action) {
      const id = action.closest('[data-node]')?.getAttribute('data-node') as NodeId | undefined
      if (id) onChange((s) => rotateNode(s, id, 90))
      return
    }
    svgRef.current!.setPointerCapture(e.pointerId)
    const handle = t.closest('[data-handle]')
    if (handle) {
      const [partId, end] = handle.getAttribute('data-handle')!.split('|')
      const part = session.parts.find((p) => p.id === partId)!
      mode.current = { type: 'end', partId, end: end as Leg, pins: part.kind === 'W' || part.kind === 'L' }
      setSelected(partId)
      setDragPos(toWorld(e.clientX, e.clientY))
      return
    }
    const partEl = t.closest('[data-part]')
    if (partEl) {
      setSelected(partEl.getAttribute('data-part'))
      return
    }
    const nodeEl = t.closest('[data-node]')
    if (nodeEl && t.closest('[data-drag="node"]')) {
      const id = nodeEl.getAttribute('data-node') as NodeId
      const w = toWorld(e.clientX, e.clientY)
      const pos = session.nodes[id]!
      mode.current = { type: 'node', id, dx: w.x - pos.x, dy: w.y - pos.y, sx: e.clientX, sy: e.clientY, moved: false }
      return
    }
    mode.current = { type: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false }
  }

  function onPointerMove(e: React.PointerEvent) {
    const w = toWorld(e.clientX, e.clientY)
    // Bouton relâché hors du canevas : on arrête tout glisser en cours.
    if (mode.current && e.buttons === 0) {
      mode.current = null
      setDragPos(null)
    }
    const m = mode.current
    const near = nearestPort(session, w, !m || m.type !== 'end' || m.pins)
    setHover(near)
    onHover(near ? portDescription(near) : null)
    if (!m) return
    if (m.type === 'pan') {
      m.moved = m.moved || Math.abs(e.clientX - m.sx) + Math.abs(e.clientY - m.sy) > 3
      setView((v) => ({ ...v, tx: m.tx + e.clientX - m.sx, ty: m.ty + e.clientY - m.sy }))
    } else if (m.type === 'node') {
      m.moved = m.moved || Math.abs(e.clientX - m.sx) + Math.abs(e.clientY - m.sy) > 3
      if (m.moved)
        onChange((s) => ({ ...s, nodes: { ...s.nodes, [m.id]: { ...s.nodes[m.id]!, x: Math.round(w.x - m.dx), y: Math.round(w.y - m.dy) } } }))
    } else {
      setDragPos(w)
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const m = mode.current
    mode.current = null
    if (m?.type === 'end' && dragPos) {
      const port = nearestPort(session, dragPos, m.pins)
      const part = session.parts.find((p) => p.id === m.partId)
      // Un fil lâché dans le vide est débranché de ce côté ; une pièce garde son ancienne place.
      if (port) setPart(m.partId, { [m.end]: port })
      else if (part && (part.kind === 'L' || part.kind === 'W') && m.end === 'b') setPart(m.partId, { b: null })
    }
    if (m?.type === 'node' && !m.moved) setSelected(`node:${m.id}`)
    if (m?.type === 'pan' && !m.moved) setSelected(null)
    setDragPos(null)
    svgRef.current?.releasePointerCapture(e.pointerId)
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    const t = e.target as Element
    const part = t.closest('[data-part]')?.getAttribute('data-part')
    const node = t.closest('[data-node]')?.getAttribute('data-node')
    const target = part ?? (node ? `node:${node}` : null)
    if (!target) return
    setSelected(target)
    onContext(target, e.clientX, e.clientY)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const data = e.dataTransfer.getData('text/plain')
    const w = toWorld(e.clientX, e.clientY)
    if (data.startsWith('block:')) {
      const id = data.slice(6)
      const { w: bw, h: bh } = blockInfo(session, id)
      onChange((s) => ({ ...s, nodes: { ...s.nodes, [id]: { x: Math.round(w.x - bw / 2), y: Math.round(w.y - bh / 2), rot: 0 } } }))
      setSelected(`node:${id}`)
      return
    }
    if (!data.startsWith('part:')) return
    const part = session.parts.find((p) => p.id === data.slice(5))
    if (!part) return
    const port = nearestPort(session, w, part.kind === 'W')
    if (!port || (part.kind !== 'W' && !isHole(port))) return
    if (part.kind === 'W') setPart(part.id, { a: port, b: null })
    else {
      const holes = legHoles(port, legCount(part.kind))
      setPart(part.id, Object.fromEntries(legsOf(part).map((l, i) => [l, holes[i]])))
    }
    setSelected(part.id)
  }

  const nodes = session.nodes
  const m = mode.current
  const leadColors = Object.fromEntries(session.parts.filter((p) => p.kind === 'L').map((p) => [p.id, p.color]))

  // Câble entre la fiche jack et la prise de la carte.
  const plug = nodeWorld(session, 'jack', JACK_PLUG)
  const plugUp = nodeWorld(session, 'jack', { x: JACK_PLUG.x, y: JACK_PLUG.y - 14 })
  const socket = nodeWorld(session, 'card', CARD_JACK)
  const socketOut = nodeWorld(session, 'card', { x: CARD_JACK.x, y: CARD_JACK.y + 220 })

  return (
    <svg
      ref={svgRef}
      className="h-full w-full touch-none select-none bg-[#101614]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { mode.current = null; setDragPos(null) }}
      onPointerLeave={() => { setHover(null); onHover(null) }}
      onContextMenu={onContextMenu}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <defs>
        <pattern id="dots" width={24} height={24} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={1.3} fill="#2c3833" />
        </pattern>
      </defs>
      <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})`}>
        <rect x={-20000} y={-20000} width={40000} height={40000} fill="url(#dots)" />

        {plug && plugUp && socket && socketOut && (
          <path
            d={`M${plugUp.x},${plugUp.y} C${plugUp.x + (plugUp.x - plug.x) * 10},${plugUp.y + (plugUp.y - plug.y) * 10} ${socketOut.x},${socketOut.y} ${socket.x},${socket.y}`}
            stroke="#0b0b0b" strokeWidth={9} fill="none" opacity={0.9}
          />
        )}

        {(['jack', 'bb', 'card', ...(session.extras ?? []).map((x) => x.id)] as NodeId[]).map((id) => {
          const pos: Pos | undefined = nodes[id]
          if (!pos) return null
          const { w, h } = blockInfo(session, id)
          return (
            <g key={id} data-node={id} transform={`translate(${pos.x},${pos.y}) rotate(${pos.rot},${w / 2},${h / 2})`} opacity={focus && !focus.nodes.has(id) ? 0.3 : 1}>
              {selected === `node:${id}` && (
                <rect x={-10} y={-44} width={w + 20} height={h + 54} rx={18} fill="none" stroke="#ffd43b" strokeWidth={3} strokeDasharray="10 7" />
              )}
              <FlipProvider value={pos.rot === 180 || pos.rot === 270}>
                {id === 'bb' && <BreadboardNode hover={hover} flash={flash} />}
                {id === 'card' && <CardNode hover={hover} flash={flash} />}
                {id === 'jack' && <JackNode colors={leadColors} />}
                {session.extras?.map((x) => (x.id === id ? <ExtraNode key={id} extra={x} hover={hover} flash={flash} /> : null))}
              </FlipProvider>
            </g>
          )
        })}

        {/* Diff : la version d'avant, en transparence, sous forme de vraies pièces. */}
        {ghosts.map((g) => {
          const p = g.part
          const lead = p.kind === 'L' ? JACK_LEAD.get(p.id) : null
          const A = lead ? (p.b ? portWorld(session, p.b) : null) : p.a ? portWorld(session, p.a) : null
          if (!A) return null
          const B = lead ? portWorld(session, p.id) : p.b ? portWorld(session, p.b) : null
          const end = B ?? { x: A.x + 34, y: A.y + 46 }
          const flexible = p.kind === 'W' || p.kind === 'L'
          const sag = Math.max(30, Math.hypot(end.x - A.x, end.y - A.y) * 0.18)
          const curve = `M${A.x},${A.y} C${A.x + (end.x - A.x) * 0.25},${Math.max(A.y, end.y) + sag} ${A.x + (end.x - A.x) * 0.75},${Math.max(A.y, end.y) + sag} ${end.x},${end.y}`
          const mx = (A.x + end.x) / 2
          const my = (A.y + end.y) / 2
          const ang = (Math.atan2(end.y - A.y, end.x - A.x) * 180) / Math.PI
          return (
            <g key={`ghost-${p.id}`} pointerEvents="none">
              {flexible ? (
                <path d={curve} fill="none" stroke={g.tone} strokeWidth={14} strokeOpacity={0.25} strokeLinecap="round" />
              ) : (
                <line x1={A.x} y1={A.y} x2={end.x} y2={end.y} stroke={g.tone} strokeWidth={26} strokeOpacity={0.22} strokeLinecap="round" />
              )}
              <g opacity={0.42}>
                {flexible ? (
                  <>
                    <path d={curve} fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" />
                    <path d={curve} fill="none" stroke={p.color} strokeWidth={5} strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <line x1={A.x} y1={A.y} x2={end.x} y2={end.y} stroke="#8a9096" strokeWidth={3} />
                    <g transform={`translate(${mx},${my}) rotate(${ang})`}>
                      <PartBody p={p} />
                    </g>
                  </>
                )}
                {[A, B].filter((q): q is Pt => !!q).map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={7} fill="#fff" stroke="#14201c" strokeWidth={2} />)}
              </g>
              <Pill x={mx + 12} y={my + 24} text={g.label} color={g.tone} />
            </g>
          )
        })}
        {session.parts.map((p) => {
          const anchorA = p.a ? portWorld(session, p.a) : null
          if (!anchorA) return null
          const dragging = m?.type === 'end' && m.partId === p.id && dragPos
          const A = dragging && m.end === 'a' ? dragPos : anchorA
          const lead = JACK_LEAD.get(p.id)
          const stub = p.kind === 'L' && lead ? nodeWorld(session, 'jack', { x: lead.x, y: lead.y + 80 })! : { x: anchorA.x + 34, y: anchorA.y + 46 }
          const Bfixed = (p.b ? portWorld(session, p.b) : null) ?? stub
          const B = dragging && m.end === 'b' ? dragPos : Bfixed
          const isSel = p.id === selected
          const isHl = highlight.includes(p.id) || flash === p.id
          const mark = marks[p.id]
          const glow = isHl ? '#ff6b6b' : isSel ? '#ffd43b' : mark
          const flexible = p.kind === 'W' || p.kind === 'L'
          if (legCount(p.kind) > 2) {
            const legs = legsOf(p)
            const pts = legs.map((l, i) => {
              if (dragging && m.end === l) return dragPos
              const port = p[l]
              return (port ? portWorld(session, port) : null) ?? { x: anchorA.x + 24 * i, y: anchorA.y + 46 }
            })
            const first = pts[0]
            const last = pts[pts.length - 1]
            const ang = Math.atan2(last.y - first.y, last.x - first.x)
            const cx = pts.reduce((t, q) => t + q.x, 0) / pts.length
            const cy = pts.reduce((t, q) => t + q.y, 0) / pts.length
            const O = { x: cx + Math.sin(ang) * MULTI_LIFT, y: cy - Math.cos(ang) * MULTI_LIFT }
            const local = pts.map((q) => {
              const dx = q.x - O.x
              const dy = q.y - O.y
              return { x: dx * Math.cos(ang) + dy * Math.sin(ang), y: -dx * Math.sin(ang) + dy * Math.cos(ang) }
            })
            const short = LEG_SHORT[p.kind] ?? []
            return (
              <g key={p.id} data-part={p.id} style={{ cursor: 'pointer' }} opacity={focus && !focus.parts.has(p.id) ? 0.13 : 1}>
                {glow && (
                  <>
                    <circle cx={O.x} cy={O.y} r={34} fill={glow} fillOpacity={0.5} />
                    {pts.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={14} fill={glow} fillOpacity={0.5} />)}
                  </>
                )}
                <g transform={`translate(${O.x},${O.y}) rotate(${(ang * 180) / Math.PI})`}>
                  {local.map((q, i) => <line key={i} x1={q.x} y1={q.y} x2={Math.max(-12, Math.min(12, q.x))} y2={10} stroke="#8a9096" strokeWidth={3} />)}
                  <MultiBody p={p} />
                </g>
                <text x={O.x} y={O.y - 26} fontSize={12} fontWeight={700} textAnchor="middle" fill="#14201c" stroke="#f3f1ea" strokeWidth={4} paintOrder="stroke">{p.label}</text>
                {pts.map((q, i) => short[i] && <text key={i} x={q.x} y={q.y + 22} fontSize={10} fontWeight={700} textAnchor="middle" fill="#ffd43b" stroke="#14201c" strokeWidth={3} paintOrder="stroke" pointerEvents="none">{short[i]}</text>)}
                {legs.map((l, i) => (
                  <circle key={l} data-handle={`${p.id}|${l}`} cx={pts[i].x} cy={pts[i].y} r={8} fill="#fff" stroke="#14201c" strokeWidth={2.5} style={{ cursor: 'move' }} />
                ))}
              </g>
            )
          }
          const sag = Math.max(30, Math.hypot(B.x - A.x, B.y - A.y) * 0.18)
          const wire = `M${A.x},${A.y} C${A.x + (B.x - A.x) * 0.25},${Math.max(A.y, B.y) + sag} ${A.x + (B.x - A.x) * 0.75},${Math.max(A.y, B.y) + sag} ${B.x},${B.y}`
          const lA = p.kind === 'L' && lead ? nodeWorld(session, 'jack', { x: lead.x, y: lead.y + 50 })! : A
          const path = p.kind === 'L' ? `M${A.x},${A.y} C${lA.x},${lA.y} ${B.x},${B.y + 60} ${B.x},${B.y}` : wire
          const mx = (A.x + B.x) / 2
          const my = (A.y + B.y) / 2
          const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI
          return (
            <g key={p.id} data-part={p.id} style={{ cursor: 'pointer' }} opacity={focus && !focus.parts.has(p.id) ? 0.13 : 1}>
              {glow &&
                (flexible ? (
                  <path d={path} fill="none" stroke={glow} strokeWidth={mark && !isSel && !isHl ? 18 : 15} strokeOpacity={0.6} strokeLinecap="round" />
                ) : (
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={glow} strokeWidth={mark && !isSel && !isHl ? 32 : 26} strokeOpacity={0.6} strokeLinecap="round" />
                ))}
              {flexible ? (
                <>
                  <path d={path} fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
                  <path d={path} fill="none" stroke={p.color} strokeWidth={5} strokeLinecap="round" strokeDasharray={p.b || dragging ? undefined : '6 5'} />
                  {!p.b && !dragging && <circle cx={B.x} cy={B.y} r={4} fill="#c87533" />}
                </>
              ) : (
                <>
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#8a9096" strokeWidth={3} />
                  <g transform={`translate(${mx},${my}) rotate(${ang})`}>
                    <PartBody p={p} />
                  </g>
                  {POLAR.includes(p.kind) && p.kind !== 'D' && (
                    <text x={A.x - 4} y={A.y - 12} fontSize={17} fontWeight={800} fill="#ffd43b" stroke="#14201c" strokeWidth={3} paintOrder="stroke">+</text>
                  )}
                  <text x={mx} y={my - 18} fontSize={12} fontWeight={700} textAnchor="middle" fill="#14201c" stroke="#f3f1ea" strokeWidth={4} paintOrder="stroke">{p.label}</text>
                </>
              )}
              {(['a', 'b'] as const).map((k) => {
                if (p.kind === 'L' && k === 'a') return null
                const pt = k === 'a' ? A : B
                return (
                  <circle key={k} data-handle={`${p.id}|${k}`} cx={pt.x} cy={pt.y} r={8} fill="#fff" stroke="#14201c" strokeWidth={2.5} style={{ cursor: 'move' }} />
                )
              })}
            </g>
          )
        })}

        {/* Noms des fils du jack : au-dessus des fils, toujours à l'endroit. */}
        {nodes.jack &&
          (!focus || focus.nodes.has('jack')) &&
          JACK_LEADS.map((l, i) => {
            const p = nodeWorld(session, 'jack', { x: l.x, y: l.y + 24 + (i % 2) * 14 })!
            const text = l.label.replace(' écouteur', '').replace(' micro', '')
            return (
              <text key={`lbl-${l.id}`} x={p.x} y={p.y + 4} fontSize={11} fontWeight={600} textAnchor="middle" fill="#e6ece8" stroke="#101614" strokeWidth={4} paintOrder="stroke" pointerEvents="none" fontFamily="JetBrains Mono, ui-monospace, monospace">
                {text}
              </text>
            )
          })}
        <Overlay session={session} layers={layers} portWorld={portWorld} scale={view.s} />
      </g>
    </svg>
  )
}
