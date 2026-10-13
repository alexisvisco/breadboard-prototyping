// Échange avec un assistant (Claude) en JSON : mode d'emploi + état actuel à copier,
// et lecture / vérification d'un JSON proposé en retour (nouvelle version, calques).

import { BB_HOLE, CARD_PIN, CARD_PINS, JACK_LEAD, JACK_LEADS } from './geom'
import { resolvePort, type Layer } from './layers'
import {
  BLOCKS, LED_COLORS, SHOP, WIRE_COLORS, newId, normalize, summary, analyse, type BlockId, type Kind, type Part, type Session,
} from './model'

const KINDS: Kind[] = ['R', 'CE', 'CC', 'LED', 'D', 'BTN', 'W', 'L']

/** Texte à coller dans une conversation avec Claude : règles + état actuel. */
export function agentBrief(s: Session, origin: string): string {
  const pins = CARD_PINS.map((p) => `${p.id}=${p.name}`).join(', ')
  const leads = JACK_LEADS.map((l) => `${l.id} (${l.label})`).join(', ')
  const shop = SHOP.map((it) => `- ${it.kind} : ${it.title}${it.values ? ` — valeurs : ${it.values.join(', ')}` : ''}${it.colors ? ` — couleurs : ${it.colors.map((c) => `${c.name} ${c.hex}`).join(', ')}` : ''}`).join('\n')
  return `# Montage breadboard « ${s.name} » — mode d'emploi pour Claude

Tu aides à reproduire et diagnostiquer un montage électronique réel (l'utilisateur débute).
Ci-dessous : les règles du format, un résumé lisible, puis le JSON complet de la session.

## Comment répondre
- Pour proposer une modification du montage : renvoie le JSON COMPLET dans un bloc \`\`\`json, sous la forme
  { "name": "nom de la version", "session": { …session complète modifiée… }, "layers": [ …calques facultatifs… ] }
  L'utilisateur le colle dans « Importer un JSON » : l'app vérifie, montre le diff et crée une version (qu'il applique ou non).
- Pour seulement montrer où mesurer, sans toucher au montage : renvoie { "layers": [ … ] }.
- Si tu as accès au réseau : POST ${origin}/api/sessions/${s.id}/versions avec {"name","session","summary":""} crée une version ;
  PUT ${origin}/api/sessions/${s.id}/layers/<id> avec un calque l'affiche directement ; GET …/summary donne le résumé texte.
- Ne change pas "id", "name", "createdAt" de la session. Garde les "id" des pièces existantes (le diff s'en sert).

## La breadboard (toujours là)
- Trous : lettre + colonne, ex. "e25". Lignes a–e (moitié haute) et f–j (moitié basse), colonnes 1 à 62 (62 à GAUCHE, 1 à droite).
- Sous la planche, les 5 trous d'une même colonne d'une moitié sont reliés : a25–e25 ensemble, f25–j25 ensemble (pas a25 avec f25).
- Rails : "+H1"…"+H50", "-H1"…"-H50" (en haut), "+B1"…"+B50", "-B1"…"-B50" (en bas). Tout un rail est relié (ex. tous les "-B…").
  Trou 1 du rail sous la colonne 60, trou 50 sous la colonne 3.
- Un trou ne prend qu'une seule patte.

## Ajouter une pièce « depuis le magasin »
Ajoute un objet dans "parts" avec "a": null et "b": null (= dans la boîte, pas posée) :
  { "id": "nouvel-id-unique", "kind": "R", "label": "R3", "value": "330 Ω", "color": "#e3cf9f", "a": null, "b": null }
Types ("kind") :
${shop}
- L : fil du câble jack (créé automatiquement avec le bloc jack, ne pas en ajouter).
Noms : R1, R2… / C1, C2… (CE et CC partagent C) / LED1… / D1… / BP1… / "Fil 1", "Fil 2"…
Couleur ("color") : hexadécimal ; pour les fils, une de : ${WIRE_COLORS.map((c) => c.hex).join(', ')} ; LED : ${LED_COLORS.map((c) => c.hex).join(', ')}.

## Placer une pièce
Mets dans "a" et "b" les trous où vont ses deux pattes, ex. "a": "e25", "b": "e21".
- CE (chimique) et LED : "a" = patte + (longue). D (diode) : "a" = anode, "b" = cathode (côté bague).
- Les deux pattes d'une pièce doivent être dans deux groupes de trous différents, sinon elle est court-circuitée.
- W (fil Dupont) : "a" et "b" = un trou ou une broche de la carte. "b": null = bout libre.
- Remettre une pièce dans la boîte : "a": null, "b": null.

## Blocs (carte, câble jack)
- "blocks" : liste des blocs dans la boîte, parmi "card" (${BLOCKS.card.title}) et "jack" (${BLOCKS.jack.title}).
- Un bloc est posé s'il a une position dans "nodes" : { "x", "y", "rot" } (rot = 0, 90, 180 ou 270). "nodes.bb" est la breadboard (largeur 1560, hauteur 456).
- Broches de la carte (pour les fils W) : ${pins}.
- Fils du câble jack (pièces "kind": "L", "a" = départ fixe, "b" = trou où le bout est planté ou null) : ${leads}.

## Calques d'annotation (facultatif, pour guider une mesure)
{ "id": "mesure-1", "name": "Mesure 1",
  "steps": [ "Débranche l'USB", "Multimètre en mode bip", { "text": "Pointe rouge", "port": "e25" }, { "text": "Pointe noire", "port": "e24" } ],
  "description": "pourquoi / comment interpréter (replié sous « Pourquoi ? »)", "items": [
  { "type": "probe", "port": "e25", "color": "rouge", "label": "rouge" },
  { "type": "probe", "port": "e24", "color": "noir", "label": "noir" },
  { "type": "part", "part": "R2", "color": "orange", "label": "à vérifier" },
  { "type": "line", "from": "e21", "to": "-B20", "color": "bleu", "label": "fil à ajouter" },
  { "type": "note", "port": "IO9", "text": "doit lire ~2180" } ] }
Étapes : courtes, une action chacune ; "port" ajoute un bouton qui montre le trou. Cocher un calque le met en « focus » (le reste est grisé).
Ports acceptés : trous, noms de broches (IO9, GND, 3V3), fils jack (EAR_P, mic 1). Couleurs : rouge, noir, orange, bleu, vert, jaune, violet, blanc, rose, gris.

## Résumé lisible de l'état actuel
${summary(s, analyse(s))}
## JSON de la session
\`\`\`json
${JSON.stringify(s, null, 1)}
\`\`\`
`
}

export interface ImportResult {
  name?: string
  session?: Session
  layers: Layer[]
  errors: string[]
  warnings: string[]
}

/** Lit ce que Claude a renvoyé : un bloc ```json, ou du JSON brut (session seule, ou {name, session, layers}). */
export function parseImport(text: string, current: Session): ImportResult {
  const out: ImportResult = { layers: [], errors: [], warnings: [] }
  const block = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  let raw: unknown
  try {
    raw = JSON.parse((block ? block[1] : text).trim())
  } catch (e) {
    out.errors.push(`JSON illisible : ${e instanceof Error ? e.message : e}`)
    return out
  }
  if (!raw || typeof raw !== 'object') {
    out.errors.push('Le JSON doit être un objet.')
    return out
  }
  const obj = raw as Record<string, unknown>
  const sess = (obj.session ?? (Array.isArray(obj.parts) ? obj : null)) as Record<string, unknown> | null
  if (typeof obj.name === 'string' && obj.session) out.name = obj.name

  if (Array.isArray(obj.layers)) {
    obj.layers.forEach((l, i) => {
      const L = l as Partial<Layer>
      if (!L || !Array.isArray(L.items)) return out.errors.push(`Calque ${i + 1} : "items" manquant.`)
      for (const it of L.items) {
        const refs = it.type === 'line' ? [it.from, it.to] : it.type === 'part' ? [] : [it.port]
        for (const r of refs) if (!resolvePort(String(r))) out.warnings.push(`Calque « ${L.name ?? i + 1} » : port inconnu « ${r} ».`)
      }
      out.layers.push({ id: String(L.id ?? `import-${Date.now().toString(36)}-${i}`), name: String(L.name ?? `Calque ${i + 1}`), steps: Array.isArray(L.steps) ? L.steps : undefined, description: L.description, author: L.author ?? 'claude', visible: L.visible ?? true, items: L.items })
    })
  }
  if (!sess) {
    if (!out.layers.length) out.errors.push('Rien à importer : il faut "session" (ou "parts") et/ou "layers".')
    return out
  }
  if (!Array.isArray(sess.parts)) {
    out.errors.push('"parts" doit être une liste.')
    return out
  }

  const ids = new Set<string>()
  const parts: Part[] = []
  ;(sess.parts as Record<string, unknown>[]).forEach((p, i) => {
    const kind = p.kind as Kind
    const name = String(p.label ?? `pièce ${i + 1}`)
    if (!KINDS.includes(kind)) return out.errors.push(`${name} : type « ${String(p.kind)} » inconnu.`)
    let id = String(p.id ?? '')
    if (!id || ids.has(id)) id = kind === 'L' ? id : newId()
    if (kind === 'L' && !JACK_LEAD.has(id)) return out.errors.push(`${name} : fil jack « ${id} » inconnu.`)
    ids.add(id)
    const port = (v: unknown, end: string): string | null => {
      if (v === null || v === undefined || v === '') return null
      const r = resolvePort(String(v))
      if (!r) {
        out.errors.push(`${name} : patte ${end} sur « ${String(v)} », qui n'existe pas.`)
        return null
      }
      if (kind !== 'W' && kind !== 'L' && !BB_HOLE.has(r)) out.errors.push(`${name} : seuls les fils peuvent aller sur une broche (${String(v)}).`)
      return r
    }
    const a = kind === 'L' ? id : port(p.a, 'a')
    const b = port(p.b, 'b')
    if (kind !== 'W' && kind !== 'L' && !!a !== !!b) out.errors.push(`${name} : une seule patte placée ; mets les deux, ou aucune.`)
    const shop = SHOP.find((s) => s.kind === kind)
    parts.push({
      id,
      kind,
      label: name,
      value: p.value === undefined || p.value === null ? undefined : String(p.value),
      color: String(p.color ?? (kind === 'L' ? JACK_LEAD.get(id)!.color : (shop?.color ?? '#888888'))),
      a: a ?? (kind === 'W' ? b : null),
      b: kind === 'W' && !a ? null : b,
    })
  })

  const nodes = { ...((sess.nodes as Session['nodes']) ?? {}) }
  if (!nodes.bb) nodes.bb = current.nodes.bb
  let blocks = (Array.isArray(sess.blocks) ? sess.blocks : current.blocks).filter((b): b is BlockId => b === 'card' || b === 'jack')
  for (const b of ['card', 'jack'] as BlockId[]) if (nodes[b] && !blocks.includes(b)) blocks = [...blocks, b]
  for (const b of ['card', 'jack'] as BlockId[]) {
    const pos = nodes[b]
    if (pos && (typeof pos.x !== 'number' || typeof pos.y !== 'number')) out.errors.push(`nodes.${b} : il faut "x" et "y" numériques.`)
  }
  if (!nodes.card && parts.some((p) => p.kind === 'W' && [p.a, p.b].some((e) => e && CARD_PIN.has(e))))
    out.warnings.push('Des fils vont sur la carte alors qu’elle n’est pas posée (nodes.card manquant) : ils seront invisibles.')

  const session = normalize({ id: current.id, name: current.name, createdAt: current.createdAt, nodes, blocks, parts })
  if (blocks.includes('jack') && !parts.some((p) => p.kind === 'L')) out.warnings.push('Bloc jack sans ses fils : ils sont recréés, débranchés.')
  out.session = session
  return out
}
