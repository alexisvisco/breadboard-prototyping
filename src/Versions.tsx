// Versions d'une session : instantanés nommés, comparaison (diff) et restauration.

import { useEffect, useMemo, useState } from 'react'
import { ask, confirmAsk } from './dialog'
import { createVersion, deleteVersion, fetchVersion, listVersions, type VersionMeta } from './api'
import { analyse, diffSessions, normalize, summary, type Session } from './model'

interface Props {
  session: Session
  onRestore: (s: Session) => void
  onHighlight: (ids: string[]) => void
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Versions({ session, onRestore, onHighlight }: Props) {
  const [list, setList] = useState<VersionMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<Record<number, Session>>({})
  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | 'now'>('now')

  const refresh = () =>
    listVersions(session.id)
      .then((l) => { setList(l); setError(null) })
      .catch(() => setError('Serveur injoignable : les versions ne sont pas disponibles.'))

  useEffect(() => {
    refresh()
    setFrom(null)
    setTo('now')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  // Charge les versions comparées.
  useEffect(() => {
    for (const v of [from, to])
      if (typeof v === 'number' && !cache[v])
        fetchVersion(session.id, v).then((r) => setCache((c) => ({ ...c, [v]: normalize(r.session) })))
  }, [from, to, cache, session.id])

  const a = from !== null ? cache[from] : null
  const b = to === 'now' ? session : cache[to]
  const diff = useMemo(() => (a && b ? diffSessions(a, b) : null), [a, b])

  async function create() {
    const name = await ask('Nom de la version', `Version ${list.length + 1}`, 'Une photo de l\u2019état actuel du montage.')
    if (!name) return
    await createVersion(session, name, summary(session, analyse(session)))
    refresh()
  }

  async function restore(v: VersionMeta) {
    if (!(await confirmAsk(`Remettre le montage dans l'état « ${v.name} » ?`, 'L\u2019état actuel sera remplacé. Crée d\u2019abord une version si tu veux le garder.', { ok: 'Restaurer' }))) return
    const r = await fetchVersion(session.id, v.id)
    const s = normalize(r.session)
    onRestore({ ...session, nodes: s.nodes, blocks: s.blocks, parts: s.parts, extras: s.extras })
  }

  async function remove(v: VersionMeta) {
    if (!(await confirmAsk(`Supprimer la version « ${v.name} » ?`, undefined, { ok: 'Supprimer', danger: true }))) return
    await deleteVersion(session.id, v.id)
    if (from === v.id) setFrom(null)
    if (to === v.id) setTo('now')
    refresh()
  }

  const color = { add: 'text-emerald-300', del: 'text-red-300', mod: 'text-yellow-200' }
  const sign = { add: '＋', del: '−', mod: '~' }

  return (
    <div className="space-y-4">
      <button onClick={create} className="w-full rounded-lg bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-[#0d1512] hover:bg-emerald-400">
        Créer une version de l'état actuel
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!list.length && !error && (
        <p className="text-sm leading-relaxed text-white/50">
          Une version, c'est une photo du montage. Fais-en une quand quelque chose marche (ou avant de tout démonter), puis compare pour voir ce qui a changé.
        </p>
      )}

      {list.length > 0 && (
        <ul className="grid gap-1.5">
          {list.map((v) => (
            <li key={v.id} className={`group rounded-md px-3 py-2 text-sm ${from === v.id || to === v.id ? 'bg-yellow-300/10 ring-1 ring-yellow-300/40' : 'bg-white/[0.04]'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{v.name}</span>
                <span className="shrink-0 text-xs text-white/40">{fmt(v.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex gap-1.5 text-xs">
                <button className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20" onClick={() => { setFrom(v.id); setTo('now') }}>Comparer à maintenant</button>
                <button className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20" onClick={() => restore(v)}>Restaurer</button>
                <button className="ml-auto rounded px-2 py-0.5 text-white/40 hover:bg-red-500/20 hover:text-red-300" onClick={() => remove(v)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.length > 0 && (
        <div className="rounded-lg border border-white/10 p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Comparer</h3>
          <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 text-sm">
            <span className="text-white/50">de</span>
            <select value={from ?? ''} onChange={(e) => setFrom(e.target.value ? Number(e.target.value) : null)} className="rounded border border-white/15 bg-[#101614] px-2 py-1">
              <option value="">— choisir —</option>
              {list.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <span className="text-white/50">à</span>
            <select value={to} onChange={(e) => setTo(e.target.value === 'now' ? 'now' : Number(e.target.value))} className="rounded border border-white/15 bg-[#101614] px-2 py-1">
              <option value="now">l'état actuel</option>
              {list.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          {from !== null && !diff && <p className="mt-3 text-sm text-white/45">Chargement…</p>}
          {diff && (
            <div className="mt-3 space-y-3 text-sm">
              {!diff.lines.length && !diff.linksAdded.length && !diff.linksRemoved.length && <p className="text-white/50">Aucune différence.</p>}
              {diff.lines.length > 0 && (
                <ul className="grid gap-1">
                  {diff.lines.map((l, i) => (
                    <li
                      key={i}
                      onPointerEnter={() => to === 'now' && l.partId && onHighlight([l.partId])}
                      onPointerLeave={() => onHighlight([])}
                      className="flex gap-2 rounded px-2 py-1 hover:bg-white/5"
                    >
                      <span className={`shrink-0 font-bold ${color[l.type]}`}>{sign[l.type]}</span>
                      <span className="leading-snug">{l.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(diff.linksAdded.length > 0 || diff.linksRemoved.length > 0) && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-white/55">Liaisons électriques</h4>
                  <ul className="grid gap-0.5 font-mono text-xs">
                    {diff.linksAdded.map((l) => <li key={`+${l}`} className="text-emerald-300">＋ {l}</li>)}
                    {diff.linksRemoved.map((l) => <li key={`-${l}`} className="text-red-300">− {l}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
