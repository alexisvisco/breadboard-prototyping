// Calques d'annotation : des repères posés par Claude (ou par l'app) par-dessus le montage,
// stockés à part de la session. Chaque calque s'affiche ou se masque indépendamment.

import { BB_HOLE, CARD_PIN, CARD_PINS, JACK_LEAD, JACK_LEADS, isHole, stripOf } from './geom'
import { portShort, type NodeId, type Session } from './model'

export type Annotation =
  /** Cercle sur un trou / une broche / un fil jack : où poser une pointe du multimètre. */
  | { type: 'probe'; port: string; color?: string; label?: string }
  /** Petite note accrochée à un trou ou une broche. */
  | { type: 'note'; port: string; text: string; color?: string }
  /** Met une pièce en évidence (par son nom : « R2 », « Fil 3 », « EAR_P »). */
  | { type: 'part'; part: string; color?: string; label?: string }
  /** Trait pointillé d'un port à un autre (chemin à suivre, fil à ajouter). */
  | { type: 'line'; from: string; to: string; color?: string; label?: string }

/** Une étape de mesure : texte court, et éventuellement le trou / la broche à montrer. */
export type Step = string | { text: string; port?: string }

export interface Layer {
  id: string
  name: string
  /** Étapes numérotées, affichées en liste ; `description` devient alors le « Pourquoi ? » replié. */
  steps?: Step[]
  description?: string
  author?: string
  visible: boolean
  items: Annotation[]
  updatedAt?: string
}

const NAMED: Record<string, string> = {
  rouge: '#ff3b30', noir: '#111111', orange: '#ff8c1a', bleu: '#2f7cff', vert: '#22c55e', jaune: '#ffd60a',
  violet: '#a855f7', blanc: '#ffffff', rose: '#ff5fa2', gris: '#9aa3a0',
}
export const annColor = (c?: string, fallback = '#ff8c1a') => (c ? (NAMED[c.toLowerCase()] ?? c) : fallback)

/** « e25 », « +H7 », « IO9 », « GND », « EAR_P », « pin:L3 » → identifiant de port. */
export function resolvePort(ref: string): string | null {
  const r = ref.trim()
  if (BB_HOLE.has(r)) return r
  if (BB_HOLE.has(r.toLowerCase())) return r.toLowerCase()
  const low = r.toLowerCase()
  const pin = CARD_PINS.find((p) => p.id === r || p.name.toLowerCase() === low || p.name.toLowerCase().split('/').includes(low))
  if (pin) return pin.id
  const lead = JACK_LEADS.find((l) => l.id === r || l.label.toLowerCase() === low)
  return lead?.id ?? null
}

/** Pièce par nom (« R2 ») ou identifiant. */
export const resolvePart = (s: Session, ref: string) =>
  s.parts.find((p) => p.id === ref || p.label.toLowerCase() === ref.trim().toLowerCase()) ?? null

const json = async <T,>(r: Response) => {
  if (!r.ok) throw new Error(String(r.status))
  return (await r.json()) as T
}
export const fetchLayers = (id: string) => fetch(`/api/sessions/${id}/layers`).then((r) => json<Layer[]>(r))
export const putLayer = (id: string, l: Layer) =>
  fetch(`/api/sessions/${id}/layers/${encodeURIComponent(l.id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(l) }).then((r) => json<Layer>(r))
export const deleteLayer = (id: string, lid: string) => fetch(`/api/sessions/${id}/layers/${encodeURIComponent(lid)}`, { method: 'DELETE' })

export const stepText = (s: Step) => (typeof s === 'string' ? s : s.text)
export const stepPort = (s: Step) => (typeof s === 'string' ? undefined : s.port)

/** Ports cités par un calque (cercles, notes, traits, étapes). */
export function layerPorts(l: Layer): string[] {
  const refs: string[] = []
  for (const it of l.items) {
    if (it.type === 'probe' || it.type === 'note') refs.push(it.port)
    if (it.type === 'line') refs.push(it.from, it.to)
  }
  for (const st of l.steps ?? []) {
    const p = stepPort(st)
    if (p) refs.push(p)
  }
  return [...new Set(refs.map(resolvePort).filter((p): p is string => !!p))]
}

export interface Focus {
  /** Pièces concernées : nommées par le calque, ou plantées dans les colonnes / bouts de rail mesurés. */
  parts: Set<string>
  ports: string[]
  /** Blocs touchés par la mesure (les autres sont grisés). */
  nodes: Set<NodeId>
}

/** Ce qui reste bien visible quand on se concentre sur un calque. */
export function focusOf(s: Session, l: Layer): Focus {
  const ports = layerPorts(l)
  const strips = new Set(ports.filter((p) => isHole(p) && !/^[+-]/.test(p)).map(stripOf))
  const rails = ports.map((p) => /^([+-][HB])(\d+)$/.exec(p)).filter((m): m is RegExpExecArray => !!m)
  const near = (port: string | null) => {
    if (!port) return false
    if (ports.includes(port)) return true
    if (isHole(port) && !/^[+-]/.test(port)) return strips.has(stripOf(port))
    const m = /^([+-][HB])(\d+)$/.exec(port)
    return !!m && rails.some((r) => r[1] === m[1] && Math.abs(Number(r[2]) - Number(m[2])) <= 2)
  }
  const parts = new Set<string>()
  for (const p of s.parts) if (near(p.kind === 'L' ? p.b : p.a) || near(p.b)) parts.add(p.id)
  for (const it of l.items) if (it.type === 'part') {
    const p = resolvePart(s, it.part)
    if (p) parts.add(p.id)
  }
  const nodes = new Set<NodeId>(['bb'])
  for (const p of ports) {
    if (CARD_PIN.has(p)) nodes.add('card')
    if (JACK_LEAD.has(p)) nodes.add('jack')
  }
  for (const id of parts) {
    const p = s.parts.find((x) => x.id === id)!
    if (p.kind === 'L') nodes.add('jack')
    if ([p.a, p.b].some((e) => e && CARD_PIN.has(e))) nodes.add('card')
  }
  return { parts, ports, nodes }
}

/** Nom lisible d'un port pour les étiquettes : « a44 », « rail − haut 16 », « IO9 ». */
export const portName = (ref: string) => {
  const p = resolvePort(ref)
  return p ? portShort(p) : ref
}
