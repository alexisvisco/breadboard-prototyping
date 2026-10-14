// Onglet « Diff » : ce qui a changé depuis une version, affiché d'un coup sur le canevas.

import { DiffSign, LinkSign } from './icons'
import { useEffect, useMemo, useState } from 'react'
import { fetchVersion, listVersions, type VersionMeta } from './api'
import { DIFF_COLORS, diffSessions, normalize, type Session } from './model'

interface Props {
  session: Session
  onBase: (s: Session | null) => void
  onHighlight: (ids: string[]) => void
}

const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function DiffTab({ session, onBase, onHighlight }: Props) {
  const [list, setList] = useState<VersionMeta[] | null>(null)
  const [vid, setVid] = useState<number | null>(null)
  const [base, setBase] = useState<Session | null>(null)

  useEffect(() => {
    listVersions(session.id)
      .then((l) => {
        setList(l)
        if (l.length) setVid((v) => v ?? l[0].id)
      })
      .catch(() => setList([]))
  }, [session.id])

  useEffect(() => {
    if (vid === null) return
    let alive = true
    fetchVersion(session.id, vid).then((r) => alive && setBase(normalize(r.session)))
    return () => {
      alive = false
    }
  }, [vid, session.id])

  // Le canevas montre le diff tant que l'onglet est ouvert.
  useEffect(() => {
    onBase(base)
    return () => onBase(null)
  }, [base, onBase])

  const diff = useMemo(() => (base ? diffSessions(base, session) : null), [base, session])
  const color = { add: 'text-emerald-300', del: 'text-red-300', mod: 'text-orange-300' }

  if (list && !list.length)
    return <p className="text-sm leading-relaxed text-white/50">Pas encore de version. Crée-en une dans l'onglet « Versions » : ensuite, tout ce que tu changes apparaît ici, en couleur sur le canevas.</p>

  return (
    <div className="space-y-4 text-sm">
      <label className="grid gap-1.5">
        <span className="text-white/50">Ce qui a changé depuis</span>
        <select value={vid ?? ''} onChange={(e) => setVid(Number(e.target.value))} className="rounded border border-white/15 bg-[#101614] px-2 py-1.5">
          {list?.map((v) => <option key={v.id} value={v.id}>{v.name} · {fmt(v.createdAt)}</option>)}
        </select>
      </label>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-5 rounded-full" style={{ background: DIFF_COLORS.add }} /> ajouté</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-5 rounded-full" style={{ background: DIFF_COLORS.mod }} /> déplacé / modifié</span>
        <span className="flex items-center gap-1.5"><i className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: DIFF_COLORS.del }} /> retiré (ancienne place)</span>
      </div>

      {!diff && <p className="text-white/45">Chargement…</p>}
      {diff && !diff.lines.length && !diff.linksAdded.length && !diff.linksRemoved.length && <p className="text-white/50">Rien n'a changé depuis cette version.</p>}
      {diff && diff.lines.length > 0 && (
        <ul className="grid gap-1">
          {diff.lines.map((l, i) => (
            <li
              key={i}
              onPointerEnter={() => l.partId && onHighlight([l.partId])}
              onPointerLeave={() => onHighlight([])}
              className="flex gap-2 rounded px-2 py-1 hover:bg-white/5"
            >
              <span className={`shrink-0 font-bold ${color[l.type]}`}><DiffSign type={l.type} /></span>
              <span className="leading-snug">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
      {diff && (diff.linksAdded.length > 0 || diff.linksRemoved.length > 0) && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-white/55">Liaisons électriques</h4>
          <ul className="grid gap-0.5 font-mono text-xs">
            {diff.linksAdded.map((l) => <li key={`+${l}`} className="text-emerald-300"><LinkSign add /> {l}</li>)}
            {diff.linksRemoved.map((l) => <li key={`-${l}`} className="text-red-300"><LinkSign add={false} /> {l}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
