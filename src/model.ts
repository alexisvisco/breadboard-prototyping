// Sessions, magasin, boîte de pièces, analyse électrique et comparaison de versions.
// Rien ici n'est propre à un montage précis : l'analyse ne connaît que les règles générales.

import {
  BB_H, BB_HOLE, BB_W, CARD_H, CARD_PIN, CARD_PINS, CARD_W, JACK_H, JACK_LEAD, JACK_LEADS, JACK_W, Nets, holeLabel, isHole,
  stripLabel, stripOf, type Pos,
} from './geom'

// ------------------------------------------------------------------ types

/** R résistance · CE condensateur chimique · CC céramique · LED · D diode · BTN bouton · W fil Dupont · L fil du câble jack */
export type Kind = 'R' | 'CE' | 'CC' | 'LED' | 'D' | 'BTN' | 'W' | 'L'
export type BlockId = 'card' | 'jack'
export type NodeId = 'bb' | BlockId

/**
 * Une pièce de la boîte. `a` / `b` : ports où sont plantées ses deux pattes (null = pas posée).
 * CE et LED : `a` est la patte + (longue). D : `a` est l'anode, `b` la cathode (côté bague).
 * L : `a` est le départ fixe sur le câble jack, `b` le bout dénudé.
 */
export interface Part {
  id: string
  kind: Kind
  label: string
  value?: string
  color: string
  a: string | null
  b: string | null
}

export interface Session {
  id: string
  name: string
  createdAt: string
  /** Blocs posés sur le canevas (la breadboard est toujours là). */
  nodes: { bb: Pos; card?: Pos; jack?: Pos }
  /** Blocs présents dans la boîte (posés ou non). */
  blocks: BlockId[]
  parts: Part[]
}

export const BLOCKS: Record<NodeId, { title: string; desc: string; w: number; h: number }> = {
  bb: { title: 'Breadboard 830 points', desc: '', w: BB_W, h: BB_H },
  card: { title: 'Carte Makerfabs ESP32-S3 4G', desc: '26 broches : IO, 3V3, GND, 5V, VBAT', w: CARD_W, h: CARD_H },
  jack: { title: 'Câble jack 4 pôles coupé', desc: '6 fils : écouteur (EAR_P, EAR_N, masse), micro (masse, mic, mic)', w: JACK_W, h: JACK_H },
}

export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

let seq = 0
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`

export function newSession(name: string): Session {
  return { id: uuid(), name, createdAt: new Date().toISOString(), nodes: { bb: { x: 0, y: 0, rot: 0 } }, blocks: [], parts: [] }
}

/** Remet d'aplomb une session venue du serveur (anciens formats compris). */
export function normalize(s: Session): Session {
  const nodes = { ...s.nodes } as Session['nodes']
  for (const k of Object.keys(nodes) as NodeId[]) if (nodes[k]) nodes[k] = { ...nodes[k]!, rot: nodes[k]!.rot ?? 0 }
  const blocks = s.blocks ?? (['card', 'jack'] as BlockId[]).filter((b) => nodes[b] || s.parts.some((p) => b === 'jack' && p.kind === 'L'))
  let parts = s.parts ?? []
  // Ancien câble (5 fils) : on remet les fils du câble actuel, débranchés.
  if (blocks.includes('jack') && JACK_LEADS.some((l) => !parts.some((p) => p.id === l.id)))
    parts = [...parts.filter((p) => p.kind !== 'L'), ...JACK_LEADS.map((l): Part => ({ id: l.id, kind: 'L', label: l.label, color: l.color, a: l.id, b: null }))]
  return { ...s, nodes, blocks, parts }
}

// ------------------------------------------------------------------ couleurs et code des résistances

export const WIRE_COLORS: { name: string; hex: string }[] = [
  { name: 'rouge', hex: '#d32f2f' },
  { name: 'noir', hex: '#2b2b2b' },
  { name: 'jaune', hex: '#e0a800' },
  { name: 'bleu', hex: '#1d6fe0' },
  { name: 'vert', hex: '#2f9e44' },
  { name: 'blanc', hex: '#e9ecef' },
  { name: 'orange', hex: '#f08c00' },
  { name: 'violet', hex: '#7c3aed' },
  { name: 'gris', hex: '#868e96' },
  { name: 'marron', hex: '#8b5a2b' },
]
export const colorName = (hex: string) => [...WIRE_COLORS, ...LED_COLORS].find((c) => c.hex === hex)?.name ?? hex

export const LED_COLORS: { name: string; hex: string }[] = [
  { name: 'rouge', hex: '#ff4d4d' },
  { name: 'verte', hex: '#4cd964' },
  { name: 'jaune', hex: '#ffd43b' },
  { name: 'bleue', hex: '#4dabf7' },
  { name: 'blanche', hex: '#f8f9fa' },
]

const DIGITS: [string, string][] = [
  ['noir', '#1a1a1a'], ['marron', '#7b4a2a'], ['rouge', '#d32f2f'], ['orange', '#f08c00'], ['jaune', '#f2c200'],
  ['vert', '#2f9e44'], ['bleu', '#1d6fe0'], ['violet', '#7c3aed'], ['gris', '#868e96'], ['blanc', '#f1f3f5'],
]
const GOLD: [string, string] = ['or', '#c9a227']
const SILVER: [string, string] = ['argent', '#ced4da']

/** « 4.7k », « 4k7 », « 10 kΩ », « 330 », « 1M » → ohms. */
export function parseOhms(v: string): number | null {
  const t = v.replace(/\s|Ω|ohms?/gi, '').replace(',', '.').toLowerCase()
  const m = /^(\d+(?:\.\d+)?)([rkm])?(\d+)?$/.exec(t)
  if (!m) return null
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1
  const n = m[3] ? Number(`${m[1]}.${m[3]}`) : Number(m[1])
  return n > 0 ? n * mult : null
}

export function formatOhms(o: number): string {
  const f = (x: number) => String(Number(x.toPrecision(3))).replace('.', ',')
  if (o >= 1e6) return `${f(o / 1e6)} MΩ`
  if (o >= 1e3) return `${f(o / 1e3)} kΩ`
  return `${f(o)} Ω`
}

/** Les 4 anneaux (nom, couleur) d'une résistance, tolérance 5 % (or). */
export function resistorBands(value?: string): [string, string][] {
  const o = value ? parseOhms(value) : null
  if (!o) return []
  let exp = Math.floor(Math.log10(o)) - 1
  let sig = Math.round(o / 10 ** exp)
  if (sig >= 100) {
    sig = Math.round(sig / 10)
    exp++
  }
  const mult = exp === -1 ? GOLD : exp === -2 ? SILVER : DIGITS[Math.min(Math.max(exp, 0), 9)]
  return [DIGITS[Math.floor(sig / 10)], DIGITS[sig % 10], mult, GOLD]
}

// ------------------------------------------------------------------ magasin

export interface ShopItem {
  kind: Exclude<Kind, 'L'>
  title: string
  desc: string
  /** Valeurs proposées ; `custom` : on peut taper sa propre valeur. */
  values?: string[]
  custom?: string
  colors?: { name: string; hex: string }[]
  color: string
}

export const SHOP: ShopItem[] = [
  { kind: 'R', title: 'Résistance', desc: 'Freine le courant. Pas de sens.', values: ['100 Ω', '220 Ω', '330 Ω', '1 kΩ', '4,7 kΩ', '10 kΩ', '100 kΩ'], custom: 'ex. 2.2k', color: '#e3cf9f' },
  { kind: 'CE', title: 'Condensateur chimique', desc: 'Polarisé : patte longue = +.', values: ['1 µF', '10 µF', '47 µF', '100 µF', '470 µF'], custom: 'ex. 22 µF', color: '#1f3a93' },
  { kind: 'CC', title: 'Condensateur céramique', desc: 'Petite pastille. Pas de sens.', values: ['22 pF', '10 nF', '100 nF', '1 µF'], custom: 'ex. 47 nF', color: '#d9a441' },
  { kind: 'LED', title: 'LED', desc: 'Patte longue = + (anode). Toujours avec une résistance.', colors: LED_COLORS, color: LED_COLORS[0].hex },
  { kind: 'D', title: 'Diode', desc: 'Le courant passe de l’anode vers la bague.', values: ['1N4148', '1N4007'], color: '#2b2b2b' },
  { kind: 'BTN', title: 'Bouton poussoir', desc: 'Relie ses deux pattes quand on appuie.', color: '#3b3b3b' },
  { kind: 'W', title: 'Fil Dupont mâle-mâle', desc: 'Relie deux trous, ou un trou et une broche.', colors: WIRE_COLORS, color: WIRE_COLORS[0].hex },
]

const PREFIX: Record<Kind, string> = { R: 'R', CE: 'C', CC: 'C', LED: 'LED', D: 'D', BTN: 'BP', W: 'Fil ', L: '' }

/** Ajoute `qty` pièces à la boîte, numérotées à la suite (R1, R2… / C1… / Fil 1…). */
export function addToBox(s: Session, kind: Exclude<Kind, 'L'>, qty: number, value: string | undefined, color: string): Session {
  const prefix = PREFIX[kind]
  const used = s.parts
    .filter((p) => PREFIX[p.kind] === prefix)
    .map((p) => Number(p.label.slice(prefix.length)) || 0)
  let n = Math.max(0, ...used)
  const parts: Part[] = []
  for (let i = 0; i < qty; i++) parts.push({ id: newId(), kind, label: `${prefix}${++n}`, value, color, a: null, b: null })
  return { ...s, parts: [...s.parts, ...parts] }
}

export function addBlock(s: Session, b: BlockId): Session {
  if (s.blocks.includes(b)) return s
  const leads: Part[] = b === 'jack' ? JACK_LEADS.map((l) => ({ id: l.id, kind: 'L', label: l.label, color: l.color, a: l.id, b: null })) : []
  return { ...s, blocks: [...s.blocks, b], parts: [...s.parts.filter((p) => !leads.some((l) => l.id === p.id)), ...leads] }
}

/** Retire un bloc du canevas (il reste dans la boîte) et débranche ce qui y était planté. */
export function unplaceBlock(s: Session, b: BlockId): Session {
  const nodes = { ...s.nodes }
  delete nodes[b]
  const onIt = (port: string | null) => !!port && (b === 'card' ? CARD_PIN.has(port) : false)
  const parts = s.parts.map((p) => {
    if (b === 'jack' && p.kind === 'L') return { ...p, b: null }
    if (p.kind !== 'W') return p
    const a = onIt(p.a) ? null : p.a
    const bb = onIt(p.b) ? null : p.b
    return a ? { ...p, a, b: bb } : { ...p, a: bb, b: null }
  })
  return { ...s, nodes, parts }
}

export function removeBlock(s: Session, b: BlockId): Session {
  const t = unplaceBlock(s, b)
  return { ...t, blocks: t.blocks.filter((x) => x !== b), parts: b === 'jack' ? t.parts.filter((p) => p.kind !== 'L') : t.parts }
}

// ------------------------------------------------------------------ noms

export function portNet(port: string): string {
  if (isHole(port)) return `bb:${stripOf(port)}`
  const pin = CARD_PIN.get(port)
  if (pin) return pin.net
  const lead = JACK_LEAD.get(port)
  if (lead) return lead.net
  return port
}

export function portLabel(port: string | null): string {
  if (!port) return 'non branché'
  if (isHole(port)) return holeLabel(port)
  const pin = CARD_PIN.get(port)
  if (pin) return `broche ${pin.name} de la carte`
  const lead = JACK_LEAD.get(port)
  if (lead) return `fil jack ${lead.label}`
  return port
}

/** Version courte : « e12 », « rail − haut 30 », « IO9 ». */
export function portShort(port: string | null): string {
  if (!port) return '—'
  const rail = /^([+-])([HB])(\d+)$/.exec(port)
  if (rail) return `rail ${rail[1] === '+' ? '+' : '−'} ${rail[2] === 'H' ? 'haut' : 'bas'} ${rail[3]}`
  if (isHole(port)) return port
  return CARD_PIN.get(port)?.name ?? port
}

export function partName(p: Part): string {
  if (p.kind === 'W') return `${p.label} (${colorName(p.color)})`
  if (p.kind === 'L') return `fil jack ${p.label}`
  if (p.kind === 'LED') return `${p.label} (${colorName(p.color)})`
  return p.value ? `${p.label} (${p.value})` : p.label
}

export const POLAR: Kind[] = ['CE', 'LED', 'D']

export function legName(p: Part, end: 'a' | 'b'): string {
  if (p.kind === 'CE' || p.kind === 'LED') return `${p.label} ${end === 'a' ? '+' : '−'}`
  if (p.kind === 'D') return `${p.label} ${end === 'a' ? 'anode' : 'cathode'}`
  return p.label
}

/** Où sont les pattes : « + e12 · − e15 », « a3 ↔ IO9 », « dans la boîte ». */
export function placeText(p: Part): string {
  if (p.kind === 'L') return p.b ? portShort(p.b) : 'débranché'
  if (!p.a && !p.b) return 'dans la boîte'
  if (POLAR.includes(p.kind)) return `${legName(p, 'a').split(' ').pop()} ${portShort(p.a)} · ${legName(p, 'b').split(' ').pop()} ${portShort(p.b)}`
  return `${portShort(p.a)} ↔ ${portShort(p.b)}`
}

export const isPlaced = (p: Part) => (p.kind === 'L' ? !!p.b : !!p.a)

// ------------------------------------------------------------------ analyse

export type CheckState = 'ko' | 'warn' | 'ok'
export interface Check {
  state: CheckState
  text: string
  parts?: string[]
}
export interface Group {
  /** Ce qui est relié : pattes, broches, fils du jack. */
  names: string[]
  /** Où, sur la breadboard. */
  places: string[]
  parts: string[]
}
export interface Analysis {
  checks: Check[]
  groups: Group[]
}

export function analyse(s: Session): Analysis {
  const nets = new Nets()
  const card = !!s.nodes.card
  const jack = !!s.nodes.jack
  const parts = s.parts.filter((p) => (p.kind === 'L' ? jack : true))
  for (const p of parts) if ((p.kind === 'W' || p.kind === 'L') && p.a && p.b) nets.union(portNet(p.a), portNet(p.b))
  const node = (port: string) => nets.find(portNet(port))
  const T = (n: string) => nets.find(n)
  const checks: Check[] = []
  const add = (state: CheckState, text: string, ids: string[] = []) => checks.push({ state, text, parts: ids })

  // Qui est sur chaque net.
  const groups = new Map<string, Group>()
  const g = (n: string) => {
    if (!groups.has(n)) groups.set(n, { names: [], places: [], parts: [] })
    return groups.get(n)!
  }
  const ends: { part: Part; end: 'a' | 'b'; net: string }[] = []
  for (const p of parts) {
    for (const end of ['a', 'b'] as const) {
      const port = p[end]
      if (!port || (p.kind === 'L' && end === 'a')) continue
      const n = node(port)
      if (isHole(port)) g(n).places.push(stripLabel(stripOf(port)))
      if (CARD_PIN.has(port)) g(n).names.push(`broche ${CARD_PIN.get(port)!.name}`)
      g(n).parts.push(p.id)
      if (p.kind === 'L') g(n).names.push(`jack ${p.label}`)
      else if (p.kind !== 'W') {
        g(n).names.push(legName(p, end))
        ends.push({ part: p, end, net: n })
      }
    }
  }

  // Courts-circuits d'alimentation (seulement par des fils).
  if (card) {
    const pairs: [string, string, string][] = [
      ['carte:3V3', 'carte:GND', 'le 3V3 est relié directement à la masse'],
      ['carte:5V', 'carte:GND', 'le 5V est relié directement à la masse'],
      ['carte:VBAT', 'carte:GND', 'VBAT est relié directement à la masse'],
      ['carte:5V', 'carte:3V3', 'le 5V est relié au 3V3'],
      ['carte:VBAT', 'carte:3V3', 'VBAT est relié au 3V3'],
    ]
    for (const [x, y, t] of pairs) if (T(x) === T(y)) add('ko', `COURT-CIRCUIT : ${t}. Débranche la carte !`)
    for (const pin of CARD_PINS) {
      if (!pin.name.startsWith('IO') && !pin.name.includes('/')) continue
      const n = T(pin.net)
      if (n === T('carte:GND') || n === T('carte:3V3')) add('warn', `La broche ${pin.name} est reliée par un simple fil au ${n === T('carte:GND') ? 'GND' : '3V3'} : elle sera bloquée à cette tension.`)
      if (n === T('carte:5V') || n === T('carte:VBAT')) add('ko', `La broche ${pin.name} reçoit du ${n === T('carte:5V') ? '5V' : 'VBAT'} : plus de 3,3 V peut la détruire.`)
    }
  }

  for (const p of parts) {
    if (p.kind === 'W' || p.kind === 'L' || !p.a || !p.b) continue
    if (node(p.a) === node(p.b)) add('ko', `${partName(p)} : ses deux pattes sont dans le même groupe de trous (même colonne ou même rail). Le courant la contourne, elle ne sert à rien.`, [p.id])
  }

  const seen = new Map<string, Part>()
  for (const p of parts)
    for (const e of [p.a, p.b])
      if (e && isHole(e) && !(p.kind === 'L' && e === p.a)) {
        const other = seen.get(e)
        if (other) add('ko', `Deux pattes dans le même trou ${portShort(e)} (${other.label} et ${p.label}) : un trou ne prend qu'une patte.`, [other.id, p.id])
        seen.set(e, p)
      }

  for (const p of parts)
    if (p.kind === 'W' && p.a && !p.b) add('warn', `${partName(p)} : un seul bout est branché (${portShort(p.a)}).`, [p.id])

  // Patte isolée : rien d'autre sur son groupe de trous.
  for (const e of ends) {
    const grp = groups.get(e.net)!
    if (grp.names.length === 1 && !grp.parts.some((id) => id !== e.part.id))
      add('warn', `${POLAR.includes(e.part.kind) ? `La patte ${legName(e.part, e.end)}` : `Une patte de ${e.part.label}`} (${portShort(e.part[e.end])}) n'est reliée à rien d'autre.`, [e.part.id])
  }

  if (!checks.some((c) => c.state === 'ko')) add('ok', card ? 'Aucun court-circuit d’alimentation.' : 'Pas d’erreur évidente. Pose la carte pour vérifier l’alimentation.')

  const out = [...groups.values()]
    .map((x) => ({ names: [...new Set(x.names)].sort(), places: [...new Set(x.places)], parts: [...new Set(x.parts)] }))
    .filter((x) => x.names.length > 1)
  return { checks, groups: out }
}

// ------------------------------------------------------------------ résumé texte (pour Claude)

export function summary(s: Session, a: Analysis): string {
  const where = (e: string | null) => (e ? `${portShort(e)}${BB_HOLE.has(e) ? ` [${stripLabel(stripOf(e))}]` : ''}` : 'non branché')
  const lines = [`# Session « ${s.name} »`, `id ${s.id}`, '']
  lines.push('## Blocs')
  lines.push('- Breadboard 830 points : colonnes 62 (gauche) → 1 (droite), rails + − en haut et en bas (50 trous, sous les colonnes 60 → 3)')
  for (const b of s.blocks) lines.push(`- ${BLOCKS[b].title} : ${s.nodes[b] ? `posé (rotation ${s.nodes[b]!.rot}°)` : 'dans la boîte, pas posé'}`)
  lines.push('', '## Pièces posées')
  for (const p of s.parts.filter(isPlaced)) {
    if (p.kind === 'L') lines.push(`- Fil jack ${p.label} (${colorName(p.color)}) : ${where(p.b)}`)
    else if (POLAR.includes(p.kind)) lines.push(`- ${partName(p)} : ${legName(p, 'a')} ${where(p.a)} | ${legName(p, 'b')} ${where(p.b)}`)
    else lines.push(`- ${partName(p)} : ${where(p.a)} ↔ ${where(p.b)}`)
  }
  const box = s.parts.filter((p) => !isPlaced(p) && p.kind !== 'L')
  if (box.length) lines.push('', '## Dans la boîte (pas posé)', `- ${box.map(partName).join(', ')}`)
  lines.push('', '## Ce qui est relié ensemble')
  for (const g of a.groups) lines.push(`- ${g.names.join(', ')}${g.places.length ? `  — ${g.places.join(', ')}` : ''}`)
  lines.push('', '## Vérifications')
  for (const c of a.checks) lines.push(`- [${c.state === 'ok' ? 'OK' : c.state === 'ko' ? 'ERREUR' : 'ATTENTION'}] ${c.text}`)
  return lines.join('\n') + '\n'
}

// ------------------------------------------------------------------ comparaison de deux états

export interface DiffLine {
  type: 'add' | 'del' | 'mod'
  text: string
  partId?: string
}
export interface Diff {
  lines: DiffLine[]
  linksAdded: string[]
  linksRemoved: string[]
}

function links(a: Analysis): Set<string> {
  const out = new Set<string>()
  for (const g of a.groups)
    for (let i = 0; i < g.names.length; i++) for (let j = i + 1; j < g.names.length; j++) out.add(`${g.names[i]} ↔ ${g.names[j]}`)
  return out
}

export function diffSessions(from: Session, to: Session): Diff {
  const lines: DiffLine[] = []
  for (const b of to.blocks) if (!from.blocks.includes(b)) lines.push({ type: 'add', text: `${BLOCKS[b].title} ajouté à la boîte` })
  for (const b of from.blocks) if (!to.blocks.includes(b)) lines.push({ type: 'del', text: `${BLOCKS[b].title} retiré de la boîte` })
  for (const b of ['card', 'jack'] as BlockId[]) {
    if (!from.nodes[b] && to.nodes[b]) lines.push({ type: 'add', text: `${BLOCKS[b].title} posé sur le canevas` })
    if (from.nodes[b] && !to.nodes[b] && to.blocks.includes(b)) lines.push({ type: 'del', text: `${BLOCKS[b].title} retiré du canevas` })
  }
  const before = new Map(from.parts.map((p) => [p.id, p]))
  const after = new Map(to.parts.map((p) => [p.id, p]))
  for (const p of to.parts) {
    const o = before.get(p.id)
    if (!o) {
      if (p.kind !== 'L') lines.push({ type: 'add', text: `${partName(p)} ajouté${isPlaced(p) ? ` et posé : ${placeText(p)}` : ' à la boîte'}`, partId: p.id })
      continue
    }
    const ch: string[] = []
    if (o.a !== p.a || o.b !== p.b) {
      if (!isPlaced(o)) ch.push(`posé : ${placeText(p)}`)
      else if (!isPlaced(p)) ch.push(p.kind === 'L' ? 'débranché' : 'remis dans la boîte')
      else ch.push(`${placeText(o)} → ${placeText(p)}`)
    }
    if (o.value !== p.value) ch.push(`valeur ${o.value ?? '—'} → ${p.value ?? '—'}`)
    if (o.color !== p.color) ch.push(`couleur ${colorName(o.color)} → ${colorName(p.color)}`)
    if (o.label !== p.label) ch.push(`renommé ${o.label} → ${p.label}`)
    if (ch.length) lines.push({ type: 'mod', text: `${partName(p)} : ${ch.join(' · ')}`, partId: p.id })
  }
  for (const p of from.parts) if (!after.has(p.id) && p.kind !== 'L') lines.push({ type: 'del', text: `${partName(p)} retiré de la boîte` })

  const la = links(analyse(from))
  const lb = links(analyse(to))
  return { lines, linksAdded: [...lb].filter((l) => !la.has(l)), linksRemoved: [...la].filter((l) => !lb.has(l)) }
}
