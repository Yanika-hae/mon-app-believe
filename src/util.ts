// Fonctions pures partagées (sans React) : testables directement.
/** Normalisation pour la recherche : minuscules, sans accents. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const DN = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const num = (x: string) => parseFloat(x.replace(',', '.'))
/** Direction d'un geste : 1 = vers la gauche (section suivante), -1 = vers la droite, 0 = ni l'un ni l'autre (trop court, trop lent ou trop vertical). */
export const swipeDir = (dx: number, dy: number, dt: number): -1 | 0 | 1 => {
  if (dt > 900 || Math.abs(dx) < 70 || Math.abs(dx) < 1.8 * Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

// ---------------------------------------------------------------- recherche plein texte (insensible à la casse et aux accents)
/** Mots recherchés, normalisés. */
export const terms = (q: string) => norm(q).split(/\s+/).filter(Boolean)
/** Vrai si chacun des mots est présent dans le texte (ET logique). Sans mot, tout correspond. */
export const matches = (hay: string, ts: string[]) => { if (!ts.length) return true; const h = norm(hay); return ts.every(t => h.includes(t)) }
/** Découpe le texte en segments dont ceux qui contiennent un mot recherché sont marqués ; le texte d'origine est conservé tel quel (accents et casse compris). */
export function highlight(text: string, ts: string[]): { t: string; m: boolean }[] {
  if (!ts.length || !text) return [{ t: text, m: false }]
  let n = ''
  const at: number[] = [], len: number[] = []
  let i = 0
  for (const ch of text) { const c = norm(ch); for (let k = 0; k < c.length; k++) { at.push(i); len.push(ch.length) } n += c; i += ch.length }
  const iv: [number, number][] = []
  for (const t of ts) { for (let from = n.indexOf(t); from >= 0; from = n.indexOf(t, from + t.length)) iv.push([from, from + t.length]) }
  if (!iv.length) return [{ t: text, m: false }]
  iv.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const mg: [number, number][] = []
  for (const [a, b] of iv) { const l = mg[mg.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else mg.push([a, b]) }
  const out: { t: string; m: boolean }[] = []
  let p = 0
  for (const [a, b] of mg) {
    const s = at[a]
    let e = at[b - 1] + len[b - 1]
    while (e < text.length && /[\u0300-\u036f]/.test(text[e])) e++
    if (s > p) out.push({ t: text.slice(p, s), m: false })
    out.push({ t: text.slice(s, e), m: true }); p = e
  }
  if (p < text.length) out.push({ t: text.slice(p), m: false })
  return out
}
/** Extrait d'au plus `max` caractères : le début du texte, ou la zone du premier mot trouvé s'il se situe plus loin. */
export function excerpt(text: string, ts: string[], max = 280): string {
  if (text.length <= max) return text
  const segs = highlight(text, ts)
  let off = 0, hit = -1
  for (const s of segs) { if (s.m) { hit = off; break } off += s.t.length }
  if (hit < max - 40) return text.slice(0, max).trimEnd() + '…'
  const a = Math.max(0, hit - 60)
  return '…' + text.slice(a, a + max).trim() + (a + max < text.length ? '…' : '')
}

/** Découpe un texte en morceaux d'au plus `max` caractères, à la fin des phrases quand c'est possible : certains navigateurs interrompent une longue lecture vocale d'un seul tenant. */
export function chunks(text: string, max = 200): string[] {
  const out: string[] = []
  let cur = ''
  const flush = () => { if (cur) out.push(cur); cur = '' }
  for (const raw of text.replace(/\s+/g, ' ').trim().match(/[^.!?…;:]+[.!?…;:]*/g) ?? []) {
    let s = raw.trim()
    if (!s) continue
    while (s.length > max) { // phrase trop longue : coupée à un espace (ou net si le mot est plus long que le morceau)
      flush()
      let i = s.lastIndexOf(' ', max)
      if (i < max / 2) i = max
      out.push(s.slice(0, i).trim()); s = s.slice(i).trim()
    }
    if (!s) continue
    if (cur && (cur + ' ' + s).length > max) flush()
    cur = cur ? cur + ' ' + s : s
  }
  flush()
  return out
}

// ---------------------------------------------------------------- prompteur et métronome
/** Avance le défilement du prompteur : position (px) après `dtMs` à `speed` px/s, bornée à `max` ; un long intervalle (onglet en arrière-plan) est ramené à 100 ms pour éviter un saut. */
export const stepScroll = (pos: number, dtMs: number, speed: number, max: number) => {
  const p = Math.min(Math.max(0, max), Math.max(0, pos) + (Math.min(Math.max(0, dtMs), 100) / 1000) * speed)
  return { pos: p, done: p >= max }
}
export const BPM_MIN = 30, BPM_MAX = 240
export const clampBpm = (n: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(n)))
/** Tempo (battements par minute) déduit d'une série de frappes (horodatages en ms) ; seule la dernière série sans pause de 2 s ou plus compte. Renvoie null avec moins de deux frappes. */
export function tapBpm(taps: number[], maxGap = 2000): number | null {
  const t = taps.slice(-6)
  let i = t.length - 1
  while (i > 0 && t[i] - t[i - 1] < maxGap) i--
  const run = t.slice(i)
  if (run.length < 2 || run[run.length - 1] === run[0]) return null
  return clampBpm(60000 / ((run[run.length - 1] - run[0]) / (run.length - 1)))
}
/** Battements à programmer entre `now` et `now + ahead` (secondes de l'horloge audio) ; renvoie aussi l'état à conserver pour l'appel suivant. */
export function plan(st: { next: number; beat: number }, now: number, ahead: number, bpm: number, beats: number) {
  const ev: { t: number; b: number }[] = []
  let { next, beat } = st
  const step = 60 / clampBpm(bpm)
  if (beat >= beats) beat = 0
  while (next < now + ahead) { ev.push({ t: next, b: beat }); next += step; beat = (beat + 1) % beats }
  return { next, beat, ev }
}
/** Nom italien usuel du tempo. */
export const tempoName = (bpm: number) => (bpm < 60 ? 'Largo' : bpm < 76 ? 'Adagio' : bpm < 108 ? 'Andante' : bpm < 120 ? 'Moderato' : bpm < 168 ? 'Allegro' : 'Presto')
/** Mise en forme d'une durée en millisecondes : 1:05. */
export const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
/** Taille lisible : 850 o, 12 Ko, 3,4 Mo. */
export const size = (b: number) => (b < 1024 ? Math.round(b) + ' o' : b < 1048576 ? Math.round(b / 1024) + ' Ko' : (b / 1048576).toFixed(1).replace('.', ',') + ' Mo')
