// Magasin : on choisit ce qu'on a chez soi, ça part dans la boîte de la session.

import { useState } from 'react'
import { BlockIcon, PartIcon } from './Box'
import { BLOCKS, SHOP, formatOhms, parseOhms, resistorBands, type BlockId, type ShopItem } from './model'

interface Props {
  open: boolean
  owned: BlockId[]
  onClose: () => void
  onAdd: (item: ShopItem, qty: number, value: string | undefined, color: string) => void
  onAddBlock: (b: BlockId) => void
}

export function Shop({ open, owned, onClose, onAdd, onAddBlock }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 py-[6vh]" onPointerDown={onClose}>
      <div className="w-[min(920px,94vw)] rounded-xl border border-white/15 bg-[#18211d] shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold">Magasin</h2>
            <p className="text-xs text-white/50">Ajoute à ta boîte ce que tu as vraiment sous la main. Tout est gratuit 😄</p>
          </div>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-white/10">Fermer · Échap</button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {SHOP.map((it) => <ShopCard key={it.kind} item={it} onAdd={onAdd} />)}
        </div>
        <div className="border-t border-white/10 p-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">Blocs</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['card', 'jack'] as BlockId[]).map((b) => (
              <div key={b} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <BlockIcon id={b} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{BLOCKS[b].title}</div>
                  <div className="text-xs text-white/50">{BLOCKS[b].desc}</div>
                </div>
                <button
                  disabled={owned.includes(b)}
                  onClick={() => onAddBlock(b)}
                  className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-sm font-semibold text-[#0d1512] hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/40"
                >
                  {owned.includes(b) ? 'Dans la boîte' : 'Ajouter'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ShopCard({ item, onAdd }: { item: ShopItem; onAdd: Props['onAdd'] }) {
  const [value, setValue] = useState(item.values?.[0])
  const [custom, setCustom] = useState('')
  const [color, setColor] = useState(item.color)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(0)

  let finalValue = custom.trim() || value
  if (item.kind === 'R' && custom.trim()) {
    const o = parseOhms(custom)
    finalValue = o ? formatOhms(o) : undefined
  }
  const bands = item.kind === 'R' ? resistorBands(finalValue) : []
  const invalid = !!item.values && !finalValue

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start gap-3">
        <PartIcon kind={item.kind} value={finalValue} color={color} />
        <div>
          <div className="text-sm font-medium">{item.title}</div>
          <div className="text-xs leading-snug text-white/50">{item.desc}</div>
        </div>
      </div>
      {item.values && (
        <div className="flex flex-wrap gap-1.5">
          {item.values.map((v) => (
            <button
              key={v}
              onClick={() => { setValue(v); setCustom('') }}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${!custom && value === v ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200' : 'border-white/15 hover:bg-white/10'}`}
            >
              {v}
            </button>
          ))}
          {item.custom && (
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={item.custom}
              className="w-24 rounded-full border border-white/15 bg-transparent px-2.5 py-0.5 text-xs outline-none placeholder:text-white/35 focus:border-emerald-400/60"
            />
          )}
        </div>
      )}
      {bands.length > 0 && (
        <div className="text-xs text-white/55">
          Anneaux : {bands.map(([n]) => n).join(' · ')}
        </div>
      )}
      {item.kind === 'R' && custom.trim() && !finalValue && <div className="text-xs text-red-300">Valeur pas comprise (ex. 220, 4.7k, 1M)</div>}
      {item.colors && (
        <div className="flex flex-wrap gap-1.5">
          {item.colors.map((c) => (
            <button
              key={c.hex}
              title={c.name}
              onClick={() => setColor(c.hex)}
              className={`h-6 w-6 rounded-full border-2 ${color === c.hex ? 'border-emerald-300' : 'border-white/15'}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center gap-2">
        <div className="flex items-center rounded-md border border-white/15">
          <button className="px-2 py-1 hover:bg-white/10" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-7 text-center text-sm tabular-nums">{qty}</span>
          <button className="px-2 py-1 hover:bg-white/10" onClick={() => setQty((q) => Math.min(50, q + 1))}>＋</button>
        </div>
        <button
          disabled={invalid}
          onClick={() => {
            onAdd(item, qty, finalValue, color)
            setAdded((a) => a + qty)
          }}
          className="flex-1 rounded-md bg-emerald-500/90 px-3 py-1.5 text-sm font-semibold text-[#0d1512] hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/40"
        >
          Ajouter à la boîte
        </button>
        {added > 0 && <span className="text-xs text-emerald-300">+{added}</span>}
      </div>
    </div>
  )
}
