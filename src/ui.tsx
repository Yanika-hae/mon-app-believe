import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as RPE, ReactNode } from 'react'
import type { CK, State } from './lib'
import { DN, chunks, norm, num, swipeDir } from './util'

export type Msg = { e?: 1; t: string } | null
/** Met à jour l'état et renvoie true si l'enregistrement local est confirmé. `ok` : message affiché une fois l'enregistrement confirmé. `quiet` : enregistrement silencieux (curseurs, saisie continue), qui ne remplace pas le message affiché. */
export type Upd = (f: (s: State) => void, ok?: string, quiet?: boolean) => boolean
/** Propriétés communes des pages : état, mise à jour, message affiché, sous-section demandée par l'adresse (#/11/audio). */
export interface P { S: State; upd: Upd; m: Msg; setM: (m: Msg) => void; sub: string }

/** Message d'état (succès ou erreur), annoncé aux lecteurs d'écran. */
export const Flash = ({ m }: { m: Msg }) => (m ? <p className={m.e ? 'ko' : 'ok'} role="status">{m.t}</p> : null)

export const canSay = typeof window !== 'undefined' && 'speechSynthesis' in window
export const say = (t: string, lang = 'fr-FR') => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = lang; speechSynthesis.speak(u) } catch { /* lecture indisponible */ } }
/** Lecture d'un long texte : découpé en phrases mises en file d'attente (une seule lecture à la fois). */
export const sayAll = (t: string, lang = 'fr-FR') => { try { speechSynthesis.cancel(); for (const p of chunks(t)) { const u = new SpeechSynthesisUtterance(p); u.lang = lang; speechSynthesis.speak(u) } } catch { /* lecture indisponible */ } }
export const stopSay = () => { try { speechSynthesis.cancel() } catch { /* indisponible */ } }

/** Mouvement réduit : choix explicite de l'utilisateur, sinon préférence du système. */
export const reduced = (S: State) => S.settings.motion === 'reduced' || (S.settings.motion === 'auto' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
/** Retour haptique léger (Android : vibration ; iOS ne la propose pas). Respecte le réglage et le mouvement réduit. */
export const haptic = (S: State, ms: number | number[] = 10) => { if (S.settings.haptics && !reduced(S)) { try { navigator.vibrate?.(ms) } catch { /* indisponible */ } } }

// ---------------------------------------------------------------- balayage
const NOSWIPE = 'input,textarea,select,canvas,iframe,audio,video,.story,.chips,.sc,[data-noswipe]'
/** Gestes tactiles : le geste ne démarre pas sur un champ, un curseur ou une zone qui défile en largeur. `on` renvoie true s'il a utilisé le geste. */
export function useSwipe(on: (d: 1 | -1) => boolean) {
  const st = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onPointerDown: (e: RPE) => { st.current = e.pointerType === 'mouse' || (e.target as HTMLElement).closest?.(NOSWIPE) ? null : { x: e.clientX, y: e.clientY, t: Date.now() } },
    onPointerUp: (e: RPE) => {
      const s = st.current; st.current = null
      if (!s) return
      const d = swipeDir(e.clientX - s.x, e.clientY - s.y, Date.now() - s.t)
      if (d && on(d)) e.stopPropagation()
    },
    onPointerCancel: () => { st.current = null }
  }
}

/** Rangée d'onglets (boutons visibles) dont le contenu se change aussi par balayage. `wrap` : les onglets passent à la ligne au lieu de défiler (peu d'onglets, tous visibles). */
export function Tabs({ items, v, set, label, S, wrap, children }: { items: string[]; v: number; set: (i: number) => void; label: string; S?: State; wrap?: boolean; children: ReactNode }) {
  const sw = useSwipe(d => { const n = v + d; if (n < 0 || n >= items.length) return false; set(n); if (S) haptic(S); return true })
  return (
    <>
      <div className={wrap ? 'chips wrap' : 'chips'} role="group" aria-label={label}>{items.map((x, i) => <button key={x} className="chip" aria-pressed={v === i} onClick={() => set(i)}>{x}</button>)}</div>
      <div className="swipe" {...sw}>{children}</div>
    </>
  )
}
/** Onglet initial tiré de l'adresse (#/rubrique/sous-section) ; suit les changements d'adresse. */
export function useTab(sub: string, keys: string[]): [number, (i: number) => void] {
  const [v, set] = useState(() => Math.max(0, keys.indexOf(sub)))
  useEffect(() => { const i = keys.indexOf(sub); if (i >= 0) set(i) }, [sub])
  return [v, set]
}

// ---------------------------------------------------------------- fenêtres
/** Fenêtre modale ou feuille du bas : focus piégé, Échap pour fermer, focus rendu à la fermeture. */
export function Dialog({ open, onClose, label, sheet, children }: { open: boolean; onClose: () => void; label: string; sheet?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null, el = ref.current!
    const items = () => Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])'))
    ;(items()[0] ?? el).focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      else if (e.key === 'Tab') {
        const l = items(); if (!l.length) return
        const a = l[0], z = l[l.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); prev?.focus?.() }
  }, [open])
  if (!open) return null
  return (
    <div className={'scrim' + (sheet ? '' : ' mid')} onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={sheet ? 'sheet' : 'modal'} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

/** Squelette affiché pendant le chargement d'une page. */
export const Skeleton = () => (
  <div className="sk" role="status" aria-label="Chargement" data-testid="skeleton"><i style={{ width: '55%', height: 28 }} /><i style={{ width: '90%' }} /><i style={{ width: '75%' }} /><i style={{ width: '100%', height: 90 }} /></div>
)

/** Demande un accord précis avant d'afficher une fonction ; l'accord se retire dans la rubrique 5. */
export function Gate({ k, S, upd, title, why, children, label = 'J’accepte' }: { k: CK; S: State; upd: Upd; title: string; why: ReactNode; children: ReactNode; label?: string }) {
  if (S.consents[k]) return <>{children}</>
  return (
    <div className="card"><h2>{title}</h2>{why}
      <p className="mut">Accord retirable à tout moment (rubrique 5). Le refus ne bloque pas le reste de l’application.</p>
      <div className="row"><button className="btn" onClick={() => upd(s => { s.consents[k] = true }, 'Accord enregistré : ' + title + '.')}>{label}</button><a className="btn alt" href="#/4">Plus tard</a></div></div>
  )
}

export const LBL: Record<string, string> = { O: 'Opérationnelle', P: 'Partielle', C: 'Non configurée', N: 'Non implémentée' }
export const Badge = ({ s }: { s: string }) => <span className={'badge ' + s}>{LBL[s]}</span>

export { DN, norm, num, swipeDir }

/** Enregistre une valeur modifiée en continu (curseur, texte) une fois la saisie calme, et à la fermeture de la page : évite une écriture complète de l'état à chaque touche. */
export function useCommit<T>(v: T, saved: T, commit: (v: T) => void, ms = 500) {
  const last = useRef(v), sv = useRef(saved), cm = useRef(commit)
  last.current = v; sv.current = saved; cm.current = commit
  useEffect(() => {
    if (Object.is(v, saved)) return
    const t = setTimeout(() => cm.current(v), ms)
    return () => clearTimeout(t)
  }, [v])
  useEffect(() => () => { if (!Object.is(last.current, sv.current)) cm.current(last.current) }, [])
}
