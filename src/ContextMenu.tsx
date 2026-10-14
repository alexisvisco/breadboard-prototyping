// Menu du clic droit : couleur des fils, valeur, sens, rotation des blocs, ranger / supprimer.

import { useEffect, useRef } from 'react'
import { Archive, ArrowLeftRight, Copy, CornerDownRight, Pencil, RotateCcw, RotateCw, ShoppingCart, Spline, Trash2, Undo2, Unplug, Eraser, SlidersHorizontal } from 'lucide-react'
import { ask, tell } from './dialog'
import { PCB_COLORS } from './boards'
import { addAnchor } from './Canvas'
import {
  addExtra, addToBox, HAS_VALUE, LED_COLORS, OHM_KINDS, POLAR, WIRE_COLORS, blockInfo, formatOhms, legCount, parseOhms, partName, removeBlock, unplaceBlock,
  type NodeId, type Part, type Session,
} from './model'

interface Props {
  session: Session
  target: string
  x: number
  y: number
  update: (fn: (s: Session) => Session) => void
  onClose: () => void
  onShop: () => void
}

export const unplacePart = (p: Part): Part => (p.kind === 'L' ? { ...p, b: null } : { ...p, a: null, b: null, c: null, d: null })
export const rotateNode = (s: Session, id: NodeId, d: number): Session => {
  const pos = s.nodes[id]
  return pos ? { ...s, nodes: { ...s.nodes, [id]: { ...pos, rot: (((pos.rot + d) % 360) + 360) % 360 } } } : s
}

export function ContextMenu({ session, target, x, y, update, onClose, onShop }: Props) {
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
  const item = 'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm hover:bg-white/10'
  const ic = 'size-4 shrink-0 text-white/55'
  const style = { left: Math.min(x, window.innerWidth - 250), top: Math.min(y, window.innerHeight - 320) }

  let body: React.ReactNode = null
  if (target === 'void') {
    body = (
      <>
        <div className="px-2.5 py-1 text-xs font-semibold text-white/50">Nouveau</div>
        <button className={item} onClick={act(onShop)}><ShoppingCart className={ic} /> Ouvrir le magasin…</button>
        <button className={item} onClick={act(() => update((s) => addToBox(s, 'W', 1, undefined, WIRE_COLORS[0].hex)))}><Copy className={ic} /> Un fil Dupont dans la boîte</button>
        <button className={item} onClick={act(() => update((s) => addToBox(s, 'R', 1, '220 Ω', '#e3cf9f')))}><Copy className={ic} /> Une résistance 220 Ω dans la boîte</button>
        <button className={item} onClick={act(() => update((s) => addToBox(s, 'LED', 1, undefined, LED_COLORS[0].hex)))}><Copy className={ic} /> Une LED dans la boîte</button>
      </>
    )
  } else if (target.startsWith('anchor:')) {
    const [pid, i] = target.slice(7).split('|')
    const p = session.parts.find((q) => q.id === pid)
    const idx = Number(i)
    const cur = p?.via?.[idx]
    if (!p || !cur) return null
    const setKind = (kind: 'curve' | 'corner') => setPart(pid, { via: p.via!.map((v, k) => (k === idx ? { ...v, kind } : v)) })
    const here = (kind: string) => ((cur.kind ?? 'corner') === kind ? 'bg-white/10' : '')
    body = (
      <>
        <div className="px-2.5 py-1 text-xs font-semibold text-white/50">Ancrage de {p.label}</div>
        <button className={`${item} ${here('curve')}`} onClick={act(() => setKind('curve'))}><Spline className={ic} /> Ancrage courbe</button>
        <button className={`${item} ${here('corner')}`} onClick={act(() => setKind('corner'))}><CornerDownRight className={ic} /> Ancrage d’angle</button>
        <div className="my-1 border-t border-white/10" />
        <button className={`${item} text-red-300`} onClick={act(() => { const rest = p.via!.filter((_, k) => k !== idx); setPart(pid, { via: rest.length ? rest : undefined }) })}><Trash2 className="size-4 shrink-0" /> Supprimer l’ancrage</button>
      </>
    )
  } else if (target.startsWith('node:')) {
    const id = target.slice(5) as NodeId
    const extra = session.extras?.find((e) => e.id === id)
    body = (
      <>
        <div className="px-2.5 py-1 text-xs font-semibold text-white/50">{blockInfo(session, id).title}</div>
        {extra && (extra.kind === 'perf' || extra.kind === 'strip') && (
          <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5">
            {PCB_COLORS.map((c) => (
              <button
                key={c.hex}
                title={c.name}
                onClick={act(() => update((s) => ({ ...s, extras: s.extras?.map((x) => (x.id === extra.id ? { ...x, color: c.hex } : x)) })))}
                className={`h-6 w-6 rounded-full border-2 ${(extra.color ?? (extra.kind === 'strip' ? '#b98b4d' : '#3f7a4a')) === c.hex ? 'border-emerald-300' : 'border-white/20'}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        )}
        {extra && <button className={item} onClick={act(() => update((s) => addExtra(s, extra)))}><Copy className={ic} /> Ajouter 1 pareille à la boîte</button>}
        <button className={item} onClick={act(() => update((s) => rotateNode(s, id, 90)))}><RotateCw className={ic} /> Pivoter de 90° <kbd className="ml-auto text-white/35">R</kbd></button>
        <button className={item} onClick={act(() => update((s) => rotateNode(s, id, -90)))}><RotateCcw className={ic} /> Pivoter dans l'autre sens</button>
        {id !== 'bb' && (
          <>
            <div className="my-1 border-t border-white/10" />
            <button className={item} onClick={act(() => update((s) => unplaceBlock(s, id)))}><Archive className={ic} /> Ranger dans la boîte</button>
            <button className={`${item} text-red-300`} onClick={act(() => update((s) => removeBlock(s, id)))}><Trash2 className="size-4 shrink-0" /> Supprimer de la boîte</button>
          </>
        )}
      </>
    )
  } else {
    const p = session.parts.find((q) => q.id === target)
    if (!p) return null
    // Seuls les fils et les LED ont une couleur à choisir ; une résistance, un transistor… ont leur look.
    const colors = p.kind === 'LED' ? LED_COLORS : p.kind === 'W' || p.kind === 'L' ? WIRE_COLORS : null
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
        {p.kind !== 'L' && (
          <button className={item} onClick={act(() => update((s) => addToBox(s, p.kind as Exclude<Part['kind'], 'L'>, 1, p.value, p.color)))}>+ Ajouter 1 pareille à la boîte</button>
        )}
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
        {HAS_VALUE(p.kind) && <button className={item} onClick={act(editValue)}><SlidersHorizontal className={ic} /> Changer la valeur…</button>}
        {p.kind !== 'L' && (
          <button className={item} onClick={act(async () => { const n = await ask(`Renommer ${p.label}`, p.label); if (n) setPart(p.id, { label: n }) })}><Pencil className={ic} /> Renommer…</button>
        )}
        {POLAR.includes(p.kind) && p.a && (
          <button className={item} onClick={act(() => setPart(p.id, { a: p.b, b: p.a }))}><ArrowLeftRight className={ic} /> Inverser le sens (+ / −)</button>
        )}
        {p.kind === 'W' && p.b && (
          <>
            <button className={item} onClick={act(() => update((x) => addAnchor(x, p.id, 'curve')))}><Spline className={ic} /> Ajouter un ancrage courbe</button>
            <button className={item} onClick={act(() => update((x) => addAnchor(x, p.id, 'corner')))}><CornerDownRight className={ic} /> Ajouter un ancrage d’angle</button>
            {(p.via?.length || p.bend !== undefined) && (
              <button className={item} onClick={act(() => setPart(p.id, { via: undefined, bend: undefined }))}><Eraser className={ic} /> Retirer les ancrages</button>
            )}
          </>
        )}
        {legCount(p.kind) > 2 && p.a && (
          <button className={item} onClick={act(() => setPart(p.id, legCount(p.kind) === 3 ? { a: p.c ?? null, c: p.a } : { a: p.d ?? null, d: p.a, b: p.c ?? null, c: p.b }))}><ArrowLeftRight className={ic} /> Retourner (première ↔ dernière patte)</button>
        )}
        <div className="my-1 border-t border-white/10" />
        {(p.kind === 'L' ? p.b : p.a) && (
          <button className={item} onClick={act(() => setPart(p.id, unplacePart(p)))}>{p.kind === 'L' ? <Unplug className={ic} /> : <Undo2 className={ic} />} {p.kind === 'L' ? 'Débrancher' : 'Remettre dans la boîte'} <kbd className="ml-auto text-white/35">⌫</kbd></button>
        )}
        {p.kind !== 'L' && (
          <button className={`${item} text-red-300`} onClick={act(() => update((s) => ({ ...s, parts: s.parts.filter((q) => q.id !== p.id) })))}><Trash2 className="size-4 shrink-0" /> Supprimer de la boîte</button>
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
