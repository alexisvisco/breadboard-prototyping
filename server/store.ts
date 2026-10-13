// Stockage des sessions et de leurs versions : SQLite par défaut, Postgres si DATABASE_URL est défini.
// Les deux partagent les mêmes requêtes (paramètres « ? », convertis en $1, $2… pour Postgres).

import { DatabaseSync } from 'node:sqlite'

export interface VersionMeta {
  id: number
  name: string
  createdAt: string
}

export interface Store {
  getSession(id: string): Promise<{ data: string; updatedAt: string } | null>
  getSummary(id: string): Promise<string | null>
  putSession(id: string, name: string, data: string, summary: string): Promise<string>
  listVersions(id: string): Promise<VersionMeta[]>
  addVersion(id: string, name: string, data: string, summary: string): Promise<VersionMeta>
  getVersion(id: string, vid: number): Promise<(VersionMeta & { data: string; summary: string }) | null>
  deleteVersion(id: string, vid: number): Promise<void>
  listLayers(id: string): Promise<string[]>
  putLayer(id: string, lid: string, data: string): Promise<void>
  deleteLayer(id: string, lid: string): Promise<void>
}

interface Db {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
}

function sqlite(file: string): Db {
  const db = new DatabaseSync(file)
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, summary TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, name TEXT NOT NULL,
      data TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS versions_session ON versions (session_id);
    CREATE TABLE IF NOT EXISTS layers (
      session_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, id));`)
  return {
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[]
    },
  }
}

async function postgres(url: string): Promise<Db> {
  // Dépendance facultative : `npm install pg` seulement si on veut Postgres.
  const mod = 'pg'
  const pg = (await import(mod)) as { default: { Pool: new (o: object) => { query(sql: string, p: unknown[]): Promise<{ rows: unknown[] }> } } }
  const pool = new pg.default.Pool({ connectionString: url })
  await pool.query(
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, summary TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS versions (
      id SERIAL PRIMARY KEY, session_id TEXT NOT NULL, name TEXT NOT NULL,
      data TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS versions_session ON versions (session_id);
    CREATE TABLE IF NOT EXISTS layers (
      session_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, id));`,
    [],
  )
  return {
    async all<T>(sql: string, params: unknown[] = []) {
      let n = 0
      return (await pool.query(sql.replace(/\?/g, () => `$${++n}`), params)).rows as T[]
    },
  }
}

export async function openStore(): Promise<Store> {
  const url = process.env.DATABASE_URL
  const db = url?.startsWith('postgres') ? await postgres(url) : sqlite(process.env.BREADBOARD_DB ?? 'breadboard.db')
  const now = () => new Date().toISOString()
  const meta = 'id, name, created_at AS "createdAt"'

  return {
    async getSession(id) {
      const [r] = await db.all<{ data: string; updatedAt: string }>('SELECT data, updated_at AS "updatedAt" FROM sessions WHERE id = ?', [id])
      return r ?? null
    },
    async getSummary(id) {
      const [r] = await db.all<{ summary: string }>('SELECT summary FROM sessions WHERE id = ?', [id])
      return r?.summary ?? null
    },
    async putSession(id, name, data, summary) {
      const t = now()
      await db.all(
        `INSERT INTO sessions (id, name, data, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, data = excluded.data, summary = excluded.summary, updated_at = excluded.updated_at`,
        [id, name, data, summary, t, t],
      )
      return t
    },
    async listVersions(id) {
      return db.all<VersionMeta>(`SELECT ${meta} FROM versions WHERE session_id = ? ORDER BY id DESC`, [id])
    },
    async addVersion(id, name, data, summary) {
      const [r] = await db.all<VersionMeta>(
        `INSERT INTO versions (session_id, name, data, summary, created_at) VALUES (?, ?, ?, ?, ?) RETURNING ${meta}`,
        [id, name, data, summary, now()],
      )
      return r
    },
    async getVersion(id, vid) {
      const [r] = await db.all<VersionMeta & { data: string; summary: string }>(
        `SELECT ${meta}, data, summary FROM versions WHERE session_id = ? AND id = ?`,
        [id, vid],
      )
      return r ?? null
    },
    async deleteVersion(id, vid) {
      await db.all('DELETE FROM versions WHERE session_id = ? AND id = ?', [id, vid])
    },
    async listLayers(id) {
      return (await db.all<{ data: string }>('SELECT data FROM layers WHERE session_id = ? ORDER BY updated_at', [id])).map((r) => r.data)
    },
    async putLayer(id, lid, data) {
      await db.all(
        `INSERT INTO layers (session_id, id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (session_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [id, lid, data, now()],
      )
    },
    async deleteLayer(id, lid) {
      await db.all('DELETE FROM layers WHERE session_id = ? AND id = ?', [id, lid])
    },
  }
}
