import type { SharePayload } from './share'
import { dateFr, rowsOf, titleOf, whyBad } from './share'

/**
 * Carte image du partage (Canvas, sur l'appareil). Elle est dessinée UNIQUEMENT à partir des lignes de `rowsOf(payload)` : tout ce qui est écrit sur
 * l'image se retrouve dans l'aperçu « Vue Ami » et le texte, et rien d'autre. Polices du système, aucun chargement externe.
 */
export const W = 1080
const PAD = 64, MAXW = W - 2 * PAD - 24
const C = { top: '#2d3087', bot: '#44479a', gold: '#d3b36a', jewel: '#a592e8', flame: '#e5a05a', glow: '#f3d79a', ivory: '#fcfcfe', lav: '#d6d7f5', bg: '#f4f3f9', ink: '#222248', pri: '#44479a', mut: '#66658a', line: '#e0deef' }
const F = { word: '600 54px Georgia, "Times New Roman", serif', title: '600 44px Georgia, "Times New Roman", serif', date: '400 30px system-ui, -apple-system, "Segoe UI", sans-serif', h: '700 34px system-ui, -apple-system, "Segoe UI", sans-serif', l: '400 32px system-ui, -apple-system, "Segoe UI", sans-serif', foot: '400 25px system-ui, -apple-system, "Segoe UI", sans-serif' }
export interface Op { s: string; x: number; y: number; font: string; c: string }
export interface Layout { ops: Op[]; H: number; headH: number; rules: { y: number }[]; footY: number }

/** Retour à la ligne glouton selon la largeur réellement mesurée. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = cur ? cur + ' ' + w : w
    if (cur && ctx.measureText(t).width > max) { out.push(cur); cur = w } else cur = t
  }
  if (cur) out.push(cur)
  return out.length ? out : ['']
}

/** Raccourcit un texte (avec « … ») pour qu'il tienne sur une ligne. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

export function layoutCard(ctx: CanvasRenderingContext2D, p: SharePayload): Layout {
  const ops: Op[] = [], rules: { y: number }[] = [], headH = 300
  const put = (s: string, x: number, y: number, font: string, c: string) => ops.push({ s, x, y, font, c })
  // en-tête : le mot « BELIEVE » est espacé lettre par lettre (letterSpacing n'existe pas partout)
  ctx.font = F.word
  let x = PAD + 190
  for (const ch of 'BELIEVE') { put(ch, x, 132, F.word, C.gold); x += ctx.measureText(ch).width + 13 }
  ctx.font = F.title; put(fit(ctx, titleOf(p), W - PAD - 190 - PAD), PAD + 190, 198, F.title, C.ivory)
  put(dateFr(p.d), PAD + 190, 250, F.date, C.lav)
  // corps
  let y = headH + 70
  const rows = rowsOf(p)
  if (!rows.length) { ctx.font = F.l; for (const l of wrap(ctx, 'Aucun élément choisi.', MAXW)) { put(l, PAD, y, F.l, C.mut); y += 46 } }
  rows.forEach((r, i) => {
    ctx.font = F.h; put(r.h, PAD + 24, y, F.h, C.pri); y += 18
    ctx.font = F.l
    for (const l of r.l) for (const w of wrap(ctx, l, MAXW)) { y += 46; put(w, PAD + 24, y, F.l, C.ink) }
    y += 34; if (i < rows.length - 1) rules.push({ y: y - 22 }) // un trait entre deux rubriques, pas après la dernière
  })
  // pied
  ctx.font = F.foot
  const foot = wrap(ctx, 'Carte créée sur l’appareil avec Believe : seuls les éléments choisis y figurent.', W - 2 * PAD), footY = y + 20
  foot.forEach((l, i) => put(l, PAD, footY + 24 + i * 34, F.foot, C.mut))
  return { ops, H: Math.max(720, footY + 24 + foot.length * 34 + 56), headH, rules, footY }
}

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  if (typeof Path2D === 'undefined') return
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k)
  ctx.fillStyle = C.gold
  ctx.fill(new Path2D('M6 44 10 14 24 28 32 8 40 28 54 14 58 44Z')); ctx.fill(new Path2D('M8 44H56A2 2 0 0 1 58 46V49A2 2 0 0 1 56 51H8A2 2 0 0 1 6 49V46A2 2 0 0 1 8 44Z'))
  ctx.fillStyle = C.jewel
  for (const [cx, cy, r] of [[10, 12, 3.2], [32, 6, 3.2], [54, 12, 3.2], [20, 47.5, 1.7], [32, 47.5, 1.7], [44, 47.5, 1.7]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill() }
  ctx.fillStyle = C.flame; ctx.fill(new Path2D('M32 41C23 35 28 27 32 19 36 27 41 35 32 41Z'))
  ctx.fillStyle = C.glow; ctx.fill(new Path2D('M32 39C28 35 30 31 32 27 34 31 36 35 32 39Z'))
  ctx.restore()
}

export function paintCard(ctx: CanvasRenderingContext2D, lay: Layout) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, lay.H)
  const g = ctx.createLinearGradient(0, 0, W, lay.headH); g.addColorStop(0, C.top); g.addColorStop(1, C.bot)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, lay.headH)
  ctx.fillStyle = C.gold; ctx.fillRect(0, lay.headH, W, 6)
  crown(ctx, PAD, 78, 2.7)
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
  for (const o of lay.ops) { ctx.font = o.font; ctx.fillStyle = o.c; ctx.fillText(o.s, o.x, o.y) }
  ctx.fillStyle = C.line
  for (const r of lay.rules) ctx.fillRect(PAD, r.y, W - 2 * PAD, 2)
  ctx.fillRect(PAD, lay.footY - 6, W - 2 * PAD, 2)
}

/** Image PNG de la carte. La carte est d'abord vérifiée en liste blanche : une clé ou un type inattendu fait refuser la génération. */
export async function cardBlob(p: SharePayload): Promise<Blob> {
  const bad = whyBad(p)
  if (bad) throw new Error('Carte refusée (' + bad + ').')
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) throw new Error('canvas')
  const lay = layoutCard(probe, p), c = document.createElement('canvas')
  c.width = W; c.height = lay.H
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas')
  paintCard(ctx, lay)
  return new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('png'))), 'image/png'))
}
