// Magasin : on choisit ce qu'on a chez soi, ça part dans la boîte de la session.
// Trois rayons : composants, planches (breadboards et plaques perforées sur mesure), cartes (ESP et autres).

import { useState } from 'react'
import { BREAD_PRESETS, MCU_MODELS, type Extra } from './boards'
import { BlockIcon, ExtraIcon, PartIcon } from './Box'
import { BLOCKS, OHM_KINDS, SHOP, WIRE_COLORS, SHOP_CATS, formatOhms, parseOhms, resistorBands, type BlockId, type ShopItem } from './model'

interface Props {
  open: boolean
  owned: BlockId[]
  onClose: () => void
  onAdd: (item: ShopItem, qty: number, value: string | undefined, color: string) => void
  onAddBlock: (b: BlockId) => void
  onAddExtra: (spec: Omit<Extra, 'id'>) => void
}

type Tab = 'parts' | 'boards' | 'cards'
const TABS: [Tab, string][] = [['parts', 'Composants'], ['boards', 'Planches'], ['cards', 'Cartes']]

const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const addBtn = 'rounded-md bg-emerald-500/90 px-3 py-1.5 text-sm font-semibold text-[#0d1512] hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/40'
const field = 'rounded-md border border-white/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-emerald-400/60'

export function Shop({ open, owned, onClose, onAdd, onAddBlock, onAddExtra }: Props) {
  const [tab, setTab] = useState<Tab>('parts')
  const [q, setQ] = useState('')
  if (!open) return null
  // Une recherche parcourt tous les rayons à la fois.
  const words = norm(q).split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const hit = (...texts: (string | undefined)[]) => {
    const t = norm(texts.filter(Boolean).join(' '))
    return words.every((w) => t.includes(w))
  }
  const shown = (t: Tab) => (searching ? true : tab === t)
  const parts = SHOP.filter((it) => !searching || hit(it.title, it.desc, it.kind, it.cat, ...(it.values ?? []), ...(it.colors?.map((c) => c.name) ?? [])))
  const blocks = (['card', 'jack'] as const).filter((b) => !searching || hit(BLOCKS[b].title, BLOCKS[b].desc))
  const mcus = Object.entries(MCU_MODELS).filter(([k, m]) => !searching || hit(k, m.title, m.desc, m.module, m.note))
  const showBread = !searching || hit('breadboard platine essai planche colonnes rails')
  const showPerf = !searching || hit('plaque perforée perfboard stripboard bandes planche pastilles')
  const none = searching && !parts.length && !blocks.length && !mcus.length && !showBread && !showPerf
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
        <div className="flex items-center gap-3 border-b border-white/10 px-5 pt-2">
          <div className="flex gap-1">
            {TABS.map(([t, label]) => (
              <button key={t} onClick={() => { setTab(t); setQ('') }} className={`px-4 py-2 text-sm ${!searching && tab === t ? 'border-b-2 border-emerald-400 text-white' : 'text-white/50 hover:text-white/80'}`}>
                {label}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher : transistor, 10k, ESP32, perfboard…"
            className="mb-1.5 ml-auto w-72 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm outline-none placeholder:text-white/35 focus:border-emerald-400/60"
          />
        </div>

        {none && <p className="p-5 text-sm text-white/50">Rien ne correspond à « {q} ».</p>}

        {shown('parts') &&
          SHOP_CATS.map((cat) =>
            parts.some((it) => it.cat === cat) ? (
              <div key={cat} className="p-5 pb-0 last:pb-5">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">{cat}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {parts.filter((it) => it.cat === cat).map((it) => <ShopCard key={it.title} item={it} onAdd={onAdd} />)}
                </div>
              </div>
            ) : null,
          )}

        {shown('boards') && (showBread || showPerf) && (
          <div className="grid gap-3 p-5">
            {showBread && <BreadForm onAdd={onAddExtra} />}
            {showPerf && <PerfForm onAdd={onAddExtra} />}
          </div>
        )}

        {shown('cards') && (blocks.length > 0 || mcus.length > 0) && (
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {blocks.map((b) => (
                <Row key={b} icon={<BlockIcon id={b} />} title={BLOCKS[b].title} desc={BLOCKS[b].desc}>
                  <button disabled={owned.includes(b)} onClick={() => onAddBlock(b)} className={addBtn}>{owned.includes(b) ? 'Dans la boîte' : 'Ajouter'}</button>
                </Row>
              ))}
            </div>
            <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-white/45">Cartes de développement</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {mcus.map(([model, m]) => (
                <Row key={model} icon={<ExtraIcon kind="mcu" color={m.color} />} title={m.title} desc={`${m.desc}${m.note ? ` — ${m.note}` : ''}`}>
                  <button onClick={() => onAddExtra({ kind: 'mcu', title: m.title.replace(/ \(.*\)$/, ''), model })} className={addBtn}>Ajouter</button>
                </Row>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">Tu peux en ajouter plusieurs. Relie leurs broches avec des fils Dupont ; l’app vérifie les courts-circuits d’alimentation.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs leading-snug text-white/50">{desc}</div>
      </div>
      {children}
    </div>
  )
}

const num = (v: string, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : d
}

function BreadForm({ onAdd }: { onAdd: Props['onAddExtra'] }) {
  const [cols, setCols] = useState('30')
  const [rails, setRails] = useState(true)
  const [title, setTitle] = useState('')
  const c = num(cols, 5, 100, 30)
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <ExtraIcon kind="bread" />
        <div>
          <div className="text-sm font-medium">Breadboard</div>
          <div className="text-xs text-white/50">Colonnes de 5 trous reliées (a–e, f–j), canal au milieu, rails + − en option.</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {BREAD_PRESETS.map((p) => (
          <button key={p.title} onClick={() => onAdd({ kind: 'bread', title: p.title.replace(/ \(.*\)$/, ''), cols: p.cols, rails: p.rails })} className="rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/10">
            + {p.title}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-white/10 pt-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Sur mesure</span>
        <label className="grid gap-1 text-xs text-white/55">Colonnes (5–100)
          <input value={cols} onChange={(e) => setCols(e.target.value)} inputMode="numeric" className={`${field} w-20`} />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-xs text-white/70">
          <input type="checkbox" checked={rails} onChange={(e) => setRails(e.target.checked)} /> rails + −
        </label>
        <label className="grid gap-1 text-xs text-white/55">Nom (facultatif)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Breadboard ${c} col.`} className={`${field} w-44`} />
        </label>
        <button onClick={() => onAdd({ kind: 'bread', title: title.trim() || `Breadboard ${c} col.`, cols: c, rails })} className={addBtn}>Ajouter</button>
      </div>
    </div>
  )
}

const PERF_PRESETS = [
  { label: '5 × 7 cm', cols: 18, rows: 24 },
  { label: '7 × 9 cm', cols: 24, rows: 30 },
  { label: '9 × 15 cm', cols: 36, rows: 60 },
  { label: 'Petite', cols: 12, rows: 10 },
]

function PerfForm({ onAdd }: { onAdd: Props['onAddExtra'] }) {
  const [cols, setCols] = useState('20')
  const [rows, setRows] = useState('14')
  const [strip, setStrip] = useState(false)
  const [title, setTitle] = useState('')
  const c = num(cols, 3, 60, 20)
  const r = num(rows, 3, 60, 14)
  const kind = strip ? 'strip' : 'perf'
  const name = strip ? 'Stripboard' : 'Plaque perforée'
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <ExtraIcon kind={kind} />
        <div>
          <div className="text-sm font-medium">Plaque perforée (perfboard)</div>
          <div className="text-xs text-white/50">Chaque pastille est isolée : tu relies avec des fils (ponts de soudure). Stripboard : chaque ligne est une bande de cuivre.</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PERF_PRESETS.map((p) => (
          <button key={p.label} onClick={() => onAdd({ kind, title: `${name} ${p.label}`, cols: p.cols, rows: p.rows })} className="rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/10">
            + {p.label} ({p.cols} × {p.rows})
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-white/10 pt-3 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Sur mesure</span>
        <label className="grid gap-1 text-xs text-white/55">Colonnes (3–60)
          <input value={cols} onChange={(e) => setCols(e.target.value)} inputMode="numeric" className={`${field} w-20`} />
        </label>
        <label className="grid gap-1 text-xs text-white/55">Lignes (3–60)
          <input value={rows} onChange={(e) => setRows(e.target.value)} inputMode="numeric" className={`${field} w-20`} />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-xs text-white/70">
          <input type="checkbox" checked={strip} onChange={(e) => setStrip(e.target.checked)} /> bandes (stripboard)
        </label>
        <label className="grid gap-1 text-xs text-white/55">Nom (facultatif)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${name} ${c} × ${r}`} className={`${field} w-44`} />
        </label>
        <button onClick={() => onAdd({ kind, title: title.trim() || `${name} ${c} × ${r}`, cols: c, rows: r })} className={addBtn}>Ajouter</button>
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

  const ohms = OHM_KINDS.includes(item.kind)
  let finalValue = custom.trim() || value
  if (ohms && custom.trim()) {
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
      {ohms && custom.trim() && !finalValue && <div className="text-xs text-red-300">Valeur pas comprise (ex. 220, 4.7k, 1M)</div>}
      {(
        <div className="flex flex-wrap gap-1.5">
          <button title="Couleur d’origine" onClick={() => setColor(item.color)} className={`h-6 rounded-full border-2 px-2 text-[10px] ${color === item.color ? 'border-emerald-300' : 'border-white/15'}`} style={{ background: item.color, color: '#111' }}>
            {item.colors ? '' : 'normal'}
          </button>
          {(item.colors ?? WIRE_COLORS).filter((c) => c.hex !== item.color).map((c) => (
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
          className={`flex-1 ${addBtn}`}
        >
          Ajouter à la boîte
        </button>
        {added > 0 && <span className="text-xs text-emerald-300">+{added}</span>}
      </div>
    </div>
  )
}
