import type { Cycle } from './lib'
import { isDay } from './schema'

/**
 * Suivi facultatif de la rubrique 8 : cycle et énergie, ou récupération, force et vitalité. Calculs purs : aucun accès au stockage ni à l'horloge (le jour est passé en argument).
 * Les deux suivis ont chacun leurs notes dans `Cycle` (`en` pour l'énergie du cycle, `rec` pour la récupération) : changer de suivi n'en efface ni n'en confond aucune.
 * Les phases du cycle et la date des prochaines règles ne sont que des repères moyens tirés des dates saisies : ni diagnostic, ni contraception, ni aide à la fertilité.
 */
export type Notes = [number, number, number]

const MS = 864e5
/** Minuit UTC d'un jour « AAAA-MM-JJ » : les écarts en jours ne dépendent ni du fuseau horaire ni du changement d'heure. */
const T = (d: string) => { const [y, m, j] = d.split('-').map(Number); return Date.UTC(y, m - 1, j) }
/** Nombre de jours entre deux dates (b − a). */
export const diffDays = (a: string, b: string) => Math.round((T(b) - T(a)) / MS)
export const addDays = (d: string, n: number) => new Date(T(d) + n * MS).toISOString().slice(0, 10)
/** Les `n` derniers jours se terminant à `day` (compris), du plus ancien au plus récent. */
export const lastDays = (day: string, n: number) => Array.from({ length: n }, (_, i) => addDays(day, i - n + 1))
/** Moyenne arrondie au dixième ; null s'il n'y a aucune valeur. */
export const avg = (xs: number[]) => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : null)
/** Nombre écrit à la française (virgule décimale). */
export const fr1 = (n: number) => String(n).replace('.', ',')
/** « 22 octobre 2026 » ; avec `wd`, « jeudi 22 octobre ». Calculé en UTC sur la date seule : le fuseau horaire de l'appareil ne peut pas décaler le jour affiché. */
export const frDate = (d: string, wd = false) => new Date(T(d)).toLocaleDateString('fr-FR', wd ? { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' } : { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })

/** Durées de cycle plausibles : en dehors de 15 à 60 jours, l'écart entre deux débuts n'est pas un cycle (oubli de saisie, grossesse, arrêt…) et n'entre pas dans la moyenne. */
export const MIN_CYCLE = 15, MAX_CYCLE = 60
/** Un début de règles plus ancien que cela (environ cinq ans) est presque sûrement une faute de frappe sur l'année. */
export const MAX_AGE = 1826
const DEFAULT_CYCLE = 28, RECENT = 6

export type Phase = 'regles' | 'folliculaire' | 'ovulation' | 'luteale' | 'hors'
export const PHASE_LABEL: Record<Phase, string> = {
  regles: 'Règles', folliculaire: 'Phase folliculaire', ovulation: 'Fenêtre d’ovulation probable', luteale: 'Phase lutéale', hors: 'Au-delà de la durée habituelle du cycle'
}
export interface CycleInfo {
  /** Dernier début des règles (au plus égal au jour demandé), ou null. */
  last: string | null
  /** Jour du cycle (1 le premier jour des règles) ; null sans début enregistré ou si le dernier début remonte à plus de 60 jours. */
  n: number | null
  /** Durée de cycle utilisée (jours) et nombre d'écarts mesurés pour la calculer (0 : valeur par défaut de 28 jours, faute de données). */
  len: number
  measured: number
  phase: Phase | null
  /** Début estimé des prochaines règles et nombre de jours restants (négatif : date estimée dépassée). */
  next: string | null
  inDays: number | null
}
/** Estimations à partir des seules dates saisies : la durée est la moyenne des 6 derniers écarts plausibles (28 jours sans donnée), l'ovulation est placée 14 jours avant les règles suivantes. */
export function cycleInfo(starts: string[], day: string): CycleInfo {
  const st = [...new Set(starts)].filter(d => d <= day).sort()
  const gaps = st.slice(1).map((d, i) => diffDays(st[i], d)).filter(g => g >= MIN_CYCLE && g <= MAX_CYCLE).slice(-RECENT)
  const len = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : DEFAULT_CYCLE
  const last = st.length ? st[st.length - 1] : null
  const raw = last ? diffDays(last, day) + 1 : null
  const n = raw !== null && raw <= MAX_CYCLE ? raw : null
  let phase: Phase | null = null
  if (n !== null) {
    const ov = len - 14
    phase = n <= 5 ? 'regles' : Math.abs(n - ov) <= 1 ? 'ovulation' : n < ov - 1 ? 'folliculaire' : n <= len ? 'luteale' : 'hors'
  }
  const next = last && n !== null ? addDays(last, len) : null
  return { last, n, len, measured: gaps.length, phase, next, inDays: next ? diffDays(day, next) : null }
}

/** Ajoute un début de règles (jour réel, pas dans le futur, pas déjà noté) : renvoie la liste triée, ou un message d'erreur. L'écart avec les débuts voisins est signalé s'il est inhabituel. */
export function addStart(starts: string[], d: string, day: string): { ok: true; starts: string[]; gap: number | null; odd: boolean } | { ok: false; err: string } {
  if (!isDay(d)) return { ok: false, err: 'Choisissez une date valide.' }
  if (d > day) return { ok: false, err: 'Le début des règles ne peut pas être dans le futur.' }
  if (diffDays(d, day) > MAX_AGE) return { ok: false, err: 'Cette date remonte à plus de cinq ans : vérifiez l’année.' }
  if (starts.includes(d)) return { ok: false, err: 'Cette date est déjà enregistrée.' }
  if (starts.length >= 400) return { ok: false, err: 'Limite de 400 dates atteinte : retirez-en avant d’en ajouter.' }
  const all = [...starts, d].sort(), i = all.indexOf(d), prev = i > 0 ? all[i - 1] : null, next = i < all.length - 1 ? all[i + 1] : null
  const gaps = [prev ? diffDays(prev, d) : null, next ? diffDays(d, next) : null].filter((g): g is number => g !== null)
  return { ok: true, starts: all, gap: prev ? diffDays(prev, d) : null, odd: gaps.some(g => g < MIN_CYCLE || g > MAX_CYCLE) }
}

/** Énergie notée chaque jour des `n` derniers jours (null : pas de note). */
export const energySeries = (c: Cycle, day: string, n = 28) => lastDays(day, n).map(d => ({ d, v: c.en[d] ?? null }))
/** Les trois notes de chacun des `n` derniers jours (null : journée non renseignée). */
export const recupSeries = (c: Cycle, day: string, n = 14) => lastDays(day, n).map(d => ({ d, v: c.rec[d] ?? null }))

/** Énergie moyenne par phase du cycle, d'après les notes saisies ; une phase n'est donnée qu'à partir de 3 notes (sinon ce ne serait qu'un hasard). */
export function energyByPhase(c: Cycle, day: string) {
  const by: Partial<Record<Phase, number[]>> = {}
  for (const d of Object.keys(c.en)) {
    if (d > day) continue
    const p = cycleInfo(c.starts, d).phase
    if (p) (by[p] ??= []).push(c.en[d])
  }
  return (Object.keys(PHASE_LABEL) as Phase[]).filter(p => (by[p]?.length ?? 0) >= 3).map(p => ({ phase: p, avg: avg(by[p]!)!, n: by[p]!.length }))
}

const low3 = (c: Cycle, day: string) => recupSeries(c, day, 3).every(x => x.v !== null && x.v[0] <= 2)
/** Récupération basse : trois jours de suite notés, avec une récupération de 2 ou moins chaque fois. Tant que le jour demandé n'est pas noté, la série qui se terminait la veille compte encore (on note souvent le soir). */
export const lowRecovery = (c: Cycle, day: string) => low3(c, day) || (c.rec[day] === undefined && low3(c, addDays(day, -1)))
/** Moyennes (récupération, force, vitalité) des jours notés parmi les `n` derniers ; null sans note. */
export function recupAverages(c: Cycle, day: string, n = 7) {
  const vs = recupSeries(c, day, n).flatMap(x => (x.v ? [x.v] : []))
  return vs.length ? { n: vs.length, rec: avg(vs.map(v => v[0]))!, force: avg(vs.map(v => v[1]))!, vit: avg(vs.map(v => v[2]))! } : null
}
