// Échange avec un assistant (Claude) en JSON : mode d'emploi + état actuel à copier,
// et lecture / vérification d'un JSON proposé en retour (nouvelle version, calques).

import { BREAD_PRESETS, EXTRA_PORT, MCU_MODELS, cleanExtra, extraDesc, layoutOf, registerExtras, type Extra } from './boards'
import { CARD_PIN, CARD_PINS, JACK_LEAD, JACK_LEADS, isHole } from './geom'
import { resolvePort, type Layer } from './layers'
import {
  BLOCKS, LEGS, LEG_NAMES, LED_COLORS, SHOP, WIRE_COLORS, legCount, legsOf, newId, normalize, summary, analyse, type BlockId, type Kind, type Part, type Session,
} from './model'

const KINDS: Kind[] = ['R', 'CE', 'CC', 'LED', 'D', 'BTN', 'W', 'L', ...SHOP.map((s) => s.kind)]

/** Texte à coller dans une conversation avec Claude : règles + état actuel. */
export function agentBrief(s: Session, origin: string): string {
  const pins = CARD_PINS.map((p) => `${p.id}=${p.name}`).join(', ')
  const leads = JACK_LEADS.map((l) => `${l.id} (${l.label})`).join(', ')
  const shop = SHOP.map((it) => `- ${it.kind} : ${it.title}${LEG_NAMES[it.kind] ? ` — ${legCount(it.kind)} pattes ${LEGS.slice(0, legCount(it.kind)).join('/')} = ${LEG_NAMES[it.kind]!.join(' / ')}` : ''}${it.values ? ` — valeurs : ${it.values.join(', ')}` : ''}${it.colors ? ` — couleurs : ${it.colors.map((c) => `${c.name} ${c.hex}`).join(', ')}` : ''}`).join('\n')
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
- Rails : chaque trou de rail porte le numéro de la colonne au-dessus de laquelle il se trouve, de 60 (gauche) à 3 (droite).
  50 trous par rail, par groupes de 5 : 60–56, 54–50, 48–44, 42–38, 36–32, 31–27, 25–21, 19–15, 13–9, 7–3 (pas de trou sous 55, 49, 43, 37, 26, 20, 14, 8).
  "+H44" / "-H44" : rails du haut sous la colonne 44 ; "+B44" / "-B44" : rails du bas. Tout un rail est relié (ex. tous les "-B…").
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
- Pièces à 3 ou 4 pattes (POT, NPN, PNP, NMOS, REG, SERVO, RGB, SONAR) : "a", "b", "c" (et "d") dans l'ordre des noms ci-dessus ; les pattes se posent côte à côte (ex. "a": "e25", "b": "e24", "c": "e23"), dans trois colonnes différentes. Toutes posées, ou aucune.
- W (fil Dupont) : "a" et "b" = un trou ou une broche de la carte. "b": null = bout libre.
  Courbure facultative d'un fil : "bend" (nombre de pixels, ex. 80 ou -120). Le milieu du fil s'écarte de cette distance de la ligne droite a→b ;
  positif = côté droit en allant de "a" vers "b" (à l'écran, a à gauche et b à droite : positif = vers le bas). Un trou = 24 px. 0 = fil tendu.
  Sans "bend", le fil pend naturellement sous ses deux bouts. Sers-toi de "bend" pour que les fils ne se croisent pas et ne cachent pas les trous ; l'utilisateur peut aussi les courber à la main.
- Remettre une pièce dans la boîte : "a": null, "b": null.

## Blocs (carte, câble jack)
- "blocks" : liste des blocs dans la boîte : "card" (${BLOCKS.card.title}), "jack" (${BLOCKS.jack.title}), et l'identifiant de chaque planche de "extras".
- Un bloc est posé s'il a une position dans "nodes" : { "x", "y", "rot" } (rot = 0, 90, 180 ou 270). "nodes.bb" est la breadboard (largeur 1560, hauteur 456).
- Broches de la carte (pour les fils W) : ${pins}.
- Fils du câble jack (pièces "kind": "L", "a" = départ fixe, "b" = trou où le bout est planté ou null) : ${leads}.

## Planches supplémentaires ("extras")
Le magasin permet d'ajouter d'autres planches. Chacune est un objet de "session.extras", posée comme un bloc ("nodes.<id>" = { x, y, rot }) et listée dans "blocks".
  { "id": "bread1", "kind": "bread", "title": "Breadboard 400", "cols": 30, "rails": true }
  { "id": "perf1", "kind": "perf", "title": "Plaque 5×7", "cols": 18, "rows": 24 }
  { "id": "strip1", "kind": "strip", "title": "Stripboard", "cols": 20, "rows": 10 }
  { "id": "mcu1", "kind": "mcu", "title": "ESP32 DevKit", "model": "esp32-devkit" }
Ne modifie pas une planche existante (taille, modèle) : ajoutes-en une nouvelle avec un nouvel "id" (bread2, perf2, mcu2…) si besoin.
Les ports d'une planche s'écrivent "<id>:<port>" (ex. "bread1:e12", "perf1:C4", "mcu1:IO5") et s'utilisent partout où l'on met un trou ou une broche (pattes, fils, calques).
- bread : colonnes numérotées 1 (gauche) → "cols" (droite), lignes a–e et f–j, comme la breadboard principale mais dans l'autre sens ; 5 trous d'une colonne-moitié reliés. Si "rails" : "+H1…", "-H1…" (haut) et "+B1…", "-B1…" (bas), tout un rail est relié.
- perf : colonnes A, B, C… (AA après Z) et lignes 1, 2, 3… : "perf1:C4" = colonne C, ligne 4. Aucun trou n'est relié aux autres : on relie avec des fils (ponts de soudure). strip : même chose, mais tous les trous d'une ligne sont reliés (bande de cuivre).
- mcu : cartes de développement. Les broches ont leur nom pour identifiant (ex. "mcu1:IO5", "mcu1:3V3", "mcu1:GND", "mcu1:GND-2" pour la 2e masse). Seuls les fils (W) vont sur les broches.
Planches existantes :
${(s.extras ?? []).map((x) => `- ${x.id} (${x.title}, ${extraDesc(x)})${s.nodes[x.id] ? '' : ' — pas posée'}${x.kind === 'mcu' ? ` : ${layoutOf(x.id)?.ports.map((q) => `${q.id.split(':')[1]}${q.name !== q.id.split(':')[1] ? `=${q.name}` : ''}`).join(', ')}` : ''}`).join('\n') || '(aucune)'}
Modèles de cartes ("model") : ${Object.entries(MCU_MODELS).map(([k, m]) => `${k} (${m.title})`).join(' ; ')}.
Tailles de breadboard usuelles : ${BREAD_PRESETS.map((p) => `${p.title} = ${p.cols} colonnes${p.rails ? ' + rails' : ''}`).join(' ; ')}.

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

  // Planches supplémentaires : celles qu'on connaît déjà gardent leur forme ; les nouvelles sont vérifiées.
  const extras: Extra[] = [...(current.extras ?? [])]
  if (Array.isArray(sess.extras)) {
    for (const raw of sess.extras as Record<string, unknown>[]) {
      const id = String(raw?.id ?? '')
      const known = extras.find((x) => x.id === id)
      if (known) {
        if (JSON.stringify(cleanExtra({ ...known, ...raw, id } as Extra)) !== JSON.stringify(known)) out.warnings.push(`Planche « ${id} » : sa taille / son modèle ne peuvent pas changer, l'existante est gardée.`)
        continue
      }
      const kind = raw?.kind
      if (!/^[a-z][a-z0-9]{1,20}$/i.test(id) || ['bb', 'card', 'jack'].includes(id)) out.errors.push(`Planche « ${id} » : identifiant invalide.`)
      else if (kind !== 'bread' && kind !== 'perf' && kind !== 'strip' && kind !== 'mcu') out.errors.push(`Planche « ${id} » : "kind" doit être bread, perf, strip ou mcu.`)
      else if (kind === 'mcu' && !MCU_MODELS[String(raw.model)]) out.errors.push(`Planche « ${id} » : modèle « ${String(raw.model)} » inconnu (${Object.keys(MCU_MODELS).join(', ')}).`)
      else extras.push(cleanExtra({ id, kind, title: String(raw.title ?? id), cols: Number(raw.cols) || undefined, rows: Number(raw.rows) || undefined, rails: !!raw.rails, model: kind === 'mcu' ? String(raw.model) : undefined }))
    }
  }
  registerExtras(extras)

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
      if (kind !== 'W' && kind !== 'L' && !isHole(r)) out.errors.push(`${name} : seuls les fils peuvent aller sur une broche (${String(v)}).`)
      return r
    }
    const legs = legsOf({ kind })
    const at: Partial<Record<(typeof LEGS)[number], string | null>> = {}
    for (const l of legs) at[l] = l === 'a' && kind === 'L' ? id : port(p[l], l)
    const placed = legs.filter((l) => at[l]).length
    if (kind !== 'W' && kind !== 'L' && placed > 0 && placed < legs.length) out.errors.push(`${name} : ${placed} patte(s) placée(s) sur ${legs.length} ; mets-les toutes, ou aucune.`)
    const shop = SHOP.find((s) => s.kind === kind)
    const part: Part = {
      id,
      kind,
      label: name,
      value: p.value === undefined || p.value === null ? undefined : String(p.value),
      color: String(p.color ?? (kind === 'L' ? JACK_LEAD.get(id)!.color : (shop?.color ?? '#888888'))),
      ...(kind === 'W' && Number.isFinite(Number(p.bend)) && p.bend !== null && p.bend !== '' ? { bend: Math.max(-800, Math.min(800, Math.round(Number(p.bend)))) } : {}),
      a: at.a ?? (kind === 'W' ? (at.b ?? null) : null),
      b: kind === 'W' && !at.a ? null : (at.b ?? null),
    }
    if (legs.length > 2) {
      part.c = at.c ?? null
      if (legs.length > 3) part.d = at.d ?? null
    }
    parts.push(part)
  })

  const nodes = { ...((sess.nodes as Session['nodes']) ?? {}) }
  if (!nodes.bb) nodes.bb = current.nodes.bb
  const blockIds = ['card', 'jack', ...extras.map((x) => x.id)]
  let blocks = (Array.isArray(sess.blocks) ? sess.blocks : current.blocks).filter((b): b is BlockId => blockIds.includes(b))
  for (const b of blockIds) if (nodes[b] && !blocks.includes(b)) blocks = [...blocks, b]
  for (const x of extras) if (!blocks.includes(x.id)) blocks = [...blocks, x.id]
  for (const b of blockIds) {
    const pos = nodes[b]
    if (pos && (typeof pos.x !== 'number' || typeof pos.y !== 'number')) out.errors.push(`nodes.${b} : il faut "x" et "y" numériques.`)
  }
  if (!nodes.card && parts.some((p) => p.kind === 'W' && [p.a, p.b].some((e) => e && CARD_PIN.has(e))))
    out.warnings.push('Des fils vont sur la carte alors qu’elle n’est pas posée (nodes.card manquant) : ils seront invisibles.')
  for (const x of extras)
    if (!nodes[x.id] && parts.some((p) => legsOf(p).some((l) => EXTRA_PORT.get(p[l] ?? '')?.node === x.id)))
      out.warnings.push(`Des pièces vont sur « ${x.id} » alors qu’elle n’est pas posée (nodes.${x.id} manquant) : elles seront invisibles.`)

  // Le mode d'emploi donne déjà les rails par colonne : pas de conversion à l'import.
  const session = normalize({ id: current.id, name: current.name, createdAt: current.createdAt, nodes, blocks, parts, ...(extras.length ? { extras } : {}), railNumbering: 'col' })
  if (blocks.includes('jack') && !parts.some((p) => p.kind === 'L')) out.warnings.push('Bloc jack sans ses fils : ils sont recréés, débranchés.')
  out.session = session
  return out
}
