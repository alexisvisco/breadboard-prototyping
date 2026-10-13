// Fenêtres de dialogue dans la page : prompt() / confirm() / alert() ne marchent pas partout
// (le navigateur intégré de l'app Claude les refuse).

import { useEffect, useRef, useState } from 'react'

interface Req {
  kind: 'prompt' | 'confirm' | 'alert'
  title: string
  message?: string
  value?: string
  ok?: string
  danger?: boolean
  resolve: (v: string | boolean | null) => void
}

let push: ((r: Req) => void) | null = null
const open = (r: Omit<Req, 'resolve'>) =>
  new Promise<string | boolean | null>((resolve) => (push ? push({ ...r, resolve }) : resolve(null)))

/** Demande un texte ; null si annulé. */
export const ask = (title: string, value = '', message?: string) => open({ kind: 'prompt', title, value, message }) as Promise<string | null>
/** Demande une confirmation. */
export const confirmAsk = async (title: string, message?: string, opts: { ok?: string; danger?: boolean } = {}) =>
  (await open({ kind: 'confirm', title, message, ...opts })) === true
/** Simple message. */
export const tell = async (title: string, message?: string) => void (await open({ kind: 'alert', title, message }))

export function DialogHost() {
  const [req, setReq] = useState<Req | null>(null)
  const [value, setValue] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    push = (r) => {
      setValue(r.value ?? '')
      setReq(r)
    }
    return () => {
      push = null
    }
  }, [])
  useEffect(() => {
    if (req?.kind === 'prompt') setTimeout(() => input.current?.select(), 0)
  }, [req])

  if (!req) return null
  const close = (v: string | boolean | null) => {
    req.resolve(v)
    setReq(null)
  }
  const ok = () => close(req.kind === 'prompt' ? value.trim() || null : true)

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 pt-[18vh]" onPointerDown={() => close(req.kind === 'confirm' ? false : null)}>
      <form
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          ok()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            close(req.kind === 'confirm' ? false : null)
          }
        }}
        className="w-[min(440px,92vw)] rounded-xl border border-white/15 bg-[#18211d] p-5 text-[#e6ece8] shadow-2xl"
      >
        <h2 className="text-base font-semibold">{req.title}</h2>
        {req.message && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/65">{req.message}</p>}
        {req.kind === 'prompt' && (
          <input
            ref={input}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-4 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-emerald-400/60"
          />
        )}
        <div className="mt-5 flex justify-end gap-2 text-sm">
          {req.kind !== 'alert' && (
            <button type="button" onClick={() => close(req.kind === 'confirm' ? false : null)} className="rounded-md px-3 py-1.5 hover:bg-white/10">
              Annuler
            </button>
          )}
          <button
            autoFocus={req.kind !== 'prompt'}
            className={`rounded-md px-4 py-1.5 font-semibold ${req.danger ? 'bg-red-500/90 text-white hover:bg-red-500' : 'bg-emerald-500/90 text-[#0d1512] hover:bg-emerald-400'}`}
          >
            {req.ok ?? 'OK'}
          </button>
        </div>
      </form>
    </div>
  )
}
