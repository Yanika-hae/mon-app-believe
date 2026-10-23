import { useEffect, useRef, useState } from 'react'
import type { State } from './lib'
import { haptic } from './ui'
import { mmss } from './util'

let ctx: AudioContext | null = null
const audioCtx = (): AudioContext | null => {
  if (ctx && ctx.state !== 'closed') return ctx
  const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined
  if (!AC) return null
  try { ctx = new AC() } catch { ctx = null }
  return ctx
}
/** À appeler depuis un geste de l'utilisateur (démarrage du chrono) : les navigateurs n'autorisent le son qu'après un geste. */
export const unlockAudio = () => { try { void audioCtx()?.resume?.() } catch { /* son indisponible */ } }
/** Fin de chrono : double note douce si les sons sont activés, vibration si elle est activée (Android). Le message écrit reste la référence, le son et la vibration ne sont qu'un plus. */
export function chime(S: State) {
  haptic(S, [200, 100, 200])
  if (!S.settings.sounds) return
  const c = audioCtx()
  if (!c) return
  try {
    void c.resume?.()
    const t0 = c.currentTime
    ;[[660, 0], [880, 0.24]].forEach(([f, d]) => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.55)
      o.connect(g); g.connect(c.destination); o.start(t0 + d); o.stop(t0 + d + 0.6)
    })
  } catch { /* son indisponible */ }
}

/** Compte à rebours fondé sur l'horloge (et non sur le nombre de ticks) : reste juste même si l'onglet ralentit. `onEnd` est appelé une fois, à la fin. */
export function useCountdown(totalSec: number, onEnd: () => void) {
  const total = Math.max(1, Math.round(totalSec)) * 1000
  const [kept, setLeft] = useState(total), [run, setRun] = useState(false), [used, setUsed] = useState(false)
  const end = useRef(0), rem = useRef(total), cb = useRef(onEnd)
  cb.current = onEnd
  const left = used ? kept : total // tant que le chrono n'a pas servi, la durée choisie s'affiche aussitôt (pas d'image intermédiaire périmée)
  useEffect(() => { if (!run) { rem.current = total; setLeft(total); setUsed(false) } }, [total]) // nouvelle durée : retour à zéro
  useEffect(() => {
    if (!run) return
    end.current = Date.now() + rem.current
    const t = setInterval(() => {
      const l = end.current - Date.now()
      if (l <= 0) { clearInterval(t); rem.current = 0; setLeft(0); setRun(false); cb.current() } else setLeft(l)
    }, 250)
    return () => clearInterval(t)
  }, [run])
  return {
    left, run, total, used, over: used && left === 0,
    /** Secondes écoulées depuis le démarrage (0 si le chrono n'a pas servi). */
    elapsed: used ? Math.round((total - left) / 1000) : 0,
    start: () => { unlockAudio(); const r = used && rem.current > 0 ? rem.current : total; rem.current = r; setLeft(r); setUsed(true); setRun(true) },
    pause: () => { rem.current = Math.max(0, end.current - Date.now()); setLeft(rem.current); setRun(false) },
    reset: () => { rem.current = total; setLeft(total); setRun(false); setUsed(false) }
  }
}

export type Countdown = ReturnType<typeof useCountdown>
interface View { t: Countdown; sec: number; setSec?: (n: number) => void; id: string; label: string; min?: number; max?: number }

/** Affichage d'un chrono (démarrage, pause, remise à zéro, durée réglable par pas de 15 secondes hors lecture) dont le compte à rebours est piloté par le parent. */
export function TimerView({ t, sec, setSec, id, label, min = 15, max = 600 }: View) {
  const ratio = Math.max(0, Math.min(1, 1 - t.left / t.total)), lock = t.run || (t.used && !t.over) // changer la durée en cours de route effacerait le temps écoulé
  return (
    <div className="timer">
      <p className="tm" role="timer" aria-label={label} id={id}>{mmss(t.left)}</p>
      <progress value={Math.round(ratio * 100)} max={100} aria-label={'Avancement du ' + label.toLowerCase()} />
      <div className="row" style={{ marginTop: 8 }}>
        {!t.run
          ? <button className="btn" onClick={t.start}>{t.over ? 'Recommencer' : t.used ? 'Reprendre' : 'Démarrer le chrono'}</button>
          : <button className="btn" onClick={t.pause}>Pause</button>}
        <button className="btn alt" disabled={!t.used && t.left === t.total} onClick={t.reset}>Remettre à zéro</button>
        {setSec && <>
          <button className="chip" disabled={lock || sec <= min} onClick={() => setSec(Math.max(min, sec - 15))}>Retirer 15 secondes</button>
          <button className="chip" disabled={lock || sec >= max} onClick={() => setSec(Math.min(max, sec + 15))}>Ajouter 15 secondes</button>
        </>}
      </div>
      {t.over && <p className="ok" role="status">Temps écoulé : {mmss(t.total)}.</p>}
      <p className="mut" style={{ margin: '6px 0 0' }}><small>Le chrono s’arrête si vous quittez cette page.</small></p>
    </div>
  )
}

/** Chrono d'un exercice : compte à rebours autonome, signal sonore et vibration à la fin si les réglages les autorisent. */
export function TimerBox({ S, ...v }: Omit<View, 't'> & { S: State }) {
  const t = useCountdown(v.sec, () => chime(S))
  return <TimerView t={t} {...v} />
}
