import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { btn, mount, reopen, stored, tick } from './testkit'
import type { State } from './lib'

const DAY = '2026-10-22' // jeudi : la semaine va du lundi 19 au dimanche 25
const STAMP = DAY + 'T08:00:00.000Z'
const book = (id: string, t: string, st: 'lire' | 'cours' | 'fini') => ({ id, t, a: 'Pascal', src: 'perso' as const, ref: '', cover: null, url: null, total: 200, page: 0, st })

/** Un état rempli de données personnelles reconnaissables : si l'une d'elles sort alors que sa case est décochée, un test le voit. */
const seed = (s: State) => {
  s.consents.share = true
  s.profile = { g: 'F', name: 'Ada', age: 37, h: 171, w: 66.6, t: 59.4, ws: 73.3, lv: 'I', sx: 'F' }
  s.habits[0].n = 'Prière du matin'
  s.checks = { '2026-10-19': ['h1', 'h2'], '2026-10-20': ['h1'], '2026-10-21': ['h1'], [DAY]: ['h1'] }
  s.steps = { '2026-10-20': 12000 }
  s.workouts = [{ d: '2026-10-21', act: 'Course', km: 7.5, sec: 2400, kcal: 500, gain: 20 }]
  s.weights = [{ d: '2026-10-15', kg: 68 }, { d: '2026-10-21', kg: 66.6 }]
  s.meals = [{ id: 'm1', d: DAY, n: 'Soupe du soir', kcal: 321, p: 1, g: 1, l: 1, src: 'manuel' }]
  s.prayers = [{ id: 'p1', t: 'Retrouver la paix intérieure', c: DAY, a: null }, { id: 'g1', t: 'Merci pour mes enfants en bonne santé', c: DAY, a: null, k: 'g' }]
  s.notes = [{ id: 'n1', cat: 'Rêves', t: 'Le fleuve secret', b: 'Texte intime du rêve', c: STAMP, u: STAMP }]
  s.cycle = { mode: 'recup', starts: [], rec: { [DAY]: [4, 3, 5] }, en: {} }
  s.books = [book('b1', 'Les Pensées', 'cours'), book('b2', 'Titre déjà terminé', 'fini'), book('b3', 'Titre à lire plus tard', 'lire')]
  s.quiz.hist = [{ d: '2026-10-20', n: 5, ok: 4, cats: [] }]
}
/** Ce qui ne doit apparaître que si la case correspondante est cochée. */
const ONLY: Record<string, string[]> = {
  weight: ['73,3', '66,6', '59,4'], weightPct: ['% du chemin parcouru'], cycle: ['Récupération 4 sur 5', 'force 3 sur 5'],
  food: ['Soupe du soir', '321 kcal'], prayers: ['Retrouver la paix intérieure'], notes: ['Rêves : 1']
}
/** Ce qui ne doit jamais apparaître, quelles que soient les cases. */
const NEVER = ['Merci pour mes enfants en bonne santé', 'Prière du matin', 'Le fleuve secret', 'Texte intime du rêve', 'Titre déjà terminé', 'Titre à lire plus tard', '68 kg', '68,0']

// ---- Canevas et partage simulés (jsdom n'a ni l'un ni l'autre)
const painted: string[] = []
const ctx2d = {
  measureText: (s: string) => ({ width: 8 * s.length }), fillText: (s: string) => { painted.push(s) }, createLinearGradient: () => ({ addColorStop: () => {} }),
  fillRect: () => {}, save: () => {}, restore: () => {}, translate: () => {}, scale: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}
}
const canvasOn = () => {
  HTMLCanvasElement.prototype.getContext = (() => ctx2d) as never
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })) } as never
}
const canvasOff = () => { HTMLCanvasElement.prototype.getContext = (() => null) as never }
const nav = navigator as unknown as Record<string, unknown>
const setNav = (k: string, v: unknown) => Object.defineProperty(navigator, k, { value: v, configurable: true, writable: true })
const stubShare = (impl: (d: ShareData) => Promise<void> = async () => {}, files = true) => {
  const share = vi.fn(impl); setNav('share', share); if (files) setNav('canShare', vi.fn(() => true)); return share
}
let fetchSpy = vi.fn()
let urls = 0

beforeEach(() => {
  painted.length = 0; urls = 0; fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
  URL.createObjectURL = vi.fn(() => 'blob:card-' + ++urls); URL.revokeObjectURL = vi.fn()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(DAY + 'T10:00:00')); canvasOn()
})
afterEach(async () => {
  // Rien de ce qui touche au partage ne doit passer par le réseau : la carte est faite et remise sur l'appareil.
  expect(fetchSpy).not.toHaveBeenCalled()
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); canvasOff()
  for (const k of ['share', 'canShare', 'clipboard']) delete nav[k]
  await tick(20)
})

const box = (t: string) => screen.getByLabelText(t) as HTMLInputElement
const region = () => screen.getByRole('region', { name: 'Vue Ami : aperçu exact' })
const view = () => within(region())
const lines = () => [...region().querySelectorAll('li')].map(li => li.textContent!)
const tickBox = (t: string, sensitive = false) => { fireEvent.click(box(t)); if (sensitive) fireEvent.click(within(screen.getByRole('group', { name: 'Confirmer : ' + t })).getByRole('button', { name: 'Oui, la montrer à mes amis' })) }
const ITEM = {
  name: 'Mon prénom', habits: 'Mes habitudes', badges: 'Mes badges', steps: 'Mes pas et ma distance', quiz: 'Mes scores de quiz', books: 'Mes lectures en cours',
  weight: 'Mon poids (départ, actuel, objectif)', weightPct: 'Ma progression vers mon objectif de poids', cycle: 'Mon suivi cycle ou récupération', food: 'Mes calories et repas du jour', prayers: 'Mes sujets de prière', notes: 'Mes notes'
}
const SENSITIVE = new Set(['weight', 'weightPct', 'cycle', 'food', 'prayers', 'notes'])
const image = () => waitFor(() => screen.getByAltText(/Image de la carte/) as HTMLImageElement)

describe('Rubrique 5 : partage avec des amis', () => {
  it('par défaut tout est masqué : douze cases décochées, aucune carte, aucun bouton de partage actif, rien d’écrit dans l’état', async () => {
    await mount('#/5/partage', seed)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes).toHaveLength(12); expect(boxes.every(b => !b.checked)).toBe(true)
    expect(screen.getAllByText('Masqué')).toHaveLength(12); expect(screen.queryByText('Visible')).toBeNull()
    expect(view().getByText(/Aucun élément visible pour vos amis/)).toBeTruthy(); expect(region().querySelectorAll('li')).toHaveLength(0)
    for (const n of ['Partager la carte', 'Télécharger l’image', 'Copier le texte']) expect((btn(n) as HTMLButtonElement).disabled).toBe(true)
    expect((btn('Tout masquer') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByAltText(/Image de la carte/)).toBeNull(); expect(stored().share.vis).toEqual({}); expect(painted).toEqual([])
    expect(screen.getByText(/Masqué pour vos amis \(12\)/)).toBeTruthy()
    for (const b of boxes) { const d = document.getElementById(b.getAttribute('aria-describedby')!); expect(d?.textContent?.length).toBeGreaterThan(10) } // chaque case a sa description lue par les lecteurs d’écran
    expect(screen.getByText(/Le tracé GPS : Believe ne l’enregistre pas/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('Ada')
  })

  it('sans accord « Partage », aucune case ni carte : l’accord seul ne rend rien visible', async () => {
    await mount('#/5/partage', s => { seed(s); s.consents.share = false; s.share.vis = {} })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0); expect(screen.queryByRole('region', { name: 'Vue Ami : aperçu exact' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Partager la carte' })).toBeNull()
    expect(screen.getByText(/Believe n’envoie rien lui-même/)).toBeTruthy(); expect(screen.getByRole('link', { name: 'Plus tard' }).getAttribute('href')).toBe('#/4')
    fireEvent.click(btn('J’accepte')); expect(stored().consents.share).toBe(true)
    expect(screen.getAllByRole('checkbox')).toHaveLength(12); expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(b => !b.checked)).toBe(true); expect(stored().share.vis).toEqual({})
  })

  it('une case non sensible s’applique aussitôt : l’aperçu, l’état enregistré et l’image changent ensemble', async () => {
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); expect(stored().share.vis).toEqual({ name: true }); expect(screen.getAllByText('Visible')).toHaveLength(1)
    expect(view().getByText('Suivi de Ada')).toBeTruthy(); expect(view().getByText('22 octobre 2026')).toBeTruthy()
    expect(lines()).toEqual([]); // le prénom seul est dans le titre : pas de ligne de détail
    tickBox(ITEM.habits); expect(stored().share.vis).toEqual({ name: true, habits: true })
    expect(lines()).toEqual(['Réussite : 16 %', 'Plus longue série en cours : 4 jours'])
    expect(view().getByRole('region', { name: 'Habitudes de la semaine' })).toBeTruthy()
    tickBox(ITEM.steps); tickBox(ITEM.quiz); tickBox(ITEM.books); tickBox(ITEM.badges)
    expect(lines()).toEqual(['Réussite : 16 %', 'Plus longue série en cours : 4 jours', 'Premier pas', 'Dix mille pas', 'Cinq kilomètres', 'Livre terminé', '10 000 pas atteints : 1 jour cette semaine', 'Distance des séances : 7,5 km cette semaine', '1 quiz terminé · moyenne 80 %', 'Dernier score : 80 %', '« Les Pensées », Pascal'])
    const img = await image(); expect(img.getAttribute('src')).toMatch(/^blob:card-/)
    expect(painted).toContain('Suivi de Ada'); expect(painted.join('\n')).toContain('« Les Pensées », Pascal')
    for (const x of [...NEVER, ...Object.values(ONLY).flat()]) { expect(painted.join('\n')).not.toContain(x); expect(region().textContent).not.toContain(x) }
    tickBox(ITEM.habits); expect(stored().share.vis).not.toHaveProperty('habits'); expect(lines()).not.toContain('Réussite : 16 %') // décocher masque aussitôt
  })

  it('un élément sensible demande une confirmation : « Non » le garde masqué, « Oui » l’affiche, décocher le masque aussitôt ; une seule question à la fois', async () => {
    await mount('#/5/partage', seed)
    fireEvent.click(box(ITEM.weight)); expect(box(ITEM.weight).checked).toBe(false); expect(stored().share.vis).toEqual({}); await tick(20); expect(painted).toEqual([]) // avant la confirmation, rien n’est dessiné
    const grp = screen.getByRole('group', { name: 'Confirmer : ' + ITEM.weight })
    expect(within(grp).getByText(/Information sensible/)).toBeTruthy(); expect(view().getByText(/Aucun élément visible/)).toBeTruthy(); expect(region().textContent).not.toContain('73,3') // rien n’est montré avant la confirmation
    fireEvent.click(box(ITEM.notes)); expect(screen.queryByRole('group', { name: 'Confirmer : ' + ITEM.weight })).toBeNull(); expect(screen.getAllByRole('group', { name: /^Confirmer/ })).toHaveLength(1)
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirmer : ' + ITEM.notes })).getByRole('button', { name: 'Non, la garder masquée' }))
    expect(screen.queryAllByRole('group', { name: /^Confirmer/ })).toHaveLength(0); expect(stored().share.vis).toEqual({})
    tickBox(ITEM.weight, true); expect(box(ITEM.weight).checked).toBe(true); expect(stored().share.vis).toEqual({ weight: true })
    expect(lines()).toEqual(['Départ 73,3 kg · actuel 66,6 kg · objectif 59,4 kg']); expect(region().querySelector('li.sens')).not.toBeNull() // flou en mode discret
    expect(screen.getAllByText('Visible')).toHaveLength(1)
    await image(); expect(painted.join('\n')).toContain('73,3') // l’image n’est dessinée qu’après la confirmation
    fireEvent.click(box(ITEM.weight)); expect(stored().share.vis).toEqual({}); expect(box(ITEM.weight).checked).toBe(false); expect(region().textContent).not.toContain('73,3')
    painted.length = 0; await tick(20); expect(painted).toEqual([]); expect(screen.queryByAltText(/Image de la carte/)).toBeNull(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:card-1') // plus rien n’est dessiné, l’image précédente est libérée
  })

  it('chaque catégorie sensible, cochée seule, ne montre que son propre contenu', async () => {
    for (const k of ['weight', 'weightPct', 'cycle', 'food', 'prayers', 'notes'] as const) {
      painted.length = 0
      await mount('#/5/partage', seed)
      tickBox(ITEM[k], true); expect(stored().share.vis).toEqual({ [k]: true })
      const txt = region().textContent!
      for (const x of ONLY[k]) expect(txt, k + ' : « ' + x + ' » attendu').toContain(x)
      for (const [k2, list] of Object.entries(ONLY)) if (k2 !== k) for (const x of list) expect(txt, k + ' ne doit pas montrer ' + k2).not.toContain(x)
      for (const x of NEVER) expect(txt).not.toContain(x)
      await image(); const drawn = painted.join('\n'); for (const x of NEVER) expect(drawn).not.toContain(x)
      for (const [k2, list] of Object.entries(ONLY)) if (k2 !== k) for (const x of list) expect(drawn, k + ' : image avec ' + k2).not.toContain(x)
      cleanup()
    }
  })

  it('« Partager la carte » remet à l’appareil l’image et le texte de l’aperçu, et seulement cela ; la réussite n’est jamais annoncée', async () => {
    const share = stubShare()
    await mount('#/5/partage', seed)
    for (const k of ['name', 'habits', 'books', 'steps'] as const) tickBox(ITEM[k]); tickBox(ITEM.weightPct, true)
    await image(); fireEvent.click(btn('Partager la carte')); await tick(10)
    expect(share).toHaveBeenCalledTimes(1)
    const arg = share.mock.calls[0][0] as ShareData
    expect(arg.files).toHaveLength(1); expect(arg.files![0].name).toBe('believe-suivi.png'); expect(arg.files![0].type).toBe('image/png'); expect(arg.title).toBe('Suivi de Ada')
    const ls = lines(); expect(ls.length).toBeGreaterThan(4)
    for (const l of ls) expect(arg.text).toContain('– ' + l)
    expect((arg.text!.match(/^– /gm) ?? []).length).toBe(ls.length) // le texte n’a ni plus ni moins de lignes que l’aperçu
    expect(arg.text!.startsWith('Suivi de Ada · 22 octobre 2026\n')).toBe(true)
    for (const x of [...NEVER, ...ONLY.weight, ...ONLY.food, ...ONLY.prayers, ...ONLY.notes, ...ONLY.cycle]) { expect(arg.text).not.toContain(x); expect(painted.join('\n')).not.toContain(x) }
    expect(arg.text).toContain('% du chemin parcouru')
    const note = screen.getByText(/Le menu de partage s’est fermé/); expect(note.textContent).toContain('Believe ne sait pas si elle a ensuite été envoyée'); expect(screen.queryByText(/envoyée avec succès|partagée avec succès/i)).toBeNull()
  })

  it('sans partage de fichiers, seul le texte est remis, et le message le dit ; sans menu de partage, il propose le téléchargement et la copie', async () => {
    const share = stubShare(async () => {}, false)
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); tickBox(ITEM.habits); await image(); fireEvent.click(btn('Partager la carte')); await tick(10)
    expect(share).toHaveBeenCalledTimes(1); const arg = share.mock.calls[0][0] as ShareData; expect(arg.files).toBeUndefined(); expect(arg.text).toContain('– Réussite : 16 %')
    expect(screen.getByText(/ce navigateur ne partage pas l’image/)).toBeTruthy()
    cleanup(); delete nav.share
    await mount('#/5/partage', seed); tickBox(ITEM.name); tickBox(ITEM.habits); await image(); fireEvent.click(btn('Partager la carte')); await tick(5)
    expect(screen.getByText(/Ce navigateur n’a pas de menu de partage/)).toBeTruthy(); expect(screen.getByText(/Ce navigateur n’a pas de menu de partage/).className).toBe('ko')
  })

  it('annulation et refus du menu de partage : « rien n’a été envoyé » pour une annulation, l’erreur et les solutions de repli pour un refus', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' })
    const share = stubShare(async () => { throw abort })
    await mount('#/5/partage', seed)
    tickBox(ITEM.habits); await image(); fireEvent.click(btn('Partager la carte')); await tick(10)
    expect(screen.getByText('Partage annulé : rien n’a été envoyé.')).toBeTruthy()
    share.mockImplementation(async () => { throw new Error('autorisation refusée') }); fireEvent.click(btn('Partager la carte')); await tick(10)
    const e = screen.getByText(/Partage impossible : autorisation refusée/); expect(e.className).toBe('ko'); expect(e.textContent).toContain('Télécharger l’image'); expect(screen.queryByText('Partage annulé : rien n’a été envoyé.')).toBeNull()
  })

  it('copier le texte : exactement le texte de l’aperçu ; refus du presse-papiers expliqué ; télécharger : le fichier « believe-suivi.png » est proposé', async () => {
    const write = vi.fn().mockResolvedValue(undefined); setNav('clipboard', { writeText: write }); const share = stubShare()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); tickBox(ITEM.habits); const img = await image()
    fireEvent.click(btn('Copier le texte')); await tick(5)
    expect(write).toHaveBeenCalledTimes(1); const text = write.mock.calls[0][0] as string; expect(text).toContain('Suivi de Ada · 22 octobre 2026'); expect(text).toContain('– Réussite : 16 %'); expect(text).not.toContain('Prière du matin')
    expect(screen.getByText('Texte copié dans le presse-papiers.')).toBeTruthy()
    for (const x of [...NEVER, ...Object.values(ONLY).flat()]) expect(text).not.toContain(x)
    fireEvent.click(btn('Partager la carte')); await tick(10); expect((share.mock.calls[0][0] as ShareData).text).toBe(text) // copier et partager remettent exactement le même texte
    write.mockRejectedValueOnce(new Error('non')); fireEvent.click(btn('Copier le texte')); await tick(5); expect(screen.getByText(/Copie refusée par le navigateur/).className).toBe('ko')
    delete nav.clipboard; fireEvent.click(btn('Copier le texte')); expect(screen.getByText(/Copie refusée par le navigateur/)).toBeTruthy()
    fireEvent.click(btn('Télécharger l’image')); expect(click).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Téléchargement de l’image lancé.*believe-suivi\.png/)).toBeTruthy(); expect(img.getAttribute('src')).toMatch(/^blob:card-/)
    expect(document.querySelector('a[download]')).toBeNull() // le lien temporaire est retiré
  })

  it('sans canevas, le texte reste partageable et l’image n’est pas promise ; chaque changement de sélection remplace l’image et libère l’ancienne', async () => {
    canvasOff(); const share = stubShare()
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); tickBox(ITEM.habits)
    await waitFor(() => expect(screen.getByText('Ce navigateur ne sait pas dessiner l’image : le partage du texte reste possible.')).toBeTruthy())
    expect((btn('Télécharger l’image') as HTMLButtonElement).disabled).toBe(true); expect((btn('Partager la carte') as HTMLButtonElement).disabled).toBe(false); expect(screen.queryByAltText(/Image de la carte/)).toBeNull()
    fireEvent.click(btn('Partager la carte')); await tick(10)
    const arg = share.mock.calls[0][0] as ShareData; expect(arg.files).toBeUndefined(); expect(arg.text).toContain('Réussite : 16 %')
    cleanup(); canvasOn(); await mount('#/5/partage', seed); tickBox(ITEM.habits)
    const first = (await image()).getAttribute('src'); tickBox(ITEM.steps)
    await waitFor(() => expect(screen.getByAltText(/Image de la carte/).getAttribute('src')).not.toBe(first))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(first))
  })

  it('jamais d’image périmée : dès que la sélection change, l’ancienne image disparaît, « Partager » et « Télécharger » attendent la nouvelle, et c’est elle qui est remise', async () => {
    const share = stubShare(); let seq = 0, hold = false; const waiting: (() => void)[] = []
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { const b = new Blob([new Uint8Array(8 + ++seq)], { type: 'image/png' }); if (hold) waiting.push(() => cb(b)); else cb(b) } as never // chaque image a une taille différente
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); tickBox(ITEM.weight, true); const first = (await image()).getAttribute('src'); expect(region().textContent).toContain('73,3')
    hold = true
    fireEvent.click(box(ITEM.weight)) // le poids est décoché : l’aperçu change aussitôt, la nouvelle image n’est pas encore prête
    expect(region().textContent).not.toContain('73,3')
    await waitFor(() => expect(waiting).toHaveLength(1))
    expect(screen.queryByAltText(/Image de la carte/)).toBeNull(); expect(screen.getByText('Création de l’image…')).toBeTruthy() // l’ancienne image (avec le poids) n’est plus montrée
    expect((btn('Partager la carte') as HTMLButtonElement).disabled).toBe(true); expect((btn('Télécharger l’image') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(btn('Partager la carte')); await tick(5); expect(share).not.toHaveBeenCalled() // rien ne peut partir avec l’ancienne image
    waiting.shift()!(); const next = await image(); expect(next.getAttribute('src')).not.toBe(first)
    expect((btn('Partager la carte') as HTMLButtonElement).disabled).toBe(false); expect((btn('Télécharger l’image') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(btn('Partager la carte')); await tick(10)
    const f = (share.mock.calls[0][0] as ShareData).files![0]; expect(f.size).toBe(8 + 3) // la troisième image dessinée (nom seul), pas la deuxième (nom et poids)
    expect(waiting).toHaveLength(0)
  })

  it('« Tout masquer » remet tout en masqué en une action ; elle est inactive quand rien n’est visible', async () => {
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); tickBox(ITEM.habits); tickBox(ITEM.weight, true); expect(Object.keys(stored().share.vis)).toHaveLength(3)
    fireEvent.click(btn('Tout masquer')); expect(stored().share.vis).toEqual({}); expect(screen.getByText('Tout est masqué pour vos amis.')).toBeTruthy()
    expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(b => !b.checked)).toBe(true); expect((btn('Tout masquer') as HTMLButtonElement).disabled).toBe(true)
    expect(view().getByText(/Aucun élément visible/)).toBeTruthy()
  })

  it('un élément coché sans donnée est signalé, sans carte ni bouton actif (rien de faux n’est promis)', async () => {
    await mount('#/5/partage', s => { seed(s); s.books = [book('b2', 'Titre déjà terminé', 'fini')]; s.prayers = []; s.cycle = { mode: 'off', starts: [], rec: {}, en: {} } })
    tickBox(ITEM.books); tickBox(ITEM.prayers, true); tickBox(ITEM.cycle, true)
    expect(screen.getByText(/Coché, mais rien à montrer pour le moment : Mes lectures en cours ; Mon suivi cycle ou récupération ; Mes sujets de prière\./)).toBeTruthy()
    expect(view().getByText(/Aucun élément visible/)).toBeTruthy(); expect((btn('Partager la carte') as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByAltText(/Image de la carte/)).toBeNull()
    expect(stored().share.vis).toEqual({ books: true, prayers: true, cycle: true }) // les cases restent cochées : elles s’appliqueront dès qu’il y aura quelque chose
  })

  it('suivi cycle : jour du cycle et énergie du jour (mode cycle), récupération, force et vitalité (mode récupération), rien si le suivi est désactivé', async () => {
    await mount('#/5/partage', s => { seed(s); s.cycle = { mode: 'cycle', starts: ['2026-10-10'], rec: { [DAY]: [1, 1, 1] }, en: { [DAY]: 4 } } })
    tickBox(ITEM.cycle, true); expect(lines()).toEqual(['Jour 13 du cycle · énergie 4 sur 5']); expect(view().getByRole('region', { name: 'Cycle' })).toBeTruthy()
    cleanup(); await mount('#/5/partage', seed); tickBox(ITEM.cycle, true)
    expect(lines()).toEqual(['Récupération 4 sur 5 · force 3 sur 5 · vitalité 5 sur 5']); expect(view().getByRole('region', { name: 'Récupération' })).toBeTruthy()
  })

  it('les choix persistent à la réouverture, et l’accord retiré dans « Confidentialité » remet tout en masqué sans le ressusciter', async () => {
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); tickBox(ITEM.food, true); expect(stored().share.vis).toEqual({ name: true, food: true })
    cleanup(); await reopen('#/5/partage')
    expect(box(ITEM.name).checked).toBe(true); expect(box(ITEM.food).checked).toBe(true); expect(box(ITEM.weight).checked).toBe(false); expect(view().getByText('Suivi de Ada')).toBeTruthy(); expect(lines()).toEqual(['321 kcal', 'Soupe du soir'])
    cleanup(); await reopen('#/5/confidentialite')
    fireEvent.click(btn('Retirer Partage avec des amis')); expect(stored().consents.share).toBe(false); expect(stored().share.vis).toEqual({})
    fireEvent.click(btn('Donner Partage avec des amis')); expect(stored().consents.share).toBe(true); expect(stored().share.vis).toEqual({})
    cleanup(); await reopen('#/5/partage'); expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(b => !b.checked)).toBe(true); expect(view().getByText(/Aucun élément visible/)).toBeTruthy()
  })

  it('révocation : l’annulation ne change rien ; la confirmation masque tout, retire l’accord et supprime les boutons de partage', async () => {
    stubShare()
    await mount('#/5/partage', seed)
    tickBox(ITEM.name); tickBox(ITEM.habits); await image()
    fireEvent.click(btn('Révoquer le partage')); expect(stored().consents.share).toBe(true); fireEvent.click(btn('Annuler')); expect(stored().consents.share).toBe(true); expect(Object.keys(stored().share.vis)).toHaveLength(2)
    fireEvent.click(btn('Révoquer le partage')); fireEvent.click(btn('Confirmer la révocation'))
    expect(stored().consents.share).toBe(false); expect(stored().share.vis).toEqual({}); expect(screen.getByText('Partage révoqué : tout est masqué et l’accord est retiré.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Partager la carte' })).toBeNull(); expect(screen.queryAllByRole('checkbox')).toHaveLength(0); expect(screen.getByRole('button', { name: 'J’accepte' })).toBeTruthy()
    fireEvent.click(btn('J’accepte')); expect((screen.getAllByRole('checkbox') as HTMLInputElement[]).every(b => !b.checked)).toBe(true) // un nouvel accord ne rend rien visible
  })

  it('toutes les cases cochées : douze rubriques au plus, jamais les données interdites, et les sensibles sont signalées pour le mode discret', async () => {
    await mount('#/5/partage', seed)
    for (const k of Object.keys(ITEM) as (keyof typeof ITEM)[]) tickBox(ITEM[k], SENSITIVE.has(k))
    expect(Object.keys(stored().share.vis).sort()).toEqual(Object.keys(ITEM).sort())
    const txt = region().textContent!; for (const x of NEVER) expect(txt).not.toContain(x)
    for (const x of Object.values(ONLY).flat()) expect(txt).toContain(x)
    expect(region().querySelectorAll('li.sens').length).toBeGreaterThanOrEqual(6); expect(view().getByRole('region', { name: 'Habitudes de la semaine' }).querySelector('.sens')).toBeNull()
    await image(); expect(painted.join('\n')).not.toContain('Prière du matin')
  })
})

describe('Rubrique 5 : bilan hebdomadaire et badges', () => {
  it('le bilan est l’onglet par défaut : taux de la semaine, jours à venir, habitude la plus régulière, autres chiffres, poids flouté en mode discret', async () => {
    await mount('#/5', seed)
    expect(btn('Bilan').getAttribute('aria-pressed')).toBe('true'); expect(screen.getByRole('heading', { name: 'Bilan de la semaine' })).toBeTruthy()
    expect(screen.getByText(/Du 19 oct\.? au 25 oct\.? : 4 jours écoulés sur 7, aujourd’hui compris\./)).toBeTruthy()
    expect(screen.getByText('16 %').closest('p')!.textContent).toContain('pas encore de semaine archivée à comparer')
    expect(screen.getByRole('img', { name: 'Part d’habitudes validées par jour : Lun 25 %, Mar 13 %, Mer 13 %, Jeu 13 %, Ven à venir, Sam à venir, Dim à venir' })).toBeTruthy()
    expect(screen.getByText(/Habitude la plus régulière cette semaine : « Prière du matin » \(4 jours sur 4\)/)).toBeTruthy()
    const l = screen.getByRole('list', { name: 'Autres chiffres de la semaine' }); expect(l.textContent).toContain('10 000 pas atteints : 1 jour ; séances : 1 séance, 7,5 km')
    const w = within(l).getByText(/Poids : −1,4 kg depuis la dernière pesée d’avant la semaine/); expect(w.className).toBe('sens')
    expect(screen.getByRole('link', { name: 'Choisir ce que mes amis voient' }).getAttribute('href')).toBe('#/5/partage')
    expect(screen.getByText(/Une semaine est archivée automatiquement le lundi suivant/)).toBeTruthy()
  })

  it('comparaison à la dernière semaine archivée et liste des semaines archivées ; sans habitude, le bilan renvoie vers la rubrique 6', async () => {
    await mount('#/5', s => { seed(s); s.archives = [{ week: '2026-S42', start: '2026-10-12', rate: 40, n: 8, per: {} }, { week: '2026-S41', start: '2026-10-05', rate: 70, n: 8, per: {} }] })
    expect(screen.getByText(/semaine archivée précédente \(2026-S42\) : 40 %, soit −24 points/)).toBeTruthy()
    const l = screen.getByRole('list', { name: 'Semaines archivées' }); expect(within(l).getAllByRole('listitem')).toHaveLength(2); expect(within(l).getByRole('progressbar', { name: 'Réussite de la semaine 2026-S42' })).toBeTruthy()
    cleanup(); await mount('#/5', s => { s.habits = [] })
    expect(screen.getByText(/Aucune habitude pour le moment : ajoutez-en dans la rubrique 6/)).toBeTruthy()
  })

  it('les badges se calculent sur les données réelles, avec leur critère écrit ; aucun ne dépend du poids, du cycle, des repas, des prières ni des notes', async () => {
    await mount('#/5', seed)
    const l = screen.getByRole('list', { name: 'Badges' }), it = (t: string) => within(l).getByText(t).closest('li')!
    expect(within(l).getAllByRole('listitem')).toHaveLength(12)
    for (const t of ['Premier pas', 'Dix mille pas', 'Cinq kilomètres', 'Livre terminé']) { expect(it(t).className).toBe('got'); expect(it(t).textContent).toContain('✓ Obtenu') }
    for (const t of ['Sept jours de suite', 'Dix kilomètres', 'Sans faute', 'Voix posée']) { expect(it(t).className).toBe('todo'); expect(it(t).textContent).toContain('À obtenir') }
    expect(it('Dix kilomètres').textContent).toContain('Enregistrer une séance d’au moins 10 km.')
    expect(screen.getByText(/4 badges sur 12/)).toBeTruthy()
    cleanup(); await mount('#/5', s => { seed(s); s.habits = []; s.checks = {}; s.steps = {}; s.workouts = []; s.books = []; s.quiz.hist = [] }) // objectif de poids atteint, prière exaucée, notes… : aucun badge
    expect(screen.getByText(/0 badge sur 12/)).toBeTruthy()
  })

  it('les badges du profil (rubrique 1) sont les mêmes que ceux du bilan', async () => {
    await mount('#/1', seed)
    const l = screen.getByRole('list', { name: 'Badges' }); expect(within(l).getAllByRole('listitem')).toHaveLength(12); expect(within(l).getByText('Premier pas').closest('li')!.className).toBe('got')
  })
})
