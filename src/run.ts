import { useEffect, useState } from 'react'
import { accept, clock, haversine, pace } from './geo'
import type { Pt } from './geo'
import { say } from './ui'

// ---------------------------------------------------------------- écran maintenu allumé (partagé : séance GPS, podomètre, prompteur)
let wl: any = null, users = 0
const acquire = async () => { try { wl = await (navigator as any).wakeLock?.request('screen') } catch { wl = null } }
/** Demande de garder l'écran allumé ; chaque appel doit être suivi d'un unlockScreen. Le verrou est repris au retour dans l'onglet. */
export const lockScreen = () => { users++; if (users === 1) acquire() }
export const unlockScreen = () => { users = Math.max(0, users - 1); if (users === 0) { try { wl?.release() } catch { /* ignoré */ } wl = null } }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden && users > 0) acquire() })

export interface Run { acc: number; t0: number; run: boolean; dist: number; gain: number; alt: number | null; prev: Pt | null; pts: Pt[]; said: number; fix: number; lapT: number; lapD: number; wid: number; voice: boolean; st: 'idle' | 'run' | 'pause'; act: string; gps: string; laps: string[] }
const run0 = (): Run => ({ acc: 0, t0: 0, run: false, dist: 0, gain: 0, alt: null, prev: null, pts: [], said: 0, fix: 0, lapT: 0, lapD: 0, wid: -1, voice: true, st: 'idle', act: 'Course', gps: '', laps: [] })
/** État de la séance GPS hors de React : elle continue quand on change de rubrique. */
export const run = run0()
const subs = new Set<() => void>()
const bump = () => subs.forEach(f => f())
export function useRun() {
  const [, setN] = useState(0)
  useEffect(() => { const f = () => setN(n => n + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  return run
}
/** Secondes écoulées de la séance (pauses exclues). */
export const elapsed = () => (run.acc + (run.run ? Date.now() - run.t0 : 0)) / 1000

const watch = () => {
  if (!navigator.geolocation) { run.gps = 'none'; bump(); return }
  run.prev = null; run.fix = Date.now()
  run.wid = navigator.geolocation.watchPosition(g => {
    run.fix = Date.now(); run.gps = 'ok'
    const c = g.coords, p: Pt = { lat: c.latitude, lng: c.longitude, alt: c.altitude, t: g.timestamp, acc: c.accuracy }
    if (!accept(run.prev, p)) return
    if (run.prev) run.dist += haversine(run.prev, p)
    if (p.alt !== null) { if (run.alt === null) run.alt = p.alt; else if (Math.abs(p.alt - run.alt) >= 3) { if (p.alt > run.alt) run.gain += p.alt - run.alt; run.alt = p.alt } }
    run.prev = p; run.pts.push(p)
    const km = Math.floor(run.dist / 1000)
    if (km > run.said) { run.said = km; if (run.voice) say(km + (km > 1 ? ' kilomètres' : ' kilomètre') + ', allure ' + pace(elapsed(), run.dist / 1000) + ' par kilomètre') }
    bump()
  }, e => { run.gps = e.code === 1 ? 'denied' : 'error'; bump() }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
}
/** Démarre ou reprend le chronomètre et le suivi de position. */
export const go = () => { run.t0 = Date.now(); run.run = true; run.st = 'run'; lockScreen(); watch(); bump() }
/** Arrête chronomètre et suivi de position (sans changer l'état de la séance). */
export const halt = () => {
  if (!run.run) return
  run.acc += Date.now() - run.t0; run.run = false
  if (run.wid >= 0) { try { navigator.geolocation.clearWatch(run.wid) } catch { /* ignoré */ } }
  run.wid = -1; unlockScreen()
}
export const startRun = () => { const v = run.voice, a = run.act; Object.assign(run, run0(), { voice: v, act: a }); go() }
export const pauseRun = () => { halt(); run.st = 'pause'; bump() }
export const lapRun = () => { const t = elapsed(), km = run.dist / 1000, dt = t - run.lapT, dk = km - run.lapD; run.lapT = t; run.lapD = km; run.laps = [...run.laps, `Tour ${run.laps.length + 1} : ${clock(dt)}, ${dk.toFixed(2)} km`]; bump() }
/** Termine la séance : arrête le suivi et renvoie le résumé (rien n'est enregistré ici). */
export const endRun = () => { halt(); run.st = 'idle'; bump(); return { t: run.acc / 1000, km: run.dist / 1000, act: run.act, alt: run.alt, gain: run.gain } }
/** Interrompt la séance sans l'enregistrer (par exemple quand l'accord « position » est retiré). */
export const abortRun = () => { halt(); const v = run.voice, a = run.act; Object.assign(run, run0(), { voice: v, act: a }); bump() }
export const setAct = (a: string) => { run.act = a; bump() }
export const setVoice = (v: boolean) => { run.voice = v; bump() }
