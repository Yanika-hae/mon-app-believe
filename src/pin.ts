// PIN à 4 chiffres : haché avec PBKDF2-SHA-256 et un sel aléatoire, tentatives limitées, blocage conservé après rechargement.
// Il verrouille l'interface ; il ne chiffre pas les données du navigateur (voir README, section Sécurité).
export const PIN_KEY = 'believe:pin'
export const ITER = 210_000
/** Échecs permis avant le premier blocage ; chaque échec suivant double la durée (30 s, 1 min, 2 min… plafonné à 15 min). */
export const FREE = 5
export interface PinRec { s: string; h: string; i: number; f: number; u: number; a: number }
/** Délais de verrouillage automatique proposés, en minutes (0 = dès que l'application quitte l'écran). */
export const AUTO = [0, 1, 5, 15]

const enc = new TextEncoder()
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const sane = (o: unknown): o is PinRec => {
  const r = o as PinRec
  return !!r && typeof r === 'object' && typeof r.s === 'string' && typeof r.h === 'string' && Number.isInteger(r.i) && r.i >= 1 && Number.isFinite(r.f) && r.f >= 0 && Number.isFinite(r.u) && AUTO.includes(r.a)
}
/** Enregistrement du PIN, ou null s'il n'existe pas ou s'il est illisible. */
export function readPin(): PinRec | null {
  try { const r = localStorage.getItem(PIN_KEY); if (!r) return null; const o = JSON.parse(r); return sane(o) ? o : null } catch { return null }
}
const writePin = (r: PinRec) => { try { localStorage.setItem(PIN_KEY, JSON.stringify(r)); return true } catch { return false } }
export const hasPin = () => readPin() !== null
export const validPin = (p: unknown): p is string => typeof p === 'string' && /^\d{4}$/.test(p)

async function derive(pin: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const sub = typeof crypto !== 'undefined' ? crypto.subtle : undefined
  if (!sub) throw new Error('crypto')
  const k = await sub.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await sub.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, k, 256))
}
/** Comparaison sans sortie anticipée. */
const same = (a: Uint8Array, b: Uint8Array) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a[i] ?? 0) ^ (b[i] ?? 0); return d === 0 }

/** Définit (ou remplace) le PIN ; renvoie false si le chiffrement du navigateur ou le stockage est indisponible. */
export async function setPin(pin: string, auto: number, iter = ITER): Promise<boolean> {
  if (!validPin(pin) || !AUTO.includes(auto)) return false
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    return writePin({ s: b64(salt), h: b64(await derive(pin, salt, iter)), i: iter, f: 0, u: 0, a: auto })
  } catch { return false }
}
export function setAuto(auto: number): boolean {
  const r = readPin()
  return !!r && AUTO.includes(auto) && writePin({ ...r, a: auto })
}
export function removePin() { try { localStorage.removeItem(PIN_KEY) } catch { /* ignoré */ } }
/** Durée de blocage (ms) après le n-ième échec. */
export const lockMs = (fails: number) => (fails < FREE ? 0 : Math.min(900, 30 * 2 ** (fails - FREE)) * 1000)
/** Millisecondes restantes avant la fin du blocage (0 si aucun). */
export const waitMs = (now = Date.now()) => Math.max(0, (readPin()?.u ?? 0) - now)

/**
 * Vérifie un PIN. Le compteur d'échecs est enregistré AVANT la vérification (fermer la page en cours de calcul
 * ne remet rien à zéro). Pendant un blocage, aucun essai n'est examiné, même avec le bon PIN.
 */
export async function verifyPin(pin: string): Promise<{ ok: boolean; wait: number; left: number }> {
  const r = readPin()
  if (!r) return { ok: true, wait: 0, left: FREE }
  const now = Date.now()
  if (r.u > now) return { ok: false, wait: r.u - now, left: 0 }
  const f = r.f + 1
  if (!writePin({ ...r, f })) return { ok: false, wait: 0, left: 0 } // stockage indisponible : pas d'essai non comptabilisé
  let good = false
  try { good = validPin(pin) && same(await derive(pin, unb64(r.s), r.i), unb64(r.h)) } catch { good = false }
  if (good) { writePin({ ...r, f: 0, u: 0 }); return { ok: true, wait: 0, left: FREE } }
  const wait = lockMs(f)
  writePin({ ...r, f, u: wait ? Date.now() + wait : 0 })
  return { ok: false, wait, left: Math.max(0, FREE - f) }
}
