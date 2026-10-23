#!/usr/bin/env node
// Compare chaque verset de src/verses.ts aux éditions numériques intégrales de la Bible Louis Segond 1910 et de la Bible Martin 1744 (domaine public).
// Échoue (code 1) au moindre écart : mot différent, verset introuvable, extrait coupé en milieu de phrase, doublon, traduction ou livre inconnu.
//
//   npm run verify:verses                                    télécharge les deux éditions (dépôt ouvert « Holy-Bible-XML-Format »)
//   node scripts/verify-verses.mjs --lsg=FrenchBible.xml --mar=FrenchMartinBible.xml     fichiers déjà téléchargés
//   node scripts/verify-verses.mjs --src=chemin/verses.ts     contrôle un autre module (sert à éprouver ce script)
// Derrière un proxy : NODE_USE_ENV_PROXY=1 npm run verify:verses (le téléchargement utilise le fetch de Node).
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) ?? '').slice(k.length + 3)
const BASE = 'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/'
const SOURCES = { LSG: { file: 'FrenchBible.xml', path: arg('lsg') }, MAR: { file: 'FrenchMartinBible.xml', path: arg('mar') } }

/** Livres de la Bible, dans l'ordre de l'édition numérique (numéro = position + 1). */
const BOOKS = ['Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome', 'Josué', 'Juges', 'Ruth', '1 Samuel', '2 Samuel', '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras', 'Néhémie', 'Esther', 'Job', 'Psaume', 'Proverbes', 'Ecclésiaste', 'Cantique des cantiques', 'Ésaïe', 'Jérémie', 'Lamentations', 'Ézéchiel', 'Daniel', 'Osée', 'Joël', 'Amos', 'Abdias', 'Jonas', 'Michée', 'Nahum', 'Habacuc', 'Sophonie', 'Aggée', 'Zacharie', 'Malachie', 'Matthieu', 'Marc', 'Luc', 'Jean', 'Actes', 'Romains', '1 Corinthiens', '2 Corinthiens', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens', '1 Thessaloniciens', '2 Thessaloniciens', '1 Timothée', '2 Timothée', 'Tite', 'Philémon', 'Hébreux', 'Jacques', '1 Pierre', '2 Pierre', '1 Jean', '2 Jean', '3 Jean', 'Jude', 'Apocalypse']
/**
 * Psaumes : décalage à ajouter au verset IMPRIMÉ (numérotation française) pour obtenir le verset de l'édition numérique, qui compte le titre dans le verset 1.
 * Chaque psaume cité doit figurer ici après contrôle : -1 quand l'imprimé numérote le titre (verset 1) à part, -2 pour un titre de deux versets (Psaume 51), 0 quand le titre fait corps avec le verset 1.
 */
const PS = { 18: -1, 27: 0, 31: -1, 34: -1, 46: -1, 51: -2, 103: 0, 126: 0, 139: 0, 144: 0 }

/** Retouches typographiques admises, annulées des deux côtés avant de comparer : apostrophe courbe, œ, É, Ô, espaces. */
const norm = s => s.replace(/[’‘]/g, "'").replace(/œ/g, 'oe').replace(/Œ/g, 'Oe').replace(/É/g, 'E').replace(/Ô/g, 'O').replace(/\s+/g, ' ').trim()
const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&')

function parse(xml) {
  const out = new Map()
  for (const b of xml.matchAll(/<book number="(\d+)">([\s\S]*?)<\/book>/g))
    for (const c of b[2].matchAll(/<chapter number="(\d+)">([\s\S]*?)<\/chapter>/g))
      for (const v of c[2].matchAll(/<verse number="(\d+)">([\s\S]*?)<\/verse>/g)) out.set(b[1] + ':' + c[1] + ':' + v[1], unxml(v[2]).trim())
  return out
}
async function edition(tr) {
  const { file, path } = SOURCES[tr]
  const xml = path ? await readFile(path, 'utf8') : await fetch(BASE + file).then(r => { if (!r.ok) throw new Error('téléchargement impossible : ' + BASE + file + ' (' + r.status + ')'); return r.text() })
  const m = parse(xml)
  if (m.size < 30000) throw new Error('édition ' + tr + ' illisible ou incomplète (' + m.size + ' versets)')
  return { m, label: path || BASE + file }
}

/** Les modules de verses.ts sont lus tels quels (TypeScript compilé à la volée) : on contrôle le fichier livré, pas une copie. */
async function loadVerses() {
  const out = join(tmpdir(), 'believe-verses-' + process.pid + '.mjs')
  await build({ entryPoints: [arg('src') || join(process.cwd(), 'src/verses.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
  return import(pathToFileURL(out).href)
}

/**
 * Cherche `disp` dans le verset source. Il doit commencer au début du verset ou après une fin de phrase, et finir à la fin du verset ou à une fin de phrase.
 * Un « … » final remplace une virgule, un point-virgule ou deux-points qui terminent le verset source.
 */
function locate(src, disp) {
  let d = norm(disp), ell = false
  if (d.endsWith('…')) { ell = true; d = d.slice(0, -1).trimEnd() }
  if (!d) return null
  for (let i = src.indexOf(d); i >= 0; i = src.indexOf(d, i + 1)) {
    const end = i + d.length
    const startOk = i === 0 || /[.!?:;] $/.test(src.slice(0, i))
    const tail = ell ? end === src.length - 1 && /[,;:]/.test(src[src.length - 1]) : end === src.length
    const mid = !ell && end < src.length && /[.!?:;]/.test(src[end - 1]) && src[end] === ' '
    if (startOk && (tail || mid)) return { i, tail, whole: i === 0 && tail }
  }
  return null
}

const errors = []
const fail = (ref, msg) => errors.push(ref + ' : ' + msg)
const { VF, VM } = await loadVerses()
const ed = {}
for (const tr of Object.keys(SOURCES)) ed[tr] = await edition(tr)

let n = 0
const seenRef = new Set(), seenText = new Set()
for (const [list, name] of [[VF, 'VF'], [VM, 'VM']]) {
  if (list.length < 20) fail(name, 'au moins 20 versets attendus, ' + list.length + ' trouvés')
  for (const v of list) {
    const [ref, text, trKey] = v, tr = trKey ?? 'LSG', k = ref + ' (' + tr + ')'
    n++
    if (seenRef.has(ref)) fail(k, 'référence en double')
    if (seenText.has(norm(text))) fail(k, 'texte en double')
    seenRef.add(ref); seenText.add(norm(text))
    if (!ed[tr]) { fail(k, 'traduction inconnue'); continue }
    const m = /^(.+) (\d+):(\d+)([ab])?$/.exec(ref)
    if (!m) { fail(k, 'référence mal formée (attendu : « Livre 3:16 » ou « Livre 3:16b »)'); continue }
    const bi = BOOKS.indexOf(m[1])
    if (bi < 0) { fail(k, 'livre inconnu : ' + m[1]); continue }
    const psalm = m[1] === 'Psaume', ch = +m[2]
    if (psalm && !(ch in PS)) { fail(k, 'numérotation du psaume ' + ch + ' non vérifiée : à contrôler puis à ajouter dans PS'); continue }
    const vs = +m[3] + (psalm ? PS[ch] : 0)
    let src = ed[tr].m.get((bi + 1) + ':' + ch + ':' + vs)
    if (src === undefined) { fail(k, 'verset introuvable dans l’édition (' + (bi + 1) + ':' + ch + ':' + vs + ')'); continue }
    if (tr === 'MAR') src = src.replace(/[[\]]/g, '') // crochets : mots ajoutés par les traducteurs
    src = norm(src)
    const at = locate(src, text)
    if (!at) { fail(k, 'texte différent de l’édition, ou extrait qui ne commence ou ne finit pas à une limite de phrase\n    attendu : ' + src + '\n    trouvé  : ' + text); continue }
    const suf = m[4]
    if (suf === 'a' && !(at.i === 0 && !at.tail)) fail(k, 'suffixe « a » : le texte doit commencer au début du verset et s’arrêter avant sa fin')
    else if (suf === 'b' && !(at.i > 0 && at.tail)) fail(k, 'suffixe « b » : le texte doit commencer après une fin de phrase et aller jusqu’à la fin du verset')
    else if (!suf && !(at.whole || (psalm && at.i > 0 && at.tail))) fail(k, 'texte incomplet sans suffixe « a » ou « b » (seul l’intitulé d’un psaume peut être omis)')
  }
}
const both = VF.filter(v => VM.some(w => w[0] === v[0])).map(v => v[0])
if (both.length) fail('VF/VM', 'versets présents dans les deux listes : ' + both.join(', '))

console.log('Éditions : ' + Object.entries(ed).map(([k, e]) => k + ' ← ' + e.label).join(' ; '))
if (errors.length) { console.error('\n' + errors.length + ' ÉCART(S) sur ' + n + ' versets :\n- ' + errors.join('\n- ')); process.exit(1) }
console.log('OK : ' + n + ' versets (' + VF.length + ' profil Femme, ' + VM.length + ' profil Homme) identiques aux éditions, mot pour mot.')
