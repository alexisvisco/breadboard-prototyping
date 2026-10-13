// Serveur de production : l'API + les fichiers de `dist` (npm run build).
// node server/index.ts   — variables : PORT, HOST, BREADBOARD_DB (fichier SQLite) ou DATABASE_URL (Postgres).

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createApi } from './api.ts'
import { openStore } from './store.ts'

const DIST = path.resolve(import.meta.dirname, '../dist')
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

const store = openStore()
store.then(
  () => console.log(process.env.DATABASE_URL?.startsWith('postgres') ? 'Base : Postgres' : `Base : SQLite (${process.env.BREADBOARD_DB ?? 'breadboard.db'})`),
  (e) => {
    console.error('Impossible d\'ouvrir la base :', e)
    process.exit(1)
  },
)
const api = createApi(store)

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = path.join(DIST, path.normalize(url).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream')
  if (url.startsWith('/assets/')) res.setHeader('cache-control', 'public, max-age=31536000, immutable')
  fs.createReadStream(file).pipe(res)
}

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'
http
  .createServer((req, res) => {
    api(req, res, () => serveStatic(req, res)).catch((e) => {
      res.statusCode = 500
      res.end(String(e))
    })
  })
  .listen(port, host, () => console.log(`Breadboard sur http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`))
