// Image d'un plat pour les recettes (API Gemini, modèle d'image « Nano Banana »). Variables : GEMINI_API_KEY (obligatoire), AI_IMAGE_MODEL (gemini-nano-banana-2.1 par défaut),
// AI_IMAGE_DAILY_LIMIT (images par jour et par personne, 20 par défaut, 0 = sans limite : la génération d'image est payante, sans palier gratuit chez Google),
// ACCESS_CODES (un code par personne) ou ACCESS_CODE (code unique), KV_REST_API_URL + KV_REST_API_TOKEN (compteurs partagés entre instances).
import { createHash, timingSafeEqual } from 'node:crypto'

const ROUTE = 'img', MAX_HITS = 6, DAILY = () => limit(process.env.AI_IMAGE_DAILY_LIMIT, 20)
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

const BIG = 3400000, MIMES = ['image/png', 'image/jpeg', 'image/webp'], STOP = ['SAFETY', 'IMAGE_SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'RECITATION', 'IMAGE_PROHIBITED_CONTENT', 'IMAGE_RECITATION']
/** Texte court sans caractère de contrôle ni signe de mise en forme : seuls le titre et les ingrédients de la recette entrent dans la consigne. */
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>{}\[\]`"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'not_configured' })
  const g = await guard(req)
  if (g) return res.status(g.s).json({ error: g.e })
  const { title, ingredients } = req.body ?? {}
  const t = typeof title === 'string' ? clean(title, 100) : ''
  if (!t || (ingredients !== undefined && !Array.isArray(ingredients))) return res.status(400).json({ error: 'bad_request' })
  const ing: string[] = Array.isArray(ingredients) ? ingredients.slice(0, 50).map((x: unknown) => (typeof x === 'string' ? clean(x, 60) : '')).filter(Boolean).slice(0, 12) : []
  const prompt = 'Photographie culinaire réaliste du plat « ' + t + ' »' + (ing.length ? ', préparé avec : ' + ing.join(', ') : '') + '. Plat cuisiné, servi dans une assiette sur une table en bois clair, vue de trois quarts, lumière naturelle douce, arrière-plan légèrement flou, appétissant et sain. Aucun texte, aucun logo, aucune personne, aucune main.'
  const model = process.env.AI_IMAGE_MODEL || 'gemini-nano-banana-2.1'
  const ctl = new AbortController()
  const to = setTimeout(() => ctl.abort(), 50000)
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:3', imageSize: '1K' } } })
    })
    if (!r.ok) {
      const e = r.status === 429 ? 'quota' : r.status === 404 ? 'model' : [400, 401, 403].includes(r.status) ? 'rejected' : 'upstream'
      return res.status(r.status === 429 ? 429 : 502).json({ error: e }) // jamais 404 : le client l'interprète comme « fonction absente »
    }
    const j: any = await r.json()
    if (j.promptFeedback?.blockReason) return res.status(422).json({ error: 'blocked' })
    const c = j.candidates?.[0]
    // l'image finale est la dernière image qui n'est pas une étape de réflexion ; la REST renvoie inlineData / mimeType (snake_case accepté par prudence)
    const imgs = (c?.content?.parts ?? []).map((p: any) => (p.thought ? null : p.inlineData ?? p.inline_data ?? null)).filter((d: any) => d && typeof d.data === 'string' && MIMES.includes(String(d.mimeType ?? d.mime_type ?? '').toLowerCase()))
    const d = imgs[imgs.length - 1]
    if (!d) return res.status(STOP.includes(String(c?.finishReason)) ? 422 : 502).json({ error: STOP.includes(String(c?.finishReason)) ? 'blocked' : 'invalid' })
    if (d.data.length > BIG || !/^[A-Za-z0-9+/]+=*$/.test(d.data)) return res.status(502).json({ error: 'invalid' })
    return res.status(200).json({ image: d.data, mime: String(d.mimeType ?? d.mime_type).toLowerCase(), model: j.modelVersion ?? model })
  } catch (e: any) {
    const to2 = e?.name === 'AbortError'
    return res.status(to2 ? 504 : 502).json({ error: to2 ? 'timeout' : 'network' })
  } finally {
    clearTimeout(to)
  }
}
