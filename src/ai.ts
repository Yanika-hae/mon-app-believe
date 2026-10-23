export type Mode = 'nutrition' | 'sport' | 'eloquence' | 'dico' | 'spirit'
export interface Msg { role: 'user' | 'assistant'; content: string }

export const MODES: { k: Mode; t: string; q: string[] }[] = [
  { k: 'nutrition', t: 'Nutrition et minceur', q: ['Que manger ce soir avec peu de sucre ?', 'Donne-moi des alternatives saines au grignotage.', 'Explique l’index glycémique simplement.'] },
  { k: 'sport', t: 'Sport, trail et marathon', q: ['Propose un échauffement avant une course.', 'Comment préparer un 10 km en 8 semaines ?', 'Comment bien récupérer après une séance intense ?'] },
  { k: 'eloquence', t: 'Éloquence et rhétorique', q: ['Explique l’anaphore avec un exemple.', 'Aide-moi à structurer un discours de 3 minutes.', 'Corrige ce paragraphe : '] },
  { k: 'dico', t: 'Dictionnaire FR/EN', q: ['Définition, étymologie et synonymes de « persévérance »', 'Translate and explain “resilience” in French', 'Donne 3 exemples avec « sagesse »'] },
  { k: 'spirit', t: 'Spirituel et productivité', q: ['Quel est le contexte de Josué 1:9 ?', 'Écris une courte prière du matin.', 'Aide-moi à prioriser ma journée.'] }
]

/** Messages d'erreur communs aux fonctions serveur (le code vient du serveur ou du client). */
export const ERR: Record<string, string> = {
  not_configured: 'Configuration requise : ajoutez la variable GEMINI_API_KEY sur le serveur (voir README), puis redéployez.',
  offline: 'Serveur injoignable ou hors ligne. Réessayez une fois connecté.', timeout: 'Le serveur a mis trop de temps à répondre.',
  quota: 'Limite de requêtes atteinte. Réessayez plus tard.', daily: 'Limite quotidienne atteinte pour votre accès. Réessayez demain.', cancelled: 'Envoi annulé.', code: 'Code d’accès requis ou incorrect : saisissez-le dans la rubrique 3 (Believe AI).',
  origin: 'Origine refusée par le serveur.', model: 'Modèle introuvable : vérifiez la variable AI_MODEL (voir README).',
  rejected: 'Requête refusée par le service IA : vérifiez GEMINI_API_KEY et AI_MODEL.', blocked: 'Réponse bloquée par les filtres de sécurité du service IA : reformulez.',
  invalid: 'Réponse illisible de l’IA : réessayez.', bad_image: 'Image refusée par le serveur.', image: 'Image illisible : choisissez une autre photo.'
}
export const errText = (c: string) => ERR[c] ?? 'Service indisponible ou réponse invalide : réessayez.'

const CODE = 'believe:code'
export const getCode = () => { try { return localStorage.getItem(CODE) ?? '' } catch { return '' } }
export const setCode = (c: string) => { try { if (c) localStorage.setItem(CODE, c); else localStorage.removeItem(CODE) } catch { /* ignoré */ } }

/** Un hébergement sans fonctions serveur renvoie la page d'accueil (HTML) à la place de la réponse : la fonction n'est alors pas déployée. */
export const isHtml = (r: Response) => /text\/html/i.test(r.headers?.get?.('content-type') ?? '')

/** Appelle une fonction serveur (/api/ai par défaut, /api/img pour l'image d'un plat) ; la clé API n'existe jamais côté navigateur. */
async function post(body: object, signal: AbortSignal, url = '/api/ai'): Promise<any> {
  let r: Response
  try {
    const code = getCode()
    r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(code ? { 'x-access-code': code } : {}) }, body: JSON.stringify(body), signal })
  } catch (e) {
    throw new Error((e as Error).name === 'AbortError' ? 'cancelled' : 'offline')
  }
  if (r.status === 404 || isHtml(r)) throw new Error('not_configured')
  const j = await r.json().catch(() => null)
  if (!r.ok || !j) throw new Error((j && j.error) || 'upstream')
  return j
}
export async function askAI(mode: Mode, messages: Msg[], context: string, signal: AbortSignal): Promise<{ text: string; model: string }> {
  const j = await post({ mode, messages: messages.slice(-10), context }, signal)
  if (typeof j.text !== 'string') throw new Error('upstream')
  return j
}
/** Modes à réponse JSON (scan, recipes, book, quiz) : le serveur renvoie { data, model }. */
export async function askJSON(mode: 'scan' | 'recipes' | 'book' | 'quiz', text: string, image: string | undefined, signal: AbortSignal): Promise<{ data: any; model: string }> {
  const j = await post({ mode, messages: [{ role: 'user', content: text }], image }, signal)
  if (j.data === undefined) throw new Error('upstream')
  return j
}
/**
 * Image d'un plat générée par l'IA à partir du titre et des ingrédients d'une recette (fonction serveur /api/img, un seul plat par appel).
 * Renvoie une adresse « data: » prête à afficher ; rien n'est conservé : l'image disparaît avec la liste des recettes.
 */
export async function askImage(title: string, ingredients: string[], signal: AbortSignal): Promise<string> {
  const j = await post({ title, ingredients }, signal, '/api/img')
  if (typeof j.image !== 'string' || !/^image\/(png|jpeg|webp)$/.test(String(j.mime)) || !/^[A-Za-z0-9+/]+=*$/.test(j.image)) throw new Error('upstream')
  return 'data:' + j.mime + ';base64,' + j.image
}
/** Compresse une photo sur l'appareil (JPEG, 1024 px max) et renvoie le base64 sans préfixe. */
export const compress = (f: File, max = 1024, q = 0.72) => new Promise<string>((res, rej) => {
  const u = URL.createObjectURL(f), i = new Image()
  i.onload = () => {
    const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'), x = c.getContext('2d')
    c.width = Math.max(1, Math.round(i.width * k)); c.height = Math.max(1, Math.round(i.height * k)); URL.revokeObjectURL(u)
    if (!x) return rej(new Error('image'))
    x.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q).split(',')[1])
  }
  i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image')) }
  i.src = u
})

/** Recherche de vidéos via la fonction serveur /api/yt (clé YouTube côté serveur). */
export async function searchYT(q: string, signal: AbortSignal): Promise<{ id: string; t: string; ch: string }[]> {
  let r: Response
  try {
    const code = getCode()
    r = await fetch('/api/yt?q=' + encodeURIComponent(q), { headers: code ? { 'x-access-code': code } : {}, signal })
  } catch (e) {
    throw new Error((e as Error).name === 'AbortError' ? 'cancelled' : 'offline')
  }
  if (r.status === 404 || isHtml(r)) throw new Error('not_configured')
  const j = await r.json().catch(() => null)
  if (!r.ok || !j || !Array.isArray(j.items)) throw new Error((j && j.error) || 'upstream')
  return j.items.filter((x: any) => /^[A-Za-z0-9_-]{11}$/.test(x?.id) && typeof x.t === 'string').slice(0, 8)
}
