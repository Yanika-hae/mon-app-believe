// Recherche de livres dans des catalogues publics et légaux : Open Library, Google Books, Project Gutenberg (via Gutendex) et LibriVox.
// Aucune clé n'est obligatoire. Variables facultatives : GOOGLE_BOOKS_KEY (quota Google plus large), BOOKS_CONTACT (contact transmis dans le User-Agent, demandé par Open Library),
// EXT_DAILY_LIMIT (appels par jour et par personne, 300 par défaut, 0 = sans limite), ACCESS_CODES (un code par personne) ou ACCESS_CODE (code unique), KV_REST_API_URL + KV_REST_API_TOKEN (compteurs partagés).
// La fonction ne renvoie que des informations publiques de catalogue : titre, auteur, couverture, descriptif de l'éditeur ou du domaine public, adresse de la page officielle.
import { createHash, timingSafeEqual } from 'node:crypto'

const ROUTE = 'ext', MAX_HITS = 40, DAILY = () => limit(process.env.EXT_DAILY_LIMIT, 300)
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

// <hosts> Domaines autorisés pour les liens et les couvertures : même liste que BOOK_HOSTS dans src/data.ts (contrôlée par npm run audit).
const HOSTS = ['openlibrary.org', 'archive.org', 'books.google.com', 'play.google.com', 'www.google.com', 'gutenberg.org', 'gutendex.com', 'librivox.org', 'wikisource.org', 'wikimedia.org', 'classics.mit.edu']
// </hosts>

type Src = 'ol' | 'gb' | 'gu' | 'lv'
/** Notice de catalogue. acc : accès légal (free = lecture ou écoute libre, loan = emprunt numérique, preview = extrait, info = fiche seulement). */
interface Item { src: Src; id: string; t: string; a: string; y: number | null; l: string; cover: string | null; desc: string; pub: string; url: string; acc: 'free' | 'loan' | 'preview' | 'info'; med: 'text' | 'audio' }
class Fail extends Error { constructor(public c: string) { super(c) } }

const hostOk = (h: string) => HOSTS.some(d => h === d || h.endsWith('.' + d))
/** Adresse https dont l'hôte est autorisé (http est converti en https), sinon null : aucun lien piégé ne quitte le serveur. */
const safe = (u: unknown): string | null => {
  if (typeof u !== 'string' || u.length > 600) return null
  try {
    const x = new URL(u.startsWith('http://') ? 'https://' + u.slice(7) : u)
    return x.protocol === 'https:' && !x.username && !x.password && hostOk(x.hostname) ? x.href : null
  } catch { return null }
}
const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' }
/** Texte brut : balises retirées, entités courantes décodées, caractères de contrôle et espaces multiples réduits, longueur limitée. */
const txt = (x: unknown, max: number): string =>
  typeof x === 'string' ? x.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, m => ENT[m]).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
const yr = (x: unknown): number | null => { const n = typeof x === 'number' ? x : parseInt(String(x ?? ''), 10); return Number.isInteger(n) && n >= 1 && n <= 2100 ? n : null }
const LANG: Record<string, string> = { fre: 'fr', fra: 'fr', fr: 'fr', french: 'fr', eng: 'en', en: 'en', english: 'en' }
const lg = (x: unknown): string => { for (const e of Array.isArray(x) ? x : [x]) { const k = LANG[String(e ?? '').toLowerCase()]; if (k) return k } return '' }
const first = (x: unknown): string => String(Array.isArray(x) ? x[0] ?? '' : x ?? '')
/** Requête nettoyée : lettres, chiffres, espaces et ponctuation courante seulement (aucune syntaxe de recherche avancée), 80 caractères au plus. */
const clean = (q: string): string => q.normalize('NFC').replace(/[^\p{L}\p{N}\s'’.,!?&-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
const UA = () => 'Believe-PWA/0.3 (recherche de livres' + (process.env.BOOKS_CONTACT ? '; ' + String(process.env.BOOKS_CONTACT).replace(/[^\w@.+: /-]/g, '').slice(0, 100) : '') + ')'

async function getJSON(u: string, ms = 7000): Promise<any> {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': UA() } })
    if (r.status === 404) throw new Fail('none')
    if (r.status === 429 || r.status === 403) throw new Fail('quota')
    if (!r.ok) throw new Fail('upstream')
    try { return await r.json() } catch { throw new Fail('invalid') }
  } catch (e: any) {
    if (e instanceof Fail) throw e
    throw new Fail(e?.name === 'AbortError' ? 'timeout' : 'network')
  } finally {
    clearTimeout(to)
  }
}
const list = (x: unknown): any[] => (Array.isArray(x) ? x : [])

/** Open Library : fiches d'œuvres ; lecture libre via Internet Archive quand l'œuvre est en accès public. */
async function ol(q: string, lang: string): Promise<Item[]> {
  const p = new URLSearchParams({ q: q + (lang === 'fr' ? ' language:fre' : lang === 'en' ? ' language:eng' : ''), limit: '8', fields: 'key,title,author_name,first_publish_year,cover_i,language,ebook_access,ia' })
  const j = await getJSON('https://openlibrary.org/search.json?' + p)
  const out: Item[] = []
  for (const d of list(j?.docs)) {
    if (typeof d?.key !== 'string' || !/^\/works\/OL\d{1,12}W$/.test(d.key) || typeof d.title !== 'string') continue
    const t = txt(d.title, 200), pub = d.ebook_access === 'public', ia = list(d.ia).find(x => typeof x === 'string' && /^[\w.-]{3,100}$/.test(x))
    const url = safe(pub && ia ? 'https://archive.org/details/' + ia : 'https://openlibrary.org' + d.key)
    if (!t || !url) continue
    out.push({
      src: 'ol', id: d.key, t, a: list(d.author_name).slice(0, 3).map(x => txt(x, 80)).filter(Boolean).join(', '), y: yr(d.first_publish_year), l: lg(d.language),
      cover: Number.isInteger(d.cover_i) && d.cover_i > 0 ? safe('https://covers.openlibrary.org/b/id/' + d.cover_i + '-M.jpg') : null, desc: '', pub: 'Open Library', url,
      acc: pub ? 'free' : d.ebook_access === 'borrowable' ? 'loan' : 'info', med: 'text'
    })
  }
  return out
}

/** Google Books : descriptif de l'éditeur, aperçu ou lecture libre (domaine public) quand Google l'indique. */
async function gb(q: string, lang: string): Promise<Item[]> {
  const p = new URLSearchParams({ q, maxResults: '8', printType: 'books', fields: 'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,language,imageLinks/thumbnail),accessInfo(viewability,publicDomain))' })
  if (lang) p.set('langRestrict', lang)
  if (process.env.GOOGLE_BOOKS_KEY) p.set('key', process.env.GOOGLE_BOOKS_KEY)
  const j = await getJSON('https://www.googleapis.com/books/v1/volumes?' + p)
  const out: Item[] = []
  for (const it of list(j?.items)) {
    const v = it?.volumeInfo
    if (typeof it?.id !== 'string' || !/^[\w-]{4,30}$/.test(it.id) || typeof v?.title !== 'string') continue
    const t = txt(v.title + (typeof v.subtitle === 'string' && v.subtitle ? ' : ' + v.subtitle : ''), 200), url = safe('https://books.google.com/books?id=' + it.id)
    const view = it.accessInfo?.viewability
    if (!t || !url) continue
    out.push({
      src: 'gb', id: it.id, t, a: list(v.authors).slice(0, 3).map(x => txt(x, 80)).filter(Boolean).join(', '), y: yr(v.publishedDate), l: lg(v.language),
      cover: safe(typeof v.imageLinks?.thumbnail === 'string' ? v.imageLinks.thumbnail.replace('&edge=curl', '') : null), desc: txt(v.description, 700), pub: txt(v.publisher, 80) || 'Google Books', url,
      acc: it.accessInfo?.publicDomain === true || view === 'ALL_PAGES' ? 'free' : view === 'PARTIAL' || view === 'SAMPLE' ? 'preview' : 'info', med: 'text'
    })
  }
  return out
}

/** Project Gutenberg, par l'interface publique Gutendex : livres tombés dans le domaine public (selon Gutenberg, États-Unis). */
async function gu(q: string, lang: string): Promise<Item[]> {
  const j = await getJSON('https://gutendex.com/books/?' + new URLSearchParams({ search: q, languages: lang || 'fr,en' }), 9000)
  const out: Item[] = []
  for (const b of list(j?.results)) {
    if (!Number.isInteger(b?.id) || b.id < 1 || typeof b.title !== 'string' || b.copyright === true) continue
    const t = txt(b.title, 200), url = safe('https://www.gutenberg.org/ebooks/' + b.id)
    if (!t || !url) continue
    const name = (x: any) => { const s = txt(x?.name, 80), i = s.indexOf(', '); return i > 0 && s.indexOf(', ', i + 1) < 0 ? s.slice(i + 2) + ' ' + s.slice(0, i) : s } // « Austen, Jane » devient « Jane Austen »
    out.push({
      src: 'gu', id: String(b.id), t, a: list(b.authors).slice(0, 3).map(name).filter(Boolean).join(', '), y: null, l: lg(b.languages),
      cover: safe(b.formats?.['image/jpeg']), desc: txt(list(b.summaries)[0], 700), pub: 'Project Gutenberg', url, acc: 'free', med: 'text'
    })
  }
  return out.slice(0, 8)
}

/** LibriVox : livres audio du domaine public lus par des bénévoles ; recherche par début de titre et par nom d'auteur. */
async function lv(q: string, lang: string): Promise<Item[]> {
  const words = q.split(' ').filter(Boolean), url = (k: string, v: string) => 'https://librivox.org/api/feed/audiobooks?' + new URLSearchParams({ [k]: '^' + v, format: 'json', limit: '8', coverart: '1' })
  const reqs = [getJSON(url('title', q))]
  if (words.length > 1) reqs.push(getJSON(url('author', words[words.length - 1])))
  const rs = await Promise.allSettled(reqs)
  const bad = rs.find(r => r.status === 'rejected' && (r.reason as Fail).c !== 'none') as PromiseRejectedResult | undefined
  const got = rs.filter(r => r.status === 'fulfilled').length
  if (bad && !got) throw bad.reason
  const seen = new Set<string>(), out: Item[] = []
  for (const r of rs) {
    if (r.status !== 'fulfilled') continue
    for (const b of list(r.value?.books)) {
      const id = String(b?.id ?? ''), l = lg(b?.language)
      if (!/^\d{1,9}$/.test(id) || seen.has(id) || typeof b.title !== 'string' || (lang ? l !== lang : !l)) continue
      const t = txt(b.title, 200), u = safe(b.url_librivox)
      if (!t || !u) continue
      seen.add(id)
      out.push({
        src: 'lv', id, t, a: list(b.authors).slice(0, 2).map(x => txt((x?.first_name ?? '') + ' ' + (x?.last_name ?? ''), 80)).filter(Boolean).join(', '), y: yr(b.copyright_year), l,
        cover: safe(b.coverart_thumbnail), desc: txt(b.description, 700), pub: 'LibriVox (lecteurs bénévoles)', url: u, acc: 'free', med: 'audio'
      })
    }
  }
  return out.slice(0, 8)
}

const SRCS: Record<Src, (q: string, lang: string) => Promise<Item[]>> = { ol, gb, gu, lv }

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' })
  const g = await guard(req)
  if (g) return res.status(g.s).json({ error: g.e })
  const q = clean(first(req.query?.q)), l = first(req.query?.lang), lang = l === 'fr' || l === 'en' ? l : ''
  const want = (first(req.query?.src) || 'ol,gb,gu,lv').split(',').filter((s, i, a): s is Src => s in SRCS && a.indexOf(s) === i)
  if (q.length < 2 || !want.length) return res.status(400).json({ error: 'bad_request' })
  const rs = await Promise.allSettled(want.map(s => SRCS[s](q, lang)))
  const items: Item[] = [], errors: { s: string; e: string }[] = []
  rs.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value)
    else { const c = (r.reason as Fail)?.c; errors.push({ s: want[i], e: c === 'none' || !c ? 'upstream' : c }) }
  })
  if (errors.length === want.length) return res.status(502).json({ error: errors[0].e, errors, items: [] })
  res.setHeader?.('cache-control', 'private, max-age=300') // la réponse ne contient que des informations de catalogue, mais reste propre à cet appareil
  return res.status(200).json({ items, errors })
}
