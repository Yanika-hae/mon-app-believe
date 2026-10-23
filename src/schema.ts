// Validation par schéma : chaque validateur renvoie null (valide) ou un message qui nomme le champ fautif.
export type V = (x: unknown, p: string) => string | null
export const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const bad = (p: string, what: string) => p + ' : ' + what

export const str = (max = 1000, min = 0): V => (x, p) => (typeof x === 'string' && x.length >= min && x.length <= max ? null : bad(p, 'texte attendu'))
export const num = (min = -1e12, max = 1e12): V => (x, p) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? null : bad(p, 'nombre attendu'))
export const int = (min: number, max: number): V => (x, p) => (typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? null : bad(p, 'entier attendu'))
export const bool: V = (x, p) => (typeof x === 'boolean' ? null : bad(p, 'vrai ou faux attendu'))
export const lit = (...v: (string | number)[]): V => (x, p) => ((typeof x === 'string' || typeof x === 'number') && v.includes(x) ? null : bad(p, 'valeur inconnue'))
export const pat = (re: RegExp, max = 300): V => (x, p) => (typeof x === 'string' && x.length <= max && re.test(x) ? null : bad(p, 'format invalide'))
/** Vrai pour un jour réel au format AAAA-MM-JJ. « 2026-02-30 » est refusé : certains moteurs le décalent au 2 mars au lieu de l’écarter, ce qui laisserait entrer une date qui n’existe pas. */
export const isDay = (x: unknown): x is string => {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  const t = Date.parse(x + 'T00:00:00Z')
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === x
}
/** Jour au format AAAA-MM-JJ (date réelle). */
export const day: V = (x, p) => (isDay(x) ? null : bad(p, 'date AAAA-MM-JJ attendue'))
/** Horodatage ISO 8601 (date + heure). */
export const stamp: V = (x, p) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x) && !isNaN(Date.parse(x)) ? null : bad(p, 'horodatage attendu'))
export const nul = (v: V): V => (x, p) => (x === null ? null : v(x, p))
export const opt = (v: V): V => (x, p) => (x === undefined ? null : v(x, p))
export const arr = (v: V, max = 10000): V => (x, p) => {
  if (!Array.isArray(x)) return bad(p, 'liste attendue')
  if (x.length > max) return bad(p, 'trop d’éléments')
  for (let i = 0; i < x.length; i++) { const e = v(x[i], p + '[' + i + ']'); if (e) return e }
  return null
}
/** Liste de longueur fixe dont chaque position a son propre validateur. */
export const tup = (...vs: V[]): V => (x, p) => {
  if (!Array.isArray(x) || x.length !== vs.length) return bad(p, vs.length + ' éléments attendus')
  for (let i = 0; i < vs.length; i++) { const e = vs[i](x[i], p + '[' + i + ']'); if (e) return e }
  return null
}
export const rec = (v: V, max = 20000, key?: RegExp): V => (x, p) => {
  if (!isObj(x)) return bad(p, 'objet attendu')
  const ks = Object.keys(x)
  if (ks.length > max) return bad(p, 'trop d’entrées')
  for (const k of ks) {
    if (BAD.has(k) || (key && !key.test(k))) return bad(p + '.' + k, 'clé refusée')
    const e = v(x[k], p + '.' + k); if (e) return e
  }
  return null
}
/** Objet : toutes les clés du schéma sont exigées (sauf avec opt), les clés inconnues sont tolérées. */
export const obj = (shape: Record<string, V>): V => (x, p) => {
  if (!isObj(x)) return bad(p, 'objet attendu')
  for (const k of Object.keys(shape)) { const e = shape[k](x[k], p + '.' + k); if (e) return e }
  return null
}
/** Comme obj, mais en liste blanche : toute clé absente du schéma est refusée (sert à vérifier ce qui va être partagé, jamais de champ en trop). */
export const strict = (shape: Record<string, V>): V => (x, p) => {
  if (!isObj(x)) return bad(p, 'objet attendu')
  for (const k of Object.keys(x)) if (BAD.has(k) || !Object.prototype.hasOwnProperty.call(shape, k)) return bad(p + '.' + k, 'clé non autorisée')
  for (const k of Object.keys(shape)) { const e = shape[k](x[k], p + '.' + k); if (e) return e }
  return null
}
/** Hôte autorisé : égal au domaine ou sous-domaine de celui-ci. */
export const hostIn = (h: string, domains: readonly string[]) => domains.some(d => h === d || h.endsWith('.' + d))
/** Adresse https dont l'hôte figure dans la liste (jamais javascript:, data:, http:). */
export const httpsUrl = (domains: readonly string[]): V => (x, p) => {
  if (typeof x !== 'string' || x.length > 600) return bad(p, 'adresse attendue')
  try { const u = new URL(x); return u.protocol === 'https:' && !u.username && !u.password && hostIn(u.hostname, domains) ? null : bad(p, 'adresse refusée') } catch { return bad(p, 'adresse invalide') }
}
export const safeUrl = (x: unknown, domains: readonly string[]): string | null => (typeof x === 'string' && httpsUrl(domains)(x, '') === null ? x : null)
