import { useEffect, useRef, useState } from 'react'
import type { ShareKey } from './data'
import { Gate } from './ui'
import type { P } from './ui'
import { NEVER_SHARED, SHARE_ITEMS, buildShare, dateFr, emptyKeys, hasContent, rowsOf, shareText, titleOf, whyBad } from './share'
import { cardBlob } from './shareimg'

type Note = { e?: 1; t: string } | null

/** Une catégorie à cocher. Tout est masqué par défaut ; une catégorie sensible demande en plus une confirmation avant d'être montrée. */
function Item({ k, S, upd, ask, setAsk }: Pick<P, 'S' | 'upd'> & { k: ShareKey; ask: ShareKey | null; setAsk: (k: ShareKey | null) => void }) {
  const it = SHARE_ITEMS.find(i => i.k === k)!, on = S.share.vis[k] === true, id = 'sh-' + k
  const set = (v: boolean) => upd(s => { if (v) s.share.vis[k] = true; else delete s.share.vis[k] }, undefined, true)
  return (
    <div className="li" style={{ alignItems: 'flex-start' }}>
      <span>
        <label className="rd" htmlFor={id} style={{ marginRight: 0 }}>
          <input id={id} type="checkbox" checked={on} aria-describedby={id + '-d'} onChange={e => { if (!e.target.checked) { setAsk(null); set(false) } else if (it.sens) setAsk(k); else set(true) }} /> <b>{it.t}</b>
        </label>
        <small id={id + '-d'} className="mut" style={{ display: 'block', marginLeft: 26 }}>{it.d}</small>
        {ask === k && !on && <span role="group" aria-label={'Confirmer : ' + it.t} style={{ display: 'block', marginLeft: 26, marginTop: 6 }}>
          <small className="ko" style={{ display: 'block' }}>Information sensible : vos amis verront ces éléments dans la carte. Confirmer ?</small>
          <span className="row" style={{ marginTop: 6 }}><button className="chip" onClick={() => { set(true); setAsk(null) }}>Oui, la montrer à mes amis</button><button className="chip" onClick={() => setAsk(null)}>Non, la garder masquée</button></span>
        </span>}
      </span>
      <span className={on ? 'ok' : 'mut'} style={{ whiteSpace: 'nowrap' }}>{on ? 'Visible' : 'Masqué'}</span>
    </div>
  )
}

export default function SharePanel({ S, upd }: P) {
  const [ask, setAsk] = useState<ShareKey | null>(null), [rv, setRv] = useState(false), [note, setNote] = useState<Note>(null)
  const [img, setImg] = useState<{ url: string; blob: Blob; key: string } | null>(null), [imgErr, setImgErr] = useState<{ key: string; msg: string } | null>(null)
  const p = buildShare(S), rows = p ? rowsOf(p) : [], key = JSON.stringify(p)
  const hidden = SHARE_ITEMS.filter(i => S.share.vis[i.k] !== true), empty = emptyKeys(S, p)
  const live = useRef(0)
  // L'image est dessinée sur l'appareil à partir de la carte filtrée, et c'est ce fichier-là qui sera partagé : l'aperçu est donc exact.
  // Elle porte la clé de la carte dont elle vient : dès que la sélection change, l'ancienne image n'est ni montrée ni partageable (jamais un fichier périmé).
  useEffect(() => {
    const n = ++live.current
    if (!hasContent(p)) { setImg(null); setImgErr(null); return }
    let url = ''
    cardBlob(p).then(b => { if (live.current !== n) return; url = URL.createObjectURL(b); setImgErr(null); setImg({ url, blob: b, key }) }, e => { if (live.current === n) { setImg(null); setImgErr({ key, msg: (e as Error).message === 'canvas' ? 'Ce navigateur ne sait pas dessiner l’image : le partage du texte reste possible.' : 'Image non créée : ' + (e as Error).message }) } })
    return () => { live.current++; if (url) URL.revokeObjectURL(url) }
  }, [key])

  const ready = hasContent(p) && !whyBad(p)
  const cur = img && img.key === key ? img : null, err = imgErr && imgErr.key === key ? imgErr.msg : '', pending = ready && !cur && !err
  const text = ready ? shareText(p) : '', title = p ? titleOf(p) : ''
  const share = async () => {
    if (!ready || pending) return
    setNote(null)
    const file = cur ? new File([cur.blob], 'believe-suivi.png', { type: 'image/png' }) : null
    try {
      if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text })
        setNote({ t: 'Le menu de partage s’est fermé : la carte a été remise à l’application que vous avez choisie. Believe ne sait pas si elle a ensuite été envoyée.' })
      } else if (typeof navigator.share === 'function') {
        await navigator.share({ title, text })
        setNote({ t: 'Le menu de partage s’est fermé : le texte a été remis à l’application que vous avez choisie (ce navigateur ne partage pas l’image). Believe ne sait pas s’il a ensuite été envoyé.' })
      } else setNote({ e: 1, t: 'Ce navigateur n’a pas de menu de partage : utilisez « Télécharger l’image » ou « Copier le texte ».' })
    } catch (e) {
      setNote((e as Error).name === 'AbortError' ? { t: 'Partage annulé : rien n’a été envoyé.' } : { e: 1, t: 'Partage impossible : ' + ((e as Error).message || 'refusé par le navigateur') + '. Essayez « Télécharger l’image » ou « Copier le texte ».' })
    }
  }
  const download = () => {
    if (!cur) return
    const a = document.createElement('a'); a.href = cur.url; a.download = 'believe-suivi.png'; document.body.appendChild(a); a.click(); a.remove()
    setNote({ t: 'Téléchargement de l’image lancé : retrouvez « believe-suivi.png » dans les téléchargements de votre appareil.' })
  }
  const copy = () => {
    const fail = () => setNote({ e: 1, t: 'Copie refusée par le navigateur : sélectionnez le texte de la carte et copiez-le à la main.' })
    if (!navigator.clipboard) return fail()
    navigator.clipboard.writeText(text).then(() => setNote({ t: 'Texte copié dans le presse-papiers.' }), fail)
  }

  return (
    <Gate k="share" S={S} upd={upd} title="Partage avec des amis" why={<p>Believe crée une carte (image et texte) sur cet appareil avec les seuls éléments que vous cochez, puis c’est vous qui l’envoyez, par l’application de votre choix. Believe n’envoie rien lui-même. Tout est masqué tant que vous ne cochez pas.</p>}>
      <div className="card">
        <h2>Partager mon suivi avec des amis</h2>
        <p className="mut">Mode local : la carte est créée sur votre appareil, sans serveur. Vous choisissez ce que vos amis peuvent voir ; <b>tout est masqué par défaut</b>.</p>
        <h3>Visible sur sélection</h3>
        {SHARE_ITEMS.filter(i => !i.sens).map(i => <Item key={i.k} k={i.k} S={S} upd={upd} ask={ask} setAsk={setAsk} />)}
        <h3>Sensible : masqué par défaut</h3>
        <p className="mut" style={{ marginTop: 0 }}>Ces éléments ne sont montrés qu’après votre confirmation, un par un.</p>
        {SHARE_ITEMS.filter(i => i.sens).map(i => <Item key={i.k} k={i.k} S={S} upd={upd} ask={ask} setAsk={setAsk} />)}
        <h3>Jamais partagé</h3>
        <ul style={{ margin: '4px 0' }}>{NEVER_SHARED.map(x => <li key={x}><small>{x}</small></li>)}</ul>
        <div className="row" style={{ marginTop: 8 }}><button className="btn alt" disabled={!Object.keys(S.share.vis).length} onClick={() => { setAsk(null); upd(s => { s.share.vis = {} }, 'Tout est masqué pour vos amis.') }}>Tout masquer</button></div>
      </div>

      <div className="card" role="region" aria-label="Vue Ami : aperçu exact">
        <h2>Vue Ami</h2>
        <p className="mut" style={{ marginTop: 0 }}>Aperçu exact : la carte, l’image et le texte contiennent ces lignes et rien d’autre.</p>
        {ready && p
          ? <div className="friend">
            <div className="fh"><span className="fw">BELIEVE</span><b>{title}</b><small>{dateFr(p.d)}</small></div>
            <div className="fb">{rows.map(r => (
              <section key={r.k} aria-label={r.h}><h3>{r.h}</h3><ul>{r.l.map((l, i) => <li key={i} className={r.sens ? 'sens' : undefined}>{l}</li>)}</ul></section>
            ))}</div>
          </div>
          : <p role="status">{hasContent(p) ? 'Carte refusée : ' + whyBad(p) : 'Aucun élément visible pour vos amis. Cochez au moins un élément ci-dessus pour créer une carte.'}</p>}
        {!!empty.length && <p className="mut"><small>Coché, mais rien à montrer pour le moment : {empty.map(k => SHARE_ITEMS.find(i => i.k === k)!.t).join(' ; ')}.</small></p>}
        <p className="mut"><small>Masqué pour vos amis ({hidden.length}) : {hidden.length ? hidden.map(i => i.t).join(' ; ') : 'aucun'}.</small></p>
        {ready && (cur
          ? <img className="cardimg" src={cur.url} alt="Image de la carte qui sera partagée, avec les mêmes éléments que la Vue Ami" width={540} />
          : err ? <p className="ko" role="status">{err}</p> : <p className="mut" role="status">Création de l’image…</p>)}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={!ready || pending} onClick={share}>Partager la carte</button>
          <button className="btn alt" disabled={!ready || !cur} onClick={download}>Télécharger l’image</button>
          <button className="btn alt" disabled={!ready} onClick={copy}>Copier le texte</button>
        </div>
        {note && <p className={note.e ? 'ko' : 'ok'} role="status">{note.t}</p>}
      </div>

      <div className="card">
        <h2>Révoquer</h2>
        <p className="mut">Une carte déjà envoyée reste chez la personne qui l’a reçue : Believe ne peut pas la reprendre. La révocation arrête tout nouveau partage, remet tout en masqué et retire l’accord « Partage ».</p>
        {rv
          ? <div className="row"><button className="btn" onClick={() => { setRv(false); setAsk(null); setNote(null); upd(s => { s.share.vis = {}; s.consents.share = false }, 'Partage révoqué : tout est masqué et l’accord est retiré.') }}>Confirmer la révocation</button><button className="btn alt" onClick={() => setRv(false)}>Annuler</button></div>
          : <button className="btn alt" onClick={() => setRv(true)}>Révoquer le partage</button>}
      </div>
    </Gate>
  )
}
