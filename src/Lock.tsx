import { useEffect, useRef, useState } from 'react'
import { verifyPin, waitMs } from './pin'

const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }

/** Écran de verrouillage : remplace toute l'application tant que le PIN n'est pas saisi (aucune donnée personnelle affichée). */
export default function Lock({ onUnlock, onForgot }: { onUnlock: () => void; onForgot: () => Promise<boolean> }) {
  const [d, setD] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [wait, setWait] = useState(() => waitMs()), [forgot, setForgot] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (wait <= 0) return
    const i = setInterval(() => { const w = waitMs(); setWait(w); if (w <= 0) setMsg('') }, 500)
    return () => clearInterval(i)
  }, [wait > 0])
  const submit = async (pin: string) => {
    setBusy(true)
    const r = await verifyPin(pin)
    if (!alive.current) return
    setBusy(false); setD('')
    if (r.ok) return onUnlock()
    setWait(r.wait)
    setMsg(r.wait > 0 ? '' : 'PIN incorrect. Il reste ' + r.left + ' essai' + (r.left > 1 ? 's' : '') + ' avant un blocage temporaire.')
  }
  const push = (c: string) => {
    if (busy || wait > 0) return
    const n = (d + c).slice(0, 4); setD(n); setMsg('')
    if (n.length === 4) void submit(n)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) push(e.key)
      else if (e.key === 'Backspace') setD(x => x.slice(0, -1))
    }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  })
  const wipe = async () => { const ok = await onForgot(); if (!ok && alive.current) setMsg('Suppression non confirmée : le stockage n’a pas pu être vérifié.') }
  return (
    <div className="lock" role="dialog" aria-modal="true" aria-labelledby="lk-t">
      <span className="wm">BELIEVE</span>
      <h1 id="lk-t" style={{ fontSize: '1.5rem' }}>Saisissez votre PIN</h1>
      <div className="dots" role="img" aria-label={d.length + ' chiffre' + (d.length > 1 ? 's' : '') + ' saisi' + (d.length > 1 ? 's' : '') + ' sur 4'}>{[0, 1, 2, 3].map(i => <i key={i} className={i < d.length ? 'on' : ''} />)}</div>
      <p role="status" className={msg || wait > 0 ? 'ko' : 'mut'} style={{ minHeight: '1.6em', margin: '4px 0 10px' }}>{wait > 0 ? 'Verrouillé : réessayez dans ' + fmt(wait) + '.' : msg}</p>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(c => <button key={c} disabled={busy || wait > 0} onClick={() => push(c)}>{c}</button>)}
        <span /><button disabled={busy || wait > 0} onClick={() => push('0')}>0</button>
        <button aria-label="Effacer le dernier chiffre" disabled={busy || wait > 0} onClick={() => setD(x => x.slice(0, -1))}>⌫</button>
      </div>
      {!forgot
        ? <p><button className="chip" onClick={() => setForgot(true)}>PIN oublié ?</button></p>
        : <div className="card" style={{ maxWidth: 360 }}><p style={{ marginTop: 0 }}>Sans le PIN, la seule solution est d’effacer toutes les données Believe de cet appareil (profil, habitudes, notes, enregistrements audio). Elles ne pourront pas être récupérées.</p>
          <div className="row"><button className="btn" onClick={wipe}>Effacer et réinitialiser</button><button className="btn alt" onClick={() => setForgot(false)}>Annuler</button></div></div>}
    </div>
  )
}
