/** Logo Believe : couronne dorée ornée de joyaux, flamme au centre (animation coupée en mouvement réduit). `size` : largeur en pixels (40 par défaut, dans l'en-tête). */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={Math.round(size * 0.9)} style={{ width: size, height: Math.round(size * 0.9) }} viewBox="0 0 64 56" role="img" aria-label="Logo Believe : couronne et flamme">
      <path className="lc" d="M6 44 10 14 24 28 32 8 40 28 54 14 58 44Z" /><rect className="lc" x="6" y="44" width="52" height="7" rx="2" />
      {[[10, 12], [32, 6], [54, 12]].map(([x, y]) => <circle key={x} className="lj" cx={x} cy={y} r="3.2" />)}
      {[20, 32, 44].map(x => <circle key={x} className="lj" cx={x} cy="47.5" r="1.7" />)}
      <g className="flame"><path className="lf" d="M32 41C23 35 28 27 32 19 36 27 41 35 32 41Z" /><path className="lg" d="M32 39C28 35 30 31 32 27 34 31 36 35 32 39Z" /></g>
    </svg>
  )
}
