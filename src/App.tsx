import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircuitBoard, CornerDownRight, Maximize, Minus, MoreHorizontal, PanelRightClose, PanelRightOpen, Plus, RotateCw, Spline, X, XCircle, Check } from 'lucide-react'
import { fetchSession, forgetSession, recentSessions, rememberSession, saveSession } from './api'
import { agentBrief } from './agent'
import { Box } from './Box'
import { DialogHost, ask, confirmAsk, tell } from './dialog'
import { Canvas, addAnchor, nodeCenter, portWorld, type CanvasApi } from './Canvas'
import { ContextMenu, rotateNode, unplacePart } from './ContextMenu'
import { registerExtras } from './boards'
import {
  addExtra, blockInfo, addBlock, diffMarks, addToBox, analyse, normalize, newSession, partName, placeText, removeBlock, summary, type BlockId, type NodeId,
  type Part, type Session,
} from './model'
import { deleteLayer, fetchLayers, focusOf, putLayer, resolvePort, type Layer } from './layers'
import { LayersPanel } from './LayersPanel'
import { Search, type SearchHit } from './Search'
import { DiffTab } from './DiffTab'
import { ImportDialog } from './ImportDialog'
import { Shop } from './Shop'
import { Versions } from './Versions'

// ------------------------------------------------------------------ routage minimal : / et /s/<id>

function useRoute() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  const go = useCallback((p: string) => {
    history.pushState(null, '', p)
    setPath(p)
  }, [])
  return [path, go] as const
}

export default function App() {
  const [path, go] = useRoute()
  const m = /^\/s\/([A-Za-z0-9_-]{8,64})/.exec(path)
  return (
    <>
      {m ? <SessionPage key={m[1]} id={m[1]} go={go} /> : <Home go={go} />}
      <DialogHost />
    </>
  )
}

async function createSession(name: string, go: (p: string) => void) {
  const s = newSession(name)
  await saveSession(s, summary(s, analyse(s)))
  rememberSession(s.id, s.name)
  go(`/s/${s.id}`)
}

// ------------------------------------------------------------------ accueil

function Home({ go }: { go: (p: string) => void }) {
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [recent, setRecent] = useState(recentSessions)
  const [err, setErr] = useState<string | null>(null)

  const open = () => {
    const m = /([A-Za-z0-9_-]{8,64})\/?$/.exec(link.trim())
    if (m) go(`/s/${m[1]}`)
  }

  return (
    <div className="min-h-full bg-[#101614] px-4 py-14 text-[#e6ece8]">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300"><CircuitBoard className="size-6" /></div>
          <h1 className="text-2xl font-semibold">Breadboard</h1>
        </div>
        <p className="mt-3 leading-relaxed text-white/60">
          Recopie ton montage : prends tes pièces au magasin, pose-les sur la breadboard, et l'app vérifie ce qui est relié. Pas de compte : une session, c'est un lien.
        </p>

        <form
          className="mt-8 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            createSession(name.trim() || 'Mon montage', go).catch(() => setErr('Serveur injoignable.'))
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du montage (ex. Codec logiciel)"
            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 outline-none placeholder:text-white/35 focus:border-emerald-400/60"
          />
          <button className="rounded-lg bg-emerald-500/90 px-4 py-2.5 font-semibold text-[#0d1512] hover:bg-emerald-400">Nouvelle session</button>
        </form>
        {err && <p className="mt-2 text-sm text-red-300">{err}</p>}

        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); open() }}>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="…ou colle le lien d'une session"
            className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-emerald-400/60"
          />
          <button className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">Ouvrir</button>
        </form>

        {recent.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Ouvertes dans ce navigateur</h2>
            <ul className="mt-2 grid gap-1.5">
              {recent.map((r) => (
                <li key={r.id} className="group flex items-center gap-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08]">
                  <a
                    href={`/s/${r.id}`}
                    onClick={(e) => { e.preventDefault(); go(`/s/${r.id}`) }}
                    className="flex min-w-0 flex-1 items-center justify-between px-3 py-2.5"
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-white/40">{new Date(r.at).toLocaleDateString('fr-FR')}</span>
                  </a>
                  <button
                    title="Oublier (la session reste sur le serveur)"
                    onClick={() => { forgetSession(r.id); setRecent(recentSessions()) }}
                    className="invisible px-3 text-white/40 hover:text-red-300 group-hover:visible"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ session

type Save = 'saved' | 'pending' | 'error'

function SessionPage({ id, go }: { id: string; go: (p: string) => void }) {
  const [session, setSession] = useState<Session | null>(null)
  const [missing, setMissing] = useState(false)
  const [save, setSave] = useState<Save>('saved')
  const dirty = useRef(false)
  const lastSaved = useRef('')

  useEffect(() => {
    fetchSession(id)
      .then((r) => {
        if (!r) return setMissing(true)
        const s = normalize(r.session)
        // On compare à ce que le serveur a vraiment : si normalize a converti quelque chose, ça s'enregistre.
        lastSaved.current = JSON.stringify(r.session)
        setSession(s)
        rememberSession(s.id, s.name)
      })
      .catch(() => setSave('error'))
  }, [id])

  // Enregistrement automatique (0,5 s après la dernière modification).
  useEffect(() => {
    if (!session) return
    const raw = JSON.stringify(session)
    if (raw === lastSaved.current) return
    dirty.current = true
    setSave('pending')
    const t = setTimeout(() => {
      saveSession(session, summary(session, analyse(session)))
        .then(() => {
          lastSaved.current = raw
          dirty.current = false
          setSave('saved')
          rememberSession(session.id, session.name)
        })
        .catch(() => setSave('error'))
    }, 500)
    return () => clearTimeout(t)
  }, [session])

  // Retour sur l'onglet : on reprend ce qui a pu être modifié ailleurs (autre navigateur).
  useEffect(() => {
    const onFocus = () => {
      if (dirty.current) return
      fetchSession(id).then((r) => {
        if (!r || dirty.current) return
        const raw = JSON.stringify(normalize(r.session))
        if (raw !== lastSaved.current) {
          lastSaved.current = raw
          setSession(JSON.parse(raw))
        }
      }).catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [id])

  if (missing)
    return (
      <div className="grid h-full place-items-center bg-[#101614] text-[#e6ece8]">
        <div className="text-center">
          <p className="text-lg">Cette session n'existe pas (ou plus).</p>
          <button onClick={() => go('/')} className="mt-4 rounded-lg bg-emerald-500/90 px-4 py-2 font-semibold text-[#0d1512]">Retour à l'accueil</button>
        </div>
      </div>
    )
  if (!session)
    return <div className="grid h-full place-items-center bg-[#101614] text-white/50">{save === 'error' ? 'Serveur injoignable.' : 'Chargement…'}</div>

  return <Editor session={session} setSession={setSession} save={save} go={go} />
}

function Editor({ session, setSession, save, go }: { session: Session; setSession: React.Dispatch<React.SetStateAction<Session | null>>; save: Save; go: (p: string) => void }) {
  // Les planches ajoutées doivent être connues avant que quoi que ce soit les dessine ou les analyse.
  registerExtras(session.extras)
  const [selected, setSelected] = useState<string | null>(null)
  const [hoverText, setHoverText] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string[]>([])
  const [menu, setMenu] = useState<{ target: string; x: number; y: number } | null>(null)
  const [tab, setTab] = useState<'analyse' | 'diff' | 'versions'>('analyse')
  const [diffBase, setDiffBase] = useState<Session | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const canvas = useRef<CanvasApi>(null)
  const [layers, setLayers] = useState<Layer[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [versionsKey, setVersionsKey] = useState(0)
  const [rightOpen, setRightOpen] = useState(() => {
    try {
      return localStorage.getItem('bb-right') !== '0'
    } catch {
      return true
    }
  })
  const toggleRight = () =>
    setRightOpen((o) => {
      try {
        localStorage.setItem('bb-right', o ? '0' : '1')
      } catch {
        // pas grave : le choix ne sera pas retenu
      }
      return !o
    })

  // Calques d'annotation : relus toutes les 3 s (Claude peut en ajouter pendant qu'on regarde).
  useEffect(() => {
    let alive = true
    const load = () => fetchLayers(session.id).then((l) => alive && setLayers(l)).catch(() => {})
    load()
    const t = setInterval(load, 3000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [session.id])
  // Calque en focus : le reste est grisé, la vue cadre la mesure.
  const [focusId, setFocusId] = useState<string | null>(null)
  const focusLayer = layers.find((l) => l.id === focusId && l.visible) ?? null
  const focus = useMemo(() => (focusLayer ? focusOf(session, focusLayer) : null), [focusLayer, session])
  const focusLayerId = focusLayer?.id
  useEffect(() => {
    if (!focusLayerId || !focus) return
    const pts = [
      ...focus.ports.map((p) => portWorld(session, p)),
      ...session.parts.filter((p) => focus.parts.has(p.id)).flatMap((p) => [p.a, p.b].map((e) => (e ? portWorld(session, e) : null))),
    ].filter((p): p is { x: number; y: number } => !!p)
    canvas.current?.fitPoints(pts)
    // On ne recadre qu'au changement de calque, pas à chaque modification du montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLayerId])
  const focusOn = (l: Layer | null) => {
    if (l && !l.visible) toggleLayer(l)
    setFocusId(l?.id ?? null)
  }
  const locatePort = (ref: string) => {
    const port = resolvePort(ref)
    const pos = port ? portWorld(session, port) : null
    if (!pos || !port) return
    canvas.current?.centerOn(pos)
    pulse(port)
  }
  const toggleLayer = (l: Layer) => {
    const next = { ...l, visible: !l.visible }
    // Cocher un calque le met en focus ; le décocher sort du focus.
    setFocusId(next.visible ? l.id : (f) => (f === l.id ? null : f))
    setLayers((ls) => ls.map((x) => (x.id === l.id ? next : x)))
    putLayer(session.id, next).catch(() => {})
  }
  const removeLayer = (l: Layer) => {
    setLayers((ls) => ls.filter((x) => x.id !== l.id))
    deleteLayer(session.id, l.id).catch(() => {})
  }

  const analysis = useMemo(() => analyse(session), [session])
  const dm = useMemo(() => (tab === 'diff' && diffBase ? diffMarks(diffBase, session) : null), [tab, diffBase, session])
  const update = useCallback((fn: (s: Session) => Session) => setSession((s) => (s ? fn(s) : s)), [setSession])
  const closeMenu = useCallback(() => setMenu(null), [])

  const unplace = useCallback(
    (target: string) => {
      if (target.startsWith('node:')) return
      update((s) => ({ ...s, parts: s.parts.map((p) => (p.id === target ? unplacePart(p) : p)) }))
      setSelected(null)
    },
    [update],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (e.key === 'Escape' && shopOpen) setShopOpen(false)
      if (typing || shopOpen || searchOpen || importOpen) return
      if (selected && (e.key === 'Delete' || e.key === 'Backspace')) unplace(selected)
      if (selected?.startsWith('node:') && e.key.toLowerCase() === 'r') update((s) => rotateNode(s, selected.slice(5) as NodeId, e.shiftKey ? -90 : 90))
      if (e.key === 'Escape') setSelected(null)
      if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, unplace, update, shopOpen, searchOpen, importOpen])

  function pulse(id: string) {
    setFlash(id)
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600)
  }

  function locate(target: string) {
    setSelected(target)
    if (target.startsWith('node:')) {
      const c = nodeCenter(session, target.slice(5) as NodeId)
      if (c) canvas.current?.centerOn(c)
      return
    }
    const p = session.parts.find((q) => q.id === target)
    const port = p?.kind === 'L' ? (p.b ?? p.a) : p?.a
    const pos = port ? portWorld(session, port) : null
    if (pos) canvas.current?.centerOn(pos)
    pulse(target)
  }

  function onPick(h: SearchHit) {
    if (h.partId) setSelected(h.partId)
    const target = h.port ?? (h.partId ? session.parts.find((p) => p.id === h.partId)?.a : undefined)
    const pos = target ? portWorld(session, target) : null
    if (pos) canvas.current?.centerOn(pos)
    pulse(h.partId ?? h.port ?? '')
  }

  const copy = async (what: string, text: string) => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // Repli : vieille méthode, qui marche aussi dans les navigateurs intégrés.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      ta.remove()
    }
    if (!ok) return tell('Copie impossible', 'Le navigateur bloque le presse-papiers.')
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }

  const rename = async () => {
    const name = await ask('Nom du montage', session.name)
    if (name) update((s) => ({ ...s, name: name.trim() }))
  }

  const removePart = async (p: Part) => {
    if (p.a && !(await confirmAsk(`Supprimer ${partName(p)} de la boîte ?`, 'Elle est posée sur le canevas.', { ok: 'Supprimer', danger: true }))) return
    update((s) => ({ ...s, parts: s.parts.filter((q) => q.id !== p.id) }))
  }
  const removeBlk = async (b: BlockId) => {
    if (!(await confirmAsk(`Supprimer « ${blockInfo(session, b).title} » de la boîte ?`, undefined, { ok: 'Supprimer', danger: true }))) return
    update((s) => removeBlock(s, b))
  }

  const sel = selected && !selected.startsWith('node:') ? (session.parts.find((p) => p.id === selected) ?? null) : null
  const selNode = selected?.startsWith('node:') ? (selected.slice(5) as NodeId) : null
  const counts = { ko: analysis.checks.filter((c) => c.state === 'ko').length, warn: analysis.checks.filter((c) => c.state === 'warn').length }
  const order = { ko: 0, warn: 1, ok: 2 }
  const summaryUrl = `${location.origin}/api/sessions/${session.id}/summary`

  return (
    <div className="flex h-full flex-col bg-[#101614] font-sans text-[#e6ece8]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-[#141c19] px-3">
        <button onClick={() => go('/')} className="flex items-center gap-2 pr-1" title="Accueil">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/20 text-emerald-300"><CircuitBoard className="size-4" /></div>
        </button>
        <button onClick={rename} title="Renommer" className="max-w-[260px] truncate rounded-md px-2 py-1 text-sm font-semibold hover:bg-white/10">
          {session.name}
        </button>
        <button
          onClick={() => setSearchOpen(true)}
          className="ml-2 flex w-[min(340px,28vw)] items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/45 hover:bg-white/10"
        >
          <span className="truncate">Rechercher un trou, une broche, une pièce…</span>
          <kbd className="rounded border border-white/15 px-1.5 text-[11px]">⌘K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className={`text-xs ${save === 'error' ? 'text-red-300' : 'text-white/45'}`}>
            {save === 'saved' ? 'Enregistré' : save === 'pending' ? 'Enregistrement…' : 'Non enregistré : serveur injoignable'}
          </span>
          <button onClick={() => copy('link', location.href)} className="rounded-md border border-white/10 px-3 py-1.5 hover:bg-white/10">
            {copied === 'link' ? <span className="inline-flex items-center gap-1"><Check className="size-4" /> Copié</span> : 'Copier le lien'}
          </button>
          <button
            onClick={() => copy('claude', agentBrief(session, location.origin))}
            title={`Mode d'emploi + JSON du montage, à coller dans une conversation avec Claude. Résumé texte : ${summaryUrl}`}
            className="rounded-md border border-white/10 px-3 py-1.5 hover:bg-white/10"
          >
            {copied === 'claude' ? <span className="inline-flex items-center gap-1"><Check className="size-4" /> Copié</span> : 'Copier pour Claude'}
          </button>
          <button onClick={() => setImportOpen(true)} className="rounded-md bg-emerald-500/90 px-3 py-1.5 font-semibold text-[#0d1512] hover:bg-emerald-400">
            Importer un JSON
          </button>
          <button onClick={toggleRight} title={rightOpen ? 'Masquer le panneau de droite' : 'Afficher le panneau de droite'} className={`inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 hover:bg-white/10 ${rightOpen ? '' : 'text-emerald-300'}`}>
            {rightOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />} Panneau
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-hidden border-r border-white/10 bg-[#141c19]">
          <Box session={session} selected={selected} onShop={() => setShopOpen(true)} onLocate={locate} onRemovePart={removePart} onRemoveBlock={removeBlk} onContext={(target, x, y) => { setSelected(target); setMenu({ target, x, y }) }} />
        </aside>

        <main className="relative min-w-0 flex-1">
          <Canvas
            session={session}
            onChange={update}
            selected={selected}
            setSelected={setSelected}
            highlight={highlight}
            flash={flash}
            apiRef={canvas}
            onHover={setHoverText}
            onContext={(target, x, y) => setMenu({ target, x, y })}
            layers={layers}
            marks={dm?.marks}
            ghosts={dm?.ghosts}
            focus={focus}
          />
          <LayersPanel layers={layers} focusId={focusLayer?.id ?? null} onToggle={toggleLayer} onDelete={removeLayer} onFocus={focusOn} onLocate={locatePort} />
          {focusLayer && (
            <div className="absolute left-4 top-4 flex items-center gap-3 rounded-lg border border-yellow-300/50 bg-[#18211d]/95 px-3 py-2 text-sm shadow-lg">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              <span>Focus : <b>{focusLayer.name}</b></span>
              <button onClick={() => setFocusId(null)} className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20">Tout afficher</button>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex overflow-hidden rounded-lg border border-white/10 bg-[#18211d]/95 text-sm shadow-lg">
            <button className="px-3 py-1.5 hover:bg-white/10" onClick={() => canvas.current?.zoom(1 / 1.25)} title="Dézoomer"><Minus className="size-4" /></button>
            <button className="inline-flex items-center gap-1.5 border-x border-white/10 px-3 py-1.5 hover:bg-white/10" onClick={() => canvas.current?.fit()}><Maximize className="size-4" /> Tout voir</button>
            <button className="px-3 py-1.5 hover:bg-white/10" onClick={() => canvas.current?.zoom(1.25)} title="Zoomer"><Plus className="size-4" /></button>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-1/2 max-w-[60%] -translate-x-1/2 truncate rounded-full bg-black/60 px-4 py-1.5 font-mono text-xs text-white/80">
            {hoverText ?? 'Glisser le fond ou clic molette : se déplacer · molette : zoomer · clic droit : options'}
          </div>

          {(sel || selNode) && (
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-yellow-300/40 bg-[#18211d]/95 px-4 py-2 text-sm shadow-lg">
              <span className="font-semibold">{sel ? partName(sel) : blockInfo(session, selNode!).title}</span>
              {sel && <span className="text-white/65">{placeText(sel)}</span>}
              {selNode && (
                <button className="inline-flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 hover:bg-white/20" onClick={() => update((s) => rotateNode(s, selNode, 90))}>
                  <RotateCw className="size-4" /> Pivoter <kbd className="text-white/40">R</kbd>
                </button>
              )}
              {sel?.kind === 'W' && sel.b && (
                <>
                  <button title="Ancrage courbe : le fil passe par ce point en douceur" className="inline-flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 hover:bg-white/20" onClick={() => update((s) => addAnchor(s, sel.id, 'curve'))}>
                    <Spline className="size-4" /> Ancrage courbe
                  </button>
                  <button title="Ancrage d’angle : le fil fait un angle vif, pour les angles droits" className="inline-flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 hover:bg-white/20" onClick={() => update((s) => addAnchor(s, sel.id, 'corner'))}>
                    <CornerDownRight className="size-4" /> Ancrage d’angle
                  </button>
                </>
              )}
              <button
                className="inline-flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 hover:bg-white/20"
                onClick={(e) => {
                  const r = (e.target as HTMLElement).getBoundingClientRect()
                  e.stopPropagation()
                  setMenu({ target: selected!, x: r.left, y: r.bottom + 6 })
                }}
              >
                <MoreHorizontal className="size-4" /> Options
              </button>
            </div>
          )}
        </main>

        <aside className={`${rightOpen ? 'flex' : 'hidden'} w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#141c19]`}>
          <div className="flex border-b border-white/10 text-sm">
            {(['analyse', 'diff', 'versions'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 px-4 py-2.5 ${tab === t ? 'border-b-2 border-emerald-400 text-white' : 'text-white/50 hover:text-white/80'}`}>
                {t === 'analyse' ? 'Analyse' : t === 'diff' ? 'Diff' : 'Versions'}
                {t === 'diff' && dm && Object.keys(dm.marks).length + dm.ghosts.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-orange-400/80 px-1.5 text-xs text-[#0d1512]">{new Set([...Object.keys(dm.marks), ...dm.ghosts.map((g) => g.part.id)]).size}</span>
                )}
                {t === 'analyse' && counts.ko > 0 && <span className="ml-1.5 rounded-full bg-red-500/80 px-1.5 text-xs text-white">{counts.ko}</span>}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'analyse' ? (
              <>
                <ul className="grid gap-1.5 text-sm">
                  {[...analysis.checks].sort((x, y) => order[x.state] - order[y.state]).map((c, i) => (
                    <li
                      key={i}
                      onPointerEnter={() => setHighlight(c.parts ?? [])}
                      onPointerLeave={() => setHighlight([])}
                      className={`flex gap-2 rounded-md px-3 py-2 ${c.state === 'ok' ? 'bg-emerald-500/10' : c.state === 'ko' ? 'bg-red-500/15' : 'bg-yellow-400/10'}`}
                    >
                      <span className={`shrink-0 font-bold ${c.state === 'ok' ? 'text-emerald-300' : c.state === 'ko' ? 'text-red-300' : 'text-yellow-200'}`}>
                        {c.state === 'ok' ? <CheckCircle2 className="size-4" /> : c.state === 'ko' ? <XCircle className="size-4" /> : <AlertTriangle className="size-4" />}
                      </span>
                      <span className="leading-snug">{c.text}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-white/45">Ce qui est relié ensemble</h3>
                {!analysis.groups.length && <p className="mt-2 text-sm text-white/45">Rien pour l'instant : pose des pièces et des fils.</p>}
                <ul className="mt-2 grid gap-1.5 text-sm">
                  {analysis.groups.map((g, i) => (
                    <li
                      key={i}
                      onPointerEnter={() => setHighlight(g.parts)}
                      onPointerLeave={() => setHighlight([])}
                      className="rounded-md bg-white/[0.04] px-3 py-2 hover:bg-white/[0.08]"
                    >
                      <div className="leading-snug">{g.names.join(' · ')}</div>
                      {g.places.length > 0 && <div className="mt-0.5 text-xs text-white/40">{g.places.join(', ')}</div>}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-white/40">Survole une ligne pour voir les pièces concernées sur le canevas.</p>
              </>
            ) : tab === 'diff' ? (
              <DiffTab key={versionsKey} session={session} onBase={setDiffBase} onHighlight={setHighlight} />
            ) : (
              <Versions key={versionsKey} session={session} onRestore={(s) => update(() => s)} onHighlight={setHighlight} />
            )}
          </div>
        </aside>
      </div>

      {menu && <ContextMenu session={session} target={menu.target} x={menu.x} y={menu.y} update={update} onClose={closeMenu} onShop={() => setShopOpen(true)} />}
      <Shop
        open={shopOpen}
        owned={session.blocks}
        onClose={() => setShopOpen(false)}
        onAdd={(it, qty, value, color) => update((s) => addToBox(s, it.kind, qty, value, color))}
        onAddBlock={(b) => update((s) => addBlock(s, b))}
        onAddExtra={(spec) => update((s) => addExtra(s, spec))}
      />
      {importOpen && (
        <ImportDialog
          session={session}
          onClose={() => setImportOpen(false)}
          onApply={(s) => update(() => s)}
          onDone={() => {
            setVersionsKey((k) => k + 1)
            fetchLayers(session.id).then(setLayers).catch(() => {})
          }}
        />
      )}
      <Search session={session} open={searchOpen} onClose={() => setSearchOpen(false)} onPick={onPick} />
    </div>
  )
}
