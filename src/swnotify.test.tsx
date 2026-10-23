import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * Le clic sur une notification est traité par `public/sw-notify.js`, chargé dans le service worker. Un vrai clic sur une notification du système ne peut pas être produit par un navigateur
 * sans écran : le script est donc exécuté tel quel dans un environnement de service worker simulé (écouteurs, fenêtres ouvertes, ouverture d'une fenêtre), avec l'événement que le navigateur fournit.
 */
const CODE = readFileSync('public/sw-notify.js', 'utf8')
const ORIGIN = 'https://believe.test'
const HOME = ORIGIN + '/#/9'

interface Win { url: string; navigate?: (u: string) => Promise<unknown>; focus: () => Promise<unknown> }
function worker(open: Win[] = []) {
  const log: string[] = [], handlers: Record<string, (e: unknown) => void> = {}
  const matchAll = vi.fn(async (_o: unknown) => open)
  const openWindow = vi.fn(async (u: string) => { log.push('open ' + u); return {} })
  const scope = { location: { origin: ORIGIN }, addEventListener: (t: string, f: (e: unknown) => void) => { handlers[t] = f }, clients: { matchAll, openWindow } }
  new Function('self', CODE)(scope)
  const click = async (data: unknown) => {
    let wait: Promise<unknown> | undefined; const close = vi.fn(() => { log.push('close') })
    handlers.notificationclick({ notification: { close, data }, waitUntil: (p: Promise<unknown>) => { wait = p } })
    expect(wait, 'l’événement doit prolonger la vie du service worker (waitUntil)').toBeTruthy(); await wait
    return close
  }
  return { log, handlers, matchAll, openWindow, click }
}
/** Fenêtre ouverte de l'application : journalise ses actions. */
const win = (log: string[], url = ORIGIN + '/#/4', nav: 'ok' | 'refuse' | 'absent' = 'ok'): Win => ({
  url, focus: async () => { log.push('focus') },
  ...(nav === 'absent' ? {} : { navigate: async (u: string) => { log.push('navigate ' + u); await new Promise(r => setTimeout(r, 5)); if (nav === 'refuse') throw new Error('client non contrôlé'); log.push('navigated') } })
})

describe('Notification de rappel : clic traité par le service worker (public/sw-notify.js)', () => {
  it('n’installe qu’un seul écouteur : « notificationclick »', () => {
    const w = worker(); expect(Object.keys(w.handlers)).toEqual(['notificationclick'])
  })

  it('ferme la notification, cherche les fenêtres (y compris celles pas encore contrôlées), puis met au premier plan la fenêtre de l’application sur la rubrique 9, dans cet ordre', async () => {
    const l: string[] = []; const w = worker([win(l)])
    const close = await w.click({ url: '/#/9' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(w.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true })
    expect(l).toEqual(['navigate ' + HOME, 'navigated', 'focus'])
    expect(w.openWindow).not.toHaveBeenCalled()
  })

  it('la notification est fermée avant tout le reste, même quand aucune fenêtre n’est ouverte', async () => {
    const w = worker([]); await w.click({ url: '/#/9' }); expect(w.log[0]).toBe('close')
  })

  it('navigation refusée (fenêtre pas contrôlée) : la fenêtre est quand même mise au premier plan, rien n’est ouvert', async () => {
    const l: string[] = []; const w = worker([win(l, ORIGIN + '/#/2', 'refuse')])
    await w.click({ url: '/#/9' }); expect(l).toEqual(['navigate ' + HOME, 'focus']); expect(w.openWindow).not.toHaveBeenCalled()
  })

  it('navigateur sans navigation de fenêtre : mise au premier plan seulement', async () => {
    const l: string[] = []; const w = worker([win(l, ORIGIN + '/', 'absent')])
    await w.click({ url: '/#/9' }); expect(l).toEqual(['focus']); expect(w.openWindow).not.toHaveBeenCalled()
  })

  it('aucune fenêtre de l’application ouverte : une fenêtre est ouverte sur la rubrique 9', async () => {
    const w = worker([]); await w.click({ url: '/#/9' }); expect(w.openWindow).toHaveBeenCalledTimes(1); expect(w.log).toEqual(['close', 'open ' + HOME])
  })

  it('les fenêtres d’un autre site sont ignorées : on ouvre l’application au lieu de les piloter', async () => {
    const l: string[] = []; const w = worker([win(l, 'https://autre.example/#/9')])
    await w.click({ url: '/#/9' }); expect(l).toEqual([]); expect(w.openWindow).toHaveBeenCalledWith(HOME)
  })

  it('parmi plusieurs fenêtres, seule celle de l’application est utilisée', async () => {
    const l: string[] = []; const w = worker([win(l, 'https://autre.example/'), win(l, ORIGIN + '/#/5')])
    await w.click({ url: '/#/9' }); expect(l).toEqual(['navigate ' + HOME, 'navigated', 'focus'])
  })

  it('une adresse du même site portée par la notification est respectée', async () => {
    const w = worker([]); await w.click({ url: '/#/9' }); await w.click({ url: '/#/5/partage' })
    expect(w.openWindow.mock.calls.map(c => c[0])).toEqual([HOME, ORIGIN + '/#/5/partage'])
  })

  it.each([
    ['site extérieur', { url: 'https://evil.example/#/9' }],
    ['adresse relative au protocole', { url: '//evil.example/#/9' }],
    ['adresse relative au protocole (barres obliques inverses)', { url: '/\\evil.example/' }],
    ['schéma javascript', { url: 'javascript:alert(1)' }],
    ['schéma data', { url: 'data:text/html,<p>x</p>' }],
    ['adresse qui n’est pas du texte', { url: 42 }],
    ['adresse absente', {}],
    ['données absentes', undefined],
    ['données nulles', null],
    ['données qui ne sont pas un objet', 'x']
  ])('adresse inattendue (%s) : retour à la rubrique 9 de l’application, jamais ailleurs', async (_n, data) => {
    const w = worker([]); await w.click(data); expect(w.openWindow).toHaveBeenCalledTimes(1); expect(w.openWindow).toHaveBeenCalledWith(HOME)
  })

  it('adresse inattendue avec une fenêtre ouverte : la fenêtre est ramenée à la rubrique 9, pas ailleurs', async () => {
    const l: string[] = []; const w = worker([win(l)]); await w.click({ url: 'https://evil.example/' }); expect(l).toEqual(['navigate ' + HOME, 'navigated', 'focus'])
  })
})
