import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { btn, mount, stored, tick, type } from './testkit'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

const R = (titre: string, ing: string[]) => ({ titre, minutes: 15, kcal: 320, proteines: 20, glucides: 8, lipides: 22, ingredients: ing, etapes: ['Préparer les ingrédients.', 'Cuire doucement.'] })
const RECIPES = [R('Omelette aux courgettes', ['œufs', 'courgettes', 'feta']), R('Salade de pois chiches', ['pois chiches', 'concombre']), R('Soupe de potimarron', ['potimarron', 'oignon', 'bouillon'])]
const resp = (status: number, body: unknown, type = 'application/json') => ({ status, ok: status < 400, headers: { get: () => type }, json: async () => body })
interface Pending { body: { title: string; ingredients: string[] }; init: RequestInit; ok: (b: unknown, status?: number) => void; fail: (e: Error) => void }

/** Serveur simulé : /api/ai renvoie les trois recettes tout de suite ; chaque appel à /api/img attend la réponse que le test lui donne (ou son annulation). Avec `deaf`, le serveur ignore l'annulation et répond quand même, tard : l'application ne doit alors rien afficher. */
function server() {
  const imgs: Pending[] = [], calls: string[] = [], ctl = { deaf: false }
  const f = vi.fn((url: string, init: RequestInit) => {
    calls.push(url)
    if (url === '/api/ai') return Promise.resolve(resp(200, { data: RECIPES, model: 'test' }))
    if (url === '/api/img') {
      return new Promise((resolve, reject) => {
        const p: Pending = { body: JSON.parse(String(init.body)), init, ok: (b, s = 200) => resolve(resp(s, b)), fail: reject }
        if (!ctl.deaf) init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('annulé'), { name: 'AbortError' })))
        imgs.push(p)
      })
    }
    return Promise.reject(new Error('adresse inattendue ' + url))
  })
  vi.stubGlobal('fetch', f)
  return { imgs, calls, f, ctl }
}
const open = async () => {
  await mount('#/8/recettes', s => { s.consents.health = true; s.consents.ai = true })
  type('Ingrédients', 'courgettes, œufs, feta'); fireEvent.click(btn('Proposer 3 recettes')); await screen.findByRole('heading', { name: 'Omelette aux courgettes' })
}
const card = (titre: string) => screen.getByRole('heading', { name: titre }).closest('.card') as HTMLElement
const PNG = { image: 'QUJD', mime: 'image/png' }

describe('Rubrique 8 : image du plat des recettes (facultative, à la demande)', () => {
  it('rien n’est envoyé pour une image tant qu’on ne la demande pas ; le bouton est proposé sur chaque recette avec sa note (service payant, limité)', async () => {
    const sv = server(); await open()
    expect(screen.getAllByRole('button', { name: 'Générer l’image du plat' })).toHaveLength(3); expect(sv.calls).toEqual(['/api/ai']); expect(document.querySelector('.dish')).toBeNull()
    const note = document.getElementById('dish-note')!; expect(note.textContent).toBe('Image du plat, facultative : créée par l’IA à partir du titre et des ingrédients de la recette (service payant, limité chaque jour). Une recette à la fois.')
    for (const b of screen.getAllByRole('button', { name: 'Générer l’image du plat' })) expect(b.getAttribute('aria-describedby')).toBe('dish-note')
    expect(screen.queryByText(/Pas d’image de plat générée dans cette version/)).toBeNull(); expect(screen.getByText(/Chaque recette peut recevoir, sur demande, une image du plat créée par l’IA/)).toBeTruthy()
  })

  it('une image à la demande : seuls le titre et les ingrédients partent, elle s’affiche avec sa mention « Généré par IA » et son texte alternatif, puis « Retirer l’image » l’enlève', async () => {
    const sv = server(); await open()
    const c = card('Salade de pois chiches'); fireEvent.click(within(c).getByRole('button', { name: 'Générer l’image du plat' }))
    expect(sv.calls).toEqual(['/api/ai', '/api/img']); expect(sv.imgs[0].body).toEqual({ title: 'Salade de pois chiches', ingredients: ['pois chiches', 'concombre'] }); expect(sv.imgs[0].init.method).toBe('POST')
    expect(within(c).getByRole('button', { name: 'Annuler l’image' })).toBeTruthy(); expect(within(c).getByText(/Création de l’image en cours \(jusqu’à une minute\)/)).toBeTruthy(); expect(c.querySelector('[role="status"]')!.textContent).toBe('Création de l’image en cours.')
    expect(within(card('Omelette aux courgettes')).getByRole('button', { name: 'Générer l’image du plat' })).toBeTruthy() // les autres recettes ne sont pas touchées
    await act(async () => { sv.imgs[0].ok(PNG) })
    const img = within(c).getByRole('img', { name: 'Illustration du plat générée par IA : Salade de pois chiches' }) as HTMLImageElement; expect(img.getAttribute('src')).toBe('data:image/png;base64,QUJD')
    expect(within(c).getByText(/Généré par IA : illustration \(Google Gemini, filigrane invisible SynthID\)\. La recette réelle peut différer\./)).toBeTruthy(); expect(c.querySelector('[role="status"]')!.textContent).toBe('Image du plat créée.')
    expect(c.querySelector('figure')!.nextElementSibling!.tagName).toBe('H2'); expect(document.querySelectorAll('.dish')).toHaveLength(1)
    expect(stored().meals).toEqual([]); expect(JSON.stringify(stored())).not.toContain('QUJD') // l’image n’est jamais enregistrée
    fireEvent.click(within(c).getByRole('button', { name: 'Retirer l’image' })); expect(c.querySelector('.dish')).toBeNull(); expect(within(c).getByRole('button', { name: 'Générer l’image du plat' })).toBeTruthy(); expect(c.querySelector('[role="status"]')!.textContent).toBe('')
  })

  it('« Annuler l’image » interrompt la demande sans message d’erreur ; une réponse tardive ne fait rien apparaître', async () => {
    const sv = server(); await open()
    const c = card('Omelette aux courgettes'); fireEvent.click(within(c).getByRole('button', { name: 'Générer l’image du plat' }))
    fireEvent.click(within(c).getByRole('button', { name: 'Annuler l’image' })); await tick(5)
    expect((sv.imgs[0].init.signal as AbortSignal).aborted).toBe(true); expect(within(c).getByRole('button', { name: 'Générer l’image du plat' })).toBeTruthy(); expect(within(c).queryByRole('alert')).toBeNull(); expect(c.querySelector('[role="status"]')!.textContent).toBe('')
    await act(async () => { sv.imgs[0].ok(PNG) }); expect(c.querySelector('.dish')).toBeNull()
    fireEvent.click(within(c).getByRole('button', { name: 'Générer l’image du plat' })); expect(sv.imgs).toHaveLength(2) // on peut redemander
    fireEvent.click(within(c).getByRole('button', { name: 'Annuler l’image' })); await tick(5)
    sv.ctl.deaf = true; fireEvent.click(within(c).getByRole('button', { name: 'Générer l’image du plat' })); fireEvent.click(within(c).getByRole('button', { name: 'Annuler l’image' })) // 3e demande, à un serveur qui ignore l'annulation et répond quand même : rien ne s'affiche
    await act(async () => { sv.imgs[2].ok(PNG) }); expect(c.querySelector('.dish')).toBeNull(); expect(within(c).getByRole('button', { name: 'Générer l’image du plat' })).toBeTruthy(); expect(within(c).queryByRole('alert')).toBeNull()
  })

  it('erreurs : quota quotidien, filtres de sécurité, serveur non configuré, réseau coupé ; « Réessayer l’image » refait une demande qui peut réussir', async () => {
    const sv = server(); await open()
    const c = card('Soupe de potimarron'), go = () => fireEvent.click(within(c).getByRole('button', { name: /Générer l’image du plat|Réessayer l’image/ }))
    const fails = async (status: number, error: string, text: string) => { go(); await act(async () => { sv.imgs[sv.imgs.length - 1].ok({ error }, status) }); expect(within(c).getByRole('alert').textContent).toBe(text); expect(within(c).getByRole('button', { name: 'Réessayer l’image' })).toBeTruthy(); expect(c.querySelector('.dish')).toBeNull() }
    await fails(429, 'daily', 'Limite quotidienne atteinte pour votre accès. Réessayez demain.')
    await fails(422, 'blocked', 'Le service IA n’a pas pu créer cette image (filtres de sécurité). Essayez avec une autre recette.')
    await fails(502, 'rejected', 'Requête refusée par le service IA : vérifiez GEMINI_API_KEY et AI_MODEL.')
    await fails(502, 'timeout', 'Le serveur a mis trop de temps à répondre.')
    go(); await act(async () => { sv.imgs[sv.imgs.length - 1].fail(new Error('réseau')) }); expect(within(c).getByRole('alert').textContent).toBe('Serveur injoignable ou hors ligne. Réessayez une fois connecté.')
    go(); await act(async () => { sv.imgs[sv.imgs.length - 1].ok({ image: 'pas base64 !', mime: 'image/png' }) }); expect(within(c).getByRole('alert').textContent).toBe('Service indisponible ou réponse invalide : réessayez.') // réponse non conforme refusée
    go(); await act(async () => { sv.imgs[sv.imgs.length - 1].ok({ image: 'QUJE', mime: 'image/webp' }) }); expect(within(c).queryByRole('alert')).toBeNull(); expect(within(c).getByRole('img', { name: /Soupe de potimarron/ }).getAttribute('src')).toBe('data:image/webp;base64,QUJE') // le type renvoyé par le serveur est conservé
  })

  it('trois images possibles en même temps ; une nouvelle recherche de recettes annule les demandes en cours et efface les images', async () => {
    const sv = server(); sv.ctl.deaf = true; await open() // serveur sourd à l'annulation : seules les protections de l'application empêchent d'afficher une réponse de l'ancienne liste
    for (const t of ['Omelette aux courgettes', 'Salade de pois chiches', 'Soupe de potimarron']) fireEvent.click(within(card(t)).getByRole('button', { name: 'Générer l’image du plat' }))
    expect(sv.imgs.map(p => p.body.title)).toEqual(['Omelette aux courgettes', 'Salade de pois chiches', 'Soupe de potimarron'])
    await act(async () => { sv.imgs[0].ok(PNG) }); expect(document.querySelectorAll('.dish')).toHaveLength(1)
    fireEvent.click(btn('Proposer 3 recettes')); await screen.findByRole('heading', { name: 'Omelette aux courgettes' }); await tick(5)
    expect(sv.imgs[1].init.signal!.aborted && sv.imgs[2].init.signal!.aborted).toBe(true); expect(document.querySelectorAll('.dish')).toHaveLength(0); expect(screen.getAllByRole('button', { name: 'Générer l’image du plat' })).toHaveLength(3)
    await act(async () => { sv.imgs[1].ok(PNG); sv.imgs[2].ok(PNG) }); expect(document.querySelectorAll('.dish')).toHaveLength(0) // réponses tardives de l’ancienne liste : sans effet
  })

  it('« Ajouter à l’alimentation » fonctionne comme avant, avec ou sans image', async () => {
    const sv = server(); await open()
    fireEvent.click(within(card('Omelette aux courgettes')).getByRole('button', { name: 'Générer l’image du plat' })); await act(async () => { sv.imgs[0].ok(PNG) })
    fireEvent.click(within(card('Omelette aux courgettes')).getByRole('button', { name: 'Ajouter à l’alimentation' })); expect(stored().meals).toHaveLength(1); expect(stored().meals[0]).toMatchObject({ n: 'Omelette aux courgettes', kcal: 320, src: 'IA' })
    expect(JSON.stringify(stored().meals)).not.toContain('data:image')
  })

  it('sans accord à l’IA, aucune recette ni image n’est proposée ; l’accord précise que le titre et les ingrédients sont envoyés pour une image', async () => {
    const sv = server(); await mount('#/8/recettes', s => { s.consents.health = true })
    expect(screen.queryByRole('button', { name: 'Proposer 3 recettes' })).toBeNull(); expect(screen.getByText(/Si vous demandez l’image d’une recette, son titre et ses ingrédients sont envoyés de la même façon\./)).toBeTruthy(); expect(sv.calls).toEqual([])
  })
})
