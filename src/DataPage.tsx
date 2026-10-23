import { useState } from 'react'
import { DEF, KEY_BAK, convert, roll } from './lib'
import type { CK, State } from './lib'
import { Flash, Tabs, useTab } from './ui'
import type { P } from './ui'
import PinCard from './PinCard'
import Bilan from './BilanPage'
import SharePanel from './SharePanel'
import { abortRun, useRun } from './run'
import { discardRec, useRec } from './rec'

export interface DP extends P { purge: () => Promise<boolean>; inst: (() => void) | null; pinChanged: () => void }

const CONSENTS: [CK, string, string][] = [
  ['ai', 'Believe AI', 'Envoyer vos questions à l’IA (Google Gemini), sur action de votre part. Rien n’est envoyé automatiquement.'],
  ['photo', 'Photos envoyées à l’IA', 'Photos de plats ou de frigo, réduites sur l’appareil avant l’envoi.'],
  ['health', 'Santé et poids', 'Enregistrer sur cet appareil poids, repas, eau, sommeil, cycle ou récupération.'],
  ['gps', 'Position (GPS)', 'Lire la position pendant une séance de sport que vous démarrez.'],
  ['motion', 'Mouvement (podomètre)', 'Lire l’accéléromètre pour compter les pas, comptage démarré par vous.'],
  ['mic', 'Microphone', 'Enregistrer des audios (dictaphone, exercices), uniquement quand vous appuyez sur le bouton. L’audio reste sur l’appareil.'],
  ['speech', 'Dictée vocale', 'Dicter vos questions à Believe AI avec la reconnaissance vocale du navigateur, le temps d’une phrase lancée par un bouton. Selon le navigateur (Chrome, Safari), le son est envoyé à Google ou à Apple pour être transcrit ; Believe ne reçoit que le texte.'],
  ['notif', 'Notifications', 'Rappels de tâches avant leur échéance, pendant que l’application est ouverte : dans l’application, et par notification du système si le navigateur l’autorise. Rien n’est envoyé à un serveur.'],
  ['share', 'Partage avec des amis', 'Créer une carte de progression à partager, avec les seuls éléments que vous choisissez.']
]

function Consents({ S, upd }: P) {
  const r = useRun(), mic = useRec(), [ask, setAsk] = useState(false), [askMic, setAskMic] = useState(false)
  const set = (k: CK, v: boolean) => upd(s => { s.consents[k] = v; if (k === 'share' && !v) s.share.vis = {} }, (v ? 'Accord donné : ' : 'Accord retiré : ') + CONSENTS.find(c => c[0] === k)![1] + '.')
  const revoke = (k: CK) => {
    if (k === 'gps' && r.st !== 'idle' && !ask) return setAsk(true)
    if (k === 'gps') { abortRun(); setAsk(false) }
    if (k === 'mic' && mic.st !== 'idle' && !askMic) return setAskMic(true)
    if (k === 'mic') { discardRec(); setAskMic(false) }
    set(k, false)
  }
  return (
    <div className="card"><h2>Consentements</h2>
      <p className="mut">Chaque fonction sensible demande son accord au moment de l’utiliser. Vous pouvez le retirer ici à tout moment : la fonction s’arrête aussitôt et le reste de l’application continue de fonctionner.</p>
      {CONSENTS.map(([k, t, d]) => (
        <div className="li" key={k} style={{ alignItems: 'flex-start' }}>
          <span><b>{t}</b> : <span className={S.consents[k] ? 'ok' : 'mut'}>{S.consents[k] ? 'donné' : 'non donné'}</span><br /><small className="mut">{d}</small>
            {k === 'gps' && ask && <><br /><small className="ko">Une séance est en cours : retirer la position l’arrête sans l’enregistrer.</small></>}
            {k === 'mic' && askMic && <><br /><small className="ko">Un enregistrement est en cours ou non sauvegardé : retirer le micro l’arrête et l’efface (les audios déjà sauvegardés restent).</small></>}</span>
          {S.consents[k]
            ? <button className="chip" aria-label={((k === 'gps' && ask) || (k === 'mic' && askMic) ? 'Confirmer le retrait' : 'Retirer') + ' ' + t} onClick={() => revoke(k)}>{(k === 'gps' && ask) || (k === 'mic' && askMic) ? 'Confirmer le retrait' : 'Retirer'}</button>
            : <button className="chip" aria-label={'Donner ' + t} onClick={() => set(k, true)}>Donner</button>}
        </div>
      ))}
    </div>
  )
}

function HealthErase({ upd }: P) {
  const [pg, setPg] = useState(false)
  return (
    <div className="card"><h2>Données de santé</h2>
      <p className="mut">Efface pesées, repas, eau, sommeil et suivi cycle ou récupération. Votre profil (taille, poids du profil) reste ; modifiez-le dans la rubrique 1.</p>
      {pg ? <><button className="btn" onClick={() => { setPg(false); upd(s => { s.weights = []; s.water = {}; s.sleep = {}; s.meals = []; s.cycle = DEF().cycle }, 'Données de santé effacées.') }}>Confirmer l’effacement</button> <button className="btn alt" onClick={() => setPg(false)}>Annuler</button></>
        : <button className="btn alt" onClick={() => setPg(true)}>Effacer mes données de santé</button>}
    </div>
  )
}

function Privacy(p: DP) {
  const { S, upd } = p
  return (
    <>
      <Consents {...p} />
      <PinCard setM={p.setM} onChange={p.pinChanged} />
      <div className="card"><h2>Mode discret</h2><p className="mut">Floute poids, IMC et jauges sur toutes les vues.</p>
        <button className="btn alt" aria-pressed={S.discret} onClick={() => upd(s => { s.discret = !s.discret })}>{S.discret ? 'Activé, cliquer pour désactiver' : 'Désactivé, cliquer pour activer'}</button></div>
      <HealthErase {...p} />
      <div className="card"><h2>Informations légales</h2><p className="mut">Conditions d’utilisation, politique de confidentialité et transparence sur l’intelligence artificielle.</p><a className="btn alt" href="#/legal">Lire les informations légales</a></div>
    </>
  )
}

const THEMES: [State['settings']['theme'], string][] = [['auto', 'Suivre le système'], ['light', 'Clair'], ['dark', 'Sombre'], ['oled', 'Noir OLED']]
function Settings({ S, upd, inst }: DP) {
  return (
    <>
      <div className="card"><h2>Affichage</h2>
        <div role="radiogroup" aria-label="Thème">{THEMES.map(([k, t]) => <label className="rd" key={k}><input type="radio" name="theme" checked={S.settings.theme === k} onChange={() => upd(s => { s.settings.theme = k })} /> {t}</label>)}</div>
        <label className="rd" style={{ marginTop: 10 }}><input type="checkbox" checked={S.settings.motion === 'reduced'} onChange={e => upd(s => { s.settings.motion = e.target.checked ? 'reduced' : 'auto' })} /> Réduire les animations</label>
        <label className="rd"><input type="checkbox" checked={S.settings.haptics} onChange={e => upd(s => { s.settings.haptics = e.target.checked })} /> Retour haptique (vibration légère sur Android)</label>
        <label className="rd"><input type="checkbox" checked={S.settings.sounds} onChange={e => upd(s => { s.settings.sounds = e.target.checked })} /> Sons (métronome, fin de minuteur)</label>
        <p className="mut">La vibration n’est pas disponible sur iPhone. Si votre système demande moins d’animations, Believe le respecte sans réglage.</p></div>
      <div className="card"><h2>Installer sur le téléphone</h2>
        <p className="mut">Android (Chrome) : menu ⋮, puis « Installer l’application ». iPhone et iPad (Safari) : Partager, puis « Sur l’écran d’accueil ».</p>
        {inst && <button className="btn" onClick={inst}>Installer maintenant</button>}</div>
    </>
  )
}

function Donnees({ S, upd, setM, purge }: DP) {
  const [ex, setEx] = useState(''), [im, setIm] = useState(''), [pv, setPv] = useState<{ o?: State; e?: 1; t: string } | null>(null), [pg, setPg] = useState(false)
  const [bak, setBak] = useState<string | null>(() => { try { return localStorage.getItem(KEY_BAK) } catch { return null } })
  const check = () => {
    let o: unknown
    try { o = JSON.parse(im) } catch { return setPv({ e: 1, t: 'Import refusé : JSON invalide.' }) }
    const r = convert(o)
    if (!r.s) return setPv({ e: 1, t: 'Import refusé : structure inattendue (' + r.err + ').' })
    const v = (o as { v: number }).v, s = r.s
    setPv({ o: s, t: `Fichier valide (version ${v}${v === 1 ? ', converti en version 2' : ''}) : profil ${s.profile ? s.profile.name : 'absent'}, ${s.habits.length} habitudes, ${Object.keys(s.checks).length} jours validés, ${s.archives.length} semaines archivées, ${s.notes.length} notes.` })
  }
  const copy = (t: string) => {
    const fail = () => setM({ e: 1, t: 'Copie refusée par le navigateur : sélectionnez le texte et copiez-le à la main.' })
    if (!navigator.clipboard) return fail()
    navigator.clipboard.writeText(t).then(() => setM({ t: 'Copié dans le presse-papiers.' }), fail)
  }
  const wipe = async () => {
    if (!pg) return setPg(true)
    setPg(false); setEx(''); setBak(null)
    const ok = await purge()
    setM(ok ? { t: 'Toutes les données Believe de cet appareil sont supprimées (vérifié), enregistrements audio et code d’accès compris. Believe ne conserve pas vos échanges avec l’IA, mais ne peut pas effacer ce que Google a pu garder selon son offre (voir README).' } : { e: 1, t: 'Suppression non confirmée : le stockage n’a pas pu être vérifié.' })
  }
  return (
    <>
      {bak && <div className="card"><h2>Données illisibles conservées</h2><p className="mut">Au dernier démarrage, des données n’ont pas pu être lues. Une copie brute ({Math.ceil(bak.length / 1024)} Ko) est gardée pour que vous puissiez la récupérer.</p>
        <div className="row"><button className="btn alt" onClick={() => copy(bak)}>Copier la copie brute</button><button className="btn alt" onClick={() => { try { localStorage.removeItem(KEY_BAK) } catch { /* ignoré */ } setBak(null); setM({ t: 'Copie brute supprimée.' }) }}>Supprimer la copie</button></div></div>}
      <div className="card"><h2>Exporter en JSON</h2><button className="btn alt" onClick={() => setEx(JSON.stringify(S, null, 1))}>Générer l’export</button>
        {ex && <><textarea readOnly rows={6} style={{ marginTop: 8 }} aria-label="Export JSON" value={ex} /><button className="btn" style={{ marginTop: 8 }} onClick={() => copy(ex)}>Copier</button></>}
        <p className="mut">L’export contient vos données enregistrées dans le navigateur (profil, habitudes, notes, santé…). Les enregistrements audio, volumineux, restent sur l’appareil et n’y figurent pas.</p></div>
      <div className="card"><h2>Importer</h2><p className="mut">Remplace entièrement les données locales (règle de conflit unique), hors enregistrements audio. Les exports de la version 1 sont acceptés et convertis. Un aperçu s’affiche avant tout remplacement.</p>
        <textarea rows={5} aria-label="JSON à importer" placeholder="Collez ici un export Believe" value={im} onChange={e => { setIm(e.target.value); setPv(null) }} />
        <div className="row" style={{ marginTop: 8 }}><button className="btn alt" onClick={check}>Vérifier</button>
          {pv?.o && <button className="btn" onClick={() => { const o = pv.o as State; upd(s => { Object.assign(s, DEF(), o); roll(s) }, 'Données importées (remplacement complet).'); setIm(''); setPv(null) }}>Importer</button>}</div>
        {pv && <p className={pv.e ? 'ko' : 'ok'}>{pv.t}</p>}</div>
      <div className="card"><h2>Droit à l’oubli</h2><p className="mut">Supprime toutes les données Believe de cet appareil, enregistrements audio, PIN et code d’accès à l’IA compris. Ce que Google a pu conserver des échanges avec l’IA ne peut pas être effacé depuis Believe (voir README).</p>
        {pg ? <><button className="btn" onClick={wipe}>Confirmer la suppression définitive</button> <button className="btn alt" onClick={() => setPg(false)}>Annuler</button></> : <button className="btn alt" onClick={wipe}>Tout supprimer</button>}</div>
    </>
  )
}

export default function DataPage(p: DP) {
  const [tab, setTab] = useTab(p.sub, ['bilan', 'partage', 'confidentialite', 'reglages', 'donnees'])
  return (
    <>
      <h1>Bilan, partage, RGPD et données</h1>
      <Flash m={p.m} />
      <Tabs items={['Bilan', 'Partage', 'Confidentialité', 'Réglages', 'Données']} v={tab} set={setTab} label="Section" S={p.S} wrap>
        {tab === 0 && <Bilan {...p} />}
        {tab === 1 && <SharePanel {...p} />}
        {tab === 2 && <Privacy {...p} />}
        {tab === 3 && <Settings {...p} />}
        {tab === 4 && <Donnees {...p} />}
      </Tabs>
    </>
  )
}
