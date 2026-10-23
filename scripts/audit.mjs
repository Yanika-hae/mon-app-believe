// Audit automatisé : calculs, persistance, import, logique serveur IA (fetch simulé). Lancer : npm run audit
import { build } from 'esbuild'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import 'fake-indexeddb/auto'

const out = mkdtempSync(join(tmpdir(), 'believe-'))
await build({ bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', outdir: out, entryPoints: { lib: 'src/lib.ts', geo: 'src/geo.ts', cli: 'src/ai.ts', api: 'api/ai.ts', health: 'src/health.ts', cal: 'src/cal.ts', yt: 'api/yt.ts', media: 'src/media.ts', pin: 'src/pin.ts', util: 'src/util.ts', idb: 'src/idb.ts', metro: 'src/metro.ts', rec: 'src/rec.ts', ext: 'api/ext.ts', cext: 'src/ext.ts', books: 'src/books.ts', reading: 'src/reading.ts', quizbank: 'src/quizbank.ts', quiz: 'src/quiz.ts', exo: 'src/exo.ts', impro: 'src/impro.ts', exobank: 'src/exobank.ts', share: 'src/share.ts', badges: 'src/badges.ts', bilan: 'src/bilan.ts', shareimg: 'src/shareimg.ts', suivi: 'src/suivi.ts', img: 'api/img.ts', remind: 'src/remind.ts', dictation: 'src/dictation.ts' } })
const req = createRequire(import.meta.url)
const L = req(join(out, 'lib.js')), G = req(join(out, 'geo.js')), C = req(join(out, 'cli.js')), api = req(join(out, 'api.js')).default, H = req(join(out, 'health.js')), K = req(join(out, 'cal.js')), Y = req(join(out, 'yt.js')).default, M = req(join(out, 'media.js')), Pn = req(join(out, 'pin.js')), U = req(join(out, 'util.js')), I = req(join(out, 'idb.js')), Mt = req(join(out, 'metro.js')), Rc = req(join(out, 'rec.js')), B = req(join(out, 'books.js')), Rd = req(join(out, 'reading.js')), Qb = req(join(out, 'quizbank.js')), Qz = req(join(out, 'quiz.js')), Ex = req(join(out, 'exo.js')), Im = req(join(out, 'impro.js')), Eb = req(join(out, 'exobank.js')), Sh = req(join(out, 'share.js')), Bd = req(join(out, 'badges.js')), Bl = req(join(out, 'bilan.js')), Si = req(join(out, 'shareimg.js')), Sv = req(join(out, 'suivi.js')), Img = req(join(out, 'img.js')).default, Rm = req(join(out, 'remind.js')), Dc = req(join(out, 'dictation.js'))

const mem = new Map()
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => void mem.set(k, String(v)), removeItem: k => void mem.delete(k), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size } }
let logs = 0
for (const k of ['log', 'info', 'warn', 'error']) console[k] = () => { logs++ }

const rows = []
const T = async (n, f) => { try { await f(); rows.push(['OK', n]) } catch (e) { rows.push(['ÉCHEC', n + ' : ' + e.message]) } }
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)) }
const yes = (c, m = 'condition fausse') => { if (!c) throw new Error(m) }
const seven = d => [...Array(7)].map((_, i) => L.iso(L.addD(d, i)))

// Calculs
await T('ISO 1er janv. 2026 = 2026-S1', () => eq(L.isoWk(new Date(2026, 0, 1)), [2026, 1]))
await T('ISO 30 déc. 2024 = 2025-S1', () => eq(L.isoWk(new Date(2024, 11, 30)), [2025, 1]))
await T('ISO 1er janv. 2027 = 2026-S53 (nouvel an)', () => eq(L.isoWk(new Date(2027, 0, 1)), [2026, 53]))
await T('Lundi du dimanche 29 mars 2026 (changement d’heure) = 23 mars', () => eq(L.iso(L.monday(new Date(2026, 2, 29))), '2026-03-23'))
await T('7 jours consécutifs sur la semaine du changement d’heure (mars et octobre)', () => { eq(seven(new Date(2026, 2, 23)).slice(-1), ['2026-03-29']); eq(seven(new Date(2026, 9, 19)).slice(-1), ['2026-10-25']); yes(new Set(seven(new Date(2026, 9, 19))).size === 7) })
await T('Haversine Paris-Lyon ≈ 391 km', () => { const d = G.haversine({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 }); yes(d > 389000 && d < 394000, String(d)) })
await T('Haversine même point = 0', () => eq(G.haversine({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0))
await T('Allure 5:00 (et pas 4:60), 0 km = tiret', () => { eq(G.pace(300, 1), '5:00'); eq(G.pace(299.6, 1), '5:00'); eq(G.pace(0, 0), '—') })
await T('Chrono 1:05 et 1:02:05', () => { eq(G.clock(65), '1:05'); eq(G.clock(3725), '1:02:05') })
await T('Calories estimées : course 10 km/h 70 kg = 700, marche 1 h = 266', () => { eq(G.kcal('Course', 70, 10, 3600), 700); eq(G.kcal('Marche', 70, 5, 3600), 266) })
await T('GPS : point imprécis et saut rejetés, point normal accepté', () => {
  const a = { lat: 48, lng: 2, alt: null, t: 0, acc: 5 }
  yes(!G.accept(a, { ...a, acc: 50, t: 10000 }), 'imprécis accepté'); yes(!G.accept(a, { ...a, lat: 48.009, t: 10000 }), 'saut accepté'); yes(G.accept(a, { ...a, lat: 48.0003, t: 10000 }), 'normal rejeté')
})
await T('Archivage : jamais écrasé, 4 validations = 7 %', () => {
  const s = L.DEF(); s.checks['2026-01-05'] = ['h1', 'h2']; s.checks['2026-01-06'] = ['h1', 'h2']
  L.archive(s, new Date(2026, 0, 5)); L.archive(s, new Date(2026, 0, 5)); eq(s.archives.length, 1); eq([s.archives[0].n, s.archives[0].rate, s.archives[0].per['10 000 pas']], [4, 7, 2])
})
await T('Changement de semaine : 3 semaines archivées, idempotent', () => {
  const s = L.DEF(); s.weekStart = L.iso(L.addD(L.monday(new Date()), -21)); L.roll(s); eq(s.archives.length, 3); eq(s.weekStart, L.iso(L.monday(new Date()))); L.roll(s); eq(s.archives.length, 3)
})
await T('Série et taux du jour', () => {
  const s = L.DEF(), d = n => L.iso(L.addD(new Date(), -n)); s.checks[d(1)] = ['h1']; s.checks[d(2)] = ['h1']; eq(L.streak(s, 'h1'), 2)
  s.checks[d(0)] = ['h1', 'h2', 'h3', 'h4', 'zzz']; eq(L.dayPct(s, d(0)), 50)
})
await T('Jauge de poids 71→60 à 65,5 = 50 %, objectif de prise = null', () => { eq(L.gauge({ ws: 71, w: 65.5, t: 60 }), 50); eq(L.gauge({ ws: 60, w: 62, t: 70 }), null) })
await T('Versets adaptés au profil', () => { const s = L.DEF(); s.profile = { g: 'M' }; yes(L.VM.some(v => v === L.curVerse(s))); s.profile = { g: 'F' }; yes(L.VF.some(v => v === L.curVerse(s))) })

// Données, persistance, import
const good = () => { const s = L.DEF(); s.profile = { g: 'F', name: 'Ada', age: 30, h: 170, w: 65, t: 60, ws: 71, lv: 'I', sx: 'F' }; return s }
await T('Import : état par défaut accepté', () => yes(L.valid(L.DEF())))
await T('Import : version 3 et catégorie inconnue rejetées', () => { yes(!L.valid({ ...L.DEF(), v: 3 })); yes(L.valid({ ...L.DEF(), v: 2 })); const s = L.DEF(); s.habits[0].c = 'X'; yes(!L.valid(s)) })
await T('Import : archives malformées rejetées', () => { const s = L.DEF(); s.archives = [{ start: '2026-01-05' }]; yes(!L.valid(s), 'archives sans per/rate acceptées') })
await T('Import : workouts / steps / profil malformés rejetés', () => { let s = L.DEF(); s.workouts = 'x'; yes(!L.valid(s), 'workouts texte accepté'); s = L.DEF(); s.steps = []; yes(!L.valid(s), 'steps tableau accepté'); s = good(); s.profile.w = 'abc'; yes(!L.valid(s), 'poids texte accepté') })
await T('Import : checks non tableaux rejetés', () => { const s = L.DEF(); s.checks = { '2026-01-05': 'h1' }; yes(!L.valid(s), 'checks texte accepté') })
await T('Persistance : enregistrer puis recharger', () => { yes(L.save(good())); eq(L.load().s.profile.name, 'Ada') })
await T('Persistance : JSON corrompu sans plantage, message affiché, copie brute conservée', () => { mem.clear(); mem.set('believe:v2', '{oops'); const r = L.load(); yes(r.err && r.s.habits.length === 8); eq(mem.get('believe:illisible'), '{oops') })
await T('Migration v2 : champs absents complétés par défaut (document partiel)', () => { mem.clear(); const o = L.DEF(); delete o.workouts; delete o.steps; delete o.notes; delete o.settings.sounds; mem.set('believe:v2', JSON.stringify(o)); const r = L.load(); eq([r.err, r.s.workouts, r.s.steps, r.s.notes, r.s.settings.sounds], [null, [], {}, [], true]) })
const STAMP = '2026-10-20T10:00:00.000Z'
const V1 = () => ({
  v: 1, profile: { g: 'F', name: 'Ada', age: 30, h: 170, w: 65, t: 60, ws: 71, lv: 'I', sx: 'F' }, habits: L.DEF().habits, checks: { '2026-10-19': ['h1', 'h2'], '2026-10-20': ['h1'] }, weekStart: '2026-10-19',
  archives: [{ week: '2026-S42', start: '2026-10-12', rate: 30, n: 17, per: { '10 000 pas': 3 } }], discret: true, verse: { d: '2026-10-20', i: 2 }, consents: { ai: true, photo: true },
  workouts: [{ d: '2026-10-20', act: 'Course', km: 5.2, sec: 1800, kcal: 520, gain: null }], steps: { '2026-10-20': 8000 }, weights: [{ d: '2026-10-20', kg: 65 }], water: { '2026-10-20': 750 }, sleep: { '2026-10-20': 7.5 },
  meals: [{ id: 'm1', d: '2026-10-20', n: 'Soupe', kcal: 250, p: 10, g: 30, l: 8, src: 'IA' }], tasks: [{ id: 't1', t: 'Rapport', imp: true, due: '2026-10-25T09:00', done: false, p: null }], pomos: { '2026-10-20': 2 }, playlist: [{ id: 'dQw4w9WgXcQ', t: 'Vidéo', k: 'danse' }]
})
const full = () => {
  const s = L.DEF(); Object.assign(s, V1(), { v: 2 })
  s.consents = { ai: true, photo: true, health: true, gps: true, motion: true, mic: true, speech: true, notif: true, share: true }
  s.notes = [{ id: 'n1', cat: 'Rêves', t: 'Titre', b: 'Texte', c: STAMP, u: STAMP }]; s.prayers = [{ id: 'p1', t: 'Merci', c: '2026-10-20', a: '2026-10-21' }]
  s.books = [{ id: 'b1', t: 'Livre', a: 'Auteur', src: 'ol', ref: 'OL1W', cover: 'https://covers.openlibrary.org/b/id/1-M.jpg', url: 'https://openlibrary.org/works/OL1W', total: 300, page: 12, st: 'cours' }]; s.pages = { '2026-10-20': 20 }
  s.prompter = { text: 'Bonjour', speed: 40, size: 32, bpm: 90, beats: 4 }; s.quiz = { seen: ['q1'], hashes: ['abc'], hist: [{ d: '2026-10-20', n: 5, ok: 4, cats: ['Biblique'] }], cur: { d: '2026-10-20', ids: ['q2'], ans: { q2: 1 }, rev: true }, gen: [{ id: 'g1', c: 'Biblique', q: 'Qui a construit l’arche ?', o: ['Noé', 'Moïse', 'Élie', 'Aaron'], a: 0, e: 'Genèse 6.' }] }
  s.exo = { seen: ['e1'], cur: { d: '2026-10-20', ids: ['e2'] }, done: { '2026-10-20': ['e1'] } }; s.impro = { seen: ['i1'], hist: [{ d: '2026-10-20', id: 'i1', diff: 3, sec: 60 }], cur: 'i1' }
  s.cycle = { mode: 'cycle', starts: ['2026-10-01'], rec: { '2026-10-20': [3, 2, 4] }, en: { '2026-10-20': 3 } }; s.share = { vis: { habits: true, weightPct: false } }
  s.settings = { theme: 'oled', motion: 'reduced', haptics: false, sounds: false, remind: 60 }; s.ui = { onboard: true, verseDay: '2026-10-20', covers: true }; s.tasks[0].r = '2026-10-25T09:00'
  return s
}
await T('Migration : réglages anciens sans délai de rappel = 30 minutes, tâches anciennes sans marque de rappel acceptées', () => {
  mem.clear(); const o = L.DEF(); delete o.settings.remind; o.tasks = [{ id: 't1', t: 'Rapport', imp: true, due: '2026-10-25T09:00', done: false, p: null }]; mem.set('believe:v2', JSON.stringify(o))
  const r = L.load(); eq([r.err, r.s.settings.remind, r.s.tasks[0].r], [null, 30, undefined]); eq(L.DEF().settings.remind, 30)
})
await T('Migration v1→v2 : données conservées, nouveaux champs par défaut, accueil guidé ignoré, ancienne clé retirée à l’enregistrement', () => {
  mem.clear(); const v1 = V1(); mem.set('believe:v1', JSON.stringify(v1))
  const r = L.load(), s = r.s
  eq([r.err, r.migrated, s.v], [null, true, 2])
  for (const k of Object.keys(v1)) if (!['v', 'consents'].includes(k)) eq(s[k], v1[k])
  eq([s.consents.ai, s.consents.photo, s.consents.gps, s.consents.health, s.consents.mic, s.consents.share], [true, true, false, false, false, false])
  eq([s.ui.onboard, s.notes, s.prayers, s.books, s.settings.theme, s.cycle.mode], [true, [], [], [], 'auto', 'off'])
  yes(L.save(s)); yes(mem.has('believe:v2') && !mem.has('believe:v1'), 'ancienne clé non retirée'); eq(L.load().s, s)
})
await T('Migration v1 : consentement photo absent (ancienne version) = refusé, état sans champ optionnel accepté', () => {
  mem.clear(); const v1 = V1(); v1.consents = { ai: true }; delete v1.workouts; delete v1.playlist; v1.profile.lv = undefined; mem.set('believe:v1', JSON.stringify(v1))
  const r = L.load(); eq([r.err, r.s.consents.photo, r.s.workouts, r.s.playlist], [null, false, [], []])
})
await T('Migration : clés inconnues et __proto__ ignorées, prototype intact', () => {
  const o = JSON.parse('{"v":2,"evil":1,"__proto__":{"polluted":true}}'), r = L.convert(o)
  yes(r.s, r.err); yes(!('evil' in r.s)); yes(Object.getPrototypeOf(r.s) === Object.prototype); yes({}.polluted === undefined && r.s.polluted === undefined)
})
await T('Schéma : état complet valide (aller-retour JSON), défauts valides', () => { eq(L.why(full()), null); eq(L.why(JSON.parse(JSON.stringify(full()))), null); eq(L.why(L.DEF()), null) })
await T('Schéma : erreurs nommées par chemin, liens piégés et hôtes étrangers refusés', () => {
  const why = f => { const s = full(); f(s); return L.why(s) }
  yes(/notes\[0\]\.cat/.test(why(s => { s.notes[0].cat = 'X' })), 'chemin de la note')
  yes(why(s => { s.books[0].cover = 'javascript:alert(1)' }), 'javascript: accepté'); yes(why(s => { s.books[0].url = 'https://evil.example/x' }), 'hôte étranger accepté')
  yes(why(s => { s.books[0].url = 'http://openlibrary.org/x' }), 'http accepté'); yes(why(s => { s.books[0].url = 'https://openlibrary.org.evil.example/x' }), 'hôte déguisé accepté'); yes(why(s => { s.books[0].url = 'https://user:pw@openlibrary.org/x' }), 'identifiants dans l’adresse acceptés')
  yes(why(s => { s.share.vis = { poids: true } }), 'clé de partage inconnue'); yes(why(s => { s.cycle.rec = { '2026-10-20': [1, 2] } }), 'triplet incomplet'); yes(why(s => { s.cycle.rec = { '2026-10-20': [1, 2, 9] } }), 'note 9')
  yes(why(s => { s.cycle.starts = ['2026-02-30'] }), 'jour qui n’existe pas'); yes(why(s => { s.cycle.starts = ['2026-13-01'] }), 'mois 13'); yes(why(s => { s.cycle.en = { '2026-10-20': 0 } }), 'énergie 0'); yes(why(s => { s.cycle.en = { '2026-10-20': 6 } }), 'énergie 6'); yes(why(s => { s.cycle.en = { '2026-10-20': 2.5 } }), 'énergie décimale'); yes(why(s => { s.cycle.en = { '2026-10-20': '3' } }), 'énergie texte'); yes(why(s => { s.cycle.en = { '20/10/2026': 3 } }), 'jour mal écrit (énergie)'); yes(why(s => { s.cycle.rec = { 'hier': [1, 2, 3] } }), 'jour mal écrit (récupération)'); yes(why(s => { delete s.cycle.en }), 'champ énergie absent')
  yes(why(s => { s.checks = JSON.parse('{"__proto__":["h1"]}') }), 'clé __proto__ acceptée'); yes(why(s => { s.prompter.bpm = 999 }), 'bpm 999'); yes(why(s => { s.quiz.cur.d = 'hier' }), 'date quiz'); yes(why(s => { s.settings.theme = 'rose' }), 'thème'); yes(why(s => { s.settings.remind = 15 }), 'délai de rappel de 15 min'); yes(why(s => { s.settings.remind = '30' }), 'délai de rappel en texte'); yes(why(s => { s.tasks[0].r = 5 }), 'rappel donné non textuel'); yes(why(s => { s.tasks[0].r = 'x'.repeat(41) }), 'rappel donné trop long'); eq(why(s => { delete s.tasks[0].r }), null)
  yes(why(s => { s.notes[0].b = 'x'.repeat(20001) }), 'note trop longue'); yes(why(s => { s.consents.gps = 'oui' }), 'consentement texte'); yes(why(s => { s.prayers[0].a = 'bientôt' }), 'date de prière')
  eq(why(s => { s.books[0].url = 'https://www.gutenberg.org/ebooks/1' }), null)
})
await T('Noms de modules distincts sans tenir compte de la casse ni de l’extension (macOS, Windows)', () => {
  for (const dir of ['src', 'api']) {
    const seen = new Map()
    for (const f of readdirSync(dir)) { if (f.includes('.test.') || f.endsWith('.css')) continue; const k = f.replace(/\.tsx?$/, '').toLowerCase(); if (seen.has(k)) throw new Error(dir + '/' + f + ' ≈ ' + seen.get(k)); seen.set(k, f) }
  }
})
await T('Droit à l’oubli (stockage local) : toutes les clés believe: effacées, celles des autres applications conservées', () => {
  mem.clear(); for (const k of ['believe:v2', 'believe:pin', 'believe:code', 'believe:illisible', 'autre:cle']) mem.set(k, 'x')
  yes(L.wipeLocal()); eq([...mem.keys()], ['autre:cle']); yes(L.wipeLocal(), 'rien à effacer = vérifié')
  mem.set('believe:v2', 'x'); const r = globalThis.localStorage.removeItem; globalThis.localStorage.removeItem = () => { throw new Error('verrouillé') }; const ok = L.wipeLocal(); globalThis.localStorage.removeItem = r; yes(ok === false, 'échec non détecté'); mem.clear()
})
await T('PIN : haché et salé (PBKDF2, 210 000 itérations), jamais en clair, sel et empreinte différents à chaque définition', async () => {
  mem.clear(); yes(await Pn.setPin('4821', 1)); const a = JSON.parse(mem.get('believe:pin'))
  eq([a.i, a.f, a.u, a.a, a.h.length, a.s.length], [210000, 0, 0, 1, 44, 24]); yes(Object.values(a).every(v => String(v) !== '4821'), 'PIN en clair')
  yes(await Pn.setPin('4821', 1)); const b = JSON.parse(mem.get('believe:pin')); yes(a.s !== b.s && a.h !== b.h, 'même sel ou même empreinte')
})
await T('PIN : bon PIN accepté, mauvais refusé, formats invalides refusés (lettres, longueur, chiffres pleine largeur)', async () => {
  mem.clear(); await Pn.setPin('4821', 1, 1000); eq([(await Pn.verifyPin('4821')).ok, (await Pn.verifyPin('4822')).ok], [true, false])
  for (const bad of ['12', '12345', 'abcd', '48 1', '', '１２３４']) yes(!Pn.validPin(bad), 'accepté : ' + bad)
  eq([await Pn.setPin('12a4', 1), await Pn.setPin('1234', 7), (await Pn.verifyPin('48210')).ok], [false, false, false])
})
await T('PIN : 5 erreurs = blocage 30 s, bon PIN refusé et non compté pendant le blocage, délais doublés (plafond 15 min), remise à zéro après succès', async () => {
  mem.clear(); await Pn.setPin('4821', 1, 1000)
  const realNow = Date.now; let t = 1_000_000_000_000; Date.now = () => t
  try {
    for (let i = 1; i <= 4; i++) { const r = await Pn.verifyPin('0000'); eq([r.ok, r.wait, r.left], [false, 0, 5 - i]) }
    let r = await Pn.verifyPin('0000'); eq([r.ok, r.wait], [false, 30000])
    r = await Pn.verifyPin('4821'); eq([r.ok, r.wait > 0], [false, true]); eq(JSON.parse(mem.get('believe:pin')).f, 5); yes(Pn.waitMs() > 0)
    const waits = []; for (let i = 0; i < 6; i++) { t += Pn.waitMs() + 1; waits.push((await Pn.verifyPin('0000')).wait) }
    eq(waits, [60000, 120000, 240000, 480000, 900000, 900000])
    t += Pn.waitMs() + 1; r = await Pn.verifyPin('4821'); eq([r.ok, JSON.parse(mem.get('believe:pin')).f, Pn.waitMs()], [true, 0, 0])
  } finally { Date.now = realNow }
})
await T('PIN : le compteur est écrit avant la vérification (fermer la page en plein calcul ne remet rien à zéro)', async () => {
  mem.clear(); await Pn.setPin('4821', 1, 1000); const p = Pn.verifyPin('0000'); eq(JSON.parse(mem.get('believe:pin')).f, 1); await p
})
await T('PIN : enregistrement corrompu ignoré (pas de verrouillage éternel), délai personnalisé, suppression', async () => {
  mem.clear(); mem.set('believe:pin', '{oops'); eq([Pn.hasPin(), Pn.readPin()], [false, null]); mem.set('believe:pin', JSON.stringify({ s: 'x', h: 'y', i: 1, f: 0, u: 0, a: 7 })); yes(!Pn.hasPin(), 'délai invalide accepté')
  await Pn.setPin('4821', 1, 1000); yes(Pn.setAuto(15)); eq(Pn.readPin().a, 15); yes(!Pn.setAuto(3)); Pn.removePin(); yes(!Pn.hasPin())
  eq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(Pn.lockMs), [0, 0, 0, 0, 0, 30000, 60000, 120000, 240000, 480000, 900000, 900000])
})
await T('IndexedDB v2 → v3 : une base existante est migrée sans perte (descriptions reconstruites, données intactes)', async () => {
  const old = await new Promise((res, rej) => {
    const r = indexedDB.open('BelieveAudioDB', 2)
    r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('audios', { keyPath: 'id' }); db.createObjectStore('dishes', { keyPath: 'id' }) }
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  await new Promise((res, rej) => { const tx = old.transaction('audios', 'readwrite'); tx.objectStore('audios').put({ id: 'old1', title: 'Ancien', cat: 'Chants', t: 5, ms: 900, type: 'audio/webm', data: new Uint8Array(40).buffer }); tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
  old.close()
  const l = await I.listAudios(); eq(l.map(a => [a.id, a.title, a.cat, a.size, 'data' in a]), [['old1', 'Ancien', 'Chants', 40, false]])
  eq((await I.getAudio('old1')).data.byteLength, 40)
})
await T('IndexedDB : un audio enregistré est relu intact (liste légère sans données, lecture à la demande), du plus récent au plus ancien', async () => {
  const buf = n => Uint8Array.from({ length: n }, (_, i) => i % 251).buffer
  await I.putAudio({ id: 'a1', title: 'Rêve du lundi', cat: 'Rêves', t: 1000, ms: 4200, type: 'audio/webm', data: buf(5000) })
  await I.putAudio({ id: 'a2', title: 'Chant', cat: 'Chants', t: 2000, ms: 1000, type: 'audio/mp4', data: buf(10) })
  const l = await I.listAudios(); eq(l.map(a => a.id), ['a2', 'a1', 'old1']); yes(l.every(a => !('data' in a)), 'données dans la liste')
  eq([l[1].title, l[1].type, l[1].size, l[1].ms], ['Rêve du lundi', 'audio/webm', 5000, 4200])
  const r = await I.getAudio('a1'); eq([r.data.byteLength, new Uint8Array(r.data)[250], new Uint8Array(r.data)[251]], [5000, 250, 0]); eq(await I.getAudio('absent'), undefined)
  eq(await I.countIDB(), { audios: 3, dishes: 0 })
})
await T('IndexedDB : renommer met à jour la liste ET l’enregistrement, un inconnu est refusé', async () => {
  yes(await I.renameAudio('a1', 'Rêve renommé')); eq((await I.listAudios()).find(a => a.id === 'a1').title, 'Rêve renommé'); eq((await I.getAudio('a1')).title, 'Rêve renommé'); eq((await I.getAudio('a1')).data.byteLength, 5000)
  eq(await I.renameAudio('inconnu', 'x'), false)
})
await T('IndexedDB : suppression réelle (vérifiée dans les deux magasins), un identifiant inconnu ne casse rien, les plats sont indépendants', async () => {
  yes(await I.delAudio('a1')); eq((await I.listAudios()).map(a => a.id), ['a2', 'old1']); eq(await I.getAudio('a1'), undefined); yes(await I.delAudio('inconnu'), 'suppression d’un inconnu = absent = confirmé')
  await I.putDish({ id: 'r1', t: 1, type: 'image/jpeg', data: new Uint8Array([1, 2, 3]).buffer }); eq((await I.getDish('r1')).data.byteLength, 3); eq(await I.countIDB(), { audios: 2, dishes: 1 })
  yes(await I.delDish('r1')); eq(await I.getDish('r1'), undefined)
})
await T('IndexedDB : droit à l’oubli supprime toute la base (vérifié) et elle se recrée vide ensuite', async () => {
  yes(await I.wipeIDB()); eq((await indexedDB.databases()).some(d => d.name === 'BelieveAudioDB'), false)
  eq(await I.countIDB(), { audios: 0, dishes: 0 }); eq(await I.listAudios(), [])
})
await T('Convertisseur Blob → ArrayBuffer (avec et sans Blob.arrayBuffer)', async () => {
  const b = new Blob([new Uint8Array([9, 8, 7])]); eq([...new Uint8Array(await I.toBuf(b))], [9, 8, 7])
  const fake = { arrayBuffer: undefined, size: 3 }; const FR = globalThis.FileReader; globalThis.FileReader = class { readAsArrayBuffer() { this.result = new Uint8Array([4, 5]).buffer; setTimeout(() => this.onload(), 0) } }
  try { eq([...new Uint8Array(await I.toBuf(fake))], [4, 5]) } finally { if (FR) globalThis.FileReader = FR; else delete globalThis.FileReader }
})
await T('Recherche : sans accents ni majuscules, tous les mots requis, surlignage fidèle au texte d’origine', () => {
  const ts = U.terms('  Rêve  ÉTRANGE '); eq(ts, ['reve', 'etrange'])
  yes(U.matches('Un rêve très étrange', ts)); yes(!U.matches('Un rêve très banal', ts)); yes(U.matches('n’importe quoi', [])); yes(U.matches('Éloquence', U.terms('eloquence')))
  const h = U.highlight('Un Rêve étrange', ts); eq(h, [{ t: 'Un ', m: false }, { t: 'Rêve', m: true }, { t: ' ', m: false }, { t: 'étrange', m: true }])
  eq(U.highlight('abc', ['ab', 'bc']), [{ t: 'abc', m: true }]) // intervalles fusionnés
  eq(U.highlight('é pur', ['e']).map(s => s.t + (s.m ? '*' : '')), ['é*', ' pur']) // un seul « e » reconnu (le « é » initial)
  const dec = 'Création'; eq(U.highlight(dec, ['creation']).map(s => [s.t, s.m]), [[dec, true]]) // lettre + accent combinant
  eq(U.highlight('rien', ['zzz']), [{ t: 'rien', m: false }]); eq(U.highlight('', ['a']), [{ t: '', m: false }])
  for (const [t, q] of [['Dieu est amour. Dieu aime.', 'dieu'], ['Œuvre ŒUVRE', 'œuvre'], ['İstanbul ıi', 'i']]) eq(U.highlight(t, U.terms(q)).map(s => s.t).join(''), t)
})
await T('Extrait de note : début du texte, ou zone du premier mot trouvé quand il est plus loin', () => {
  eq(U.excerpt('court', ['x']), 'court')
  const long = 'a'.repeat(400) + ' MIRACLE ' + 'b'.repeat(400)
  eq(U.excerpt(long, []).length, 281); yes(U.excerpt(long, []).endsWith('…'))
  const ex = U.excerpt(long, U.terms('miracle')); yes(ex.startsWith('…') && ex.includes('MIRACLE') && ex.length < 300, ex.slice(0, 40))
  yes(U.excerpt(long, U.terms('aaa')).startsWith('aaa'), 'mot au début : extrait du début')
})
await T('Prompteur : défilement proportionnel au temps, plafonné à la fin, saut évité après une pause d’onglet', () => {
  eq(U.stepScroll(0, 100, 50, 1000), { pos: 5, done: false }); eq(U.stepScroll(998, 100, 50, 1000), { pos: 1000, done: true })
  eq(U.stepScroll(0, 5000, 50, 1000).pos, 5, 'intervalle ramené à 100 ms'); eq(U.stepScroll(-5, 0, 50, 1000).pos, 0); eq(U.stepScroll(0, 100, 50, 0), { pos: 0, done: true })
  let p = 0; for (let i = 0; i < 60; i++) p = U.stepScroll(p, 1000 / 60, 120, 1e6).pos; yes(Math.abs(p - 120) < 1, 'une seconde à 120 px/s = 120 px, obtenu ' + p)
})
await T('Métronome : frappe du tempo (moyenne, pause = nouvelle série, bornes), nom du tempo, mesure programmée', () => {
  eq([U.tapBpm([0, 500, 1000, 1500]), U.tapBpm([0, 600]), U.tapBpm([0]), U.tapBpm([]), U.tapBpm([0, 10]), U.tapBpm([0, 30000])], [120, 100, null, null, 240, null])
  eq(U.tapBpm([0, 500, 1000, 5000, 5400, 5800]), 150, 'seule la dernière série compte')
  eq([U.clampBpm(10), U.clampBpm(500), U.clampBpm(90.6), U.tempoName(40), U.tempoName(70), U.tempoName(100), U.tempoName(115), U.tempoName(140), U.tempoName(200)], [30, 240, 91, 'Largo', 'Adagio', 'Andante', 'Moderato', 'Allegro', 'Presto'])
  let st = { next: 0, beat: 0 }; const seq = []; for (let now = 0; now < 2.3; now += 0.025) { const r = U.plan(st, now, 0.12, 120, 3); st = { next: r.next, beat: r.beat }; seq.push(...r.ev.map(e => [e.t, e.b])) }
  eq(seq.map(e => e[1]), [0, 1, 2, 0, 1], 'accent au premier temps, mesure à 3'); eq(seq.map(e => e[0]), [0, 0.5, 1, 1.5, 2])
  const w = U.plan({ next: 1, beat: 5 }, 1, 0.12, 120, 4); eq(w.ev[0].b, 0, 'mesure raccourcie : retour au premier temps')
  eq([U.mmss(65000), U.mmss(0), U.mmss(599500), U.size(500), U.size(2048), U.size(3.5 * 1048576)], ['1:05', '0:00', '10:00', '500 o', '2 Ko', '3,5 Mo'])
})
await T('Métronome (moteur) : clics accentués au 1er temps, battements annoncés à l’heure, silence respecté, arrêt propre', async () => {
  const osc = []; let closed = 0
  class AC { constructor() { this.currentTime = 0; this.destination = {} } resume() { return Promise.resolve() } close() { closed++; return Promise.resolve() }
    createOscillator() { const o = { frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; osc.push(o); return o }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } } }
  globalThis.window = globalThis; const keepAC = globalThis.AudioContext; globalThis.AudioContext = AC
  try {
    const m = new Mt.Metro(); m.bpm = 120; m.beats = 3; const heard = []; m.onBeat = b => heard.push(b)
    yes(m.start(), 'démarrage'); yes(m.running)
    const ctx = m.ctx
    for (let t = 0; t <= 2.2; t += 0.025) { ctx.currentTime = t; m.tick() }
    eq(heard, [0, 1, 2, 0, 1]); eq(osc.slice(0, 5).map(o => o.frequency.value), [1320, 880, 880, 1320, 880])
    m.stop(); yes(!m.running); eq(closed, 1)
    osc.length = 0; m.sound = false; m.start(); const c2 = m.ctx; for (let t = 0; t <= 1; t += 0.025) { c2.currentTime = t; m.tick() }; eq(osc.length, 0, 'son coupé = aucun clic'); m.stop()
    globalThis.AudioContext = undefined; yes(!new Mt.Metro().start(), 'sans audio : démarrage refusé')
  } finally { globalThis.AudioContext = keepAC }
})
await T('Enregistreur : le micro n’est demandé qu’au démarrage, relâché à l’arrêt, résultat conservé jusqu’à sauvegarde ou rejet', async () => {
  const log = { gum: 0, stopped: 0, wl: 0, wlr: 0 }
  const track = () => ({ stop() { log.stopped++ }, onended: null })
  class MR { constructor(s, o) { this.s = s; this.mimeType = o?.mimeType ?? ''; this.state = 'inactive'; MR.last = this } start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; if (MR.silent !== true) this.ondataavailable?.({ data: new Blob([new Uint8Array(100)]) }); this.onstop?.() } static isTypeSupported(t) { return t === 'audio/mp4' } }
  globalThis.window = globalThis; globalThis.MediaRecorder = MR
  const tr = []; const gum = async () => { log.gum++; const t = track(); tr.push(t); return { getTracks: () => [t], getAudioTracks: () => [t] } }
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: gum }, wakeLock: { request: async () => { log.wl++; return { release() { log.wlr++ } } } } }, configurable: true })
  globalThis.URL.createObjectURL = () => 'blob:test'; globalThis.URL.revokeObjectURL = () => {}
  yes(Rc.recSupported()); eq(Rc.pickType(), 'audio/mp4'); eq([Rc.extOf('audio/mp4'), Rc.extOf('audio/webm;codecs=opus'), Rc.extOf('audio/ogg')], ['m4a', 'webm', 'ogg'])
  eq(log.gum, 0, 'micro non demandé avant le clic')
  const p = Rc.startRec('dictaphone'); eq(Rc.rec.st, 'ask'); yes(await p); eq([Rc.rec.st, log.gum, log.stopped, MR.last.mimeType], ['rec', 1, 0, 'audio/mp4'])
  eq(await Rc.startRec('autre'), false, 'double démarrage refusé')
  await Promise.resolve(); eq([log.wl, log.wlr], [1, 0], 'écran maintenu allumé pendant l’enregistrement')
  Rc.stopRec(); eq([Rc.rec.st, Rc.rec.blob.size, Rc.rec.type, Rc.rec.url, log.stopped, Rc.rec.owner], ['done', 100, 'audio/mp4', 'blob:test', 1, 'dictaphone']); eq(log.wlr, 1, 'écran libéré à l’arrêt')
  Rc.discardRec(); eq([Rc.rec.st, Rc.rec.blob, Rc.rec.url, Rc.rec.owner], ['idle', null, '', '']); eq([log.gum, log.stopped, log.wlr], [1, 1, 1], 'discard ne relâche rien en double')
})
await T('Enregistreur : refus du micro, annulation pendant la demande, micro coupé en cours de route, silence total, durée maximale', async () => {
  const mk = () => { const t = { stop() { t.s = (t.s ?? 0) + 1 }, onended: null }; return t }
  let nextGum
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: () => nextGum() } }, configurable: true })
  nextGum = async () => { const e = new Error('x'); e.name = 'NotAllowedError'; throw e }
  eq(await Rc.startRec('d'), false); eq(Rc.rec.st, 'idle'); yes(/refusé/.test(Rc.rec.err) && /reste de l’application/.test(Rc.rec.err), Rc.rec.err); Rc.discardRec()
  eq([Rc.micError({ name: 'NotFoundError' }), Rc.micError({ name: 'NotReadableError' }), Rc.micError(null)].map(x => x.length > 10), [true, true, true])
  // annulation pendant la fenêtre d'autorisation : le micro obtenu juste après est aussitôt relâché
  const t1 = mk(); let release; nextGum = () => new Promise(r => { release = () => r({ getTracks: () => [t1], getAudioTracks: () => [t1] }) })
  const p = Rc.startRec('d'); eq(Rc.rec.st, 'ask'); Rc.discardRec(); release(); eq(await p, false); eq([Rc.rec.st, t1.s], ['idle', 1])
  // micro coupé en cours d'enregistrement : ce qui est capté est conservé, avec un message
  const t2 = mk(); nextGum = async () => ({ getTracks: () => [t2], getAudioTracks: () => [t2] })
  yes(await Rc.startRec('d')); t2.onended(); eq(Rc.rec.st, 'done'); yes(/interrompu/.test(Rc.rec.err)); Rc.discardRec()
  // silence total : aucun morceau reçu
  MediaRecorder.silent = true; yes(await Rc.startRec('d')); Rc.stopRec(); eq(Rc.rec.st, 'idle'); yes(/Aucun son/.test(Rc.rec.err)); MediaRecorder.silent = false; Rc.discardRec()
  // durée maximale : arrêt automatique
  const t3 = mk(); nextGum = async () => ({ getTracks: () => [t3], getAudioTracks: () => [t3] })
  yes(await Rc.startRec('d', 300)); await new Promise(r => setTimeout(r, 700)); eq(Rc.rec.st, 'done', 'arrêt automatique à la durée maximale'); yes(Rc.rec.ms <= 300, String(Rc.rec.ms)); eq(t3.s, 1); Rc.discardRec()
  // navigateur sans MediaRecorder
  const keep = globalThis.MediaRecorder; delete globalThis.MediaRecorder; eq(Rc.recSupported(), false); eq(await Rc.startRec('d'), false); yes(/non disponible/.test(Rc.rec.err)); Rc.discardRec(); globalThis.MediaRecorder = keep
})
await T('Balayage : geste horizontal assez long et rapide reconnu, vertical, court ou lent ignoré', () => {
  eq([U.swipeDir(-120, 10, 300), U.swipeDir(120, -10, 300), U.swipeDir(-120, 150, 300), U.swipeDir(-40, 0, 200), U.swipeDir(-200, 0, 1200), U.swipeDir(-100, 50, 300)], [1, -1, 0, 0, 0, 1])
  eq([U.norm('Éloquence Résumé'), U.num('64,5'), U.DN.length], ['eloquence resume', 64.5, 7])
})
await T('Stockage plein : save renvoie false', () => { const o = globalThis.localStorage.setItem; globalThis.localStorage.setItem = () => { throw new Error('quota') }; const r = L.save(L.DEF()); globalThis.localStorage.setItem = o; yes(r === false) })

// IA : client
const real = globalThis.fetch
await T('Client IA : 404 = configuration requise', async () => { globalThis.fetch = async () => ({ status: 404, ok: false, json: async () => null }); await C.askAI('sport', [], '', new AbortController().signal).then(() => { throw new Error('pas d’erreur') }, e => eq(e.message, 'not_configured')) })
await T('Client IA : réseau coupé = offline, annulation = cancelled', async () => {
  globalThis.fetch = async () => { throw new Error('net') }; await C.askAI('sport', [], '', new AbortController().signal).then(() => { throw new Error('x') }, e => eq(e.message, 'offline'))
  globalThis.fetch = async () => { const e = new Error('a'); e.name = 'AbortError'; throw e }; await C.askAI('sport', [], '', new AbortController().signal).then(() => { throw new Error('x') }, e => eq(e.message, 'cancelled'))
})
await T('Client IA : réponse invalide rejetée', async () => { globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => ({ foo: 1 }) }); await C.askAI('sport', [], '', new AbortController().signal).then(() => { throw new Error('x') }, e => eq(e.message, 'upstream')) })

await T('Santé : IMC et métabolisme de base (Mifflin-St Jeor)', () => { eq(Math.round(H.bmi(65, 170) * 10) / 10, 22.5); eq(H.bmr({ w: 65, h: 170, age: 30, sx: 'F' }), 1402); eq(H.bmr({ w: 80, h: 180, age: 40, sx: 'M' }), 1730) })
await T('Scanner : analyse IA valide acceptée, texte, négatif et valeurs absurdes rejetés', () => {
  yes(H.okScan({ nom: 'Salade', kcal: 320, proteines: 12, glucides: 30, lipides: 15, conseil: 'x', incertitude: 'y' }))
  yes(!H.okScan({ nom: 'x', kcal: '320', proteines: 1, glucides: 1, lipides: 1 }), 'kcal texte'); yes(!H.okScan({ nom: 'x', kcal: -5, proteines: 1, glucides: 1, lipides: 1 }), 'négatif'); yes(!H.okScan({ nom: 'x', kcal: 99999, proteines: 1, glucides: 1, lipides: 1 }), 'absurde'); yes(!H.okScan(null))
})
await T('Recettes : 3 recettes valides acceptées, étapes manquantes rejetées', () => { const r = { titre: 'Soupe', minutes: 20, kcal: 250, proteines: 10, glucides: 30, lipides: 8, ingredients: ['a'], etapes: ['b'] }; eq(H.okRecipes([r, r, r]).length, 3); yes(!H.okRecipes([{ ...r, etapes: [] }]), 'sans étapes'); yes(!H.okRecipes('x')) })
await T('Journal : repas daté du jour, identifiants distincts', () => { const s = L.DEF(); H.pushMeal(s, { n: 'a', kcal: 100, p: 1, g: 2, l: 3 }, 'IA'); H.pushMeal(s, { n: 'b', kcal: 50, p: 0, g: 0, l: 0 }, 'manuel'); eq([s.meals.length, s.meals[0].d === L.today(), s.meals[0].id !== s.meals[1].id, s.meals[0].src], [2, true, true, 'IA']) })
await T('Import : poids, eau, sommeil, repas malformés rejetés', () => { let s = L.DEF(); s.weights = [{ d: '2026-01-01', kg: 'x' }]; yes(!L.valid(s), 'poids texte'); s = L.DEF(); s.water = { a: 'b' }; yes(!L.valid(s), 'eau texte'); s = L.DEF(); s.meals = [{ id: 1 }]; yes(!L.valid(s), 'repas'); yes(L.valid(L.DEF())) })
// IA : fonction serveur Gemini et recherche YouTube (fetch amont simulé, aucun appel réel)
const GOK = x => ({ ok: true, status: 200, body: { modelVersion: 'gemini-3.5-flash', candidates: [{ content: { parts: [{ text: x }] }, finishReason: 'STOP' }] } })
let seen = null, up = GOK('Bonjour'), ipn = 0
globalThis.fetch = async (url, init) => { if (up.throw) throw up.throw; seen = { url: String(url), init: init || {}, body: init && init.body ? JSON.parse(init.body) : null }; return { ok: up.ok, status: up.status, json: async () => up.body } }
const call = async (fn, r) => { const res = { code: 0, body: null, status(c) { this.code = c; return this }, json(b) { this.body = b; return this } }; await fn({ method: 'POST', headers: { 'x-forwarded-for': '10.0.0.' + ++ipn }, ...r }, res); return res }
const msgs = n => [...Array(n)].map((_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i }))
const ask = (b, h = {}) => call(api, { headers: { 'x-forwarded-for': '10.0.0.' + ++ipn, ...h }, body: b })
delete process.env.GEMINI_API_KEY
await T('Serveur IA : GET refusé (405), sans clé = 503 not_configured', async () => { eq((await call(api, { method: 'GET' })).code, 405); const r = await ask({ mode: 'sport', messages: msgs(1) }); eq([r.code, r.body.error], [503, 'not_configured']) })
process.env.GEMINI_API_KEY = 'AIza-test'
await T('Serveur IA : mode inconnu, messages absents ou dernier message non utilisateur = 400', async () => { eq((await ask({ mode: 'x', messages: msgs(1) })).code, 400); eq((await ask({ mode: 'sport' })).code, 400); eq((await ask({ mode: 'sport', messages: msgs(2) })).code, 400) })
await T('Serveur IA : appel Gemini (URL, clé en en-tête, instructions système, réglages), modèle par défaut gemini-3.5-flash', async () => {
  const r = await ask({ mode: 'nutrition', messages: msgs(1) }); eq([r.code, r.body.text, r.body.model], [200, 'Bonjour', 'gemini-3.5-flash'])
  eq([seen.url, seen.init.headers['x-goog-api-key']], ['https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', 'AIza-test'])
  yes(!seen.url.includes('AIza') && !JSON.stringify(r.body).includes('AIza'), 'clé exposée')
  const s = seen.body.systemInstruction.parts[0].text; yes(s.includes('Mode Nutrition') && s.includes('ni médecin') && s.includes('112'))
  eq([seen.body.contents[0].role, seen.body.contents[0].parts[0].text, seen.body.generationConfig.maxOutputTokens, seen.body.generationConfig.thinkingConfig.thinkingLevel], ['user', 'm0', 1500, 'low'])
})
await T('Serveur IA : rôles Gemini (assistant devient model), messages consécutifs fusionnés, historique borné à 10', async () => {
  await ask({ mode: 'sport', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }, { role: 'user', content: 'd' }] })
  eq(seen.body.contents.map(c => [c.role, c.parts[0].text]), [['user', 'a'], ['model', 'b'], ['user', 'c\n\nd']])
  await ask({ mode: 'sport', messages: msgs(15) }); yes(seen.body.contents.length <= 10 && seen.body.contents[0].role === 'user')
})
await T('Serveur IA : contexte transmis seulement s’il est fourni', async () => { await ask({ mode: 'sport', messages: msgs(1) }); yes(!seen.body.systemInstruction.parts[0].text.includes('Contexte fourni')); await ask({ mode: 'sport', messages: msgs(1), context: 'Âge 30 ans' }); yes(seen.body.systemInstruction.parts[0].text.includes('Âge 30 ans')) })
await T('Serveur IA : AI_MODEL pris en compte ; réglage de réflexion seulement pour les modèles gemini-3', async () => {
  process.env.AI_MODEL = 'gemini-3.8-flash'; await ask({ mode: 'sport', messages: msgs(1) }); yes(seen.url.includes('/models/gemini-3.8-flash:generateContent') && seen.body.generationConfig.thinkingConfig)
  process.env.AI_MODEL = 'gemini-2.5-flash'; await ask({ mode: 'sport', messages: msgs(1) }); delete process.env.AI_MODEL; yes(!seen.body.generationConfig.thinkingConfig, 'thinkingConfig envoyé à un modèle 2.5')
})
await T('Serveur IA : erreurs amont (429, 404, 400, 500, blocage, vide, délai, réseau), jamais de statut 404 renvoyé', async () => {
  const e = async u => { up = u; const r = await ask({ mode: 'sport', messages: msgs(1) }); yes(r.code !== 404, 'statut 404 renvoyé'); return r.body.error }
  eq([await e({ ok: false, status: 429, body: {} }), await e({ ok: false, status: 404, body: {} }), await e({ ok: false, status: 400, body: {} }), await e({ ok: false, status: 500, body: {} })], ['quota', 'model', 'rejected', 'upstream'])
  eq([await e({ ok: true, status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } }), await e({ ok: true, status: 200, body: { candidates: [{ content: { parts: [] } }] } })], ['blocked', 'invalid'])
  const ab = new Error('a'); ab.name = 'AbortError'; eq([await e({ throw: ab }), await e({ throw: new Error('dns') })], ['timeout', 'network']); up = GOK('Bonjour')
})
await T('Serveur IA : code d’accès exigé si ACCESS_CODE défini (401), bon code accepté ; origine étrangère refusée (403)', async () => {
  process.env.ACCESS_CODE = 'sésame'; const b = { mode: 'sport', messages: msgs(1) }
  eq([(await ask(b)).code, (await ask(b, { 'x-access-code': 'faux' })).code, (await ask(b, { 'x-access-code': 'sésame' })).code], [401, 401, 200]); delete process.env.ACCESS_CODE
  eq([(await ask(b, { origin: 'https://evil.example', host: 'app.example' })).code, (await ask(b, { origin: 'https://app.example', host: 'app.example' })).code, (await ask(b, { origin: 'pas une url', host: 'app.example' })).code], [403, 200, 403])
})
await T('Serveur IA : scan avec photo (inlineData JPEG avant le texte), JSON demandé, JSON extrait d’un bloc de code', async () => {
  up = GOK('```json\n{"nom":"Salade","kcal":320}\n```')
  const r = await ask({ mode: 'scan', messages: [{ role: 'user', content: 'Analyse' }], image: '/9j/QUJD' }); eq([r.code, r.body.data.kcal], [200, 320])
  eq(seen.body.contents[0].parts, [{ inlineData: { mimeType: 'image/jpeg', data: '/9j/QUJD' } }, { text: 'Analyse' }]); eq(seen.body.generationConfig.responseMimeType, 'application/json'); yes(seen.body.systemInstruction.parts[0].text.includes('JSON'))
})
await T('Serveur IA : recettes (3000 jetons), JSON invalide = 502, photo refusée hors scan/recettes, non JPEG, non base64 ou trop lourde', async () => {
  up = GOK('[{"titre":"a"}]'); const r = await ask({ mode: 'recipes', messages: msgs(1) }); eq([r.code, seen.body.generationConfig.maxOutputTokens], [200, 3000])
  up = GOK('désolé, aucun JSON'); eq((await ask({ mode: 'scan', messages: msgs(1) })).body.error, 'invalid')
  const bi = async image => (await ask({ mode: 'scan', messages: msgs(1), image })).body.error
  eq([await bi('iVBORw0KGgo='), await bi('/9j/ pas base64 !'), await bi('/9j/' + 'A'.repeat(1400000))], ['bad_image', 'bad_image', 'bad_image']); eq((await ask({ mode: 'sport', messages: msgs(1), image: '/9j/QUJD' })).body.error, 'bad_image'); up = GOK('Bonjour')
})
await T('Serveur IA : limitation à 20 requêtes / 10 min / IP', async () => { let c = 0; for (let i = 0; i < 21; i++) c = (await call(api, { headers: { 'x-forwarded-for': '7.7.7.7' }, body: { mode: 'sport', messages: msgs(1) } })).code; eq(c, 429) })
await T('Serveur IA : fiche de lecture (mode book) en JSON, consigne d’originalité, photo refusée', async () => {
  up = GOK('{"idee":"x","points":["a"],"retenir":"y","pour_qui":"z","fiabilite":"w"}')
  const r = await ask({ mode: 'book', messages: [{ role: 'user', content: 'Titre : Dune' }] }); eq([r.code, r.body.data.idee], [200, 'x'])
  const s = seen.body.systemInstruction.parts[0].text; yes(s.includes('ORIGINALE') && s.includes('aucune citation') && s.includes('fiabilite') && s.includes('ni citations'), 'consigne'); eq(seen.body.generationConfig.responseMimeType, 'application/json')
  eq((await ask({ mode: 'book', messages: msgs(1), image: '/9j/QUJD' })).body.error, 'bad_image'); up = GOK('Bonjour')
})
await T('Serveur IA : mode quiz — réponse JSON demandée et extraite, consigne de faits stables, 3 000 jetons, aucune image acceptée, texte libre inchangé', async () => {
  up = GOK('Voici :\n```json\n[{"q":"Capitale de l’Italie ?","o":["Rome","Paris","Lyon","Nice"],"a":0,"e":"Rome."}]\n```')
  const r = await ask({ mode: 'quiz', messages: [{ role: 'user', content: 'Écris 6 questions.' }] }); eq([r.code, r.body.data[0].a, r.body.data[0].o.length], [200, 0, 4])
  const sys = seen.body.systemInstruction.parts[0].text; yes(sys.includes('EXACTEMENT 4') && sys.includes('jamais d’actualité') && sys.includes('n’invente rien') && sys.includes('"a"'), 'consigne du mode quiz')
  eq([seen.body.generationConfig.responseMimeType, seen.body.generationConfig.maxOutputTokens], ['application/json', 3000])
  eq((await ask({ mode: 'quiz', messages: msgs(1), image: '/9j/QUJD' })).body.error, 'bad_image'); up = GOK('pas du json'); eq((await ask({ mode: 'quiz', messages: msgs(1) })).body.error, 'invalid')
  up = GOK('Bonjour'); eq((await ask({ mode: 'sport', messages: msgs(1) })).body.text, 'Bonjour'); eq(seen.body.generationConfig.maxOutputTokens, 1500)
})
await T('Serveur IA : quota quotidien par personne (AI_DAILY_LIMIT) et codes par personne', async () => {
  process.env.AI_DAILY_LIMIT = '2'; process.env.ACCESS_CODES = 'marie:abc,paul:def'; const b = { mode: 'sport', messages: msgs(1) }, m = n => ask(b, { 'x-access-code': n })
  eq([(await m('abc')).code, (await m('abc')).code, (await m('abc')).code, (await m('def')).code, (await m('zzz')).code], [200, 200, 429, 200, 401]); eq((await m('abc')).body.error, 'daily')
  delete process.env.AI_DAILY_LIMIT; delete process.env.ACCESS_CODES
})
const yt = (q, h = {}, k = 'GET') => call(Y, { method: k, headers: { 'x-forwarded-for': '10.2.0.' + ++ipn, ...h }, query: q })
await T('Serveur YouTube : POST refusé, sans clé = 503, requête vide = 400', async () => { delete process.env.YOUTUBE_API_KEY; eq((await yt({ q: 'x' }, {}, 'POST')).code, 405); eq((await yt({ q: 'x' })).code, 503); process.env.YOUTUBE_API_KEY = 'YT-test'; eq((await yt({ q: '  ' })).code, 400) })
await T('Serveur YouTube : résultats nettoyés (entités HTML décodées, identifiants invalides écartés), paramètres de recherche', async () => {
  up = { ok: true, status: 200, body: { items: [{ id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 'Louange &amp; Adoration &#39;live&#39;', channelTitle: 'Chœur' } }, { id: { videoId: 'trop court' }, snippet: { title: 'x' } }, { id: {}, snippet: {} }] } }
  const r = await yt({ q: 'louange matin' }); eq([r.code, r.body.items], [200, [{ id: 'dQw4w9WgXcQ', t: "Louange & Adoration 'live'", ch: 'Chœur' }]])
  const u = new URL(seen.url); eq([u.searchParams.get('videoEmbeddable'), u.searchParams.get('type'), u.searchParams.get('maxResults'), u.searchParams.get('q'), u.searchParams.get('key')], ['true', 'video', '8', 'louange matin', 'YT-test'])
})
await T('Serveur YouTube : quota 403 = quota ; accès protégé par code d’accès et origine', async () => {
  up = { ok: false, status: 403, body: {} }; eq((await yt({ q: 'x' })).body.error, 'quota'); up = { ok: true, status: 200, body: { items: [] } }
  process.env.ACCESS_CODE = 'c'; eq([(await yt({ q: 'x' })).code, (await yt({ q: 'x' }, { 'x-access-code': 'c' })).code], [401, 200]); delete process.env.ACCESS_CODE
  eq((await yt({ q: 'x' }, { origin: 'https://evil.example', host: 'app.example' })).code, 403)
})
// Livres : fonction serveur /api/ext (catalogues simulés, aucun appel réel) et client
const aiFetch = globalThis.fetch
const OLJ = { numFound: 4, docs: [
  { key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'], first_publish_year: 1813, cover_i: 8231856, language: ['eng', 'fre'], ebook_access: 'public', ia: ['prideprejudice00aust'] },
  { key: '/works/OL1W', title: 'Atomic <b>Habits</b> &amp; Co', author_name: ['James Clear', 'Autre'], first_publish_year: 2018, cover_i: 0, language: ['eng'], ebook_access: 'borrowable', ia: ['atomichabits0000clea'] },
  { key: 'javascript:alert(1)', title: 'piège' }, { key: '/works/OL2W' }
] }
const GBJ = { items: [
  { id: 'zyTCAlFPjgYC', volumeInfo: { title: 'Pride and Prejudice', subtitle: 'A Novel', authors: ['Jane Austen'], publisher: 'Penguin', publishedDate: '1813-01-28', description: '<p>Un roman &amp; <b>plus</b></p>\u0007', language: 'en', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' } }, accessInfo: { viewability: 'ALL_PAGES', publicDomain: true } },
  { id: 'AAAA1111', volumeInfo: { title: 'Piège', imageLinks: { thumbnail: 'https://evil.example/x.jpg' } }, accessInfo: { viewability: 'SAMPLE' } }, { id: '../x', volumeInfo: { title: 'x' } }
] }
const GUJ = { count: 2, results: [
  { id: 1342, title: 'Pride and Prejudice', authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }], summaries: ['A summary.'], languages: ['en'], copyright: false, formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg' } },
  { id: 2, title: 'Protégé', authors: [], languages: ['en'], copyright: true, formats: {} }
] }
const LVJ = { books: [
  { id: '123', title: 'Pride and Prejudice', description: '<p>Audio</p>', language: 'English', copyright_year: '1813', url_librivox: 'http://librivox.org/pride-and-prejudice-by-jane-austen/', coverart_thumbnail: 'https://archive.org/download/x/cover.jpg', authors: [{ first_name: 'Jane', last_name: 'Austen' }] },
  { id: 'abc', title: 'mauvais identifiant', language: 'English', url_librivox: 'https://librivox.org/x/' }
] }
let rt = {}, seenU = []
const okj = body => ({ ok: true, status: 200, body })
const allOK = () => { rt = { 'openlibrary.org': okj(OLJ), 'www.googleapis.com': okj(GBJ), 'gutendex.com': okj(GUJ), 'librivox.org': okj(LVJ) } }
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url)); seenU.push({ u, init: init || {} })
  const r = rt[u.hostname]; if (!r) throw new Error('hôte non simulé : ' + u.hostname)
  if (r.throw) throw r.throw
  return { ok: r.ok, status: r.status, json: async () => { if (r.bad) throw new SyntaxError('json'); return typeof r.body === 'function' ? r.body(u, init) : r.body } }
}
const Ext = req(join(out, 'ext.js')).default, X = req(join(out, 'cext.js'))
const ext = (q, h = {}, k = 'GET') => call(Ext, { method: k, headers: { 'x-forwarded-for': '10.3.0.' + ++ipn, ...h }, query: q })
const abort = () => { const e = new Error('a'); e.name = 'AbortError'; return e }
await T('Serveur livres : POST refusé (405), requête vide, trop courte ou sans catalogue valide = 400', async () => {
  allOK(); eq((await ext({ q: 'dune' }, {}, 'POST')).code, 405)
  eq([(await ext({})).code, (await ext({ q: ' a ' })).code, (await ext({ q: '<>:;' })).code, (await ext({ q: 'dune', src: 'xx,yy' })).code], [400, 400, 400, 400]); eq(seenU.length, 0, 'appel amont inutile')
})
await T('Serveur livres : les 4 catalogues sont interrogés avec les bons paramètres, langue transmise, User-Agent sans contact par défaut', async () => {
  allOK(); seenU = []; delete process.env.BOOKS_CONTACT; delete process.env.GOOGLE_BOOKS_KEY
  const r = await ext({ q: 'pride', lang: 'fr' }); eq(r.code, 200); eq(seenU.map(x => x.u.hostname).sort(), ['gutendex.com', 'librivox.org', 'openlibrary.org', 'www.googleapis.com'])
  const by = h => seenU.find(x => x.u.hostname === h).u.searchParams
  eq([by('openlibrary.org').get('q'), by('openlibrary.org').get('limit'), by('www.googleapis.com').get('langRestrict'), by('www.googleapis.com').get('printType'), by('www.googleapis.com').get('key'), by('gutendex.com').get('languages'), by('gutendex.com').get('search'), by('librivox.org').get('title'), by('librivox.org').get('format')], ['pride language:fre', '8', 'fr', 'books', null, 'fr', 'pride', '^pride', 'json'])
  yes(by('openlibrary.org').get('fields').includes('ebook_access') && !by('openlibrary.org').get('fields').includes('publisher'))
  eq([...new Set(seenU.map(x => x.init.headers['user-agent']))], ['Believe-PWA/0.3 (recherche de livres)']); yes(seenU.every(x => !JSON.stringify(x.init.headers).includes('@')), 'adresse e-mail transmise')
  seenU = []; await ext({ q: 'pride' }); yes(by('openlibrary.org').get('q') === 'pride' && by('gutendex.com').get('languages') === 'fr,en' && by('www.googleapis.com').get('langRestrict') === null, 'sans filtre de langue')
  seenU = []; await ext({ q: 'jane austen' }); eq(seenU.filter(x => x.u.hostname === 'librivox.org').map(x => [...x.u.searchParams.keys()].filter(k => k === 'title' || k === 'author').join() + '=' + (x.u.searchParams.get('title') ?? x.u.searchParams.get('author'))).sort(), ['author=^austen', 'title=^jane austen'])
})
await T('Serveur livres : notices normalisées (balises et entités retirées, http→https, liens et couvertures de domaines étrangers écartés, notices piégées ignorées)', async () => {
  allOK(); const r = await ext({ q: 'pride' }), it = r.body.items, f = (s, id) => it.find(x => x.src === s && x.id === id)
  eq(r.body.errors, []); eq(it.length, 6)
  eq(f('ol', '/works/OL66554W'), { src: 'ol', id: '/works/OL66554W', t: 'Pride and Prejudice', a: 'Jane Austen', y: 1813, l: 'en', cover: 'https://covers.openlibrary.org/b/id/8231856-M.jpg', desc: '', pub: 'Open Library', url: 'https://archive.org/details/prideprejudice00aust', acc: 'free', med: 'text' })
  eq(f('ol', '/works/OL1W'), { src: 'ol', id: '/works/OL1W', t: 'Atomic Habits & Co', a: 'James Clear, Autre', y: 2018, l: 'en', cover: null, desc: '', pub: 'Open Library', url: 'https://openlibrary.org/works/OL1W', acc: 'loan', med: 'text' })
  eq(f('gb', 'zyTCAlFPjgYC'), { src: 'gb', id: 'zyTCAlFPjgYC', t: 'Pride and Prejudice : A Novel', a: 'Jane Austen', y: 1813, l: 'en', cover: 'https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1&source=gbs_api', desc: 'Un roman & plus', pub: 'Penguin', url: 'https://books.google.com/books?id=zyTCAlFPjgYC', acc: 'free', med: 'text' })
  eq([f('gb', 'AAAA1111').cover, f('gb', 'AAAA1111').acc, f('gb', 'AAAA1111').pub], [null, 'preview', 'Google Books'])
  eq(f('gu', '1342'), { src: 'gu', id: '1342', t: 'Pride and Prejudice', a: 'Jane Austen', y: null, l: 'en', cover: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg', desc: 'A summary.', pub: 'Project Gutenberg', url: 'https://www.gutenberg.org/ebooks/1342', acc: 'free', med: 'text' })
  eq(f('lv', '123'), { src: 'lv', id: '123', t: 'Pride and Prejudice', a: 'Jane Austen', y: 1813, l: 'en', cover: 'https://archive.org/download/x/cover.jpg', desc: 'Audio', pub: 'LibriVox (lecteurs bénévoles)', url: 'https://librivox.org/pride-and-prejudice-by-jane-austen/', acc: 'free', med: 'audio' })
  yes(!JSON.stringify(it).includes('javascript') && !JSON.stringify(it).includes('evil.example') && !JSON.stringify(it).includes('http://'), 'lien piégé ou non sécurisé renvoyé')
})
await T('Serveur livres : GOOGLE_BOOKS_KEY et BOOKS_CONTACT transmises aux seuls catalogues concernés, jamais renvoyées', async () => {
  allOK(); seenU = []; process.env.GOOGLE_BOOKS_KEY = 'GB-secret-key'; process.env.BOOKS_CONTACT = 'contact@exemple.fr <script>'
  const r = await ext({ q: 'pride' }); delete process.env.GOOGLE_BOOKS_KEY; delete process.env.BOOKS_CONTACT
  const g = seenU.find(x => x.u.hostname === 'www.googleapis.com'); eq(g.u.searchParams.get('key'), 'GB-secret-key'); yes(seenU.filter(x => x !== g).every(x => !x.u.href.includes('GB-secret')))
  yes(!JSON.stringify(r.body).includes('GB-secret'), 'clé renvoyée'); eq(seenU.find(x => x.u.hostname === 'openlibrary.org').init.headers['user-agent'], 'Believe-PWA/0.3 (recherche de livres; contact@exemple.fr script)')
})
await T('Serveur livres : un catalogue en échec n’empêche pas les autres (réponse partielle avec le détail), « aucun résultat » LibriVox (404) n’est pas une erreur', async () => {
  rt = { 'openlibrary.org': { throw: abort() }, 'www.googleapis.com': { ok: false, status: 429, body: {} }, 'gutendex.com': okj(GUJ), 'librivox.org': { ok: false, status: 404, body: null } }
  const r = await ext({ q: 'pride' }); eq([r.code, r.body.items.map(x => x.src), r.body.errors], [200, ['gu'], [{ s: 'ol', e: 'timeout' }, { s: 'gb', e: 'quota' }]])
})
await T('Serveur livres : tous les catalogues en échec = 502 avec le détail ; JSON illisible, 500 et réseau coupé reconnus', async () => {
  rt = { 'openlibrary.org': { ok: true, status: 200, bad: true }, 'www.googleapis.com': { ok: false, status: 500, body: {} }, 'gutendex.com': { throw: new Error('dns') }, 'librivox.org': { ok: false, status: 403, body: {} } }
  const r = await ext({ q: 'pride' }); eq([r.code, r.body.error, r.body.items], [502, 'invalid', []]); eq(r.body.errors, [{ s: 'ol', e: 'invalid' }, { s: 'gb', e: 'upstream' }, { s: 'gu', e: 'network' }, { s: 'lv', e: 'quota' }])
  rt = { 'gutendex.com': { ok: false, status: 404, body: {} } }; const u = await ext({ q: 'pride', src: 'gu' }); eq([u.code, u.body.errors], [502, [{ s: 'gu', e: 'upstream' }]])
})
await T('Serveur livres : requête nettoyée (guillemets, deux-points et balises retirés, 80 caractères), catalogues choisis sans doublon', async () => {
  allOK(); seenU = []; await ext({ q: 'title:"Dune" OR author:<script>alert(1)</script> ' + 'x'.repeat(200), src: 'gu,gu,xx,lv' })
  eq([...new Set(seenU.map(x => x.u.hostname))].sort(), ['gutendex.com', 'librivox.org']); const q = seenU.find(x => x.u.hostname === 'gutendex.com').u.searchParams.get('search')
  yes(q.length <= 80 && !/["<>:()]/.test(q) && q.startsWith('title Dune OR author script alert'), q); seenU = []
  await ext({ q: 'Le Père Goriot — Balzac’s "été"' }); eq(seenU.find(x => x.u.hostname === 'gutendex.com').u.searchParams.get('search'), 'Le Père Goriot Balzac’s été')
})
await T('Serveur livres : code d’accès (unique ou par personne), origine, Sec-Fetch-Site', async () => {
  allOK(); process.env.ACCESS_CODE = 'c'; eq([(await ext({ q: 'dune' })).code, (await ext({ q: 'dune' }, { 'x-access-code': 'c' })).code], [401, 200]); delete process.env.ACCESS_CODE
  process.env.ACCESS_CODES = 'marie:abc, paul:d:ef ,vide:,:sans-nom'; const c = h => ext({ q: 'dune' }, h).then(r => r.code)
  eq([await c({ 'x-access-code': 'abc' }), await c({ 'x-access-code': 'd:ef' }), await c({ 'x-access-code': 'zzz' }), await c({}), await c({ 'x-access-code': '' }), await c({ 'x-access-code': 'sans-nom' }), await c({ 'x-access-code': 'abcd' })], [200, 200, 401, 401, 401, 401, 401]); delete process.env.ACCESS_CODES
  eq([(await ext({ q: 'dune' }, { origin: 'https://evil.example', host: 'app.example' })).code, (await ext({ q: 'dune' }, { origin: 'https://app.example', host: 'app.example' })).code], [403, 200])
  eq([(await ext({ q: 'dune' }, { 'sec-fetch-site': 'cross-site' })).code, (await ext({ q: 'dune' }, { 'sec-fetch-site': 'same-site' })).code, (await ext({ q: 'dune' }, { 'sec-fetch-site': 'same-origin' })).code, (await ext({ q: 'dune' }, { 'sec-fetch-site': 'none' })).code], [403, 403, 200, 200])
})
await T('Serveur livres : 40 requêtes / 10 min par personne, quota quotidien par personne (autre personne non touchée), 0 = sans limite', async () => {
  allOK(); let c = 0; for (let i = 0; i < 41; i++) c = (await call(Ext, { method: 'GET', headers: { 'x-forwarded-for': '6.6.6.6' }, query: { q: 'dune' } })).code; eq(c, 429)
  process.env.ACCESS_CODES = 'zoe:zzz1,tom:zzz2'; process.env.EXT_DAILY_LIMIT = '3'; const m = n => ext({ q: 'dune' }, { 'x-access-code': n })
  try {
    const r = []; for (let i = 0; i < 5; i++) r.push((await m('zzz1')).code); eq(r, [200, 200, 200, 429, 429]); eq((await m('zzz1')).body.error, 'daily'); eq((await m('zzz2')).code, 200)
    process.env.EXT_DAILY_LIMIT = '0'; eq((await m('zzz1')).code, 200)
  } finally { delete process.env.EXT_DAILY_LIMIT; delete process.env.ACCESS_CODES }
})
await T('Serveur : compteurs quotidiens partagés (KV) — empreinte seulement, repli local si le service est indisponible', async () => {
  process.env.KV_REST_API_URL = 'https://kv.example/'; process.env.KV_REST_API_TOKEN = 'kv-token'; process.env.EXT_DAILY_LIMIT = '2'; let n = 0; allOK()
  rt['kv.example'] = { ok: true, status: 200, body: () => [{ result: ++n }, { result: 1 }] }; seenU = []
  const h = { 'x-forwarded-for': '9.9.9.9' }, go = () => call(Ext, { method: 'GET', headers: h, query: { q: 'dune' } })
  eq([(await go()).code, (await go()).code, (await go()).code], [200, 200, 429])
  const k = seenU.filter(x => x.u.hostname === 'kv.example'); eq([k[0].u.pathname, k[0].init.method, k[0].init.headers.authorization], ['/pipeline', 'POST', 'Bearer kv-token'])
  const cmd = JSON.parse(k[0].init.body); eq([cmd[0][0], cmd[1][0], cmd[1][2]], ['INCR', 'EXPIRE', 172800]); yes(/^believe:ext:\d{4}-\d{2}-\d{2}:[0-9a-f]{24}$/.test(cmd[0][1]) && !cmd[0][1].includes('9.9.9.9'), 'identifiant en clair : ' + cmd[0][1])
  rt['kv.example'] = { throw: new Error('kv hors service') }; process.env.EXT_DAILY_LIMIT = '2'; const h2 = { 'x-forwarded-for': '9.9.9.8' }, go2 = () => call(Ext, { method: 'GET', headers: h2, query: { q: 'dune' } })
  eq([(await go2()).code, (await go2()).code, (await go2()).code], [200, 200, 429])
  rt['kv.example'] = { ok: true, status: 200, body: [{ error: 'WRONGPASS' }] }; const h3 = { 'x-forwarded-for': '9.9.9.7' }; eq([(await call(Ext, { method: 'GET', headers: h3, query: { q: 'dune' } })).code], [200])
  for (const v of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'EXT_DAILY_LIMIT']) delete process.env[v]
})
await T('Serveurs : bloc de contrôle d’accès identique dans api/ai.ts, api/ext.ts et api/yt.ts ; domaines autorisés identiques à src/data.ts', () => {
  const grab = (f, a, b) => { const t = readFileSync(f, 'utf8'), i = t.indexOf(a), j = t.indexOf(b); yes(i >= 0 && j > i, f + ' : repères absents'); return t.slice(i, j) }
  const g = ['api/ai.ts', 'api/ext.ts', 'api/yt.ts', 'api/img.ts'].map(f => grab(f, '// <guard>', '// </guard>')); yes(g[0].length > 1500, 'bloc vide'); eq(g[1], g[0]); eq(g[2], g[0]); eq(g[3], g[0])
  const hosts = t => [...t.matchAll(/'([a-z0-9.-]+\.[a-z]+)'/g)].map(m => m[1]), a = hosts(grab('api/ext.ts', '// <hosts>', '// </hosts>').split('\n').slice(1).join('\n')), b = hosts(readFileSync('src/data.ts', 'utf8').split('\n').find(l => l.startsWith('export const BOOK_HOSTS')))
  eq(a, b); yes(a.length >= 10)
})
await T('vercel.json : la CSP autorise les images des domaines de BOOK_HOSTS et d’aucun autre, ni script externe, ni eval, ni appel direct à un tiers ; en-têtes de sécurité et durées maximales des fonctions présents', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8')), h = Object.fromEntries(v.headers[0].headers.map(x => [x.key, x.value])), csp = h['Content-Security-Policy']
  yes(v.headers[0].source === '/(.*)', 'les en-têtes ne couvrent pas toutes les adresses')
  const dir = n => (csp.split(';').map(x => x.trim()).find(x => x.startsWith(n + ' ')) ?? '').split(/\s+/).slice(1)
  const BH = [...readFileSync('src/data.ts', 'utf8').split('\n').find(l => l.startsWith('export const BOOK_HOSTS')).matchAll(/'([a-z0-9.-]+\.[a-z]+)'/g)].map(m => m[1]), img = dir('img-src')
  for (const host of BH) yes(img.includes('https://' + host), host + ' absent de img-src')
  for (const x of img.filter(y => y.startsWith('https://'))) yes(BH.includes(x.replace('https://', '').replace('*.', '')), 'domaine hors liste dans img-src : ' + x)
  eq(dir('script-src'), ["'self'"]); eq(dir('connect-src'), ["'self'"]); eq(dir('object-src'), ["'none'"]); eq(dir('frame-ancestors'), ["'none'"]); eq(dir('base-uri'), ["'self'"]); eq(dir('form-action'), ["'self'"]); eq(dir('default-src'), ["'self'"])
  yes(!/unsafe-eval|http:\/\/|data:\s*;?$/.test(csp.replace(/img-src[^;]*/, '')), 'CSP trop permissive hors images : ' + csp)
  for (const k of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) yes(h[k], k + ' absent')
  yes(/camera=\(\)/.test(h['Permissions-Policy']) && /microphone=\(self\)/.test(h['Permissions-Policy']), 'Permissions-Policy')
  for (const f of ['api/ai.ts', 'api/ext.ts', 'api/yt.ts']) yes(v.functions[f]?.maxDuration > 0 && v.functions[f].maxDuration <= 30, f + ' : durée maximale absente')
  eq(v.functions['api/img.ts']?.maxDuration, 60, 'api/img.ts : la création d’une image peut durer jusqu’à une minute')
})
await T('Plafonds quotidiens : même lecture prudente dans les 4 fonctions serveur, valeurs par défaut identiques dans le code, l’en-tête de chaque fonction et le README', () => {
  const readme = readFileSync('README.md', 'utf8')
  for (const [f, env, def] of [['api/ai.ts', 'AI_DAILY_LIMIT', 150], ['api/ext.ts', 'EXT_DAILY_LIMIT', 300], ['api/yt.ts', 'YT_DAILY_LIMIT', 100], ['api/img.ts', 'AI_IMAGE_DAILY_LIMIT', 20]]) {
    const t = readFileSync(f, 'utf8')
    yes(t.includes('DAILY = () => limit(process.env.' + env + ', ' + def + ')'), f + ' : lecture du plafond')
    yes(new RegExp(env + ' \\([^)]*\\b' + def + ' par défaut').test(t.slice(0, 1200)), f + ' : valeur par défaut absente de l’en-tête')
    yes(new RegExp('`' + env + '`[^;]*\\b' + def + '\\b').test(readme), 'README : ' + env + ' / ' + def)
    yes(!/Number\(process\.env\.[A-Z_]+_LIMIT/.test(t), f + ' : lecture non protégée d’un plafond')
  }
})
await T('Client livres : réponse du serveur contrôlée (adresses et couvertures hors liste, identifiants, longueurs, types)', () => {
  const good = { src: 'gu', id: '1342', t: 'Pride', a: 'Jane Austen', y: 1813, l: 'en', cover: 'https://www.gutenberg.org/x.jpg', desc: 'd', pub: 'Project Gutenberg', url: 'https://www.gutenberg.org/ebooks/1342', acc: 'free', med: 'text' }
  const r = X.parseExt({ items: [good, { ...good, url: 'javascript:alert(1)' }, { ...good, url: 'http://www.gutenberg.org/ebooks/1' }, { ...good, url: 'https://evil.example/' }, { ...good, id: 'abc' }, { ...good, src: 'xx' }, { ...good, t: '' }, { ...good, cover: 'https://evil.example/c.jpg', y: 'x', l: 'de', acc: 'pirate', med: 'video', desc: 'x'.repeat(2000) }, 'texte', null, { ...good, src: 'ol', id: '/works/OL1W', url: 'https://openlibrary.org/works/OL1W' }], errors: [{ s: 'ol', e: 'quota' }, { s: 'zz', e: 'x' }, null] })
  eq(r.items.length, 3); eq(r.items[0], good); eq([r.items[1].cover, r.items[1].y, r.items[1].l, r.items[1].acc, r.items[1].med, r.items[1].desc.length], [null, null, '', 'info', 'text', 700]); eq(r.items[2].src, 'ol'); eq(r.errors, [{ s: 'ol', e: 'quota' }])
  eq([X.parseExt(null), X.parseExt('x'), X.parseExt({ items: 'x' })].map(x => x.items.length), [0, 0, 0])
})
await T('Client livres : paramètres, code d’accès, 404 ou page HTML = configuration requise, réseau coupé, annulation, erreurs détaillées par catalogue', async () => {
  let seen2 = null; const sig = new AbortController().signal, fail = p => p.then(() => { throw new Error('pas d’erreur') }, e => e)
  const resp = (status, body, ct = 'application/json') => async (u, i) => { seen2 = { u: new URL(String(u), 'http://x'), i }; return { status, ok: status < 400, headers: { get: () => ct }, json: async () => body } }
  X.SRCS.length; C.setCode('abc'); globalThis.fetch = resp(200, { items: [], errors: [{ s: 'gb', e: 'timeout' }] })
  const r = await X.searchBooks('dune', 'fr', ['gu', 'lv'], sig); C.setCode(''); eq([seen2.u.pathname, seen2.u.searchParams.get('q'), seen2.u.searchParams.get('lang'), seen2.u.searchParams.get('src'), seen2.i.headers['x-access-code'], r.errors], ['/api/ext', 'dune', 'fr', 'gu,lv', 'abc', [{ s: 'gb', e: 'timeout' }]])
  await X.searchBooks('dune', '', ['ol'], sig); yes(!seen2.u.searchParams.has('lang') && !('x-access-code' in seen2.i.headers))
  eq((await fail((globalThis.fetch = resp(404, null), X.searchBooks('x', '', ['ol'], sig)))).message, 'not_configured')
  eq((await fail((globalThis.fetch = resp(200, null, 'text/html; charset=utf-8'), X.searchBooks('x', '', ['ol'], sig)))).message, 'not_configured')
  eq((await fail((globalThis.fetch = async () => { throw new Error('net') }, X.searchBooks('x', '', ['ol'], sig)))).message, 'offline')
  eq((await fail((globalThis.fetch = async () => { throw abort() }, X.searchBooks('x', '', ['ol'], sig)))).message, 'cancelled')
  const e = await fail((globalThis.fetch = resp(502, { error: 'timeout', errors: [{ s: 'ol', e: 'timeout' }, { s: 'gb', e: 'quota' }] }), X.searchBooks('x', '', ['ol', 'gb'], sig))); eq([e.message, e.errors], ['timeout', [{ s: 'ol', e: 'timeout' }, { s: 'gb', e: 'quota' }]]); yes(e instanceof X.ExtFail)
  eq((await fail((globalThis.fetch = resp(429, { error: 'daily' }), X.searchBooks('x', '', ['ol'], sig)))).message, 'daily'); eq((await fail((globalThis.fetch = resp(200, null), X.searchBooks('x', '', ['ol'], sig)))).message, 'upstream')
})
globalThis.fetch = aiFetch
await T('Média : adresses YouTube reconnues, injections refusées, requêtes et lecteur', () => {
  const ok = 'dQw4w9WgXcQ'
  eq([ok, 'https://youtu.be/' + ok, 'https://www.youtube.com/watch?v=' + ok + '&t=5', 'https://m.youtube.com/shorts/' + ok, 'https://music.youtube.com/watch?v=' + ok, 'youtube.com/embed/' + ok].map(M.ytId), Array(6).fill(ok))
  eq(['', 'https://example.com/watch?v=' + ok, 'https://youtube.com/watch?v=../../x', 'javascript:alert(1)', 'https://youtu.be/court'].map(M.ytId), Array(5).fill(null))
  eq([M.ytQuery('danse', 'Gospel Dance', ''), M.ytQuery('louange', 'Matin', ' piano ')], ['Gospel Dance danse', 'louange Matin piano']); eq(M.embed(ok, false), 'https://www.youtube-nocookie.com/embed/' + ok + '?rel=0&playsinline=1')
  let refus = false; try { M.embed('../../evil', true) } catch { refus = true } yes(refus, 'identifiant piégé accepté')
})
await T('Import : playlist avec identifiant piégé ou type inconnu rejetée', () => { const bad = p => { const s = L.DEF(); s.playlist = p; return !L.valid(s) }; yes(bad([{ id: '../../evil', t: 'x', k: 'danse' }]), 'id piégé'); yes(bad([{ id: 'dQw4w9WgXcQ', t: 'x', k: 'autre' }]), 'type'); yes(!bad([{ id: 'dQw4w9WgXcQ', t: 'x', k: 'louange' }]), 'valide refusée') })
await T('Client IA : code d’accès et photo transmis, erreur 401 reconnue', async () => {
  let h = null, b = null
  globalThis.fetch = async (u, i) => { h = i.headers; b = JSON.parse(i.body); return { status: 200, ok: true, json: async () => ({ data: { a: 1 }, model: 'm' }) } }
  C.setCode('abc'); const r = await C.askJSON('scan', 'x', 'QUJD', new AbortController().signal); C.setCode(''); eq([h['x-access-code'], b.mode, b.image, r.data.a], ['abc', 'scan', 'QUJD', 1])
  globalThis.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: 'code' }) }); await C.askJSON('scan', 'x', undefined, new AbortController().signal).then(() => { throw new Error('x') }, e => eq(e.message, 'code'))
})
const D = (y, mo, d, h = 0, mi = 0) => new Date(y, mo, d, h, mi)
const tk = (o = {}) => ({ id: 't1', t: 'Tâche', imp: false, due: null, done: false, p: null, ...o })
await T('Eisenhower : classement automatique et choix manuel', () => {
  const now = D(2026, 9, 18, 12).getTime(), q = o => K.quad(tk(o), now)
  eq([q({ imp: true, due: '2026-10-19T12:00' }), q({ imp: true, due: '2026-10-25T12:00' }), q({ due: '2026-10-19T12:00' }), q({}), q({ imp: true, due: '2026-10-01T09:00' }), q({ imp: true, due: '2026-10-19T12:00', p: 4 })], [1, 2, 3, 4, 1, 4])
})
await T('Export .ics : structure, CRLF, échappement, pliage 75 octets, tâches terminées ou sans échéance exclues', () => {
  const long = 'Réunion, très importante; à préparer ' + 'é'.repeat(80), now = D(2026, 9, 18, 12)
  const s = K.ics([tk({ id: 'a1', t: long, imp: true, due: '2026-10-18T14:30' }), tk({ id: 'a2', t: 'sans échéance' }), tk({ id: 'a3', t: 'finie', due: '2026-10-18T10:00', done: true })], now)
  yes(s.startsWith('BEGIN:VCALENDAR\r\n') && s.endsWith('END:VCALENDAR\r\n'), 'enveloppe'); yes(!/[^\r]\n/.test(s), 'LF seul')
  eq((s.match(/BEGIN:VEVENT/g) || []).length, 1); yes(s.split('\r\n').every(l => Buffer.byteLength(l) <= 75), 'ligne > 75 octets')
  const u = s.replace(/\r\n /g, ''); yes(u.includes('SUMMARY:P1 Réunion\\, très importante\\; à préparer ' + 'é'.repeat(80)), 'échappement ou pliage')
  yes(u.includes('DTSTART:' + D(2026, 9, 18, 14, 30).toISOString().replace(/[-:]|\.\d{3}/g, '')), 'heure UTC'); yes(u.includes('TRIGGER:-PT30M'))
})
await T('Pliage : caractères de 2 octets jamais coupés, dépliage identique', () => { const l = 'X:' + 'é'.repeat(200), f = K.fold(l); yes(f.split('\r\n').every(x => Buffer.byteLength(x) <= 75)); eq(f.replace(/\r\n /g, ''), l) })
await T('Lien Google Agenda : adresse, titre encodé, début et fin à 1 h', () => {
  const p = new URL(K.gcal(tk({ t: 'Café & plan', due: '2026-10-18T14:30' }))), [a, b] = p.searchParams.get('dates').split('/'), iso = x => Date.parse(x.replace(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/, '$1-$2-$3T$4:$5:$6Z'))
  eq([p.origin + p.pathname, p.searchParams.get('action'), p.searchParams.get('text')], ['https://calendar.google.com/calendar/render', 'TEMPLATE', 'Café & plan']); eq(iso(b) - iso(a), 3600000)
})
await T('Pomodoro : secondes restantes jamais négatives', () => eq([K.left(5000, 1000), K.left(1000, 1000), K.left(1000, 9000), K.left(1500, 1000)], [4, 0, 0, 1]))
const dueAt = '2026-10-18T14:30', d0 = D(2026, 9, 18, 14, 30).getTime()
await T('Rappels : une tâche est rappelée de « échéance − délai » jusqu’à 12 h après l’échéance ; jamais si terminée, sans échéance valide, ou déjà rappelée pour cette échéance ; tri par échéance, tâches non modifiées', () => {
  const due = (now, lead, ...ts) => Rm.dueReminders(ts, now, lead).map(x => x.id), t1 = tk({ id: 'a', due: dueAt }), min = n => n * 60000
  eq([due(d0 - min(31), 30, t1), due(d0 - min(30), 30, t1), due(d0, 30, t1), due(d0 + 12 * 3600e3, 30, t1), due(d0 + 12 * 3600e3 + 1, 30, t1)], [[], ['a'], ['a'], ['a'], []], 'fenêtre (30 min)')
  eq([due(d0 - 1, 0, t1), due(d0, 0, t1), due(d0 - min(120), 120, t1), due(d0 - min(121), 120, t1), due(d0 - min(10), 10, t1), due(d0 - min(11), 10, t1)], [[], ['a'], ['a'], [], ['a'], []], 'autres délais')
  eq(due(d0, 30, tk({ id: 'b', due: dueAt, done: true }), tk({ id: 'c' }), tk({ id: 'd', due: 'pas une date' }), tk({ id: 'e', due: dueAt, r: dueAt })), [], 'terminée, sans échéance, illisible, déjà rappelée')
  eq(due(d0, 30, tk({ id: 'f', due: dueAt, r: '2026-10-17T09:00' })), ['f'], 'échéance changée depuis le rappel : de nouveau armé')
  const list = [tk({ id: 'z', due: '2026-10-18T15:00' }), tk({ id: 'y', due: '2026-10-18T14:30' }), tk({ id: 'x', due: '2026-10-18T14:45' })], before = JSON.stringify(list)
  eq(due(d0 + min(30), 30, ...list), ['y', 'x', 'z'], 'tri par échéance'); eq(JSON.stringify(list), before, 'liste modifiée')
})
await T('Rappels : une tâche créée alors que son rappel est déjà passé ne sonne pas aussitôt ; texte de l’échéance (aujourd’hui, demain, hier, date) indépendant du fuseau et du changement d’heure', () => {
  const min = n => n * 60000
  eq([Rm.startsReminded(dueAt, d0 - min(31), 30), Rm.startsReminded(dueAt, d0 - min(30), 30), Rm.startsReminded(dueAt, d0 + min(5), 30), Rm.startsReminded(null, d0, 30), Rm.startsReminded('pas une date', d0, 30)], [false, true, true, false, false])
  const now = D(2026, 9, 18, 8).getTime()
  eq([Rm.when('2026-10-18T14:30', now), Rm.when('2026-10-19T09:05', now), Rm.when('2026-10-17T23:59', now), Rm.when('2026-10-25T09:00', now), Rm.when(D(2026, 9, 18, 14, 0).getTime(), now)], ['aujourd’hui à 14:30', 'demain à 09:05', 'hier à 23:59', 'le 25 octobre à 09:00', 'aujourd’hui à 14:00'])
  eq(Rm.when('2026-10-25T09:00', D(2026, 9, 24, 23, 30).getTime()), 'demain à 09:00', 'veille du changement d’heure d’automne en Europe')
  eq(Rm.when('2026-03-29T09:00', D(2026, 2, 28, 23, 30).getTime()), 'demain à 09:00', 'veille du changement d’heure de printemps en Europe')
  eq(Rm.remindAt(tk({ due: dueAt }), 30), d0 - min(30)); yes(Number.isNaN(Rm.remindAt(tk(), 30)), 'sans échéance : pas de moment de rappel')
  eq([Rm.LEADS.join(), Rm.GRACE_MS, Rm.CHECK_MS], ['0,10,30,60,120', 43200000, 30000]); for (const n of Rm.LEADS) yes(Rm.LEAD_LABEL[n], 'libellé du délai ' + n)
})
await T('Rappels : notifications du système — jamais sans autorisation, service worker quand il existe (sans doublon), repli sur Notification si le service worker échoue, échec = false', async () => {
  const keep = globalThis.Notification, nav = globalThis.navigator, had = Object.getOwnPropertyDescriptor(nav, 'serviceWorker'), sw = f => Object.defineProperty(nav, 'serviceWorker', { configurable: true, value: f })
  try {
    delete globalThis.Notification; sw(undefined)
    eq([Rm.permission(), await Rm.askPermission(), await Rm.notify('a', 'b', 'c')], ['unsupported', 'unsupported', false])
    const made = []; class N { constructor(t, o) { made.push([t, o]) } } N.permission = 'denied'; N.requestPermission = async () => 'granted'; globalThis.Notification = N
    eq([Rm.permission(), await Rm.notify('a', 'b', 'c'), made.length], ['denied', false, 0], 'notification sans autorisation')
    eq(await Rm.askPermission(), 'granted'); N.permission = 'granted'
    eq([Rm.permission(), await Rm.notify('Titre', 'Corps', 'tag1'), made.length], ['granted', true, 1]); eq([made[0][0], made[0][1].body, made[0][1].tag, made[0][1].data.url, made[0][1].lang, made[0][1].icon], ['Titre', 'Corps', 'tag1', '/#/9', 'fr', '/icon-192.png'])
    const shown = []; sw({ getRegistration: async () => ({ showNotification: async (t, o) => void shown.push([t, o]) }) })
    eq(await Rm.notify('Via SW', 'x', 't2'), true); eq([shown.length, shown[0][0], shown[0][1].tag, made.length], [1, 'Via SW', 't2', 1], 'doublon ou service worker ignoré')
    sw({ getRegistration: async () => ({ showNotification: async () => { throw new Error('refusé') } }) }); eq(await Rm.notify('Repli', 'x', 't3'), true); eq(made.length, 2, 'pas de repli')
    sw({ getRegistration: async () => undefined }); eq(await Rm.notify('Sans enregistrement', 'x', 't4'), true); eq(made.length, 3)
    N.requestPermission = async () => { throw new Error('x') }; eq(await Rm.askPermission(), 'granted', 'demande qui échoue : autorisation actuelle')
    globalThis.Notification = class { constructor() { throw new TypeError('Illegal constructor') } }; globalThis.Notification.permission = 'granted'; sw(undefined); eq(await Rm.notify('x', 'y', 'z'), false)
  } finally { if (keep === undefined) delete globalThis.Notification; else globalThis.Notification = keep; if (had) Object.defineProperty(nav, 'serviceWorker', had); else delete nav.serviceWorker }
})
await T('Rappels : le service worker généré charge le script du clic sur la notification, qui existe et traite « notificationclick »', () => {
  yes(/importScripts:\s*\['sw-notify\.js'\]/.test(readFileSync('vite.config.ts', 'utf8')), 'vite.config.ts : importScripts de sw-notify.js absent')
  yes(/self\.addEventListener\('notificationclick'/.test(readFileSync('public/sw-notify.js', 'utf8')), 'public/sw-notify.js : écouteur absent')
})
await T('Dictée : texte ajouté au champ (espaces, majuscule en début de phrase, jamais coupé en silence, 4 000 caractères comme la fonction serveur) ; messages d’erreur distincts', () => {
  const add = Dc.addSpoken, max = Dc.MAX_Q, trimEnd = x => x.replace(/\s+$/, '')
  eq(max, 4000); yes(/String\(m\?\.content \?\? ''\)\.slice\(0, 4000\)/.test(readFileSync('api/ai.ts', 'utf8')), 'la limite de la fonction serveur n’est plus 4000')
  let seed = 7; const rnd = n => (seed = (seed * 1103515245 + 12345) % 2147483648) % n
  const bits = ['', ' ', 'bonjour', 'Bonjour.', 'oui ?', '\n', 'deux  mots', ' é ', 'à', '…', ' ', 'x'.repeat(3990), 'a b c', '!', '\t'], pick = () => Array.from({ length: 1 + rnd(4) }, () => bits[rnd(bits.length)]).join(rnd(2) ? ' ' : '')
  let nulls = 0, adds = 0
  for (let i = 0; i < 600; i++) {
    const b = pick(), s = pick(), r = add(b, s), sp = s.replace(/\s+/g, ' ').trim(), tb = trimEnd(b)
    if (!sp) { eq(r, b, 'texte vide : le champ doit rester tel quel'); continue }
    const len = (tb ? tb.length + 1 : 0) + sp.length
    if (len > max) { eq(r, null, 'trop long accepté ' + JSON.stringify([b.length, s.length])); nulls++; continue }
    adds++; yes(typeof r === 'string' && r.length === len && r.startsWith(tb) && !/\s\s|[\n\t ]/.test(r.slice(tb.length)), 'sortie incohérente ' + JSON.stringify([b, s, r]))
    eq(add(r, ''), r); eq(add(r, '  \n '), r)
  }
  yes(nulls > 5 && adds > 100, 'jeu d’essai trop pauvre : ' + nulls + ' refus, ' + adds + ' ajouts')
  eq([add('', 'bonjour'), add('Bonjour', 'je cherche'), add('Bonjour.', 'je cherche'), add('Fin…', 'suite'), add('a'.repeat(max - 4), 'bcd'), add('a'.repeat(max - 3), 'bcd')], ['Bonjour', 'Bonjour je cherche', 'Bonjour. Je cherche', 'Fin… Suite', 'a'.repeat(max - 4) + ' bcd', null])
  const codes = ['not-allowed', 'service-not-allowed', 'no-speech', 'audio-capture', 'network', 'language-not-supported'], msgs = codes.map(Dc.dictErr)
  eq(new Set(msgs).size, codes.length); yes(msgs.every(m => m.length > 20) && !msgs.includes(Dc.dictErr('?')), 'messages d’erreur'); eq(Dc.dictErr(''), Dc.dictErr('autre'))
})
await T('Accords : tous refusés par défaut, chacun retirable dans la rubrique 5, chacun validé par le schéma ; données anciennes sans l’accord « dictée » = refusé', () => {
  const keys = Object.keys(L.DEF().consents).sort()
  eq(keys, ['ai', 'gps', 'health', 'mic', 'motion', 'notif', 'photo', 'share', 'speech']); yes(Object.values(L.DEF().consents).every(v => v === false), 'accord donné d’avance')
  const page = readFileSync('src/DataPage.tsx', 'utf8'), blk = page.slice(page.indexOf('const CONSENTS'), page.indexOf(']\n\nfunction Consents'))
  eq([...blk.matchAll(/^  \['([a-z]+)', '/gm)].map(m => m[1]).sort(), keys, 'accord sans entrée retirable dans la rubrique 5')
  mem.clear(); const o = L.DEF(); delete o.consents.speech; mem.set('believe:v2', JSON.stringify(o)); const r = L.load(); eq([r.err, r.s.consents.speech], [null, false])
  for (const k of keys) for (const v of ['oui', 1, 0, null, undefined, {}, []]) { const x = L.DEF(); x.consents[k] = v; yes(!L.valid(x), 'accord « ' + k + ' » : valeur ' + JSON.stringify(v) + ' acceptée') }
  const ok = L.DEF(); for (const k of keys) ok.consents[k] = true; yes(L.valid(ok), 'neuf accords donnés refusés par le schéma')
})
await T('Import : tâches et Pomodoros malformés rejetés', () => {
  const bad = o => { const s = L.DEF(); Object.assign(s, o); return !L.valid(s) }
  yes(bad({ tasks: [{ id: 1, t: 'x', imp: true, due: null, done: false, p: null }] }), 'id numérique'); yes(bad({ tasks: [tk({ p: 9 })] }), 'quadrant 9'); yes(bad({ tasks: [tk({ due: 'pas une date' })] }), 'date invalide'); yes(bad({ tasks: [tk({ imp: 'oui' })] }), 'importance texte'); yes(bad({ pomos: { a: 'x' } }), 'pomos texte')
  yes(!bad({ tasks: [tk({ due: '2026-10-18T14:30', p: 2 })], pomos: { '2026-10-18': 3 } }), 'tâche valide refusée')
})
// Rubrique 12 : catalogue, recherche, liens légaux, Mes livres, marque-pages, fiche IA
const VERIFIED_GU = [1342, 84, 4507, 2680, 1232, 132, 445, 10] // numéros Project Gutenberg dont la page a été consultée et dont le titre correspond
await T('Catalogue : 5 catégories d’au moins 5 livres, identifiants uniques, champs obligatoires, 3 à 6 points clés, langues connues', () => {
  yes(B.BOOKS.length >= 30, 'catalogue trop petit : ' + B.BOOKS.length); eq(B.BCATS.length, 5); eq(new Set(B.BOOKS.map(b => b.id)).size, B.BOOKS.length)
  for (const c of B.BCATS) yes(B.BOOKS.filter(b => b.c === c).length >= 5, 'catégorie trop petite : ' + c)
  for (const b of B.BOOKS) {
    for (const k of ['id', 't', 'a', 'y', 'idee', 'retenir', 'en']) yes(typeof b[k] === 'string' && b[k].trim().length > 3, b.id + ' : champ ' + k)
    yes(b.pts.length >= 3 && b.pts.length <= 6, b.id + ' : points ' + b.pts.length); yes(b.l.length >= 1 && b.l.every(l => l === 'fr' || l === 'en'), b.id + ' : langues'); yes(b.th.length >= 4, b.id + ' : thèmes')
    yes(B.BCATS.includes(b.c), b.id + ' : catégorie'); yes(B.enTitle(b).length > 2, b.id + ' : titre anglais'); yes(B.BOOK_BY_ID.get(b.id) === b)
  }
  yes(B.BOOKS.some(b => b.l.includes('fr')) && B.BOOKS.some(b => b.l.includes('en')), 'les deux langues doivent être représentées')
})
await T('Catalogue : citations seulement pour le domaine public, courtes, référencées et sourcées ; livres protégés sans citation, sans texte libre et sans lien de lecture', () => {
  for (const b of B.BOOKS) {
    if (!b.pd) { eq(b.q, []); yes(!b.gu && !b.lib && !b.bg, b.id + ' : lien de lecture sur un livre protégé'); yes(B.bookLinks(b).every(l => l.k === 'find'), b.id + ' : lien non « chercher »') }
    for (const q of b.q) { yes(b.pd, b.id); yes(q.t.length >= 20 && q.t.length <= 260, b.id + ' : longueur ' + q.t.length); yes(q.r.length > 5 && q.s.length > 5 && (q.l === 'fr' || q.l === 'en'), b.id + ' : référence ou source') }
    yes(b.q.length <= 2, b.id + ' : trop de citations')
  }
})
await T('Catalogue : résumés des livres protégés sans citation longue (guillemets de 4 mots au plus), numéros Gutenberg limités à ceux vérifiés', () => {
  for (const b of B.BOOKS.filter(x => !x.pd)) for (const t of [b.idee, b.retenir, b.en, ...b.pts]) for (const m of t.matchAll(/«\s*([^»]*)»/g)) yes(m[1].trim().split(/\s+/).length <= 4, b.id + ' : citation trop longue « ' + m[1] + ' »')
  for (const b of B.BOOKS) if (b.gu) yes(VERIFIED_GU.includes(b.gu), b.id + ' : numéro Gutenberg non vérifié ' + b.gu)
  yes(B.BOOKS.filter(b => b.c === 'Biblique').every(b => b.gu === 10 && b.bg && b.q.length === 2 && b.q.some(q => q.l === 'fr') && b.q.some(q => q.l === 'en')), 'Bible : texte anglais, chapitre français et citations FR+EN attendus')
})
await T('Liens légaux : https uniquement, domaines autorisés, Bible Louis Segond (domaine public) et King James, recherche d’édition pour les livres protégés', () => {
  const ok = u => { const x = new URL(u); return x.protocol === 'https:' && !x.username && B.LINK_HOSTS.some(d => x.hostname === d || x.hostname.endsWith('.' + d)) }
  for (const b of B.BOOKS) { const ls = B.bookLinks(b); yes(ls.length >= 1, b.id + ' : aucun lien'); for (const l of ls) { yes(ok(l.url), b.id + ' : ' + l.url); yes(['read', 'listen', 'find'].includes(l.k) && l.label.length > 5) } }
  const jean = B.bookLinks(B.BOOK_BY_ID.get('jean')); eq(jean[0].url, 'https://www.biblegateway.com/passage/?search=Jean+3&version=LSG'); yes(jean.some(l => l.url === 'https://www.gutenberg.org/ebooks/10'))
  eq(B.bookLinks(B.BOOK_BY_ID.get('frankenstein'))[0].url, 'https://www.gutenberg.org/ebooks/84'); eq(B.bookLinks(B.BOOK_BY_ID.get('aristote-rhetorique')).find(l => l.k === 'read').url, 'https://classics.mit.edu/Aristotle/rhetoric.html')
  const at = B.bookLinks(B.BOOK_BY_ID.get('atomic-habits')); eq(at.length, 1); yes(at[0].url.startsWith('https://openlibrary.org/search?q=Atomic+Habits'), at[0].url)
  yes(B.bookLinks(B.BOOK_BY_ID.get('les-miserables')).some(l => l.k === 'find' && l.url.includes('gutenberg.org/ebooks/search')), 'Hugo : recherche Gutenberg')
  yes(B.bookLinks(B.BOOK_BY_ID.get('les-miserables')).some(l => l.k === 'listen' && l.url.includes('archive.org/search')), 'Hugo : audio libre')
})
await T('Recherche interne : titre, auteur, thème, mot-clé, langue ; sans accents ni casse ; tous les mots ; filtres catégorie et langue ; titre avant contenu', () => {
  const ids = (q, c = '', l = '') => B.searchBooksLocal(q, c, l).map(h => h.b.id)
  yes(ids('machiavel').includes('the-prince') && ids('MACHIAVEL').includes('the-prince'), 'auteur'); yes(ids('stoicisme').includes('marc-aurele') && ids('Stoïcisme').includes('marc-aurele'), 'thème sans accent')
  yes(ids('habits').includes('atomic-habits'), 'titre anglais'); yes(ids('rhetorique').includes('aristote-rhetorique') && ids('rhétorique').includes('aristote-rhetorique'), 'accent')
  eq(ids('persuasion')[0], 'influence'); yes(ids('zzzqqq').length === 0, 'aucun résultat attendu'); eq(ids('').length, B.BOOKS.length); eq(ids('   ').length, B.BOOKS.length)
  yes(ids('stratégie pouvoir').includes('the-prince') && !ids('stratégie pouvoir zzz').length, 'ET logique')
  yes(ids('', 'Biblique').length >= 5 && ids('', 'Biblique').every(i => B.BOOK_BY_ID.get(i).c === 'Biblique'), 'catégorie'); yes(ids('', '', 'en').every(i => B.BOOK_BY_ID.get(i).l.includes('en')) && !ids('', '', 'en').includes('candide'), 'langue en')
  yes(ids('', '', 'fr').includes('candide') && !ids('', '', 'fr').includes('atomic-habits'), 'langue fr'); yes(ids('anglais').includes('atomic-habits') && ids('français').includes('candide'), 'mot-clé langue')
  yes(ids('berger').includes('psaumes'), 'mot du contenu'); yes(B.searchBooksLocal('prince', '', '').every(h => h.score > 0))
})
await T('Lecture vocale : français = résumé complet, anglais = titre anglais + phrase de présentation ; titre anglais des livres d’abord français', () => {
  const b = B.BOOK_BY_ID.get('candide'); const fr = B.readAloud(b, 'fr'), en = B.readAloud(b, 'en')
  eq([fr.tag, en.tag], ['fr-FR', 'en-US']); yes(fr.text.includes(b.idee) && fr.text.includes(b.retenir) && b.pts.every(p => fr.text.includes(p))); yes(en.text.startsWith('Candide, or Optimism. ') && en.text.includes(b.en))
  eq(B.enTitle(B.BOOK_BY_ID.get('atomic-habits')), 'Atomic Habits'); eq(B.enTitle(B.BOOK_BY_ID.get('orgueil-prejuges')), 'Pride and Prejudice')
})
await T('Découpage de la lecture vocale : morceaux bornés, aucun texte perdu, mots trop longs coupés', () => {
  const t = 'Première phrase courte. Deuxième phrase, un peu plus longue que la précédente ! Troisième ? ' + 'mot '.repeat(120) + 'Fin.'
  const c = U.chunks(t, 80); yes(c.length > 3 && c.every(x => x.length <= 80 && x.length > 0), JSON.stringify(c.map(x => x.length))); eq(c.join(' ').replace(/\s+/g, ' '), t.replace(/\s+/g, ' ').trim())
  eq(U.chunks('', 80), []); eq(U.chunks('   ', 80), []); eq(U.chunks('Court.', 80), ['Court.']); const w = U.chunks('x'.repeat(250), 100); eq(w.map(x => x.length), [100, 100, 50]); eq(w.join(''), 'x'.repeat(250))
})
const bookState = () => { const s = L.DEF(); s.profile = null; return s }
const EXT = (o = {}) => ({ src: 'gu', id: '1342', t: 'Pride and Prejudice', a: 'Jane Austen', y: null, l: 'en', cover: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg', desc: 'Roman.', pub: 'Project Gutenberg', url: 'https://www.gutenberg.org/ebooks/1342', acc: 'free', med: 'text', ...o })
await T('Mes livres : ajout depuis le catalogue, une recherche en ligne ou à la main ; état valide ; doublons, limite de 500 et refus d’une couverture hors liste', () => {
  const s = bookState(), cat = Rd.fromCatalog(B.BOOK_BY_ID.get('candide')), ext = Rd.fromExt(EXT())
  eq([Rd.addBook(s, cat).ok, Rd.addBook(s, ext).ok], [true, true]); eq(s.books.map(b => b.id), ['gu:1342', 'cat:candide']); yes(L.valid(s), L.why(s))
  eq(Rd.addBook(s, Rd.fromCatalog(B.BOOK_BY_ID.get('candide'))), { ok: false, why: 'Ce livre est déjà dans Mes livres.' }); eq(s.books.length, 2)
  const m1 = Rd.manual('  Mon livre ', 'Moi', '120'); yes(m1.ok); eq([m1.b.t, m1.b.total, m1.b.src], ['Mon livre', 120, 'perso']); yes(Rd.addBook(s, m1.b).ok)
  const m2 = Rd.manual('MON  livre'.replace('  ', ' '), 'moi', ''); yes(!Rd.addBook(s, m2.b).ok, 'doublon titre+auteur accepté'); yes(L.valid(s), L.why(s))
  for (const bad of [['', '', ''], ['x', '', '0'], ['x', '', '1.5'], ['x', '', 'abc'], ['x', '', '50001'], ['x'.repeat(201), '', '']]) yes(!Rd.manual(...bad).ok, 'saisie invalide acceptée : ' + bad)
  const t = bookState(); for (let i = 0; i < 500; i++) yes(Rd.addBook(t, { ...cat, id: 'b' + i }).ok); yes(!Rd.addBook(t, { ...cat, id: 'zz' }).ok, 'limite dépassée'); eq(t.books.length, 500); yes(L.valid(t))
  const evil = bookState(); evil.books = [{ ...cat, cover: 'https://evil.example/c.jpg' }]; yes(!L.valid(evil), 'couverture hors liste acceptée'); evil.books = [{ ...cat, url: 'javascript:alert(1)' }]; yes(!L.valid(evil), 'javascript: accepté')
  evil.books = [{ ...cat, desc: 'x'.repeat(701) }]; yes(!L.valid(evil), 'descriptif trop long'); evil.books = [{ ...cat, desc: 'x'.repeat(700) }]; yes(L.valid(evil))
  yes(Rd.whyNot(s, cat) !== null && Rd.whyNot(s, Rd.fromCatalog(B.BOOK_BY_ID.get('frankenstein'))) === null && s.books.length === 3, 'whyNot modifie l’état ou se trompe')
})
await T('Marque-page : « j’ai lu N pages » avance la page et le total du jour ; l’habitude « 20 pages de mon livre » est cochée à 20 (par son rôle, même renommée), jamais décochée', () => {
  const s = bookState(); Rd.addBook(s, Rd.manual('Livre', 'A', '100').b); const id = s.books[0].id, d = '2026-10-20'
  let r = Rd.act(s, { k: 'book', id }, { t: 'read', n: 15 }, d); eq([r.ok, r.added, r.today, r.page, r.marked, s.books[0].st], [true, 15, 15, 15, false, 'cours']); yes(!(s.checks[d] ?? []).includes('h7'))
  s.habits.find(h => h.k === 'livre').n = 'Lire mon roman'; s.habits.find(h => h.k === 'livre').id = 'zz'
  r = Rd.act(s, { k: 'book', id }, { t: 'read', n: 5 }, d); eq([r.today, r.page, r.marked], [20, 20, true]); eq(s.checks[d], ['zz']); eq(Rd.doneText(r, 'Lire mon roman'), '+ 5 pages lues. Aujourd’hui : 20/20. Habitude « Lire mon roman » cochée pour aujourd’hui.')
  r = Rd.act(s, { k: 'book', id }, { t: 'read', n: 10 }, d); eq([r.today, r.marked], [30, false]); eq(s.checks[d], ['zz']); eq(s.pages[d], 30); eq(Rd.pagesToday(s, d), 30); yes(L.valid(s), L.why(s))
  const old = bookState(); old.habits.forEach(h => delete h.k); Rd.addBook(old, Rd.manual('L', '', '').b); Rd.act(old, { k: 'book', id: old.books[0].id }, { t: 'read', n: 20 }, d); eq(old.checks[d], ['h7'])
  const none = bookState(); none.habits = none.habits.filter(h => h.k !== 'livre'); Rd.addBook(none, Rd.manual('L', '', '').b); r = Rd.act(none, { k: 'book', id: none.books[0].id }, { t: 'read', n: 25 }, d); eq([r.ok, r.marked, none.pages[d], none.checks[d]], [true, false, 25, undefined])
})
await T('Marque-page : fin du livre (page bornée, statut Terminé, plus de lecture au-delà), refus des valeurs invalides sans rien modifier', () => {
  const s = bookState(); Rd.addBook(s, Rd.manual('Court', 'A', '30').b); const id = s.books[0].id, d = '2026-10-20'; Rd.act(s, { k: 'book', id }, { t: 'read', n: 25 }, d)
  let r = Rd.act(s, { k: 'book', id }, { t: 'read', n: 20 }, d); eq([r.added, r.page, r.finished, s.books[0].st, r.today], [5, 30, true, 'fini', 30]); yes(Rd.doneText(r, 'x').endsWith('Livre terminé : bravo !'))
  const before = JSON.stringify(s); r = Rd.act(s, { k: 'book', id }, { t: 'read', n: 1 }, d); eq([r.ok, r.why], [false, 'Vous êtes déjà à la dernière page de ce livre.']); eq(JSON.stringify(s), before)
  for (const a of [{ t: 'read', n: 0 }, { t: 'read', n: -3 }, { t: 'read', n: 1.5 }, { t: 'read', n: NaN }, { t: 'read', n: 1001 }, { t: 'at', page: -1, count: true }, { t: 'at', page: 31, count: true }, { t: 'at', page: 2.5, count: true }, { t: 'at', page: NaN, count: false }]) {
    const t = JSON.parse(before); t.books[0].page = 10; t.books[0].st = 'cours'; const b2 = JSON.stringify(t); yes(!Rd.act(t, { k: 'book', id }, a, d).ok, 'valeur acceptée : ' + JSON.stringify(a)); eq(JSON.stringify(t), b2)
  }
  yes(!Rd.act(s, { k: 'book', id: 'inconnu' }, { t: 'read', n: 5 }, d).ok, 'livre inconnu accepté')
})
await T('Marque-page : « je suis à la page P » compte l’écart (ou non), corrige à la baisse sans passer sous 0, première position sans comptage, écart énorme refusé', () => {
  const s = bookState(); Rd.addBook(s, Rd.manual('Roman', 'A', '').b); const id = s.books[0].id, d = '2026-10-20'
  let r = Rd.act(s, { k: 'book', id }, { t: 'at', page: 150, count: false }, d); eq([r.ok, r.added, r.page, r.today, s.books[0].st, s.pages[d]], [true, 0, 150, 0, 'cours', undefined]); yes(Rd.doneText(r, 'x').startsWith('Marque-page déplacé à la page 150.'))
  r = Rd.act(s, { k: 'book', id }, { t: 'at', page: 172, count: true }, d); eq([r.added, r.today, r.marked], [22, 22, true]); eq(s.checks[d].length, 1)
  r = Rd.act(s, { k: 'book', id }, { t: 'at', page: 160, count: true }, d); eq([r.added, r.today, r.marked, s.books[0].page, s.pages[d]], [-12, 10, false, 160, 10]); yes(Rd.doneText(r, 'x').startsWith('12 pages retirées du total du jour.'))
  r = Rd.act(s, { k: 'book', id }, { t: 'at', page: 100, count: true }, d); eq([r.added, r.today, s.pages[d]], [-60, 0, undefined]); yes(L.valid(s), L.why(s))
  const e = Rd.act(s, { k: 'book', id }, { t: 'at', page: 2000, count: true }, d); yes(!e.ok && e.why.includes('décochez'), JSON.stringify(e)); yes(Rd.act(s, { k: 'book', id }, { t: 'at', page: 2000, count: false }, d).ok)
  const p = Rd.probe(s, { k: 'book', id }, { t: 'read', n: 7 }, d), before = s.books[0].page; yes(p.ok && p.page === before + 7 && s.books[0].page === before, 'probe doit laisser l’état intact')
})
await T('Marque-pages « cours » et « autre livre » : pages comptées à part, habitude « 20 pages de cours » cochée, jours anciens oubliés au-delà de 4 000', () => {
  const s = bookState(), d = '2026-10-20'
  let r = Rd.act(s, { k: 'course' }, { t: 'read', n: 12 }, d); eq([r.ok, r.page, r.today, r.marked, s.course.page, s.course.days[d], s.pages[d]], [true, 12, 12, false, 12, 12, undefined])
  r = Rd.act(s, { k: 'course' }, { t: 'read', n: 8 }, d); eq([r.marked, s.checks[d]], [true, [s.habits.find(h => h.k === 'cours').id]]); yes(Rd.coursePagesToday(s, d) === 20); eq(Rd.pagesToday(s, d), 0)
  r = Rd.act(s, { k: 'free' }, { t: 'read', n: 20 }, d); eq([r.ok, r.page, r.marked, s.pages[d]], [true, null, true, 20]); yes(s.checks[d].includes(s.habits.find(h => h.k === 'livre').id)); yes(!Rd.act(s, { k: 'free' }, { t: 'at', page: 3, count: true }, d).ok)
  eq(Rd.setCourseName(s, '  Droit civil '), { ok: true }); eq(s.course.n, 'Droit civil'); yes(!Rd.setCourseName(s, 'x'.repeat(121)).ok); yes(L.valid(s), L.why(s))
  const big = bookState(); for (let i = 0; i < 4100; i++) big.pages['d' + String(i).padStart(5, '0')] = 5
  Rd.act(big, { k: 'free' }, { t: 'read', n: 3 }, 'd09999'); eq(Object.keys(big.pages).length, 4000); yes(big.pages['d09999'] === 3 && !('d00000' in big.pages) && 'd00101' in big.pages, 'les plus anciens jours doivent partir')
})
await T('Mes livres : statut, nombre de pages (refus inférieur à la page atteinte, vide = inconnu), retrait sans effacer les pages lues, livre proposé au marque-page', () => {
  const s = bookState(); Rd.addBook(s, Rd.manual('A', '', '').b); Rd.addBook(s, Rd.manual('B', '', '').b); const [b, a] = s.books; eq(Rd.current(s).id, b.id)
  Rd.act(s, { k: 'book', id: a.id }, { t: 'read', n: 40 }, '2026-10-20'); eq([s.books[1].st, Rd.current(s).id], ['cours', a.id]); Rd.setStatus(s, a.id, 'fini'); eq(Rd.current(s).id, b.id)
  yes(!Rd.setTotal(s, a.id, '30').ok, 'total < page accepté'); yes(Rd.setTotal(s, a.id, '40').ok); eq([s.books[1].total, s.books[1].st, Rd.pct(s.books[1])], [40, 'fini', 100]); yes(Rd.setTotal(s, a.id, '  ').ok); eq(s.books[1].total, null); yes(!Rd.setTotal(s, a.id, 'x').ok); yes(!Rd.setTotal(s, 'nope', '5').ok)
  Rd.removeBook(s, a.id); eq(s.books.length, 1); eq(s.pages['2026-10-20'], 40); yes(L.valid(s), L.why(s))
})
await T('Fiche IA : texte envoyé = titre, auteur et descriptif du catalogue seulement ; réponse nettoyée et bornée ; réponse inutilisable refusée ; état valide avec la fiche', () => {
  const b = Rd.fromExt(EXT({ desc: 'Un roman célèbre.' })), ask = Rd.ficheAsk(b)
  eq(ask, 'Livre : « Pride and Prejudice »\nAuteur : Jane Austen\nDescriptif du catalogue (Project Gutenberg) : Un roman célèbre.\nRédige la fiche de synthèse de ce livre.'); yes(!/profil|note|poids|prénom|@/i.test(ask))
  eq(Rd.ficheAsk({ t: 'X', a: '', src: 'perso' }), 'Livre : « X »\nAuteur : inconnu\nRédige la fiche de synthèse de ce livre.')
  const f = Rd.ficheFrom({ idee: '  Idée\n centrale ', points: ['a', ' ', 'b', 3, 'c'.repeat(500), 'd', 'e', 'f', 'g', 'h', 'i'], retenir: 'R', pour_qui: 'Pour tous', fiabilite: 'Moyenne', extra: 'ignoré' }, 'gemini-x', '2026-10-20')
  eq([f.idee, f.points.length, f.points[2].length, f.retenir, f.pour, f.fia, f.m, f.d], ['Idée centrale', 8, 400, 'R', 'Pour tous', 'Moyenne', 'gemini-x', '2026-10-20']); yes(!('extra' in f))
  for (const bad of [null, 'x', [], {}, { idee: 'x' }, { idee: 'x', points: ['a'] }, { idee: '', points: ['a', 'b'] }, { idee: 'x', points: 'ab' }]) yes(Rd.ficheFrom(bad, 'm') === null, 'fiche inutilisable acceptée : ' + JSON.stringify(bad))
  const s = bookState(); Rd.addBook(s, b); Rd.keepFiche(s, b.id, f); yes(L.valid(s), L.why(s)); eq(s.books[0].f.idee, 'Idée centrale'); Rd.keepFiche(s, b.id, null); eq(s.books[0].f, null); yes(L.valid(s)); yes(Rd.ficheSpeech(f).startsWith('Idée centrale a b'))
})
await T('Réglage des couvertures : désactivé par défaut, ancien document sans le champ chargé avec la valeur par défaut, valeur non booléenne refusée', () => {
  eq(L.DEF().ui.covers, false); mem.clear(); const o = L.DEF(); o.ui = { onboard: true, verseDay: null }; mem.set('believe:v2', JSON.stringify(o)); const r = L.load(); eq([r.err, r.s.ui.covers, r.s.ui.onboard], [null, false, true])
  const s = L.DEF(); s.ui.covers = 'oui'; yes(!L.valid(s), 'covers texte accepté')
})
// ---------------------------------------------------------------- rubrique 13 : académie (exercices, quiz, improvisation)
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const nrm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const dayN = (i, y = 2027) => L.iso(L.addD(new Date(y, 0, 1), i))
await T('Banque de quiz : identifiants uniques, 4 réponses distinctes, bonne réponse valide, explication, aucun doublon de question, catégories équilibrées, compatible avec le schéma', () => {
  const B = Qb.BANK; yes(B.length >= 120, 'banque trop petite : ' + B.length)
  eq(new Set(B.map(q => q.id)).size, B.length); eq(new Set(B.map(q => Qz.qhash(q.q))).size, B.length, 'deux questions ont la même empreinte')
  for (const q of B) {
    yes(/^[a-z]{2}\d{2}$/.test(q.id), 'identifiant : ' + q.id)
    yes(q.o.length === 4 && new Set(q.o.map(nrm)).size === 4, 'réponses : ' + q.id)
    yes(Number.isInteger(q.a) && q.a >= 0 && q.a <= 3, 'indice : ' + q.id)
    yes(q.q.length >= 12 && q.q.length <= 300 && q.o.every(o => o.length >= 1 && o.length <= 140) && q.e.length >= 10 && q.e.length <= 500, 'longueurs : ' + q.id)
    yes(Qb.QCATS.includes(q.c), 'catégorie : ' + q.id); yes(!q.ia, 'banque intégrée marquée IA : ' + q.id)
  }
  for (const c of Qb.QCATS) yes(B.filter(q => q.c === c).length >= 20, 'catégorie trop petite : ' + c)
  const s = L.DEF(); s.quiz.gen = B.map(q => ({ id: q.id, c: q.c, q: q.q, o: q.o, a: q.a, e: q.e })); yes(L.valid(s), L.why(s))
})
await T('Banque de quiz : la bonne réponse n’est ni trop souvent la plus longue ni trop souvent la plus courte (sinon on gagne sans savoir)', () => {
  const rate = (qs, f) => qs.filter(f).length / qs.length
  const longest = q => { const n = q.o.map(o => o.length), g = n[q.a]; return g === Math.max(...n) && n.filter(x => x === g).length === 1 }
  const shortest = q => { const n = q.o.map(o => o.length), g = n[q.a]; return g === Math.min(...n) && n.filter(x => x === g).length === 1 }
  const B = Qb.BANK, lo = rate(B, longest), sh = rate(B, shortest)
  yes(lo >= 0.10 && lo <= 0.40, 'part « la plus longue » : ' + lo.toFixed(2)); yes(sh >= 0.08 && sh <= 0.40, 'part « la plus courte » : ' + sh.toFixed(2))
  for (const c of ['Vocabulaire', 'Définitions', 'Rhétorique']) { const r = rate(B.filter(q => q.c === c), longest); yes(r >= 0.08 && r <= 0.45, c + ' : ' + r.toFixed(2)) }
})
await T('Réponses : ordre d’affichage stable et complet, la bonne réponse se retrouve, les quatre lettres sont utilisées de façon équilibrée', () => {
  const pos = [0, 0, 0, 0]
  for (const q of Qb.BANK) { const v = Qz.view(q), w = Qz.view({ ...q }); eq(v, w); eq([...v.order].sort(), [0, 1, 2, 3]); eq(v.order[v.ok], q.a); pos[v.ok]++ }
  for (const n of pos) yes(n / Qb.BANK.length >= 0.15 && n / Qb.BANK.length <= 0.35, 'lettres de la bonne réponse : ' + JSON.stringify(pos))
  const g = { id: 'gabc', c: 'Biblique', q: 'Question ?', o: ['a', 'b', 'c', 'd'], a: 2, e: 'x' }, v = Qz.view(g); eq(v.order[v.ok], 2)
})
await T('Empreinte d’une question : insensible à la casse, aux accents et à la ponctuation, différente pour des questions différentes', () => {
  eq(Qz.qhash('Que signifie « prolixe » ?'), Qz.qhash('que signifie PROLIXE')); eq(Qz.qhash('Qu’est-ce que l’empathie ?'), Qz.qhash('QU EST-CE QUE L’EMPATHIE'))
  yes(Qz.qhash('Que signifie « prolixe » ?') !== Qz.qhash('Que signifie « laconique » ?')); yes(/^[0-9a-z]{1,24}$/.test(Qz.qhash('x')))
})
await T('Quiz du jour : aucune question ni empreinte ne revient avant l’épuisement de la banque (simulation), une par catégorie tant que possible, état toujours valide', () => {
  const s = L.DEF(), r = rng(7), got = [], total = Qb.BANK.length, minCat = Math.min(...Qb.QCATS.map(c => Qb.BANK.filter(q => q.c === c).length))
  let days = 0
  for (let d = 0; d < 80; d++) {
    const st = Qz.startQuiz(s, dayN(d), {}, r)
    if (!st.ok) { eq(st.why, 'epuise'); break }
    days++; const qs = Qz.curQs(s); eq(qs.length, st.n); yes(qs.length >= 1 && qs.length <= 5)
    if (d < minCat) eq(new Set(qs.map(q => q.c)).size, 5, 'jour ' + d + ' : une question par catégorie attendue')
    for (const q of qs) { got.push(q.id); yes(Qz.answerQ(s, q.id, r() < 0.7 ? q.a : (q.a + 1) % 4), 'réponse refusée') }
    yes(Qz.progress(s).done); if (d % 7 === 0) yes(L.valid(s), L.why(s))
  }
  eq(got.length, total); eq(new Set(got).size, total, 'une question a été servie deux fois'); eq(s.quiz.seen.length, total); eq(new Set(s.quiz.hashes).size, total); eq(s.quiz.hist.length, days); eq(days, Math.ceil(total / 5))
  eq(Qz.startQuiz(s, dayN(99), {}, r), { ok: false, why: 'epuise' }); eq(Qz.remaining(s).total, 0); yes(L.valid(s), L.why(s))
})
await T('Quiz : un quiz commencé se reprend sans nouveau tirage, seule la première réponse compte, le résultat n’est ajouté qu’une fois, tous faux = 0, tous justes = n', () => {
  const s = L.DEF(), r = rng(3); eq(Qz.startQuiz(s, '2027-01-01', {}, r), { ok: true, n: 5 })
  const ids = [...s.quiz.cur.ids], seen = s.quiz.seen.length
  eq(Qz.startQuiz(s, '2027-01-02', {}, r), { ok: false, why: 'encours' }); eq(s.quiz.cur.ids, ids); eq(s.quiz.seen.length, seen)
  const q0 = Qz.qById(s, ids[0])
  yes(Qz.answerQ(s, ids[0], q0.a)); yes(!Qz.answerQ(s, ids[0], (q0.a + 1) % 4), 'seconde réponse acceptée'); eq(s.quiz.cur.ans[ids[0]], q0.a)
  for (const bad of [['inconnu', 0], [ids[1], 4], [ids[1], -1], [ids[1], 1.5], [ids[1], NaN], [ids[1], '1']]) yes(!Qz.answerQ(s, ...bad), 'réponse invalide acceptée : ' + bad)
  eq(s.quiz.hist.length, 0)
  for (const id of ids.slice(1)) yes(Qz.answerQ(s, id, (Qz.qById(s, id).a + 1) % 4))
  eq(s.quiz.hist.length, 1); eq([s.quiz.hist[0].n, s.quiz.hist[0].ok], [5, 1]); yes(!Qz.answerQ(s, ids[1], Qz.qById(s, ids[1]).a), 'réponse après la fin acceptée'); eq(s.quiz.hist.length, 1)
  eq(Qz.startQuiz(s, '2027-01-02', {}, r), { ok: true, n: 5 }); for (const q of Qz.curQs(s)) Qz.answerQ(s, q.id, q.a)
  eq(s.quiz.hist.length, 2); eq([s.quiz.hist[1].d, s.quiz.hist[1].n, s.quiz.hist[1].ok], ['2027-01-02', 5, 5]); eq([...s.quiz.hist[1].cats].sort(), [...Qb.QCATS].sort()); yes(L.valid(s), L.why(s))
})
await T('Quiz par catégorie : questions de la catégorie seulement, jamais les mêmes, dernier quiz plus court, puis épuisement annoncé sans toucher aux autres catégories', () => {
  const s = L.DEF(), r = rng(11), n = Qb.BANK.filter(q => q.c === 'Biblique').length, got = []
  let runs = 0
  for (;;) {
    const st = Qz.startQuiz(s, '2027-02-01', { cat: 'Biblique' }, r)
    if (!st.ok) { eq(st.why, 'epuise'); break }
    runs++; yes(runs < 30, 'boucle'); const qs = Qz.curQs(s); yes(qs.length >= 1 && qs.every(q => q.c === 'Biblique'))
    for (const q of qs) { got.push(q.id); Qz.answerQ(s, q.id, q.a) }
  }
  eq(got.length, n); eq(new Set(got).size, n); eq(runs, Math.ceil(n / 5)); eq(Qz.remaining(s).byCat.Biblique, 0); yes(Qz.remaining(s).total > 0); yes(Qz.startQuiz(s, '2027-02-01', { cat: 'Vocabulaire' }, r).ok)
})
await T('Révision : seulement avec des questions déjà vues, la liste des questions vues n’est pas modifiée, historique marqué et exclu des statistiques', () => {
  const s = L.DEF(), r = rng(5); eq(Qz.startQuiz(s, '2027-03-01', { rev: true }, r), { ok: false, why: 'epuise' })
  Qz.startQuiz(s, '2027-03-01', {}, r); for (const q of Qz.curQs(s)) Qz.answerQ(s, q.id, q.a)
  const seen = [...s.quiz.seen], hashes = [...s.quiz.hashes]
  eq(Qz.startQuiz(s, '2027-03-02', { rev: true }, r), { ok: true, n: 5 })
  yes(s.quiz.cur.rev === true); eq(s.quiz.seen, seen); eq(s.quiz.hashes, hashes); yes(Qz.curQs(s).every(q => seen.includes(q.id)))
  for (const q of Qz.curQs(s)) Qz.answerQ(s, q.id, q.a)
  eq(s.quiz.hist.length, 2); eq(s.quiz.hist[1].rev, true); const st = Qz.stats(s); eq([st.runs, st.revisions, st.answered, st.ok, st.pct, st.best], [1, 1, 5, 5, 100, 100]); yes(L.valid(s), L.why(s))
})
await T('Questions générées par IA : forme stricte, doublons refusés (banque, déjà vues, lot), réponses nettoyées, gardées sans dépasser 300, servies ensuite comme les autres', () => {
  const s = L.DEF(), good = (q, extra = {}) => ({ q, o: ['A) Rome', 'B) Paris', 'C) Lyon', 'D) Nice'], a: 0, e: 'Rome est la capitale de l’Italie.', ...extra })
  const ok = Qz.parseGen([good('Quelle est la capitale de l’Italie ?'), good('Quelle ville est la capitale de l’Italie ?', { o: ['Rome', 'Paris', 'Lyon', 'Nice'], a: 1 })], 'Culture générale', s)
  eq([ok.add.length, ok.invalid, ok.dup], [2, 0, 0]); eq(ok.add[0].o, ['Rome', 'Paris', 'Lyon', 'Nice']); eq(ok.add[0].id, 'g' + Qz.qhash(ok.add[0].q)); eq(ok.add[0].c, 'Culture générale'); eq(ok.add[1].a, 1)
  const Q1 = 'Quelle est la capitale de la France ?'
  const bads = [null, 'x', 5, [], {}, good('Court ?'), good(Q1, { o: ['a', 'b', 'c'] }), good(Q1, { o: ['a', 'b', 'c', 'd', 'e'] }), good(Q1, { o: ['Paris', 'PARIS', 'Lyon', 'Nice'] }), good(Q1, { a: 4 }), good(Q1, { a: -1 }), good(Q1, { a: '1' }), good(Q1, { a: 1.5 }), good(Q1, { e: '' }), good(Q1, { e: 'court' }), good('x'.repeat(301)), good(Q1, { o: ['x'.repeat(141), 'b', 'c', 'd'] }), good(Q1, { o: ['', 'b', 'c', 'd'] }), good(Q1, { o: [1, 2, 3, 4] })]
  for (const b of bads) { const p = Qz.parseGen([b], 'Biblique', s); eq([p.add.length, p.invalid], [0, 1], 'question invalide acceptée : ' + JSON.stringify(b)) }
  for (const junk of [null, undefined, 'x', 42, {}, { questions: 'x' }]) eq(Qz.parseGen(junk, 'Biblique', s).add, [])
  const dupBank = Qz.parseGen([good('QUE SIGNIFIE « PROLIXE » ?')], 'Vocabulaire', s); eq([dupBank.add.length, dupBank.dup], [0, 1])
  const two = Qz.parseGen([good('Quelle est la capitale de l’Espagne ?'), good('quelle est la capitale de l Espagne')], 'Culture générale', s); eq([two.add.length, two.dup], [1, 1])
  eq(Qz.parseGen({ questions: [good('Quelle est la capitale du Portugal ?')] }, 'Culture générale', s).add.length, 1)
  eq(Qz.parseGen(Array.from({ length: 30 }, (_, i) => good('Question numéro ' + i + ' du lot ?')), 'Biblique', s).add.length, 12)
  eq(Qz.addGen(s, ok.add), 2); eq(Qz.addGen(s, ok.add), 0); eq(Qz.parseGen([good('Quelle est la capitale de l’Italie ?')], 'Culture générale', s).dup, 1); yes(L.valid(s), L.why(s))
  for (const q of Qb.BANK) if (q.c !== 'Culture générale') { s.quiz.seen.push(q.id); s.quiz.hashes.push(Qz.qhash(q.q)) } // seules restent : Culture générale (28 + 2 IA)
  for (const q of Qb.BANK.filter(q => q.c === 'Culture générale')) { s.quiz.seen.push(q.id); s.quiz.hashes.push(Qz.qhash(q.q)) }
  eq(Qz.remaining(s).total, 2); eq(Qz.startQuiz(s, '2027-04-01', {}, rng(1)), { ok: true, n: 2 }); const sv = Qz.curQs(s); yes(sv.every(q => q.ia === true && q.id.startsWith('g'))); yes(Qz.parseGen([good(sv[0].q)], 'Culture générale', s).dup === 1, 'une question servie doit rester un doublon')
  const cap = L.DEF(); for (let i = 0; i < 299; i++) cap.quiz.gen.push({ id: 'g' + i, c: 'Biblique', q: 'Question générée numéro ' + i + ' ?', o: ['a', 'b', 'c', 'd'], a: 0, e: 'Explication.' })
  const three = Qz.parseGen([good('Première question inédite du lot ?'), good('Deuxième question inédite du lot ?'), good('Troisième question inédite du lot ?')], 'Biblique', cap)
  eq(Qz.addGen(cap, three.add), 1); eq(cap.quiz.gen.length, 300); yes(L.valid(cap), L.why(cap))
})
await T('Exercices : 72 exercices en 6 familles de 12, identifiants et titres uniques, consignes, durées et conseils renseignés', () => {
  const E = Eb.EXOS; eq(E.length, 72); eq(new Set(E.map(e => e.id)).size, 72); eq(new Set(E.map(e => nrm(e.t))).size, 72)
  for (const k of Eb.KIND_KEYS) eq(E.filter(e => e.k === k).length, 12)
  for (const e of E) { yes(e.how.length >= 2 && e.how.every(x => x.length > 8), 'consignes : ' + e.id); yes(e.sec >= 30 && e.sec <= 600, 'durée : ' + e.id); yes(e.tip.length > 8, 'conseil : ' + e.id); yes(!['diction', 'figures', 'repartie'].includes(e.k) || !!e.txt, 'texte : ' + e.id) }
})
await T('Exercices du jour : 5 exercices de familles différentes, lot stable dans la journée, aucun exercice rejoué avant 11 jours pleins (simulation de 400 jours), familles équilibrées, état valide', () => {
  const s = L.DEF(), r = rng(21), appear = new Map(), kinds = {}
  let prev = null
  for (let i = 0; i < 400; i++) {
    const day = dayN(i), a = Ex.ensureDaily(s, day, r), b = Ex.ensureDaily(s, day, () => 0.999)
    eq(a.map(e => e.id), b.map(e => e.id)); eq(a.length, 5); eq(new Set(a.map(e => e.id)).size, 5); eq(new Set(a.map(e => e.k)).size, 5, 'jour ' + i + ' : cinq familles attendues')
    for (const e of a) { if (appear.has(e.id)) yes(i - appear.get(e.id) >= 12, e.id + ' revient après ' + (i - appear.get(e.id)) + ' jours'); appear.set(e.id, i); kinds[e.k] = (kinds[e.k] ?? 0) + 1 }
    if (prev) for (const e of a) yes(!prev.includes(e.id), 'rejoué le lendemain')
    prev = a.map(e => e.id); if (i % 50 === 0) yes(L.valid(s), L.why(s))
  }
  eq(appear.size, 72); const v = Object.values(kinds); yes(Math.max(...v) / Math.min(...v) < 1.25, JSON.stringify(kinds)); yes(s.exo.seen.length <= 200); eq(Ex.discovered(s), 72)
})
await T('Exercices : un jour sans ouverture ne consomme rien, identifiants inconnus ignorés, « fait » seulement pour un exercice du jour et annulable, série de jours', () => {
  const s = L.DEF(), r = rng(2), d1 = '2027-05-01', d2 = '2027-05-09'
  const a = Ex.ensureDaily(s, d1, r); eq(s.exo.seen.length, 5); const b = Ex.ensureDaily(s, d2, r); eq(s.exo.seen.length, 10)
  s.exo.seen.unshift('zz99'); s.exo.cur.ids.push('zz99'); eq(Ex.ensureDaily(s, d2, r).length, 5); eq(Ex.discovered(s), 10)
  yes(!Ex.markDone(s, a[0].id, d2), 'exercice d’un autre jour accepté'); yes(!Ex.markDone(s, 'zz99', d2), 'identifiant inconnu accepté'); yes(!Ex.markDone(s, b[0].id, d1), 'mauvais jour accepté')
  yes(Ex.markDone(s, b[0].id, d2)); yes(!Ex.markDone(s, b[0].id, d2), 'double marque'); eq(Ex.doneOn(s, d2), 1)
  yes(Ex.unmarkDone(s, b[0].id, d2)); eq(Ex.doneOn(s, d2), 0); yes(!Ex.unmarkDone(s, b[0].id, d2)); eq(s.exo.done, {}); yes(L.valid(s), L.why(s))
  const t = L.DEF(), prev = d => L.iso(L.addD(new Date(d + 'T00:00:00'), -1)); for (const d of ['2027-05-07', '2027-05-08']) t.exo.done[d] = ['di01']
  eq(Ex.exoStreak(t, '2027-05-09', prev), 2); t.exo.done['2027-05-09'] = ['di01']; eq(Ex.exoStreak(t, '2027-05-09', prev), 3); delete t.exo.done['2027-05-08']; eq(Ex.exoStreak(t, '2027-05-09', prev), 1)
})
await T('Improvisation : sujets jamais rejoués dans la mémoire de 1 000, reconstruits depuis leur identifiant, difficulté de 1 à 5 avec libellé, thème jamais répété sur 3 sujets, état valide', () => {
  const s = L.DEF(), r = rng(9), diffs = new Set(), themes = []
  for (let i = 0; i < 1500; i++) {
    const before = new Set(s.impro.seen), sub = Im.drawSubject(s, r)
    yes(/^[0-9a-z]+(\.[0-9a-z]+){3}$/.test(sub.id) && sub.id.length <= 32, sub.id); eq(s.impro.cur, sub.id); yes(!before.has(sub.id), 'sujet rejoué : ' + sub.id)
    eq(Im.decode(sub.id), sub); eq(Im.current(s), sub); yes(sub.diff >= 1 && sub.diff <= 5 && sub.label === Im.DIFF_LABEL[sub.diff] && sub.label.length > 3, 'difficulté'); diffs.add(sub.diff)
    yes(sub.text.startsWith('Sujet : ') && sub.text.includes(sub.theme.replace(/[?.!…]$/, '')) && sub.why.length > 20, sub.text); themes.push(sub.theme)
    if (i >= 3) yes(![themes[i - 1], themes[i - 2], themes[i - 3]].includes(sub.theme), 'thème répété')
  }
  eq([...diffs].sort(), [1, 2, 3, 4, 5]); eq(s.impro.seen.length, 1000); yes(Im.IMPRO_TOTAL > 50000); yes(L.valid(s), L.why(s))
  for (const bad of ['', 'x', '0.0.0', '0.0.0.0.0', '999.0.0.0', '00.0.0.0', '0.0.0.99', '-1.0.0.0', 'a b.c.d.e', '0.0.0.0 ']) eq(Im.decode(bad), null, 'identifiant accepté : ' + bad)
  yes(Im.decode('0.0.0.0') !== null)
})
await T('Improvisation : « terminé » enregistre le sujet courant avec sa difficulté et une durée bornée ; refus sans sujet', () => {
  const s = L.DEF(); yes(!Im.finishImpro(s, '2027-01-01', 60), 'enregistré sans sujet'); const sub = Im.drawSubject(s, rng(4))
  yes(Im.finishImpro(s, '2027-01-01', 61.6)); yes(Im.finishImpro(s, '2027-01-01', 99999)); yes(Im.finishImpro(s, '2027-01-01', -5))
  eq(s.impro.hist.map(h => h.sec), [62, 7200, 0]); eq(s.impro.hist[0], { d: '2027-01-01', id: sub.id, diff: sub.diff, sec: 62 }); yes(L.valid(s), L.why(s))
})
await T('Données antérieures à la rubrique 13 : quiz.gen et impro.cur reçoivent leur valeur par défaut ; question gardée malformée refusée', () => {
  const o = L.DEF(); delete o.quiz.gen; delete o.impro.cur; mem.clear(); mem.set('believe:v2', JSON.stringify(o)); const r = L.load(); eq([r.err, r.s.quiz.gen, r.s.impro.cur], [null, [], null])
  const base = { id: 'g1', c: 'Biblique', q: 'Une question assez longue ?', o: ['a', 'b', 'c', 'd'], a: 3, e: 'explication' }, s = L.DEF()
  for (const bad of [{ o: ['a', 'b', 'c'] }, { c: 'Autre' }, { a: 4 }, { a: 1.5 }, { q: 'Non' }, { e: 'x'.repeat(501) }, { id: '' }]) { s.quiz.gen = [{ ...base, ...bad }]; yes(!L.valid(s), 'question gardée invalide acceptée : ' + JSON.stringify(bad)) }
  s.quiz.gen = [base]; yes(L.valid(s), L.why(s)); mem.clear()
})
// ---------------------------------------------------------------- partage avec des amis, badges, bilan hebdomadaire
const DAY = '2026-10-22' // jeudi ; la semaine va du lundi 19 au dimanche 25 (fin de l'heure d'été en Europe)
const ids = s => Bd.earnedBadges(s).map(b => b.id)
await T('Badges : suites de jours exactes (changement d’heure compris), doublons ignorés', () => {
  eq(Bd.longestRun([]), 0); eq(Bd.longestRun(['2026-10-22']), 1); eq(Bd.longestRun(['2026-10-23', '2026-10-22', '2026-10-22', '2026-10-25']), 2); eq(Bd.longestRun(['abc', '2026-10-22']), 1)
  const run = n => [...Array(n)].map((_, i) => L.iso(L.addD(new Date(2026, 9, 21), i))) // du 21 octobre : traverse le 25 octobre (heure d'hiver) et le 1er novembre
  eq(Bd.longestRun(run(12)), 12); eq(Bd.longestRun(run(12).concat(['2026-11-03'])), 12)
  const mar = [...Array(9)].map((_, i) => L.iso(L.addD(new Date(2026, 2, 25), i))); eq(Bd.longestRun(mar), 9) // traverse le 29 mars (heure d'été)
})
await T('Badges : chaque critère est exact aux limites (6 jours ≠ 7, 4,9 km ≠ 5, 4/5 ≠ sans faute, révision ignorée…)', () => {
  const s = L.DEF(), day = i => L.iso(L.addD(new Date(2026, 9, 1), i)); eq(ids(s), [])
  for (let i = 0; i < 6; i++) s.checks[day(i)] = ['h1']; yes(ids(s).includes('debut') && !ids(s).includes('serie7'), '6 jours')
  s.checks[day(6)] = ['h1']; yes(ids(s).includes('serie7') && !ids(s).includes('serie30'), '7 jours')
  for (let i = 7; i < 29; i++) s.checks[day(i)] = ['h1']; yes(!ids(s).includes('serie30'), '29 jours')
  s.checks[day(29)] = ['h1']; yes(ids(s).includes('serie30'), '30 jours')
  const t = L.DEF(); t.checks['2026-10-01'] = ['zzz']; eq(ids(t), [], 'habitude inconnue')
  t.workouts = [{ d: DAY, act: 'Course', km: 4.9, sec: 1, kcal: 1, gain: null }]; yes(!ids(t).includes('km5')); t.workouts[0].km = 5; yes(ids(t).includes('km5') && !ids(t).includes('km10')); t.workouts[0].km = 10; yes(ids(t).includes('km10'))
  t.steps = { [DAY]: 9999 }; yes(!ids(t).includes('pas')); t.steps[DAY] = 10000; yes(ids(t).includes('pas'))
  t.archives = [{ week: '2026-S42', start: '2026-10-12', rate: 79, n: 1, per: {} }]; yes(!ids(t).includes('semaine')); t.archives[0].rate = 80; yes(ids(t).includes('semaine'))
  t.books = [{ t: 'A', st: 'cours' }]; yes(!ids(t).includes('livre')); t.books.push({ t: 'B', st: 'fini' }); yes(ids(t).includes('livre'))
  t.quiz.hist = [{ d: DAY, n: 5, ok: 4, cats: [] }, { d: DAY, n: 3, ok: 3, cats: [] }, { d: DAY, n: 5, ok: 5, cats: [], rev: true }]; yes(!ids(t).includes('quiz5'), 'quiz 4/5, 3/3 et révision')
  t.quiz.hist.push({ d: DAY, n: 5, ok: 5, cats: [] }); yes(ids(t).includes('quiz5'))
  t.quiz.hist = [...Array(9)].map(() => ({ d: DAY, n: 5, ok: 1, cats: [] })).concat([...Array(5)].map(() => ({ d: DAY, n: 5, ok: 1, cats: [], rev: true }))); yes(!ids(t).includes('quiz10'), '9 + 5 révisions')
  t.quiz.hist.push({ d: DAY, n: 5, ok: 1, cats: [] }); yes(ids(t).includes('quiz10'))
  const e = i => L.iso(L.addD(new Date(2026, 9, 21), i)); t.exo.done = {}; for (let i = 0; i < 6; i++) t.exo.done[e(i)] = ['x']; t.exo.done[e(6)] = []; yes(!ids(t).includes('exo7'), 'jour vide')
  t.exo.done[e(6)] = ['x']; yes(ids(t).includes('exo7'))
  t.impro.hist = [...Array(9)].map(() => ({ d: DAY, id: 'x', diff: 1, sec: 1 })); yes(!ids(t).includes('impro10')); t.impro.hist.push({ d: DAY, id: 'x', diff: 1, sec: 1 }); yes(ids(t).includes('impro10'))
})
await T('Badges : aucun critère ne lit une donnée sensible (poids, repas, prières, notes, cycle)', () => {
  const s = L.DEF(); s.profile = { g: 'F', name: 'Ada', age: 30, h: 170, w: 60, t: 60, ws: 71, lv: 'I', sx: 'F' }; s.weights = [{ d: DAY, kg: 60 }]; s.meals = [{ id: 'm', d: DAY, n: 'x', kcal: 9000, p: 1, g: 1, l: 1, src: 'manuel' }]
  s.prayers = [{ id: 'p', t: 'x', c: DAY, a: DAY }]; s.notes = [{ id: 'n', cat: 'Rêves', t: 'x', b: 'y', c: DAY, u: DAY }]; s.cycle = { mode: 'cycle', starts: [DAY], rec: { [DAY]: [5, 5, 5] }, en: { [DAY]: 5 } }; s.water = { [DAY]: 5000 }; s.sleep = { [DAY]: 9 }
  eq(ids(s), [], 'objectif de poids atteint, prière exaucée, notes… ne donnent aucun badge')
})
await T('Bilan : semaine lundi-dimanche, jours à venir exclus, doublons et habitudes inconnues ignorés, comparaison à la semaine archivée précédente', () => {
  const s = L.DEF()
  s.checks = { '2026-10-19': ['h1', 'h2', 'h3', 'h4'], '2026-10-20': ['h1', 'h2', 'zzz'], '2026-10-22': ['h1', 'h1'], '2026-10-23': ['h1'] }
  s.steps = { '2026-10-19': 10000, '2026-10-20': 9999, '2026-10-23': 20000 }
  s.workouts = [{ d: '2026-10-18', act: 'Course', km: 9, sec: 1, kcal: 1, gain: null }, { d: '2026-10-19', act: 'Course', km: 5.04, sec: 1, kcal: 1, gain: null }, { d: '2026-10-22', act: 'Marche', km: 3.02, sec: 1, kcal: 1, gain: null }]
  s.quiz.hist = [{ d: '2026-10-20', n: 5, ok: 3, cats: [] }, { d: '2026-10-21', n: 5, ok: 5, cats: [], rev: true }, { d: '2026-10-23', n: 5, ok: 1, cats: [] }, { d: '2026-10-18', n: 5, ok: 1, cats: [] }]
  s.exo.done = { '2026-10-19': ['a'], '2026-10-20': [] }; s.impro.hist = [{ d: '2026-10-22', id: 'x', diff: 2, sec: 60 }, { d: '2026-10-26', id: 'y', diff: 2, sec: 60 }]; s.pages = { '2026-10-21': 12, '2026-10-23': 99 }
  s.archives = [{ week: '2026-S43', start: '2026-10-19', rate: 99, n: 1, per: {} }, { week: '2026-S42', start: '2026-10-12', rate: 40, n: 1, per: {} }, { week: '2026-S41', start: '2026-10-05', rate: 30, n: 1, per: {} }]
  s.weights = [{ d: '2026-10-12', kg: 80 }, { d: '2026-10-18', kg: 79 }, { d: '2026-10-21', kg: 78.4 }, { d: '2026-10-23', kg: 70 }]
  const b = Bl.bilanOf(s, DAY)
  eq([b.start, b.end, b.elapsed], ['2026-10-19', '2026-10-25', 4]); eq(b.days.map(d => d.pct), [50, 25, 0, 13, 13, 0, 0]); eq(b.days.map(d => d.future), [false, false, false, false, true, true, true])
  eq(b.rate, 22); eq(b.steps10k, 1); eq([b.km, b.workouts], [8.1, 2]); eq([b.quizzes, b.exoDays, b.improvs, b.pages], [1, 1, 1, 12]); eq(b.prev, { week: '2026-S42', rate: 40 }); eq(b.weight, -0.6); eq(b.top, { n: 'Sport : marche, course ou salle', c: 3 })
  s.weights = [{ d: '2026-10-20', kg: 80 }, { d: '2026-10-22', kg: 79.2 }]; eq(Bl.bilanOf(s, DAY).weight, -0.8); s.weights = [{ d: '2026-10-22', kg: 79.2 }]; eq(Bl.bilanOf(s, DAY).weight, null); s.weights = []; eq(Bl.bilanOf(s, DAY).weight, null)
  eq(Bl.bilanOf(L.DEF(), DAY).rate, 0); eq(Bl.bilanOf(L.DEF(), DAY).top, null); eq(Bl.bilanOf(L.DEF(), DAY).prev, null)
})
await T('Bilan : lundi = 1 jour écoulé, dimanche = 7, sept dates distinctes même la semaine du changement d’heure', () => {
  const s = L.DEF()
  eq(Bl.bilanOf(s, '2026-10-19').elapsed, 1); eq(Bl.bilanOf(s, '2026-10-25').elapsed, 7); eq(Bl.bilanOf(s, '2026-10-25').days.some(d => d.future), false)
  for (const [d, last] of [['2026-10-25', '2026-10-25'], ['2026-03-29', '2026-03-29'], ['2026-03-23', '2026-03-29']]) { const b = Bl.bilanOf(s, d); eq(b.days[6].d, last); eq(new Set(b.days.map(x => x.d)).size, 7) }
  const h = L.DEF(); h.habits = []; eq(Bl.bilanOf(h, DAY).rate, 0); eq(Bl.bilanOf(h, DAY).days.map(d => d.pct), [0, 0, 0, 0, 0, 0, 0])
})
await T('Série d’une habitude à un jour donné : veille comptée tant qu’aujourd’hui n’est pas coché, rupture respectée', () => {
  const s = L.DEF(), dd = n => L.iso(L.addD(new Date(DAY + 'T00:00:00'), n)); s.checks[dd(-1)] = ['h1']; s.checks[dd(-2)] = ['h1']; s.checks[dd(-4)] = ['h1']
  eq(Bl.streakAt(s, 'h1', DAY), 2); s.checks[dd(0)] = ['h1']; eq(Bl.streakAt(s, 'h1', DAY), 3); eq(Bl.streakAt(s, 'h2', DAY), 0)
})

// Partage : état rempli de données-pièges (une par catégorie sensible)
const SENT = {
  name: ['SENT_NOM'], habits: [], badges: [], steps: ['7.5'], quiz: [], books: ['SENT_LIVRE_COURS'],
  weight: ['73.3', '66.6', '59.4', '73,3', '66,6', '59,4'], weightPct: [], cycle: [], food: ['SENT_REPAS', '1234'], prayers: ['SENT_PRIERE'], notes: []
}
const NEVER = ['77.7', '77,7', 'SENT_HABITUDE', 'SENT_TITRE_NOTE', 'SENT_CORPS_NOTE', 'SENT_LIVRE_FINI', 'SENT_LIVRE_LIRE', 'SENT_GPS', '48.8566', '2.3522', 'SENT_FICHE', 'SENT_EAU', 'SENT_GRATITUDE']
const sentState = () => {
  const s = L.DEF()
  s.consents.share = true
  s.profile = { g: 'F', name: 'SENT_NOM', age: 37, h: 171, w: 66.6, t: 59.4, ws: 73.3, lv: 'I', sx: 'F' }
  s.habits[0].n = 'SENT_HABITUDE'
  s.checks = { '2026-10-19': ['h1', 'h2'], '2026-10-21': ['h1'], '2026-10-22': ['h1', 'h3'] }
  s.steps = { '2026-10-20': 12000 }
  s.workouts = [{ d: '2026-10-21', act: 'Course', km: 7.5, sec: 2400, kcal: 500, gain: 20, trace: [[48.8566, 2.3522]], secret: 'SENT_GPS' }]
  s.weights = [{ d: '2026-10-01', kg: 77.7 }, { d: '2026-10-20', kg: 66.6 }]
  s.meals = [{ id: 'm1', d: DAY, n: 'SENT_REPAS', kcal: 1234, p: 1, g: 1, l: 1, src: 'manuel' }, { id: 'm2', d: '2026-10-21', n: 'SENT_REPAS_HIER', kcal: 777, p: 1, g: 1, l: 1, src: 'manuel' }]
  s.prayers = [{ id: 'p1', t: 'SENT_PRIERE', c: DAY, a: null }, { id: 'g1', t: 'SENT_GRATITUDE', c: DAY, a: null, k: 'g' }]
  s.notes = [{ id: 'n1', cat: 'Rêves', t: 'SENT_TITRE_NOTE', b: 'SENT_CORPS_NOTE', c: DAY + 'T08:00:00.000Z', u: DAY + 'T08:00:00.000Z' }, { id: 'n2', cat: 'Poèmes', t: 'SENT_TITRE_NOTE', b: 'SENT_CORPS_NOTE', c: DAY + 'T08:00:00.000Z', u: DAY + 'T08:00:00.000Z' }]
  s.cycle = { mode: 'cycle', starts: ['2026-10-10'], rec: { [DAY]: [1, 1, 1] }, en: { [DAY]: 4 } } // la récupération saisie avant un changement de suivi ne doit jamais sortir en mode cycle
  const bk = (id, t, st) => ({ id, t, a: 'Auteur', src: 'perso', ref: '', cover: null, url: null, total: null, page: 0, st }); s.books = [bk('b1', 'SENT_LIVRE_COURS', 'cours'), bk('b2', 'SENT_LIVRE_FINI', 'fini'), bk('b3', 'SENT_LIVRE_LIRE', 'lire')]
  s.quiz.hist = [{ d: '2026-10-20', n: 5, ok: 4, cats: [] }]
  s.exo.done = { '2026-10-20': ['x'] }; s.water = { [DAY]: 777 }; s.sleep = { [DAY]: 7 }
  s.course = { n: 'SENT_FICHE', page: 5, days: {} }
  return s
}
const keyOf = k => (k === 'name' ? 'who' : k)
const flat = p => (p ? JSON.stringify(p) + '\n' + Sh.shareText(p) + '\n' + JSON.stringify(Sh.rowsOf(p)) : '')
const hasAny = (txt, list) => list.filter(x => txt.includes(x))
await T('Partage : l’état rempli de données-pièges est un état valide (les tests portent sur des données réelles)', () => { const s = sentState(); yes(L.valid(s), L.why(s)); for (const k of L.SHARE_KEYS) s.share.vis[k] = true; yes(L.valid(s), L.why(s)) })
await T('Partage : catalogue des catégories = clés du schéma, sensibles exactement celles du cahier des charges, inconnue = sensible', () => {
  eq(Sh.SHARE_ITEMS.map(i => i.k), [...L.SHARE_KEYS]); eq(Sh.SHARE_ITEMS.filter(i => i.sens).map(i => i.k), ['weight', 'weightPct', 'cycle', 'food', 'prayers', 'notes']); eq(Sh.isSens('inconnu'), true); eq(Sh.isSens('habits'), false)
  yes(Sh.NEVER_SHARED.some(x => /GPS/.test(x)), 'GPS non listé comme jamais partagé')
})
await T('Partage : sans accord « Partage », rien n’est produit, même avec toutes les cases cochées', () => {
  const s = sentState(); s.consents.share = false; for (const k of L.SHARE_KEYS) s.share.vis[k] = true; eq(Sh.buildShare(s, DAY), null)
})
await T('Partage : accord donné mais rien coché = carte vide (seulement version et date), aucune donnée-piège', () => {
  const s = sentState(), p = Sh.buildShare(s, DAY); eq(p, { v: 1, d: DAY }); eq(Sh.hasContent(p), false); eq(Sh.rowsOf(p), []); eq(hasAny(flat(p), [].concat(...Object.values(SENT), NEVER)), [])
})
await T('Partage : étanchéité par catégorie (12 cases) : cochée = présente, jamais le contenu des autres, jamais les données interdites', () => {
  for (const k of L.SHARE_KEYS) {
    const s = sentState(); s.share.vis = { [k]: true }
    const p = Sh.buildShare(s, DAY); eq(Sh.whyBad(p), null, k); eq(Object.keys(p).filter(x => x !== 'v' && x !== 'd'), [keyOf(k)], 'clés de la carte pour ' + k)
    const t = flat(p); for (const x of SENT[k]) yes(t.includes(x), k + ' : « ' + x + ' » absent alors que la case est cochée')
    for (const [k2, list] of Object.entries(SENT)) if (k2 !== k) eq(hasAny(t, list), [], 'fuite de « ' + k2 + ' » avec seulement « ' + k + ' »')
    eq(hasAny(t, NEVER), [], 'donnée interdite avec seulement « ' + k + ' »')
  }
})
await T('Partage : toutes les cases cochées, les données interdites (noms d’habitudes, textes de notes, livres hors lecture, tracé GPS, pesées détaillées) ne sortent toujours pas', () => {
  const s = sentState(); for (const k of L.SHARE_KEYS) s.share.vis[k] = true
  const p = Sh.buildShare(s, DAY), t = flat(p); eq(Sh.whyBad(p), null); eq(Object.keys(p).sort(), ['v', 'd', ...L.SHARE_KEYS.map(keyOf)].sort()); eq(hasAny(t, NEVER), [])
  eq(hasAny(t, ['73.3', '66.6', '59.4']).length, 3); yes(!t.includes('77.7'), 'ancienne pesée'); yes(!t.includes('SENT_REPAS_HIER'), 'repas d’hier'); yes(!t.includes('777'), 'calories d’hier ou eau')
  eq(p.notes, [{ cat: 'Rêves', n: 1 }, { cat: 'Poèmes', n: 1 }]); eq(p.books, [{ t: 'SENT_LIVRE_COURS', a: 'Auteur' }]); eq(p.food, { kcal: 1234, meals: ['SENT_REPAS'] }); eq(p.cycle, { kind: 'cycle', txt: 'Jour 13 du cycle · énergie 4 sur 5' })
})
await T('Partage : 300 combinaisons de cases au hasard (graine fixe) : carte valide, présente si cochée, absente sinon, texte = lignes de l’aperçu', () => {
  let x = 20261022; const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296
  for (let n = 0; n < 300; n++) {
    const s = sentState(); const on = new Set(L.SHARE_KEYS.filter(() => rnd() < 0.45)); for (const k of on) s.share.vis[k] = true
    const p = Sh.buildShare(s, DAY), t = flat(p); eq(Sh.whyBad(p), null)
    for (const k of L.SHARE_KEYS) { const has = keyOf(k) in p; eq(has, on.has(k), k + (on.has(k) ? ' cochée mais absente' : ' non cochée mais présente')); if (!on.has(k)) eq(hasAny(t, SENT[k]), [], 'fuite de ' + k) }
    eq(hasAny(t, NEVER), []); const txt = Sh.shareText(p); for (const r of Sh.rowsOf(p)) { yes(txt.includes(r.h), r.h); for (const l of r.l) yes(txt.includes('– ' + l), l) }
    yes(JSON.stringify(p).length < 3000, 'carte démesurée')
  }
})
await T('Partage : la carte est refusée au moindre champ inattendu (liste blanche stricte), type ou taille hors limites', () => {
  const ok = { v: 1, d: DAY, habits: { rate: 50, best: 3 }, books: [{ t: 'Un', a: 'Deux' }] }; eq(Sh.whyBad(ok), null)
  for (const [bad, why] of [[{ ...ok, secret: 'x' }, 'clé racine'], [{ ...ok, habits: { rate: 50, best: 3, noms: ['a'] } }, 'clé imbriquée'], [{ ...ok, habits: { rate: 150, best: 3 } }, 'pourcentage'], [{ ...ok, v: 2 }, 'version'], [{ ...ok, d: 'hier' }, 'date'],
    [{ ...ok, books: [{ t: 'a', a: 'b' }, { t: 'a', a: 'b' }, { t: 'a', a: 'b' }, { t: 'a', a: 'b' }, { t: 'a', a: 'b' }, { t: 'a', a: 'b' }] }, 'six livres'], [{ ...ok, notes: [{ cat: 'Autre', n: 1 }] }, 'catégorie de note'], [{ ...ok, notes: [{ cat: 'Rêves', n: 1, texte: 'x' }] }, 'texte de note'],
    [{ ...ok, weight: { from: 1, now: 70, goal: 60 } }, 'poids irréaliste'], [{ ...ok, who: '' }, 'prénom vide'], [{ ...ok, __proto__x: 1, ['__proto__']: { a: 1 } }, 'clé dangereuse'], [null, 'null'], [[], 'tableau']]) yes(Sh.whyBad(bad) !== null, 'carte acceptée : ' + why)
})
await T('Partage : construire la carte ne modifie pas l’état, est déterministe, et une catégorie cochée sans donnée est simplement absente', () => {
  const s = sentState(); for (const k of L.SHARE_KEYS) s.share.vis[k] = true; const before = JSON.stringify(s); eq(JSON.stringify(Sh.buildShare(s, DAY)), JSON.stringify(Sh.buildShare(s, DAY))); eq(JSON.stringify(s), before)
  const e = L.DEF(); e.consents.share = true; e.share.vis = { name: true, habits: true, badges: true, books: true, weight: true, weightPct: true, cycle: true, food: true, prayers: true, notes: true, quiz: true }
  const p = Sh.buildShare(e, DAY); eq(Object.keys(p).sort(), ['d', 'habits', 'v']); eq(p.habits, { rate: 0, best: 0 }); eq(Sh.emptyKeys(e, p).sort(), ['badges', 'books', 'cycle', 'food', 'name', 'notes', 'prayers', 'quiz', 'weight', 'weightPct'])
  e.profile = { g: 'M', name: '  ', age: 30, h: 170, w: 60, t: 70, ws: 60, lv: 'S', sx: 'M' }; e.share.vis = { name: true, weightPct: true }; const q = Sh.buildShare(e, DAY); eq(q, { v: 1, d: DAY }); eq(Sh.emptyKeys(e, q).sort(), ['name', 'weightPct'])
})
await T('Partage : suivi cycle et récupération (jour du cycle, changement d’heure, plus de 60 jours, mode désactivé)', () => {
  const s = L.DEF(); s.cycle = { mode: 'cycle', starts: ['2026-10-10', '2026-09-01'], rec: { [DAY]: [1, 1, 1] }, en: { [DAY]: 4 } }; eq(Sh.cycleLine(s, DAY), { kind: 'cycle', txt: 'Jour 13 du cycle · énergie 4 sur 5' })
  s.cycle = { mode: 'cycle', starts: ['2026-10-20'], rec: { '2026-10-26': [5, 5, 5] }, en: {} }; eq(Sh.cycleLine(s, '2026-10-26'), { kind: 'cycle', txt: 'Jour 7 du cycle' }); eq(Sh.cycleLine(s, '2026-10-19'), null)
  s.cycle.starts = ['2026-08-01']; eq(Sh.cycleLine(s, DAY), null); s.cycle.starts = []; eq(Sh.cycleLine(s, DAY), null)
  s.cycle = { mode: 'recup', starts: ['2026-10-10'], rec: { [DAY]: [4, 3, 5] }, en: { [DAY]: 1, '2026-10-21': 2 } }; eq(Sh.cycleLine(s, DAY), { kind: 'recup', txt: 'Récupération 4 sur 5 · force 3 sur 5 · vitalité 5 sur 5' }); eq(Sh.cycleLine(s, '2026-10-21'), null) // en mode récupération, ni date de règles ni énergie du cycle ne sortent
  s.cycle.mode = 'off'; eq(Sh.cycleLine(s, DAY), null)
})

await T('Suivi : jour du cycle, phases (28 jours par défaut) et prochaines règles', () => {
  const at = n => Sv.cycleInfo(['2026-10-01'], Sv.addDays('2026-10-01', n - 1))
  eq([1, 5, 6, 12, 13, 14, 15, 16, 28, 29, 60].map(n => at(n).phase), ['regles', 'regles', 'folliculaire', 'folliculaire', 'ovulation', 'ovulation', 'ovulation', 'luteale', 'luteale', 'hors', 'hors'])
  eq([at(1).n, at(60).n, at(61).n, at(61).phase, at(61).next, at(61).inDays], [1, 60, null, null, null, null])
  eq(Sv.cycleInfo([], DAY), { last: null, n: null, len: 28, measured: 0, phase: null, next: null, inDays: null })
  eq(Sv.cycleInfo(['2026-10-01'], DAY), { last: '2026-10-01', n: 22, len: 28, measured: 0, phase: 'luteale', next: '2026-10-29', inDays: 7 })
  eq(Sv.cycleInfo(['2026-10-30'], DAY), { last: null, n: null, len: 28, measured: 0, phase: null, next: null, inDays: null }) // début dans le futur : ignoré
  eq([Sv.cycleInfo(['2026-10-22'], DAY).n, Sv.cycleInfo(['2026-10-22', '2026-10-22'], DAY).n], [1, 1]) // un doublon ne change rien
  eq(Sv.cycleInfo(['2026-09-12'], DAY).inDays, -12) // règles estimées dépassées : nombre négatif
})

await T('Suivi : durée du cycle = moyenne des six derniers écarts plausibles (15 à 60 jours)', () => {
  const g = (...gaps) => { let d = '2026-01-01'; const l = [d]; for (const x of gaps) { d = Sv.addDays(d, x); l.push(d) } return l }
  const len = (...gaps) => { const st = g(...gaps), i = Sv.cycleInfo(st, st[st.length - 1]); return [i.len, i.measured] }
  eq(len(30, 30), [30, 2]); eq(len(14), [28, 0]); eq(len(15), [15, 1]); eq(len(60), [60, 1]); eq(len(61), [28, 0])
  eq(len(27, 28), [28, 2]); eq(len(28, 29), [29, 2]) // moyenne arrondie
  eq(len(40, 28, 28, 28, 28, 28, 28), [28, 6]) // seuls les six derniers écarts comptent
  eq(len(28, 7, 28, 90, 28), [28, 3]) // un écart anormal (oubli, arrêt) n'entre pas dans la moyenne
  const st = g(30, 30); eq(Sv.cycleInfo([...st].reverse(), '2026-12-31'), Sv.cycleInfo(st, '2026-12-31')) // l'ordre de saisie est sans importance
  const l30 = g(30, 30); eq(Sv.cycleInfo(l30, '2026-03-12').phase, 'folliculaire'); eq(Sv.cycleInfo(l30, '2026-03-12').next, '2026-04-01') // 30 jours : ovulation vers le jour 16, phase folliculaire au jour 11
})

await T('Suivi : écarts en jours indépendants du fuseau horaire et du changement d’heure (Europe, États-Unis, Nouvelle-Zélande)', () => {
  eq([Sv.diffDays('2026-10-24', '2026-10-26'), Sv.diffDays('2026-03-28', '2026-03-30'), Sv.diffDays('2026-09-26', '2026-09-28'), Sv.diffDays('2026-04-04', '2026-04-06'), Sv.diffDays('2026-11-01', '2026-11-02'), Sv.diffDays('2026-03-08', '2026-03-09')], [2, 2, 2, 2, 1, 1])
  eq([Sv.addDays('2026-10-25', 1), Sv.addDays('2026-03-29', 1), Sv.addDays('2028-02-28', 1), Sv.addDays('2026-12-31', 1), Sv.addDays(DAY, -22)], ['2026-10-26', '2026-03-30', '2028-02-29', '2027-01-01', '2026-09-30'])
  eq(Sv.lastDays('2027-01-02', 4), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']); eq(Sv.lastDays(DAY, 1), [DAY]); eq(Sv.lastDays('2026-03-30', 3), ['2026-03-28', '2026-03-29', '2026-03-30'])
  eq([Sv.frDate(DAY), Sv.frDate(DAY, true), Sv.frDate('2026-03-29', true), Sv.frDate('2026-01-01')], ['22 octobre 2026', 'jeudi 22 octobre', 'dimanche 29 mars', '1 janvier 2026'])
  eq([Sv.fr1(2.3), Sv.fr1(3), Sv.avg([]), Sv.avg([2, 3, 2]), Sv.avg([1, 2])], ['2,3', '3', null, 2.3, 1.5])
})

await T('Suivi : ajout d’un début de règles (date réelle, ni future, ni double, ni vieille de plus de cinq ans, 400 au plus)', () => {
  const add = (st, d) => Sv.addStart(st, d, DAY)
  for (const d of ['', 'hier', '2026-13-01', '2026-02-30', '2026-2-3', '2026-10-22T10:00', '22/10/2026', ' 2026-10-20']) eq(add([], d), { ok: false, err: 'Choisissez une date valide.' })
  eq(add([], '2026-10-23'), { ok: false, err: 'Le début des règles ne peut pas être dans le futur.' }); eq(add([], DAY).ok, true)
  eq(add(['2026-10-10'], '2026-10-10'), { ok: false, err: 'Cette date est déjà enregistrée.' })
  eq(add([], Sv.addDays(DAY, -1826)).ok, true); eq(add([], Sv.addDays(DAY, -1827)), { ok: false, err: 'Cette date remonte à plus de cinq ans : vérifiez l’année.' })
  eq(add(Array.from({ length: 400 }, (_, i) => Sv.addDays(DAY, -30 - i)), DAY), { ok: false, err: 'Limite de 400 dates atteinte : retirez-en avant d’en ajouter.' })
  eq(add(['2026-09-12'], '2026-10-10'), { ok: true, starts: ['2026-09-12', '2026-10-10'], gap: 28, odd: false })
  eq(add(['2026-09-12', '2026-10-10'], '2026-10-20'), { ok: true, starts: ['2026-09-12', '2026-10-10', '2026-10-20'], gap: 10, odd: true })
  eq(add(['2026-08-01', '2026-10-10'], '2026-09-01'), { ok: true, starts: ['2026-08-01', '2026-09-01', '2026-10-10'], gap: 31, odd: false })
  eq(add(['2026-10-10'], '2026-06-01'), { ok: true, starts: ['2026-06-01', '2026-10-10'], gap: null, odd: true })
  const inp = ['2026-10-10']; add(inp, '2026-09-12'); eq(inp, ['2026-10-10']) // la liste d'origine n'est jamais modifiée
})

await T('Suivi : énergie par phase (3 notes au moins), séries sur 28 et 14 jours, moyennes de la semaine', () => {
  const en = { '2026-10-11': 2, '2026-10-12': 3, '2026-10-13': 2, '2026-10-15': 4, '2026-10-16': 5, '2026-10-17': 4, '2026-10-18': 5, [DAY]: 3, '2026-10-28': 1, '2026-10-29': 1, '2026-10-30': 1, '2026-09-01': 5 }
  const c = { mode: 'cycle', starts: ['2026-09-12', '2026-10-10'], rec: {}, en }
  eq(Sv.energyByPhase(c, DAY), [{ phase: 'regles', avg: 2.3, n: 3 }, { phase: 'folliculaire', avg: 4.5, n: 4 }]) // une seule note en phase d'ovulation, une note future et une note avant le premier début : ignorées
  const deux = { mode: 'cycle', starts: ['2026-10-10'], rec: {}, en: { '2026-10-11': 2, '2026-10-12': 4 } } // exactement deux notes dans la phase : pas de moyenne ; la troisième la fait apparaître
  eq(Sv.energyByPhase(deux, DAY), []); eq(Sv.energyByPhase({ ...deux, en: { ...deux.en, '2026-10-13': 3 } }, DAY), [{ phase: 'regles', avg: 3, n: 3 }])
  const s = Sv.energySeries(c, DAY, 28); eq([s.length, s[0].d, s[27].d, s[27].v, s[26].v], [28, '2026-09-25', DAY, 3, null])
  const r = { mode: 'recup', starts: [], en: {}, rec: { [DAY]: [4, 3, 5], '2026-10-20': [2, 2, 3], '2026-10-16': [1, 1, 1], '2026-10-15': [5, 5, 5] } }
  eq(Sv.recupAverages(r, DAY, 7), { n: 3, rec: 2.3, force: 2, vit: 3 }); eq(Sv.recupAverages(r, '2026-11-30', 7), null)
  eq(Sv.recupSeries(r, DAY, 14).filter(x => x.v).map(x => x.d), ['2026-10-15', '2026-10-16', '2026-10-20', DAY])
})

await T('Suivi : récupération basse = trois jours de suite à 2 ou moins (la série d’hier compte tant qu’aujourd’hui n’est pas noté)', () => {
  const d = n => Sv.addDays(DAY, -n), r = rec => ({ mode: 'recup', starts: [], en: {}, rec })
  yes(Sv.lowRecovery(r({ [d(2)]: [2, 4, 4], [d(1)]: [1, 3, 3], [DAY]: [2, 2, 2] }), DAY), 'trois jours bas')
  yes(Sv.lowRecovery(r({ [d(3)]: [2, 3, 3], [d(2)]: [2, 3, 3], [d(1)]: [1, 3, 3] }), DAY), 'série de la veille ignorée')
  yes(!Sv.lowRecovery(r({ [d(3)]: [2, 3, 3], [d(2)]: [2, 3, 3], [d(1)]: [1, 3, 3], [DAY]: [3, 3, 3] }), DAY), 'une bonne journée aujourd’hui interrompt la série')
  yes(!Sv.lowRecovery(r({ [d(1)]: [2, 3, 3], [DAY]: [2, 3, 3] }), DAY), 'deux jours seulement')
  yes(!Sv.lowRecovery(r({ [d(4)]: [2, 3, 3], [d(3)]: [2, 3, 3], [d(1)]: [2, 3, 3] }), DAY), 'journée manquante')
  yes(!Sv.lowRecovery(r({ [d(2)]: [3, 1, 1], [d(1)]: [2, 3, 3], [DAY]: [2, 3, 3] }), DAY), 'seule la récupération compte, pas la force ni la vitalité')
  yes(!Sv.lowRecovery(r({}), DAY), 'aucune note')
})

await T('Migration : une sauvegarde sans le champ « énergie » du suivi est complétée sans rien perdre', () => {
  mem.clear(); const o = L.DEF(); o.cycle = { mode: 'cycle', starts: ['2026-10-10'], rec: { [DAY]: [4, 3, 5] } }; mem.set('believe:v2', JSON.stringify(o)); const r = L.load()
  eq([r.err, r.s.cycle], [null, { mode: 'cycle', starts: ['2026-10-10'], rec: { [DAY]: [4, 3, 5] }, en: {} }])
})
await T('Partage : habitudes (taux de la semaine = bilan, plus longue série, noms jamais partagés), pas, quiz, lectures limitées à cinq', () => {
  const s = sentState(); s.share.vis = { habits: true, steps: true, quiz: true, books: true }
  s.checks = { '2026-10-19': ['h1', 'h2'], '2026-10-20': ['h1'], '2026-10-21': ['h1'], '2026-10-22': ['h1'] }; s.quiz.hist = [{ d: '2026-10-20', n: 5, ok: 4, cats: [] }, { d: '2026-10-21', n: 5, ok: 2, cats: [] }, { d: '2026-10-22', n: 5, ok: 5, cats: [], rev: true }]
  s.books = [...Array(7)].map((_, i) => ({ id: 'b' + i, t: 'Livre ' + i, a: 'A', st: 'cours' })).concat([{ id: 'z', t: 'Terminé', a: 'A', st: 'fini' }])
  const p = Sh.buildShare(s, DAY); eq(p.habits, { rate: Bl.bilanOf(s, DAY).rate, best: 4 }); eq(p.steps, { days: 1, km: 7.5 }); eq(p.quiz, { n: 2, avg: 60, last: 40 }); eq(p.books.length, 5); eq(p.books[0], { t: 'Livre 0', a: 'A' })
  eq(Sh.rowsOf(p).map(r => r.k), ['habits', 'steps', 'quiz', 'books']); eq(Sh.rowsOf(p).every(r => r.sens === false), true)
  s.quiz.hist = [{ d: '2026-10-22', n: 5, ok: 5, cats: [], rev: true }]; eq('quiz' in Sh.buildShare(s, DAY), false, 'révision seule comptée comme quiz')
})
await T('Partage : plafonds respectés (8 prières, 6 repas, 5 livres), textes longs coupés et mis sur une ligne, entrées vides ignorées', () => {
  const s = sentState(); for (const k of L.SHARE_KEYS) s.share.vis[k] = true
  s.prayers = [...Array(12)].map((_, i) => ({ id: 'p' + i, t: 'Prière ' + i + ' ' + 'x'.repeat(500), c: DAY, a: i % 2 ? DAY : null })).concat([{ id: 'vide', t: ' \n ', c: DAY, a: null }])
  s.meals = [...Array(10)].map((_, i) => ({ id: 'm' + i, d: DAY, n: 'Repas ' + i + '\n\n' + 'y'.repeat(300), kcal: 100, p: 1, g: 1, l: 1, src: 'manuel' }))
  s.books = [...Array(9)].map((_, i) => ({ id: 'b' + i, t: 'Titre ' + i + ' ' + 'z'.repeat(300), a: 'Auteur\n' + 'a'.repeat(200), st: 'cours' }))
  s.profile.name = '  Ada\n  Lovelace  ' + 'n'.repeat(100)
  const p = Sh.buildShare(s, DAY); eq(Sh.whyBad(p), null); eq([p.prayers.length, p.food.meals.length, p.books.length], [8, 6, 5]); eq(p.food.kcal, 1000, 'les calories comptent tous les repas du jour')
  eq([p.prayers[0].t.length, p.food.meals[0].length, p.books[0].t.length, p.books[0].a.length, p.who.length], [80, 40, 80, 60, 40]); yes(p.who.startsWith('Ada Lovelace') && !/\n/.test(p.who), p.who)
  yes(p.prayers[0].t.startsWith('Prière 11 ') && p.prayers[0].ok === true && p.prayers[1].ok === false && p.prayers[7].t.startsWith('Prière 4 '), 'ordre ou état exaucé des prières')
  yes(p.food.meals.every(m => !m.includes('\n')) && p.books.every(b => !b.a.includes('\n')), 'retour à la ligne conservé')
})
await T('Partage : lignes de l’aperçu (format français, pluriels, sensibles signalées, coche « exaucé »)', () => {
  const p = { v: 1, d: DAY, who: 'Ada', habits: { rate: 72, best: 1 }, badges: ['Premier pas'], steps: { days: 0, km: 12.34 }, quiz: { n: 1, avg: 80, last: 80 }, weight: { from: 71, now: 65.5, goal: 60 }, weightPct: 50, prayers: [{ t: 'Paix', ok: true }, { t: 'Travail', ok: false }], notes: [{ cat: 'Rêves', n: 2 }], food: { kcal: 900, meals: ['Soupe'] }, cycle: { kind: 'recup', txt: 'Récupération 4 sur 5 · force 3 sur 5 · vitalité 5 sur 5' } }
  eq(Sh.whyBad(p), null); const r = Object.fromEntries(Sh.rowsOf(p).map(x => [x.k, x]))
  eq(r.habits.l, ['Réussite : 72 %', 'Plus longue série en cours : 1 jour']); eq(r.steps.l, ['10 000 pas atteints : 0 jour cette semaine', 'Distance des séances : 12,3 km cette semaine']); eq(r.quiz.l, ['1 quiz terminé · moyenne 80 %', 'Dernier score : 80 %'])
  eq(r.weight.l, ['Départ 71 kg · actuel 65,5 kg · objectif 60 kg']); eq(r.weightPct.l, ['50 % du chemin parcouru']); eq(r.prayers.l, ['✓ Paix (exaucé)', '• Travail']); eq(r.cycle.h, 'Récupération'); eq(r.food.l, ['900 kcal', 'Soupe'])
  eq(Sh.rowsOf(p).filter(x => x.sens).map(x => x.k), ['weight', 'weightPct', 'cycle', 'food', 'prayers', 'notes']); eq(Sh.titleOf(p), 'Suivi de Ada'); eq(Sh.titleOf({ v: 1, d: DAY }), 'Mon suivi Believe'); eq(Sh.dateFr(DAY), '22 octobre 2026')
  yes(Sh.shareText(p).startsWith('Suivi de Ada · 22 octobre 2026\n\nHabitudes de la semaine\n– Réussite : 72 %'), Sh.shareText(p).slice(0, 80)); yes(Sh.shareText(p).endsWith('seuls les éléments que j’ai choisis y figurent.'))
})
const fake = (w = 10) => { const texts = [], calls = []; const c = { texts, calls, measureText: s => ({ width: w * s.length }), fillText: (s, x, y) => texts.push([s, x, y]), createLinearGradient: () => ({ addColorStop() {} }) }; for (const m of ['fillRect', 'save', 'restore', 'translate', 'scale', 'beginPath', 'arc', 'fill']) c[m] = () => calls.push(m); return c }
await T('Image de la carte : tout le texte dessiné vient des lignes de l’aperçu (aucun autre), les lignes longues sont coupées sans perte', () => {
  const s = sentState(); for (const k of L.SHARE_KEYS) s.share.vis[k] = true; s.books[0].t = 'Un livre au titre démesurément long '.repeat(2) + 'SENT_LIVRE_COURS'
  const p = Sh.buildShare(s, DAY), c = fake(), lay = Si.layoutCard(c, p), drawn = lay.ops.map(o => o.s)
  Si.paintCard(c, lay); eq(c.texts.map(t => t[0]), drawn); eq(hasAny(drawn.join('\n'), NEVER), [])
  const rows = Sh.rowsOf(p), body = drawn.join(' ')
  const allowed = new Set(['B', 'E', 'L', 'I', 'V'].concat([Sh.titleOf(p), Sh.dateFr(p.d), 'Aucun élément choisi.', 'Carte créée sur l’appareil avec Believe : seuls les éléments choisis y figurent.'].concat(rows.flatMap(r => [r.h].concat(r.l))).join(' ').split(/\s+/).filter(Boolean)))
  eq(body.split(/\s+/).filter(w => w && !allowed.has(w)), [], 'mot dessiné qui ne vient pas des lignes de l’aperçu')
  for (const r of rows) { yes(body.includes(r.h), r.h); for (const l of r.l) yes(body.replace(/\s+/g, ' ').includes(l.replace(/\s+/g, ' ').split(' ').slice(0, 3).join(' ')), l) }
  eq(lay.rules.length, rows.length - 1, 'un trait entre deux rubriques seulement')
  const long = lay.ops.filter(o => o.font.includes('32px')); yes(long.every(o => o.s.length * 10 <= 928 + 10), 'ligne plus large que la carte'); yes(lay.H >= 720 && lay.ops.every(o => o.y < lay.H), 'hauteur'); eq(Si.W, 1080)
  const joined = rows.find(r => r.k === 'books').l[0].replace(/\s+/g, ' '), pieces = lay.ops.filter(o => o.s.includes('livre') || o.s.includes('SENT_LIVRE_COURS') || o.s.includes('Auteur') || o.s.includes('démesurément')).map(o => o.s).join(' '); eq(pieces.replace(/\s+/g, ' '), joined)
})
await T('Image de la carte : titre raccourci par « … » s’il est trop large, carte vide = message sans donnée, génération refusée si la carte est invalide', async () => {
  const wide = fake(30), lay = Si.layoutCard(wide, { v: 1, d: DAY, who: 'A'.repeat(40) }); const t = lay.ops.find(o => o.font.includes('44px')); yes(t.s.endsWith('…') && t.s.length * 30 <= 762 + 30, t.s)
  const e = Si.layoutCard(fake(), { v: 1, d: DAY }); yes(e.ops.some(o => o.s === 'Aucun élément choisi.'))
  let err = ''; try { await Si.cardBlob({ v: 1, d: DAY, secret: 'x' }) } catch (x) { err = x.message }; yes(err.startsWith('Carte refusée'), err)
})
await T('Données : clés de visibilité connues et booléennes acceptées, clé inconnue ou valeur non booléenne refusée', () => {
  const s = L.DEF(); for (const k of L.SHARE_KEYS) s.share.vis[k] = true; yes(L.valid(s), L.why(s)); s.share.vis = { poids_secret: true }; yes(!L.valid(s)); s.share.vis = { weight: 'oui' }; yes(!L.valid(s)); s.share.vis = { ['__proto__']: true }; yes(!L.valid(s))
})

// Versets, accueil guidé, mur de prières et gratitudes
await T('Versets : 28 (Femme) + 29 (Homme), références uniques, textes non vides et terminés, traduction connue, référence prononcée sans chiffre en tête', () => {
  eq([L.VF.length, L.VM.length], [28, 29]); const all = [...L.VF, ...L.VM]
  eq(new Set(all.map(v => v[0])).size, 57); eq(new Set(all.map(v => v[1])).size, 57)
  for (const [ref, text, tr] of all) {
    yes(/^(\d )?\p{L}[\p{L} ]* \d+:\d+[ab]?$/u.test(ref), 'référence ' + ref); yes(text.length > 15 && /[.!?…]$/.test(text), 'texte de ' + ref); yes(!/['[\]]|\s\s/.test(text), 'typographie de ' + ref); yes(tr === undefined || tr === 'MAR', 'traduction de ' + ref)
    yes(!/^\d/.test(L.refSpoken(ref)) && /verset \d+/.test(L.refSpoken(ref)), 'lecture de ' + ref)
  }
  eq([L.trLabel(['x', 'y']), L.trLabel(['x', 'y', 'MAR'])], ['Louis Segond 1910 (domaine public)', 'Martin 1744 (domaine public)']); eq(L.refSpoken('Psaume 46:6'), 'Psaume 46, verset 6'); eq(L.refSpoken('1 Jean 1:9'), 'Première épître de Jean, chapitre 1, verset 9')
})
await T('Versets : la liste dépend du profil (Femme, Homme, ou les deux sans profil) et l’indice reste dans la liste', () => {
  const s = L.DEF(); eq(L.vlist(s).length, 57); s.profile = { g: 'F' }; eq(L.vlist(s).length, 28); s.profile = { g: 'M' }; eq(L.vlist(s).length, 29)
  for (const i of [0, 27, 28, 29, 56, 57, 1000, 99999]) { s.verse = { d: L.today(), i }; yes(L.curVerse(s) === L.VM[i % 29], 'verset attendu : indice ' + (i % 29) + ' pour i=' + i) }
})
await T('Accueil guidé : état neuf = à faire ; ancienne version (v1) ou profil déjà rempli = déjà fait ; l’indicateur est conservé à l’enregistrement', () => {
  mem.clear(); eq(L.load().s.ui.onboard, false); eq(L.DEF().ui, { onboard: false, verseDay: null, covers: false })
  const v1 = V1(); mem.set('believe:v1', JSON.stringify(v1)); eq(L.load().s.ui.onboard, true)
  mem.clear(); const v1b = V1(); v1b.profile = null; mem.set('believe:v1', JSON.stringify(v1b)); eq(L.load().s.ui.onboard, true) // ancienne version sans profil : pas d’accueil guidé non plus
  mem.clear(); const a = L.DEF(); a.profile = good().profile; mem.set('believe:v2', JSON.stringify(a)); eq(L.load().s.ui.onboard, true) // profil enregistré à l’étape 2 puis application fermée
  mem.clear(); const b = L.DEF(); yes(L.save(b)); eq(L.load().s.ui.onboard, false); b.ui.onboard = true; yes(L.save(b)); eq(L.load().s.ui.onboard, true)
  const c = L.DEF(); c.ui.verseDay = '26 octobre'; yes(!L.valid(c), 'date du verset du jour invalide acceptée'); c.ui.verseDay = '2026-10-22'; yes(L.valid(c))
})
await T('Mur de prières : gratitudes (k = « g ») acceptées, autre type refusé, texte vide ou trop long refusé, 1 000 éléments au plus, aller-retour JSON identique', () => {
  const why = f => { const s = full(); f(s); return L.why(s) }
  eq(why(s => { s.prayers.push({ id: 'g1', t: 'Merci', c: '2026-10-21', a: null, k: 'g' }) }), null)
  yes(why(s => { s.prayers.push({ id: 'g1', t: 'Merci', c: '2026-10-21', a: null, k: 'x' }) }), 'type inconnu accepté'); yes(why(s => { s.prayers[0].t = '' }), 'sujet vide accepté'); yes(why(s => { s.prayers[0].t = 'x'.repeat(501) }), 'sujet de 501 caractères accepté')
  eq(why(s => { s.prayers[0].t = 'x'.repeat(500) }), null); yes(why(s => { s.prayers = Array.from({ length: 1001 }, (_, i) => ({ id: 'p' + i, t: 'x', c: '2026-10-21', a: null })) }), '1001 sujets acceptés')
  eq(why(s => { s.prayers = Array.from({ length: 1000 }, (_, i) => ({ id: 'p' + i, t: 'x', c: '2026-10-21', a: null })) }), null); yes(why(s => { s.prayers[0].c = 'hier' }), 'date de création libre acceptée')
  const s = full(); s.prayers.push({ id: 'g1', t: 'Merci', c: '2026-10-21', a: null, k: 'g' }); const r = L.convert(JSON.parse(JSON.stringify(s))); eq(r.err, null); eq(r.s.prayers, s.prayers)
})
await T('Partage : les gratitudes ne sortent jamais, même avec « Mes sujets de prière » coché ; seules les prières sont partagées', () => {
  const s = sentState(); for (const k of L.SHARE_KEYS) s.share.vis[k] = true
  const p = Sh.buildShare(s, DAY); eq(p.prayers, [{ t: 'SENT_PRIERE', ok: false }]); eq(hasAny(flat(p), ['SENT_GRATITUDE']), [])
  const g = sentState(); g.prayers = g.prayers.filter(x => x.k === 'g'); for (const k of L.SHARE_KEYS) g.share.vis[k] = true
  const q = Sh.buildShare(g, DAY); yes(!('prayers' in q), 'clé prayers présente pour des gratitudes seules'); eq(hasAny(flat(q), ['SENT_GRATITUDE']), []); yes(Sh.emptyKeys(g, q).includes('prayers'), 'la catégorie vide n’est pas signalée')
  yes(Sh.NEVER_SHARED.some(x => /gratitudes/.test(x)), 'gratitudes non listées comme jamais partagées'); yes(/gratitudes ne sont jamais partagées/.test(Sh.SHARE_ITEMS.find(i => i.k === 'prayers').d), 'description de la case sans mention des gratitudes')
})

// Image d'un plat : fonction serveur api/img.ts (API Gemini simulée) et appel côté application
const PNG = 'iVBORw0KGgoAAAANSUhEUg=='
const prevFetch = globalThis.fetch // les tests précédents ont pu remplacer l'API simulée : on remet celle de Gemini (mêmes variables `up` et `seen`)
globalThis.fetch = async (url, init) => { if (up.throw) throw up.throw; seen = { url: String(url), init: init || {}, body: init && init.body ? JSON.parse(init.body) : null }; return { ok: up.ok, status: up.status, json: async () => up.body } }
const GIMG = (parts, extra = {}) => ({ ok: true, status: 200, body: { modelVersion: 'gemini-nano-banana-2.1', candidates: [{ content: { parts }, finishReason: 'STOP', ...extra }] } })
const img = (b, h = {}, method = 'POST') => call(Img, { method, headers: { 'x-forwarded-for': '10.7.0.' + ++ipn, ...h }, body: b })
const okImg = () => { up = GIMG([{ text: 'Voici.' }, { inlineData: { mimeType: 'image/png', data: PNG } }]) }
await T('Serveur image : méthode, clé absente (503), titre manquant ou ingrédients mal formés (400)', async () => {
  process.env.GEMINI_API_KEY = 'AIza-img-test'; okImg()
  eq([(await img({ title: 'Soupe' }, {}, 'GET')).code, (await img({ title: '   ' })).body.error, (await img({})).body.error, (await img({ title: 42 })).body.error, (await img({ title: 'Soupe', ingredients: 'oeufs' })).body.error], [405, 'bad_request', 'bad_request', 'bad_request', 'bad_request'])
  delete process.env.GEMINI_API_KEY; eq((await img({ title: 'Soupe' })).code, 503); process.env.GEMINI_API_KEY = 'AIza-img-test'
  eq((await img({ title: 'Soupe' })).code, 200)
})
await T('Serveur image : requête Gemini conforme à la documentation (v1, clé en en-tête, TEXT+IMAGE, 4:3, 1K), réponse { image, mime }, clé jamais renvoyée', async () => {
  okImg(); up.body.modelVersion = 'gemini-nano-banana-2.1-001'; const r = await img({ title: 'Salade de quinoa', ingredients: ['quinoa', 'concombre', 'feta'] })
  eq([r.code, r.body.image, r.body.mime, r.body.model], [200, PNG, 'image/png', 'gemini-nano-banana-2.1-001'])
  eq(seen.url, 'https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent'); eq(seen.init.headers['x-goog-api-key'], 'AIza-img-test'); eq(seen.init.method, 'POST')
  eq(seen.body.generationConfig, { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:3', imageSize: '1K' } }); eq(seen.body.contents.length, 1)
  const t = seen.body.contents[0].parts[0].text; yes(t.includes('« Salade de quinoa »') && t.includes('quinoa, concombre, feta') && t.includes('Aucun texte, aucun logo, aucune personne'), t)
  yes(!JSON.stringify(r.body).includes('AIza'), 'clé renvoyée au navigateur'); yes(!seen.url.includes('AIza') && !JSON.stringify(seen.body).includes('AIza'), 'clé dans l’adresse ou le corps')
  process.env.AI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image'; await img({ title: 'Soupe' }); yes(seen.url.endsWith('/models/gemini-3.1-flash-lite-image:generateContent'), seen.url); delete process.env.AI_IMAGE_MODEL
  delete up.body.modelVersion; eq((await img({ title: 'Soupe' })).body.model, 'gemini-nano-banana-2.1') // sans version renvoyée, le nom du modèle demandé
})
await T('Serveur image : seuls le titre et les ingrédients nettoyés entrent dans la consigne (contrôles, guillemets, accolades, 100 / 60 caractères, 12 ingrédients)', async () => {
  okImg(); await img({ title: '  Poulet\n« rôti » {x} [y] `z` "q" \\ <b>  ' + 'A'.repeat(300), ingredients: ['  ail\u0000 ', 7, null, '', ...Array.from({ length: 20 }, (_, i) => 'ing' + i + 'B'.repeat(80))] })
  const t = seen.body.contents[0].parts[0].text, titre = t.slice(t.indexOf('« ') + 2, t.lastIndexOf(' »'))
  yes(titre.startsWith('Poulet « rôti »'), titre); yes(titre.length <= 100, 'titre trop long ' + titre.length); yes(!/[{}\[\]`"\\<>\u0000-\u001f]/.test(t.replace(/[«»]/g, '')), 'signes de mise en forme conservés')
  const ing = t.slice(t.indexOf('préparé avec : ') + 15, t.indexOf('. Plat')).split(', '); eq(ing.length, 12); eq(ing[0], 'ail'); yes(ing.every(x => x.length <= 60), 'ingrédient trop long')
  await img({ title: 'Soupe', ingredients: [] }); yes(!seen.body.contents[0].parts[0].text.includes('préparé avec'), 'ingrédients vides')
  await img({ title: 'Soupe', ingredients: [...Array(49).fill(''), 'tôt'] }); yes(seen.body.contents[0].parts[0].text.includes('préparé avec : tôt'), 'ingrédient en 50e position ignoré')
  await img({ title: 'Soupe', ingredients: [...Array(50).fill(''), 'tard'] }); yes(!seen.body.contents[0].parts[0].text.includes('tard'), 'ingrédient en 51e position pris en compte')
})
await T('Serveur image : image finale = dernière image hors réflexion, snake_case toléré, type d’image contrôlé', async () => {
  up = GIMG([{ inlineData: { mimeType: 'image/png', data: 'AAAA' }, thought: true }, { inline_data: { mime_type: 'IMAGE/JPEG', data: 'QUJD' } }, { text: 'fin' }]); let r = await img({ title: 'Soupe' }); eq([r.code, r.body.image, r.body.mime], [200, 'QUJD', 'image/jpeg'])
  up = GIMG([{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }, { inlineData: { mimeType: 'image/webp', data: 'BBBB' } }]); r = await img({ title: 'Soupe' }); eq([r.body.image, r.body.mime], ['BBBB', 'image/webp'])
  for (const [parts, why] of [[[{ text: 'rien' }], 'texte seul'], [[{ inlineData: { mimeType: 'text/html', data: 'QUJD' } }], 'type html'], [[{ inlineData: { mimeType: 'image/svg+xml', data: 'QUJD' } }], 'svg'], [[{ inlineData: { mimeType: 'image/png', data: 'pas base64 !' } }], 'base64 invalide'], [[{ inlineData: { mimeType: 'image/png', data: 'A'.repeat(3400001) } }], 'trop lourde'], [[{ inlineData: { mimeType: 'image/png', data: 'AAAA' }, thought: true }], 'réflexion seule'], [[], 'aucune partie']]) {
    up = GIMG(parts); r = await img({ title: 'Soupe' }); eq([r.code, r.body.error], [502, 'invalid'], why)
  }
  up = GIMG([{ inlineData: { mimeType: 'image/png', data: 'A'.repeat(3400000) } }]); eq((await img({ title: 'Soupe' })).code, 200) // la limite est incluse
})
await T('Serveur image : blocage de sécurité = 422, erreurs du service Google traduites, délai dépassé = 504, réseau = 502', async () => {
  up = { ok: true, status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } }; eq([(await img({ title: 'Soupe' })).code, (await img({ title: 'Soupe' })).body.error], [422, 'blocked'])
  for (const f of ['SAFETY', 'IMAGE_SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'RECITATION']) { up = GIMG([{ text: 'Je ne peux pas.' }], { finishReason: f }); const r = await img({ title: 'Soupe' }); eq([r.code, r.body.error], [422, 'blocked'], f) }
  up = GIMG([{ text: 'Je ne peux pas.' }], { finishReason: 'OTHER' }); eq((await img({ title: 'Soupe' })).body.error, 'invalid')
  const e = async (status) => { up = { ok: false, status, body: {} }; const r = await img({ title: 'Soupe' }); return [r.code, r.body.error] }
  eq([await e(429), await e(404), await e(400), await e(401), await e(403), await e(500)], [[429, 'quota'], [502, 'model'], [502, 'rejected'], [502, 'rejected'], [502, 'rejected'], [502, 'upstream']])
  const ab = new Error('a'); ab.name = 'AbortError'; up = { throw: ab }; eq([(await img({ title: 'Soupe' })).code, (await img({ title: 'Soupe' })).body.error], [504, 'timeout']); up = { throw: new Error('dns') }; eq([(await img({ title: 'Soupe' })).code, (await img({ title: 'Soupe' })).body.error], [502, 'network'])
})
await T('Serveur image : code d’accès, origine, 6 images / 10 min / IP et plafond quotidien propre aux images (AI_IMAGE_DAILY_LIMIT), indépendant de celui du texte', async () => {
  okImg(); process.env.ACCESS_CODE = 'sésame'; const b = { title: 'Soupe' }
  eq([(await img(b)).code, (await img(b, { 'x-access-code': 'faux' })).code, (await img(b, { 'x-access-code': 'sésame' })).code], [401, 401, 200]); delete process.env.ACCESS_CODE
  eq([(await img(b, { origin: 'https://evil.example', host: 'app.example' })).code, (await img(b, { origin: 'https://app.example', host: 'app.example' })).code], [403, 200])
  let c = []; for (let i = 0; i < 7; i++) c.push((await call(Img, { headers: { 'x-forwarded-for': '9.9.9.9' }, body: b })).code); eq(c, [200, 200, 200, 200, 200, 200, 429])
  process.env.AI_IMAGE_DAILY_LIMIT = '2'; process.env.AI_DAILY_LIMIT = '1'; process.env.ACCESS_CODES = 'lea:i1,tom:i2'; const m = n => img(b, { 'x-access-code': n })
  eq([(await m('i1')).code, (await m('i1')).code, (await m('i1')).code, (await m('i2')).code], [200, 200, 429, 200]); eq((await m('i1')).body.error, 'daily')
  const t = n => ask({ mode: 'sport', messages: msgs(1) }, { 'x-access-code': n }); eq([(await t('i2')).code, (await t('i2')).code], [200, 429]) // le plafond du texte (1) s'applique au texte seulement
  eq((await m('i2')).code, 200) // tom a déjà fait 1 image et atteint son plafond de texte : sa 2e image reste permise (plafond des images : 2)
  delete process.env.AI_IMAGE_DAILY_LIMIT; delete process.env.AI_DAILY_LIMIT; delete process.env.ACCESS_CODES; delete process.env.GEMINI_API_KEY
})
await T('Serveur image : plafond quotidien de 20 par défaut ; « 0 » = sans limite ; valeur illisible, vide ou négative = 20 (jamais « sans limite » par faute de frappe) ; 2,9 = 2 images', async () => {
  okImg(); process.env.GEMINI_API_KEY = 'AIza-img-test'
  // 6 appels toutes les 10 minutes au plus : l'horloge avance de 11 minutes entre deux séries pour n'éprouver que le plafond du jour
  const first = async (env, ip, n = 30) => {
    if (env === undefined) delete process.env.AI_IMAGE_DAILY_LIMIT; else process.env.AI_IMAGE_DAILY_LIMIT = env
    const realNow = Date.now; let t = realNow(); Date.now = () => t; const r = []
    try { for (let i = 0; i < n; i++) { if (i && i % 6 === 0) t += 11 * 60000; const x = await call(Img, { headers: { 'x-forwarded-for': ip }, body: { title: 'Soupe' } }); r.push(x.code === 200 ? 200 : x.body.error) } } finally { Date.now = realNow }
    const i = r.findIndex(x => x !== 200); return i < 0 ? n : r[i] === 'daily' ? i : 'autre : ' + r[i]
  }
  const cases = [[undefined, 20], ['', 20], ['   ', 20], ['abc', 20], ['NaN', 20], ['Infinity', 20], ['-3', 20], ['20', 20], ['5', 5], [' 7 ', 7], ['2.9', 2], ['0', 30]]
  const got = []; for (const [i, [env]] of cases.entries()) got.push(await first(env, '10.8.1.' + (i + 1)))
  eq(got, cases.map(c => c[1]), JSON.stringify(cases.map(c => c[0]))); delete process.env.AI_IMAGE_DAILY_LIMIT; delete process.env.GEMINI_API_KEY
})
await T('Serveurs : chaque fonction tient son compteur quotidien partagé (KV) sous son propre nom — ai, ext, yt, img — pour que le plafond de l’une ne consomme jamais celui d’une autre', async () => {
  const saved = globalThis.fetch, keys = [], env = { KV_REST_API_URL: 'https://kv.example/', KV_REST_API_TOKEN: 'kv-token', GEMINI_API_KEY: 'AIza-kv', YOUTUBE_API_KEY: 'yt-kv' }
  const before = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]))
  Object.assign(process.env, env)
  globalThis.fetch = async (url, init) => {
    if (new URL(String(url)).hostname === 'kv.example') { keys.push(JSON.parse(init.body)[0][1]); return { ok: true, status: 200, json: async () => [{ result: 1 }, { result: 1 }] } }
    return saved(url, init)
  }
  try { okImg(); await ask({ mode: 'sport', messages: msgs(1) }); await ext({ q: 'dune' }); await yt({ q: 'louange' }); await img({ title: 'Soupe' }) }
  finally { globalThis.fetch = saved; for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
  eq(keys.map(k => (/^believe:([a-z]+):\d{4}-\d{2}-\d{2}:[0-9a-f]{24}$/.exec(k) ?? [])[1]), ['ai', 'ext', 'yt', 'img'])
})
await T('Serveur image : délai de 50 s pour Google (la fonction dure 60 s au plus), minuterie annulée en cas de succès comme d’erreur, annulation effective à l’échéance', async () => {
  process.env.GEMINI_API_KEY = 'AIza-img-test'
  const st = globalThis.setTimeout, ct = globalThis.clearTimeout, set = [], cleared = []
  globalThis.setTimeout = (f, ms, ...a) => { const id = st(f, ms, ...a); set.push([id, ms, f]); return id }
  globalThis.clearTimeout = id => { cleared.push(id); return ct(id) }
  try {
    okImg(); await img({ title: 'Soupe' })
    const a = set.filter(x => x[1] === 50000); eq(a.length, 1, 'une minuterie de 50 s attendue'); yes(cleared.includes(a[0][0]), 'minuterie non annulée après un succès')
    eq(seen.init.signal.aborted, false); a[0][2](); eq(seen.init.signal.aborted, true, 'la requête vers Google n’est pas interrompue à l’échéance')
    set.length = 0; cleared.length = 0; up = { throw: new Error('dns') }; await img({ title: 'Soupe' })
    const b = set.filter(x => x[1] === 50000); eq(b.length, 1); yes(cleared.includes(b[0][0]), 'minuterie non annulée après une erreur')
  } finally { globalThis.setTimeout = st; globalThis.clearTimeout = ct; delete process.env.GEMINI_API_KEY }
  const v = JSON.parse(readFileSync('vercel.json', 'utf8')); yes(50000 < v.functions['api/img.ts'].maxDuration * 1000, 'le délai de Google doit être inférieur à la durée maximale de la fonction')
})
await T('Client image : adresse « data: » prête à afficher, corps limité au titre et aux ingrédients, code d’accès envoyé, erreurs traduites', async () => {
  const keep = globalThis.fetch; let req = null
  const resp = (status, body, type = 'application/json') => async (u, i) => { req = { u: String(u), i }; return { status, ok: status < 400, headers: { get: () => type }, json: async () => body } }
  globalThis.fetch = resp(200, { image: PNG, mime: 'image/png' }); C.setCode('abc')
  eq(await C.askImage('Soupe', ['a', 'b'], new AbortController().signal), 'data:image/png;base64,' + PNG); eq(req.u, '/api/img'); eq(JSON.parse(req.i.body), { title: 'Soupe', ingredients: ['a', 'b'] }); eq(req.i.headers['x-access-code'], 'abc'); eq(req.i.method, 'POST'); C.setCode('')
  const fail = async f => { globalThis.fetch = f; try { await C.askImage('Soupe', [], new AbortController().signal) } catch (e) { return e.message } return 'pas d’erreur' }
  eq([await fail(resp(200, { image: PNG, mime: 'image/svg+xml' })), await fail(resp(200, { image: 'pas base64 !', mime: 'image/png' })), await fail(resp(200, { mime: 'image/png' })), await fail(resp(200, { image: PNG, mime: 'image/png;x' }))], ['upstream', 'upstream', 'upstream', 'upstream'])
  eq([await fail(resp(404, null)), await fail(resp(200, null, 'text/html; charset=utf-8')), await fail(async () => { throw new Error('net') }), await fail(async () => { const e = new Error('a'); e.name = 'AbortError'; throw e })], ['not_configured', 'not_configured', 'offline', 'cancelled'])
  eq([await fail(resp(429, { error: 'daily' })), await fail(resp(422, { error: 'blocked' })), await fail(resp(502, { error: 'timeout' }))], ['daily', 'blocked', 'timeout']); globalThis.fetch = keep
})
globalThis.fetch = prevFetch
await T('Serveur : aucune journalisation (clé et contenus)', () => eq(logs, 0))
globalThis.fetch = real

const bad = rows.filter(r => r[0] !== 'OK').length
process.stdout.write(rows.map(r => r[0].padEnd(6) + ' ' + r[1]).join('\n') + `\n\n${rows.length - bad}/${rows.length} réussis, ${bad} échec(s) (TZ=${process.env.TZ || 'système'})\n`)
process.exit(bad ? 1 : 0)
