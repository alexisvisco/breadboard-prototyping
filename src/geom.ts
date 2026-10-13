// Géométrie des trois blocs du canevas : breadboard, carte Makerfabs, câble jack Nedis.
// Toutes les coordonnées sont locales au bloc (origine en haut à gauche).

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
  for (const r of RAIL_ROWS) for (let k = 1; k <= RAIL_HOLES; k++) out.push({ id: `${r}${k}`, x: bbRailX(k), y: bbRowY(r) })
  for (const l of LETTERS) for (let c = 1; c <= COLS; c++) out.push({ id: `${l}${c}`, x: bbColX(c), y: bbRowY(l) })
  return out
})()
export const BB_HOLE = new Map(BB_HOLES.map((h) => [h.id, h]))

export const isHole = (port: string) => BB_HOLE.has(port)

export function holeLabel(id: string): string {
  const m = /^([+-])([HB])(\d+)$/.exec(id)
  if (!m) return id
  return `rail ${m[1] === '+' ? '+' : '−'} du ${m[2] === 'H' ? 'haut' : 'bas'}, trou ${m[3]}`
}

/** Groupe de trous reliés sous la breadboard. */
export function stripOf(id: string): string {
  const rail = /^([+-][HB])\d+$/.exec(id)
  if (rail) return `rail${rail[1]}`
  const m = /^([a-j])(\d+)$/.exec(id)!
  return `col${m[2]}-${'abcde'.includes(m[1]) ? 'haut' : 'bas'}`
}

export function stripLabel(strip: string): string {
  const rail = /^rail([+-])([HB])$/.exec(strip)
  if (rail) return `rail ${rail[1] === '+' ? '+' : '−'} du ${rail[2] === 'H' ? 'haut' : 'bas'}`
  const col = /^col(\d+)-(haut|bas)$/.exec(strip)
  if (col) return `colonne ${col[1]} (${col[2] === 'haut' ? 'a–e' : 'f–j'})`
  return strip
}

/** Trou voisin à 3 pas vers la droite (numéros décroissants), pour poser la 2e patte. */
export function neighbourHole(id: string): string {
  const rail = /^([+-][HB])(\d+)$/.exec(id)
  if (rail) {
    const k = Number(rail[2])
    return `${rail[1]}${k + 3 <= RAIL_HOLES ? k + 3 : k - 3}`
  }
  const m = /^([a-j])(\d+)$/.exec(id)!
  const c = Number(m[2])
  return `${m[1]}${c - 3 >= 1 ? c - 3 : c + 3}`
}

// ------------------------------------------------------------------ carte Makerfabs
// Vue de dessus, comme la photo : lecteur microSD en haut à gauche, module ESP32 en haut à droite,
// support SIM en bas à droite. Connecteur gauche (IO46 → VBAT) et droit (IO1 → 5V).

export const CARD_W = 420
export const CARD_H = 575

const LEFT_PINS = ['IO46', 'IO14', 'IO9', 'IO4?', 'IO15', 'IO16', 'SDA/IO17', 'SCL/IO18', 'IO8', 'IO3', '3V3', 'GND', 'VBAT']
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
