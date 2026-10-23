import { useState } from 'react'
import { AUTO, hasPin, removePin, setAuto, setPin, readPin, validPin, verifyPin } from './pin'
import type { Msg } from './ui'

const LBL: Record<number, string> = { 0: 'Dès que l’application quitte l’écran', 1: 'Après 1 minute', 5: 'Après 5 minutes', 15: 'Après 15 minutes' }
const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s' }

/** Réglage du PIN : activation, changement, désactivation, délai de verrouillage automatique. Les messages de succès n'apparaissent qu'après écriture vérifiée. */
export default function PinCard({ setM, onChange }: { setM: (m: Msg) => void; onChange: () => void }) {
  const [on, setOn] = useState(hasPin), [cur, setCur] = useState(''), [a, setA] = useState(''), [b, setB] = useState(''), [auto, setAutoV] = useState(() => readPin()?.a ?? 1), [mode, setMode] = useState<'' | 'change' | 'off'>(''), [busy, setBusy] = useState(false)
  const reset = () => { setCur(''); setA(''); setB(''); setMode('') }
  const digits = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value.replace(/\D/g, '').slice(0, 4))
  const field = (id: string, label: string, v: string, set: (v: string) => void) => (
    <div><label htmlFor={id}>{label}</label><input id={id} type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4} value={v} onChange={digits(set)} /></div>
  )
  /** Contrôle l'ancien PIN (compte comme un essai) ; renvoie true s'il est correct. */
  const checkCur = async () => {
    const r = await verifyPin(cur)
    if (r.ok) return true
    setM({ e: 1, t: r.wait > 0 ? 'Trop d’essais : réessayez dans ' + fmt(r.wait) + '.' : 'PIN actuel incorrect. Il reste ' + r.left + ' essai' + (r.left > 1 ? 's' : '') + ' avant un blocage temporaire.' })
    return false
  }
  const activate = async () => {
    if (!validPin(a)) return setM({ e: 1, t: 'Le PIN doit comporter exactement 4 chiffres.' })
    if (a !== b) return setM({ e: 1, t: 'Les deux saisies ne sont pas identiques.' })
    setBusy(true)
    try {
      if (on && !(await checkCur())) return
      if (!(await setPin(a, auto))) return setM({ e: 1, t: 'PIN non enregistré : le chiffrement du navigateur (page sécurisée HTTPS requise) ou le stockage est indisponible.' })
      setOn(true); reset(); onChange(); setM({ t: on ? 'PIN modifié.' : 'PIN activé : l’application se verrouillera selon le délai choisi.' })
    } finally { setBusy(false) }
  }
  const disable = async () => {
    setBusy(true)
    try {
      if (!(await checkCur())) return
      removePin(); if (hasPin()) return setM({ e: 1, t: 'PIN non désactivé : le stockage n’a pas confirmé la suppression.' })
      setOn(false); reset(); onChange(); setM({ t: 'PIN désactivé.' })
    } finally { setBusy(false) }
  }
  const delay = (e: { target: { value: string } }) => {
    const v = +e.target.value
    if (on) { if (!setAuto(v)) return setM({ e: 1, t: 'Délai non enregistré.' }); onChange(); setM({ t: 'Verrouillage automatique : ' + LBL[v].toLowerCase() + '.' }) }
    setAutoV(v)
  }
  return (
    <div className="card"><h2>Code PIN</h2>
      <p className="mut">Un PIN à 4 chiffres verrouille l’application à l’ouverture et après le délai choisi. Il est haché (PBKDF2) et salé ; après 5 erreurs, l’accès est bloqué de plus en plus longtemps, même si vous rechargez la page. Il protège contre un regard ou une main curieuse, pas contre quelqu’un qui sait lire le stockage du navigateur : il ne chiffre pas vos données.</p>
      <label htmlFor="pin-auto">Verrouillage automatique</label>
      <select id="pin-auto" value={auto} onChange={delay}>{AUTO.map(v => <option key={v} value={v}>{LBL[v]}</option>)}</select>
      {!on && <>
        <div className="grid2" style={{ marginTop: 10 }}>{field('pin-new', 'Nouveau PIN', a, setA)}{field('pin-conf', 'Confirmer le PIN', b, setB)}</div>
        <p style={{ marginBottom: 0 }}><button className="btn" disabled={busy} onClick={activate}>Activer le PIN</button></p></>}
      {on && <>
        <p className="ok" style={{ marginBottom: 6 }}>PIN actif.</p>
        {mode === '' && <div className="row"><button className="btn alt" onClick={() => setMode('change')}>Changer le PIN</button><button className="btn alt" onClick={() => setMode('off')}>Désactiver le PIN</button></div>}
        {mode === 'change' && <><div className="grid2">{field('pin-cur', 'PIN actuel', cur, setCur)}{field('pin-new', 'Nouveau PIN', a, setA)}{field('pin-conf', 'Confirmer le nouveau PIN', b, setB)}</div>
          <p className="row"><button className="btn" disabled={busy} onClick={activate}>Enregistrer le nouveau PIN</button><button className="btn alt" onClick={reset}>Annuler</button></p></>}
        {mode === 'off' && <><div className="grid2">{field('pin-cur', 'PIN actuel', cur, setCur)}</div>
          <p className="row"><button className="btn" disabled={busy} onClick={disable}>Confirmer la désactivation</button><button className="btn alt" onClick={reset}>Annuler</button></p></>}
      </>}
    </div>
  )
}
