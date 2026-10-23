export interface Pt { lat: number; lng: number; alt: number | null; t: number; acc: number }
const pad = (n: number) => String(n).padStart(2, '0')

/** Distance orthodromique (Haversine) en mètres. */
export const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371008.8, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
/** Point accepté si précision ≤ 30 m et vitesse implicite ≤ 12 m/s (filtre des points imprécis et des sauts). */
export const accept = (prev: Pt | null, p: Pt) =>
  p.acc <= 30 && (!prev || haversine(prev, p) / Math.max(1, (p.t - prev.t) / 1000) <= 12)
/** Allure moyenne min:s par km (arrondie à la seconde entière avant découpage). */
export const pace = (sec: number, km: number) => {
  if (km < 0.05) return '—'
  const t = Math.round(sec / km)
  return Math.floor(t / 60) + ':' + pad(t % 60)
}
export const clock = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60)
  return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s)
}
/** Calories ESTIMÉES (MET × poids × heures), pas une mesure. Course : MET ≈ vitesse en km/h (plancher 6). */
export const kcal = (act: string, kg: number, km: number, sec: number) => {
  const v = sec ? km / (sec / 3600) : 0
  const met = act === 'Marche' ? 3.8 : act === 'Randonnée' ? 6 : act === 'Trail' ? Math.max(7, v) : Math.max(6, v)
  return Math.round(met * kg * sec / 3600)
}
