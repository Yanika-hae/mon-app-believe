import { useEffect, useRef, useState } from 'react'
import { today } from './lib'
import type { Cycle, State } from './lib'
import { Flash } from './ui'
import type { Msg, Upd } from './ui'
import { PHASE_LABEL, addDays, addStart, avg, cycleInfo, diffDays, energyByPhase, energySeries, fr1, frDate, lastDays, lowRecovery, recupAverages, recupSeries } from './suivi'

/** Nombre maximal de jours notés par suivi (la même limite que la validation des données). */
const MAX_DAYS = 4000
const LIMIT = 'Limite de 4 000 jours notés atteinte : effacez des notes avant d’en ajouter.'

/** Message propre à un bloc de saisie, affiché juste sous ses boutons. `note(texte, enregistré, objet?)` : l'état est déjà modifié en mémoire quand le stockage refuse l'écriture ; le message le dit au lieu de faire croire à un enregistrement (`objet` nomme ce qui n'a pas été écrit, par défaut le texte de succès sans son point final). */
function useNote(): [Msg, (t: string, saved: boolean, what?: string) => void, () => void, (t: string) => void] {
  const [m, set] = useState<Msg>(null)
  return [m, (t, saved, what) => set(saved ? { t } : { e: 1, t: (what ?? t.replace(/\.$/, '')) + ' : non enregistré, le stockage local est indisponible ou plein.' }), () => set(null), t => set({ e: 1, t })]
}
const dayName = (d: string, t: string) => (d === t ? 'aujourd’hui' : d === addDays(t, -1) ? 'hier' : frDate(d, true))
const plural = (n: number, one: string, many: string) => n + ' ' + (n > 1 ? many : one)

/** Les 14 derniers jours, aujourd'hui en tête : on note surtout le jour même, parfois la veille ou un jour oublié. */
function DayPick({ off, set, tag }: { off: number; set: (n: number) => void; tag: (d: string) => string }) {
  const t = today()
  return (
    <div style={{ margin: '8px 0' }}>
      <label htmlFor="sv-day">Jour noté</label>
      <select id="sv-day" value={off} onChange={e => set(Number(e.target.value))}>
        {lastDays(t, 14).reverse().map((d, i) => <option key={d} value={i}>{(i === 0 ? 'Aujourd’hui, ' : i === 1 ? 'Hier, ' : '') + frDate(d, true) + tag(d)}</option>)}
      </select>
    </div>
  )
}

/** Note de 1 à 5 : cinq boutons radio, dont la valeur enregistrée est cochée. */
function Scale({ name, legend, val, set }: { name: string; legend: string; val: number | undefined; set: (n: number) => void }) {
  return (
    <fieldset aria-describedby="sv-scale">
      <legend>{legend}</legend>
      <div className="rate">{[1, 2, 3, 4, 5].map(n => <label key={n} className="rd"><input type="radio" name={name} checked={val === n} onChange={() => set(n)} />{n}</label>)}</div>
    </fieldset>
  )
}
const ScaleHint = () => <p id="sv-scale" className="mut" style={{ margin: '0 0 8px' }}><small>1 : très bas, 5 : très haut.</small></p>

/** Histogramme des notes, une barre par jour (vide sans note). Le résumé en texte est celui que lit un lecteur d'écran. */
function Bars({ vals, label, ends }: { vals: (number | null)[]; label: string; ends: [string, string] }) {
  return (
    <>
      <div className="bars dense sens" role="img" aria-label={label}>{vals.map((v, i) => <div key={i}><i style={{ height: v === null ? 2 : v * 14, opacity: v === null ? 0.3 : 1 }} /></div>)}</div>
      <p className="mut sens" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0 0' }}><small>{ends[0]}</small><small>{ends[1]}</small></p>
      <p className="mut" style={{ margin: '2px 0 8px' }}><small>Plus la barre est haute, plus la note est élevée (de 1 à 5). Un jour sans note reste vide.</small></p>
    </>
  )
}
const summary = (what: string, n: number, vals: (number | null)[]) => {
  const got = vals.filter((v): v is number => v !== null), m = avg(got)
  return what + ' des ' + n + ' derniers jours : ' + (got.length ? plural(got.length, 'jour noté', 'jours notés') + ', moyenne ' + fr1(m!) + ' sur 5.' : 'aucune note.')
}

const MODES: [Cycle['mode'], string][] = [['off', 'Désactivé'], ['cycle', 'Cycle hormonal et énergie'], ['recup', 'Récupération nerveuse, force et vitalité']]
function Mode({ S, upd }: { S: State; upd: Upd }) {
  const [m, note] = useNote(), g = S.profile?.g
  const pick = (v: Cycle['mode']) => note(v === 'off' ? 'Suivi désactivé : vos notes restent sur l’appareil, rien n’est partagé.' : v === 'cycle' ? 'Suivi du cycle activé.' : 'Suivi de la récupération activé.', upd(s => { s.cycle.mode = v }))
  return (
    <>
      <h2>Type de suivi</h2>
      <fieldset>
        <legend>Suivi à utiliser</legend>
        {MODES.map(([v, t]) => <div key={v}><label className="rd"><input type="radio" name="sv-mode" checked={S.cycle.mode === v} onChange={() => pick(v)} />{t}</label></div>)}
      </fieldset>
      <p className="mut">{g === 'F' ? 'D’après votre profil, le suivi du cycle vous est proposé' : g === 'M' ? 'D’après votre profil, le suivi de la récupération vous est proposé' : 'Choisissez le suivi qui vous convient'} ; l’autre suivi, ou aucun, reste possible. Changer de suivi n’efface aucune note.</p>
      <Flash m={m} />
    </>
  )
}

function StartForm({ c, upd }: { c: Cycle; upd: Upd }) {
  const t = today(), [d, setD] = useState(t), [er, setEr] = useState(''), [m, note, clr] = useNote()
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); clr()
    const r = addStart(c.starts, d, t)
    if (!r.ok) return setEr(r.err)
    setEr('')
    const saved = upd(s => { const q = addStart(s.cycle.starts, d, today()); if (q.ok) s.cycle.starts = q.starts })
    note('Début des règles enregistré : ' + frDate(d) + '.' + (r.odd ? ' L’écart avec la date voisine est inhabituel (moins de 15 ou plus de 60 jours) : il ne compte pas dans la durée moyenne du cycle.' : ''), saved, 'Début des règles du ' + frDate(d))
  }
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="sv-start">Premier jour des règles</label>
      <input id="sv-start" type="date" max={t} value={d} onChange={e => { setD(e.target.value); setEr(''); clr() }} />
      <p style={{ margin: '8px 0' }}><button type="submit" className="btn">Enregistrer le début des règles</button></p>
      {er && <p className="ko" role="alert">{er}</p>}
      <Flash m={m} />
    </form>
  )
}

function Starts({ c, upd, gone }: { c: Cycle; upd: Upd; gone: () => void }) {
  const [all, setAll] = useState(false), [del, setDel] = useState(''), [m, note] = useNote()
  const sorted = [...c.starts].sort().reverse(), shown = all ? sorted : sorted.slice(0, 6)
  const remove = (d: string) => { setDel(''); note('Date retirée : ' + frDate(d) + '.', upd(s => { s.cycle.starts = s.cycle.starts.filter(x => x !== d) })); gone() }
  return (
    <>
      {sorted.length > 0 && <h3>Dates enregistrées ({sorted.length})</h3>}
      <ul className="pl sens">
        {shown.map((d, i) => {
          const older = sorted[i + 1]
          return (
            <li className="li" key={d}>
              <span><b>{frDate(d)}</b>{older && <><br /><small className="mut">{diffDays(older, d)} jours après le début précédent</small></>}</span>
              {del === d
                ? <span className="row" role="group" aria-label={'Retirer : ' + frDate(d)}><span>Retirer cette date ?</span><button className="chip" onClick={() => remove(d)}>Oui, retirer</button><button className="chip" onClick={() => setDel('')}>Annuler</button></span>
                : <button className="chip" aria-label={'Retirer la date du ' + frDate(d)} onClick={() => setDel(d)}>Retirer</button>}
            </li>
          )
        })}
      </ul>
      {sorted.length > 6 && <p><button className="btn alt" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Réduire la liste' : 'Afficher toutes les dates (' + sorted.length + ')'}</button></p>}
      <Flash m={m} />
    </>
  )
}

const when = (n: number) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : n > 1 ? 'dans ' + n + ' jours' : n === -1 ? 'hier : le cycle est plus long que la moyenne' : 'il y a ' + -n + ' jours : le cycle est plus long que la moyenne')

function Energy({ c, upd }: { c: Cycle; upd: Upd }) {
  const t = today(), [off, setOff] = useState(0), [m, note, clr, fail] = useNote(), day = addDays(t, -off), cur = c.en[day]
  const set = (n: number) => {
    if (cur === undefined && Object.keys(c.en).length >= MAX_DAYS) return fail(LIMIT)
    note('Énergie enregistrée : ' + n + ' sur 5, ' + dayName(day, t) + '.', upd(s => { s.cycle.en[day] = n }))
  }
  return (
    <>
      <h2>Énergie du jour</h2>
      <DayPick off={off} set={n => { setOff(n); clr() }} tag={d => (c.en[d] ? ' · énergie ' + c.en[d] : '')} />
      <Scale name="sv-en" legend="Énergie ressentie" val={cur} set={set} />
      <ScaleHint />
      {cur !== undefined && <p><button className="chip" onClick={() => note('Note retirée : ' + dayName(day, t) + '.', upd(s => { delete s.cycle.en[day] }))}>Retirer la note de ce jour</button></p>}
      <Flash m={m} />
    </>
  )
}

function CycleView({ S, upd }: { S: State; upd: Upd }) {
  const t = today(), c = S.cycle, info = cycleInfo(c.starts, t), head = useRef<HTMLHeadingElement>(null), [back, setBack] = useState(0)
  useEffect(() => { if (back) head.current?.focus() }, [back]) // après le retrait d'une date, le focus revient au titre du bloc (le bouton a disparu)
  const es = energySeries(c, t, 28).map(x => x.v), ph = energyByPhase(c, t)
  return (
    <>
      <h2 ref={head} tabIndex={-1} style={{ outline: 'none' }}>Où en êtes-vous ?</h2>
      <div className="card sens">
        {!info.last && <p style={{ margin: 0 }}>Aucun début de règles enregistré : saisissez ci-dessous le premier jour de vos dernières règles.</p>}
        {info.last && info.n === null && <p style={{ margin: 0 }}>Le dernier début enregistré ({frDate(info.last)}) remonte à plus de 60 jours : le jour du cycle n’est plus calculé. Saisissez le début de vos dernières règles.</p>}
        {info.n !== null && <>
          <p style={{ margin: '0 0 4px' }}><b>Jour {info.n} du cycle</b> · {PHASE_LABEL[info.phase!]}</p>
          <p className="mut" style={{ margin: '0 0 4px' }}>Durée de cycle retenue : {info.len} jours ({info.measured === 0 ? 'valeur courante, faute de deux débuts de règles assez rapprochés' : info.measured === 1 ? 'mesurée sur 1 cycle' : 'moyenne de vos ' + info.measured + ' derniers cycles'}).</p>
          <p className="mut" style={{ margin: 0 }}>Prochaines règles estimées : {frDate(info.next!)} ({when(info.inDays!)}).</p>
        </>}
        <p className="mut" style={{ margin: '8px 0 0' }}><small>Repères moyens calculés à partir de vos seules dates : ni diagnostic, ni contraception, ni aide à la conception. Chaque cycle est différent.</small></p>
      </div>
      <h2>Début des règles</h2>
      <StartForm c={c} upd={upd} />
      <Starts c={c} upd={upd} gone={() => setBack(back + 1)} />
      <Energy c={c} upd={upd} />
      <h2>28 derniers jours</h2>
      <Bars vals={es} label={summary('Énergie', 28, es)} ends={['il y a 28 jours', 'aujourd’hui']} />
      <h3>Énergie moyenne par phase</h3>
      {ph.length
        ? <ul className="sens">{ph.map(x => <li key={x.phase}>{PHASE_LABEL[x.phase]} : {fr1(x.avg)} sur 5 ({x.n} notes)</li>)}</ul>
        : <p className="mut">Une phase s’affiche ici à partir de 3 notes d’énergie prises pendant cette phase.</p>}
      <p className="mut"><small>Moyennes indicatives sur un petit nombre de jours : elles décrivent vos notes, elles ne prouvent rien.</small></p>
    </>
  )
}

const NAMES = ['récupération nerveuse', 'force', 'vitalité']
function Recup({ c, upd }: { c: Cycle; upd: Upd }) {
  const t = today(), [off, setOff] = useState(0), [dr, setDr] = useState<{ d: string; v: (number | undefined)[] } | null>(null), [er, setEr] = useState(''), [m, note, clr] = useNote()
  const day = addDays(t, -off), saved = c.rec[day]
  const v: (number | undefined)[] = dr && dr.d === day ? dr.v : saved ? [...saved] : [undefined, undefined, undefined] // le brouillon ne vaut que pour le jour affiché
  const pick = (i: number, n: number) => { setDr({ d: day, v: v.map((x, j) => (j === i ? n : x)) }); setEr(''); clr() }
  const save = (e: React.FormEvent) => {
    e.preventDefault(); clr()
    const miss = NAMES.filter((_, i) => v[i] === undefined)
    if (miss.length) return setEr('Il manque une note de 1 à 5 : ' + miss.join(', ') + '.')
    if (saved === undefined && Object.keys(c.rec).length >= MAX_DAYS) return setEr(LIMIT)
    const tri = v as [number, number, number]
    setEr(''); note('Journée enregistrée : ' + dayName(day, t) + '.', upd(s => { s.cycle.rec[day] = tri }))
  }
  return (
    <>
      <h2>Récupération, force et vitalité</h2>
      <form onSubmit={save} noValidate>
        <DayPick off={off} set={n => { setOff(n); setEr(''); clr() }} tag={d => (c.rec[d] ? ' · notée' : '')} />
        <Scale name="sv-rc-r" legend="Récupération nerveuse" val={v[0]} set={n => pick(0, n)} />
        <Scale name="sv-rc-f" legend="Force" val={v[1]} set={n => pick(1, n)} />
        <Scale name="sv-rc-v" legend="Vitalité" val={v[2]} set={n => pick(2, n)} />
        <ScaleHint />
        <div className="row"><button type="submit" className="btn">Enregistrer la journée</button>
          {saved !== undefined && <button type="button" className="chip" onClick={() => { setDr({ d: day, v: [undefined, undefined, undefined] }); note('Note retirée : ' + dayName(day, t) + '.', upd(s => { delete s.cycle.rec[day] })) }}>Retirer la note de ce jour</button>}</div>
        {er && <p className="ko" role="alert">{er}</p>}
        <Flash m={m} />
      </form>
    </>
  )
}

function RecupView({ S, upd }: { S: State; upd: Upd }) {
  const t = today(), c = S.cycle, rs = recupSeries(c, t, 14), av = recupAverages(c, t, 7), week = recupSeries(c, t, 7).filter(x => x.v !== null).reverse()
  const rec = rs.map(x => (x.v ? x.v[0] : null))
  return (
    <>
      <Recup c={c} upd={upd} />
      {lowRecovery(c, t) && (
        <div className="card sens" role="status">
          <h3 style={{ marginTop: 0 }}>Récupération basse</h3>
          <p style={{ margin: 0 }}>Votre récupération est notée 2 sur 5 ou moins depuis trois jours. Allégez l’entraînement, protégez votre sommeil et buvez régulièrement. Si cette fatigue dure ou s’accompagne d’autres symptômes, parlez-en à un professionnel de santé : Believe ne pose aucun diagnostic.</p>
        </div>
      )}
      <h2>14 derniers jours</h2>
      <Bars vals={rec} label={summary('Récupération nerveuse', 14, rec)} ends={['il y a 14 jours', 'aujourd’hui']} />
      <h3>Cette semaine</h3>
      {av
        ? <p className="sens">Moyenne sur 7 jours ({plural(av.n, 'jour noté', 'jours notés')}) : récupération {fr1(av.rec)} · force {fr1(av.force)} · vitalité {fr1(av.vit)} (sur 5).</p>
        : <p className="mut">Aucune journée notée ces 7 derniers jours.</p>}
      {week.length > 0 && <ul className="pl sens">{week.map(x => <li className="li" key={x.d}><span><b>{frDate(x.d, true)}</b></span><span>récupération {x.v![0]} · force {x.v![1]} · vitalité {x.v![2]}</span></li>)}</ul>}
    </>
  )
}

function Own({ S, upd }: { S: State; upd: Upd }) {
  const c = S.cycle, [ask, setAsk] = useState(false), [m, note] = useNote(), nS = c.starts.length, nE = Object.keys(c.en).length, nR = Object.keys(c.rec).length
  const shared = S.consents.share && S.share.vis.cycle === true && c.mode !== 'off'
  const wipe = () => { setAsk(false); note('Notes et dates effacées. Le type de suivi est conservé.', upd(s => { s.cycle.starts = []; s.cycle.en = {}; s.cycle.rec = {} })) }
  const parts = [nS && plural(nS, 'début de règles', 'débuts de règles'), nE && plural(nE, 'énergie notée', 'énergies notées'), nR && plural(nR, 'journée de récupération', 'journées de récupération')].filter(Boolean)
  return (
    <>
      <h2>Sur cet appareil</h2>
      <p>Ces notes restent sur cet appareil. Elles ne sont montrées à des amis que si vous cochez « Mon suivi cycle ou récupération » dans le partage (rubrique 5), et alors seulement {c.mode === 'recup' ? 'la récupération, la force et la vitalité du jour' : 'le jour du cycle et l’énergie du jour'} : jamais les dates de règles.</p>
      <p className="mut">{shared ? 'Partage actuel : ce suivi est coché dans votre partage.' : 'Partage actuel : aucun, ce suivi n’est pas partagé.'} <a href="#/5/partage">Régler le partage</a></p>
      <p className="mut sens">{parts.length ? 'Enregistré sur cet appareil : ' + parts.join(', ') + '.' : 'Aucune note ni date enregistrée.'}</p>
      {parts.length > 0 && (ask
        ? <div className="row" role="group" aria-label="Effacer mes notes et dates"><span>Effacer définitivement toutes ces notes et dates ? Le type de suivi est conservé.</span><button className="btn" onClick={wipe}>Oui, tout effacer</button><button className="btn alt" onClick={() => setAsk(false)}>Annuler</button></div>
        : <p><button className="btn alt" onClick={() => setAsk(true)}>Effacer mes notes et dates</button></p>)}
      <Flash m={m} />
    </>
  )
}

/** Suivi facultatif de la rubrique 8 : cycle et énergie, ou récupération, force et vitalité. Affiché derrière l'accord « Santé et poids » ; rien ne quitte l'appareil, sauf choix explicite dans le partage (rubrique 5). */
export default function Suivi({ S, upd }: { S: State; upd: Upd }) {
  return (
    <section className="suivi" aria-label="Suivi cycle ou récupération">
      <Mode S={S} upd={upd} />
      {S.cycle.mode === 'cycle' && <CycleView S={S} upd={upd} />}
      {S.cycle.mode === 'recup' && <RecupView S={S} upd={upd} />}
      {S.cycle.mode === 'off' && <p className="mut">Le suivi est désactivé : rien n’est demandé, noté ni partagé.</p>}
      <Own S={S} upd={upd} />
    </section>
  )
}
