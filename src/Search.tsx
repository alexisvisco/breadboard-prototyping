import { useEffect, useMemo, useState } from 'react'
import { EXTRA_PORT } from './boards'
import { BB_HOLE, CARD_PINS, JACK_LEADS, holeLabel } from './geom'
import { partName, type Session } from './model'

export interface SearchHit {
  key: string
  title: string
  sub: string
  /** Port à centrer et faire clignoter, ou pièce à sélectionner. */
  port?: string
  partId?: string
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

function search(session: Session, q: string): SearchHit[] {
  const n = norm(q)
  if (!n) return []
  const hits: SearchHit[] = []

  // Trou : « a12 », « j5 ».
  const hole = /^([a-j])\s*(\d{1,2})$/.exec(n)
  if (hole && BB_HOLE.has(`${hole[1]}${hole[2]}`)) {
    const id = `${hole[1]}${hole[2]}`
    hits.push({ key: id, title: `Trou ${id}`, sub: 'breadboard', port: id })
  }
  // Rail : « +h7 », « - bas 12 », « rail + haut 3 ».
  const rail = /^(?:rail\s*)?([+-])\s*(h|haut|b|bas)?\s*(\d{1,2})$/.exec(n)
  if (rail) {
    const sides = rail[2] ? [rail[2].startsWith('h') ? 'H' : 'B'] : ['H', 'B']
    for (const s of sides) {
      const id = `${rail[1]}${s}${rail[3]}`
      if (BB_HOLE.has(id)) hits.push({ key: id, title: holeLabel(id), sub: 'breadboard', port: id })
    }
  }
  // Colonne : « colonne 12 », « col 12 ».
  const col = /^col(?:onne)?\s*(\d{1,2})$/.exec(n)
  if (col && BB_HOLE.has(`a${col[1]}`)) {
    hits.push({ key: `a${col[1]}`, title: `Colonne ${col[1]} (a–e)`, sub: 'breadboard', port: `a${col[1]}` })
    hits.push({ key: `f${col[1]}`, title: `Colonne ${col[1]} (f–j)`, sub: 'breadboard', port: `f${col[1]}` })
  }
  // Planches ajoutées : trou exact (« e12 », « c4 ») ou broche par son nom.
  const placed = new Set(Object.keys(session.nodes))
  for (const x of EXTRA_PORT.values()) {
    if (!placed.has(x.node) || hits.length > 40) continue
    const title = session.extras?.find((e) => e.id === x.node)?.title ?? x.node
    if (x.kind === 'hole' ? norm(x.name) === n : norm(x.name).includes(n))
      hits.push({ key: x.id, title: x.kind === 'hole' ? `Trou ${x.name}` : `Broche ${x.name}`, sub: title, port: x.id })
  }
  for (const p of session.parts) {
    if (norm(`${p.label} ${p.value ?? ''}`).includes(n))
      hits.push({ key: p.id, title: partName(p), sub: p.kind === 'L' ? 'câble jack' : p.a ? 'pièce posée' : 'dans la boîte', partId: p.id, port: p.b ?? p.a ?? undefined })
  }
  if (session.nodes.card)
  for (const pin of CARD_PINS)
    if (norm(pin.name).includes(n)) hits.push({ key: pin.id, title: `Broche ${pin.name}`, sub: `carte, connecteur ${pin.side === 'L' ? 'gauche' : 'droit'}`, port: pin.id })
  if (session.blocks.includes('jack'))
  for (const l of JACK_LEADS)
    if (norm(l.label).includes(n) && !hits.some((h) => h.partId === l.id)) hits.push({ key: l.id, title: `Fil ${l.label}`, sub: 'câble jack', partId: l.id })
  return hits.slice(0, 30)
}

export function Search({ session, open, onClose, onPick }: { session: Session; open: boolean; onClose: () => void; onPick: (h: SearchHit) => void }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const hits = useMemo(() => search(session, q), [session, q])
  useEffect(() => setI(0), [q])
  useEffect(() => {
    if (open) setQ('')
  }, [open])
  if (!open) return null

  const pick = (h?: SearchHit) => {
    if (!h) return
    onPick(h)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]" onPointerDown={onClose}>
      <div className="w-[min(560px,92vw)] overflow-hidden rounded-xl border border-white/15 bg-[#18211d] shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, hits.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
            if (e.key === 'Enter') pick(hits[i])
          }}
          placeholder="Chercher : a12, + bas 7, colonne 30, IO9, GND, R2, manchon…"
          className="w-full border-b border-white/10 bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-white/35"
        />
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {hits.map((h, k) => (
            <li
              key={h.key + k}
              onPointerEnter={() => setI(k)}
              onClick={() => pick(h)}
              className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2 text-sm ${k === i ? 'bg-emerald-400/15' : ''}`}
            >
              <span>{h.title}</span>
              <span className="text-xs text-white/45">{h.sub}</span>
            </li>
          ))}
          {q && !hits.length && <li className="px-4 py-3 text-sm text-white/45">Rien trouvé. Essaie « a12 », « IO9 » ou « R2 ».</li>}
          {!q && <li className="px-4 py-3 text-sm text-white/45">Trous, rails, colonnes, broches de la carte, pièces posées, fils du jack.</li>}
        </ul>
      </div>
    </div>
  )
}
