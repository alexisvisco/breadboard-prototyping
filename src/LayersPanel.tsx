// Panneau flottant des calques d'annotation (en haut à droite du canevas).
// Un calque peut être « en focus » : le reste du montage est grisé et la vue zoome sur la mesure.

import { Check, Eye, X } from 'lucide-react'
import { useState } from 'react'
import { annColor, portName, stepPort, stepText, type Layer } from './layers'

interface Props {
  layers: Layer[]
  focusId: string | null
  onToggle: (l: Layer) => void
  onDelete: (l: Layer) => void
  onFocus: (l: Layer | null) => void
  onLocate: (port: string) => void
}

export function LayersPanel({ layers, focusId, onToggle, onDelete, onFocus, onLocate }: Props) {
  const [open, setOpen] = useState(true)
  const [why, setWhy] = useState<Record<string, boolean>>({})
  if (!layers.length) return null
  const shown = layers.filter((l) => l.visible).length
  return (
    <div className="absolute right-4 top-4 w-[22rem] overflow-hidden rounded-lg border border-white/10 bg-[#18211d]/95 text-sm shadow-lg backdrop-blur">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/5">
        <span className="font-semibold">Calques <span className="font-normal text-white/45">· {shown}/{layers.length} affichés</span></span>
        <span className="text-white/40">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="max-h-[60vh] overflow-y-auto border-t border-white/10 p-1.5">
          {layers.map((l) => {
            const dots = [...new Set(l.items.map((it) => annColor(it.color)))].slice(0, 5)
            const focused = focusId === l.id
            const steps = l.steps ?? []
            return (
              <li key={l.id} className={`group rounded-md px-2 py-1.5 ${focused ? 'bg-yellow-300/10 ring-1 ring-yellow-300/40' : 'hover:bg-white/5'}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={l.visible} onChange={() => onToggle(l)} className="h-4 w-4 accent-emerald-400" />
                  <button onClick={() => onFocus(focused ? null : l)} className={`min-w-0 flex-1 truncate text-left ${l.visible ? '' : 'text-white/45'}`} title="Se concentrer sur ce calque">
                    {l.name}
                  </button>
                  <span className="flex gap-0.5">{dots.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: c }} />)}</span>
                  <button
                    onClick={() => onFocus(focused ? null : l)}
                    className={`rounded px-1.5 py-0.5 text-xs ${focused ? 'bg-yellow-300 text-[#0d1512]' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                    title="Griser le reste et zoomer sur la mesure"
                  >
                    {focused ? <><Check className="inline size-3" /> Focus</> : 'Focus'}
                  </button>
                  <button title="Supprimer le calque" onClick={() => onDelete(l)} className="invisible px-1 text-white/40 hover:text-red-300 group-hover:visible"><X className="size-3.5" /></button>
                </div>

                {l.visible && steps.length > 0 && (
                  <ol className="mt-2 grid gap-1 pl-1">
                    {steps.map((st, i) => {
                      const port = stepPort(st)
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold">{i + 1}</span>
                          <span className="flex-1 leading-snug">{stepText(st)}</span>
                          {port && (
                            <button onClick={() => onLocate(port)} className="shrink-0 rounded bg-white/10 px-1.5 text-xs hover:bg-white/20" title={`Montrer ${portName(port)}`}>
                              <Eye className="mr-1 inline size-3" />{portName(port)}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
                {l.visible && l.description && (steps.length > 0 ? (
                  <div className="mt-1.5 pl-1">
                    <button onClick={() => setWhy((w) => ({ ...w, [l.id]: !w[l.id] }))} className="text-xs text-white/50 hover:text-white/80">
                      {why[l.id] ? '▾' : '▸'} Pourquoi ?
                    </button>
                    {why[l.id] && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-white/60">{l.description}</p>}
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-line pl-6 text-xs leading-relaxed text-white/60">{l.description}</p>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
