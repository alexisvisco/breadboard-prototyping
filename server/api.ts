// API HTTP des sessions. Une session = un identifiant aléatoire dans l'URL, sans compte :
// qui a le lien peut lire et modifier. Utilisée par le serveur de prod et par Vite en dev.

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Store } from './store.ts'

const ID = '([A-Za-z0-9_-]{8,64})'
const routes = {
  session: new RegExp(`^/api/sessions/${ID}$`),
  summary: new RegExp(`^/api/sessions/${ID}/summary$`),
  versions: new RegExp(`^/api/sessions/${ID}/versions$`),
  version: new RegExp(`^/api/sessions/${ID}/versions/(\\d+)$`),
  versionSummary: new RegExp(`^/api/sessions/${ID}/versions/(\\d+)/summary$`),
  layers: new RegExp(`^/api/sessions/${ID}/layers$`),
  layer: new RegExp(`^/api/sessions/${ID}/layers/([A-Za-z0-9_.-]{1,64})$`),
}
const MAX_BODY = 4 * 1024 * 1024

function send(res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') {
  res.statusCode = code
  res.setHeader('content-type', type)
  res.setHeader('cache-control', 'no-store')
  res.end(typeof body === 'string' && !type.startsWith('application/json') ? body : JSON.stringify(body))
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((ok, fail) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        fail(new Error('requête trop grosse'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        ok(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (e) {
        fail(e)
      }
    })
    req.on('error', fail)
  })
}

export function createApi(storePromise: Promise<Store>) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = (req.url ?? '/').split('?')[0]
    if (!url.startsWith('/api/')) return next()
    const store = await storePromise
    const m = req.method ?? 'GET'
    let r: RegExpExecArray | null
    try {
      if ((r = routes.session.exec(url))) {
        if (m === 'GET') {
          const s = await store.getSession(r[1])
          return s ? send(res, 200, { session: JSON.parse(s.data), updatedAt: s.updatedAt }) : send(res, 404, { error: 'session introuvable' })
        }
        if (m === 'PUT') {
          const { session, summary } = await readJson(req)
          const s = session as { id?: string; name?: string }
          if (!s || s.id !== r[1]) return send(res, 400, { error: 'identifiant incohérent' })
          const updatedAt = await store.putSession(r[1], String(s.name ?? 'Sans nom'), JSON.stringify(session), String(summary ?? ''))
          return send(res, 200, { updatedAt })
        }
      }
      if ((r = routes.summary.exec(url)) && m === 'GET') {
        const t = await store.getSummary(r[1])
        return t === null ? send(res, 404, 'session introuvable\n', 'text/plain; charset=utf-8') : send(res, 200, t, 'text/plain; charset=utf-8')
      }
      if ((r = routes.versions.exec(url))) {
        if (m === 'GET') return send(res, 200, await store.listVersions(r[1]))
        if (m === 'POST') {
          const { name, session, summary } = await readJson(req)
          if (!(await store.getSession(r[1]))) return send(res, 404, { error: 'session introuvable' })
          const v = await store.addVersion(r[1], String(name || 'Sans nom'), JSON.stringify(session), String(summary ?? ''))
          return send(res, 201, v)
        }
      }
      if ((r = routes.version.exec(url))) {
        if (m === 'GET') {
          const v = await store.getVersion(r[1], Number(r[2]))
          return v ? send(res, 200, { id: v.id, name: v.name, createdAt: v.createdAt, session: JSON.parse(v.data) }) : send(res, 404, { error: 'version introuvable' })
        }
        if (m === 'DELETE') {
          await store.deleteVersion(r[1], Number(r[2]))
          return send(res, 200, { ok: true })
        }
      }
      if ((r = routes.versionSummary.exec(url)) && m === 'GET') {
        const v = await store.getVersion(r[1], Number(r[2]))
        return v ? send(res, 200, v.summary, 'text/plain; charset=utf-8') : send(res, 404, 'version introuvable\n', 'text/plain; charset=utf-8')
      }
      // Calques d'annotation : écrits à part de la session (par Claude ou par l'app).
      if ((r = routes.layers.exec(url)) && m === 'GET') return send(res, 200, (await store.listLayers(r[1])).map((d) => JSON.parse(d)))
      if ((r = routes.layer.exec(url))) {
        if (m === 'PUT') {
          const layer = await readJson(req)
          if (!Array.isArray(layer.items)) return send(res, 400, { error: '`items` doit être une liste' })
          const data = { visible: true, author: 'claude', ...layer, id: r[2], updatedAt: new Date().toISOString() }
          await store.putLayer(r[1], r[2], JSON.stringify(data))
          return send(res, 200, data)
        }
        if (m === 'DELETE') {
          await store.deleteLayer(r[1], r[2])
          return send(res, 200, { ok: true })
        }
      }
      send(res, 404, { error: 'route inconnue' })
    } catch (e) {
      send(res, 400, { error: e instanceof Error ? e.message : String(e) })
    }
  }
}
