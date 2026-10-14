// Panneau de gauche : la boîte de la session (ce qu'on a acheté au magasin), à glisser sur le canevas.

import { useState } from 'react'
import { MultiBody, PartBody } from './PartArt'
import { blockInfo, isPlaced, legCount, partName, placeText, type BlockId, type Kind, type Part, type Session } from './model'
import type { Extra } from './boards'

export function PartIcon({ kind, value, color }: { kind: Kind; value?: string; color: string }) {
  if (kind === 'W' || kind === 'L')
    return (
      <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
        <path d="M6,8 C20,26 44,26 58,8" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
        <rect x={2} y={4} width={8} height={7} rx={1} fill="#bfc3c8" />
        <rect x={54} y={4} width={8} height={7} rx={1} fill="#bfc3c8" />
      </svg>
    )
  if (legCount(kind) > 2)
    return (
      <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
        {[24, 32, 40].map((x) => <line key={x} x1={x} y1={14} x2={x} y2={24} stroke="#8a9096" strokeWidth={2} />)}
        <g transform="translate(32,10) scale(0.55)">
          <MultiBody p={{ kind, value, color }} />
        </g>
      </svg>
    )
  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
      <line x1={2} y1={12} x2={62} y2={12} stroke="#8a9096" strokeWidth={2} />
      <g transform="translate(32,12) scale(0.8)">
        <PartBody p={{ kind, value, color }} />
      </g>
    </svg>
  )
}

export function ExtraIcon({ kind, color }: { kind: Extra['kind']; color?: string }) {
  if (kind === 'bread')
    return (
      <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
        <rect x={6} y={2} width={52} height={20} rx={3} fill="#f3f1ea" stroke="#cfc9b8" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => [7, 17].map((y) => <rect key={`${i}-${y}`} x={11 + i * 4.6} y={y - 1} width={2.2} height={2.2} fill="#8a8574" />))}
        <rect x={9} y={11} width={46} height={2} fill="#d9d3c0" />
      </svg>
    )
  if (kind === 'mcu')
    return (
      <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
        <rect x={16} y={1} width={32} height={22} rx={3} fill={color ?? '#d7192f'} />
        <rect x={25} y={3} width={14} height={9} fill="#c9ccd1" />
        {[0, 1, 2, 3, 4].flatMap((i) => [19, 45].map((x) => <circle key={`${i}-${x}`} cx={x} cy={4 + i * 4} r={1.3} fill="#d9b44a" />))}
      </svg>
    )
  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
      <rect x={10} y={2} width={44} height={20} rx={2} fill={color ?? (kind === 'strip' ? '#b98b4d' : '#3f7a4a')} />
      {[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [7, 12, 17].map((y) => <circle key={`${i}-${y}`} cx={15 + i * 5} cy={y} r={1.5} fill="#d9b44a" />))}
    </svg>
  )
}

export function BlockIcon({ id, extra }: { id: BlockId; extra?: Extra }) {
  if (extra) return <ExtraIcon kind={extra.kind} color={extra.kind === 'mcu' ? undefined : extra.color} />
  return id === 'card' ? (
    <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
      <rect x={18} y={1} width={28} height={22} rx={3} fill="#d7192f" />
      <rect x={30} y={3} width={13} height={10} fill="#1d1d1d" />
      {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={21} cy={5 + i * 3.5} r={1.2} fill="#d9b44a" />)}
    </svg>
  ) : (
    <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
      <rect x={6} y={9} width={10} height={6} rx={1} fill="#c9ccd1" />
      <path d="M16,12 L34,12 M34,12 C40,12 44,5 58,5 M34,12 C40,12 44,19 58,19" stroke="#1d1d1d" strokeWidth={3} fill="none" />
    </svg>
  )
}

const GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: 'Résistances et capteurs passifs', kinds: ['R', 'POT', 'LDR', 'NTC'] },
  { title: 'Condensateurs et bobines', kinds: ['CE', 'CC', 'IND'] },
  { title: 'LED et diodes', kinds: ['LED', 'RGB', 'D'] },
  { title: 'Transistors et régulateurs', kinds: ['NPN', 'PNP', 'NMOS', 'REG'] },
  { title: 'Boutons, sorties et capteurs', kinds: ['BTN', 'SW', 'BZ', 'MOT', 'SERVO', 'SONAR'] },
  { title: 'Piles', kinds: ['BAT'] },
  { title: 'Fils Dupont', kinds: ['W'] },
  { title: 'Fils du câble jack', kinds: ['L'] },
]

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

interface Props {
  session: Session
  onShop: () => void
  onLocate: (target: string) => void
  onRemovePart: (p: Part) => void
  onRemoveBlock: (b: BlockId) => void
  onContext: (target: string, x: number, y: number) => void
  selected: string | null
}

export function Box({ session, onShop, onLocate, onRemovePart, onRemoveBlock, onContext, selected }: Props) {
  const [q, setQ] = useState('')
  const match = (t: string) => !q || norm(t).includes(norm(q))
  const empty = !session.blocks.length && !session.parts.length
  const row = 'group flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition'
  const free = 'cursor-grab border-white/10 bg-white/[0.04] hover:border-emerald-400/40 hover:bg-white/[0.08] active:cursor-grabbing'
  const used = 'cursor-pointer border-transparent bg-transparent opacity-60 hover:opacity-100'

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <button onClick={onShop} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-[#0d1512] hover:bg-emerald-400">
          <span>🛒</span> Magasin
        </button>
        {!empty && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer : 10k, C1, rouge…"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-emerald-400/60"
          />
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-4" onContextMenu={(e) => { if (!e.defaultPrevented) { e.preventDefault(); onContext('void', e.clientX, e.clientY) } }}>
        {empty && (
          <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm leading-relaxed text-white/55">
            Ta boîte est vide. Ouvre le <b className="text-white/80">magasin</b> et ajoute ce que tu as sous la main : résistances, condensateurs, fils, la carte…
            <br />
            <br />
            Ensuite, glisse chaque pièce d'ici vers la breadboard.
          </div>
        )}

        {session.blocks.some((b) => match(blockInfo(session, b).title)) && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Blocs</h3>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              {session.blocks.filter((b) => match(blockInfo(session, b).title)).map((b) => {
                const on = !!session.nodes[b]
                return (
                  <div
                    key={b}
                    draggable={!on}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', `block:${b}`)}
                    onClick={() => on && onLocate(`node:${b}`)}
                    onContextMenu={(e) => { e.preventDefault(); onContext(`node:${b}`, e.clientX, e.clientY) }}
                    className={`${row} ${on ? used : free} ${selected === `node:${b}` ? 'ring-1 ring-yellow-300/60' : ''}`}
                  >
                    <BlockIcon id={b} extra={session.extras?.find((x) => x.id === b)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium leading-tight">{blockInfo(session, b).title}</div>
                      <div className="truncate text-xs text-white/45">{on ? 'posé · clic pour le voir' : 'à glisser sur le canevas'}</div>
                    </div>
                    <Remove onClick={() => onRemoveBlock(b)} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {GROUPS.map((g) => {
          const items = session.parts.filter((p) => g.kinds.includes(p.kind) && match(`${partName(p)} ${p.value ?? ''}`))
          if (!items.length) return null
          const jackOff = g.kinds.includes('L') && !session.nodes.jack
          return (
            <section key={g.title}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {g.title} <span className="font-normal text-white/30">· {items.filter(isPlaced).length}/{items.length} posés</span>
              </h3>
              {jackOff && <p className="mb-1.5 text-xs text-white/40">Pose le câble jack sur le canevas pour brancher ses fils.</p>}
              <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {items.map((p) => {
                  const on = isPlaced(p)
                  // Les fils du jack se branchent depuis le canevas (ils partent du câble).
                  const draggable = !on && p.kind !== 'L'
                  return (
                    <div
                      key={p.id}
                      draggable={draggable}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', `part:${p.id}`)}
                      onClick={() => (on || p.kind === 'L') && onLocate(p.id)}
                      onContextMenu={(e) => { e.preventDefault(); onContext(p.id, e.clientX, e.clientY) }}
                      className={`${row} ${draggable ? free : used} ${selected === p.id ? 'ring-1 ring-yellow-300/60' : ''}`}
                    >
                      <PartIcon kind={p.kind} value={p.value} color={p.color} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium leading-tight">
                          {p.kind === 'L' ? p.label : p.label}{' '}
                          {p.value && <span className="font-normal text-white/60">{p.value}</span>}
                        </div>
                        <div className="truncate text-xs text-white/45">{on ? placeText(p) : p.kind === 'L' ? 'débranché' : 'dans la boîte'}</div>
                      </div>
                      {p.kind !== 'L' && <Remove onClick={() => onRemovePart(p)} />}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button
      title="Retirer de la boîte"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="invisible rounded px-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-300 group-hover:visible"
    >
      ×
    </button>
  )
}
