import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import type { Cycle, Profile, State } from './lib'
import { btn, mount, stored, type } from './testkit'

const DAY = '2026-10-22' // jeudi
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(DAY + 'T10:00:00')) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

const FEM: Profile = { g: 'F', name: 'Ada', age: 30, h: 170, w: 65, t: 60, ws: 71, lv: 'I', sx: 'F' }
const MAN: Profile = { ...FEM, g: 'M', name: 'Léo', sx: 'M' }
const seed = (mode: Cycle['mode'], c: Partial<Cycle> = {}) => (s: State) => { s.consents.health = true; s.cycle = { mode, starts: [], rec: {}, en: {}, ...c } }
const cyc = (c?: Partial<Cycle>) => seed('cycle', c)
const rcp = (c?: Partial<Cycle>) => seed('recup', c)
const grp = (n: string) => within(screen.getByRole('group', { name: n }))
const rate = (g: string, n: number) => fireEvent.click(grp(g).getByRole('radio', { name: String(n) }))
const addStart = (v: string) => { type('Premier jour des règles', v); fireEvent.click(btn('Enregistrer le début des règles')) }
const back = (n: number, from = DAY) => { const d = new Date(from + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10) }

describe('Rubrique 8 : suivi du cycle ou de la récupération (page de saisie)', () => {
  it('derrière l’accord « Santé et poids » ; l’adresse #/8/suivi ouvre l’onglet ; par défaut le suivi est désactivé et rien n’est demandé', async () => {
    await mount('#/8/suivi')
    expect(screen.queryByRole('radio', { name: 'Désactivé' })).toBeNull(); fireEvent.click(btn('J’accepte'))
    expect(btn('Cycle / récupération').getAttribute('aria-pressed')).toBe('true'); expect(btn('Poids').getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByRole('radio', { name: 'Désactivé' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Le suivi est désactivé : rien n’est demandé, noté ni partagé.')).toBeTruthy(); expect(screen.getByText('Aucune note ni date enregistrée.')).toBeTruthy()
    expect(screen.queryByLabelText('Premier jour des règles')).toBeNull(); expect(screen.queryByRole('group', { name: 'Énergie ressentie' })).toBeNull(); expect(screen.queryByRole('group', { name: 'Vitalité' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Effacer mes notes et dates' })).toBeNull() // rien à effacer
    expect(stored().cycle).toEqual({ mode: 'off', starts: [], rec: {}, en: {} })
  })

  it('le profil suggère un suivi sans l’imposer ; chaque choix est enregistré et changer de suivi n’efface aucune note', async () => {
    const full = { starts: ['2026-10-10'], rec: { [DAY]: [3, 3, 3] as [number, number, number] }, en: { [DAY]: 4 } }
    await mount('#/8/suivi', s => { seed('off', full)(s); s.profile = FEM })
    expect(screen.getByText(/D’après votre profil, le suivi du cycle vous est proposé ; l’autre suivi, ou aucun, reste possible/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Cycle hormonal et énergie' })); expect(stored().cycle.mode).toBe('cycle'); expect(screen.getByText('Suivi du cycle activé.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Récupération nerveuse, force et vitalité' })); expect(stored().cycle.mode).toBe('recup'); expect(screen.getByText('Suivi de la récupération activé.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Désactivé' })); expect(stored().cycle.mode).toBe('off'); expect(screen.getByText('Suivi désactivé : vos notes restent sur l’appareil, rien n’est partagé.')).toBeTruthy()
    expect(stored().cycle).toEqual({ mode: 'off', ...full }) // aucune note perdue
    fireEvent.click(screen.getByRole('radio', { name: 'Cycle hormonal et énergie' })); expect(screen.getByText('Jour 13 du cycle')).toBeTruthy() // les dates retrouvées servent de nouveau
    cleanup(); await mount('#/8/suivi', s => { seed('off')(s); s.profile = MAN }); expect(screen.getByText(/D’après votre profil, le suivi de la récupération vous est proposé/)).toBeTruthy()
    cleanup(); await mount('#/8/suivi', seed('off')); expect(screen.getByText(/Choisissez le suivi qui vous convient ; l’autre suivi/)).toBeTruthy()
  })

  it('un début de règles donne le jour du cycle, la phase et les prochaines règles estimées ; la liste est triée et un écart inhabituel est signalé', async () => {
    await mount('#/8/suivi', cyc())
    expect(screen.getByText(/Aucun début de règles enregistré : saisissez ci-dessous le premier jour de vos dernières règles/)).toBeTruthy(); expect(screen.queryByText(/Dates enregistrées/)).toBeNull()
    addStart('2026-09-12')
    expect(screen.getByText('Début des règles enregistré : 12 septembre 2026.')).toBeTruthy(); expect(stored().cycle.starts).toEqual(['2026-09-12'])
    expect(screen.getByText('Jour 41 du cycle')).toBeTruthy(); expect(screen.getByText(/Au-delà de la durée habituelle du cycle/)).toBeTruthy()
    expect(screen.getByText(/Durée de cycle retenue : 28 jours \(valeur courante, faute de deux débuts de règles assez rapprochés\)/)).toBeTruthy()
    expect(screen.getByText(/Prochaines règles estimées : 10 octobre 2026 \(il y a 12 jours : le cycle est plus long que la moyenne\)/)).toBeTruthy()
    addStart('2026-10-10')
    expect(screen.getByText('Jour 13 du cycle')).toBeTruthy(); expect(screen.getByText(/Fenêtre d’ovulation probable/)).toBeTruthy()
    expect(screen.getByText(/Durée de cycle retenue : 28 jours \(mesurée sur 1 cycle\)/)).toBeTruthy(); expect(screen.getByText(/Prochaines règles estimées : 7 novembre 2026 \(dans 16 jours\)/)).toBeTruthy()
    const items = within(screen.getByRole('heading', { name: 'Dates enregistrées (2)' }).nextElementSibling as HTMLElement).getAllByRole('listitem')
    expect(items.map(i => i.textContent)).toEqual(['10 octobre 202628 jours après le début précédentRetirer', '12 septembre 2026Retirer']) // la plus récente d’abord
    addStart('2026-10-20')
    expect(screen.getByText(/L’écart avec la date voisine est inhabituel \(moins de 15 ou plus de 60 jours\) : il ne compte pas dans la durée moyenne du cycle\./)).toBeTruthy()
    expect(stored().cycle.starts).toEqual(['2026-09-12', '2026-10-10', '2026-10-20']); expect(screen.getByText('Jour 3 du cycle')).toBeTruthy(); expect(screen.getByText(/mesurée sur 1 cycle/)).toBeTruthy() // l’écart de 10 jours ne compte pas
  })

  it('date refusée (vide, future, déjà notée, vieille de plus de cinq ans, inexistante, 400 au plus) : message, rien d’enregistré, le message disparaît à la saisie suivante', async () => {
    await mount('#/8/suivi', cyc({ starts: ['2026-10-10'] }))
    const alert = () => screen.getByRole('alert').textContent
    expect((screen.getByLabelText('Premier jour des règles') as HTMLInputElement).max).toBe(DAY) // le sélecteur de date de l’appareil ne propose pas de jour futur
    addStart(''); expect(alert()).toBe('Choisissez une date valide.')
    addStart('2026-10-23'); expect(alert()).toBe('Le début des règles ne peut pas être dans le futur.')
    addStart('2026-10-10'); expect(alert()).toBe('Cette date est déjà enregistrée.')
    addStart('2020-01-01'); expect(alert()).toBe('Cette date remonte à plus de cinq ans : vérifiez l’année.')
    addStart('2026-02-30'); expect(alert()).toBe('Choisissez une date valide.')
    expect(stored().cycle.starts).toEqual(['2026-10-10']); type('Premier jour des règles', '2026-10-01'); expect(screen.queryByRole('alert')).toBeNull()
    cleanup(); await mount('#/8/suivi', cyc({ starts: Array.from({ length: 400 }, (_, i) => back(30 + i)) }))
    addStart(DAY); expect(alert()).toBe('Limite de 400 dates atteinte : retirez-en avant d’en ajouter.'); expect(stored().cycle.starts).toHaveLength(400)
  })

  it('un début de règles qui remonte à plus de 60 jours ne donne plus de jour du cycle ; « Retirer » demande confirmation, rend le focus au titre et recalcule', async () => {
    await mount('#/8/suivi', cyc({ starts: ['2026-08-01'] }))
    expect(screen.getByText(/Le dernier début enregistré \(1 août 2026\) remonte à plus de 60 jours : le jour du cycle n’est plus calculé/)).toBeTruthy(); expect(screen.queryByText(/Jour \d+ du cycle/)).toBeNull()
    cleanup(); await mount('#/8/suivi', cyc({ starts: ['2026-09-12', '2026-10-10'] }))
    fireEvent.click(btn('Retirer la date du 10 octobre 2026')); const g = screen.getByRole('group', { name: 'Retirer : 10 octobre 2026' }); expect(within(g).getByText('Retirer cette date ?')).toBeTruthy()
    fireEvent.click(within(g).getByRole('button', { name: 'Annuler' })); expect(stored().cycle.starts).toHaveLength(2); expect(screen.queryByRole('group', { name: /Retirer :/ })).toBeNull()
    fireEvent.click(btn('Retirer la date du 10 octobre 2026')); fireEvent.click(btn('Oui, retirer'))
    expect(stored().cycle.starts).toEqual(['2026-09-12']); expect(screen.getByText('Date retirée : 10 octobre 2026.')).toBeTruthy(); expect(screen.getByText('Jour 41 du cycle')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Où en êtes-vous ?' }))
    fireEvent.click(btn('Retirer la date du 12 septembre 2026')); fireEvent.click(btn('Oui, retirer'))
    expect(stored().cycle.starts).toEqual([]); expect(screen.getByText(/Aucun début de règles enregistré/)).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Où en êtes-vous ?' }))
  })

  it('huit dates : six sont montrées, « Afficher toutes les dates » déplie et « Réduire la liste » replie ; la durée du cycle est la moyenne des six derniers écarts', async () => {
    await mount('#/8/suivi', cyc({ starts: Array.from({ length: 8 }, (_, i) => back(12 + 28 * i)).reverse() }))
    const list = () => (screen.getByRole('heading', { name: 'Dates enregistrées (8)' }).nextElementSibling as HTMLElement)
    expect(within(list()).getAllByRole('listitem')).toHaveLength(6); expect(screen.getByText(/moyenne de vos 6 derniers cycles/)).toBeTruthy()
    fireEvent.click(btn('Afficher toutes les dates (8)')); expect(within(list()).getAllByRole('listitem')).toHaveLength(8); expect(btn('Réduire la liste').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(btn('Réduire la liste')); expect(within(list()).getAllByRole('listitem')).toHaveLength(6); expect(btn('Afficher toutes les dates (8)').getAttribute('aria-expanded')).toBe('false')
  })

  it('énergie du jour : une note de 1 à 5 par jour, enregistrée au choix, changeable, retirable ; le jour se choisit parmi les 14 derniers', async () => {
    await mount('#/8/suivi', cyc({ starts: ['2026-10-10'] }))
    expect(screen.getByRole('option', { name: 'Aujourd’hui, jeudi 22 octobre' })).toBeTruthy(); expect(screen.getByRole('option', { name: 'Hier, mercredi 21 octobre' })).toBeTruthy(); expect(screen.getAllByRole('option')).toHaveLength(14); expect(screen.getByRole('option', { name: 'vendredi 9 octobre' })).toBeTruthy()
    expect(screen.getAllByRole('radio', { checked: true }).map(r => r.getAttribute('name'))).toEqual(['sv-mode']) // aucune note cochée au départ
    rate('Énergie ressentie', 4)
    expect(stored().cycle.en).toEqual({ [DAY]: 4 }); expect(screen.getByText('Énergie enregistrée : 4 sur 5, aujourd’hui.').className).toBe('ok'); expect(screen.getByRole('option', { name: 'Aujourd’hui, jeudi 22 octobre · énergie 4' })).toBeTruthy()
    rate('Énergie ressentie', 5); expect(stored().cycle.en).toEqual({ [DAY]: 5 })
    type('Jour noté', '1'); expect((grp('Énergie ressentie').getByRole('radio', { name: '5' }) as HTMLInputElement).checked).toBe(false); expect(screen.queryByRole('button', { name: 'Retirer la note de ce jour' })).toBeNull() // hier n’est pas noté
    rate('Énergie ressentie', 2); expect(stored().cycle.en).toEqual({ [DAY]: 5, '2026-10-21': 2 }); expect(screen.getByText('Énergie enregistrée : 2 sur 5, hier.')).toBeTruthy()
    type('Jour noté', '2'); rate('Énergie ressentie', 3); expect(screen.getByText('Énergie enregistrée : 3 sur 5, mardi 20 octobre.')).toBeTruthy()
  })
  it('énergie : retirer la note d’un jour ; le graphique des 28 derniers jours se résume en texte ; les moyennes par phase n’apparaissent qu’à partir de 3 notes', async () => {
    const en = { '2026-10-11': 2, '2026-10-12': 3, '2026-10-13': 2, '2026-10-15': 4, '2026-10-16': 5, '2026-10-17': 4, '2026-10-18': 5, [DAY]: 3 }
    await mount('#/8/suivi', cyc({ starts: ['2026-09-12', '2026-10-10'], en }))
    expect(screen.getByRole('img', { name: 'Énergie des 28 derniers jours : 8 jours notés, moyenne 3,5 sur 5.' })).toBeTruthy()
    expect(document.querySelectorAll('.bars.dense div')).toHaveLength(28); expect([...document.querySelectorAll<HTMLElement>('.bars.dense i')].slice(-1)[0].style.height).toBe('42px') // aujourd’hui : 3 sur 5
    const ph = within(screen.getByRole('heading', { name: 'Énergie moyenne par phase' }).nextElementSibling as HTMLElement).getAllByRole('listitem').map(i => i.textContent)
    expect(ph).toEqual(['Règles : 2,3 sur 5 (3 notes)', 'Phase folliculaire : 4,5 sur 5 (4 notes)']) // la phase lutéale n’a que la note d’aujourd’hui : rien n’est affiché
    fireEvent.click(btn('Retirer la note de ce jour')); expect(screen.getByText('Note retirée : aujourd’hui.')).toBeTruthy(); expect(stored().cycle.en[DAY]).toBeUndefined(); expect(Object.keys(stored().cycle.en)).toHaveLength(7)
    expect(screen.getByRole('img', { name: 'Énergie des 28 derniers jours : 7 jours notés, moyenne 3,6 sur 5.' })).toBeTruthy()
    cleanup(); await mount('#/8/suivi', cyc({ starts: ['2026-10-10'], en: { '2026-10-11': 2, '2026-10-12': 3 } }))
    expect(screen.getByText('Une phase s’affiche ici à partir de 3 notes d’énergie prises pendant cette phase.')).toBeTruthy()
    cleanup(); await mount('#/8/suivi', cyc()); expect(screen.getByRole('img', { name: 'Énergie des 28 derniers jours : aucune note.' })).toBeTruthy()
  })

  it('récupération : trois notes de 1 à 5 sont toutes requises, enregistrées pour le jour choisi, modifiables et retirables ; chaque jour garde son propre brouillon', async () => {
    await mount('#/8/suivi', rcp())
    expect(screen.queryByLabelText('Premier jour des règles')).toBeNull(); expect(screen.queryByRole('group', { name: 'Énergie ressentie' })).toBeNull()
    fireEvent.click(btn('Enregistrer la journée')); expect(screen.getByRole('alert').textContent).toBe('Il manque une note de 1 à 5 : récupération nerveuse, force, vitalité.')
    rate('Récupération nerveuse', 2); expect(screen.queryByRole('alert')).toBeNull(); rate('Force', 3); fireEvent.click(btn('Enregistrer la journée'))
    expect(screen.getByRole('alert').textContent).toBe('Il manque une note de 1 à 5 : vitalité.'); expect(stored().cycle.rec).toEqual({})
    rate('Vitalité', 4); fireEvent.click(btn('Enregistrer la journée'))
    expect(stored().cycle.rec).toEqual({ [DAY]: [2, 3, 4] }); expect(screen.getByText('Journée enregistrée : aujourd’hui.')).toBeTruthy(); expect(screen.getByRole('option', { name: 'Aujourd’hui, jeudi 22 octobre · notée' })).toBeTruthy()
    type('Jour noté', '1'); expect(screen.getAllByRole('radio', { checked: true }).map(r => r.getAttribute('name'))).toEqual(['sv-mode']); expect(screen.queryByRole('button', { name: 'Retirer la note de ce jour' })).toBeNull()
    rate('Récupération nerveuse', 5); type('Jour noté', '0') // le brouillon d’hier ne déborde pas sur aujourd’hui
    expect((grp('Récupération nerveuse').getByRole('radio', { name: '2' }) as HTMLInputElement).checked).toBe(true); expect((grp('Vitalité').getByRole('radio', { name: '4' }) as HTMLInputElement).checked).toBe(true)
    type('Jour noté', '1'); rate('Force', 4); rate('Vitalité', 3); fireEvent.click(btn('Enregistrer la journée')) // le brouillon d’hier (récupération 5) est repris, puis complété
    expect(stored().cycle.rec).toEqual({ [DAY]: [2, 3, 4], '2026-10-21': [5, 4, 3] }); expect(screen.getByText('Journée enregistrée : hier.')).toBeTruthy()
    type('Jour noté', '0'); rate('Force', 5); fireEvent.click(btn('Enregistrer la journée')); expect(stored().cycle.rec).toEqual({ [DAY]: [2, 5, 4], '2026-10-21': [5, 4, 3] }) // modifier une journée déjà notée
    expect(screen.getByText('Moyenne sur 7 jours (2 jours notés) : récupération 3,5 · force 4,5 · vitalité 3,5 (sur 5).')).toBeTruthy()
    fireEvent.click(btn('Retirer la note de ce jour')); expect(stored().cycle.rec).toEqual({ '2026-10-21': [5, 4, 3] }); expect(screen.getByText('Note retirée : aujourd’hui.')).toBeTruthy(); expect(screen.getAllByRole('radio', { checked: true }).map(r => r.getAttribute('name'))).toEqual(['sv-mode'])
    expect(screen.getByText('Moyenne sur 7 jours (1 jour noté) : récupération 5 · force 4 · vitalité 3 (sur 5).')).toBeTruthy()
  })

  it('récupération : moyennes de la semaine, liste des jours notés (le plus récent d’abord) et graphique des 14 derniers jours', async () => {
    await mount('#/8/suivi', rcp({ rec: { [DAY]: [4, 3, 5], '2026-10-20': [2, 2, 3], '2026-10-01': [1, 1, 1] } }))
    expect(screen.getByText('Moyenne sur 7 jours (2 jours notés) : récupération 3 · force 2,5 · vitalité 4 (sur 5).')).toBeTruthy()
    const items = within(screen.getByRole('heading', { name: 'Cette semaine' }).nextElementSibling!.nextElementSibling as HTMLElement).getAllByRole('listitem').map(i => i.textContent)
    expect(items).toEqual(['jeudi 22 octobrerécupération 4 · force 3 · vitalité 5', 'mardi 20 octobrerécupération 2 · force 2 · vitalité 3'])
    expect(screen.getByRole('img', { name: 'Récupération nerveuse des 14 derniers jours : 2 jours notés, moyenne 3 sur 5.' })).toBeTruthy(); expect(document.querySelectorAll('.bars.dense div')).toHaveLength(14)
    expect(screen.queryByText('Récupération basse')).toBeNull()
  })

  it('récupération basse (2 sur 5 ou moins trois jours de suite) : conseil prudent sans diagnostic, aussi quand aujourd’hui n’est pas encore noté, et rappel dans Sport', async () => {
    const low = (d: string): [number, number, number] => [2, 4, 4]
    await mount('#/8/suivi', rcp({ rec: { [back(2)]: low(''), [back(1)]: [1, 3, 3], [DAY]: [2, 2, 2] } }))
    const card = screen.getByText('Récupération basse').parentElement!; expect(card.getAttribute('role')).toBe('status')
    expect(card.textContent).toMatch(/2 sur 5 ou moins depuis trois jours.*parlez-en à un professionnel de santé : Believe ne pose aucun diagnostic/)
    cleanup(); await mount('#/8/suivi', rcp({ rec: { [back(3)]: [2, 3, 3], [back(2)]: [2, 3, 3], [back(1)]: [1, 3, 3] } })) // le soir n’est pas encore arrivé : la série d’hier compte
    expect(screen.getByText('Récupération basse')).toBeTruthy()
    cleanup(); await mount('#/8/suivi', rcp({ rec: { [back(2)]: [2, 3, 3], [back(1)]: [3, 3, 3], [DAY]: [2, 3, 3] } })); expect(screen.queryByText('Récupération basse')).toBeNull() // une journée à 3 coupe la série
    cleanup(); await mount('#/8/suivi', rcp({ rec: { [back(1)]: [2, 3, 3], [DAY]: [2, 3, 3] } })); expect(screen.queryByText('Récupération basse')).toBeNull() // deux jours seulement
    cleanup(); await mount('#/8/suivi', rcp({ rec: { [back(4)]: [2, 3, 3], [back(3)]: [2, 3, 3], [back(1)]: [2, 3, 3] } })); expect(screen.queryByText('Récupération basse')).toBeNull() // une journée manquante coupe la série
    const dry = rcp({ rec: { [back(2)]: [2, 3, 3], [back(1)]: [2, 3, 3], [DAY]: [2, 3, 3] } })
    cleanup(); await mount('#/7/programmes', dry); expect(screen.getByRole('note').textContent).toMatch(/Votre récupération est basse depuis trois jours.*suggestion, jamais une consigne/); expect(screen.getByRole('link', { name: 'Voir le suivi' }).getAttribute('href')).toBe('#/8/suivi')
    cleanup(); await mount('#/7/programmes', s => { dry(s); s.consents.health = false }); expect(screen.queryByRole('note')).toBeNull() // accord « Santé » retiré : rien n’est lu
    cleanup(); await mount('#/7/programmes', s => { dry(s); s.cycle.mode = 'cycle' }); expect(screen.queryByRole('note')).toBeNull() // l’autre suivi n’affiche pas la récupération
    cleanup(); await mount('#/7/programmes', s => { dry(s); s.cycle.mode = 'off' }); expect(screen.queryByRole('note')).toBeNull()
  })

  it('« Effacer mes notes et dates » : décompte, confirmation, annulation possible ; le type de suivi est conservé ; rien d’autre n’est touché', async () => {
    await mount('#/8/suivi', s => { cyc({ starts: ['2026-09-12', '2026-10-10'], en: { [DAY]: 4, '2026-10-21': 3, '2026-10-20': 2 }, rec: { [DAY]: [3, 3, 3] } })(s); s.weights = [{ d: DAY, kg: 65 }]; s.water = { [DAY]: 500 } })
    expect(screen.getByText('Enregistré sur cet appareil : 2 débuts de règles, 3 énergies notées, 1 journée de récupération.')).toBeTruthy()
    fireEvent.click(btn('Effacer mes notes et dates')); const g = screen.getByRole('group', { name: 'Effacer mes notes et dates' }); expect(g.textContent).toMatch(/Effacer définitivement toutes ces notes et dates \? Le type de suivi est conservé\./)
    fireEvent.click(within(g).getByRole('button', { name: 'Annuler' })); expect(stored().cycle.starts).toHaveLength(2); expect(screen.queryByRole('group', { name: 'Effacer mes notes et dates' })).toBeNull()
    fireEvent.click(btn('Effacer mes notes et dates')); fireEvent.click(btn('Oui, tout effacer'))
    expect(stored().cycle).toEqual({ mode: 'cycle', starts: [], rec: {}, en: {} }); expect(screen.getByText('Notes et dates effacées. Le type de suivi est conservé.')).toBeTruthy(); expect(screen.getByText('Aucune note ni date enregistrée.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Effacer mes notes et dates' })).toBeNull(); expect(stored().weights).toHaveLength(1); expect(stored().water).toEqual({ [DAY]: 500 })
  })

  it('le partage est expliqué et son état affiché : aucun par défaut, « coché » seulement avec l’accord de partage et la case de la rubrique 5, jamais en suivi désactivé', async () => {
    await mount('#/8/suivi', cyc())
    expect(screen.getByText(/seulement le jour du cycle et l’énergie du jour : jamais les dates de règles/)).toBeTruthy(); expect(screen.getByText('Partage actuel : aucun, ce suivi n’est pas partagé.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Régler le partage' }).getAttribute('href')).toBe('#/5/partage')
    cleanup(); await mount('#/8/suivi', s => { cyc()(s); s.consents.share = true; s.share.vis = { cycle: true } }); expect(screen.getByText('Partage actuel : ce suivi est coché dans votre partage.')).toBeTruthy()
    cleanup(); await mount('#/8/suivi', s => { rcp()(s); s.consents.share = true; s.share.vis = { cycle: true } }); expect(screen.getByText(/seulement la récupération, la force et la vitalité du jour : jamais les dates de règles/)).toBeTruthy()
    cleanup(); await mount('#/8/suivi', s => { seed('off')(s); s.consents.share = true; s.share.vis = { cycle: true } }); expect(screen.getByText('Partage actuel : aucun, ce suivi n’est pas partagé.')).toBeTruthy()
    cleanup(); await mount('#/8/suivi', s => { cyc()(s); s.share.vis = { cycle: true } }); expect(screen.getByText('Partage actuel : aucun, ce suivi n’est pas partagé.')).toBeTruthy() // case cochée mais accord de partage absent
  })

  it('stockage plein ou indisponible : chaque enregistrement le dit au lieu de faire croire à une sauvegarde, et l’écriture reprend quand le stockage revient', async () => {
    await mount('#/8/suivi', cyc({ starts: ['2026-10-10'] }))
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    rate('Énergie ressentie', 4)
    expect(screen.getByText('Énergie enregistrée : 4 sur 5, aujourd’hui : non enregistré, le stockage local est indisponible ou plein.').className).toBe('ko'); expect(screen.getByText(/Enregistrement impossible/)).toBeTruthy(); expect((grp('Énergie ressentie').getByRole('radio', { name: '4' }) as HTMLInputElement).checked).toBe(true)
    addStart('2026-10-12'); expect(screen.getByText('Début des règles du 12 octobre 2026 : non enregistré, le stockage local est indisponible ou plein.')).toBeTruthy()
    set.mockRestore(); rate('Énergie ressentie', 5); expect(stored().cycle.en).toEqual({ [DAY]: 5 }); expect(stored().cycle.starts).toEqual(['2026-10-10', '2026-10-12']) // le stockage revient : tout est écrit
  })

  it('les données du suivi sont masquées en mode discret ; les dates de l’onglet, les graphiques et les moyennes portent la marque « sensible »', async () => {
    await mount('#/8/suivi', cyc({ starts: ['2026-10-10'], en: { [DAY]: 4 } }))
    for (const el of [screen.getByText('Jour 13 du cycle').closest('.card'), screen.getByRole('img', { name: /Énergie des 28 derniers jours/ }), screen.getByRole('heading', { name: 'Dates enregistrées (1)' }).nextElementSibling]) expect(el!.classList.contains('sens'), el!.outerHTML.slice(0, 60)).toBe(true)
  })
  it('4 000 jours notés au plus par suivi : un jour de plus est refusé avec un message clair, un jour déjà noté reste modifiable', async () => {
    const days = Array.from({ length: 4000 }, (_, i) => back(30 + i))
    await mount('#/8/suivi', cyc({ starts: ['2026-10-10'], en: Object.fromEntries(days.map(d => [d, 3])) }))
    rate('Énergie ressentie', 4)
    expect(screen.getByText('Limite de 4 000 jours notés atteinte : effacez des notes avant d’en ajouter.')).toBeTruthy(); expect(Object.keys(stored().cycle.en)).toHaveLength(4000); expect(stored().cycle.en[DAY]).toBeUndefined()
    cleanup(); await mount('#/8/suivi', cyc({ starts: ['2026-10-10'], en: Object.fromEntries([DAY, ...days.slice(1)].map(d => [d, 3])) })) // 4 000 entrées dont aujourd’hui : on peut la modifier
    rate('Énergie ressentie', 5); expect(stored().cycle.en[DAY]).toBe(5); expect(Object.keys(stored().cycle.en)).toHaveLength(4000)
    cleanup(); await mount('#/8/suivi', rcp({ rec: Object.fromEntries(days.map(d => [d, [3, 3, 3]])) }))
    rate('Récupération nerveuse', 2); rate('Force', 2); rate('Vitalité', 2); fireEvent.click(btn('Enregistrer la journée'))
    expect(screen.getByRole('alert').textContent).toBe('Limite de 4 000 jours notés atteinte : effacez des notes avant d’en ajouter.'); expect(stored().cycle.rec[DAY]).toBeUndefined()
  })

  it('les prochaines règles estimées se disent en clair : aujourd’hui, demain, dans N jours, hier ou plus tôt, avec la mention d’un cycle plus long que la moyenne', async () => {
    const next = async (ago: number) => { cleanup(); await mount('#/8/suivi', cyc({ starts: [back(ago)] })); return screen.getByText(/Prochaines règles estimées/).textContent }
    expect(await next(28)).toBe('Prochaines règles estimées : 22 octobre 2026 (aujourd’hui).')
    expect(await next(27)).toBe('Prochaines règles estimées : 23 octobre 2026 (demain).')
    expect(await next(20)).toBe('Prochaines règles estimées : 30 octobre 2026 (dans 8 jours).')
    expect(await next(29)).toBe('Prochaines règles estimées : 21 octobre 2026 (hier : le cycle est plus long que la moyenne).')
    expect(await next(33)).toBe('Prochaines règles estimées : 17 octobre 2026 (il y a 5 jours : le cycle est plus long que la moyenne).')
  })
})
