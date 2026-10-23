import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { KEY } from './lib'
import type { State } from './lib'

// jsdom n’implémente ni le défilement ni le canevas : on les neutralise pour garder des journaux lisibles
window.scrollTo = (() => {}) as typeof window.scrollTo
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']

// jsdom n'expose pas PointerEvent dans l'environnement de test : sans lui, les gestes (balayage) perdraient leurs coordonnées
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  class PE extends MouseEvent {
    pointerId: number; pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse' }
  }
  ;(globalThis as { PointerEvent?: unknown }).PointerEvent = PE
}

export const DN = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
export const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null')
export const tick = (ms = 0) => act(async () => { await new Promise(r => setTimeout(r, ms)) })
export const ready = () => waitFor(() => expect(screen.queryByTestId('skeleton')).toBeNull(), { timeout: 5000 })
/** Monte l'application sur une adresse, avec un état de départ (accueil guidé et verset du jour déjà passés) que `seed` peut modifier. */
export async function mount(hash = '#/4', seed: (s: State) => void = () => {}, pre: () => Promise<void> = async () => {}) {
  localStorage.clear(); location.hash = hash; vi.resetModules()
  const { DEF, KEY: K } = await import('./lib')
  const s = DEF(); s.ui = { ...s.ui, onboard: true, verseDay: iso(new Date()) }; seed(s); localStorage.setItem(K, JSON.stringify(s)); await pre()
  const { default: App } = await import('./App')
  const r = render(<App />); await tick(); await ready(); return r
}
/** Remonte l'application sans effacer le stockage (comme une réouverture de l'application). */
export async function reopen(hash: string) {
  location.hash = hash; vi.resetModules()
  const { default: App } = await import('./App')
  const r = render(<App />); await tick(); await ready(); return r
}
export const go = async (hash: string) => { location.hash = hash; await tick(10); await ready() }
export const btn = (n: string | RegExp) => screen.getByRole('button', { name: n })
export const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

// jsdom n’a pas WebCrypto (PBKDF2) : on utilise celui de Node
export const withCrypto = () => vi.stubGlobal('crypto', webcrypto)
