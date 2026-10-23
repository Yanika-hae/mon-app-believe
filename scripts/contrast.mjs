// Contraste WCAG des couleurs de texte de chaque thème (clair, sombre, noir OLED) sur chaque fond. Lancer : node scripts/contrast.mjs
import { readFileSync } from 'node:fs'
const css = readFileSync('src/styles.css', 'utf8')
const grab = re => { const m = css.match(re); if (!m) throw new Error('thème introuvable : ' + re); return Object.fromEntries([...m[1].matchAll(/--([a-z]+):(#[0-9a-fA-F]{3,6})/g)].map(x => [x[1], x[2]])) }
const THEMES = {
  clair: grab(/^:root\{([^}]*)\}/m),
  sombre: grab(/^:root\[data-theme="dark"\]\{([^}]*)\}/m),
  oled: grab(/^:root\[data-theme="oled"\]\{([^}]*)\}/m)
}
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) }
const lum = h => { const [r, g, b] = rgb(h).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
// [couleur, minimum exigé] : 4,5 pour le texte courant ; 3 pour les éléments graphiques porteurs d'information (courbes, jauges)
const TEXT = { ink: 4.5, mut: 4.5, pri: 4.5, ok: 4.5, warn: 4.5, err: 4.5, gold: 4.5, na: 4.5 }
const GRAPH = { gold: 3, pri: 3 } // jewel et flamme ne servent qu'au logo et à des décors sans information (exemptés)
const BG = ['bg', 'card', 'soft']
let bad = 0
for (const [name, t] of Object.entries(THEMES)) {
  for (const bg of BG) {
    for (const [fg, min] of Object.entries(TEXT)) { const r = ratio(t[fg], t[bg]); if (r < min) { bad++; console.log('ÉCHEC', name, 'texte', fg, 'sur', bg, r.toFixed(2), '<', min) } }
    for (const [fg, min] of Object.entries(GRAPH)) { const r = ratio(t[fg], t[bg]); if (r < min) { bad++; console.log('ÉCHEC', name, 'graphique', fg, 'sur', bg, r.toFixed(2), '<', min) } }
  }
  const r = ratio(t.onpri, t.pri); if (r < 4.5) { bad++; console.log('ÉCHEC', name, 'texte sur bouton principal', r.toFixed(2)) }
}
// Tuiles de couverture des livres : texte blanc sur chaque teinte (identique dans les 3 thèmes)
for (const [, n, hex] of css.matchAll(/\.cov\.t(\d)\{background:(#[0-9a-fA-F]{6})\}/g)) { const r = ratio('#ffffff', hex); if (r < 4.5) { bad++; console.log('ÉCHEC couverture teinte', n, r.toFixed(2)) } }
if (![...css.matchAll(/\.cov\.t\d\{/g)].length) { bad++; console.log('ÉCHEC : aucune teinte de couverture trouvée') }
console.log(bad ? bad + ' contraste(s) insuffisant(s)' : 'Tous les contrastes de texte sont ≥ 4,5:1 (graphiques ≥ 3:1) dans les 3 thèmes, sur fond, carte et zone douce ; texte blanc des couvertures de livres ≥ 4,5:1.')
process.exit(bad ? 1 : 0)
