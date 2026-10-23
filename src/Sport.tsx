import { useEffect, useRef, useState } from 'react'
import { markHabit, today } from './lib'
import { clock, kcal, pace } from './geo'
import type { Pt } from './geo'
import { endRun, lapRun, lockScreen, pauseRun, go, setAct, setVoice, startRun, unlockScreen, useRun, elapsed } from './run'
import { Flash, Gate, Tabs, useTab } from './ui'
import type { P } from './ui'
import { lowRecovery } from './suivi'

const ACTS = ['Marche', 'Course', 'Marathon', 'Trail', 'Randonnée']
const PROGS: { n: string; ex: [string, number, string, number][] }[] = [
  { n: 'Abdos et core', ex: [['Gainage planche', 3, '40 s', 30], ['Crunchs', 3, '15 répétitions', 30], ['Relevés de jambes', 3, '12 répétitions', 30], ['Gainage latéral', 2, '30 s par côté', 30]] },
  { n: 'Musculation et tonicité', ex: [['Squats', 4, '12 répétitions', 60], ['Pompes (sur les genoux si besoin)', 3, '10 répétitions', 60], ['Fentes', 3, '10 répétitions par jambe', 60], ['Rowing avec haltère', 3, '12 répétitions', 60]] },
  { n: 'Course 10 km', ex: [['Footing d’échauffement', 1, '10 min', 0], ['Fractionné 400 m', 6, '400 m allure 5 km', 90], ['Sortie longue facile', 1, '60 min', 0]] },
  { n: 'Semi-marathon', ex: [['Footing facile', 1, '45 min', 0], ['Bloc tempo', 3, '10 min allure semi', 120], ['Sortie longue', 1, '90 min', 0]] },
  { n: 'Marathon', ex: [['Footing de récupération', 1, '40 min', 0], ['Bloc allure marathon', 3, '15 min', 120], ['Sortie longue', 1, '2 h', 0]] },
  { n: 'Trail et randonnée', ex: [['Montées en marche rapide', 5, '3 min', 90], ['Descentes techniques', 4, '2 min', 90], ['Sortie longue avec dénivelé', 1, '2 h', 0]] }
]
const GM: Record<string, string> = {
  denied: 'Position refusée : autorisez-la dans les réglages du navigateur. Le chronomètre continue sans distance.',
  error: 'Signal GPS indisponible ou trop faible.', none: 'GPS indisponible sur cet appareil.'
}

function Gps({ S, upd, setM }: P) {
  const r = useRun(), cv = useRef<HTMLCanvasElement>(null), [, setT] = useState(0)
  useEffect(() => { if (r.st !== 'run') return; const i = setInterval(() => setT(n => n + 1), 500); return () => clearInterval(i) }, [r.st])
  const stop = () => {
    const { t, km, act, alt, gain } = endRun()
    if (t < 5) return setM({ e: 1, t: 'Séance trop courte : rien n’a été enregistré.' })
    const kg = S.profile?.w, k = kg ? kcal(act, kg, km, t) : 0, g = alt === null ? null : Math.round(gain)
    upd(s => { s.workouts.unshift({ d: today(), act, km: Math.round(km * 100) / 100, sec: Math.round(t), kcal: k, gain: g }); markHabit(s, 'sport') }, 'Séance enregistrée, habitude Sport validée.')
  }
  useEffect(() => {
    const c = cv.current, g = c && c.getContext('2d'), ps = r.pts
    if (!c || !g) return
    g.clearRect(0, 0, c.width, c.height)
    if (ps.length < 2) return
    const la = ps.map(p => p.lat), lo = ps.map(p => p.lng), a = Math.min(...la), b = Math.max(...la), x0 = Math.min(...lo), x1 = Math.max(...lo)
    const k = Math.cos(((a + b) / 2) * Math.PI / 180), W = c.width, H = c.height, s = Math.min((W - 20) / Math.max((x1 - x0) * k, 1e-5), (H - 20) / Math.max(b - a, 1e-5))
    const X = (p: Pt) => 10 + (p.lng - x0) * k * s, Y = (p: Pt) => H - 10 - (p.lat - a) * s
    g.strokeStyle = getComputedStyle(c).getPropertyValue('--gold').trim() || '#c9a85c'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath()
    ps.forEach((p, i) => { if (i) g.lineTo(X(p), Y(p)); else g.moveTo(X(p), Y(p)) })
    g.stroke(); g.fillStyle = g.strokeStyle
    const e = ps[ps.length - 1]; g.beginPath(); g.arc(X(e), Y(e), 5, 0, 7); g.fill()
  })
  const t = elapsed(), km = r.dist / 1000, kg = S.profile?.w, lost = r.st === 'run' && r.gps !== 'denied' && r.gps !== 'none' && Date.now() - r.fix > 15000
  const stat = (l: string, v: string) => <div className="st"><span className="mut">{l}</span><b>{v}</b></div>
  return (
    <Gate k="gps" S={S} upd={upd} title="Position (GPS)" why={<p>Pour mesurer distance, allure et dénivelé, Believe lit la position de l’appareil uniquement pendant une séance que vous démarrez. Le tracé reste en mémoire pendant la séance ; seul le résumé (distance, durée, calories estimées) est enregistré sur l’appareil quand vous validez. Rien n’est envoyé à un serveur Believe.</p>}>
      <div className="chips" role="group" aria-label="Activité">{ACTS.map(a => <button key={a} className="chip" aria-pressed={r.act === a} disabled={r.st !== 'idle'} onClick={() => setAct(a)}>{a}</button>)}</div>
      <div className="story">
        {stat('Temps', clock(t))}{stat('Distance', km.toFixed(2) + ' km')}{stat('Allure moy.', pace(t, km) + ' /km')}{stat('Vitesse moy.', t > 0 && km > 0 ? (km / (t / 3600)).toFixed(1) + ' km/h' : '—')}{stat('Dénivelé +', r.alt === null ? '—' : Math.round(r.gain) + ' m')}{stat('Kcal estimées', kg ? String(kcal(r.act, kg, km, t)) : '—')}
      </div>
      {!kg && <p className="mut">Renseignez votre poids (rubrique 1) pour estimer les calories.</p>}
      {r.gps !== 'ok' && GM[r.gps] && <p className="ko" role="alert">{GM[r.gps]}</p>}
      {lost && <p className="ko" role="alert">Signal GPS perdu depuis plus de 15 s : la distance n’augmente plus.</p>}
      <div className="row">
        {r.st === 'idle' && <button className="btn" onClick={startRun}>Démarrer</button>}
        {r.st === 'run' && <><button className="btn alt" onClick={pauseRun}>Pause</button><button className="btn alt" onClick={lapRun}>Tour</button></>}
        {r.st === 'pause' && <button className="btn" onClick={go}>Reprendre</button>}
        {r.st !== 'idle' && <button className="btn" onClick={stop}>Arrêter</button>}
      </div>
      <label className="rd" style={{ margin: '10px 0' }}><input type="checkbox" checked={r.voice} onChange={e => setVoice(e.target.checked)} /> Annonces vocales à chaque kilomètre</label>
      {r.laps.map(l => <p key={l} className="mut" style={{ margin: '2px 0' }}>{l}</p>)}
      <canvas ref={cv} className="sens" width={600} height={300} role="img" aria-label="Tracé GPS" style={{ width: '100%', height: 'auto', border: '1px solid var(--line)', borderRadius: 12, marginTop: 10 }} />
      <p className="mut">La séance continue si vous changez de rubrique (un bandeau le rappelle), mais gardez l’écran allumé : le navigateur peut suspendre le GPS en arrière-plan ou écran verrouillé.</p>
    </Gate>
  )
}

function Progs({ S, upd }: P) {
  const [pi, setPi] = useState(0), [done, setDone] = useState<Record<string, number>>({}), [rest, setRest] = useState(0)
  const pr = PROGS[pi], lv = S.profile?.lv ?? 'I', f = lv === 'S' ? 0.7 : lv === 'A' ? 1.3 : 1
  useEffect(() => {
    if (rest <= 0) return
    const i = setInterval(() => setRest(x => { if (x <= 1) { try { navigator.vibrate(200) } catch { /* ignoré */ } return 0 } return x - 1 }), 1000)
    return () => clearInterval(i)
  }, [rest > 0])
  const n = (j: number) => Math.max(1, Math.round(pr.ex[j][1] * f))
  const tick = (j: number) => { const k = pi + '|' + j, d = done[k] ?? 0; if (d >= n(j)) return; setDone({ ...done, [k]: d + 1 }); if (pr.ex[j][3]) setRest(pr.ex[j][3]) }
  const all = pr.ex.every((_, j) => (done[pi + '|' + j] ?? 0) >= n(j))
  return (
    <>
      <div className="chips" role="group" aria-label="Programme">{PROGS.map((p, i) => <button key={p.n} className="chip" aria-pressed={pi === i} onClick={() => { setPi(i); setDone({}); setRest(0) }}>{p.n}</button>)}</div>
      <p className="mut">Niveau : {lv === 'S' ? 'sédentaire' : lv === 'A' ? 'actif' : 'intermédiaire'}, séries conseillées ajustées en conséquence. Exemples généraux à adapter : ils ne remplacent ni un coach ni un avis médical.</p>
      {S.consents.health && S.cycle.mode === 'recup' && lowRecovery(S.cycle, today()) && <p className="mut sens" role="note">Votre récupération est basse depuis trois jours : une séance légère, de la marche ou du repos conviendrait peut-être mieux aujourd’hui. C’est une suggestion, jamais une consigne. <a href="#/8/suivi">Voir le suivi</a></p>}
      {rest > 0 && <div className="card" role="status">Repos : <b>{clock(rest)}</b> <button className="chip" onClick={() => setRest(0)}>Passer</button></div>}
      {pr.ex.map((e, j) => { const d = done[pi + '|' + j] ?? 0; return (
        <div className="li" key={e[0]}><span><b>{e[0]}</b><br /><small className="mut">{n(j)} × {e[2]}{e[3] ? ', repos ' + e[3] + ' s' : ''}</small></span>
          <button className="btn alt" disabled={d >= n(j)} onClick={() => tick(j)}>{d >= n(j) ? 'Terminé' : 'Série faite ' + d + '/' + n(j)}</button></div>) })}
      <p><button className="btn" disabled={!all} onClick={() => upd(s => { markHabit(s, 'sport') }, 'Séance validée : habitude Sport cochée pour aujourd’hui.')}>Valider la séance</button> <button className="btn alt" onClick={() => { setDone({}); setRest(0) }}>Réinitialiser</button></p>
    </>
  )
}

function Ped({ S, upd }: P) {
  const td = today(), [on, setOn] = useState(false), [tot, setTot] = useState(S.steps[td] ?? 0), [sens, setSens] = useState(2), [msg, setMsg] = useState('')
  const R = useRef({ f: 9.81, above: false, last: 0, tot: 0, hit: false, sens: 2, day: td }), H = useRef<((e: DeviceMotionEvent) => void) | undefined>(undefined)
  R.current.sens = sens
  const flush = () => {
    const r = R.current, n = r.tot, ok = n >= 10000 && !r.hit
    if (ok) r.hit = true
    upd(s => { s.steps[R.current.day] = n; if (n >= 10000) markHabit(s, 'pas', R.current.day) }, ok ? 'Objectif de 10 000 pas atteint : habitude validée.' : undefined)
  }
  const onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity, r = R.current
    if (!a || a.x == null || a.y == null || a.z == null) return
    const d = today(); if (d !== r.day) { flush(); r.day = d; r.tot = 0; r.hit = false; setTot(0) }
    r.f = r.f * 0.8 + Math.hypot(a.x, a.y, a.z) * 0.2
    const thr = 9.81 + (3.5 - r.sens), now = Date.now()
    if (!r.above && r.f > thr && now - r.last > 280) { r.above = true; r.last = now; r.tot++; setTot(r.tot); if (r.tot % 25 === 0) flush() }
    else if (r.above && r.f < thr - 0.3) r.above = false
  }
  const stop = () => { if (H.current) removeEventListener('devicemotion', H.current); H.current = undefined; unlockScreen(); setOn(false); flush() }
  useEffect(() => () => { if (H.current) { removeEventListener('devicemotion', H.current); H.current = undefined; unlockScreen(); flush() } }, [])
  const start = async () => {
    const DM: any = (window as any).DeviceMotionEvent
    if (!DM) return setMsg('Capteur de mouvement indisponible sur cet appareil.')
    try { if (typeof DM.requestPermission === 'function' && (await DM.requestPermission()) !== 'granted') return setMsg('Accès au mouvement refusé : autorisez-le dans les réglages de Safari. Le reste de l’app fonctionne sans.') }
    catch { return setMsg('Accès au mouvement refusé.') }
    const r = R.current; r.day = today(); r.tot = S.steps[r.day] ?? 0; r.hit = r.tot >= 10000; setTot(r.tot); setMsg('')
    H.current = onMotion; addEventListener('devicemotion', onMotion); lockScreen(); setOn(true)
  }
  return (
    <Gate k="motion" S={S} upd={upd} title="Capteur de mouvement (podomètre)" why={<p>Pour compter vos pas, Believe lit l’accéléromètre de l’appareil tant que le comptage est démarré. Seul le total de pas du jour est enregistré sur l’appareil ; aucune donnée brute n’est conservée ni envoyée. Sur iPhone, Safari demandera sa propre autorisation au démarrage.</p>}>
      <p style={{ fontSize: '2rem', margin: '4px 0' }}><b>{tot}</b> <span className="mut" style={{ fontSize: '1rem' }}>pas aujourd’hui sur 10 000</span></p>
      <progress value={Math.min(tot, 10000)} max={10000} style={{ width: '100%' }} aria-label="Progression vers 10 000 pas" />
      <label htmlFor="sens" style={{ marginTop: 12 }}>Sensibilité : {sens} (plus haut = plus de pas détectés)</label>
      <input id="sens" type="range" min="0.5" max="3" step="0.25" value={sens} onChange={e => setSens(+e.target.value)} />
      {msg && <p className="ko" role="alert">{msg}</p>}
      <p>{on ? <button className="btn" onClick={stop}>Arrêter le comptage</button> : <button className="btn" onClick={start}>Démarrer le comptage</button>}</p>
      <p className="mut">Estimation par accéléromètre, moins précise qu’un capteur dédié. Le navigateur ne compte pas en arrière-plan ni écran verrouillé : l’écran reste allumé pendant le comptage si l’appareil le permet. Les 10 000 pas valident l’habitude correspondante. Quitter la rubrique arrête le comptage (les pas sont enregistrés).</p>
    </Gate>
  )
}

export default function SportPage(p: P) {
  const [tab, setTab] = useTab(p.sub, ['gps', 'programmes', 'podometre']), hist = p.S.workouts.slice(0, 5)
  return (
    <>
      <h1>Sport, GPS et podomètre</h1>
      <Flash m={p.m} />
      <Tabs items={['Séance GPS', 'Programmes', 'Podomètre']} v={tab} set={setTab} label="Section" S={p.S}>
        <div hidden={tab !== 0}><Gps {...p} /></div>
        <div hidden={tab !== 1}><Progs {...p} /></div>
        <div hidden={tab !== 2}><Ped {...p} /></div>
      </Tabs>
      <h2>Dernières séances</h2>
      {hist.length ? hist.map((w, i) => <div className="li" key={i} style={{ display: 'block' }}><b>{w.act}</b>, {w.d} : {w.km.toFixed(2)} km en {clock(w.sec)}{w.kcal ? ', environ ' + w.kcal + ' kcal (estimation)' : ''}{w.gain !== null ? ', +' + w.gain + ' m' : ''}</div>) : <p className="mut">Aucune séance enregistrée pour l’instant.</p>}
    </>
  )
}
