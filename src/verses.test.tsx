import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { VF, VM, refSpoken, trLabel } from './verses'
import { btn, iso, mount, reopen, stored, tick, withCrypto } from './testkit'
import type { Profile } from './lib'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

const FEM: Profile = { g: 'F', name: 'Ada', age: 30, h: 170, w: 65, t: 60, ws: 71, lv: 'I', sx: 'F' }
const MAN: Profile = { ...FEM, g: 'M', name: 'Léo', sx: 'M' }
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
const verse = () => screen.getByRole('region', { name: 'Verset du jour' })
const win = () => screen.queryByRole('dialog', { name: 'Verset du jour' })

describe('Rubrique 4 : versets', () => {
  it('28 versets pour le profil Femme, 29 pour le profil Homme, références uniques et bien formées, textes soignés', () => {
    const all = [...VF, ...VM]
    expect([VF.length, VM.length]).toEqual([28, 29])
    expect(new Set(all.map(v => v[0])).size).toBe(57); expect(new Set(all.map(v => v[1])).size).toBe(57)
    for (const [ref, text, tr] of all) {
      expect(ref, ref).toMatch(/^(\d )?\p{L}[\p{L} ]* \d+:\d+[ab]?$/u)
      expect(text.length, ref).toBeGreaterThan(15)
      expect(text, ref).not.toMatch(/['[\]]|\s\s|^\s|\s$/) // ni apostrophe droite, ni crochet, ni double espace
      expect(text, ref).toMatch(/[.!?…]$/) // jamais coupé au milieu d’une phrase
      expect(['LSG', 'MAR', undefined], ref).toContain(tr)
    }
    expect(VM.filter(v => v[2] === 'MAR').map(v => v[0])).toEqual(['Proverbes 27:17']); expect(VF.some(v => v[2])).toBe(false)
  })

  it('la traduction et son statut accompagnent chaque verset ; la référence se lit à voix haute sans « un Jean » ni « deux Timothée »', () => {
    expect(trLabel(['Luc 1:37', 'x'])).toBe('Louis Segond 1910 (domaine public)'); expect(trLabel(['Proverbes 27:17', 'x', 'MAR'])).toBe('Martin 1744 (domaine public)')
    const spoken: Record<string, string> = {
      'Psaume 46:6': 'Psaume 46, verset 6', 'Proverbes 31:25': 'Proverbes, chapitre 31, verset 25', '1 Jean 1:9': 'Première épître de Jean, chapitre 1, verset 9', '2 Timothée 1:7': 'Deuxième épître à Timothée, chapitre 1, verset 7',
      '1 Samuel 2:1b': 'Premier livre de Samuel, chapitre 2, verset 1, seconde partie', 'Juges 6:12b': 'Juges, chapitre 6, verset 12, seconde partie', 'Marc 5:34b': 'Marc, chapitre 5, verset 34, seconde partie', 'Ésaïe 40:31': 'Ésaïe, chapitre 40, verset 31'
    }
    for (const [ref, want] of Object.entries(spoken)) expect(refSpoken(ref)).toBe(want)
    expect(refSpoken('1 Corinthiens 16:13a')).toBe('Première épître aux Corinthiens, chapitre 16, verset 13, première partie'); expect(refSpoken('n’importe quoi')).toBe('n’importe quoi')
    for (const [ref] of [...VF, ...VM]) { const r = refSpoken(ref); expect(r, ref).not.toMatch(/^\d/); expect(r, ref).toMatch(/verset \d+/) }
  })

  it('l’accueil montre un verset de la liste du profil, avec sa référence et sa traduction ; « Nouveau verset » passe au suivant, enregistré, et revient au début après le dernier', async () => {
    await mount('#/4', s => { s.profile = FEM; s.verse = { d: day(0), i: 2 } })
    expect(verse().textContent).toContain('« ' + VF[2][1] + ' »'); expect(within(verse()).getByText('Psaume 46:6, Louis Segond 1910 (domaine public)')).toBeTruthy()
    fireEvent.click(within(verse()).getByRole('button', { name: 'Nouveau verset' }))
    expect(verse().textContent).toContain(VF[3][1]); expect(stored().verse).toEqual({ d: day(0), i: 3 })
    cleanup(); await mount('#/4', s => { s.profile = FEM; s.verse = { d: day(0), i: 27 } }); fireEvent.click(within(verse()).getByRole('button', { name: 'Nouveau verset' }))
    expect(verse().textContent).toContain(VF[0][1]); expect(stored().verse.i).toBe(0)
  })

  it('profil Homme : liste Homme, la Martin 1744 est signalée ; sans profil, la liste complète est proposée', async () => {
    await mount('#/4', s => { s.profile = MAN; s.verse = { d: day(0), i: 3 } })
    expect(verse().textContent).toContain(VM[3][1]); expect(within(verse()).getByText('Proverbes 27:17, Martin 1744 (domaine public)')).toBeTruthy()
    cleanup(); await mount('#/4', s => { s.verse = { d: day(0), i: 30 } }) // 28 versets Femme, puis les versets Homme : l’indice 30 est le troisième verset Homme
    expect(verse().textContent).toContain(VM[2][1]); expect(screen.getByRole('link', { name: 'Renseigner mon profil' }).getAttribute('href')).toBe('#/1')
    fireEvent.click(within(verse()).getByRole('button', { name: 'Nouveau verset' })); expect(verse().textContent).toContain(VM[3][1])
  })

  it('un nouveau jour, sans choix mémorisé, donne un verset de la liste du profil (jamais en dehors de la liste)', async () => {
    for (const p of [FEM, MAN, null]) {
      cleanup(); await mount('#/4', s => { s.profile = p; s.verse = null })
      const list = p ? (p.g === 'F' ? VF : VM) : [...VF, ...VM]
      expect(list.some(v => verse().textContent!.includes('« ' + v[1] + ' »'))).toBe(true)
    }
  })

  it('lecture vocale : le texte du verset puis sa référence prononcée, une seule lecture à la fois', async () => {
    const speak = vi.fn(), cancel = vi.fn(), made: { text: string; lang: string }[] = []
    class Utt { text: string; lang = ''; constructor(t: string) { this.text = t; made.push(this) } }
    await mount('#/4', s => { s.profile = FEM; s.verse = { d: day(0), i: 2 } }, async () => { vi.stubGlobal('speechSynthesis', { speak, cancel }); vi.stubGlobal('SpeechSynthesisUtterance', Utt) })
    fireEvent.click(btn('Écouter'))
    expect(cancel).toHaveBeenCalledTimes(1); expect(speak).toHaveBeenCalledTimes(1); expect(made).toHaveLength(1)
    expect(made[0].text).toBe(VF[2][1] + ' Psaume 46, verset 6'); expect(made[0].lang).toBe('fr-FR')
  })

  it('sans synthèse vocale dans le navigateur, le bouton « Écouter » n’est pas proposé', async () => {
    await mount('#/4', s => { s.profile = FEM }); expect(screen.queryByRole('button', { name: 'Écouter' })).toBeNull()
  })
})

describe('Rubrique 4 : fenêtre du verset du jour', () => {
  it('s’ouvre une seule fois par jour : fermée par « Continuer », elle ne revient pas à la réouverture', async () => {
    await mount('#/4', s => { s.profile = FEM; s.verse = { d: day(0), i: 5 }; s.ui.verseDay = null })
    const d = win()!; expect(d).toBeTruthy(); expect(within(d).getByText('« ' + VF[5][1] + ' »')).toBeTruthy(); expect(within(d).getByText('Ésaïe 43:1b, Louis Segond 1910 (domaine public)')).toBeTruthy()
    expect(document.activeElement).toBe(within(d).getByRole('button', { name: 'Continuer' })); expect(stored().ui.verseDay).toBeNull() // rien n’est marqué tant que la fenêtre n’est pas fermée
    fireEvent.click(within(d).getByRole('button', { name: 'Continuer' })); expect(win()).toBeNull(); expect(stored().ui.verseDay).toBe(day(0))
    cleanup(); await reopen('#/4'); expect(win()).toBeNull()
  })

  it('« Nouveau verset » dans la fenêtre change le verset du jour et l’enregistre ; Échap ferme la fenêtre et compte comme vue', async () => {
    await mount('#/4', s => { s.profile = MAN; s.verse = { d: day(0), i: 0 }; s.ui.verseDay = null })
    fireEvent.click(within(win()!).getByRole('button', { name: 'Nouveau verset' }))
    expect(within(win()!).getByText('« ' + VM[1][1] + ' »')).toBeTruthy(); expect(stored().verse).toEqual({ d: day(0), i: 1 }); expect(verse().textContent).toContain(VM[1][1]) // la page derrière montre le même verset
    fireEvent.keyDown(document, { key: 'Escape' }); expect(win()).toBeNull(); expect(stored().ui.verseDay).toBe(day(0))
  })

  it('la veille déjà vue : la fenêtre revient le lendemain, y compris au retour dans l’application ouverte', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-22T10:00:00'))
    await mount('#/4', s => { s.profile = FEM; s.ui.verseDay = '2026-10-22' })
    expect(win()).toBeNull()
    vi.setSystemTime(new Date('2026-10-23T08:00:00')); act(() => { document.dispatchEvent(new Event('visibilitychange')) }); await tick(10)
    expect(win()).toBeTruthy(); fireEvent.click(within(win()!).getByRole('button', { name: 'Continuer' })); expect(stored().ui.verseDay).toBe('2026-10-23')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) }); await tick(10); expect(win()).toBeNull() // déjà vue aujourd’hui
  })

  it('derrière l’écran du PIN, ni verset ni donnée n’apparaissent : la fenêtre s’ouvre après le déverrouillage', async () => {
    withCrypto()
    await mount('#/4', s => { s.profile = FEM; s.ui.verseDay = null }, async () => { await (await import('./pin')).setPin('4821', 1, 1000) })
    expect(screen.getByRole('dialog', { name: 'Saisissez votre PIN' })).toBeTruthy(); expect(win()).toBeNull(); expect(screen.queryByText(/Louis Segond/)).toBeNull(); expect(screen.queryByText(/Ada/)).toBeNull()
    for (const c of '4821') fireEvent.click(btn(c))
    expect(await screen.findByRole('dialog', { name: 'Verset du jour' })).toBeTruthy(); expect(screen.queryByRole('dialog', { name: 'Saisissez votre PIN' })).toBeNull()
    fireEvent.click(within(win()!).getByRole('button', { name: 'Continuer' })); expect(stored().ui.verseDay).toBe(day(0))
  })

  it('verrouillage pendant que la fenêtre est ouverte : elle disparaît avec le verrou et revient au déverrouillage, tant qu’elle n’a pas été fermée', async () => {
    withCrypto()
    await mount('#/4', s => { s.profile = FEM; s.ui.verseDay = null }, async () => { await (await import('./pin')).setPin('4821', 0, 1000) })
    for (const c of '4821') fireEvent.click(btn(c)); expect(await screen.findByRole('dialog', { name: 'Verset du jour' })).toBeTruthy()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(screen.getByRole('dialog', { name: 'Saisissez votre PIN' })).toBeTruthy(); expect(win()).toBeNull(); expect(screen.queryByText(/Louis Segond/)).toBeNull()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    for (const c of '4821') fireEvent.click(btn(c)); expect(await screen.findByRole('dialog', { name: 'Verset du jour' })).toBeTruthy()
  })
})
