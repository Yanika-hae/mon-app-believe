import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { KEY } from './lib'
import { DN, btn, go, iso, mount, ready, stored, tick, type, withCrypto } from './testkit'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.documentElement.removeAttribute('data-theme') })

describe('Believe : parcours d’interface (jsdom)', () => {
  it('accueil, verset et page 404', async () => {
    await mount('#/4')
    expect(screen.getByText(/Louis Segond 1910/)).toBeTruthy(); expect(screen.getByText('Bienvenue')).toBeTruthy()
    await go('#/zzz'); expect(screen.getByText('404')).toBeTruthy()
  })

  it('profil : validations, objectif dangereux refusé, enregistrement persisté, accords', async () => {
    await mount('#/1')
    fireEvent.click(btn('Enregistrer')); expect(screen.getByText('Choisissez Femme ou Homme.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Femme' })); type('Prénom', 'Ada'); type('Âge', '30'); type('Taille (cm)', '170'); type('Poids de départ (kg)', '71'); type('Poids actuel (kg)', '65'); type('Poids cible (kg)', '40')
    fireEvent.change(screen.getByLabelText('Sexe utilisé dans les formules de santé'), { target: { value: 'F' } })
    fireEvent.click(btn('Enregistrer')); expect(screen.getByText(/Objectif refusé/)).toBeTruthy(); expect(stored().profile).toBeNull()
    type('Poids cible (kg)', '60'); fireEvent.click(btn('Enregistrer'))
    expect(screen.getByText('Profil enregistré.')).toBeTruthy(); expect(stored().profile).toMatchObject({ name: 'Ada', w: 65, t: 60, ws: 71, g: 'F' })
    await go('#/4'); expect(screen.getByText('Bonjour Ada')).toBeTruthy(); expect(screen.getByText('Prête pour aujourd’hui ?')).toBeTruthy()
  })

  it('habitudes : cocher, persister, refuser un doublon, retirer avec confirmation', async () => {
    await mount('#/6')
    const day = DN[(new Date().getDay() + 6) % 7], name = 'Sport : marche, course ou salle'
    expect(btn(name + ', ' + day).getAttribute('aria-pressed')).toBe('false'); fireEvent.click(btn(name + ', ' + day))
    expect(btn(name + ', ' + day).getAttribute('aria-pressed')).toBe('true'); expect(stored().checks[iso(new Date())]).toEqual(['h1'])
    type('Nom de l’habitude', '10 000 pas'); fireEvent.click(btn('Ajouter')); expect(screen.getByText('Cette habitude existe déjà.')).toBeTruthy()
    fireEvent.click(btn('Retirer 10 000 pas')); fireEvent.click(btn('Confirmer le retrait'))
    expect(screen.getByText(/Habitude retirée/)).toBeTruthy(); expect(stored().habits.some((h: { n: string }) => h.n === '10 000 pas')).toBe(false)
  })

  it('habitudes : la phrase de la semaine se termine par un seul point, que le mois abrégé en porte un (« oct. ») ou non (« mai »)', async () => {
    for (const [now, txt] of [[new Date(2026, 9, 22, 10), 'Semaine 43, du 19 oct. au 25 oct.'], [new Date(2026, 4, 13, 10), 'Semaine 20, du 11 mai au 17 mai.']] as const) {
      vi.useFakeTimers({ toFake: ['Date'], now }); await mount('#/6')
      const p = screen.getByRole('heading', { level: 1, name: 'Habitudes' }).nextElementSibling!; expect(p.textContent!.startsWith(txt + 'Réussite')).toBe(true)
      cleanup(); vi.useRealTimers()
    }
  })

  it('données : export, import invalide puis valide, suppression vérifiée', async () => {
    await mount('#/5/confidentialite'); fireEvent.click(btn('Données'))
    fireEvent.click(btn('Générer l’export')); const json = (screen.getByLabelText('Export JSON') as HTMLTextAreaElement).value; expect(JSON.parse(json).v).toBe(2)
    const imp = screen.getByLabelText('JSON à importer'); fireEvent.change(imp, { target: { value: '{oops' } }); fireEvent.click(btn('Vérifier')); expect(screen.getByText(/Import refusé/)).toBeTruthy()
    fireEvent.change(imp, { target: { value: json } }); fireEvent.click(btn('Vérifier')); expect(screen.getByText(/Fichier valide/)).toBeTruthy()
    fireEvent.click(btn('Importer')); expect(screen.getByText(/Données importées/)).toBeTruthy()
    localStorage.setItem('believe:code', 'sésame'); localStorage.setItem('autre:cle', 'x')
    fireEvent.click(btn('Tout supprimer')); fireEvent.click(btn('Confirmer la suppression définitive'))
    expect(await screen.findByText(/supprimées \(vérifié\)/)).toBeTruthy(); expect(localStorage.getItem(KEY)).toBeNull()
    // toutes les clés Believe (code d’accès compris) sont effacées, celles des autres sites ou applications restent
    expect(Object.keys(localStorage).filter(k => k.startsWith('believe:'))).toEqual([]); expect(localStorage.getItem('autre:cle')).toBe('x')
  })

  it('données : suppression non confirmée si le stockage refuse l’effacement', async () => {
    await mount('#/5/confidentialite'); fireEvent.click(btn('Données'))
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('verrouillé') })
    fireEvent.click(btn('Tout supprimer')); fireEvent.click(btn('Confirmer la suppression définitive'))
    expect(await screen.findByText(/Suppression non confirmée/)).toBeTruthy(); expect(screen.queryByText(/supprimées \(vérifié\)/)).toBeNull()
  })

  it('IA : consentement, réponse simulée, erreur de configuration', async () => {
    await mount('#/3'); expect(screen.getByText('Consentement')).toBeTruthy()
    fireEvent.click(btn('J’accepte l’envoi à l’IA'))
    const f = vi.fn().mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ text: 'Bonjour à vous', model: 'gemini-test' }) }).mockResolvedValueOnce({ status: 503, ok: false, json: async () => ({ error: 'not_configured' }) })
    vi.stubGlobal('fetch', f)
    type('Votre question', 'Salut'); fireEvent.click(btn('Envoyer')); await tick(10)
    expect(screen.getByText('Bonjour à vous')).toBeTruthy(); expect(screen.getByText(/Généré par IA \(gemini-test\)/)).toBeTruthy()
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ mode: 'nutrition', messages: [{ role: 'user', content: 'Salut' }] })
    type('Votre question', 'Encore'); fireEvent.click(btn('Envoyer')); await tick(10)
    expect(screen.getByText(/Configuration requise/)).toBeTruthy()
  })

  it('professionnel : tâche urgente en P1, Pomodoro conservé en changeant de rubrique', async () => {
    await mount('#/9')
    const due = iso(new Date(Date.now() + 24 * 3600e3)) + 'T09:00'
    type('Intitulé', 'Rapport'); type('Échéance (facultative)', due); fireEvent.click(screen.getByLabelText('Importante')); fireEvent.click(btn('Ajouter'))
    const sec = screen.getByText(/^P1, /).parentElement as HTMLElement; expect(within(sec).getByText('Rapport')).toBeTruthy()
    fireEvent.click(btn('Démarrer')); await go('#/4'); expect(screen.getByText(/Pomodoro en cours/)).toBeTruthy()
    await go('#/9'); fireEvent.click(btn('Réinitialiser')); expect(screen.queryByText(/Pomodoro en cours/)).toBeNull()
  })

  it('sport : la séance GPS survit au changement de rubrique puis s’enregistre', async () => {
    let cb: ((p: unknown) => void) | undefined
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition: (ok: (p: unknown) => void) => { cb = ok; return 7 }, clearWatch: vi.fn() } })
    let now = 1_700_000_000_000; vi.spyOn(Date, 'now').mockImplementation(() => now)
    await mount('#/7', st => { st.consents.gps = true }); fireEvent.click(btn('Démarrer'))
    const pos = (lat: number, t: number) => ({ coords: { latitude: lat, longitude: 2, altitude: null, accuracy: 5 }, timestamp: t })
    act(() => { cb!(pos(48, now)); now += 60_000; cb!(pos(48.001, now)) })
    expect(screen.getByText('0.11 km')).toBeTruthy()
    await go('#/4'); expect(screen.getByText(/Séance GPS en cours/)).toBeTruthy()
    await go('#/7'); expect(screen.getByText('0.11 km')).toBeTruthy()
    now += 540_000; fireEvent.click(btn('Arrêter'))
    expect(screen.getByText(/Séance enregistrée/)).toBeTruthy(); expect(stored().workouts[0]).toMatchObject({ act: 'Course', sec: 600, km: 0.11 })
  })

  it('santé : pesée, eau, scanner bloqué sans consentement', async () => {
    await mount('#/8', st => { st.consents.health = true })
    type('Poids en kg', '64,5'); fireEvent.click(btn('Enregistrer')); expect(screen.getByText('Poids enregistré.')).toBeTruthy(); expect(stored().weights[0].kg).toBe(64.5)
    fireEvent.click(btn('Eau et sommeil')); fireEvent.click(btn('+ 250 ml')); expect(stored().water[iso(new Date())]).toBe(250)
    fireEvent.click(btn('Scanner')); expect(screen.queryByLabelText('Photo du plat')).toBeNull()
  })

  it('danse et louange : adresse collée, playlist, lecteur arrêté en quittant la rubrique, validation', async () => {
    await mount('#/10')
    type('Adresse YouTube', 'https://youtu.be/dQw4w9WgXcQ'); fireEvent.click(btn('Ajouter l’adresse'))
    expect(stored().playlist).toEqual([{ id: 'dQw4w9WgXcQ', t: 'Vidéo YouTube dQw4w9WgXcQ', k: 'danse' }])
    expect(document.querySelector('iframe')).toBeNull(); fireEvent.click(btn('Lire'))
    expect(document.querySelector('iframe')!.getAttribute('src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    fireEvent.click(btn('J’ai dansé : valider')); expect(stored().checks[iso(new Date())]).toEqual(expect.arrayContaining(['h1', 'h8']))
    await go('#/4'); expect(document.querySelector('iframe')).toBeNull()
  })

  it('Pomodoro : fin de session comptée une seule fois, même avec la rubrique ouverte', async () => {
    await mount('#/9'); vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    fireEvent.click(btn('Démarrer'))
    act(() => { vi.advanceTimersByTime(25 * 60 * 1000 + 3000) })
    expect(screen.getByText('Pomodoro terminé : prenez une pause.')).toBeTruthy(); expect(stored().pomos[iso(new Date())]).toBe(1)
    act(() => { vi.advanceTimersByTime(10_000) }); expect(stored().pomos[iso(new Date())]).toBe(1)
  })
  it('consentements : la séance GPS demande son accord, le retrait arrête la séance en cours', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition: () => 3, clearWatch: vi.fn() } })
    await mount('#/7'); expect(screen.getByText('Position (GPS)')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Démarrer' })).toBeNull()
    fireEvent.click(btn('J’accepte')); expect(stored().consents.gps).toBe(true)
    fireEvent.click(btn('Démarrer')); await go('#/4'); expect(screen.getByText(/Séance GPS en cours/)).toBeTruthy()
    await go('#/5/confidentialite'); fireEvent.click(btn('Retirer Position (GPS)')); expect(stored().consents.gps).toBe(true) // confirmation demandée d’abord
    fireEvent.click(btn(/^Confirmer le retrait/)); expect(stored().consents.gps).toBe(false)
    await go('#/4'); expect(screen.queryByText(/Séance GPS en cours/)).toBeNull()
  })

  it('santé : sans accord « Santé et poids », rien n’est proposé ; l’accord se donne puis se retire', async () => {
    await mount('#/8'); expect(screen.queryByLabelText('Poids en kg')).toBeNull(); fireEvent.click(btn('J’accepte'))
    expect(screen.getByLabelText('Poids en kg')).toBeTruthy(); expect(stored().consents.health).toBe(true)
    await go('#/5/confidentialite'); fireEvent.click(btn('Retirer Santé et poids')); expect(stored().consents.health).toBe(false)
  })

  it('PIN : réglage depuis la rubrique 5, haché dans le stockage, jamais en clair', async () => {
    withCrypto(); await mount('#/5/confidentialite')
    type('Nouveau PIN', '1234'); type('Confirmer le PIN', '9999'); fireEvent.click(btn('Activer le PIN')); expect(screen.getByText(/pas identiques/)).toBeTruthy(); expect(localStorage.getItem('believe:pin')).toBeNull()
    type('Confirmer le PIN', '1234'); fireEvent.click(btn('Activer le PIN'))
    expect(await screen.findByText(/PIN activé/)).toBeTruthy()
    const rec = JSON.parse(localStorage.getItem('believe:pin')!); expect(rec).toMatchObject({ i: 210000, f: 0, u: 0, a: 1 }); expect(rec.h.length).toBe(44); expect(JSON.stringify(rec)).not.toContain('"1234"')
  })

  it('PIN : écran de verrouillage à l’ouverture, mauvais PIN refusé, bon PIN déverrouille, aucune donnée visible avant', async () => {
    withCrypto()
    await mount('#/4', st => { st.profile = { g: 'F', name: 'Ada', age: 30, h: 170, w: 65, t: 60, ws: 71, lv: 'I', sx: 'F' } }, async () => { await (await import('./pin')).setPin('4821', 1, 1000) })
    expect(screen.getByRole('dialog', { name: 'Saisissez votre PIN' })).toBeTruthy(); expect(screen.queryByText(/Ada/)).toBeNull(); expect(screen.queryByText('Habitudes du jour')).toBeNull()
    for (const c of '1111') fireEvent.click(btn(c))
    expect(await screen.findByText(/PIN incorrect. Il reste 4 essais/)).toBeTruthy(); expect(JSON.parse(localStorage.getItem('believe:pin')!).f).toBe(1)
    for (const c of '4821') fireEvent.click(btn(c))
    expect(await screen.findByText('Bonjour Ada')).toBeTruthy(); expect(JSON.parse(localStorage.getItem('believe:pin')!).f).toBe(0)
  })

  it('PIN : 5 erreurs bloquent l’accès (même avec le bon PIN), le blocage survit au rechargement', async () => {
    withCrypto()
    await mount('#/4', () => {}, async () => { await (await import('./pin')).setPin('4821', 1, 1000) })
    for (let i = 0; i < 5; i++) { for (const c of '0000') fireEvent.click(btn(c)); await screen.findByText(/PIN incorrect|Verrouillé : réessayez/); await tick(5) }
    expect(await screen.findAllByText(/Verrouillé : réessayez dans/)).toBeTruthy(); expect(btn('1').hasAttribute('disabled')).toBe(true)
    const u = JSON.parse(localStorage.getItem('believe:pin')!).u; expect(u).toBeGreaterThan(Date.now())
    cleanup(); vi.resetModules(); const { default: App } = await import('./App'); render(<App />); await tick(); await ready() // « rechargement » : même stockage
    expect(screen.getAllByText(/Verrouillé : réessayez dans/).length).toBeGreaterThan(0); expect(btn('4').hasAttribute('disabled')).toBe(true)
  })

  it('PIN : verrouillage automatique à l’inactivité et au retour dans l’application ; PIN oublié = tout effacer', async () => {
    withCrypto()
    await mount('#/4', st => { st.profile = { g: 'M', name: 'Léo', age: 30, h: 180, w: 80, t: 75, ws: 80, lv: 'I', sx: 'M' } }, async () => { await (await import('./pin')).setPin('4821', 1, 1000) })
    for (const c of '4821') fireEvent.click(btn(c)); expect(await screen.findByText('Bonjour Léo')).toBeTruthy()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); act(() => { window.dispatchEvent(new Event('pointerdown')) }) // réarme le minuteur d’inactivité avec l’horloge simulée
    act(() => { vi.advanceTimersByTime(30_000) }); expect(screen.queryByRole('dialog', { name: 'Saisissez votre PIN' })).toBeNull()
    act(() => { vi.advanceTimersByTime(31_000) }); expect(screen.getByRole('dialog', { name: 'Saisissez votre PIN' })).toBeTruthy(); expect(screen.queryByText(/Léo/)).toBeNull()
    vi.useRealTimers()
    fireEvent.click(btn('PIN oublié ?')); fireEvent.click(btn('Effacer et réinitialiser'))
    expect(await screen.findByText('Bienvenue')).toBeTruthy(); expect(localStorage.getItem('believe:pin')).toBeNull(); expect(Object.keys(localStorage).filter(k => k.startsWith('believe:') && k !== 'believe:v2')).toEqual([])
  })

  it('PIN : réglage « dès que l’application quitte l’écran » verrouille au passage en arrière-plan', async () => {
    withCrypto()
    await mount('#/4', () => {}, async () => { await (await import('./pin')).setPin('4821', 0, 1000) })
    for (const c of '4821') fireEvent.click(btn(c)); expect(await screen.findByText('Bienvenue')).toBeTruthy()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(screen.getByRole('dialog', { name: 'Saisissez votre PIN' })).toBeTruthy()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('réglages : le thème OLED s’applique à la page et se conserve ; informations légales accessibles', async () => {
    await mount('#/5/confidentialite'); fireEvent.click(btn('Réglages')); fireEvent.click(screen.getByRole('radio', { name: 'Noir OLED' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled'); expect(stored().settings.theme).toBe('oled')
    await go('#/legal'); expect(screen.getByText('Informations légales')).toBeTruthy(); expect(screen.getByText(/Transparence sur l’intelligence artificielle/)).toBeTruthy()
  })
})
