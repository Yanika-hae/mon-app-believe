import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { DEF, KEY, load, roll, save, today, wipeLocal } from './lib'
import type { State } from './lib'
import Home, { VerseModal } from './Home'
import { focusPrayerField } from './Prayers'
import Logo from './Logo'
import Onboarding from './Onboarding'
import { Badge, Dialog, Skeleton, haptic, useSwipe } from './ui'
import type { Msg, P, Upd } from './ui'
import { abortRun, useRun } from './run'
import { discardRec, useRec } from './rec'
import { mmss } from './util'
import Lock from './Lock'
import { RemindBanner, useReminders } from './Reminders'
import { hasPin, readPin } from './pin'
import { resetP, usePomo } from './pomo'
import { wipeIDB } from './idb'
import { clock } from './geo'
import { left } from './cal'

interface Rub { i: number; t: string; s: string; d?: string; m: string }
type Pg = ComponentType<P & { purge: () => Promise<boolean>; inst: (() => void) | null; pinChanged: () => void }>
const L = (f: () => Promise<{ default: ComponentType<any> }>) => ({ load: f, C: lazy(f) as unknown as Pg })
/** Pages chargées à la demande (une par rubrique, hors accueil) : le premier affichage reste léger. */
const PG: Record<string, ReturnType<typeof L>> = {
  1: L(() => import('./Profil')), 3: L(() => import('./AIPage')), 5: L(() => import('./DataPage')), 6: L(() => import('./Habits')), 7: L(() => import('./Sport')),
  8: L(() => import('./Sante')), 9: L(() => import('./Pro')), 10: L(() => import('./MediaPage')), 11: L(() => import('./Notes')), 12: L(() => import('./Library')), 13: L(() => import('./Academy')), legal: L(() => import('./LegalPage'))
}

/** Page affichée. `will-change` n'est posé que le temps de l'animation d'entrée : posé en permanence, il garderait un calque par page et ancrerait à la page les éléments en position fixe. */
function View({ cls, children }: { cls: string; children: ReactNode }) {
  const [wc, setWc] = useState(true)
  useEffect(() => { const t = setTimeout(() => setWc(false), 800); return () => clearTimeout(t) }, []) // repli : mouvement réduit (aucune animation, donc aucun événement de fin)
  return <div className={'view' + cls + (wc ? ' wc' : '')} onAnimationEnd={e => { if (e.target === e.currentTarget) setWc(false) }}>{children}</div>
}

function Stub({ r }: { r: Rub }) {
  return (<><h1>{r.i}. {r.t}</h1><p><Badge s={r.s} /></p><div className="card"><p style={{ margin: 0 }}><b>{r.s === 'C' ? 'Configuration requise. ' : ''}</b>{r.m}</p></div><p className="mut">Cette rubrique sera construite dans un prochain module.</p></>)
}
/** Bandeau d'enregistrement audio : isolé pour que seule cette ligne se redessine pendant l'enregistrement. */
function RecBanner({ a }: { a: string }) {
  const r = useRec()
  if (a === '11' || r.owner === 'academie' || (r.st !== 'rec' && r.st !== 'done')) return null // l'auto-écoute de l'académie vit sur son écran et s'efface en le quittant
  return <a className="ban" href="#/11/audio" style={{ display: 'block', color: 'inherit' }}>{r.st === 'rec' ? '● Enregistrement en cours (' + mmss(r.ms) + ') : retour au dictaphone' : 'Un enregistrement n’est pas encore sauvegardé : ouvrir le dictaphone'}</a>
}
const Menu = () => (<><h1>Rubriques</h1>{R.map(r => <a key={r.i} className="li" href={'#/' + r.i}><span>{r.i}. {r.t}</span><Badge s={r.s} /></a>)}<p><a href="#/statut">État des fonctionnalités</a></p></>)
const Status = () => (
  <>
    <h1>État des fonctionnalités</h1>
    <p className="mut">Contrôles exécutés : compilation TypeScript (application et fonctions serveur), build PWA, tests automatisés des calculs, de la migration des données, du PIN, du partage avec des amis (aucune donnée masquée dans la carte, le texte ni l’image), des rappels de tâches (vrai service worker), d’IndexedDB, de l’enregistreur audio et du métronome (appels simulés), parcours d’interface simulés (jsdom), parcours dans un vrai Chromium (faux micro, moteur de dictée simulé puis réel, IndexedDB réel, hors ligne, accessibilité WCAG 2.1 AA dans 3 thèmes) et contrastes de couleurs. Non exécuté : appareils réels (GPS, podomètre, vrai micro et vraie voix pour la dictée, vibration, installation et notifications sur iOS et Android), appels réels à Gemini, à YouTube et à l’API d’image de Google.</p>
    {R.map(r => <div className="li" style={{ display: 'block' }} key={r.i}><b>{r.i}. {r.t}</b> <Badge s={r.s} /><br />{r.d && <><span className="ok">Fait :</span> {r.d}<br /></>}<span className="mut">Reste : {r.m}</span></div>)}
  </>
)

const R: Rub[] = [
  { i: 1, t: 'Identité et profil', s: 'O', d: 'Profil complet (Femme ou Homme, prénom, âge, taille, poids de départ, actuel et cible, niveau, sexe utilisé dans les formules de santé, champ distinct et modifiable), accueil guidé en quelques écrans (ignorable), accords Prêt/Prête, Mifflin-St Jeor, objectif dangereux refusé, logo animé, versets adaptés au profil (28 pour Femme, 29 pour Homme), suivi du cycle ou de la récupération (rubrique 8).', m: 'Les versets sont une sélection (Louis Segond 1910 et Martin 1744, domaine public) contrôlée mot pour mot par le script verify:verses : d’autres peuvent être ajoutés dans src/verses.ts. Le logo est un dessin original, à valider à l’œil.' },
  { i: 2, t: 'Fluidité et double format', s: 'O', d: 'PWA installable, navigation basse (moins de 768 px) et barre latérale (à partir de 768 px), bouton central + qui ouvre une feuille du bas, balayage entre rubriques et sous-catégories avec alternatives visibles (onglets, boutons), pages chargées à la demande, squelettes de chargement, transition de page, bulle IA, 5 indicateurs réels, thèmes clair, sombre et OLED, mouvement réduit respecté.', m: 'Les 60 images par seconde et le retour haptique n’ont pas été mesurés sur un vrai téléphone (aucun appareil disponible ici).' },
  { i: 3, t: 'Believe AI', s: 'C', d: 'Chat à 5 modes avec questions rapides, bulle flottante, consentement avant le premier envoi, contexte optionnel, réponses étiquetées « Généré par IA » avec lecture vocale, dictée vocale (reconnaissance du navigateur, accord distinct, texte relu avant l’envoi), fonction serveur vers l’API Gemini (gemini-3.5-flash par défaut, modifiable).', m: 'Configuration requise : GEMINI_API_KEY sur le serveur. Aucun appel réel à Gemini n’a été exécuté depuis cet environnement. La dictée n’a pas été essayée avec une vraie voix ni sur iPhone ; elle est absente de Firefox, et sur Chrome ou Safari le son part chez Google ou Apple (c’est dit avant l’accord).' },
  { i: 4, t: 'Accueil spirituel', s: 'O', d: 'Verset du jour adapté au profil (fenêtre à l’ouverture, une seule, et bannière) avec référence exacte, traduction indiquée, bouton Nouveau verset et lecture vocale ; encouragement IA distingué ; mur de prières et gratitudes (sujets, cochage avec date d’exaucement).', m: 'Encouragement IA : configuration requise (serveur IA). La lecture vocale dépend des voix installées sur l’appareil.' },
  { i: 5, t: 'Profil, RGPD et données', s: 'P', d: 'Bilan hebdomadaire (semaine en cours comparée à la dernière semaine archivée) et 12 badges calculés sur vos données ; partage avec des amis en mode local : carte image et texte faits sur l’appareil, tout masqué par défaut, confirmation des éléments sensibles, aperçu exact « Vue Ami », révocation ; 9 consentements retirables (IA, photos, santé, GPS, mouvement, micro, dictée vocale, notifications, partage ; effet immédiat), PIN haché et salé avec limitation des tentatives et verrouillage automatique, mode discret, thèmes dont OLED, export et import JSON (v1 acceptée), suppression vérifiée (stockage local + IndexedDB), CGU et confidentialité.', m: 'Cercle d’amis par invitation (option Cloud/Supabase) non implémenté : le partage se fait en mode local, c’est vous qui envoyez la carte. Le PIN verrouille l’interface sans chiffrer les données.' },
  { i: 6, t: 'Habitudes', s: 'O', d: 'Grille Lun à Dim, séries, taux, graphique, filtres par catégorie, ajout, retrait et renommage (identifiant et historique conservés), archivage de la semaine chaque lundi, marque-pages « 20 pages de mon livre » (relié à Mes livres) et « 20 pages de cours ».', m: 'Rien d’identifié dans le cahier des charges.' },
  { i: 7, t: 'Sport, GPS et podomètre', s: 'P', d: 'Séance GPS (chrono, tours, Haversine, allure, vitesse, dénivelé, kcal estimées, tracé, annonces par km), 6 programmes avec séries et repos, podomètre réglable validant les 10 000 pas.', m: 'Pas de suivi en arrière-plan, rien testé sur appareil réel.' },
  { i: 8, t: 'Santé, scanner et recettes', s: 'P', d: 'Pesées datées avec courbe et jauge, hydratation, sommeil, suivi du cycle (phase, énergie) ou de la récupération (récupération, force, vitalité) activable et effaçable, journal alimentaire, scanner de plat par photo, 3 recettes avec image du plat à la demande, ajout au journal après validation.', m: 'Scanner, recettes et image du plat : configuration requise (serveur IA). L’image du plat (service payant de Google) n’a jamais été essayée avec une vraie clé : à tester après le déploiement. Le suivi du cycle donne des repères moyens, ni diagnostic ni contraception.' },
  { i: 9, t: 'Professionnel et calendrier', s: 'P', d: 'Matrice d’Eisenhower P1 à P4, tâches avec échéance, Pomodoro 25/45 min persistant entre rubriques, rappels locaux (bandeau dans l’application, notification du système, texte neutre en mode discret ou sous le PIN), export .ics avec alarme, lien Google Agenda par tâche.', m: 'Un rappel n’est donné que pendant que Believe est ouvert (pas de notification envoyée par un serveur) : application fermée, seul l’export .ics fait alerter votre agenda. Pas de synchronisation automatique (elle n’est jamais annoncée).' },
  { i: 10, t: 'Danse et louange', s: 'P', d: 'Filtres Danse et Louange, lecteur YouTube intégré sans lecture automatique, playlist locale, ajout par adresse collée, validation déclarative des habitudes.', m: 'Recherche : configuration requise (YOUTUBE_API_KEY).' },
  { i: 11, t: 'Notes, dictaphone, prompteur', s: 'P', d: 'Notes en 5 catégories avec recherche plein texte (sans accents) et surlignage, apaisement et prière par IA pour les cauchemars (texte exact montré avant envoi), dictaphone (MediaRecorder, IndexedDB, relu au démarrage, suppression vérifiée, copie téléchargeable), prompteur (vitesse et taille réglables, plein écran), métronome (30 à 240, 2 à 6 temps, frappe du tempo).', m: 'Apaisement IA : configuration requise (serveur IA). Micro, son, vibration et écran maintenu allumé non testés sur appareil réel. Un navigateur peut effacer les audios si la place manque : installez l’application et téléchargez les audios importants.' },
  { i: 12, t: 'Bibliothèque et recherche de livres', s: 'P', d: 'Catalogue intégré en 5 catégories avec filtre FR/EN et recherche instantanée (titre, auteur, thème, mot-clé, langue), résumés originaux, citations courtes vérifiées (domaine public seulement), liens légaux de lecture et d’écoute, lecture vocale ; recherche en ligne (Open Library, Google Books, Project Gutenberg, LibriVox) par la fonction serveur api/ext, couvertures désactivées par défaut ; Mes livres reliés au marque-page « 20 pages de mon livre » ; fiche de synthèse par IA après accord, texte exact montré avant l’envoi.', m: 'Appels réels aux catalogues non exécutés depuis cet environnement (réponses simulées d’après leur documentation). Fiche IA : configuration requise (serveur IA).' },
  { i: 13, t: 'Académie d’éloquence et quiz', s: 'P', d: '5 exercices d’éloquence par jour, de familles différentes (diction, articulation, souffle, figures de style, répartie, posture vocale), sans retour avant 11 jours, chacun avec son chrono et une auto-écoute (micro demandé au clic, enregistrement supprimé sauf si vous le gardez) ; quiz inédits en 5 thèmes avec anti-répétition (identifiant et empreinte du texte), explications, score, historique et révision ; improvisation infinie avec minuteur, note de difficulté sous chaque sujet et conseil Believe AI sur demande (texte exact montré avant l’envoi).', m: 'La banque intégrée compte 136 questions (une trentaine de quiz inédits) : ensuite, révision ou nouvelles questions écrites par l’IA (configuration requise : serveur IA, réponses à vérifier). Conseil IA : configuration requise. Micro, son et vibration non testés sur appareil réel.' }
]

const boot = (() => { const b = load(); roll(b.s); save(b.s); return b })()
const hashOf = () => location.hash.replace(/^#\/?/, '') || '4'
const seg = (h: string): [string, string] => { const i = h.indexOf('/'); return i < 0 ? [h, ''] : [h.slice(0, i), h.slice(i + 1)] }
/** Sections principales, dans l'ordre de la barre du bas : on passe de l'une à l'autre par balayage. */
const MAIN = ['4', '6', '3', 'menu']
const NB: [string, string, string][] = [['4', '☀', 'Accueil'], ['6', '✓', 'Habitudes'], ['3', '✦', 'IA'], ['menu', '☰', 'Rubriques']]

export default function App() {
  const [S, setS] = useState<State>(boot.s), [err, setErr] = useState<string | null>(boot.err), [m, setM] = useState<Msg>(null), [h, setH] = useState(hashOf()), [ip, setIp] = useState<Event & { prompt?: () => void } | null>(null)
  const [sheet, setSheet] = useState(false), [vm, setVm] = useState(() => boot.s.ui.onboard && boot.s.ui.verseDay !== today() && !hasPin()), [dir, setDir] = useState(0)
  const [locked, setLocked] = useState(hasPin), [pinV, setPinV] = useState(0)
  const ref = useRef(S), hRef = useRef(h), lockedRef = useRef(locked), run = useRun(), pomo = usePomo()
  const lock = (v: boolean) => { lockedRef.current = v; setLocked(v) }
  const upd: Upd = (f, ok, quiet) => {
    const n: State = JSON.parse(JSON.stringify(ref.current)); f(n)
    const saved = save(n); ref.current = n; setS(n)
    setErr(saved ? null : 'Enregistrement impossible : stockage local indisponible ou plein. Les dernières modifications ne sont pas sauvegardées.')
    if (!saved) setM({ e: 1, t: 'Action non enregistrée.' })
    else if (ok) setM({ t: ok })
    else if (!quiet) setM(null)
    return saved
  }
  /** Droit à l'oubli : efface le stockage local ET la base IndexedDB (audios), arrête les séances en cours, puis vérifie. */
  const purge = async () => {
    abortRun(); resetP(); discardRec()
    const a = wipeLocal(), b = await wipeIDB()
    const n = DEF(); n.ui.onboard = true // l'écran « Données » reste affiché pour annoncer le résultat vérifié ; l'accueil guidé reviendra au prochain lancement, le stockage étant vide
    ref.current = n; setS(n); setVm(false); setSheet(false); lock(false); setPinV(v => v + 1)
    return a && b
  }
  /** Ouvre la fenêtre du verset du jour si elle n'a pas encore été vue aujourd'hui : jamais pendant l'accueil guidé ni derrière l'écran du PIN. */
  const askVerse = () => { const s = ref.current; if (s.ui.onboard && s.ui.verseDay !== today() && !lockedRef.current) { setSheet(false); setVm(true) } }
  useEffect(() => {
    const hc = () => {
      const nx = hashOf(), a = MAIN.indexOf(seg(hRef.current)[0]), b = MAIN.indexOf(seg(nx)[0])
      setDir(a >= 0 && b >= 0 && a !== b ? Math.sign(b - a) : 0); hRef.current = nx; setH(nx); setM(null); scrollTo(0, 0)
    }
    const vc = () => { if (!document.hidden) { upd(s => roll(s)); askVerse() } } // retour au premier plan : nouvelle semaine, nouveau jour
    const bi = (e: Event) => { e.preventDefault(); setIp(e) }
    const st = (e: StorageEvent) => { if (e.key === null || e.key === KEY) { const r = load(); ref.current = r.s; setS(r.s) } } // autre onglet ou fenêtre installée
    addEventListener('hashchange', hc); document.addEventListener('visibilitychange', vc); addEventListener('beforeinstallprompt', bi); addEventListener('storage', st)
    return () => { removeEventListener('hashchange', hc); document.removeEventListener('visibilitychange', vc); removeEventListener('beforeinstallprompt', bi); removeEventListener('storage', st) }
  }, [])
  useEffect(() => { document.body.classList.toggle('discret', S.discret) }, [S.discret])
  useEffect(() => {
    const de = document.documentElement
    if (S.settings.theme === 'auto') de.removeAttribute('data-theme'); else de.setAttribute('data-theme', S.settings.theme)
    if (S.settings.motion === 'reduced') de.setAttribute('data-motion', 'reduced'); else de.removeAttribute('data-motion')
  }, [S.settings.theme, S.settings.motion])
  useEffect(() => { if (pomo.finished) { pomo.finished = false; upd(s => { s.pomos[today()] = (s.pomos[today()] ?? 0) + 1 }, 'Pomodoro terminé : prenez une pause.') } })
  const rem = useReminders(S, upd, locked)
  /** Verrouillage automatique : retour dans l'application après le délai choisi, ou inactivité (au moins 1 minute). */
  useEffect(() => {
    const cfg = readPin()
    if (locked || !cfg) return
    const a = cfg.a // délai en minutes, relu à chaque changement de réglage (pinV)
    let hiddenAt = 0, idle: ReturnType<typeof setTimeout> | undefined
    const lockNow = () => { setSheet(false); setVm(false); lock(true) }
    const arm = () => { clearTimeout(idle); idle = setTimeout(lockNow, Math.max(a, 1) * 60_000) }
    const vis = () => {
      if (document.hidden) { hiddenAt = Date.now(); if (a === 0) lockNow() }
      else { if (hiddenAt && Date.now() - hiddenAt >= a * 60_000) lockNow(); hiddenAt = 0; arm() }
    }
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    document.addEventListener('visibilitychange', vis); evs.forEach(e => addEventListener(e, arm, { passive: true })); arm()
    return () => { clearTimeout(idle); document.removeEventListener('visibilitychange', vis); evs.forEach(e => removeEventListener(e, arm)) }
  }, [locked, pinV])
  useEffect(() => { // préchargement discret des autres pages une fois l'accueil affiché (elles restent disponibles hors ligne)
    const go = () => Object.values(PG).forEach(p => { p.load().catch(() => undefined) })
    const w = window as unknown as { requestIdleCallback?: (f: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(go); else setTimeout(go, 1500)
  }, [])

  const [a, sub] = seg(h), n = /^\d+$/.test(a) ? +a : 0, r = n >= 1 && n <= 13 ? R[n - 1] : null
  const p: P & { purge: () => Promise<boolean>; inst: (() => void) | null; pinChanged: () => void } = { S, upd, m, setM, sub, purge, inst: ip?.prompt ? () => { ip.prompt?.(); setIp(null) } : null, pinChanged: () => setPinV(v => v + 1) }
  const sw = useSwipe(d => {
    const i = MAIN.indexOf(a), j = i + d
    if (i < 0 || j < 0 || j >= MAIN.length) return false
    haptic(S); location.hash = '#/' + MAIN[j]; return true
  })
  let body: ReactNode
  if (r) {
    if (n === 4) body = <Home {...p} />
    else if (PG[n]) { const C = PG[n].C; body = <Suspense fallback={<Skeleton />}><C {...p} /></Suspense> }
    else body = <Stub r={r} />
  } else if (a === 'menu') body = <Menu />
  else if (a === 'statut') body = <Status />
  else if (PG[a]) { const C = PG[a].C; body = <Suspense fallback={<Skeleton />}><C {...p} /></Suspense> }
  else body = (<><h1>404</h1><p>Cette page n’existe pas.</p><a className="btn" href="#/4">Retour à l’accueil</a></>)

  const closeVerse = () => { setVm(false); upd(s => { s.ui.verseDay = today() }) }
  const water = () => { setSheet(false); upd(s => { s.water[today()] = (s.water[today()] ?? 0) + 250 }, 'Eau : + 250 ml.') }
  const QA: [string, string, string][] = [['✓', 'Cocher une habitude', '#/6'], ['✎', 'Nouvelle note', '#/11/notes'], ['●', 'Enregistrer un audio', '#/11/audio'], ['☑', 'Nouvelle tâche', '#/9'], ['♡', 'Ajouter une prière', '#/4/prieres'], ['↗', 'Démarrer une séance', '#/7'], ['✦', 'Demander à Believe AI', '#/3']]

  if (locked) return <Lock onUnlock={() => { lock(false); askVerse() }} onForgot={async () => { const ok = await purge(); return ok }} />
  if (!S.ui.onboard) return <Onboarding S={S} upd={upd} onFinish={() => { upd(s => { s.ui.onboard = true }); askVerse() }} />
  return (
    <>
      <header>
        <Logo />
        <span className="wm">BELIEVE</span><span className="sp" />
        <button className="btn alt" aria-pressed={S.discret} onClick={() => upd(s => { s.discret = !s.discret })}>Discret</button>
      </header>
      {err && <p className="ban" role="alert">{err}</p>}
      {run.st !== 'idle' && a !== '7' && <a className="ban" href="#/7" style={{ display: 'block', color: 'inherit' }}>Séance GPS {run.st === 'run' ? 'en cours' : 'en pause'} : retour à la rubrique Sport</a>}
      <RecBanner a={a} />
      {pomo.st === 'run' && a !== '9' && <a className="ban" href="#/9" style={{ display: 'block', color: 'inherit' }}>Pomodoro en cours : {clock(left(pomo.end))}</a>}
      <RemindBanner items={rem.items} discret={S.discret} onClose={rem.clear} />
      <div className="app">
        <nav className="side" aria-label="Rubriques">
          <button className="btn alt" style={{ width: '100%', marginBottom: 8 }} onClick={() => setSheet(true)}>+ Actions rapides</button>
          {R.map(x => <a key={x.i} href={'#/' + x.i} aria-current={a === String(x.i) ? 'page' : undefined}>{x.i}. {x.t}</a>)}
          <a href="#/statut" aria-current={a === 'statut' ? 'page' : undefined}>État des fonctionnalités</a>
        </nav>
        <main {...sw}><View key={a} cls={dir > 0 ? ' fwd' : dir < 0 ? ' back' : ''}>{body}</View></main>
      </div>
      {a !== '3' && <a className="fab" href="#/3" aria-label="IA : ouvrir Believe AI">IA</a>}
      <nav className="bot" aria-label="Navigation principale">
        {NB.slice(0, 2).map(([k, g, t]) => <a key={k} href={'#/' + k} aria-current={k === a ? 'page' : undefined}><b aria-hidden="true">{g}</b>{t}</a>)}
        <button className="plus" aria-label="Actions rapides" aria-haspopup="dialog" onClick={() => setSheet(true)}>+</button>
        {NB.slice(2).map(([k, g, t]) => <a key={k} href={'#/' + k} aria-current={k === a ? 'page' : undefined}><b aria-hidden="true">{g}</b>{t}</a>)}
      </nav>
      <Dialog open={sheet} onClose={() => setSheet(false)} label="Actions rapides" sheet>
        <h2 style={{ marginTop: 0 }}>Actions rapides</h2>
        <div className="qa">
          {QA.map(([g, t, href]) => <a key={t} href={href} onClick={e => { setSheet(false); if (href === '#/4/prieres' && href === location.hash) { e.preventDefault(); setTimeout(focusPrayerField, 0) } }}><b aria-hidden="true">{g}</b>{t}</a>)}
          {S.consents.health ? <button onClick={water}><b aria-hidden="true">≈</b>Boire + 250 ml</button> : <a href="#/8/eau" onClick={() => setSheet(false)}><b aria-hidden="true">≈</b>Eau et sommeil</a>}
        </div>
        <button className="btn alt" style={{ marginTop: 10, width: '100%' }} onClick={() => setSheet(false)}>Fermer</button>
      </Dialog>
      <VerseModal S={S} upd={upd} open={vm} onClose={closeVerse} />
    </>
  )
}
