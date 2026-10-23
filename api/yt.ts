// Recherche de vidéos YouTube intégrables (API YouTube Data v3). Variables : YOUTUBE_API_KEY (obligatoire), YT_DAILY_LIMIT (appels par jour et par personne, 100 par défaut, 0 = sans limite),
// ACCESS_CODES (un code par personne) ou ACCESS_CODE (code unique), KV_REST_API_URL + KV_REST_API_TOKEN (compteurs partagés entre instances).
import { createHash, timingSafeEqual } from 'node:crypto'

const ROUTE = 'yt', MAX_HITS = 20, DAILY = () => limit(process.env.YT_DAILY_LIMIT, 100)
// <guard> Bloc commun à api/ai.ts, api/ext.ts et api/yt.ts : copie identique (contrôlée par npm run audit), car les fonctions n'importent aucun fichier local.
// Accès : origine identique, code d'accès (un code par personne avec ACCESS_CODES, ou un code unique ACCESS_CODE ; aucun code défini = accès libre), puis limite sur 10 minutes
// et limite quotidienne par personne (ou par adresse IP). Les compteurs quotidiens sont partagés entre instances si KV_REST_API_URL et KV_REST_API_TOKEN (Upstash / Vercel KV)
// sont définis ; sinon chaque instance compte pour elle-même (limite indicative). Seule une empreinte de l'identifiant est envoyée au service de compteurs.
/** Plafond quotidien lu dans l'environnement : absent ou vide = valeur par défaut, 0 = sans limite, valeur illisible ou négative = valeur par défaut (une faute de frappe ne supprime jamais la limite). */
const limit = (v: string | undefined, def: number) => { const n = v === undefined || v.trim() === '' ? def : Number(v); return Number.isFinite(n) && n >= 0 ? n : def }
const hits = new Map<string, number[]>(), days = new Map<string, number>()
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
const sameOrigin = (req: any) => {
  const sf = req.headers['sec-fetch-site']
  if (sf && sf !== 'same-origin' && sf !== 'none') return false
  const o = req.headers.origin
  if (!o) return true
  try { return new URL(o).host === req.headers.host } catch { return false }
}
const person = (req: any): string | null => {
  const given = String(req.headers['x-access-code'] ?? ''), one = process.env.ACCESS_CODE ?? ''
  const many = String(process.env.ACCESS_CODES ?? '').split(',').map(s => s.trim()).filter(s => s.indexOf(':') > 0 && s.indexOf(':') < s.length - 1)
  if (!one && !many.length) return 'ip:' + String(req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'] ?? 'x').split(',')[0].trim()
  let id: string | null = one && same(given, one) ? 'code' : null
  for (const e of many) { const i = e.indexOf(':'); if (same(given, e.slice(i + 1))) id = id ?? 'u:' + e.slice(0, i) }
  return id
}
const burst = (k: string) => {
  if (hits.size > 5000) hits.clear()
  const now = Date.now(), a = (hits.get(k) ?? []).filter(t => now - t < 600000)
  a.push(now); hits.set(k, a)
  return a.length > MAX_HITS
}
const daily = async (who: string): Promise<boolean> => {
  const lim = DAILY()
  if (!(lim > 0)) return false
  const key = 'believe:' + ROUTE + ':' + new Date().toISOString().slice(0, 10) + ':' + createHash('sha256').update(who).digest('hex').slice(0, 24)
  const url = process.env.KV_REST_API_URL, tok = process.env.KV_REST_API_TOKEN
  if (url && tok) {
    try {
      const r = await fetch(url.replace(/\/$/, '') + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify([['INCR', key], ['EXPIRE', key, 172800]]), signal: AbortSignal.timeout(2500) })
      const n = r.ok ? Number(((await r.json()) as any)?.[0]?.result) : NaN
      if (Number.isFinite(n)) return n > lim
    } catch { /* service de compteurs indisponible : repli sur le compteur de l'instance */ }
  }
  if (days.size > 5000) days.clear()
  const n = (days.get(key) ?? 0) + 1
  days.set(key, n)
  return n > lim
}
const guard = async (req: any): Promise<{ s: number; e: string } | null> => {
  if (!sameOrigin(req)) return { s: 403, e: 'origin' }
  const who = person(req)
  if (!who) return { s: 401, e: 'code' }
  if (burst(ROUTE + who)) return { s: 429, e: 'quota' }
  return (await daily(who)) ? { s: 429, e: 'daily' } : null
}
// </guard>
const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
const dec = (s: string) => s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, m => ENT[m])

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' })
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return res.status(503).json({ error: 'not_configured' })
  const g = await guard(req)
  if (g) return res.status(g.s).json({ error: g.e })
  const q = String(req.query?.q ?? '').trim().slice(0, 100)
  if (!q) return res.status(400).json({ error: 'bad_request' })
  const ctl = new AbortController()
  const to = setTimeout(() => ctl.abort(), 10000)
  try {
    const u = new URL('https://www.googleapis.com/youtube/v3/search')
    u.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: '8', safeSearch: 'moderate', q, key }).toString()
    const r = await fetch(u, { signal: ctl.signal })
    if (!r.ok) { const quota = r.status === 429 || r.status === 403; return res.status(quota ? 429 : 502).json({ error: quota ? 'quota' : 'upstream' }) }
    const j: any = await r.json()
    const items = (j.items ?? []).filter((x: any) => /^[A-Za-z0-9_-]{11}$/.test(x?.id?.videoId ?? '')).map((x: any) => ({ id: x.id.videoId, t: dec(String(x.snippet?.title ?? '')).slice(0, 120), ch: dec(String(x.snippet?.channelTitle ?? '')).slice(0, 60) }))
    return res.status(200).json({ items })
  } catch (e: any) {
    const t = e?.name === 'AbortError'
    return res.status(t ? 504 : 502).json({ error: t ? 'timeout' : 'network' })
  } finally {
    clearTimeout(to)
  }
}
