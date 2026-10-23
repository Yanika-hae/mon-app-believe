import { NOTE_CATS } from './data'
import type { ShareKey } from './data'
import type { State } from './lib'
import { gauge, today } from './lib'
import * as V from './schema'
import { earnedBadges } from './badges'
import { bilanOf, streakAt } from './bilan'
import { cycleInfo } from './suivi'

/**
 * Partage avec des amis : UNE seule fonction (`buildShare`) décide de ce qui peut sortir de l'appareil. La carte image, l'aperçu « Vue Ami », le texte
 * et toute copie envoyée à un serveur sont fabriqués à partir de ce seul objet : une catégorie masquée n'y figure tout simplement pas (clé absente,
 * pas une valeur vide). Rien n'est lu dans l'état en dehors de ce fichier pour le partage.
 */
export interface ShareItem { k: ShareKey; t: string; d: string; sens: boolean }
/** Catégories partageables, dans l'ordre d'affichage. Tout est masqué par défaut ; les catégories sensibles demandent en plus une confirmation. */
export const SHARE_ITEMS: ShareItem[] = [
  { k: 'name', t: 'Mon prénom', d: 'Le prénom de votre profil.', sens: false },
  { k: 'habits', t: 'Mes habitudes', d: 'Taux de réussite de la semaine (%) et plus longue série en cours. Le nom de vos habitudes n’est jamais partagé.', sens: false },
  { k: 'badges', t: 'Mes badges', d: 'L’intitulé des badges que vous avez obtenus.', sens: false },
  { k: 'steps', t: 'Mes pas et ma distance', d: 'Nombre de jours à 10 000 pas cette semaine et distance totale de vos séances, sans carte ni tracé.', sens: false },
  { k: 'quiz', t: 'Mes scores de quiz', d: 'Nombre de quiz terminés, moyenne et dernier score.', sens: false },
  { k: 'books', t: 'Mes lectures en cours', d: 'Titre et auteur des livres marqués « En cours » (cinq au plus).', sens: false },
  { k: 'weight', t: 'Mon poids (départ, actuel, objectif)', d: 'Les trois poids en kilogrammes.', sens: true },
  { k: 'weightPct', t: 'Ma progression vers mon objectif de poids', d: 'Un pourcentage seul, sans aucun poids.', sens: true },
  { k: 'cycle', t: 'Mon suivi cycle ou récupération', d: 'Le jour du cycle et l’énergie du jour, ou la récupération, la force et la vitalité du jour (seulement si le suivi est activé).', sens: true },
  { k: 'food', t: 'Mes calories et repas du jour', d: 'Le total de kilocalories du jour et le nom des repas enregistrés aujourd’hui.', sens: true },
  { k: 'prayers', t: 'Mes sujets de prière', d: 'L’intitulé des sujets de prière (huit au plus) et ceux déjà exaucés. Vos gratitudes ne sont jamais partagées.', sens: true },
  { k: 'notes', t: 'Mes notes', d: 'Le nombre de notes par catégorie (rêves, cauchemars, chants, poèmes…). Le texte et les titres ne sont jamais partagés.', sens: true }
]
/** Ce qui ne peut jamais être partagé, quel que soit le réglage (affiché tel quel dans l'application). */
export const NEVER_SHARED = [
  'Le tracé GPS : Believe ne l’enregistre pas (seules la durée, la distance, l’allure et le dénivelé d’une séance sont gardés).',
  'Le texte et les titres de vos notes, vos enregistrements audio, vos photos, vos échanges avec l’IA, votre code PIN et le détail de vos pesées.',
  'Vos gratitudes : le mur de prières les garde sur l’appareil, quels que soient vos réglages de partage.',
  'Le nom de vos habitudes, qui peut être personnel.'
]
export const isSens = (k: ShareKey) => SHARE_ITEMS.find(i => i.k === k)?.sens ?? true

export interface SharePayload {
  v: 1
  /** Jour de la carte (AAAA-MM-JJ). */
  d: string
  who?: string
  habits?: { rate: number; best: number }
  badges?: string[]
  steps?: { days: number; km: number }
  quiz?: { n: number; avg: number; last: number | null }
  books?: { t: string; a: string }[]
  weight?: { from: number; now: number; goal: number }
  weightPct?: number
  cycle?: { kind: 'cycle' | 'recup'; txt: string }
  food?: { kcal: number; meals: string[] }
  prayers?: { t: string; ok: boolean }[]
  notes?: { cat: string; n: number }[]
}

const cut = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')
const D = (d: string) => new Date(d + 'T00:00:00')
const r1 = (n: number) => Math.round(10 * n) / 10

/** Suivi cycle ou récupération du jour (mêmes calculs que la page de saisie). Mode cycle : jour du cycle et énergie du jour (`en`) ; mode récupération : récupération, force et vitalité du jour (`rec`). Suivi désactivé : rien. */
export function cycleLine(s: State, day: string): { kind: 'cycle' | 'recup'; txt: string } | null {
  const c = s.cycle
  if (c.mode === 'cycle') {
    const n = cycleInfo(c.starts, day).n, e = c.en[day]
    return n !== null ? { kind: 'cycle', txt: 'Jour ' + n + ' du cycle' + (e ? ' · énergie ' + e + ' sur 5' : '') } : null
  }
  const r = c.rec[day]
  if (c.mode === 'recup' && r) return { kind: 'recup', txt: 'Récupération ' + r[0] + ' sur 5 · force ' + r[1] + ' sur 5 · vitalité ' + r[2] + ' sur 5' }
  return null
}

/**
 * Ce que les amis pourront voir : seulement les catégories cochées (`share.vis`), et seulement si l'accord « Partage » est donné (sinon `null`).
 * Une catégorie cochée sans donnée (aucun livre en cours, suivi non activé…) est simplement absente.
 */
export function buildShare(s: State, day: string = today()): SharePayload | null {
  if (!s.consents.share) return null
  const on = (k: ShareKey) => s.share.vis[k] === true
  const p: SharePayload = { v: 1, d: day }, w = bilanOf(s, day), pr = s.profile
  if (on('name') && pr && cut(pr.name, 40)) p.who = cut(pr.name, 40)
  if (on('habits') && s.habits.length) p.habits = { rate: w.rate, best: Math.max(0, ...s.habits.map(h => streakAt(s, h.id, day))) }
  if (on('badges')) { const b = earnedBadges(s).map(x => x.t); if (b.length) p.badges = b }
  if (on('steps')) p.steps = { days: w.steps10k, km: w.km }
  if (on('quiz')) {
    const h = s.quiz.hist.filter(q => !q.rev && q.n > 0), t = h.reduce((a, q) => a + q.n, 0)
    if (h.length && t > 0) p.quiz = { n: h.length, avg: Math.round(100 * h.reduce((a, q) => a + q.ok, 0) / t), last: Math.round(100 * h[h.length - 1].ok / h[h.length - 1].n) }
  }
  if (on('books')) { const b = s.books.filter(x => x.st === 'cours').map(x => ({ t: cut(x.t, 80), a: cut(x.a, 60) })).filter(x => x.t).slice(0, 5); if (b.length) p.books = b }
  if (on('weight') && pr) p.weight = { from: r1(pr.ws), now: r1(pr.w), goal: r1(pr.t) }
  if (on('weightPct')) { const g = gauge(pr); if (g !== null) p.weightPct = g }
  if (on('cycle')) { const c = cycleLine(s, day); if (c) p.cycle = c }
  if (on('food')) {
    const m = s.meals.filter(x => x.d === day)
    if (m.length) p.food = { kcal: Math.round(m.reduce((a, x) => a + x.kcal, 0)), meals: m.map(x => cut(x.n, 40)).filter(Boolean).slice(0, 6) }
  }
  if (on('prayers')) { const q = s.prayers.filter(x => x.k !== 'g').map(x => ({ t: cut(x.t, 80), ok: x.a !== null })).filter(x => x.t).slice(-8).reverse(); if (q.length) p.prayers = q }
  if (on('notes')) { const n = NOTE_CATS.map(c => ({ cat: c as string, n: s.notes.filter(x => x.cat === c).length })).filter(x => x.n > 0); if (n.length) p.notes = n }
  return p
}

/** Vérification en liste blanche d'une carte avant toute génération, copie ou envoi : une clé ou un type inattendu la fait refuser. */
const t80 = V.str(80, 1), pct = V.int(0, 100)
const shape: Record<string, V.V> = {
  v: V.lit(1), d: V.day, who: V.opt(V.str(40, 1)),
  habits: V.opt(V.strict({ rate: pct, best: V.int(0, 3650) })),
  badges: V.opt(V.arr(V.str(60, 1), 20)),
  steps: V.opt(V.strict({ days: V.int(0, 7), km: V.num(0, 2000) })),
  quiz: V.opt(V.strict({ n: V.int(1, 100000), avg: pct, last: V.nul(pct) })),
  books: V.opt(V.arr(V.strict({ t: t80, a: V.str(60) }), 5)),
  weight: V.opt(V.strict({ from: V.num(20, 400), now: V.num(20, 400), goal: V.num(20, 400) })),
  weightPct: V.opt(pct),
  cycle: V.opt(V.strict({ kind: V.lit('cycle', 'recup'), txt: V.str(120, 1) })),
  food: V.opt(V.strict({ kcal: V.int(0, 20000), meals: V.arr(V.str(40, 1), 6) })),
  prayers: V.opt(V.arr(V.strict({ t: t80, ok: V.bool }), 8)),
  notes: V.opt(V.arr(V.strict({ cat: V.lit(...NOTE_CATS), n: V.int(1, 100000) }), NOTE_CATS.length))
}
const payloadSchema = V.strict(shape)
export const whyBad = (p: unknown): string | null => payloadSchema(p, 'carte')
export const hasContent = (p: SharePayload | null): p is SharePayload => !!p && Object.keys(p).some(k => k !== 'v' && k !== 'd')

// ---------------------------------------------------------------- texte : lignes communes à l'aperçu, au texte et à l'image
export interface Row { k: ShareKey; h: string; l: string[]; sens: boolean }
const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
const pl = (n: number, a: string, b: string) => n + ' ' + (n > 1 ? b : a)
export const dateFr = (d: string) => { const x = D(d); return isNaN(+x) ? d : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }
export const titleOf = (p: SharePayload) => (p.who ? 'Suivi de ' + p.who : 'Mon suivi Believe')

/** Les lignes à afficher, dans l'ordre du sélecteur. L'aperçu « Vue Ami », le texte et l'image n'utilisent QUE cette liste. */
export function rowsOf(p: SharePayload): Row[] {
  const r: Row[] = [], add = (k: ShareKey, h: string, l: string[]) => r.push({ k, h, l, sens: isSens(k) })
  if (p.habits) add('habits', 'Habitudes de la semaine', ['Réussite : ' + p.habits.rate + ' %', p.habits.best > 0 ? 'Plus longue série en cours : ' + pl(p.habits.best, 'jour', 'jours') : 'Aucune série en cours'])
  if (p.badges) add('badges', 'Badges', p.badges)
  if (p.steps) add('steps', 'Pas et distance', ['10 000 pas atteints : ' + pl(p.steps.days, 'jour', 'jours') + ' cette semaine', 'Distance des séances : ' + fr(p.steps.km) + ' km cette semaine'])
  if (p.quiz) add('quiz', 'Quiz d’éloquence', [pl(p.quiz.n, 'quiz terminé', 'quiz terminés') + ' · moyenne ' + p.quiz.avg + ' %'].concat(p.quiz.last !== null ? ['Dernier score : ' + p.quiz.last + ' %'] : []))
  if (p.books) add('books', 'Lectures en cours', p.books.map(b => '« ' + b.t + ' »' + (b.a ? ', ' + b.a : '')))
  if (p.weight) add('weight', 'Poids', ['Départ ' + fr(p.weight.from) + ' kg · actuel ' + fr(p.weight.now) + ' kg · objectif ' + fr(p.weight.goal) + ' kg'])
  if (p.weightPct !== undefined) add('weightPct', 'Objectif de poids', [p.weightPct + ' % du chemin parcouru'])
  if (p.cycle) add('cycle', p.cycle.kind === 'cycle' ? 'Cycle' : 'Récupération', [p.cycle.txt])
  if (p.food) add('food', 'Repas du jour', [p.food.kcal + ' kcal'].concat(p.food.meals))
  if (p.prayers) add('prayers', 'Sujets de prière', p.prayers.map(x => (x.ok ? '✓ ' : '• ') + x.t + (x.ok ? ' (exaucé)' : '')))
  if (p.notes) add('notes', 'Mes notes', p.notes.map(x => x.cat + ' : ' + x.n))
  return r
}
/** Le texte partagé : mêmes lignes que l'aperçu et l'image. */
export const shareText = (p: SharePayload): string =>
  [titleOf(p) + ' · ' + dateFr(p.d), ''].concat(rowsOf(p).flatMap(x => [x.h].concat(x.l.map(l => '– ' + l), ''))).concat(['Carte créée sur mon appareil avec Believe : seuls les éléments que j’ai choisis y figurent.']).join('\n')
/** Catégories cochées mais sans rien à partager (aucune donnée) : l'aperçu le dit au lieu de les faire croire partagées. */
export const payloadKey = (k: ShareKey): keyof SharePayload => (k === 'name' ? 'who' : k)
export const emptyKeys = (s: State, p: SharePayload | null): ShareKey[] => SHARE_ITEMS.filter(i => s.share.vis[i.k] === true && !(p && payloadKey(i.k) in p)).map(i => i.k)
