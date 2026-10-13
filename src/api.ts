// Client de l'API du serveur (server/api.ts).

import type { Session } from './model'

export interface VersionMeta {
  id: number
  name: string
  createdAt: string
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json() as Promise<T>
}
const send = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export async function fetchSession(id: string): Promise<{ session: Session; updatedAt: string } | null> {
  const r = await fetch(`/api/sessions/${id}`)
  if (r.status === 404) return null
  return json(r)
}

export const saveSession = (s: Session, summary: string) =>
  fetch(`/api/sessions/${s.id}`, send('PUT', { session: s, summary })).then((r) => json<{ updatedAt: string }>(r))

export const listVersions = (id: string) => fetch(`/api/sessions/${id}/versions`).then((r) => json<VersionMeta[]>(r))

export const createVersion = (s: Session, name: string, summary: string) =>
  fetch(`/api/sessions/${s.id}/versions`, send('POST', { name, session: s, summary })).then((r) => json<VersionMeta>(r))

export const fetchVersion = (id: string, vid: number) =>
  fetch(`/api/sessions/${id}/versions/${vid}`).then((r) => json<VersionMeta & { session: Session }>(r))

export const deleteVersion = (id: string, vid: number) => fetch(`/api/sessions/${id}/versions/${vid}`, { method: 'DELETE' }).then((r) => json(r))

// Sessions ouvertes dans ce navigateur (simple confort : la vraie liste, c'est le lien).
const RECENT = 'breadboard-recent'
export interface Recent {
  id: string
  name: string
  at: string
}
export function recentSessions(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]') as Recent[]
  } catch {
    return []
  }
}
export function rememberSession(id: string, name: string) {
  try {
    const list = [{ id, name, at: new Date().toISOString() }, ...recentSessions().filter((r) => r.id !== id)].slice(0, 30)
    localStorage.setItem(RECENT, JSON.stringify(list))
  } catch {
    /* stockage bloqué : pas grave */
  }
}
export function forgetSession(id: string) {
  try {
    localStorage.setItem(RECENT, JSON.stringify(recentSessions().filter((r) => r.id !== id)))
  } catch {
    /* idem */
  }
}
