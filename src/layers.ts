// Calques d'annotation : des repères posés par Claude (ou par l'app) par-dessus le montage,
// stockés à part de la session. Chaque calque s'affiche ou se masque indépendamment.

import { BB_HOLE, CARD_PINS, JACK_LEADS } from './geom'
import type { Session } from './model'

export type Annotation =
  /** Cercle sur un trou / une broche / un fil jack : où poser une pointe du multimètre. */
  | { type: 'probe'; port: string; color?: string; label?: string }
  /** Petite note accrochée à un trou ou une broche. */
  | { type: 'note'; port: string; text: string; color?: string }
  /** Met une pièce en évidence (par son nom : « R2 », « Fil 3 », « EAR_P »). */
  | { type: 'part'; part: string; color?: string; label?: string }
  /** Trait pointillé d'un port à un autre (chemin à suivre, fil à ajouter). */
  | { type: 'line'; from: string; to: string; color?: string; label?: string }

export interface Layer {
  id: string
  name: string
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
