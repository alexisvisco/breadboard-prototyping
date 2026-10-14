// Menu du clic droit : couleur des fils, valeur, sens, rotation des blocs, ranger / supprimer.

import { useEffect, useRef } from 'react'
import { ask, tell } from './dialog'
import {
  HAS_VALUE, LED_COLORS, OHM_KINDS, POLAR, WIRE_COLORS, blockInfo, formatOhms, legCount, parseOhms, partName, removeBlock, unplaceBlock,
  type NodeId, type Part, type Session,
} from './model'

interface Props {
  session: Session
  target: string
  x: number
  y: number
  update: (fn: (s: Session) => Session) => void
  onClose: () => void
}

export const unplacePart = (p: Part): Part => (p.kind === 'L' ? { ...p, b: null } : { ...p, a: null, b: null, c: null, d: null })
export const rotateNode = (s: Session, id: NodeId, d: number): Session => {
  const pos = s.nodes[id]
  return pos ? { ...s, nodes: { ...s.nodes, [id]: { ...pos, rot: (((pos.rot + d) % 360) + 360) % 360 } } } : s
}

export function ContextMenu({ session, target, x, y, update, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [onClose])

  const setPart = (id: string, patch: Partial<Part>) => update((s) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const act = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const item = 'block w-full rounded px-2.5 py-1.5 text-left text-sm hover:bg-white/10'
  const style = { left: Math.min(x, window.innerWidth - 250), top: Math.min(y, window.innerHeight - 320) }

  let body: React.ReactNode = null
  if (target.startsWith('node:')) {
    const id = target.slice(5) as NodeId
    body = (
      <>
        <div className="px-2.5 py-1 text-xs font-semibold text-white/50">{blockInfo(session, id).title}</div>
        <button className={item} onClick={act(() => update((s) => rotateNode(s, id, 90)))}>↻ Pivoter de 90° <kbd className="float-right text-white/35">R</kbd></button>
        <button className={item} onClick={act(() => update((s) => rotateNode(s, id, -90)))}>↺ Pivoter dans l'autre sens</button>
        {id !== 'bb' && (
          <>
            <div className="my-1 border-t border-white/10" />
            <button className={item} onClick={act(() => update((s) => unplaceBlock(s, id)))}>Ranger dans la boîte</button>
            <button className={`${item} text-red-300`} onClick={act(() => update((s) => removeBlock(s, id)))}>Supprimer de la boîte</button>
          </>
        )}
      </>
    )
  } else {
    const p = session.parts.find((q) => q.id === target)
    if (!p) return null
    const colors = p.kind === 'W' || p.kind === 'L' ? WIRE_COLORS : p.kind === 'LED' ? LED_COLORS : null
    const editValue = async () => {
      const v = await ask(`Valeur de ${p.label}`, p.value ?? '', OHM_KINDS.includes(p.kind) ? 'Ex. 220, 4.7k, 10 kΩ, 1M' : undefined)
      if (v === null) return
      if (OHM_KINDS.includes(p.kind)) {
        const o = parseOhms(v)
        if (!o) return tell('Valeur pas comprise', 'Exemples : 220, 4.7k, 10 kΩ, 1M')
        setPart(p.id, { value: formatOhms(o) })
      } else setPart(p.id, { value: v.trim() || undefined })
    }
    body = (
      <>
        <div className="px-2.5 py-1 text-xs font-semibold text-white/50">{partName(p)}</div>
        {colors && (
          <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5">
            {colors.map((c) => (
              <button
                key={c.hex}
                title={c.name}
                onClick={act(() => setPart(p.id, { color: c.hex }))}
                className={`h-6 w-6 rounded-full border-2 ${p.color === c.hex ? 'border-emerald-300' : 'border-white/20'}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        )}
        {HAS_VALUE(p.kind) && <button className={item} onClick={act(editValue)}>Changer la valeur…</button>}
        {p.kind !== 'L' && (
          <button className={item} onClick={act(async () => { const n = await ask(`Renommer ${p.label}`, p.label); if (n) setPart(p.id, { label: n }) })}>Renommer…</button>
        )}
        {POLAR.includes(p.kind) && p.a && (
          <button className={item} onClick={act(() => setPart(p.id, { a: p.b, b: p.a }))}>Inverser le sens (+ / −)</button>
        )}
        {p.kind === 'W' && p.b && (
          <>
            <button className={item} onClick={act(() => setPart(p.id, { bend: Math.round((p.bend ?? 0) + 60) }))}>Courber le fil ↷ <span className="float-right text-white/35">+60</span></button>
            <button className={item} onClick={act(() => setPart(p.id, { bend: Math.round((p.bend ?? 0) - 60) }))}>Courber le fil ↶ <span className="float-right text-white/35">−60</span></button>
            {p.bend !== undefined && <button className={item} onClick={act(() => setPart(p.id, { bend: undefined }))}>Remettre le pendant naturel</button>}
          </>
        )}
        {legCount(p.kind) > 2 && p.a && (
          <button className={item} onClick={act(() => setPart(p.id, legCount(p.kind) === 3 ? { a: p.c ?? null, c: p.a } : { a: p.d ?? null, d: p.a, b: p.c ?? null, c: p.b }))}>Retourner (première ↔ dernière patte)</button>
        )}
        <div className="my-1 border-t border-white/10" />
        {(p.kind === 'L' ? p.b : p.a) && (
          <button className={item} onClick={act(() => setPart(p.id, unplacePart(p)))}>{p.kind === 'L' ? 'Débrancher' : 'Remettre dans la boîte'} <kbd className="float-right text-white/35">⌫</kbd></button>
        )}
        {p.kind !== 'L' && (
          <button className={`${item} text-red-300`} onClick={act(() => update((s) => ({ ...s, parts: s.parts.filter((q) => q.id !== p.id) })))}>Supprimer de la boîte</button>
        )}
      </>
    )
  }

  return (
    <div ref={ref} style={style} className="fixed z-50 w-60 rounded-lg border border-white/15 bg-[#18211d] p-1 shadow-2xl">
      {body}
    </div>
  )
}
