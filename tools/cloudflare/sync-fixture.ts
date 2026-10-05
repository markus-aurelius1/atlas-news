/**
 * Test double for the deployed sync service: the real Pages functions (Access middleware, then /api/sync) over
 * the real migration in SQLite, with tokens signed by a throwaway key that stands in for the Access team's.
 */
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { onRequest as guard } from '../../functions/api/_middleware.ts'
import { onRequest as sync } from '../../functions/api/sync.ts'
import type { D1Like, D1Statement } from '../../src/sync/d1.ts'

export const ISSUER = 'https://tars-team.cloudflareaccess.test'
export const AUD = 'aud-tars-fixture'
export const ORIGIN = 'https://tars.test'

interface Statement extends D1Statement { sql: string; params: unknown[] }

/** D1's prepare/bind/batch over an in-memory SQLite database; a batch is one transaction, as in D1. */
export function sqliteD1() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../../migrations/0001_sync.sql', import.meta.url), 'utf8'))
  const totals = { batches: 0, queries: 0, rowsRead: 0, rowsWritten: 0 }
  const statement = (sql: string, params: unknown[] = []): Statement => ({ sql, params, bind: (...values: unknown[]) => statement(sql, values) })
  const d1: D1Like = {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      totals.batches++
      sqlite.exec('BEGIN')
      try {
        const results = (statements as Statement[]).map(({ sql, params }) => {
          totals.queries++
          const prepared = sqlite.prepare(sql)
          if (/^\s*SELECT/i.test(sql)) {
            const results = prepared.all(...(params as never[]))
            totals.rowsRead += results.length
            return { results, meta: { rows_read: results.length, rows_written: 0 } }
          }
          const { changes } = prepared.run(...(params as never[]))
          totals.rowsWritten += Number(changes)
          return { results: [], meta: { rows_read: 0, rows_written: Number(changes) } }
        })
        sqlite.exec('COMMIT')
        return results as never
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
  return { d1, sqlite, totals }
}

const b64url = (data: ArrayBuffer | string) => Buffer.from(typeof data === 'string' ? data : new Uint8Array(data)).toString('base64url')

export async function accessIssuer(kid = 'fixture-key') {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const certs = { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] }
  async function token(email: string, claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000)
    const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT', ...header }))
    const body = b64url(JSON.stringify({ iss: ISSUER, aud: [AUD], email, sub: `sub-${email}`, iat: now, nbf: now - 5, exp: now + 3600, type: 'app', ...claims }))
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${head}.${body}`))
    return `${head}.${body}.${b64url(signature)}`
  }
  /** What the middleware's key request receives. */
  const serveCerts = async (input: unknown) => (String(input) === `${ISSUER}/cdn-cgi/access/certs` ? new Response(JSON.stringify(certs)) : new Response('not found', { status: 404 }))
  return { token, certs, serveCerts }
}

export const ENV = { ACCESS_TEAM_DOMAIN: ISSUER, ACCESS_AUD: AUD }

/** One request through the middleware and the sync function, as Pages would run them. */
export function service(d1: D1Like, env: Record<string, unknown> = ENV) {
  return (request: Request) => {
    const data = {}
    const bindings = { ...env, SYNC_DB: d1 }
    return guard({ request, env: bindings, data, next: () => sync({ request, env: bindings, data }) })
  }
}
