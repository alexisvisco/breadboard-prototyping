// Panneau flottant des calques d'annotation (en haut à droite du canevas).

import { useState } from 'react'
import { annColor, type Layer } from './layers'

interface Props {
  layers: Layer[]
  onToggle: (l: Layer) => void
  onDelete: (l: Layer) => void
}

export function LayersPanel({ layers, onToggle, onDelete }: Props) {
  const [open, setOpen] = useState(true)
  if (!layers.length) return null
  const shown = layers.filter((l) => l.visible).length
  return (
    <div className="absolute right-4 top-4 w-80 overflow-hidden rounded-lg border border-white/10 bg-[#18211d]/95 text-sm shadow-lg backdrop-blur">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/5">
        <span className="font-semibold">Calques <span className="font-normal text-white/45">· {shown}/{layers.length} affichés</span></span>
        <span className="text-white/40">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="max-h-[50vh] overflow-y-auto border-t border-white/10 p-1.5">
          {layers.map((l) => {
            const dots = [...new Set(l.items.map((it) => annColor(it.color)))].slice(0, 5)
            return (
              <li key={l.id} className="group rounded-md px-2 py-1.5 hover:bg-white/5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={l.visible} onChange={() => onToggle(l)} className="h-4 w-4 accent-emerald-400" />
                  <span className={`min-w-0 flex-1 truncate ${l.visible ? '' : 'text-white/45'}`}>{l.name}</span>
                  <span className="flex gap-0.5">{dots.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: c }} />)}</span>
                  {l.author && <span className="rounded bg-white/10 px-1.5 text-[10px] uppercase text-white/50">{l.author}</span>}
                  <button title="Supprimer le calque" onClick={() => onDelete(l)} className="invisible px-1 text-white/40 hover:text-red-300 group-hover:visible">×</button>
                </div>
                {l.visible && l.description && <p className="mt-1 whitespace-pre-line pl-6 text-xs leading-relaxed text-white/60">{l.description}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
