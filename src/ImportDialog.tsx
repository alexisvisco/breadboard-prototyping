// « Importer un JSON » : coller la réponse de Claude → vérification, diff, création d'une version.

import { DiffSign, LinkSign } from './icons'
import { useMemo, useState } from 'react'
import { parseImport } from './agent'
import { createVersion } from './api'
import { putLayer } from './layers'
import { analyse, diffSessions, summary, type Session } from './model'

interface Props {
  session: Session
  onClose: () => void
  onApply: (s: Session) => void
  onDone: () => void
}

export function ImportDialog({ session, onClose, onApply, onDone }: Props) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const res = useMemo(() => (text.trim() ? parseImport(text, session) : null), [text, session])
  const diff = useMemo(() => (res?.session ? diffSessions(session, res.session) : null), [res, session])
  const ok = res && !res.errors.length && (res.session || res.layers.length)

  async function go(apply: boolean) {
    if (!res || !ok) return
    setBusy(true)
    try {
      if (res.session) {
        await createVersion(res.session, name.trim() || res.name || 'Proposition de Claude', summary(res.session, analyse(res.session)))
        if (apply) onApply(res.session)
      }
      for (const l of res.layers) await putLayer(session.id, l)
      onDone()
      onClose()
    } catch (e) {
      setErr(`Échec : ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  const color = { add: 'text-emerald-300', del: 'text-red-300', mod: 'text-yellow-200' }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 py-[6vh]" onPointerDown={onClose}>
      <div className="w-[min(760px,94vw)] rounded-xl border border-white/15 bg-[#18211d] text-[#e6ece8] shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold">Importer un JSON</h2>
            <p className="text-xs text-white/50">Colle la réponse de Claude (avec ou sans le bloc ```json). Rien ne change tant que tu ne valides pas.</p>
          </div>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-white/10">Fermer</button>
        </div>
        <div className="space-y-4 p-5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "name": "…", "session": { … }, "layers": [ … ] }'
            className="h-48 w-full resize-y rounded-md border border-white/15 bg-black/30 p-3 font-mono text-xs outline-none focus:border-emerald-400/60"
          />
          {res && (
            <div className="space-y-3 text-sm">
              {res.errors.map((e, i) => <p key={i} className="rounded bg-red-500/15 px-3 py-1.5 text-red-200">{e}</p>)}
              {res.warnings.map((e, i) => <p key={i} className="rounded bg-yellow-400/10 px-3 py-1.5 text-yellow-100">! {e}</p>)}
              {diff && !res.errors.length && (
                <div className="rounded-lg border border-white/10 p-3">
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">Changements par rapport à maintenant</h3>
                  {!diff.lines.length && !diff.linksAdded.length && !diff.linksRemoved.length && <p className="text-white/50">Aucune différence avec l'état actuel.</p>}
                  <ul className="grid gap-0.5">
                    {diff.lines.map((l, i) => (
                      <li key={i} className="flex gap-2"><span className={`font-bold ${color[l.type]}`}><DiffSign type={l.type} /></span>{l.text}</li>
                    ))}
                  </ul>
                  {(diff.linksAdded.length > 0 || diff.linksRemoved.length > 0) && (
                    <ul className="mt-2 grid gap-0.5 font-mono text-xs">
                      {diff.linksAdded.map((l) => <li key={`+${l}`} className="text-emerald-300"><LinkSign add /> {l}</li>)}
                      {diff.linksRemoved.map((l) => <li key={`-${l}`} className="text-red-300"><LinkSign add={false} /> {l}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {res.layers.length > 0 && !res.errors.length && (
                <p className="text-white/65">{res.layers.length} calque{res.layers.length > 1 ? 's' : ''} d'annotation : {res.layers.map((l) => `« ${l.name} »`).join(', ')}</p>
              )}
            </div>
          )}
          {err && <p className="text-sm text-red-300">{err}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {res?.session && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={res.name ?? 'Nom de la version'}
                className="min-w-48 flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm outline-none focus:border-emerald-400/60"
              />
            )}
            <div className="ml-auto flex gap-2 text-sm">
              {res?.session ? (
                <>
                  <button disabled={!ok || busy} onClick={() => go(false)} className="rounded-md border border-white/15 px-3 py-1.5 hover:bg-white/10 disabled:opacity-40">
                    Créer la version
                  </button>
                  <button disabled={!ok || busy} onClick={() => go(true)} className="rounded-md bg-emerald-500/90 px-3 py-1.5 font-semibold text-[#0d1512] hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/40">
                    Créer la version et l'appliquer
                  </button>
                </>
              ) : (
                <button disabled={!ok || busy} onClick={() => go(false)} className="rounded-md bg-emerald-500/90 px-3 py-1.5 font-semibold text-[#0d1512] hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/40">
                  Ajouter les calques
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
