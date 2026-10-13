import { createContext, useContext, type SVGProps } from 'react'
// Dessins des trois blocs du canevas. Coordonnées locales au bloc.

import {
  BB_H, BB_HOLES, BB_W, CARD_H, CARD_JACK, CARD_PINS, CARD_W, COLS, JACK_H, JACK_LEADS, JACK_PLUG, JACK_W,
  LETTERS, RAIL_HOLES, RAIL_ROWS, bbColX, bbRailX, bbRowY,
} from './geom'

/** Vrai si le bloc est pivoté de 180° ou 270° : ses textes se retournent pour rester lisibles. */
const Flip = createContext(false)
export const FlipProvider = Flip.Provider

/** <text> qui reste à l'endroit quand le bloc est retourné (rotation de 180° autour de son milieu, ancre inversée). */
function Text({ x = 0, y = 0, transform, textAnchor, fontSize, ...rest }: SVGProps<SVGTextElement>) {
  const flip = useContext(Flip)
  if (!flip) return <text x={x} y={y} transform={transform} textAnchor={textAnchor} fontSize={fontSize} {...rest} />
  const fs = Number(fontSize ?? 11)
  const anchor = textAnchor === 'middle' ? 'middle' : textAnchor === 'end' ? 'start' : 'end'
  const t = `${transform ?? ''} rotate(180 ${Number(x)} ${Number(y) - fs * 0.35})`
  return <text x={x} y={y} transform={t} textAnchor={anchor} fontSize={fontSize} {...rest} />
}

const MONO = 'JetBrains Mono, ui-monospace, monospace'
const SANS = 'IBM Plex Sans, system-ui, sans-serif'

interface Hl {
  hover: string | null
  flash: string | null
}

const holeFill = (id: string, { hover, flash }: Hl) => (flash === id ? '#ffd43b' : hover === id ? '#e8590c' : '#a39e90')

export function NodeTitle({ w, title, sub }: { w: number; title: string; sub?: string }) {
  return (
    <g data-drag="node" style={{ cursor: 'grab' }}>
      <rect x={0} y={-34} width={w} height={28} rx={8} fill="#1f2a26" stroke="#34433d" />
      <circle cx={16} cy={-20} r={4} fill="#6ccb86" />
      <Text x={28} y={-15} fontSize={13} fontWeight={600} fill="#e6ece8" fontFamily={SANS}>{title}</Text>
      {sub && <Text x={w - 44} y={-15} fontSize={11} fill="#98a39d" fontFamily={MONO} textAnchor="end">{sub}</Text>}
      <g data-action="rotate" transform={`translate(${w - 18},-20)`} style={{ cursor: 'pointer' }}>
        <title>Pivoter de 90°</title>
        <circle r={11} fill="#2c3833" stroke="#4a5a53" />
        <path d="M-5,-1 A5.5,5.5 0 1,1 -1,5" fill="none" stroke="#e6ece8" strokeWidth={1.8} strokeLinecap="round" />
        <path d="M-8,-3 L-5,1 L-1.5,-2.5" fill="none" stroke="#e6ece8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  )
}

export function BreadboardNode(hl: Hl) {
  return (
    <g>
      <NodeTitle w={BB_W} title="Breadboard 830 points" sub="glisser le titre : déplacer" />
      <rect data-drag="node" width={BB_W} height={BB_H} rx={14} fill="#f3f1ea" stroke="#cfc9b8" strokeWidth={2} />
      {RAIL_ROWS.map((r) => {
        const plus = r.startsWith('+')
        const y = bbRowY(r) + (plus ? -12 : 12)
        return (
          <g key={r}>
            <line x1={bbRailX(1) - 10} x2={bbRailX(RAIL_HOLES) + 10} y1={y} y2={y} stroke={plus ? '#d7192f' : '#1d4ed8'} strokeWidth={2} />
            <Text x={18} y={bbRowY(r) + 5} fontSize={15} fontWeight={700} fill={plus ? '#d7192f' : '#1d4ed8'} fontFamily={SANS}>{plus ? '+' : '−'}</Text>
            <Text x={BB_W - 18} y={bbRowY(r) + 5} fontSize={15} fontWeight={700} fill={plus ? '#d7192f' : '#1d4ed8'} fontFamily={SANS} textAnchor="end">{plus ? '+' : '−'}</Text>
          </g>
        )
      })}
      <rect x={bbColX(COLS) - 10} y={(bbRowY('e') + bbRowY('f')) / 2 - 7} width={bbColX(1) - bbColX(COLS) + 20} height={14} rx={4} fill="#e2ddcf" />
      {LETTERS.map((l) => (
        <g key={l} fontSize={12} fill="#8a8574" fontFamily={MONO} textAnchor="middle">
          <Text x={24} y={bbRowY(l) + 4} textAnchor="middle" fontSize={12}>{l}</Text>
          <Text x={BB_W - 24} y={bbRowY(l) + 4} textAnchor="middle" fontSize={12}>{l}</Text>
        </g>
      ))}
      {Array.from({ length: COLS }, (_, i) => i + 1)
        .filter((c) => c === 1 || c % 5 === 0)
        .map((c) => (
          <g key={c} fontSize={11} fill="#8a8574" fontFamily={MONO} textAnchor="middle">
            <Text x={bbColX(c)} y={bbRowY('a') - 13} textAnchor="middle">{c}</Text>
            <Text x={bbColX(c)} y={bbRowY('j') + 21} textAnchor="middle">{c}</Text>
          </g>
        ))}
      {BB_HOLES.map((h) => (
        <rect key={h.id} x={h.x - 4.5} y={h.y - 4.5} width={9} height={9} rx={1.5} fill={holeFill(h.id, hl)} />
      ))}
    </g>
  )
}

export function CardNode(hl: Hl) {
  const gold = '#d9b44a'
  return (
    <g>
      <NodeTitle w={CARD_W} title="Makerfabs ESP32-S3 4G" sub="vue de dessus" />
      <rect data-drag="node" width={CARD_W} height={CARD_H} rx={14} fill="#d7192f" />
      <g stroke="#b5121f" strokeWidth={2} fill="none" opacity={0.8}>
        <path d="M40,125 L180,125 L200,145" />
        <path d="M90,210 L90,330 L140,380 L140,550" />
        <path d="M350,210 L300,260 L300,290" />
      </g>
      <g fill="#2a2a2a" stroke="#f3f0ea" strokeWidth={3}>
        <circle cx={14} cy={14} r={7} /><circle cx={398} cy={14} r={7} /><circle cx={14} cy={560} r={7} /><circle cx={406} cy={560} r={7} />
      </g>
      {/* lecteur microSD */}
      <rect x={42} y={-2} width={128} height={114} rx={3} fill="#cdc6b2" stroke="#8d8676" />
      <Text x={106} y={60} fontSize={11} fill="#6f6857" fontFamily={MONO} textAnchor="middle">microSD</Text>
      {/* module ESP32-S3 */}
      <rect x={202} y={-8} width={145} height={210} rx={3} fill="#1d1d1d" />
      <path d="M214,6 h12 v18 h12 v-18 h12 v18 h12 v-18 h12 v18 h12 v-18 h12 v18 h12 v-18" fill="none" stroke="#4a4a4a" strokeWidth={3} />
      <rect x={212} y={44} width={125} height={150} rx={4} fill="#d3cebd" />
      <Text x={274} y={78} fontSize={15} fontWeight={700} fill="#8a8574" textAnchor="middle" fontFamily={SANS}>ESPRESSIF</Text>
      <Text x={274} y={96} fontSize={9} fill="#8a8574" textAnchor="middle" fontFamily={MONO}>ESP32-S3-WROOM-1</Text>
      <Text x={274} y={182} fontSize={8} fill="#8a8574" textAnchor="middle" fontFamily={MONO}>N16R8</Text>
      {/* LED */}
      <rect x={69} y={266} width={8} height={12} fill="#eef4ea" /><Text x={60} y={276} fontSize={8} fill="#fff" textAnchor="end" fontFamily={MONO}>STA</Text>
      <rect x={69} y={286} width={8} height={12} fill="#eef4ea" /><Text x={60} y={296} fontSize={8} fill="#fff" textAnchor="end" fontFamily={MONO}>NET</Text>
      {/* sérigraphie */}
      <Text transform="translate(184,250) rotate(90)" fontSize={17} fontWeight={600} fill="#f6efe6" letterSpacing={1} fontFamily={SANS}>ESP32-S3 4G LTE CAT1 V1.2</Text>
      <rect x={202} y={358} width={56} height={148} fill="none" stroke="#f6efe6" strokeWidth={2} />
      <Text transform="translate(218,366) rotate(90)" fontSize={11} fill="#f6efe6" fontFamily={MONO}>A7670E</Text>
      <Text transform="translate(243,366) rotate(90)" fontSize={11} fill="#f6efe6" fontFamily={MONO}>A7670SA</Text>
      {/* support micro-SIM */}
      <rect x={272} y={293} width={142} height={140} rx={3} fill="#cdc6b2" stroke="#8d8676" />
      <Text x={343} y={370} fontSize={11} fill="#6f6857" fontFamily={MONO} textAnchor="middle">SIM</Text>
      <rect x={406} y={328} width={12} height={82} rx={3} fill="#eef0f3" />
      {/* USB-C */}
      <g fill="#bfc3c8" stroke="#7d828a">
        <rect x={90} y={572} width={48} height={12} rx={5} /><rect x={246} y={572} width={48} height={12} rx={5} /><rect x={416} y={455} width={12} height={52} rx={5} />
      </g>
      <g fontSize={9} fill="#fff" fontFamily={MONO} textAnchor="middle">
        <Text x={114} y={566} textAnchor="middle" fontSize={9}>USB</Text><Text x={270} y={566} textAnchor="middle" fontSize={9}>USB</Text>
      </g>
      {/* prise jack (face arrière) */}
      <circle cx={CARD_JACK.x} cy={CARD_JACK.y} r={11} fill="#2a2d31" stroke="#f6efe6" strokeWidth={2} strokeDasharray="3 3" />
      <Text x={CARD_JACK.x + 18} y={CARD_JACK.y + 4} fontSize={10} fill="#fff" fontFamily={MONO}>prise jack (dessous)</Text>
      {/* connecteurs */}
      {CARD_PINS.map((p) => (
        <g key={p.id}>
          {hl.flash === p.id && <circle cx={p.x} cy={p.y} r={13} fill="#ffd43b" />}
          <circle cx={p.x} cy={p.y} r={7} fill={hl.hover === p.id ? '#e8590c' : gold} />
          <circle cx={p.x} cy={p.y} r={3} fill="#3a0d0d" />
          <Text
            x={p.side === 'L' ? p.x + 14 : p.x - 14}
            y={p.y + 4}
            fontSize={11}
            fontWeight={['3V3', 'GND', 'IO9', 'IO14'].includes(p.name) ? 700 : 400}
            fill="#fff6f0"
            fontFamily={MONO}
            textAnchor={p.side === 'L' ? 'start' : 'end'}
          >
            {p.name}
          </Text>
        </g>
      ))}
    </g>
  )
}

export function JackNode({ colors }: { colors: Record<string, string> }) {
  const plugX = JACK_PLUG.x
  return (
    <g>
      <NodeTitle w={JACK_W} title="Câble jack" sub="4 pôles, coupé" />
      <rect data-drag="node" width={JACK_W} height={JACK_H} rx={14} fill="#1a221e" stroke="#2f3b36" />
      {/* fiche */}
      <g transform={`translate(${plugX},${JACK_PLUG.y})`}>
        <rect x={-10} y={-14} width={20} height={34} rx={4} fill="#1d1d1d" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={-5} y={20 + i * 9} width={10} height={7} fill={i === 3 ? '#c9ccd1' : '#d7dbe0'} rx={i === 3 ? 4 : 0} />)}
      </g>
      <Text x={plugX + 18} y={JACK_PLUG.y + 6} fontSize={10} fill="#98a39d" fontFamily={MONO}>fiche → carte</Text>
      {/* câble puis séparation */}
      <path d={`M${plugX},${JACK_PLUG.y + 60} L${plugX},110`} stroke="#1d1d1d" strokeWidth={8} />
      <path d={`M${plugX},110 C${plugX},140 62,140 62,170`} stroke="#1d1d1d" strokeWidth={7} fill="none" />
      <path d={`M${plugX},110 C${plugX},140 189,140 189,170`} stroke="#1d1d1d" strokeWidth={7} fill="none" />
      <rect x={42} y={168} width={40} height={30} rx={6} fill="#59625d" />
      <rect x={169} y={168} width={40} height={30} rx={6} fill="#59625d" />
      <Text x={62} y={160} fontSize={11} fill="#cdd6d1" fontFamily={SANS} textAnchor="middle">écouteur (coupé)</Text>
      <Text x={189} y={160} fontSize={11} fill="#cdd6d1" fontFamily={SANS} textAnchor="middle">micro (coupé)</Text>
      {JACK_LEADS.map((l) => (
        <g key={l.id}>
          <path d={`M${l.branch === 'ecouteur' ? 62 : 189},198 C${l.branch === 'ecouteur' ? 62 : 189},215 ${l.x},215 ${l.x},${l.y}`} stroke="#cdd6d1" strokeWidth={5.5} fill="none" opacity={0.75} />
          <path d={`M${l.branch === 'ecouteur' ? 62 : 189},198 C${l.branch === 'ecouteur' ? 62 : 189},215 ${l.x},215 ${l.x},${l.y}`} stroke={colors[l.id] ?? l.color} strokeWidth={3} fill="none" />
          <circle cx={l.x} cy={l.y} r={4} fill={colors[l.id] ?? l.color} />
        </g>
      ))}
    </g>
  )
}
