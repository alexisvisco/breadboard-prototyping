// Planches supplémentaires : breadboards sur mesure, plaques perforées (perfboard / stripboard) et cartes de développement.
// Chaque planche a un identifiant (« bread1 », « perf1 », « mcu1 »). Ses ports s'écrivent « <id>:<local> » : « bread1:e12 », « perf1:C4 », « mcu1:IO5 ».
// Une planche ne change jamais après sa création : le registre garde aussi celles des anciennes versions.

const P = 24 // pas entre deux trous (identique à geom.ts)

export type ExtraKind = 'bread' | 'perf' | 'strip' | 'mcu'

export interface Extra {
  id: string
  kind: ExtraKind
  title: string
  /** bread / perf / strip : nombre de colonnes. */
  cols?: number
  /** perf / strip : nombre de lignes. */
  rows?: number
  /** bread : rails + − en haut et en bas. */
  rails?: boolean
  /** mcu : clé de MCU_MODELS. */
  model?: string
}

export type PinRole = 'gnd' | '3v3' | '5v' | 'io' | 'other'

export interface PortInfo {
  id: string
  /** Planche à laquelle appartient le port. */
  node: string
  x: number
  y: number
  kind: 'hole' | 'pin'
  /** Nom court local : « e12 », « C4 », « IO5 ». */
  name: string
  /** Groupe de trous reliés sous la planche (breadboard : colonne ou rail ; stripboard : ligne). */
  net: string
  /** Texte du groupe : « colonne 12 (a–e) ». */
  netLabel: string
  /** Trous à mettre en évidence autour de celui-ci (mêmes groupes), pour la vue « focus ». */
  near: string[]
  /** Extrémités d'une bande colorée sur ce groupe (calques). */
  band: [string, string]
  role: PinRole
  /** Trou à `k` pas vers la droite de l'écran (null si hors planche). */
  step: (k: number) => string | null
}

export interface Layout {
  w: number
  h: number
  ports: PortInfo[]
}

export const EXTRA_PORT = new Map<string, PortInfo>()
const EXTRAS = new Map<string, Extra>()
const LAYOUTS = new Map<string, Layout>()
const SIGS = new Map<string, string>()
/** Nom lisible d'un groupe de trous reliés : « colonne 12 (a–e) · Breadboard 400 ». */
export const NET_LABEL = new Map<string, string>()

export const extraOf = (id: string) => EXTRAS.get(id)
export const layoutOf = (id: string) => LAYOUTS.get(id)

/** Enregistre des planches (et calcule leurs ports). À appeler dès qu'une session est lue. Même identifiant, autre forme : la dernière gagne. */
export function registerExtras(list: Extra[] | undefined) {
  for (const e of list ?? []) {
    const sig = JSON.stringify(e)
    if (SIGS.get(e.id) === sig) continue
    for (const p of LAYOUTS.get(e.id)?.ports ?? []) EXTRA_PORT.delete(p.id)
    EXTRAS.delete(e.id)
    LAYOUTS.delete(e.id)
    const lay = buildLayout(e)
    if (!lay) continue
    SIGS.set(e.id, sig)
    EXTRAS.set(e.id, e)
    LAYOUTS.set(e.id, lay)
    for (const p of lay.ports) {
      EXTRA_PORT.set(p.id, p)
      if (p.kind === 'hole') NET_LABEL.set(p.net, `${p.netLabel} · ${e.title}`)
    }
  }
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || lo))

// ------------------------------------------------------------------ breadboard sur mesure

export const BREAD_PRESETS = [
  { title: 'Breadboard 170 points (mini)', cols: 17, rails: false },
  { title: 'Breadboard 400 points (demi)', cols: 30, rails: true },
  { title: 'Breadboard 830 points', cols: 62, rails: true },
] as const

export const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const

const ROW_Y: Record<string, number> = { '+H': 34, '-H': 58, a: 104, b: 128, c: 152, d: 176, e: 200, f: 256, g: 280, h: 304, i: 328, j: 352, '+B': 398, '-B': 422 }
export const BREAD_MARGIN = 48

export const breadRailGroups = (cols: number) => Math.max(1, Math.floor((cols + 1) / 6))

/** Position (x, y) des repères dessinés : lignes de rail, lettres, numéros. */
export function breadGeom(e: Extra) {
  const cols = e.cols ?? 30
  const rails = !!e.rails
  const dy = rails ? 0 : -70
  const y = (r: string) => ROW_Y[r] + dy
  const g = breadRailGroups(cols)
  const off = Math.floor((cols - 1 - (6 * g - 2)) / 2)
  const railX = (k: number) => BREAD_MARGIN + (off + k + Math.floor(k / 5)) * P // k : 0 → 5g−1
  return { cols, rails, y, g, railX, colX: (c: number) => BREAD_MARGIN + (c - 1) * P, w: BREAD_MARGIN * 2 + (cols - 1) * P, h: rails ? 456 : 320 }
}

function breadLayout(e: Extra): Layout {
  const { cols, rails, y, g, railX, colX, w, h } = breadGeom(e)
  const ports: PortInfo[] = []
  const id = (l: string) => `${e.id}:${l}`
  const step = (row: string) => (c: number) => (k: number) => (c + k >= 1 && c + k <= cols ? id(`${row}${c + k}`) : null)
  for (const l of LETTERS) {
    const top = 'abcde'.includes(l)
    const half = top ? 'abcde' : 'fghij'
    for (let c = 1; c <= cols; c++) {
      ports.push({
        id: id(`${l}${c}`), node: e.id, x: colX(c), y: y(l), kind: 'hole', name: `${l}${c}`,
        net: `${e.id}:col${c}-${top ? 'haut' : 'bas'}`, netLabel: `colonne ${c} (${top ? 'a–e' : 'f–j'})`,
        near: [...half].map((m) => id(`${m}${c}`)), band: [id(`${half[0]}${c}`), id(`${half[4]}${c}`)], role: 'other', step: step(l)(c),
      })
    }
  }
  if (rails) {
    for (const r of ['+H', '-H', '+B', '-B']) {
      const n = 5 * g
      for (let k = 1; k <= n; k++) {
        const at = (j: number) => id(`${r}${Math.min(n, Math.max(1, j))}`)
        ports.push({
          id: id(`${r}${k}`), node: e.id, x: railX(k - 1), y: y(r), kind: 'hole', name: `${r}${k}`,
          net: `${e.id}:rail${r}`, netLabel: `rail ${r[0] === '+' ? '+' : '−'} du ${r[1] === 'H' ? 'haut' : 'bas'}`,
          near: [-2, -1, 0, 1, 2].map((d) => at(k + d)), band: [at(k - 2), at(k + 2)], role: 'other',
          step: (d) => (k + d >= 1 && k + d <= n ? id(`${r}${k + d}`) : null),
        })
      }
    }
  }
  return { w, h, ports }
}

// ------------------------------------------------------------------ plaque perforée / à bandes

export const PERF_MARGIN = 38
export const PERF_TOP = 44 // place pour les numéros de colonne

export const colLetters = (c: number) => (c > 26 ? String.fromCharCode(64 + Math.floor((c - 1) / 26)) : '') + String.fromCharCode(65 + ((c - 1) % 26))

export function perfGeom(e: Extra) {
  const cols = e.cols ?? 20
  const rows = e.rows ?? 14
  return { cols, rows, colX: (c: number) => PERF_MARGIN + (c - 1) * P, rowY: (r: number) => PERF_TOP + (r - 1) * P, w: PERF_MARGIN * 2 + (cols - 1) * P, h: PERF_TOP + (rows - 1) * P + PERF_MARGIN }
}

function perfLayout(e: Extra): Layout {
  const { cols, rows, colX, rowY, w, h } = perfGeom(e)
  const strip = e.kind === 'strip'
  const ports: PortInfo[] = []
  const id = (c: number, r: number) => `${e.id}:${colLetters(c)}${r}`
  for (let r = 1; r <= rows; r++)
    for (let c = 1; c <= cols; c++) {
      const me = id(c, r)
      ports.push({
        id: me, node: e.id, x: colX(c), y: rowY(r), kind: 'hole', name: `${colLetters(c)}${r}`,
        net: strip ? `${e.id}:ligne${r}` : me, netLabel: strip ? `ligne ${r}` : `pastille ${colLetters(c)}${r}`,
        near: strip ? Array.from({ length: cols }, (_, i) => id(i + 1, r)) : [me], band: strip ? [id(1, r), id(cols, r)] : [me, me], role: 'other',
        step: (k) => (c + k >= 1 && c + k <= cols ? id(c + k, r) : null),
      })
    }
  return { w, h, ports }
}

// ------------------------------------------------------------------ cartes de développement

export interface McuModel {
  title: string
  desc: string
  /** Texte gravé sur le module. */
  module: string
  color: string
  /** Largeur du circuit imprimé. */
  w: number
  /** Les broches, de haut en bas, côté gauche puis côté droit (vue de dessus, USB en bas). */
  left: string[]
  right: string[]
  /** Tension logique : 3,3 V (une broche à 5 V est détruite) ou 5 V. */
  logic: 3.3 | 5
  usb: 'usb-c' | 'micro'
  /** Une note courte affichée dans le magasin. */
  note?: string
}

const gnd = 'GND'
export const MCU_MODELS: Record<string, McuModel> = {
  'esp32-devkit': {
    title: 'ESP32 DevKit V1 (30 broches)', desc: 'ESP32-WROOM-32 · Wi-Fi + Bluetooth · le classique', module: 'ESP32-WROOM-32', color: '#1b2430', w: 270, logic: 3.3, usb: 'micro',
    left: ['EN', 'IO36/VP', 'IO39/VN', 'IO34', 'IO35', 'IO32', 'IO33', 'IO25', 'IO26', 'IO27', 'IO14', 'IO12', 'IO13', gnd, 'VIN'],
    right: ['IO23', 'IO22', 'TXD0/IO1', 'RXD0/IO3', 'IO21', 'IO19', 'IO18', 'IO5', 'IO17', 'IO16', 'IO4', 'IO2', 'IO15', gnd, '3V3'],
    note: 'IO34 à IO39 : entrées seulement. IO6 à IO11 sont réservées à la flash.',
  },
  'esp32-s3-devkitc': {
    title: 'ESP32-S3-DevKitC-1 (44 broches)', desc: 'ESP32-S3 · Wi-Fi + Bluetooth LE · USB natif', module: 'ESP32-S3-WROOM-1', color: '#14181f', w: 280, logic: 3.3, usb: 'usb-c',
    left: ['3V3', '3V3-2', 'RST', 'IO4', 'IO5', 'IO6', 'IO7', 'IO15', 'IO16', 'IO17', 'IO18', 'IO8', 'IO3', 'IO46', 'IO9', 'IO10', 'IO11', 'IO12', 'IO13', 'IO14', '5V', gnd],
    right: [gnd, 'TXD/IO43', 'RXD/IO44', 'IO1', 'IO2', 'IO42', 'IO41', 'IO40', 'IO39', 'IO38', 'IO37', 'IO36', 'IO35', 'IO0', 'IO45', 'IO48', 'IO47', 'IO21', 'IO20', 'IO19', gnd, gnd],
    note: 'Selon les versions, IO35 à IO37 sont prises par la PSRAM (modules R8).',
  },
  'esp32-c3-supermini': {
    title: 'ESP32-C3 SuperMini (16 broches)', desc: 'ESP32-C3 · Wi-Fi + Bluetooth LE · minuscule', module: 'ESP32-C3FH4', color: '#12161c', w: 190, logic: 3.3, usb: 'usb-c',
    left: ['5V', gnd, '3V3', 'IO4', 'IO3', 'IO2', 'IO1', 'IO0'],
    right: ['IO5', 'IO6', 'IO7', 'IO8', 'IO9', 'IO10', 'RXD/IO20', 'TXD/IO21'],
  },
  'esp32-cam': {
    title: 'ESP32-CAM (AI-Thinker)', desc: 'ESP32 + caméra OV2640 + lecteur microSD', module: 'ESP32-S', color: '#1d2733', w: 210, logic: 3.3, usb: 'micro',
    left: ['5V', gnd, 'IO12', 'IO13', 'IO15', 'IO14', 'IO2', 'IO4'],
    right: ['3V3', 'IO16', 'IO0', 'GND-2', 'VCC', 'RXD/IO3', 'TXD/IO1', 'GND-3'],
    note: 'Pas de port USB : il faut un adaptateur série. IO0 à GND pour flasher.',
  },
  'esp8266-nodemcu': {
    title: 'ESP8266 NodeMCU v3 (30 broches)', desc: 'ESP-12E · Wi-Fi · une seule entrée analogique', module: 'ESP-12E', color: '#1a2230', w: 270, logic: 3.3, usb: 'micro',
    left: ['A0', 'RSV1', 'RSV2', 'SD3/IO10', 'SD2/IO9', 'SD1/IO8', 'CMD/IO11', 'SD0/IO7', 'CLK/IO6', gnd, '3V3', 'EN', 'RST', 'GND-2', 'VIN'],
    right: ['D0/IO16', 'D1/IO5', 'D2/IO4', 'D3/IO0', 'D4/IO2', '3V3-2', 'GND-3', 'D5/IO14', 'D6/IO12', 'D7/IO13', 'D8/IO15', 'RX/IO3', 'TX/IO1', 'GND-4', '3V3-3'],
  },
  'wemos-d1-mini': {
    title: 'Wemos D1 Mini (ESP8266)', desc: 'ESP8266 · Wi-Fi · petit format', module: 'ESP-12F', color: '#1f6fb5', w: 190, logic: 3.3, usb: 'micro',
    left: ['RST', 'A0', 'D0/IO16', 'D5/IO14', 'D6/IO12', 'D7/IO13', 'D8/IO15', '3V3'],
    right: ['TX/IO1', 'RX/IO3', 'D1/IO5', 'D2/IO4', 'D3/IO0', 'D4/IO2', gnd, '5V'],
  },
  'pico': {
    title: 'Raspberry Pi Pico (40 broches)', desc: 'RP2040 · pas de Wi-Fi (sauf Pico W)', module: 'RP2040', color: '#1c7c3c', w: 230, logic: 3.3, usb: 'micro',
    left: ['GP0', 'GP1', gnd, 'GP2', 'GP3', 'GP4', 'GP5', 'GND-2', 'GP6', 'GP7', 'GP8', 'GP9', 'GND-3', 'GP10', 'GP11', 'GP12', 'GP13', 'GND-4', 'GP14', 'GP15'],
    right: ['VBUS', 'VSYS', 'GND-5', '3V3_EN', '3V3', 'ADC_VREF', 'GP28', 'GND-6', 'GP27', 'GP26', 'RUN', 'GP22', 'GND-7', 'GP21', 'GP20', 'GP19', 'GP18', 'GND-8', 'GP17', 'GP16'],
    note: 'VBUS = 5 V de l’USB. Sorties 3,3 V seulement.',
  },
  'arduino-nano': {
    title: 'Arduino Nano (30 broches)', desc: 'ATmega328P · logique 5 V', module: 'ATmega328P', color: '#0b6e82', w: 220, logic: 5, usb: 'micro',
    left: ['D13', '3V3', 'REF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST', gnd, 'VIN'],
    right: ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND-2', 'RST-2', 'D0/RX', 'D1/TX'],
  },
}

export const MCU_TOP = 92
export const mcuGeom = (m: McuModel) => ({ w: m.w, h: MCU_TOP + (Math.max(m.left.length, m.right.length) - 1) * P + 76, pinY: (i: number) => MCU_TOP + i * P, leftX: 16, rightX: m.w - 16 })

const roleOf = (name: string): { role: PinRole; net: string } => {
  const n = name.replace(/-\d+$/, '')
  if (n === 'GND') return { role: 'gnd', net: 'GND' }
  if (n === '3V3') return { role: '3v3', net: '3V3' }
  if (['5V', 'VIN', 'VBUS'].includes(n)) return { role: '5v', net: '5V' }
  const net = n.includes('/') ? n.split('/')[1] : n
  return { role: /^(IO|GP|D\d|A\d|SD|CMD|CLK)/.test(n) ? 'io' : 'other', net }
}

/** Identifiant local d'une broche : « IO36/VP » → « IO36 » (« GND-2 » pour la 2e masse). */
export const pinLocal = (name: string) => name.split('/')[0]

function mcuLayout(e: Extra): Layout | null {
  const m = MCU_MODELS[e.model ?? '']
  if (!m) return null
  const { w, h, pinY, leftX, rightX } = mcuGeom(m)
  const ports: PortInfo[] = []
  const add = (names: string[], x: number) =>
    names.forEach((name, i) => {
      const { role, net } = roleOf(name)
      const id = `${e.id}:${pinLocal(name)}`
      ports.push({
        id, node: e.id, x, y: pinY(i), kind: 'pin', name, net: `${e.id}:${net}`, netLabel: name, near: [id], band: [id, id], role,
        step: () => null,
      })
    })
  add(m.left, leftX)
  add(m.right, rightX)
  return { w, h, ports }
}

function buildLayout(e: Extra): Layout | null {
  if (e.kind === 'bread') return breadLayout(e)
  if (e.kind === 'perf' || e.kind === 'strip') return perfLayout(e)
  if (e.kind === 'mcu') return mcuLayout(e)
  return null
}

// ------------------------------------------------------------------ création

const PREFIX: Record<ExtraKind, string> = { bread: 'bread', perf: 'perf', strip: 'strip', mcu: 'mcu' }

export function newExtra(existing: Extra[], spec: Omit<Extra, 'id'>): Extra {
  let n = 1
  while (existing.some((x) => x.id === `${PREFIX[spec.kind]}${n}`)) n++
  return { ...spec, id: `${PREFIX[spec.kind]}${n}` }
}

/** Planche corrigée : bornes de taille raisonnables. */
export function cleanExtra(e: Extra): Extra {
  if (e.kind === 'bread') return { ...e, cols: clamp(e.cols ?? 30, 5, 100), rails: !!e.rails }
  if (e.kind === 'perf' || e.kind === 'strip') return { ...e, cols: clamp(e.cols ?? 20, 3, 60), rows: clamp(e.rows ?? 14, 3, 60) }
  return e
}

export const extraSize = (id: string): { w: number; h: number } | null => {
  const l = LAYOUTS.get(id)
  return l ? { w: l.w, h: l.h } : null
}

export const extraDesc = (e: Extra): string => {
  if (e.kind === 'bread') return `${e.cols} colonnes${e.rails ? ', avec rails + −' : ', sans rails'}`
  if (e.kind === 'perf') return `${e.cols} × ${e.rows} pastilles isolées`
  if (e.kind === 'strip') return `${e.cols} × ${e.rows}, chaque ligne est une bande de cuivre`
  return MCU_MODELS[e.model ?? '']?.desc ?? ''
}
