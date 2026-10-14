// Géométrie des trois blocs du canevas : breadboard, carte Makerfabs, câble jack Nedis.
// Toutes les coordonnées sont locales au bloc (origine en haut à gauche).

import { EXTRA_PORT, NET_LABEL, extraOf } from './boards'

export const P = 24 // pas entre deux trous

// ------------------------------------------------------------------ breadboard
// Breadboard 830 points : rails + − (50 trous), a–e, canal, f–j (62 colonnes), rails + − (50 trous).
// La colonne 62 est à gauche, la colonne 1 à droite (comme sur sa breadboard).

export const COLS = 62
export const RAIL_HOLES = 50 // 10 groupes de 5, de la colonne 60 (gauche) à la colonne 3
export const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const
export const RAIL_ROWS = ['+H', '-H', '+B', '-B'] as const

const ROW_Y: Record<string, number> = {
  '+H': 34, '-H': 58,
  a: 104, b: 128, c: 152, d: 176, e: 200,
  f: 256, g: 280, h: 304, i: 328, j: 352,
  '+B': 398, '-B': 422,
}
export const BB_W = 48 * 2 + (COLS - 1) * P
export const BB_H = 456

export const bbColX = (c: number) => 48 + (COLS - c) * P
// Trou de rail k (1 à gauche, 50 à droite) : groupes de 5 au pas normal, groupes espacés
// pour que le 1er soit sous la colonne 60 et le 50e sous la colonne 3.
const GROUP_GAP = (57 - 10 * 4) / 9
export const bbRailX = (k: number) => {
  const g = Math.floor((k - 1) / 5)
  const i = (k - 1) % 5
  return bbColX(60) + (g * (4 + GROUP_GAP) + i) * P
}
export const bbRowY = (r: string) => ROW_Y[r]

/** Numéro d'un trou de rail = la colonne au-dessus de laquelle il se trouve (60 → 3, comme imprimé). */
export const RAIL_COLS: number[] = Array.from({ length: RAIL_HOLES }, (_, j) =>
  Math.round(60 - (Math.floor(j / 5) * (4 + GROUP_GAP) + (j % 5))),
)
/** Rang (0 à 49, de gauche à droite) d'un trou de rail « +H44 », ou -1. */
export function railIndex(id: string): number {
  const m = /^[+-][HB](\d+)$/.exec(id)
  return m ? RAIL_COLS.indexOf(Number(m[1])) : -1
}
/** Trou de rail voisin, `d` trous plus loin (borné aux extrémités). */
export function railShift(id: string, d: number): string {
  const j = Math.min(RAIL_HOLES - 1, Math.max(0, railIndex(id) + d))
  return `${id.slice(0, 2)}${RAIL_COLS[j]}`
}

export interface Pt {
  x: number
  y: number
}
/** Position d'un bloc sur le canevas, avec sa rotation (0, 90, 180, 270°). */
export interface Pos extends Pt {
  rot: number
}

/** Point local d'un bloc (w × h) → point monde, rotation autour du centre du bloc. */
export function localToWorld(pos: Pos, w: number, h: number, p: Pt): Pt {
  const dx = p.x - w / 2
  const dy = p.y - h / 2
  const r = (((pos.rot ?? 0) % 360) + 360) % 360
  const [x, y] = r === 90 ? [-dy, dx] : r === 180 ? [-dx, -dy] : r === 270 ? [dy, -dx] : [dx, dy]
  return { x: pos.x + w / 2 + x, y: pos.y + h / 2 + y }
}

export interface Hole extends Pt {
  id: string
}

export const BB_HOLES: Hole[] = (() => {
  const out: Hole[] = []
  for (const r of RAIL_ROWS) for (let k = 1; k <= RAIL_HOLES; k++) out.push({ id: `${r}${RAIL_COLS[k - 1]}`, x: bbRailX(k), y: bbRowY(r) })
  for (const l of LETTERS) for (let c = 1; c <= COLS; c++) out.push({ id: `${l}${c}`, x: bbColX(c), y: bbRowY(l) })
  return out
})()
export const BB_HOLE = new Map(BB_HOLES.map((h) => [h.id, h]))

export const isHole = (port: string) => BB_HOLE.has(port) || EXTRA_PORT.get(port)?.kind === 'hole'

export function holeLabel(id: string): string {
  const x = EXTRA_PORT.get(id)
  if (x) return `${x.name} · ${extraOf(x.node)?.title ?? x.node}`
  const m = /^([+-])([HB])(\d+)$/.exec(id)
  if (!m) return id
  return `rail ${m[1] === '+' ? '+' : '−'} du ${m[2] === 'H' ? 'haut' : 'bas'}, sous la colonne ${m[3]}`
}

/** Groupe de trous reliés sous la breadboard. */
export function stripOf(id: string): string {
  const x = EXTRA_PORT.get(id)
  if (x) return x.net
  const rail = /^([+-][HB])\d+$/.exec(id)
  if (rail) return `rail${rail[1]}`
  const m = /^([a-j])(\d+)$/.exec(id)!
  return `col${m[2]}-${'abcde'.includes(m[1]) ? 'haut' : 'bas'}`
}

export function stripLabel(strip: string): string {
  const x = NET_LABEL.get(strip)
  if (x) return x
  const rail = /^rail([+-])([HB])$/.exec(strip)
  if (rail) return `rail ${rail[1] === '+' ? '+' : '−'} du ${rail[2] === 'H' ? 'haut' : 'bas'}`
  const col = /^col(\d+)-(haut|bas)$/.exec(strip)
  if (col) return `colonne ${col[1]} (${col[2] === 'haut' ? 'a–e' : 'f–j'})`
  return strip
}

/** Trou à `k` pas vers la droite de l'écran (null si hors de la planche). Breadboard d'origine : numéros décroissants. */
export function holeStep(id: string, k: number): string | null {
  const x = EXTRA_PORT.get(id)
  if (x) return x.step(k)
  if (/^[+-][HB]\d+$/.test(id)) {
    const j = railIndex(id) + k
    return j >= 0 && j < RAIL_HOLES ? `${id.slice(0, 2)}${RAIL_COLS[j]}` : null
  }
  const m = /^([a-j])(\d+)$/.exec(id)
  if (!m) return null
  const c = Number(m[2]) - k
  return c >= 1 && c <= COLS ? `${m[1]}${c}` : null
}

/** Trou voisin à 3 pas vers la droite, pour poser la 2e patte. */
export const neighbourHole = (id: string): string => holeStep(id, 3) ?? holeStep(id, -3) ?? id

/** Trous où poser les `n` pattes d'une pièce lâchée sur `id` : écartées de 3 pas (2 pattes) ou côte à côte (3 pattes ou plus). */
export function legHoles(id: string, n: number): string[] {
  // Afficheur 4 chiffres : 6 pattes sur la rangée f (broches 1 à 6), 6 sur la rangée e (broches 12 à 7), mêmes colonnes.
  if (n === 12) {
    const m = /^[a-j](\d+)$/.exec(id)
    if (m) {
      const col = Math.max(Number(m[1]), 6)
      return [...Array.from({ length: 6 }, (_, i) => `f${col - i}`), ...Array.from({ length: 6 }, (_, i) => `e${col - i}`)]
    }
  }
  if (n <= 2) return [id, neighbourHole(id)]
  const right = holeStep(id, n - 1) !== null
  return Array.from({ length: n }, (_, i) => (right ? holeStep(id, i) : holeStep(id, -i)) ?? id)
}

/** Trous « voisins » d'un port pour la vue focus : son groupe (colonne, ligne de bande) ou quelques trous de rail. */
export function nearPorts(port: string): string[] {
  const x = EXTRA_PORT.get(port)
  if (x) return x.near
  if (/^[+-][HB]\d+$/.test(port)) return [-2, -1, 0, 1, 2].map((d) => railShift(port, d))
  const m = /^([a-j])(\d+)$/.exec(port)
  if (!m) return [port]
  const half = 'abcde'.includes(m[1]) ? 'abcde' : 'fghij'
  return [...half].map((l) => `${l}${m[2]}`)
}

/** Extrémités de la bande colorée posée sur le groupe d'un trou, et (breadboard d'origine) de la rangée entière. */
export function bandEnds(port: string): { ends: [string, string]; row?: [string, string] } | null {
  const x = EXTRA_PORT.get(port)
  if (x) return { ends: x.band }
  if (/^[+-][HB]\d+$/.test(port)) return { ends: [railShift(port, -2), railShift(port, 2)] }
  const m = /^([a-j])(\d+)$/.exec(port)
  if (!m) return null
  const top = 'abcde'.includes(m[1])
  return { ends: [`${top ? 'a' : 'f'}${m[2]}`, `${top ? 'e' : 'j'}${m[2]}`], row: [`${m[1]}62`, `${m[1]}1`] }
}

// ------------------------------------------------------------------ carte Makerfabs
// Vue de dessus, comme la photo : lecteur microSD en haut à gauche, module ESP32 en haut à droite,
// support SIM en bas à droite. Connecteur gauche (IO46 → VBAT) et droit (IO1 → 5V).

export const CARD_W = 420
export const CARD_H = 575

const LEFT_PINS = ['IO45', 'IO14', 'IO9', 'IO46', 'IO15', 'IO16', 'SDA/IO17', 'SCL/IO18', 'IO8', 'IO3', '3V3', 'GND', 'VBAT']
const RIGHT_PINS = ['IO1', 'IO2', 'TXD', 'RXD', 'IO42', 'IO41', 'IO40', 'IO39', 'IO38', 'GND', '3V3', 'GND', '5V']

export interface Pin extends Pt {
  id: string
  name: string
  side: 'L' | 'R'
  net: string
}

const pinNet = (name: string) => {
  if (name === 'GND') return 'carte:GND'
  if (name === '3V3') return 'carte:3V3'
  if (name.includes('/')) return `carte:${name.split('/')[1]}`
  return `carte:${name}`
}

export const CARD_PINS: Pin[] = [
  ...LEFT_PINS.map((name, i) => ({ id: `pin:L${i + 1}`, name, side: 'L' as const, x: 14, y: 46 + i * 20, net: pinNet(name) })),
  ...RIGHT_PINS.map((name, i) => ({ id: `pin:R${i + 1}`, name, side: 'R' as const, x: 394, y: 37 + i * 20, net: pinNet(name) })),
]
export const CARD_PIN = new Map(CARD_PINS.map((p) => [p.id, p]))
export const CARD_JACK: Pt = { x: 54, y: 548 } // prise jack, sur la face arrière

// ------------------------------------------------------------------ câble jack Nedis
// Fiche 4 pôles (branchée dans la carte), puis deux branches coupées de 3 fils chacune :
// écouteur (blanc EAR_P, rouge EAR_N, noir masse) et micro (noir masse, jaune mic, blanc mic).
// Les deux fils « mic » sont gardés séparés : à vérifier au multimètre s'ils sont reliés.

export const JACK_W = 250
export const JACK_H = 300
export const JACK_PLUG: Pt = { x: 125, y: 24 }

export interface Lead extends Pt {
  id: string
  label: string
  net: string
  color: string
  branch: 'ecouteur' | 'micro'
}

export const JACK_LEADS: Lead[] = [
  { id: 'jack:earP', label: 'EAR_P', net: 'jack:earP', color: '#e9ecef', branch: 'ecouteur', x: 24, y: 236 },
  { id: 'jack:earN', label: 'EAR_N', net: 'jack:earN', color: '#d32f2f', branch: 'ecouteur', x: 62, y: 236 },
  { id: 'jack:masseE', label: 'masse écouteur', net: 'jack:masse', color: '#2b2b2b', branch: 'ecouteur', x: 100, y: 236 },
  { id: 'jack:masseM', label: 'masse micro', net: 'jack:masse', color: '#2b2b2b', branch: 'micro', x: 150, y: 236 },
  { id: 'jack:mic1', label: 'mic 1', net: 'jack:mic1', color: '#e0a800', branch: 'micro', x: 189, y: 236 },
  { id: 'jack:mic2', label: 'mic 2', net: 'jack:mic2', color: '#e9ecef', branch: 'micro', x: 228, y: 236 },
]
export const JACK_LEAD = new Map(JACK_LEADS.map((l) => [l.id, l]))

/** Union-find minimal pour regrouper ce qui est relié. */
export class Nets {
  private parent = new Map<string, string>()
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    let r = x
    while (this.parent.get(r) !== r) r = this.parent.get(r)!
    this.parent.set(x, r)
    return r
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}
