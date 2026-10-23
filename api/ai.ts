// Fonction serveur (Vercel) vers l'API Gemini de Google. Variables : GEMINI_API_KEY (obligatoire), AI_MODEL, AI_DAILY_LIMIT (appels par jour et par personne, 150 par défaut, 0 = sans limite),
// ACCESS_CODES (un code par personne, « prénom:code,prénom:code ») ou ACCESS_CODE (code unique) : l’un des deux est recommandé ; KV_REST_API_URL + KV_REST_API_TOKEN pour partager les compteurs entre instances.
import { createHash, timingSafeEqual } from 'node:crypto'

const ROUTE = 'ai', MAX_HITS = 20, DAILY = () => limit(process.env.AI_DAILY_LIMIT, 150)

const BASE =
  'Tu es Believe AI, l’assistant de l’application Believe. Réponds en français (sauf demande contraire), de façon claire, bienveillante et concise. ' +
  'Tu n’es ni médecin, ni diététicien, ni psychologue, ni autorité spirituelle : pour toute situation préoccupante (douleur, malaise, trouble alimentaire, détresse, idées noires), ' +
  'invite à consulter un professionnel de santé ou à appeler les urgences (112 en Europe). Ne propose jamais de régime dangereux. Si une information manque, dis-le au lieu d’inventer.'
const MODES: Record<string, string> = {
  nutrition: 'Mode Nutrition et minceur : calories restantes, alternatives, index glycémique. Donne des repères généraux et prudents, jamais de régime très restrictif.',
  sport: 'Mode Sport, trail et marathon : technique, plans progressifs, échauffement, récupération, prévention des blessures. Rappelle d’écouter son corps.',
  eloquence: 'Mode Éloquence et rhétorique : figures de style, structure de discours, plaidoirie, correction de textes avec explications.',
  dico: 'Mode Dictionnaire FR/EN : définition, étymologie, synonymes, exemples ; réponds dans la langue demandée.',
  spirit: 'Mode Spirituel et productivité : contexte d’un verset, prière sur mesure, priorisation (matrice d’Eisenhower). Reste humble et respectueux de toutes les sensibilités.',
  scan: 'Mode Scanner de plat : analyse la photo du plat. Réponds UNIQUEMENT par un objet JSON : {"nom": string, "kcal": nombre, "proteines": nombre, "glucides": nombre, "lipides": nombre, "conseil": string, "incertitude": string}. Valeurs pour la portion visible, estimations prudentes ; "incertitude" explique ce qui reste incertain (taille de portion, sauces, ingrédients cachés). Si l’image n’est pas un plat, mets kcal à 0 et explique-le dans "incertitude".',
  recipes: 'Mode Recettes : propose EXACTEMENT 3 recettes saines et pauvres en sucre à partir des ingrédients indiqués (texte et/ou photo du frigo), sans inventer d’ingrédients importants absents. Réponds UNIQUEMENT par un tableau JSON de 3 objets : {"titre": string, "minutes": nombre, "kcal": nombre par portion, "proteines": nombre, "glucides": nombre, "lipides": nombre, "ingredients": [string], "etapes": [string]}.',
  book: 'Mode Fiche de lecture : à partir du titre, de l’auteur et, s’il est fourni, du descriptif officiel d’un livre, rédige une fiche de synthèse ORIGINALE, dans tes propres mots : aucun extrait ni aucune citation du livre (au plus deux ou trois mots entre guillemets). Ne détaille que ce que tu sais avec certitude de ce livre ; si tu le connais mal, reste général et dis-le dans "fiabilite". N’invente ni chapitres, ni personnages, ni citations, ni chiffres. Réponds UNIQUEMENT par un objet JSON : {"idee": string (l’idée centrale, 2 phrases au plus), "points": [string] (3 à 6 points clés, une phrase chacun), "retenir": string (ce qu’on peut en retenir ou appliquer, 2 phrases au plus), "pour_qui": string (à qui le livre s’adresse, 1 phrase), "fiabilite": string (ce qui est sûr et ce qui reste incertain dans cette fiche, 1 à 2 phrases)}. Écris en français.',
  quiz: 'Mode Quiz : écris des questions de quiz à choix multiples, en français, selon la demande. N’utilise que des faits stables et vérifiables, jamais d’actualité. Chaque question comporte EXACTEMENT 4 réponses possibles dont une seule est correcte, et une explication d’une ou deux phrases. Si tu n’es pas certain d’un fait, choisis une autre question : n’invente rien. Les mauvaises réponses doivent être plausibles et de longueur comparable à la bonne. Réponds UNIQUEMENT par un tableau JSON d’objets {"q": string, "o": [string, string, string, string], "a": nombre (indice de 0 à 3 de la bonne réponse), "e": string}.'
}
const JSON_MODES = ['scan', 'recipes', 'book', 'quiz'], IMG_MODES = ['scan', 'recipes'] // les photos ne sont acceptées que pour le scanner et les recettes

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'not_configured' })
  const g = await guard(req)
  if (g) return res.status(g.s).json({ error: g.e })
  const { mode, messages, context, image } = req.body ?? {}
  const jm = JSON_MODES.includes(mode)
  if (!MODES[mode] || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'bad_request' })
  if (image !== undefined && (!IMG_MODES.includes(mode) || typeof image !== 'string' || image.length > 1400000 || !/^[A-Za-z0-9+/]+=*$/.test(image) || !image.startsWith('/9j/'))) return res.status(400).json({ error: 'bad_image' })
  // Historique borné, rôles Gemini (user / model), messages consécutifs de même rôle fusionnés
  const msgs: { role: string; text: string }[] = []
  for (const m of messages.slice(-10)) {
    const role = m?.role === 'assistant' ? 'model' : 'user', text = String(m?.content ?? '').slice(0, 4000), last = msgs[msgs.length - 1]
    if (last && last.role === role) last.text += '\n\n' + text
    else msgs.push({ role, text })
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return res.status(400).json({ error: 'bad_request' })
  const contents: { role: string; parts: any[] }[] = msgs.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
  if (image) contents[contents.length - 1].parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: image } })
  const model = process.env.AI_MODEL || 'gemini-3.5-flash'
  const ctl = new AbortController()
  const to = setTimeout(() => ctl.abort(), 25000)
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BASE + '\n' + MODES[mode] + (context ? '\nContexte fourni par l’utilisateur avec son accord : ' + String(context).slice(0, 600) : '') }] },
        contents,
        generationConfig: {
          maxOutputTokens: mode === 'recipes' || mode === 'quiz' ? 3000 : 1500,
          ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
          ...(jm ? { responseMimeType: 'application/json' } : {})
        }
      })
    })
    if (!r.ok) {
      const e = r.status === 429 ? 'quota' : r.status === 404 ? 'model' : [400, 401, 403].includes(r.status) ? 'rejected' : 'upstream'
      return res.status(r.status === 429 ? 429 : 502).json({ error: e }) // jamais 404 : le client l'interprète comme « fonction absente »
    }
    const j: any = await r.json()
    if (j.promptFeedback?.blockReason) return res.status(422).json({ error: 'blocked' })
    const c = j.candidates?.[0]
    const text = (c?.content?.parts ?? []).filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('\n').trim()
    if (!text) return res.status(c?.finishReason === 'SAFETY' ? 422 : 502).json({ error: c?.finishReason === 'SAFETY' ? 'blocked' : 'invalid' })
    if (jm) {
      const m = text.match(/[\[{][\s\S]*[\]}]/)
      try { return res.status(200).json({ data: JSON.parse(m ? m[0] : ''), model: j.modelVersion ?? model }) } catch { return res.status(502).json({ error: 'invalid' }) }
    }
    return res.status(200).json({ text, model: j.modelVersion ?? model })
  } catch (e: any) {
    const t = e?.name === 'AbortError'
    return res.status(t ? 504 : 502).json({ error: t ? 'timeout' : 'network' })
  } finally {
    clearTimeout(to)
  }
}
