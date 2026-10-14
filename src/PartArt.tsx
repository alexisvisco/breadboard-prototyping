// Dessin des pièces : corps à plat le long de l'axe de leurs pattes (2 pattes), ou boîtier au-dessus de leurs pattes (3 pattes ou plus).

import { resistorBands, type Part } from './model'

type Look = Pick<Part, 'kind' | 'value' | 'color'>

/** Hauteur de la pièce au-dessus de ses pattes, et taille de son boîtier. */
export const MULTI_LIFT = 36

/** Corps d'une pièce, dessiné à plat le long de l'axe de ses pattes (a à gauche, b à droite). */
export function PartBody({ p }: { p: Look }) {
  switch (p.kind) {
    case 'R':
      return (
        <>
          <rect x={-21} y={-8} width={42} height={16} rx={7} fill={p.color} stroke="#000" strokeOpacity={0.2} />
          {resistorBands(p.value).map(([, c], i) => <rect key={i} x={-15 + i * 7 + (i === 3 ? 5 : 0)} y={-8} width={4} height={16} fill={c} />)}
        </>
      )
    case 'CE':
      return (
        <>
          <rect x={-18} y={-12} width={36} height={24} rx={6} fill={p.color} />
          <rect x={10} y={-12} width={8} height={24} rx={3} fill="#c7d2fe" />
          <text x={11} y={4} fontSize={10} fontWeight={800} fill="#1f3a93">−</text>
        </>
      )
    case 'CC':
      return (
        <>
          <ellipse rx={13} ry={11} fill={p.color} stroke="#000" strokeOpacity={0.25} />
          <text y={3} fontSize={6} textAnchor="middle" fill="#3b2a0a">{p.value?.replace(/\s/g, '') ?? ''}</text>
        </>
      )
    case 'LED':
      return (
        <>
          <circle r={12} fill={p.color} fillOpacity={0.9} stroke="#000" strokeOpacity={0.35} />
          <circle cx={-3} cy={-4} r={3.5} fill="#fff" fillOpacity={0.6} />
          <line x1={8} y1={-11} x2={8} y2={11} stroke="#000" strokeOpacity={0.35} strokeWidth={2} />
        </>
      )
    case 'D':
      return (
        <>
          <rect x={-16} y={-6} width={32} height={12} rx={3} fill={p.color} />
          <rect x={9} y={-6} width={4} height={12} fill="#ced4da" />
        </>
      )
    case 'BTN':
      return (
        <>
          <rect x={-14} y={-14} width={28} height={28} rx={3} fill={p.color} stroke="#111" />
          <circle r={8} fill="#1a1a1a" stroke="#555" />
        </>
      )
    case 'SW':
      return (
        <>
          <rect x={-18} y={-9} width={36} height={18} rx={3} fill={p.color} stroke="#1d2125" />
          <rect x={-8} y={-5} width={16} height={10} rx={2} fill="#1a1d20" />
          <rect x={-8} y={-5} width={8} height={10} rx={2} fill="#cfd4d9" />
        </>
      )
    case 'LDR':
      return (
        <>
          <circle r={13} fill={p.color} stroke="#7a5f1c" />
          <path d="M-8,-6 H8 M8,-6 V-2 H-8 V2 H8 V6 H-8" fill="none" stroke="#5a3d0a" strokeWidth={2} />
        </>
      )
    case 'NTC':
      return (
        <>
          <ellipse rx={9} ry={12} fill={p.color} stroke="#1f4f9a" />
          <ellipse cx={-3} cy={-5} rx={2.5} ry={4} fill="#fff" fillOpacity={0.45} />
        </>
      )
    case 'BZ':
      return (
        <>
          <circle r={14} fill={p.color} stroke="#000" />
          <circle r={3.5} fill="#444" />
          <text x={-12} y={-5} fontSize={11} fontWeight={800} fill="#ffd43b">+</text>
        </>
      )
    case 'IND':
      return (
        <>
          <rect x={-18} y={-9} width={36} height={18} rx={9} fill={p.color} stroke="#5d3b18" />
          {[-9, -3, 3, 9].map((x) => <path key={x} d={`M${x},-9 Q${x + 4},0 ${x},9`} fill="none" stroke="#e3c08a" strokeWidth={2} />)}
        </>
      )
    case 'MOT':
      return (
        <>
          <circle r={15} fill={p.color} stroke="#5a636b" />
          <text y={5} fontSize={15} fontWeight={800} textAnchor="middle" fill="#2c3238">M</text>
        </>
      )
    case 'BAT':
      return (
        <>
          <rect x={-20} y={-11} width={40} height={22} rx={3} fill={p.color} stroke="#6b4e08" />
          <rect x={-14} y={-11} width={6} height={22} fill="#3b2f06" fillOpacity={0.35} />
          <text x={-18} y={5} fontSize={14} fontWeight={800} fill="#fff6d6">+</text>
        </>
      )
    default:
      return null
  }
}

/** Boîtier d'une pièce à 3 pattes ou plus, centré en (0, 0) ; ses pattes arrivent par le bas (y > 10). */
export function MultiBody({ p }: { p: Look }) {
  switch (p.kind) {
    case 'POT':
      return (
        <>
          <rect x={-18} y={-12} width={36} height={24} rx={4} fill={p.color} stroke="#1b4373" />
          <circle cy={-2} r={9} fill="#cfd4d9" stroke="#7d828a" />
          <line x1={0} y1={-2} x2={5} y2={-8} stroke="#2b2f33" strokeWidth={2.5} strokeLinecap="round" />
        </>
      )
    case 'NPN':
    case 'PNP':
    case 'NMOS':
      return (
        <>
          <path d="M-14,10 L-14,-2 A14,14 0 0 1 14,-2 L14,10 Z" fill={p.color} stroke="#000" />
          <text y={7} fontSize={7.5} textAnchor="middle" fill="#e9ecef" fontFamily="JetBrains Mono, ui-monospace, monospace">{p.value?.slice(0, 7) ?? p.kind}</text>
        </>
      )
    case 'REG':
      return (
        <>
          <rect x={-16} y={-18} width={32} height={9} rx={1} fill="#b9bfc6" stroke="#7d828a" />
          <circle cy={-13.5} r={2.4} fill="#555" />
          <rect x={-16} y={-9} width={32} height={19} fill={p.color} stroke="#000" />
          <text y={5} fontSize={7} textAnchor="middle" fill="#e9ecef" fontFamily="JetBrains Mono, ui-monospace, monospace">{p.value?.split(' ')[0].slice(0, 7) ?? 'REG'}</text>
        </>
      )
    case 'SERVO':
      return (
        <>
          <rect x={-22} y={-12} width={44} height={22} rx={3} fill={p.color} stroke="#16407f" />
          <circle cx={-10} cy={-1} r={6} fill="#e9ecef" stroke="#8a9096" />
          <rect x={-10} y={-3} width={22} height={5} rx={2.5} fill="#e9ecef" stroke="#8a9096" />
        </>
      )
    case 'RGB':
      return (
        <>
          <circle r={13} fill={p.color} fillOpacity={0.9} stroke="#000" strokeOpacity={0.35} />
          <circle cx={-6} cy={0} r={3.3} fill="#ff4d4d" /><circle cx={0} cy={-2} r={3.3} fill="#4cd964" /><circle cx={6} cy={0} r={3.3} fill="#4dabf7" />
        </>
      )
    case 'SONAR':
      return (
        <>
          <rect x={-26} y={-14} width={52} height={26} rx={2} fill={p.color} stroke="#154a7c" />
          <circle cx={-12} cy={-1} r={9} fill="#cfd4d9" stroke="#7d828a" /><circle cx={12} cy={-1} r={9} fill="#cfd4d9" stroke="#7d828a" />
          <circle cx={-12} cy={-1} r={4.5} fill="#3a3f45" /><circle cx={12} cy={-1} r={4.5} fill="#3a3f45" />
        </>
      )
    default:
      return null
  }
}

